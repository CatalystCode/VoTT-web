const async = require('async');
const azureStorage = require('azure-storage');
const uuid = require('uuid/v4');

const storageFoundation = require('../foundation/storage');

function TrainingImageService(blobService, tableService, queueService, projectService) {
    this.blobService = blobService;
    this.tableService = tableService;
    this.queueService = queueService;
    this.projectService = projectService;

    this.trainingImagesTableName = 'TrainingImages';
    this.trainingImageTagsTableName = 'TrainingImageTags';
    this.ensureTablesExistAsync();
}

TrainingImageService.prototype.ensureTablesExistAsync = async function () {
    await this.ensureTablesExist();
}

TrainingImageService.prototype.ensureTablesExist = function () {
    return Promise.all([
        storageFoundation.createTableIfNotExists(this.tableService, this.trainingImagesTableName),
        storageFoundation.createTableIfNotExists(this.tableService, this.trainingImageTagsTableName)
    ]);
}

TrainingImageService.prototype.list = function (projectId, currentToken, requestedLimit) {
    const limit = requestedLimit ? parseInt(requestedLimit) : 128;
    const tableQuery = new azureStorage.TableQuery().top(limit).where('PartitionKey == ?', projectId);
    return storageFoundation.queryEntities(this.tableService, this.trainingImagesTableName, tableQuery, currentToken).then(result => {
        const records = result.entries.map(entity => {
            return this.mapEntityToImage(entity);
        });
        return {
            currentToken: result.continuationToken,
            limit: limit,
            entries: records
        };
    });
}

TrainingImageService.prototype.count = function (projectId, status, currentToken) {
    return new Promise((resolve, reject) => {
        const tableQuery = new azureStorage.TableQuery().select('PrimaryKey').where('PartitionKey == ? and status == ?', projectId, status);
        this.tableService.queryEntities(this.trainingImagesTableName, tableQuery, currentToken, (error, result) => {
            if (error) {
                return reject(error);
            }
            const currentCount = result.entries.length;
            if (result.continuationToken) {
                return this.count(projectId, status, result.continuationToken).then(count => {
                    resolve(currentCount + count);
                }).catch(error => {
                    resolve(currentCount);
                });
            } else {
                resolve(currentCount);
            }
        });
    });
}

TrainingImageService.prototype.allocate = function (image) {
    const projectId = image.projectId;
    const containerName = this.projectService.getTrainingImageContainerName(projectId);
    return new Promise((resolve, reject) => {
        const sas = storageFoundation.createSAS(this.blobService, containerName);
        return resolve(Object.assign({ projectId: projectId }, sas));
    });
}

TrainingImageService.prototype.create = function (image) {
    return this.projectService.read(image.projectId).then(project => {
        const imageRecord = {
            id: image.id,
            projectId: image.projectId,
            status: 'tag-pending'
        };

        return Promise.all([
            this.createImage(imageRecord),
            this.createTasks(project, imageRecord)
        ]);
    });

}

TrainingImageService.prototype.createImage = function (imageRecord) {
    return new Promise((resolve, reject) => {
        const entity = mapImageToEntity(imageRecord);
        this.tableService.insertEntity(this.trainingImagesTableName, entity, (error) => {
            if (error) {
                return reject(error);
            }
            return resolve(imageRecord);
        });
    });
}

TrainingImageService.prototype.createTasks = function (project, image) {
    const taskMessage = {
        type: project.type,
        imageId: image.id,
        imageURL: this.projectService.getImageURL(project.id, image.id),
        labels: project.labels,
        instructionsText: project.instructionsText,
        instructionsImageURL: this.projectService.getImageURL(project.id, project.instructionsImageId)
    };
    const taskMessageString = JSON.stringify(taskMessage);
    return Promise.all([
        this.createTask(project, taskMessageString),
        this.createTask(project, taskMessageString),
        this.createTask(project, taskMessageString)
    ]);
}

TrainingImageService.prototype.createTask = function (project, taskMessage) {
    return new Promise((resolve, reject) => {
        const queueName = this.projectService.getTaskQueueName(project.id);
        this.queueService.createMessage(queueName, taskMessage, (error) => {
            if (error) {
                return reject(error);
            }
            resolve({});
        });
    });
}

