'use strict';

const async = require("async");
const azure = require('azure-storage');
const qs = require('qs');
const uuid = require('uuid/v4');

const foundation = require('./vott-foundation');

/**
 * Global images table that all projects share. The projectId is be used as the
 * partition key and the image's id as the primary key.
 */
const imagesTableName = process.env.IMAGES_TABLE_NAME || 'images';

const imageTagContributions = process.env.IMAGE_TAG_CONTRIBUTIONS_TABLE_NAME || 'imagetagcontributions';

const trainingImageStates = {
    TAG_PENDING: 'TAG_PENDING',
    READY_FOR_TRAINING: 'READY_FOR_TRAINING',
    IN_CONFLICT: 'IN_CONFLICT'
};

function ImageService(configuration) {
}

ImageService.prototype.setServices = function (configuration) {
    Object.assign(this, configuration);

    const self = this;
    return new Promise((resolve, reject) => {
        async.series(
            [
                (callback) => { self.tableService.createTableIfNotExists(imagesTableName, callback); },
                (callback) => { self.tableService.createTableIfNotExists(imageTagContributions, callback); }
            ],
            (error) => {
                if (error) {
                    return reject(error);
                }
                resolve(configuration);
            }
        );
    });
}

/**
 * @param {string} projectId containing the project primary key.
 * @returns {string} containing the name of the task queue for the given project.
 */
ImageService.prototype.getTaskQueueName = function (projectId) {
    return `${projectId}-tasks`;
}

/**
 * @param {string} projectId containing the project primary key.
 * @returns {string} containing the name of the container where all the images for the given project are stored.
 */
ImageService.prototype.getImageContainerName = function (projectId) {
    return `${projectId}-images`;
}

/**
 * @param {string} projectId containing the project primary key.
 * @param {string} imageId containing the primary key of the image that is part of the given project.
 * @returns {string} containing the full URL for the blob of the image.
 */
ImageService.prototype.getImageURL = function (projectId, imageId) {
    const containerName = this.getImageContainerName(projectId);
    return this.blobService.getUrl(containerName, imageId);
}

ImageService.prototype.createTrainingImage = function (projectId, fileId) {
    const self = this;
    return new Promise((resolve, reject) => {
        const imageRecord = {
            PartitionKey: projectId,
            RowKey: fileId,
            status: trainingImageStates.TAG_PENDING,
            tags: '[]'
        };
        const imageQueueMessage = {
            projectId: projectId,
            fileId: fileId
        };

        const taskQueueName = self.getTaskQueueName(projectId);
        async.series(
            [
                (callback) => { self.tableService.insertEntity(imagesTableName, imageRecord, callback); },
                (callback) => { self.queueService.createMessage(taskQueueName, JSON.stringify(imageQueueMessage), callback) },
                (callback) => { self.queueService.createMessage(taskQueueName, JSON.stringify(imageQueueMessage), callback) },
                (callback) => { self.queueService.createMessage(taskQueueName, JSON.stringify(imageQueueMessage), callback) }
            ],
            (error) => {
                if (error) {
                    return reject(error);
                }
                resolve({
                    projectId: projectId,
                    fileId: fileId,
                    fileURL: self.getImageURL(projectId, fileId)
                });
            }
        );

    });
}

ImageService.prototype.mapTrainingImage = function (value) {
    const projectId = value.PartitionKey._;
    const imageId = value.RowKey._;
    return {
        projectId: projectId,
        imageId: imageId,
        fileId: imageId,
        fileURL: this.getImageURL(projectId, imageId)
    };
}

ImageService.prototype.readTrainingImage = function (projectId, imageId) {
    const self = this;
    return new Promise((resolve, reject) => {
        self.tableService.retrieveEntity(imagesTableName, projectId, imageId, (error, record) => {
            if (error) {
                return reject(error);
            }
            resolve(self.mapTrainingImage(record));
        });
    });
}

ImageService.prototype.readTrainingImages = function (projectId, nextPageToken) {
    const self = this;
    return new Promise((resolve, reject) => {
        var query = new azure.TableQuery().where("PartitionKey == ?", projectId).top(32);
        self.tableService.queryEntities(imagesTableName, query, nextPageToken, (error, results, response) => {
            if (error) {
                return reject(error);
            }
            const images = results.entries.map(value => self.mapTrainingImage(value));
            resolve({
                nextPageToken: (results.continuationToken) ? JSON.stringify(results.continuationToken) : null,
                entries: images
            });
        });
    });
}

ImageService.prototype.countTrainingImagesByStatus = function (projectId) {
    // If aggregation queries are supported, use those (cosmos db). Otherwise,
    // count in-memory.
    const self = this;
    return new Promise((resolve, reject) => {
        var query = new azure.TableQuery().where("PartitionKey == ?", projectId);
        self.tableService.queryEntities(imagesTableName, query, null, (error, results, response) => {
            if (error) {
                return reject(error);
            }

            const aggregation = { TOTAL: 0 };
            results.entries.forEach(image => {
                aggregation['TOTAL'] += 1;
                const status = image.status._;
                if (status in aggregation) {
                    aggregation[status] += 1;
                } else {
                    aggregation[status] = 1;
                }
            });
            resolve(aggregation);
        });
    });    
}

