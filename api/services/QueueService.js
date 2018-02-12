'use strict';

const azure = require('azure-storage');

function PassthroughEncoder() {
}

PassthroughEncoder.prototype.encode = function (input) {
  return input;
};

PassthroughEncoder.prototype.decode = function (textToDecode) {
  return textToDecode;
};

const queueService = azure.createQueueService();

// A custom pass-through encoder is assigned to the blob service because, by
// default, it uses an XML encoder that mangles JSON messages.
queueService.messageEncoder = new PassthroughEncoder();

module.exports = {
  createQueueIfNotExists: (queueName, callback) => queueService.createQueueIfNotExists(queueName, callback),
  deleteQueueIfExists: (queueName, callback) => queueService.deleteQueueIfExists(queueName, callback),
  createMessage: (queueName, messageText, callback) => queueService.createMessage(queueName, messageText, callback),
  getMessage: (queueName, options, callback) => queueService.getMessage(queueName, options, callback),
  deleteMessage: (queueName, messageId, popReceipt, callback) => queueService.deleteMessage(queueName, messageId, popReceipt, callback),

};
