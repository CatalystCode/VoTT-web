'use strict';

const async = require("async");
const azure = require('azure-storage');
const qs = require('qs');
const uuid = require('uuid/v4');

const services = {
    authzService: null,
    blobService: null,
    queueService: null,
    tableService: null
};

// NOTE: The raw headers are in uppercase but are lowercased by express. 
const CLIENT_PRINCIPAL_NAME_HEADER = 'x-ms-client-principal-name';
const CLIENT_PRINCIPAL_ID_HEADER = 'x-ms-client-principal-id';
const CLIENT_PRINCIPAL_IDP_HEADER = 'x-ms-client-principal-idp';

function getUser(request) {
    return {
        id: request.headers[CLIENT_PRINCIPAL_ID_HEADER],
        name: request.headers[CLIENT_PRINCIPAL_NAME_HEADER],
        idp: request.headers[CLIENT_PRINCIPAL_IDP_HEADER]
    };
}

/**
 * Global training queue that is shared by all projects. A separate set of
 * workers that are able to handle messages from this queue will be listening
 * to this.
 */
const trainingQueueName = process.env.TRAINING_QUEUE_NAME || 'training';

/**
 * Global images table that all projects share. The projectId is be used as the
 * partition key and the image's id as the primary key.
 */
const imageTableName = process.env.IMAGE_TABLE_NAME || 'images';

/**
 * Global projects table.
 */
const projectTableName = process.env.IMAGE_TABLE_NAME || 'projects';

/**
 * @param {string} projectId containing the project primary key.
 * @returns {string} containing the name of the task queue for the given project.
 */
function getTaskQueueName(projectId) {
    return `${projectId}-tasks`;
}

/**
 * @param {string} projectId containing the project primary key.
 * @returns {string} containing the name of the container where all the models for the given project are stored.
 */
function getModelContainerName(projectId) {
    return `${projectId}-models`;
}

/**
 * @param {string} projectId containing the project primary key.
 * @returns {string} containing the name of the container where all the images for the given project are stored.
 */
function getImageContainerName(projectId) {
    return `${projectId}-images`;
}

/**
 * @param {string} projectId containing the project primary key.
 * @param {string} modelId containing the primary key of the model that is part of the given project.
 * @returns {string} containing the full URL for the blob of the model.
 */
function getModelURL(projectId, modelId) {
    const containerName = getModelContainerName(projectId);
    return services.blobService.getUrl(containerName, modelId);
}

/**
 * @param {string} projectId containing the project primary key.
 * @param {string} imageId containing the primary key of the image that is part of the given project.
 * @returns {string} containing the full URL for the blob of the image.
 */
function getImageURL(projectId, imageId) {
    const containerName = getImageContainerName(projectId);
    return services.blobService.getUrl(containerName, imageId);
}

function createFileSAS(containerName, extension) {
    const startDate = new Date();
    const expiryDate = new Date(startDate);
    expiryDate.setMinutes(startDate.getMinutes() + 5);

    const BlobUtilities = azure.BlobUtilities;
    const sharedAccessPolicy = {
        AccessPolicy: {
            Permissions: BlobUtilities.SharedAccessPermissions.WRITE,
            Start: startDate,
            Expiry: expiryDate
        }
    };

    const fileId = uuid();
    const blobName = (extension) ? `${fileId}.${extension}` : fileId;
    const signature = services.blobService.generateSharedAccessSignature(
        containerName,
        blobName,
        sharedAccessPolicy
    );
    const url = services.blobService.getUrl(containerName, blobName, signature);
    return {
        url: url,
        fileId: fileId,
    }
}

function mapColumnValue(columnValue) {
    if (columnValue == null || columnValue == undefined) {
        return null;
    }
    return (columnValue.hasOwnProperty('_')) ? columnValue._ : columnValue;
}

function mapProject(value) {
    const objectClassNamesValue = mapColumnValue(value.objectClassNames);
    const objectClassNames = (objectClassNamesValue instanceof Array) ? objectClassNamesValue : JSON.parse(objectClassNamesValue);
    const projectId = mapColumnValue(value.RowKey);

    const instructionsImageId = mapColumnValue(value.instructionsImageId);
    const instructionsImageURL = (instructionsImageId) ? getImageURL(projectId, instructionsImageId) : null;
    
    return {
        projectId: mapColumnValue(value.RowKey),
        name: mapColumnValue(value.name),
        taskType: mapColumnValue(value.taskType),
        objectClassNames: objectClassNames,
        instructionsText: mapColumnValue(value.instructionsText),
        instructionsImageURL: instructionsImageURL
    };
}

