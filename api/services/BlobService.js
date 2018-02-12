'use strict';

const azure = require('azure-storage');
const uuid = require('uuid/v4');

const blobService = azure.createBlobService();

module.exports = {

  createContainerIfNotExists: (containerName, options, callback) => blobService.createContainerIfNotExists(containerName, options, callback),
  deleteContainerIfExists: (containerName, options, callback) => blobService.deleteContainerIfExists(containerName, options, callback),
  getUrl: (containerName, blobName, sasToken, primary) => blobService.getUrl(containerName, blobName, sasToken, primary),

  createSAS: (containerName, blobName, durationInMinutes) => {
    const startDate = new Date();
    const expiryDate = new Date(startDate);
    const expiryMinutes = startDate.getMinutes() + (durationInMinutes ? durationInMinutes : 10);
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
