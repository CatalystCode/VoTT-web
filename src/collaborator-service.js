'use strict';

const async = require("async");
const azure = require('azure-storage');
const qs = require('qs');
const uuid = require('uuid/v4');

const services = {
  blobService: null,
  queueService: null,
  tableService: null
};

/**
 * Global collaborators table that all projects share. The projectId is be used
 * as the partition key and the collaborator's id as the primary key.
 */
const collaboratorsTableName = process.env.COLLABORATOR_TABLE_NAME || 'collaborators';

function mapCollaborator(record) {
  return {
    projectId: record.PartitionKey._,
    collaboratorId: record.RowKey._,
    name: record.name._,
    email: record.email._,
    profile: record.profile._,
  };
}

module.exports = {
  setServices: (configValues) => {
    return new Promise((resolve, reject) => {
      for (var k in configValues) services[k] = configValues[k];
      async.series(
        [
          (callback) => { services.tableService.createTableIfNotExists(collaboratorsTableName, callback); }
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

  createCollaborator: (projectId, name, email, profile, callback) => {
    return new Promise((resolve, reject) => {
      if (!projectId || !name || !email || !profile) {
        return reject("Missing one or more required argument.");
      }

      const collaboratorId = uuid();
      const collaboratorRecord = {
        PartitionKey: projectId,
        RowKey: collaboratorId,
        name: name,
        email: email,
        profile: profile
      };

      services.tableService.insertEntity(collaboratorsTableName, collaboratorRecord, (error, results) => {
        if (error) {
          return reject(error);
        }
        return resolve({
          projectId: projectId,
          collaboratorId: collaboratorId,
          name: name,
          email: email,
          profile: profile
        });
      });
    });
  },

  readCollaborators: (projectId, nextPageToken) => {
    return new Promise((resolve, reject) => {
      var query = new azure.TableQuery().where("PartitionKey == ?", projectId).top(64);
      services.tableService.queryEntities(collaboratorsTableName, query, nextPageToken, (error, results, response) => {
        if (error) {
          reject(error);
          return;
        }
        resolve({
          nextPageToken: (results.continuationToken) ? JSON.stringify(results.continuationToken) : null,
          entries: results.entries.map(mapCollaborator)
        });
      });
    });
  },

  deleteCollaborator: (projectId, collaboratorId) => {
    return new Promise((resolve, reject)=>{
      // TODO: Consider only marking the collaborator as deleted.
      const description = { PartitionKey: { "_": projectId }, RowKey: { "_": collaboratorId } };
      services.tableService.deleteEntity(collaboratorsTableName, description, (error, results)=>{
        if (error) {
          return reject(error);
        }
        return resolve("OK");
      });

    });
  }
}