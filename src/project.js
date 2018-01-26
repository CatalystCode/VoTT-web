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
 * Global collaborators table that all projects share. The projectId is be used
 * as the partition key and the collaborator's id as the primary key.
 */
const collaboratorsTableName = process.env.COLLABORATOR_TABLE_NAME || 'collaborators';

/**
 * Global invites table that all projects share. The collaboratorId is be used
 * as the partition key.
 */
const invitesTableName = process.env.INVITE_TABLE_NAME || 'invites';

/**
 * Global models table that all projects share. The projectId is be used
 * as the partition key.
 */
const modelsTableName = process.env.MODEL_TABLE_NAME || 'models';

/**
 * Global images table that all projects share. The projectId is be used as the
 * partition key and the image's id as the primary key.
 */
const imagesTableName = process.env.IMAGE_TABLE_NAME || 'images';

/**
 * Global projects table.
 */
const projectsTableName = process.env.PROJECT_TABLE_NAME || 'projects';

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

function getPublicBaseURL() {
    return 'https://popspotsvott01.azurewebsites.net';
}

function getModelAnnotationsURL(projectId, modelId) {
    return `${getPublicBaseURL()}/vott-training/projects/${projectId}/${modelId}/annotations.csv`;
}

function getModelStatusURL(projectId, modelId) {
    return `${getPublicBaseURL()}/vott-training/projects/${projectId}/${modelId}/status.json`;
}

function getInviteURL(projectId, collaboratorId, inviteId) {
    return `${getPublicBaseURL()}/vott-training/invites/${projectId}/${collaboratorId}/${inviteId}`;
}

