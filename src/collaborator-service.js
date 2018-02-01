'use strict';

const async = require("async");
const azure = require('azure-storage');
const qs = require('qs');
const uuid = require('uuid/v4');

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

function CollaboratorService() {
}

CollaboratorService.prototype.setServices = function (configuration) {
  Object.assign(this, configuration);

  const self = this;
  return new Promise((resolve, reject) => {
    self.tableService.createTableIfNotExists(collaboratorsTableName, (error)=>{
      if (error) return reject(error);
      else return resolve(configuration);
    });
  });
}

CollaboratorService.prototype.createCollaborator = function(projectId, name, email, profile, callback) {
  const self = this;
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

    self.tableService.insertEntity(collaboratorsTableName, collaboratorRecord, (error, results) => {
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
}

CollaboratorService.prototype.readCollaborators= function(projectId, nextPageToken) {
  const self = this;
  return new Promise((resolve, reject) => {
    var query = new azure.TableQuery().where("PartitionKey == ?", projectId).top(64);
    self.tableService.queryEntities(collaboratorsTableName, query, nextPageToken, (error, results, response) => {
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
}

CollaboratorService.prototype.readCollaborator= function(projectId, collaboratorId) {
  const self = this;
  return new Promise((resolve, reject) => {
      self.tableService.retrieveEntity(collaboratorsTableName, projectId, collaboratorId, (error, response) => {
          if (error) {
              return reject(error);
          }
          resolve(mapCollaborator(response));
      });
  });
}

CollaboratorService.prototype.deleteCollaborator = function (projectId, collaboratorId) {
  const self = this;
  return new Promise((resolve, reject)=>{
    // TODO: Consider only marking the collaborator as deleted.
    const description = { PartitionKey: { "_": projectId }, RowKey: { "_": collaboratorId } };
    self.tableService.deleteEntity(collaboratorsTableName, description, (error, results)=>{
      if (error) {
        return reject(error);
      }
      return resolve("OK");
    });

  });
}

module.exports = {
  createCollaboratorService: function() {
    return new CollaboratorService();
  }
}