ImageService.prototype.updateTrainingImageStatus = function (projectId, imageId, status, tags) {
    const self = this;
    return new Promise((resolve, reject) => {
        const entityDescriptor = {
            PartitionKey: projectId,
            RowKey: imageId,
            status: status,
            tags: (tags) ? JSON.stringify(tags) : null
        };

        self.tableService.mergeEntity(imagesTableName, entityDescriptor, (error, project) => {
            if (error) return reject(error);
            else return resolve("OK");
        });
    });
};

ImageService.prototype.updateTrainingImageWithTagContributions = function (projectId, imageId) {
    const self = this;
    return this.readTrainingImage(projectId, imageId).then(image => {
        return self.readImageTagContributions(projectId, imageId).then(contributions => {
            // Calculate the score for each contribution relative
            if (contributions.length < 2) {
                // Waiting for more contributions before marking as ANNOTATED.
                return self.updateTrainingImageStatus(projectId, imageId, trainingImageStates.TAG_PENDING, []);
            }

            // TODO: Support image classification contributions.

            const referenceContribution = contributions.pop();
            const secondContribution = contributions.pop();
            if (referenceContribution.tags[0].boundingBox) {
                const referenceTagCollection = referenceContribution.tags.map(t => self.mapTag(t));
                const secondTagCollection = secondContribution.tags.map(t => self.mapTag(t));
                const primaryAnalysis = foundation.rectAnalysis(referenceTagCollection, secondTagCollection);
                if (primaryAnalysis.mismatches.length) {
                    // Tie-breaker needed. If there aren't any other contributions, the image status is IN_CONFLICT
                    if (contributions.length) {
                        const thirdContribution = contributions.pop();
                        const thirdTagCollection = thirdContribution.tags.map(t => self.mapTag(t));
                        const secondaryAnalysis = foundation.rectAnalysis(referenceTagCollection, thirdTagCollection);
                        if (secondaryAnalysis.mismatches.length) {
                            return self.updateTrainingImageStatus(projectId, imageId, trainingImageStates.IN_CONFLICT, []);
                        }
                        else {
                            return self.updateTrainingImageStatus(
                                projectId,
                                imageId,
                                trainingImageStates.READY_FOR_TRAINING,
                                referenceContribution.tags.concat(thirdContribution.tags)
                            );
                        }
                    } else {
                        // There aren't any more contributions to serve as a tie-breaker.
                        return self.updateTrainingImageStatus(projectId, imageId, trainingImageStates.IN_CONFLICT, []);
                    }
                } else {
                    // No mismatches, this is good, the image is now READY_FOR_TRAINING and the tags should be saved
                    return self.updateTrainingImageStatus(
                        projectId,
                        imageId,
                        trainingImageStates.READY_FOR_TRAINING,
                        referenceContribution.tags.concat(secondContribution.tags)
                    );
                }
            }

            return Promise.resolve("OK");
        });
    });
}

ImageService.prototype.mapTag = function (tag) {
    if (!tag.boundingBox) {
        return tag.label;
    }
    return tag.boundingBox;
}

ImageService.prototype.mapContribution = function (value) {
    const imageId = value.PartitionKey._;
    const contributionId = value.RowKey._;
    const tags = value.tags._;
    return {
        imageId: imageId,
        contributionId: contributionId,
        tags: JSON.parse(tags)
    };
}

ImageService.prototype.createImageTagContribution = function (imageId, tags) {
    const self = this;
    return new Promise((resolve, reject) => {
        const contributionId = uuid();
        const tagRecord = {
            PartitionKey: { _: imageId },
            RowKey: { _: contributionId },
            tags: { _: JSON.stringify(tags) }
        };
        self.tableService.insertEntity(imageTagContributions, tagRecord, (error, tag) => {
            if (error) {
                return reject(error);
            }
            return resolve(self.mapContribution(tagRecord));
        });
    });
}

ImageService.prototype.readImageTagContributions = function (imageId) {
    const self = this;
    return new Promise((resolve, reject) => {
        var query = new azure.TableQuery().where("PartitionKey == ?", imageId);
        self.tableService.queryEntities(imageTagContributions, query, null, (error, results, response) => {
            if (error) {
                return reject(error);
            }
            resolve(results.entries.map(value => self.mapContribution(value)));
        });
    });
}

ImageService.prototype.getTrainingImagesWithTags = function (projectId) {
    const self = this;

    return new Promise((resolve, reject) => {
        var query = new azure.TableQuery().where(
            "PartitionKey == ? and status == ?",
            projectId,
            trainingImageStates.READY_FOR_TRAINING
        );
        self.tableService.queryEntities(imagesTableName, query, null, (error, results, response) => {
            if (error) {
                return reject(error);
            }
            const images = results.entries.map((value) => {
                const tags = (value.tags && value.tags._) ? JSON.parse(value.tags._) : [];
                return {
                    projectId: value.PartitionKey._,
                    imageId: value.RowKey._,
                    fileURL: self.getImageURL(projectId, value.RowKey._),
                    tags: tags,
                };
            });
            resolve(images);
        });
    });
}

module.exports = {
    createImageService: function () {
        return new ImageService();
    },
    trainingImageStates:trainingImageStates
};
