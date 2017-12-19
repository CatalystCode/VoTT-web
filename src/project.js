'use strict';

const uuid = require('uuid/v4');
const async = require("async");
var qs = require('qs'); 

const configuration = {
    azure:null,
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
            // var query = new azure.TableQuery().top(256);
            configuration.tableService.queryEntities(projectTableName, null, null, (error, results, response)=>{
                if (error) {
                    reject(error);
                    return;
                }
                console.log(results);
                resolve(results.entries.map((value)=>{
                    return {
                        projectId:value.projectId._,
                        name:value.name._
                    }
                }));
            });
        });
    },
    createProject:(args, res)=>{
        return new Promise((resolve, reject)=>{
            // TODO: Ensure user has project access to the app.
            const name = args.name;
            const projectId = uuid().toString();
            const project = {
                PartitionKey: projectId,
                RowKey: projectId,
                projectId: projectId,
                name: name
            };
            configuration.tableService.insertEntity(projectTableName, project, (error, result, response) => {
                if (!error) {
                    resolve(project);
                }
                else {
                    reject(error);
                }
            });
        });
    },
    removeProject:(args, res)=>{
        return new Promise((resolve, reject)=>{
            // TODO: Ensure projectId exists.
            // TODO: Ensure user has access to projectId.
            const projectId = args.projectId;
            configuration.tableService.deleteEntity(
                projectTableName,
                {PartitionKey:{"_":projectId}, RowKey:{"_":projectId}},
                (error, response)=>{
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve({ projectId:projectId, name:"Some Project" });
                }
            );
        });
    },
    allocateImages:(args, res)=>{
        return new Promise((resolve, reject)=>{
            // TODO: Ensure projectId exists.
            // TODO: Ensure user has access to projectId.
            const projectId = args.projectId;

            var startDate = new Date(); 
            var expiryDate = new Date(startDate); 
            expiryDate.setMinutes(startDate.getMinutes() + 15); 

            var sharedAccessPolicy = { 
              AccessPolicy: { 
                Permissions: "WRITE",
                Start: startDate,
                Expiry: expiryDate
              } 
            };

            // Create imageCount pre-authenticated blob locations and return their URLs.
            const imageCount = args.imageCount;
            const result = [];
            for (let i = 0; i < imageCount; i++) {
                // Create a shared-access signature URI
                var blobName = uuid() + '.jpg';
                var signature = configuration.blobService.generateSharedAccessSignature(
                    imageContainerName,
                    blobName,
                    sharedAccessPolicy
                );
                const url = configuration.blobService.getUrl(imageContainerName, blobName, signature);
                result.push(url);
            }
            resolve(result);
        });
    },
    commitImages:(args, res)=>{
        return new Promise((resolve, reject)=>{
            resolve("OK");
        });
    }
};
