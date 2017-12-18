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
    getNextImageTagTask:(args, res)=>{
        return new Promise((resolve, reject)=>{
            // TODO: Ensure projectId exists.
            // TODO: Ensure user has access to projectId.
            const projectId = args.projectId;
            const simulatedDeployment = uuid();
            resolve({
                type:"ANNOTATE",
                taskId:uuid(),
                imageURL:`http://vott-${simulatedDeployment}.azure.com/images/${uuid()}.jpg`,
                objectClassNames:["tide-detergent"],
                instructions:{
                    text:"Please draw a rectangle around any Tide detergent boxes you see.",
                    sampleImageURL:`http://vott-${simulatedDeployment}.azure.com/images/sample.${uuid()}.jpg`,
                    sampleVideoURL:`http://vott-${simulatedDeployment}.azure.com/images/sample.${uuid()}.m4v`
                }
            });
        });
    },
    submitImageTags:(args, res)=>{
        return new Promise((resolve, reject)=>{
            resolve(uuid());
        });
    }
};
