'use strict';

const async = require('async');
const uuid = require('uuid/v4');

function getTaskQueueName(projectId) {
  return `${projectId}-tasks`;
}

function getTrainingImageContainerName(projectId) {
  return `${projectId}-images`;
}

function getModelContainerName(projectId) {
  return `${projectId}-images`;
}

function getTrainQueueName(projectId) {
  return 'training';
}

function getImageURL(projectId, imageId) {
  // TODO: Consider using an SAS token.
  const containerName = getTrainingImageContainerName(projectId);
  const url = BlobService.getUrl(containerName, imageId);
  return url;
}

module.exports = {

  getImageURL: getImageURL,
  getTrainingImageContainerName: getTrainingImageContainerName,
  getTaskQueueName: getTaskQueueName,
  getModelContainerName: getModelContainerName,
  getTrainQueueName: getTrainQueueName,

  createProject: function (project) {
    project.labels = (typeof (project.labels) == 'string') ? JSON.parse(project.labels) : project.labels;
    const projectId = uuid();

    const trainingImagesContainerName = getTrainingImageContainerName(projectId);
    const taskQueueName = getTaskQueueName(projectId);
    const trainingQueueName = getTrainQueueName(projectId);
    const modelContainerName = getModelContainerName(projectId);

    return new Promise((resolve, reject) => {
      async.series(
        [
          (callback) => { QueueService.createQueueIfNotExists(taskQueueName, callback); },
          (callback) => { BlobService.createContainerIfNotExists(trainingImagesContainerName, { publicAccessLevel: 'blob' }, callback); },
          (callback) => { QueueService.createQueueIfNotExists(trainingQueueName, callback); },
          (callback) => { BlobService.createContainerIfNotExists(modelContainerName, { publicAccessLevel: 'blob' }, callback); },
        ],
        (error, results) => {
          if (error) return reject(error);

          const projectDescription = Object.assign({ id: projectId }, project);
          Project.create(projectDescription).exec(function (error, record) {
            if (error) return reject(error);
            resolve(record);
          });
        }
      );
    });

  },

  destroyProject: function (projectId) {
    // AccessRight.destroy({project:projectId}, function(error){
    // });

    const taskQueueName = getTaskQueueName(projectId);
    const trainingImagesContainerName = getTrainingImageContainerName(projectId);
    const modelContainerName = getModelContainerName(projectId);
    return new Promise((resolve, reject) => {
      Project.destroy({ id: projectId }).exec(function (error) {
        if (error) return reject(error);

        async.series(
          [
            (callback) => { QueueService.deleteQueueIfExists(taskQueueName, callback); },
            (callback) => { BlobService.deleteContainerIfExists(trainingImagesContainerName, null, callback); },
            (callback) => { BlobService.deleteContainerIfExists(modelContainerName, null, callback); }
          ],
          function (error, results) {
            if (error) return reject(error);
            else resolve();
          }
        );
      });
    });
  },

  allocateInstructionsImage: function (projectId) {
    return new Promise((resolve, reject) => {
      const trainingImagesContainerName = getTrainingImageContainerName(projectId);
      const sas = BlobService.createSAS(trainingImagesContainerName);
      resolve({
        id: sas.id,
        url: sas.url
      });
    });
  },

  commitInstructionsImage: function (projectId, image) {
    return new Promise((resolve, reject) => {
      Project.update(
        { id: projectId },
        { instructionsImageId: image.id }
      ).exec(function (error, record) {
        if (error) return reject(error);
        resolve(record);
      });
    });
  },

  pullTask: function (project) {
    const taskQueueName = getTaskQueueName(project.id);
    return new Promise((resolve, reject) => {
      QueueService.getMessage(taskQueueName, function (error, message) {
        if (error) return reject(error);
        if (!message) return resolve(null, null);

        const task = JSON.parse(message.messageText);
        task.id = message.messageId;
        task.popReceipt = message.popReceipt;
        resolve(task);
      });
    });
  },

  pushTask: function (project, task, user) {
    const taskQueueName = getTaskQueueName(project.id);
    const imageId = task.imageId;
    const tags = task.tags;
    const messageId = task.id;
    const popReceipt = task.popReceipt;

    return TrainingImage
      .findOne({ id: imageId })
      .then(image => {
        if (!image) return Promise.resolve(null);

        return TrainingImageTagContribution
          .create({
            id: uuid(),
            image: image,
            user: user,
            tags: JSON.stringify(tags)
          })
          .then(contribution => {
            // image.takeStatusFromContributions();
            QueueService.deleteMessage(taskQueueName, messageId, popReceipt, function (error) {
              if (error) return Promise.reject(error);
              Promise.resolve(contribution);
            });
          });
      });
  }

}
