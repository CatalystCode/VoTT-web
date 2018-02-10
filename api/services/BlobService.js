'use strict';

const azure = require('azure-storage');
const uuid = require('uuid/v4');

function PassthroughEncoder() {
}

PassthroughEncoder.prototype.encode = function (input) {
  return input;
};

PassthroughEncoder.prototype.decode = function (textToDecode) {
  return textToDecode;
};

const blobService = azure.createBlobService();

// A custom pass-through encoder is assigned to the blob service because, by
// default, it uses an XML encoder that mangles JSON messages.
blobService.messageEncoder = new PassthroughEncoder();

module.exports = {

  createContainerIfNotExists: (containerName, options, callback) => blobService.createContainerIfNotExists(containerName, options, callback),
  deleteContainerIfExists: (containerName, options, callback) => blobService.deleteContainerIfExists(containerName, options, callback),
  getUrl: (containerName, blobName, sasToken, primary) => blobService.getUrl(containerName, blobName, sasToken, primary),

  createSAS: (containerName, blobName, durationInMinutes) => {
    const startDate = new Date();
    const expiryDate = new Date(startDate);
    const expiryMinutes = startDate.getMinutes() + (durationInMinutes ? durationInMinutes : 5);
    expiryDate.setMinutes(expiryMinutes);

    const BlobUtilities = azure.BlobUtilities;
    const sharedAccessPolicy = {
      AccessPolicy: {
        Permissions: BlobUtilities.SharedAccessPermissions.WRITE,
        Start: startDate,
        Expiry: expiryDate
      }
    };

    if (!blobName) {
      blobName = uuid();
    }

    const signature = blobService.generateSharedAccessSignature(
      containerName,
      blobName,
      sharedAccessPolicy
    );
    const url = blobService.getUrl(containerName, blobName, signature);
    return {
      url: url,
      id: blobName,
    }
  }

}
