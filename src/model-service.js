'use strict';

const async = require("async");
const azure = require('azure-storage');
const qs = require('qs');
const uuid = require('uuid/v4');

const services = {
  authzService: null,
  blobService: null,
  queueService: null,
  tableService: null
};

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

function getModelContainerName(projectId) {
  return `${projectId}-models`;
}

function getPublicBaseURL() {
  return 'https://popspotsvott01.azurewebsites.net';
}

function getModelAnnotationsURL(projectId, modelId) {
  return `${getPublicBaseURL()}/vott-training/projects/${projectId}/${modelId}/annotations.csv`;
}

function getModelStatusURL(projectId, modelId) {
  return `${getPublicBaseURL()}/vott-training/projects/${projectId}/${modelId}/status.json`;
}

function getModelURL(projectId, modelId) {
  const containerName = getModelContainerName(projectId);
  return services.blobService.getUrl(containerName, modelId);
}

module.exports = {
  setServices: (configValues) => {
    return new Promise((resolve, reject) => {
      for (var k in configValues) services[k] = configValues[k];
      async.series(
        [
          (callback) => { services.queueService.createQueueIfNotExists(trainingQueueName, callback); },
          (callback) => { services.tableService.createTableIfNotExists(modelsTableName, callback); }
        ],
        (err, results) => {
          if (err) {
            return reject(err);
          }
          resolve(configValues);
        }
      );
    });
  },

  /**
  * @param {string} projectId containing the project primary key.
  * @returns {string} containing the name of the container where all the models for the given project are stored.
  */
  getModelContainerName: getModelContainerName,

  /**
  * @param {string} projectId containing the project primary key.
  * @param {string} modelId containing the primary key of the model that is part of the given project.
  * @returns {string} containing the full URL for the blob of the model.
  */
  getModelURL: getModelURL,

  getPublicBaseURL: getPublicBaseURL,
  getModelAnnotationsURL: getModelAnnotationsURL,
  getModelStatusURL: getModelStatusURL,

  createModel: (projectId) => {
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
      const annotationsURL = getModelAnnotationsURL(projectId, modelId);
      const modelURL = getModelURL(projectId, modelId);
      const statusURL = getModelStatusURL(projectId, modelId);
      const trainingQueueMessage = {
        annotations: annotationsURL,
        model: modelURL,
        status: statusURL,
        plugin: 'retinanet'
      };
      const trainingQueueMessagePythonStyle = `{ "annotations": "${annotationsURL}", "model": "${modelURL}", "status": "${getModelStatusURL(projectId, modelId)}","plugin": "retinanet" }`;
      async.series(
        [
          (callback) => { services.tableService.insertEntity(modelsTableName, modelRecord, callback); },
          (callback) => { services.queueService.createMessage(trainingQueueName, trainingQueueMessagePythonStyle, callback) }
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
  },

  readModels: (projectId, nextPageToken) => {
    return new Promise((resolve, reject) => {
      var query = new azure.TableQuery().where("PartitionKey == ?", projectId).top(64);
      services.tableService.queryEntities(modelsTableName, query, nextPageToken, (error, results, response) => {
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
  },


};
