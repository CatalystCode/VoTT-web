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

const imageContainerName = process.env.IMAGE_CONTAINER_NAME || 'images';
const imageQueueName = process.env.IMAGE_CONTAINER_NAME || 'images';
const imageTableName = process.env.IMAGE_TABLE_NAME || 'images';
const projectTableName = process.env.IMAGE_TABLE_NAME || 'projects';

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

function getModelContainerName(projectId) {
    return `${projectId}.models`;
}

function getModelURL(projectId, modelId) {
    const containerName = getModelContainerName(projectId);
    return services.blobService.getUrl(containerName, modelId);
}

function getImageContainerName(projectId) {
    return projectId;
}

function getImageURL(projectId, imageId) {
    const containerName = getImageContainerName(projectId);
    return services.blobService.getUrl(containerName, imageId);
}

module.exports = {
    setServices: (configValues) => {
        return new Promise((resolve, reject) => {
            for (var k in configValues) services[k] = configValues[k];
            async.series(
                [
                    (callback) => { services.tableService.createTableIfNotExists(imageTableName, callback); },
                    (callback) => { services.tableService.createTableIfNotExists(projectTableName, callback); }
                ],
                (err, results) => {
                    console.log("Created tables");
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

    getProjects: (args, request) => {
        return new Promise((resolve, reject) => {
            console.log("Hola");
            // TODO: Ensure user has project access to the app.
            console.log(getUser(request));
            var query = new azure.TableQuery().top(256);
            services.tableService.queryEntities(projectTableName, query, null, (error, results, response) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(results.entries.map((value) => {
                    return {
                        projectId: value.projectId._,
                        name: value.name._,
                        taskType: value.taskType._,
                        objectClassNames: JSON.parse(value.objectClassNames._),
                        instructionsText: value.instructionsText._,
                        instructionsImageURL: (value.instructionsImageURL) ? value.instructionsImageURL._ : null,
                        instructionsVideoURL: (value.instructionsVideoURL) ? value.instructionsVideoURL._ : null
                    };
                }));
            });
        });
    },
    createProject: (args, res) => {
        return new Promise((resolve, reject) => {
            // TODO: Ensure user has project access to the app.
            const projectId = uuid().toString();

            const project = {
                PartitionKey: "projects", /* place all project records (not many, anyway) in the same partition. */
                RowKey: projectId,
                projectId: projectId,
                name: args.name,
                taskType: args.taskType,
                objectClassNames: JSON.stringify(args.objectClassNames),
                instructionsText: args.instructionsText,
                instructionsImageURL: args.instructionsImageURL,
                instructionsVideoURL: args.instructionsVideoURL
            };
            async.series(
                {
                    queue: (callback) => { services.queueService.createQueueIfNotExists(projectId, callback); },
                    container: (callback) => { services.blobService.createContainerIfNotExists(projectId, { publicAccessLevel: 'blob' }, callback); },
                    entity: (callback) => { services.tableService.insertEntity(projectTableName, project, callback); }
                },
                (error, results) => {
                    if (error) {
                        return reject(error);
                    }
                    project.objectClassNames = args.objectClassNames;
                    resolve(project);
                }
            ); /* async.series */
        });
    },
    removeProject: (args, res) => {
        return new Promise((resolve, reject) => {
            // TODO: Ensure user has access to projectId.
            const projectId = args.projectId;

            async.series(
                {
                    entity: (callback) => { services.tableService.deleteEntity(projectTableName, { PartitionKey: { "_": "projects" }, RowKey: { "_": projectId } }, callback); },
                    queue: (callback) => { services.queueService.deleteQueueIfExists(projectId, callback); },
                    container: (callback) => { services.blobService.deleteContainerIfExists(projectId, null, callback); }
                },
                (error, results) => {
                    if (error) {
                        return reject(error);
                    }
                    resolve(projectId);
                }
            ); /* async.series */
        });
    },
    getImages: (args, res) => {
        return new Promise((resolve, reject) => {
            // TODO: Ensure user has project access to the project.
            const projectId = args.projectId;
            const pageToken = (args.pageToken) ? JSON.parse(args.pageToken) : null;
            var query = new azure.TableQuery().where("PartitionKey == ?", projectId).top(4);
            services.tableService.queryEntities(imageTableName, query, pageToken, (error, results, response) => {
                if (error) {
                    reject(error);
                    return;
                }
                console.log(results);
                const images = results.entries.map((value) => {
                    return {
                        projectId: value.PartitionKey._,
                        imageId: value.RowKey._,
                        imageURL: getImageURL(projectId, value.RowKey._),
                    };
                });
                resolve({
                    pageToken: (results.continuationToken) ? JSON.stringify(results.continuationToken) : null,
                    images: images
                });
            });
        });
    },
    createImages: (args, res) => {
        return new Promise((resolve, reject) => {
            // TODO: Ensure user has access to projectId.
            const projectId = args.projectId;

            services.tableService.retrieveEntity("projects", "projects", projectId, (error, project) => {
                if (error) {
                    return reject(error);
                }
                services.blobService.createContainerIfNotExists(projectId, { publicAccessLevel: 'blob' }, (error) => {
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
                        const containerName = projectId;
                        const blobName = imageId;
                        const signature = services.blobService.generateSharedAccessSignature(
                            containerName,
                            blobName,
                            sharedAccessPolicy
                        );
                        const url = services.blobService.getUrl(containerName, blobName, signature);
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
                imageTasks.push(
                    (callback) => { services.tableService.insertEntity(imageTableName, imageRecord, callback); },
                    (callback) => { services.queueService.createMessage(currentImage.projectId, JSON.stringify(currentImage), callback) },
                    (callback) => { services.queueService.createMessage(currentImage.projectId, JSON.stringify(currentImage), callback) },
                    (callback) => { services.queueService.createMessage(currentImage.projectId, JSON.stringify(currentImage), callback) }
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
