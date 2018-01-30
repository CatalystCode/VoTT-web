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

module.exports = {
  PassthroughEncoder: PassthroughEncoder,

  createFileSAS: (blobService, containerName, extension) => {
    const startDate = new Date();
    const expiryDate = new Date(startDate);
    expiryDate.setMinutes(startDate.getMinutes() + 5);

    const BlobUtilities = azure.BlobUtilities;
    const sharedAccessPolicy = {
      AccessPolicy: {
        Permissions: BlobUtilities.SharedAccessPermissions.WRITE,
        Start: startDate,
        Expiry: expiryDate
      }
    };

    const fileId = uuid();
    const blobName = (extension) ? `${fileId}.${extension}` : fileId;
    const signature = blobService.generateSharedAccessSignature(
      containerName,
      blobName,
      sharedAccessPolicy
    );
    const url = blobService.getUrl(containerName, blobName, signature);
    return {
      url: url,
      fileId: fileId,
    }
  },

  mapColumnValue: (columnValue) => {
    if (columnValue == null || columnValue == undefined) {
      return null;
    }
    return (columnValue.hasOwnProperty('_')) ? columnValue._ : columnValue;
  }

};
