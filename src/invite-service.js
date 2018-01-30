'use strict';

const async = require("async");
const azure = require('azure-storage');
const qs = require('qs');
const uuid = require('uuid/v4');

/**
 * Global invites table that all projects share. The collaboratorId is be used
 * as the partition key.
 */
const invitesTableName = process.env.INVITE_TABLE_NAME || 'invites';

function InviteService() {
}

InviteService.prototype.getInviteURL = function (projectId, collaboratorId, inviteId) {
  return `${this.modelService.getPublicBaseURL()}/vott-training/invites/${projectId}/${collaboratorId}/${inviteId}`;
}

InviteService.prototype.setServices = function (configuration) {
  Object.assign(this, configuration);

  const self = this;
  return new Promise((resolve, reject) => {
    self.tableService.createTableIfNotExists(invitesTableName, error => {
      if (error) return reject(error);
      else return resolve(configuration);
    });
  });
}

InviteService.prototype.createInvite = function (projectId, collaboratorId) {
  const self = this;
  return new Promise((resolve, reject) => {
    const inviteId = uuid();
    const inviteRecord = {
      PartitionKey: collaboratorId,
      RowKey: inviteId,
      status: 'ACTIVE'
    };
    self.tableService.insertEntity(invitesTableName, inviteRecord, (error, results) => {
      if (error) {
        return reject(error);
      }
      return resolve({
        inviteId: inviteId,
        inviteURL: self.getInviteURL(projectId, collaboratorId, inviteId)
      });
    });
  });
}

module.exports = {
  InviteService: InviteService
}