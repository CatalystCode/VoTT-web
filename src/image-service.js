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

const imageAnnotationsTableName = process.env.IMAGE_ANNOTATIONS_TABLE_NAME || 'image_annotations';

function ImageService(configuration) {
}

ImageService.prototype.setServices = function (configuration) {
    Object.assign(this, configuration);

    const self = this;
    return new Promise((resolve, reject) => {
        self.tableService.createTableIfNotExists(imagesTableName, (error, results) => {
            if (error) return reject(error);
            else return resolve(results);
        });
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
            status: 'TAG_PENDING',
            annotations: '{}'
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

ImageService.prototype.readTrainingImages = function (projectId, nextPageToken) {
    const self = this;
    return new Promise((resolve, reject) => {
        var query = new azure.TableQuery().where("PartitionKey == ?", projectId).top(32);
        self.tableService.queryEntities(imagesTableName, query, nextPageToken, (error, results, response) => {
            if (error) {
                return reject(error);
            }
            const images = results.entries.map((value) => {
                return {
                    projectId: value.PartitionKey._,
                    fileId: value.RowKey._,
                    fileURL: self.getImageURL(projectId, value.RowKey._),
                };
            });
            resolve({
                nextPageToken: (results.continuationToken) ? JSON.stringify(results.continuationToken) : null,
                entries: images
            });
        });
    });
}

ImageService.prototype.getTrainingImagesAnnotations = function (projectId) {
    const self = this;

    return new Promise((resolve, reject) => {
        var query = new azure.TableQuery().where("PartitionKey == ?", projectId);
        self.tableService.queryEntities(imagesTableName, query, null, (error, results, response) => {
            if (error) {
                return reject(error);
            }
            const images = results.entries.map((value) => {
                return {
                    projectId: value.PartitionKey._,
                    fileId: value.RowKey._,
                    fileURL: self.getImageURL(projectId, value.RowKey._),
                    annotations: [
                        {
                            label: 'guitar-body',
                            boundingBox: {
                                x: 0,
                                y: 0,
                                width: 128,
                                height: 128
                            }
                        }
                    ],
                };
            });
            resolve(images);
        });
    });
}

module.exports = {
    createImageService: function () {
        return new ImageService();
    }
};
