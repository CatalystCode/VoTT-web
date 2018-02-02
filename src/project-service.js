'use strict';

const async = require("async");
const azure = require('azure-storage');
const qs = require('qs');
const uuid = require('uuid/v4');

const foundation = require('./vott-foundation');

/**
 * Global projects table.
 */
const projectsTableName = process.env.PROJECT_TABLE_NAME || 'projects';

function ProjectService() {
}

ProjectService.prototype.setServices = function (configuration) {
    Object.assign(this, configuration);

    const self = this;
    return new Promise((resolve, reject) => {
        self.tableService.createTableIfNotExists(projectsTableName, (error, results) => {
            if (error) return reject(error);
            else return resolve(results);
        });
    });
}

/**
 * Temporary decoder since the node storage queue client was automatically XML-escaping all outgoing messages.
 */
function decodeXml(textToDecode) {
    return textToDecode.replace(/&amp;/gm, '&')
        .replace(/&lt;/gm, '<')
        .replace(/&gt;/gm, '>')
        .replace(/&quot;/gm, '"')
        .replace(/&apos;/gm, '\'');
};

ProjectService.prototype.getTaskQueueName = function (projectId) {
    return this.imageService.getTaskQueueName(projectId);
}

ProjectService.prototype.getNextTask = function (projectId) {
    const self = this;
    return this.readProject(projectId).then(project => {
        return new Promise((resolve, reject) => {
            const queueName = self.projectService.getTaskQueueName(projectId);
            self.queueService.getMessage(queueName, (error, message) => {
                if (error) {
                    return reject(error);
                }

                const messageId = message.messageId;
                const popReceipt = message.popReceipt;
                const imageData = message.messageText.startsWith('{&quot;') ? JSON.parse(decodeXml(message.messageText)) : JSON.parse(message.messageText);
                const imageURL = self.imageService.getImageURL(projectId, imageData.imageId);

                resolve({
                    taskId: [projectId, imageData.imageId, messageId, popReceipt].join('.'),
                    projectId: projectId,
                    messageId: messageId,
                    popReceipt: popReceipt,
                    imageURL: imageURL,
                    taskType: project.taskType,
                    labels: project.labels,
                    instructionsText: project.instructionsText,
                    instructionsImageURL: project.instructionsImageURL,
                    instructionsVideoURL: project.instructionsVideoURL
                });
            });
        });
    });
}

ProjectService.prototype.submitImageTags = function (taksId, tags) {
    const [projectId, imageId, messageId, popReceipt] = taskId.split('.');
    // TODO: Save annotations.
    // TODO: Perform annotation cross-validation and pick the best ones, then cannonicalize them for training.
    self.queueService.deleteMessage(projectId, messageId, popReceipt, (error) => {
        if (error) {
            return reject(error);
        }
        resolve("OK");
    });

}

ProjectService.prototype.createProject = function (name, taskType, labels, instructionsText) {
    const self = this;
    return new Promise((resolve, reject) => {
        const projectId = uuid().toString();

        // The instructionsImageURL property is updated via
        // createInstructionsImage()
        const project = {
            PartitionKey: projectId,
            RowKey: projectId,
            name: name,
            taskType: taskType,
            labels: JSON.stringify(labels),
            instructionsText: instructionsText
        };
        const imageContainerName = self.imageService.getImageContainerName(projectId);
        const modelContainerName = self.modelService.getModelContainerName(projectId);
        const taskQueueName = self.imageService.getTaskQueueName(projectId);
        async.series(
            [
                (callback) => { self.queueService.createQueueIfNotExists(taskQueueName, callback); },
                (callback) => { self.blobService.createContainerIfNotExists(imageContainerName, { publicAccessLevel: 'blob' }, callback); },
                (callback) => { self.blobService.createContainerIfNotExists(modelContainerName, { publicAccessLevel: 'blob' }, callback); },
                (callback) => { self.tableService.insertEntity(projectsTableName, project, callback); }
            ],
            (error, results) => {
                if (error) {
                    return reject(error);
                }
                resolve(self.mapProject(project));
            }
        ); /* async.series */
    });
}

