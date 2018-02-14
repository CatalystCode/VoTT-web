const azure = require('azure-storage');
const uuid = require('uuid/v4');
const rbush = require('rbush');

function polygonToRect(polygon) {
  const xs = polygon.map(value => value[0]);
  const ys = polygon.map(value => value[1]);

  const left = Math.min.apply(null, xs);
  const right = Math.max.apply(null, xs);

  const minY = Math.min.apply(null, ys);
  const maxY = Math.max.apply(null, ys);

  return {
    x: left,
    y: minY,
    width: (right - left),
    height: (maxY - minY),
  };
}

function featureToRect(feature) {
  if (!feature) {
    return undefined;
  }

  const type = feature.geometry.type;
  if (type != 'Polygon') {
    throw new Error(`Feature geometry type unsupported ${type}`);
  }

  const polygons = feature.geometry.coordinates;
  return polygonToRect(polygons[0]);
}

module.exports = {

  websiteBaseURL: () => {
    const hostname = process.env.WEBSITE_HOSTNAME || 'localhost';
    if (hostname == 'localhost') {
      const port = process.env.PORT || '8080';
      return `http://${hostname}:${port}`;
    }
    return `https://${hostname}`;
  },

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
