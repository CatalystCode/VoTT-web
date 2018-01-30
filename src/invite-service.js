'use strict';

const async = require("async");
const azure = require('azure-storage');
const qs = require('qs');
const uuid = require('uuid/v4');

const services = {
  modelService: null,
  blobService: null,
  queueService: null,
  tableService: null
};

/**
 * Global invites table that all projects share. The collaboratorId is be used
 * as the partition key.
 */
const invitesTableName = process.env.INVITE_TABLE_NAME || 'invites';

function getInviteURL(projectId, collaboratorId, inviteId) {
  return `${services.modelService.getPublicBaseURL()}/vott-training/invites/${projectId}/${collaboratorId}/${inviteId}`;
}

module.exports = {
  setServices: (configValues) => {
    return new Promise((resolve, reject) => {
      for (var k in configValues) services[k] = configValues[k];
      async.series(
        [
          (callback) => { services.tableService.createTableIfNotExists(invitesTableName, callback); }
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
  getInviteURL: getInviteURL,
  createInvite: (projectId, collaboratorId) => {
    return new Promise((resolve, reject) => {
      const inviteId = uuid();
      const inviteRecord = {
        PartitionKey: collaboratorId,
        RowKey: inviteId,
        status: 'ACTIVE'
      };
      services.tableService.insertEntity(invitesTableName, inviteRecord, (error, results) => {
        if (error) {
          return reject(error);
        }
        return resolve({
          inviteId: inviteId,
          inviteURL: getInviteURL(projectId, collaboratorId, inviteId)
        });
      });
    });
  }
}