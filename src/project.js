'use strict';

const Promise = require('promise');
const uuid = require('uuid/v4');

const configuration = {
    blobService:null,
    queueService:null,
    tableService:null
};

module.exports = {
    setConfiguration:(configValues)=>{
        for(var k in configValues) configuration[k]=configValues[k];
    },
    getProjects:(args, res)=>{
        return new Promise((resolve, reject)=>{
            // TODO: Ensure user has project access to the app.
            resolve([
                { projectId:uuid(), name:"Some Project" }
            ]);
        });
    },
    createProject:(args, res)=>{
        return new Promise((resolve, reject)=>{
            // TODO: Ensure user has project access to the app.
            resolve({ projectId:uuid(), name:"Some Project" });
        });
    },
    removeProject:(args, res)=>{
        return new Promise((resolve, reject)=>{
            // TODO: Ensure projectId exists.
            // TODO: Ensure user has access to projectId.
            const projectId = args.projectId;
            resolve({ projectId:projectId, name:"Some Project" });
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
