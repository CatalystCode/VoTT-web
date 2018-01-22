'use strict';

const uuid = require('uuid/v4');

const services = {
    blobService:null,
    queueService:null,
    tableService:null
};

module.exports = {
    setServices:(configValues)=>{
        return new Promise((resolve, reject)=>{
            for(var k in configValues) services[k]=configValues[k];
            console.log("Connected services.");
            resolve(configValues);
        });
    },
    imageTagTask:(args, res)=>{
        return new Promise((resolve, reject)=>{
            const projectId = args.projectId;

            // TODO: Ensure user has access to projectId.

            services.tableService.retrieveEntity("projects", "projects", projectId, (error, project)=>{
                if (error) {
                    return reject(error);
                }
                
                console.log(project);
                services.queueService.getMessage(projectId, (error, message)=>{
                    if (error) {
                        return reject(error);
                    }

                    const messageId = message.messageId;
                    const popReceipt = message.popReceipt;
                    const imageData = JSON.parse(message.messageText);
                    const imageURL = services.blobService.getUrl(projectId, imageData.imageId);
                    resolve({
                        taskId: projectId + ":" + messageId + ":" + popReceipt,
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
            const taskId = args.taskId;
            const projectId = taskId.split(":")[0];
            const messageId = taskId.split(":")[1];
            const popReceipt = taskId.split(":")[2];
            // TODO: Ensure user has access to projectId.
            // TODO: Save annotations.
            services.queueService.deleteMessage(projectId, messageId, popReceipt, (error)=>{
                if (error) {
                    return reject(error);
                }
                resolve(uuid());
            });
        });
    }
};
