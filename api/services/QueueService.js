'use strict';

const azure = require('azure-storage');
const queueService = azure.createQueueService();

module.exports = {
  createQueueIfNotExists: (queueName, callback) => queueService.createQueueIfNotExists(queueName, callback),
  deleteQueueIfExists: (queueName, callback) => queueService.deleteQueueIfExists(queueName, callback),
  createMessage: (queueName, messageText, callback) => queueService.createMessage(queueName, messageText, callback),
  getMessage: (queueName, options, callback) => queueService.getMessage(queueName, options, callback),
  deleteMessage: (queueName, messageId, popReceipt, callback) => queueService.deleteMessage(queueName, messageId, popReceipt, callback),

};
