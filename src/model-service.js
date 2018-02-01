'use strict';

const async = require("async");
const azure = require('azure-storage');
const qs = require('qs');
const uuid = require('uuid/v4');

/**
 * Global models table that all projects share. The projectId is be used
 * as the partition key.
 */
const modelsTableName = process.env.MODEL_TABLE_NAME || 'models';

/**
 * Global training queue that is shared by all projects. A separate set of
 * workers that are able to handle messages from this queue will be listening
 * to this.
 */
const trainingQueueName = process.env.TRAINING_QUEUE_NAME || 'training';

function ModelService() {
}

ModelService.prototype.setServices = function (configuration) {
  Object.assign(this, configuration);

  const self = this;
  return new Promise((resolve, reject) => {
    async.series(
      [
        (callback) => { self.queueService.createQueueIfNotExists(trainingQueueName, callback); },
        (callback) => { self.tableService.createTableIfNotExists(modelsTableName, callback); }
      ],
      (err, results) => {
        if (err) {
          return reject(err);
        }
        resolve(configuration);
      }
    );
  });
}

/**
* @param {string} projectId containing the project primary key.
* @returns {string} containing the name of the container where all the models for the given project are stored.
*/
ModelService.prototype.getModelContainerName = function (projectId) {
  return `${projectId}-models`;
}

ModelService.prototype.getPublicBaseURL = function () {
  return 'https://popspotsvott01.azurewebsites.net';
}

ModelService.prototype.getModelAnnotationsURL = function (projectId, modelId) {
  return `${this.getPublicBaseURL()}/vott-training/projects/${projectId}/${modelId}/annotations.csv`;
}

ModelService.prototype.getModelStatusURL = function (projectId, modelId) {
  return `${this.getPublicBaseURL()}/vott-training/projects/${projectId}/${modelId}/status.json`;
}

/**
* @param {string} projectId containing the project primary key.
* @param {string} modelId containing the primary key of the model that is part of the given project.
* @returns {string} containing the full URL for the blob of the model.
*/
ModelService.prototype.getModelURL = function (projectId, modelId) {
  const containerName = this.getModelContainerName(projectId);
  return this.blobService.getUrl(containerName, modelId);
}

ModelService.prototype.createModel = function (projectId) {
  const self = this;
  return new Promise((resolve, reject) => {
    if (!projectId) {
      return reject("Parameter projectId must be present.");
    }
    const modelId = uuid();
    const status = "TRAINING_PENDING";
    const modelRecord = {
      PartitionKey: projectId,
      RowKey: modelId,
      status: status
    };
    const annotationsURL = self.getModelAnnotationsURL(projectId, modelId);
    const modelURL = self.getModelURL(projectId, modelId);
    const statusURL = self.getModelStatusURL(projectId, modelId);
    const trainingQueueMessage = {
      annotations: annotationsURL,
      model: modelURL,
      status: statusURL,
      plugin: 'retinanet'
    };
    async.series(
      [
        (callback) => { self.tableService.insertEntity(modelsTableName, modelRecord, callback); },
        (callback) => { self.queueService.createMessage(trainingQueueName, JSON.stringify(trainingQueueMessage), callback) }
      ],
      (error) => {
        if (error) {
          return reject(error);
        }
        resolve({
          projectId: projectId,
          modelId: modelId,
          status: status
        });
      }
    );
  });
}

ModelService.prototype.readModels = function (projectId, nextPageToken) {
  const self = this;
  return new Promise((resolve, reject) => {
    var query = new azure.TableQuery().where("PartitionKey == ?", projectId).top(64);
    self.tableService.queryEntities(modelsTableName, query, nextPageToken, (error, results, response) => {
      if (error) {
        return reject(error);
      }
      resolve({
        nextPageToken: (results.continuationToken) ? JSON.stringify(results.continuationToken) : null,
        entries: results.entries.map((value) => {
          return {
            projectId: value.PartitionKey._,
            modelId: value.RowKey._,
            created: value.Timestamp._,
            status: value.status._
          };
        })
      });
    });
  });
}

ModelService.prototype.deleteModel = function (projectId, modelId) {
  const self = this;
  return new Promise((resolve, reject) => {
    // TODO: Make sure the queue message(s) for training this model are also deleted.
    // TODO: Consider only marking the model as deleted.
    const description = { PartitionKey: { "_": projectId }, RowKey: { "_": modelId } };
    self.tableService.deleteEntity(modelsTableName, description, (error, results) => {
      if (error) {
        return reject(error);
      }
      return resolve("OK");
    });

  });
}

module.exports = {
  createModelService: function() {
    return new ModelService();
  }
};