ProjectService.prototype.readProjects = function (nextPageToken) {
    const self = this;
    return new Promise((resolve, reject) => {
        var query = new azure.TableQuery().top(10);
        self.tableService.queryEntities(projectsTableName, query, nextPageToken, (error, results, response) => {
            if (error) {
                return reject(error);
            }
            resolve({
                nextPageToken: (results.continuationToken) ? JSON.stringify(results.continuationToken) : null,
                entries: results.entries.map(entry => { return self.mapProject(entry); })
            });
        });
    });
}

ProjectService.prototype.readProject = function (projectId) {
    const self = this;
    return new Promise((resolve, reject) => {
        self.tableService.retrieveEntity(projectsTableName, projectId, projectId, (error, response) => {
            if (error) {
                return reject(error);
            }
            resolve(self.mapProject(response));
        });
    });
}

ProjectService.prototype.updateInstructionsImage = function (projectId, fileId) {
    const self = this;
    return new Promise((resolve, reject) => {
        const entityDescriptor = {
            PartitionKey: { "_": projectId },
            RowKey: { "_": projectId },
            instructionsImageId: fileId
        };

        self.tableService.mergeEntity(projectsTableName, entityDescriptor, (error, project) => {
            if (error) return reject(error);
            else return resolve("OK");
        });
    });
}

ProjectService.prototype.updateProject = function (projectId, name, taskType, labels, instructionsText) {
    const self = this;
    return new Promise((resolve, reject) => {
        const entityDescriptor = {
            PartitionKey: { "_": projectId },
            RowKey: { "_": projectId }
        };
        if (name) {
            entityDescriptor.name = name;
        }
        if (taskType) {
            entityDescriptor.taskType = taskType;
        }
        if (labels) {
            entityDescriptor.labels = JSON.stringify(labels);
        }
        if (instructionsText) {
            entityDescriptor.instructionsText = instructionsText;
        }
        self.tableService.mergeEntity(projectsTableName, entityDescriptor, (error, project) => {
            if (error) {
                return reject(error);
            }
            resolve("OK");
        });
    });
}

ProjectService.prototype.deleteProject = function (projectId) {
    const self = this;
    return new Promise((resolve, reject) => {
        const imageContainerName = self.imageService.getImageContainerName(projectId);
        const taskQueueName = self.imageService.getTaskQueueName(projectId);
        const modelContainerName = self.modelService.getModelContainerName(projectId);

        async.series(
            [
                (callback) => { self.tableService.deleteEntity(projectsTableName, { PartitionKey: { "_": projectId }, RowKey: { "_": projectId } }, callback); },
                (callback) => { self.queueService.deleteQueueIfExists(taskQueueName, callback); },
                (callback) => { self.blobService.deleteContainerIfExists(imageContainerName, null, callback); },
                (callback) => { self.blobService.deleteContainerIfExists(modelContainerName, null, callback); }
            ],
            (error, results) => {
                if (error) {
                    return reject(error);
                }
                resolve(projectId);
            }
        ); /* async.series */
    });
}

ProjectService.prototype.mapProject = function (value) {
    const labelsValue = foundation.mapColumnValue(value.labels);
    const labels = (labelsValue instanceof Array) ? labelsValue : JSON.parse(labelsValue);
    const projectId = foundation.mapColumnValue(value.RowKey);

    const instructionsImageId = foundation.mapColumnValue(value.instructionsImageId);
    const instructionsImageURL = (instructionsImageId) ? this.imageService.getImageURL(projectId, instructionsImageId) : null;

    return {
        projectId: foundation.mapColumnValue(value.RowKey),
        name: foundation.mapColumnValue(value.name),
        taskType: foundation.mapColumnValue(value.taskType),
        labels: (labels) ? labels : [],
        instructionsText: foundation.mapColumnValue(value.instructionsText),
        instructionsImageURL: instructionsImageURL
    };
}

module.exports = {
    createProjectService: function () {
        return new ProjectService();
    }
};
