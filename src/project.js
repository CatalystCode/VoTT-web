'use strict';

const async = require("async");
const azure = require('azure-storage');
const qs = require('qs'); 
const uuid = require('uuid/v4');

const configuration = {
    blobService:null,
    queueService:null,
    tableService:null
};

const imageContainerName = process.env.IMAGE_CONTAINER_NAME || 'images';
const imageQueueName = process.env.IMAGE_CONTAINER_NAME || 'images';
const imageTableName = process.env.IMAGE_TABLE_NAME || 'images';
const projectTableName = process.env.IMAGE_TABLE_NAME || 'projects';

module.exports = {
    setConfiguration:(configValues)=>{
        for(var k in configValues) configuration[k]=configValues[k];
        async.series(
            [
              (callback) => { configuration.blobService.createContainerIfNotExists(imageContainerName, { publicAccessLevel: 'blob' }, callback); },
              (callback) => { configuration.queueService.createQueueIfNotExists(imageQueueName, callback); },
              (callback) => { configuration.tableService.createTableIfNotExists(imageTableName, callback); },
              (callback) => { configuration.tableService.createTableIfNotExists(projectTableName, callback); }
            ],
            (err, results) => {
                console.log("Project configuration set successfully.");
            }
        );
    },
    getProjects:(args, res)=>{
        return new Promise((resolve, reject)=>{
            // TODO: Ensure user has project access to the app.
            var query = new azure.TableQuery().top(256);
            configuration.tableService.queryEntities(projectTableName, query, null, (error, results, response)=>{
                if (error) {
                    reject(error);
                    return;
                }
                resolve(results.entries.map((value)=>{
                    return {
                        projectId: value.projectId._,
                        name: value.name._,
                        taskType: value.taskType._,
                        objectClassNames: JSON.parse(value.objectClassNames._),
                        instructionsText: value.instructionsText._,
                        instructionsImageURL: (value.instructionsImageURL)?value.instructionsImageURL._:null,
                        instructionsVideoURL: (value.instructionsVideoURL)?value.instructionsVideoURL._:null
                    };
                }));
            });
        });
    },
    createProject:(args, res)=>{
        return new Promise((resolve, reject)=>{
            // TODO: Ensure user has project access to the app.
            const projectId = uuid().toString();

            const project = {
                  PartitionKey: "projects", /* place all project records (not many, anyway) in the same partition. */
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
                    queue:(callback)=>{ configuration.queueService.createQueueIfNotExists(projectId, callback); },
                    container:(callback)=>{ configuration.blobService.createContainerIfNotExists(projectId, { publicAccessLevel: 'blob' }, callback); },
                    entity:(callback)=>{ configuration.tableService.insertEntity(projectTableName, project, callback); }
                },
                (error, results)=>{
                    if (error) {
                        return reject(error);
                    }
                    project.objectClassNames = args.objectClassNames;
                    resolve(project);
                }
            ); /* async.series */
        });
    },
    removeProject:(args, res)=>{
        return new Promise((resolve, reject)=>{
            // TODO: Ensure user has access to projectId.
            const projectId = args.projectId;

            async.series(
                {
                    entity:(callback)=>{ configuration.tableService.deleteEntity(projectTableName, {PartitionKey:{"_":"projects"}, RowKey:{"_":projectId}}, callback); },
                    queue:(callback)=>{ configuration.queueService.deleteQueueIfExists(projectId, callback); },
                    container:(callback)=>{ configuration.blobService.deleteContainerIfExists(projectId, null, callback); }
                },
                (error, results)=>{
                    if (error) {
                        return reject(error);
                    }
                    resolve(projectId);
                }
            ); /* async.series */
        });
    },
    createImages:(args, res)=>{
        return new Promise((resolve, reject)=>{
            // TODO: Ensure user has access to projectId.
            const projectId = args.projectId;

            configuration.tableService.retrieveEntity("projects", "projects", projectId, (error, project)=>{
                if (error) {
                    return reject(error);
                }
                configuration.blobService.createContainerIfNotExists(projectId, { publicAccessLevel: 'blob' }, (error)=>{
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
                        const signature = configuration.blobService.generateSharedAccessSignature(
                            containerName,
                            blobName,
                            sharedAccessPolicy
                        );
                        const url = configuration.blobService.getUrl(containerName, blobName, signature);
                        result.push({
                            projectId:projectId,
                            imageId:imageId,
                            imageURL:url
                        });
                    }
                    resolve(result);        

                }); /*createContainerIfNotExists*/
            }); /*retrieveEntity*/
        });
    },
    commitImages:(args, res)=>{
        return new Promise((resolve, reject)=>{
            // TODO: Ensure user has access to projectId.
            const images = args.images;
            if (images.size < 1) {
                return reject("Parameter images must contain at least one element.");
            }

            const projectIds = new Set(images.map((image)=>image.projectId));
            if (projectIds.size > 1) {
                return reject("All images must belong to the same project.");
            }

            const imageTasks = [];
            for (var imageIndex in images) {
                const currentImage = images[imageIndex];
                imageTasks.push(
                    (callback)=>{configuration.queueService.createMessage(currentImage.projectId, JSON.stringify(currentImage), callback)},
                    (callback)=>{configuration.queueService.createMessage(currentImage.projectId, JSON.stringify(currentImage), callback)},
                    (callback)=>{configuration.queueService.createMessage(currentImage.projectId, JSON.stringify(currentImage), callback)}
                );
            }
            async.series(
                imageTasks,
                (error)=>{
                    if (error) {
                        return reject(error);
                    }
                    resolve("OK");
                }
            );

        });
    }
};