function getTrainingImagesAnnotations(projectId, callback) {
    var query = new azure.TableQuery().where("PartitionKey == ?", projectId);
    services.tableService.queryEntities(imagesTableName, query, null, (error, results, response) => {
        if (error) {
            return callback(error);
        }
        const images = results.entries.map((value) => {
            return {
                projectId: value.PartitionKey._,
                fileId: value.RowKey._,
                fileURL: getImageURL(projectId, value.RowKey._),
                annotations: [
                    {
                        objectClassName: 'guitar-body',
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
        callback(null, images);
    });
}

function createCollaborator(projectId, name, email, profile, callback) {
    if (!projectId || !name || !email || !profile) {
        return callback("Missing one or more required argument.");
    }

    const collaboratorId = uuid();
    const collaboratorRecord = {
        PartitionKey: projectId,
        RowKey: collaboratorId,
        name: name,
        email: email,
        profile: profile
    };

    const inviteId = uuid();
    const inviteRecord = {
        PartitionKey: collaboratorId,
        RowKey: inviteId,
        status: 'ACTIVE'
    };
    async.series(
        [
            (callback) => { services.tableService.insertEntity(collaboratorsTableName, collaboratorRecord, callback); },
            (callback) => { services.tableService.insertEntity(invitesTableName, inviteRecord, callback); }
        ],
        (error) => {
            if (error) {
                return callback(error);
            }
            callback(null, {
                inviteId: inviteId,
                inviteURL: getInviteURL(projectId, collaboratorId, inviteId),
                collaborator: {
                    projectId: projectId,
                    collaboratorId: collaboratorId,
                    name: name,
                    email: email,
                    profile: profile
                }
            });
        }
    );
}

function createModel(projectId, callback) {
    if (!projectId) {
        return callback("Parameter projectId must be present.");
    }
    const modelId = uuid();
    const status = "TRAINING_PENDING";
    const modelRecord = {
        PartitionKey: projectId,
        RowKey: modelId,
        status: status
    };
    const annotationsURL = getModelAnnotationsURL(projectId, modelId);
    const modelURL = getModelURL(projectId, modelId);
    const statusURL = getModelStatusURL(projectId, modelId);
    const trainingQueueMessage = {
        annotations: annotationsURL,
        model: modelURL,
        status: statusURL,
        plugin: 'retinanet'
    };
    async.series(
        [
            (callback) => { services.tableService.insertEntity(modelsTableName, modelRecord, callback); },
            (callback) => { services.queueService.createMessage(trainingQueueName, JSON.stringify(trainingQueueMessage), callback) }
        ],
        (error, results) => {
            if (error) {
                return callback(error);
            }

            const trainingQueueMessageResult = results[1][0];
            const queueMessageId = trainingQueueMessageResult.messageId;
            const modelUpdateDescriptor = {
                PartitionKey: { "_": projectId },
                RowKey: { "_": modelId },
                queueMessageId: queueMessageId
            };
            services.tableService.mergeEntity(modelsTableName, modelUpdateDescriptor, (mergeError, updatedModel) => {
                if (mergeError) {
                    console.log("mergeError:");
                    console.log(mergeError);
                    return callback(mergeError);
                }
                callback(null, {
                    projectId: projectId,
                    modelId: modelId,
                    queueMessageId: queueMessageId,
                    status: status
                });
            });
        }
    );
}

module.exports = {
    setServices: (configValues) => {
        return new Promise((resolve, reject) => {
            for (var k in configValues) services[k] = configValues[k];
            async.series(
                [
                    (callback) => { services.queueService.createQueueIfNotExists(trainingQueueName, callback); },
                    (callback) => { services.tableService.createTableIfNotExists(imagesTableName, callback); },
                    (callback) => { services.tableService.createTableIfNotExists(modelsTableName, callback); },
                    (callback) => { services.tableService.createTableIfNotExists(collaboratorsTableName, callback); },
                    (callback) => { services.tableService.createTableIfNotExists(invitesTableName, callback); },
                    (callback) => { services.tableService.createTableIfNotExists(projectsTableName, callback); }
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
            services.tableService.queryEntities(projectsTableName, query, nextPageToken, (error, results, response) => {
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
            services.tableService.retrieveEntity(projectsTableName, projectId, projectId, (error, response) => {
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
                    (callback) => { services.tableService.insertEntity(projectsTableName, project, callback); }
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
            services.tableService.mergeEntity(projectsTableName, entityDescriptor, (error, project) => {
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
                    (callback) => { services.tableService.deleteEntity(projectsTableName, { PartitionKey: { "_": projectId }, RowKey: { "_": projectId } }, callback); },
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
            services.tableService.retrieveEntity(projectsTableName, projectId/*PartitionKey*/, projectId/*PrimaryKey*/, (error, project) => {
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

            services.tableService.mergeEntity(projectsTableName, entityDescriptor, (error, project) => {
                if (error) {
                    return reject(error);
                }
                resolve("OK");
            });
        });
    },

    createTrainingImage: (args, res) => {
        return new Promise((resolve, reject) => {
            const projectId = args.projectId;
            const file = createFileSAS(getImageContainerName(projectId));
            resolve({
                projectId: projectId,
                fileId: file.fileId,
                fileURL: file.url
            });
        });
    },
    commitTrainingImage: (args, res) => {
        return new Promise((resolve, reject) => {
            const projectId = args.projectId;
            const fileId = args.fileId;
            const imageRecord = {
                PartitionKey: projectId,
                RowKey: fileId,
                status: 'TAG_PENDING'
            };
            const imageQueueMessage = {
                projectId: projectId,
                fileId: fileId,
            };

            const taskQueueName = getTaskQueueName(projectId);
            async.series(
                [
                    (callback) => { services.tableService.insertEntity(imagesTableName, imageRecord, callback); },
                    (callback) => { services.queueService.createMessage(taskQueueName, JSON.stringify(imageQueueMessage), callback) },
                    (callback) => { services.queueService.createMessage(taskQueueName, JSON.stringify(imageQueueMessage), callback) },
                    (callback) => { services.queueService.createMessage(taskQueueName, JSON.stringify(imageQueueMessage), callback) }
                ],
                (error) => {
                    if (error) {
                        return reject(error);
                    }
                    resolve({
                        projectId: projectId,
                        fileId: fileId,
                        fileURL: getImageURL(projectId, fileId)
                    });
                }
            );

        });
    },
    getTrainingImagesAnnotations: getTrainingImagesAnnotations,
    trainingImages: (args, res) => {
        return new Promise((resolve, reject) => {
            // TODO: Ensure user has project access to the project.
            const projectId = args.projectId;
            const nextPageToken = (args.nextPageToken) ? JSON.parse(args.nextPageToken) : null;
            var query = new azure.TableQuery().where("PartitionKey == ?", projectId).top(32);
            services.tableService.queryEntities(imagesTableName, query, nextPageToken, (error, results, response) => {
                if (error) {
                    reject(error);
                    return;
                }
                const images = results.entries.map((value) => {
                    return {
                        projectId: value.PartitionKey._,
                        fileId: value.RowKey._,
                        fileURL: getImageURL(projectId, value.RowKey._),
                    };
                });
                resolve({
                    nextPageToken: (results.continuationToken) ? JSON.stringify(results.continuationToken) : null,
                    entries: images
                });
            });
        });
    },

    createCollaborator: (args, response) => {
        return new Promise((resolve, reject) => {
            // TODO: Ensure user has project access to the project.
            const projectId = args.projectId;
            const name = args.name;
            const email = args.email;
            const profile = args.profile;

            createCollaborator(projectId, name, email, profile, (error, invite) => {
                if (error) {
                    return reject(error);
                }
                // TODO: Send invite email
                resolve(invite);
            });
        });
    },
    reinviteCollaborator: (args, response) => {
        return new Promise((resolve, reject) => {
            // TODO: Ensure user has project access to the project.
            const projectId = args.projectId;
            const collaboratorId = args.collaboratorId;
            // TODO: Consider de-activating all previous invites for that collaborator.
            reject("Not yet implemented.");
        });
    },
    collaborators: (args, response) => {
        return new Promise((resolve, reject) => {
            // TODO: Ensure user has project access to the project.
            const projectId = args.projectId;
            const nextPageToken = (args.nextPageToken) ? JSON.parse(args.nextPageToken) : null;
            var query = new azure.TableQuery().where("PartitionKey == ?", projectId).top(64);
            services.tableService.queryEntities(collaboratorsTableName, query, nextPageToken, (error, results, response) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve({
                    nextPageToken: (results.continuationToken) ? JSON.stringify(results.continuationToken) : null,
                    entries: results.entries.map((value) => {
                        return {
                            projectId: value.PartitionKey._,
                            collaboratorId: value.RowKey._,
                            name: value.name._,
                            email: value.email._,
                            profile: value.profile._,
                        };
                    })
                });
            });
        });
    },
    models: (args, request) => {
        return new Promise((resolve, reject) => {
            // TODO: Ensure user has project access to the project.
            const projectId = args.projectId;
            const nextPageToken = (args.nextPageToken) ? JSON.parse(args.nextPageToken) : null;
            var query = new azure.TableQuery().where("PartitionKey == ?", projectId).top(64);
            services.tableService.queryEntities(modelsTableName, query, nextPageToken, (error, results, response) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve({
                    nextPageToken: (results.continuationToken) ? JSON.stringify(results.continuationToken) : null,
                    entries: results.entries.map((value) => {
                        return {
                            projectId: value.PartitionKey._,
                            modelId: value.RowKey._,
                            created: value.Timestamp._,
                            status: value.status._
                        };
                    })
                });
            });
        });
    },
    createModel: (args, response) => {
        return new Promise((resolve, reject) => {
            const projectId = args.projectId;
            createModel(projectId, (error, model) => {
                if (error) {
                    return reject(error);
                }
                resolve(model);
            });
        });
    }
};