TrainingImageService.prototype.delete = function (projectId) {
    return new Promise((resolve, reject) => {
        const task = {
            PartitionKey: { '_': projectId },
            RowKey: { '_': projectId }
        };
        this.tableService.deleteEntity(this.projectTableName, task, (error, result, response) => {
            if (error) {
                return reject(error);
            }
            return resolve();
        });
    });
}

TrainingImageService.prototype.pullTask = function (projectId) {
    const queueName = this.projectService.getTaskQueueName(projectId);
    return new Promise((resolve, reject) => {
        this.queueService.getMessage(queueName, (error, message) => {
            if (error) return reject(error);
            if (!message) return resolve(null, null);

            const task = JSON.parse(message.messageText);
            task.id = message.messageId;
            task.popReceipt = message.popReceipt;
            resolve(task);
        });
    });
}

TrainingImageService.prototype.pushTask = function (projectId, task, user) {
    const imageId = task.imageId;
    const tags = task.tags;
    const messageId = task.id;
    const popReceipt = task.popReceipt;

    return this.createImageTag(projectId, imageId, tags, user).then(tag => {
        return Promise.all([
            this.removeTask(projectId, messageId, popReceipt),
            this.refreshImageStatus(projectId, imageId)
        ]);
    });
}

TrainingImageService.prototype.createImageTag = function (projectId, imageId, tags, user) {
    const entity = {
        PartitionKey: { '_': imageId },
        RowKey: { '_': uuid() },
        tags: { '_': JSON.stringify(tags) },
        user: { '_': user.username }
    };
    return storageFoundation.insertEntity(this.tableService, this.trainingImageTagsTableName, entity);
}

TrainingImageService.prototype.removeTask = function (projectId, messageId, popReceipt) {
    const taskQueueName = this.projectService.getTaskQueueName(projectId);
    return new Promise((resolve, reject) => {
        this.queueService.deleteMessage(taskQueueName, messageId, popReceipt, function (error) {
            if (error) return reject(error);
            return resolve();
        });
    });
}

TrainingImageService.prototype.refreshImageStatus = function (projectId, imageId) {
    return this.calculateImageStatus(projectId, imageId).then(status => {
        return this.setImageStatus(projectId, imageId, status).then(result => {
            return status
        });
    });
}

TrainingImageService.prototype.calculateImageStatus = function (projectId, imageId) {
    const tableQuery = new azureStorage.TableQuery().where('PartitionKey == ?', imageId);
    return storageFoundation.queryEntities(this.tableService, this.trainingImageTagsTableName, tableQuery).then(result => {
        const tags = result.entries;
        if (tags.length < 2) {
            return 'tag-pending';
        }

        // If 2 of the 3 tags agree, update to 'ready-for-training', 'conflict' otherwise. 
        return 'ready-for-training';
    });
}

TrainingImageService.prototype.setImageStatus = function (projectId, imageId, status) {
    const entity = {
        PartitionKey: { '_': projectId },
        RowKey: { '_': imageId },
        status: { '_': status }
    };
    return storageFoundation.mergeEntity(this.tableService, this.trainingImagesTableName, entity);
}

TrainingImageService.prototype.getImageURL = function (projectId, imageId) {
    // TODO: Consider using an SAS token.
    const containerName = this.projectService.getTrainingImageContainerName(projectId);
    const url = this.blobService.getUrl(containerName, imageId);
    return url;
}

TrainingImageService.prototype.mapEntityToImage = function (entity) {
    const imageId = entity.RowKey._;
    const projectId = entity.PartitionKey._;
    return {
        id: imageId,
        projectId: projectId,
        status: entity.status._,
        url: this.getImageURL(projectId, imageId)
    };
}

function mapImageToEntity(image) {
    const generator = azureStorage.TableUtilities.entityGenerator;
    return {
        PartitionKey: generator.String(image.projectId),
        RowKey: generator.String(image.id),
        status: image.status
    };
}

module.exports = TrainingImageService;
