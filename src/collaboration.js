'use strict';

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
            const projectId = args.projectId;

            // TODO: Ensure user has access to projectId.

            configuration.tableService.retrieveEntity("projects", "projects", projectId, (error, project)=>{
                if (error) {
                    return reject(error);
                }
                
                console.log(project);
                configuration.queueService.getMessage(projectId, (error, message)=>{
                    if (error) {
                        return reject(error);
                    }

                    const messageId = message.messageId;
                    const messageText = message.messageText;
                    const imageURL = configuration.blobService.getUrl(projectId, messageText);
                    resolve({
                        type: "ANNOTATE",
                        taskId: messageId,
                        imageURL: imageURL,
                        objectClassNames: ["tide-detergent"],
                        instructions:{
                            text: "Please draw a rectangle around any Tide detergent boxes you see.",
                            sampleImageURL: imageURL,
                            sampleVideoURL: imageURL
                        }
                    });
                });
            });
        });
    },
    submitImageTags:(args, res)=>{
        return new Promise((resolve, reject)=>{
            resolve(uuid());
        });
    }
};