module.exports = {
    setServices: (configValues) => {
        return new Promise((resolve, reject) => {
            for (var k in configValues) services[k] = configValues[k];
            async.series(
                [
                    (callback) => { services.queueService.createQueueIfNotExists(trainingQueueName, callback); },
                    (callback) => { services.tableService.createTableIfNotExists(imageTableName, callback); },
                    (callback) => { services.tableService.createTableIfNotExists(projectTableName, callback); }
                ],
                (err, results) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(configValues);
                }
            );
        });
    },
    getModelContainerName: getModelContainerName,
    getModelURL: getModelURL,
    getImageContainerName: getImageContainerName,
    getImageURL: getImageURL,

    projects: (args, request) => {
        return new Promise((resolve, reject) => {
            // TODO: Ensure user has project access to the app.
            var query = new azure.TableQuery().top(10);
            const nextPageToken = (args.nextPageToken) ? JSON.parse(args.nextPageToken) : null;
            services.tableService.queryEntities(projectTableName, query, nextPageToken, (error, results, response) => {
                if (error) {
                    return reject(error);
                }
                resolve({
                    nextPageToken: (results.continuationToken) ? JSON.stringify(results.continuationToken) : null,
                    entries: results.entries.map(mapProject)
                });
            });
        });
    },
    project: (args, request) => {
        return new Promise((resolve, reject) => {
            const projectId = args.projectId;
            services.tableService.retrieveEntity(projectTableName, projectId, projectId, (error, response) => {
                if (error) {
                    return reject(error);
                }
                resolve(mapProject(response));
            });
        });
    },
    createProject: (args, res) => {
        return new Promise((resolve, reject) => {
            // TODO: Ensure user has project access to the app.
            const projectId = uuid().toString();

            // The instructionsImageURL property is updated via
            // createInstructionsImage()
            const project = {
                PartitionKey: projectId,
                RowKey: projectId,
                name: args.name,
                taskType: args.taskType,
                objectClassNames: JSON.stringify(args.objectClassNames),
                instructionsText: args.instructionsText
            };
            const imageContainerName = getImageContainerName(projectId);
            const modelContainerName = getModelContainerName(projectId);
            const taskQueueName = getTaskQueueName(projectId);
            async.series(
                [
                    (callback) => { services.queueService.createQueueIfNotExists(taskQueueName, callback); },
                    (callback) => { services.blobService.createContainerIfNotExists(imageContainerName, { publicAccessLevel: 'blob' }, callback); },
                    (callback) => { services.blobService.createContainerIfNotExists(modelContainerName, { publicAccessLevel: 'blob' }, callback); },
                    (callback) => { services.tableService.insertEntity(projectTableName, project, callback); }
                ],
                (error, results) => {
                    if (error) {
                        return reject(error);
                    }
                    resolve(mapProject(project));
                }
            ); /* async.series */
        });
    },
    updateProject: (args, res) => {
        return new Promise((resolve, reject) => {
            const projectId = args.projectId;

            const entityDescriptor = {
                PartitionKey: { "_": projectId },
                RowKey: { "_": projectId }
            };
            if (args.name) {
                entityDescriptor.name = args.name;
            }
            if (args.taskType) {
                entityDescriptor.taskType = args.taskType;
            }
            if (args.objectClassNames) {
                entityDescriptor.objectClassNames = JSON.stringify(args.objectClassNames);
            }
            if (args.instructionsText) {
                entityDescriptor.instructionsText = args.instructionsText;
            }
            services.tableService.mergeEntity(projectTableName, entityDescriptor, (error, project) => {
                if (error) {
                    return reject(error);
                }
                resolve("OK");
            });
        });
    },
    removeProject: (args, res) => {
        return new Promise((resolve, reject) => {
            // TODO: Ensure user has access to projectId.
            const projectId = args.projectId;

            const imageContainerName = getImageContainerName(projectId);
            const modelContainerName = getModelContainerName(projectId);
            const taskQueueName = getTaskQueueName(projectId);

            async.series(
                [
                    (callback) => { services.tableService.deleteEntity(projectTableName, { PartitionKey: { "_": projectId }, RowKey: { "_": projectId } }, callback); },
                    (callback) => { services.queueService.deleteQueueIfExists(taskQueueName, callback); },
                    (callback) => { services.blobService.deleteContainerIfExists(imageContainerName, null, callback); },
                    (callback) => { services.blobService.deleteContainerIfExists(modelContainerName, null, callback); }
                ],
                (error, results) => {
                    if (error) {
                        return reject(error);
                    }
                    resolve(projectId);
                }
            ); /* async.series */
        });
    },

    createInstructionsImage: (args, res) => {
        return new Promise((resolve, reject) => {
            const projectId = args.projectId;
            services.tableService.retrieveEntity(projectTableName, projectId/*PartitionKey*/, projectId/*PrimaryKey*/, (error, project) => {
                if (error) {
                    return reject(error);
                }

                const file = createFileSAS(getImageContainerName(projectId));
                resolve({
                    projectId: projectId,
                    fileId: file.fileId,
                    fileURL: file.url
                });
            });
        });
    },
    commitInstructionsImage: (args, res) => {
        return new Promise((resolve, reject) => {
            const projectId = args.image.projectId;
            const fileId = args.image.fileId;
            const entityDescriptor = {
                PartitionKey: { "_": projectId },
                RowKey: { "_": projectId },
                instructionsImageId: fileId
            };

            services.tableService.mergeEntity(projectTableName, entityDescriptor, (error, project) => {
                if (error) {
                    return reject(error);
                }
                resolve("OK");
            });
        });
    },

    images: (args, res) => {
        return new Promise((resolve, reject) => {
            // TODO: Ensure user has project access to the project.
            const projectId = args.projectId;
            const nextPageToken = (args.nextPageToken) ? JSON.parse(args.nextPageToken) : null;
            var query = new azure.TableQuery().where("PartitionKey == ?", projectId).top(12);
            services.tableService.queryEntities(imageTableName, query, nextPageToken, (error, results, response) => {
                if (error) {
                    reject(error);
                    return;
                }
                const images = results.entries.map((value) => {
                    return {
                        projectId: value.PartitionKey._,
                        imageId: value.RowKey._,
                        imageURL: getImageURL(projectId, value.RowKey._),
                    };
                });
                resolve({
                    nextPageToken: (results.continuationToken) ? JSON.stringify(results.continuationToken) : null,
                    images: images
                });
            });
        });
    },
    createImages: (args, res) => {
        return new Promise((resolve, reject) => {
            // TODO: Ensure user has access to projectId.
            const projectId = args.projectId;

            services.tableService.retrieveEntity("projects", projectId/*PartitionKey*/, projectId/*PrimaryKey*/, (error, project) => {
                if (error) {
                    return reject(error);
                }
                const imageContainerName = getImageContainerName(projectId);
                services.blobService.createContainerIfNotExists(imageContainerName, { publicAccessLevel: 'blob' }, (error) => {
                    if (error) {
                        return reject(error);
                    }

                    const startDate = new Date();
                    const expiryDate = new Date(startDate);
                    expiryDate.setMinutes(startDate.getMinutes() + 5);

                    const BlobUtilities = azure.BlobUtilities;
                    const sharedAccessPolicy = {
                        AccessPolicy: {
                            Permissions: BlobUtilities.SharedAccessPermissions.WRITE,
                            Start: startDate,
                            Expiry: expiryDate
                        }
                    };

                    // Create imageCount pre-authenticated blob locations and return their URLs.
                    const imageCount = args.imageCount;
                    const result = [];
                    for (let i = 0; i < imageCount; i++) {
                        // Create a shared-access signature URI
                        const imageId = uuid();
                        const blobName = imageId;
                        const signature = services.blobService.generateSharedAccessSignature(
                            imageContainerName,
                            blobName,
                            sharedAccessPolicy
                        );
                        const url = services.blobService.getUrl(imageContainerName, blobName, signature);
                        result.push({
                            projectId: projectId,
                            imageId: imageId,
                            imageURL: url
                        });
                    }
                    resolve(result);

                }); /*createContainerIfNotExists*/
            }); /*retrieveEntity*/
        });
    },
    commitImages: (args, res) => {
        return new Promise((resolve, reject) => {
            // TODO: Ensure user has access to projectId.
            const images = args.images;
            if (images.size < 1) {
                return reject("Parameter images must contain at least one element.");
            }

            const projectIds = new Set(images.map((image) => image.projectId));
            if (projectIds.size > 1) {
                return reject("All images must belong to the same project.");
            }

            const imageTasks = [];
            for (var imageIndex in images) {
                const currentImage = images[imageIndex];
                const imageRecord = {
                    PartitionKey: currentImage.projectId,
                    RowKey: currentImage.imageId
                };
                const taskQueueName = getTaskQueueName(currentImage.projectId);
                imageTasks.push(
                    (callback) => { services.tableService.insertEntity(imageTableName, imageRecord, callback); },
                    (callback) => { services.queueService.createMessage(taskQueueName, JSON.stringify(currentImage), callback) },
                    (callback) => { services.queueService.createMessage(taskQueueName, JSON.stringify(currentImage), callback) },
                    (callback) => { services.queueService.createMessage(taskQueueName, JSON.stringify(currentImage), callback) }
                );
            }
            async.series(
                imageTasks,
                (error) => {
                    if (error) {
                        return reject(error);
                    }
                    resolve("OK");
                }
            );

        });
    },
    createTrainingSession: (args, response) => {
        return new Promise((resolve, reject) => {
            reject("Not yet implemented.");
        });
    }
};
