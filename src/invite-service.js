'use strict';

const azure = require('azure-storage');
const uuid = require('uuid/v4');

const foundation = require('./vott-foundation');

/**
 * Global invites table that all projects share. The collaboratorId is be used
 * as the partition key.
 */
const invitesTableName = process.env.INVITE_TABLE_NAME || 'invites';

function InviteService() {
}

InviteService.prototype.getInviteURL = function (projectId, collaboratorId, inviteId) {
  // Remember to ensure getInviteURLPattern is in sync with the result of this function.
  return `${foundation.websiteBaseURL()}/v1/vott-training/invites/${projectId}/${collaboratorId}/${inviteId}`;
}

InviteService.prototype.getInviteURLPattern = function () {
  // Remember to ensure getInviteURL is in sync with the result of this function.
  return '/v1/vott-training/invites/:projectId/:collaboratorId/:inviteId';
}

InviteService.prototype.mapInvite = function (invite) {
  const inviteId = invite.RowKey._;
  const collaboratorId = invite.PartitionKey._;
  const projectId = invite.projectId._;
  return {
    inviteId: inviteId,
    collaboratorId: collaboratorId,
    projectId: projectId,
    inviteURL: this.getInviteURL(projectId, collaboratorId, inviteId)
  };
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
      projectId: projectId,
      status: 'ACTIVE'
    };
    self.tableService.insertEntity(invitesTableName, inviteRecord, (error, results) => {
      if (error) {
        return reject(error);
      }
      return resolve({
        inviteId: inviteId,
        collaboratorId: collaboratorId,
        projectId: projectId,
        inviteURL: self.getInviteURL(projectId, collaboratorId, inviteId)
      });
    });
  });
}

InviteService.prototype.readInvite = function (projectId, collaboratorId, inviteId) {
  const self = this;
  return new Promise((resolve, reject) => {
    self.tableService.retrieveEntity(invitesTableName, collaboratorId, inviteId, (error, record) => {
      if (error) {
        return reject(error);
      }

      const invite = self.mapInvite(record);
      if (invite.projectId != projectId) {
        return reject("Not found.");
      }
      resolve(invite);
    });
  });
}

module.exports = {
  InviteService: InviteService,
  createInviteService: function() {
    return new InviteService();
  }
}