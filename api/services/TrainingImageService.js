function getImageURL(projectId, imageId) {
  const containerName = ProjectService.getTrainingImageContainerName(projectId);
  const url = BlobService.getUrl(containerName, imageId);
  return url;
}

module.exports = {
  getImageURL: getImageURL,

  create: function (project, image) {
    return new Promise((resolve, reject) => {
      // Note that the image should already have an id property.
      TrainingImage.create(image).exec(function (error, imageRecord) {
        if (error) return reject(error);

        const taskMessage = {
          taskType: project.taskType,
          imageId: image.id,
          imageURL: getImageURL(project.id, image.id),
          labels: project.labelsArray(),
          instructionsText: project.instructionsText,
          instructionsImageURL: getImageURL(project.id, project.instructionsImageId)
        };
        const taskQueueName = ProjectService.getTaskQueueName(project.id);
        QueueService.createMessage(taskQueueName, JSON.stringify(taskMessage), function (error, result) {
          if (error) return reject(error);
          return resolve(imageRecord);
        });

      });
    });
  },

};
