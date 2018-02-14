const async = require('async');
const uuid = require('uuid/v4');
const rbush = require('rbush');

function getImageURL(projectId, imageId) {
  const containerName = ProjectService.getTrainingImageContainerName(projectId);
  const url = BlobService.getUrl(containerName, imageId);
  return url;
}

function tagToRbushRect(rectangle) {
  return {
    minX: rectangle.boundingBox.x,
    minY: rectangle.boundingBox.y,
    maxX: rectangle.boundingBox.x + rectangle.boundingBox.width,
    maxY: rectangle.boundingBox.y + rectangle.boundingBox.height,
    label: rectangle.label
  };
}

function enlargedArea(a, b) {
  return (Math.max(b.maxX, a.maxX) - Math.min(b.minX, a.minX)) *
    (Math.max(b.maxY, a.maxY) - Math.min(b.minY, a.minY));
}

function intersectionArea(a, b) {
  var minX = Math.max(a.minX, b.minX),
    minY = Math.max(a.minY, b.minY),
    maxX = Math.min(a.maxX, b.maxX),
    maxY = Math.min(a.maxY, b.maxY);

  return Math.max(0, maxX - minX) *
    Math.max(0, maxY - minY);
}

function tagAnalysis(tagsA, tagsB, similarityThreshold) {
  if (!similarityThreshold) {
    similarityThreshold = process.env.RECTANGLE_SIMILARITY_THRESHOLD || 0.75;
  }

  const maxLength = Math.max(tagsA.length, tagsB.length);
  const tree = rbush(maxLength);
  tagsA.forEach(element => {
    tree.insert(tagToRbushRect(element));
  });

  if (tagsB.length == 0) {
    return {
      matches: [],
      mismatches: tagsA
    }
  }

  const matches = [];
  const mismatches = [];
  tagsB.forEach(element => {
    const rectangle = tagToRbushRect(element);
    const intersectionArray = tree.search(rectangle);
    if (!intersectionArray || intersectionArray.length == 0) {
      mismatches.push(element);
      return;
    }

    const aboveThreshold = intersectionArray.find(intersection => {
      const score = intersectionArea(rectangle, intersection) / (1.0 * enlargedArea(rectangle, intersection));
      return score > similarityThreshold;
    });

    if (aboveThreshold && aboveThreshold.label == element.label) {
      matches.push(element);
    } else {
      mismatches.push(element);
    }

  });

  return {
    matches: matches,
    mismatches: mismatches
  };
}

function updateStatusFromContributionsForObjectDetection(project, image, contributions) {
  const referenceContribution = contributions.pop();
  const secondContribution = contributions.pop();

  const referenceTags = referenceContribution.tags;
  const secondTags = secondContribution.tags;

  //[{"label":"mustang","boundingBox":{"y":5.874396135265698,"x":5.2560386473429945,"width":117.38485997886474,"height":119.34299516908213}}]
  const primaryAnalysis = tagAnalysis(referenceTags, secondTags);
  if (primaryAnalysis.mismatches.length) {
    // Tie-breaker needed. If there aren't any other contributions, the image status is IN_CONFLICT
    if (contributions.length) {
      const thirdContribution = contributions.pop();
      const thirdTags = thirdContribution.tags;
      const secondaryAnalysis = tagAnalysis(referenceTags, thirdTags);
      if (secondaryAnalysis.mismatches.length) {
        image.status = 'in-conflict';
        return image.save();
      }
      else {
        image.tags = referenceTags.concat(thirdTags);
        image.status = 'ready-for-training';
        return image.save();
      }
    } else {
      // There aren't any more contributions to serve as a tie-breaker.
      image.status = 'in-conflict';
      return image.save();
    }
  } else {
    // No mismatches, this is good, the image is now READY_FOR_TRAINING and the tags should be saved
    image.tags = referenceTags.concat(secondTags);
    image.status = 'ready-for-training';
    return image.save();
  }
}

function updateStatusFromContributionsForImageClassification(project, image, contributions) {
  return Promise.resolve(image.status);
}

function updateStatusFromContributions(project, image) {
  return TrainingImageTagContribution.find({ image: image.id }).then(contributions => {
    if (!contributions || !contributions.length) return Promise.resolve(image.status);
    if (contributions.length < 2) {
      // Waiting for more contributions, so leaving the status as-is.
      return Promise.resolve(image.status);
    }

    if (project.type == 'object-detection') {
      return updateStatusFromContributionsForObjectDetection(project, image, contributions);
    } else {
      return updateStatusFromContributionsForImageClassification(project, image, contributions);
    }
  });
}

module.exports = {
  getImageURL: getImageURL,
  updateStatusFromContributions: updateStatusFromContributions,

  create: function (project, image) {
    return new Promise((resolve, reject) => {
      // Note that the image should already have an id property.
      TrainingImage.create(image).exec(function (error, imageRecord) {
        if (error) return reject(error);

        const taskMessage = {
          type: project.type,
          imageId: image.id,
          imageURL: getImageURL(project.id, image.id),
          labels: project.labels,
          instructionsText: project.instructionsText,
          instructionsImageURL: getImageURL(project.id, project.instructionsImageId)
        };
        const taskQueueName = ProjectService.getTaskQueueName(project.id);
        async.series(
          [
            (callback) => QueueService.createMessage(taskQueueName, JSON.stringify(taskMessage), callback),
            (callback) => QueueService.createMessage(taskQueueName, JSON.stringify(taskMessage), callback),
            (callback) => QueueService.createMessage(taskQueueName, JSON.stringify(taskMessage), callback)
          ],
          function (error, results) {
            if (error) return reject(error);
            return resolve(imageRecord);
          }
        );
      });
    });
  },

  pullTask: function (project) {
    const taskQueueName = ProjectService.getTaskQueueName(project.id);
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
    const taskQueueName = ProjectService.getTaskQueueName(project.id);
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
            return updateStatusFromContributions(project, image).then(status => {
              QueueService.deleteMessage(taskQueueName, messageId, popReceipt, function (error) {
                if (error) return Promise.reject(error);
                Promise.resolve(contribution);
              });
            });
          });
      });
  }

};
