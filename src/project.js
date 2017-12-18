'use strict';

const Promise = require('promise');
const uuid = require('uuid/v4');
const async = require("async");

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

            // Create imageCount pre-authenticated blob locations and return their URLs.
            const imageCount = args.imageCount;
            const result = [];
            for (let i = 0; i < imageCount; i++) {
                result.push(uuid());
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
