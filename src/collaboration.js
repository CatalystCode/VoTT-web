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
                        taskId: messageId,
                        imageURL: imageURL,
                        taskType: project.taskType._,
                        objectClassNames: JSON.parse(project.objectClassNames._),
                        projectId: project.projectId._,
                        instructionsText: project.instructionsText._,
                        instructionsImageURL: (project.instructionsImageURL)?project.instructionsImageURL._:null,
                        instructionsVideoURL: (project.instructionsVideoURL)?project.instructionsVideoURL._:null
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
