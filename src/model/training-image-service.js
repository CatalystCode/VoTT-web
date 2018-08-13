const async = require('async');
const azureStorage = require('azure-storage');
const uuid = require('uuid/v4');
const rbush = require('rbush');
const storageFoundation = require('../foundation/storage');

function TrainingImageService(blobService, tableService, queueService, projectService) {
    this.blobService = blobService;
    this.tableService = tableService;
    this.queueService = queueService;
    this.projectService = projectService;

    this.trainingImagesTableName = 'TrainingImages';
    this.trainingImageContributionsTableName = 'TrainingImageContributions';
    this.ensureTablesExistAsync();
}

TrainingImageService.prototype.ensureTablesExistAsync = async function () {
    await this.ensureTablesExist();
}

TrainingImageService.prototype.ensureTablesExist = function () {
    return Promise.all([
        storageFoundation.createTableIfNotExists(this.tableService, this.trainingImagesTableName),
        storageFoundation.createTableIfNotExists(this.tableService, this.trainingImageContributionsTableName)
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

TrainingImageService.prototype.getReadyForTraining = function (projectId, currentToken) {
    const status = 'ready-for-training';
    const tableQuery = new azureStorage.TableQuery().where('PartitionKey == ? and status == ?', projectId, status);
    return new Promise((resolve, reject) => {
        this.tableService.queryEntities(this.trainingImagesTableName, tableQuery, currentToken, (error, result) => {
            if (error) {
                return reject(error);
            }
            const records = result.entries.map(entity => {
                return this.mapEntityToImage(entity);
            });
            if (result.continuationToken) {
                return this.getReadyForTraining(projectId, result.continuationToken).then(moreRecords => {
                    resolve(records.concat(moreRecords));
                }).catch(error => {
                    resolve(records);
                });
            } else {
                resolve(records);
            }
        });
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
    return storageFoundation.insertEntity(this.tableService, this.trainingImageContributionsTableName, entity);
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
    return this.projectService.read(projectId).then(project => {
        const tableQuery = new azureStorage.TableQuery().where('PartitionKey == ?', imageId);
        return storageFoundation.queryEntities(this.tableService, this.trainingImageContributionsTableName, tableQuery).then(result => {
            if (result.entries.length < 2) {
                return 'tag-pending';
            }

            const contributions = result.entries.map(entity => {
                return this.mapEntityToContribution(entity);
            })
            if (project.type == 'object-detection') {
                return this.calculateStatusForObjectDetection(contributions);
            } else {
                return this.calculateStatusForImageClassification(contributions);
            }
        });
    });
}

TrainingImageService.prototype.mapEntityToContribution = function (entity) {
    return {
        imageId: entity.PartitionKey._,
        contributionId: entity.RowKey._,
        tags: (entity.tags && entity.tags._) ? JSON.parse(entity.tags._) : [],
        user: entity.user._
    };
}

TrainingImageService.prototype.calculateStatusForObjectDetection = function (contributions) {
    const referenceContribution = contributions.pop();
    const secondContribution = contributions.pop();

    const referenceTags = referenceContribution.tags;
    const secondTags = secondContribution.tags;

    //[{"label":"mustang","boundingBox":{"y":5.874396135265698,"x":5.2560386473429945,"width":117.38485997886474,"height":119.34299516908213}}]
    const primaryAnalysis = tagAnalysis(referenceTags, secondTags);
    if (primaryAnalysis.mismatches.length) {
        // Tie-breaker needed. If there aren't any other contributions, the image status is IN_CONFLICT
        if (contributions.length) {
            const thirdContribution = contributions.pop();
            const thirdTags = thirdContribution.tags;
            const secondaryAnalysis = tagAnalysis(referenceTags, thirdTags);
            if (secondaryAnalysis.mismatches.length) {
                return 'in-conflict';
            }
            else {
                return 'ready-for-training';
            }
        } else {
            // There aren't any more contributions to serve as a tie-breaker.
            return 'in-conflict';
        }
    } else {
        // No mismatches, this is good, the image is now READY_FOR_TRAINING and the tags should be saved
        return 'ready-for-training';
    }
}

TrainingImageService.prototype.calculateStatusForImageClassification = function (contributions) {
    const countByLabel = {};
    contributions.forEach(contribution => {
        if (countByLabel.hasOwnProperty(contribution.label)) {
            countByLabel[contribution.label] += 1;
        } else {
            countByLabel[contribution.label] = 1;
        }
    });
    const labelCount = Object.keys(countByLabel).length;
    if (labelCount < 1) {
        return 'tag-pending';
    }
    if (labelCount == 1) {
        return 'ready-for-training';
    }
    return 'in-conflict';
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
        annotations: entity.annotations ? JSON.parse(entity.annotations._) : [],
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

function getImageURL(projectId, imageId) {
    const containerName = ProjectService.getTrainingImageContainerName(projectId);
    const url = BlobService.getUrl(containerName, imageId);
    return url;
}

function tagToRbushRect(rectangle) {
    return {
        minX: rectangle.boundingBox.x,
        minY: rectangle.boundingBox.y,
        maxX: rectangle.boundingBox.x + rectangle.boundingBox.width,
        maxY: rectangle.boundingBox.y + rectangle.boundingBox.height,
        label: rectangle.label
    };
}

function enlargedArea(a, b) {
    return (Math.max(b.maxX, a.maxX) - Math.min(b.minX, a.minX)) *
        (Math.max(b.maxY, a.maxY) - Math.min(b.minY, a.minY));
}

function intersectionArea(a, b) {
    var minX = Math.max(a.minX, b.minX),
        minY = Math.max(a.minY, b.minY),
        maxX = Math.min(a.maxX, b.maxX),
        maxY = Math.min(a.maxY, b.maxY);

    return Math.max(0, maxX - minX) *
        Math.max(0, maxY - minY);
}

function tagAnalysis(tagsA, tagsB, iouThreshold) {
    if (!iouThreshold) {
        iouThreshold = process.env.RECTANGLE_SIMILARITY_THRESHOLD || 0.55;
    }

    const maxLength = Math.max(tagsA.length, tagsB.length);
    const tree = rbush(maxLength);
    tagsA.forEach(element => {
        tree.insert(tagToRbushRect(element));
    });

    if (tagsB.length == 0) {
        return {
            matches: [],
            mismatches: tagsA
        }
    }

    const matches = [];
    const mismatches = [];
    tagsB.forEach(element => {
        const rectangle = tagToRbushRect(element);
        const intersectionArray = tree.search(rectangle);
        if (!intersectionArray || intersectionArray.length == 0) {
            mismatches.push(element);
            return;
        }

        const aboveThreshold = intersectionArray.find(intersection => {
            const iou = intersectionArea(rectangle, intersection) / (1.0 * enlargedArea(rectangle, intersection));
            return iou > iouThreshold;
        });

        if (aboveThreshold && aboveThreshold.label == element.label) {
            matches.push(element);
        } else {
            mismatches.push(element);
        }

    });

    return {
        matches: matches,
        mismatches: mismatches
    };
}

module.exports = TrainingImageService;
