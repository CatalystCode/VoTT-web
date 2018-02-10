const uuid = require('uuid/v4');

function getAnnotationsURL(projectId, trainingRequestId) {
  // Remember to keep this in sync with its config/routes.js counterpart.
  // TODO: Consider uploading annotations.csv to blob storage.
  return `${FoundationService.websiteBaseURL()}/api/vott/v1/trainingRequests/${projectId}/${trainingRequestId}/annotations.csv`;
}

function getModelStatusURL(projectId, trainingRequestId) {
  // Remember to keep this in sync with its config/routes.js counterpart.
  return `${FoundationService.websiteBaseURL()}/api/vott/v1/trainingRequests/${projectId}/${trainingRequestId}/status`;
}

function getModelURL(projectId, trainingRequestId) {
  const containerName = ProjectService.getModelContainerName(projectId);
  const sasExpirationInMinutes = parseInt(process.env.TRAINING_MODEL_SAS_EXPIRATION_IN_MINUTES || `${(60 * 24 * 7)}`);
  const sas = BlobService.createSAS(containerName, `${trainingRequestId}.tgz`, sasExpirationInMinutes);
  return sas.url;
}

module.exports = {

  getAnnotationsURL: getAnnotationsURL,
  getModelStatusURL: getModelStatusURL,
  getModelURL: getModelURL,

  find: function (project) {
    return new Promise((resolve, reject) => {
      TrainingRequest
        .find({ project: project.id })
        .populate('requestedBy')
        .exec(function (error, trainingRequests) {
          if (error) return reject(error);
          resolve(trainingRequests);
        });
    });
  },

  create: function (project, user) {
    return new Promise((resolve, reject) => {
      TrainingRequest.create({
        id: uuid(),
        status: 'pending',
        project: project,
        requestedBy: user
      }).exec(function (error, trainingRequest) {
        if (error) return reject(error);

        const projectId = project.id;
        const trainingRequestId = trainingRequest.id;

        const annotationsURL = getAnnotationsURL(projectId, trainingRequestId);
        const modelURL = getModelURL(projectId, trainingRequestId);
        const statusURL = getModelStatusURL(projectId, trainingRequestId);
        const trainingQueueMessage = {
          annotations: annotationsURL,
          model: modelURL,
          status: statusURL,
          plugin: 'retinanet'
        };
        const trainingQueueName = ProjectService.getTrainQueueName(project.id);
        QueueService.createMessage(trainingQueueName, JSON.stringify(trainingQueueMessage), function (error, result) {
          if (error) return reject(error);
          resolve(trainingRequest);
        });

      });
    });
  }

};
