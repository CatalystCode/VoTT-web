const azure = require('azure-storage');
const uuid = require('uuid/v4');
const turf = require('@turf/turf');
const rbush = require('rbush');

function PassthroughEncoder() {
}

PassthroughEncoder.prototype.encode = function (input) {
  return input;
};

PassthroughEncoder.prototype.decode = function (textToDecode) {
  return textToDecode;
};

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
    w: (right - left),
    h: (maxY - minY),
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

/**
 * Returns the rectangle representing the intersection between given rectangles a and b. Returns null if no intersection exists.
 * @param {object} a - An object representing a rectangle in the form { x:Number, y:Number, w:Number, h:Number }
 * @param {object} b - Another object representing a rectangle in the form { x:Number, y:Number, w:Number, h:Number }
 */
function rectIntersection(a, b) {
  const polygonA = turf.bboxPolygon([a.x, a.y, a.x + a.w, a.y + a.h]);
  const polygonB = turf.bboxPolygon([b.x, b.y, b.x + b.w, b.y + b.h]);
  const intersection = turf.intersect(polygonA, polygonB);
  return featureToRect(intersection);
}

/**
 * Returns the rectangle representing the union between given rectangles a and b. Returns null if no union exists.
 * @param {object} a - An object representing a rectangle in the form { x:Number, y:Number, w:Number, h:Number }
 * @param {object} b - Another object representing a rectangle in the form { x:Number, y:Number, w:Number, h:Number }
 */
function rectUnion(a, b) {
  const polygonA = turf.bboxPolygon([a.x, a.y, a.x + a.w, a.y + a.h]);
  const polygonB = turf.bboxPolygon([b.x, b.y, b.x + b.w, b.y + b.h]);
  var features = turf.featureCollection([
    polygonA, polygonB
  ]);

  var enveloped = turf.envelope(features);
  return featureToRect(enveloped);
}

function rectToRbushRect(rectangle) {
  return {
    minX: rectangle.x,
    minY: rectangle.y,
    maxX: rectangle.x + rectangle.w,
    maxY: rectangle.y + rectangle.h,
    label: rectangle.label
  };
}

function enlargedArea(a, b) {
  return (Math.max(b.maxX, a.maxX) - Math.min(b.minX, a.minX)) *
         (Math.max(b.maxY, a.maxY) - Math.min(b.minY, a.minY));
}

function intersectionArea(a, b) {
  var minX = Math.max(a.minX, b.minX),
      minY = Math.max(a.minY, b.minY),
      maxX = Math.min(a.maxX, b.maxX),
      maxY = Math.min(a.maxY, b.maxY);

  return Math.max(0, maxX - minX) *
         Math.max(0, maxY - minY);
}

function rectAnalysis(rectanglesA, rectanglesB, similarityThreshold) {
  if (!similarityThreshold) {
    similarityThreshold = process.env.RECTANGLE_SIMILARITY_THRESHOLD || 0.75;
  }

  const maxLength = Math.max(rectanglesA.length, rectanglesB.length);
  const tree = rbush(maxLength);
  rectanglesA.forEach(element => {
    tree.insert(rectToRbushRect(element));
  });

  if (rectanglesB.length == 0) {
    return {
      matches:[],
      mismatches: rectanglesA
    }
  }

  const matches = [];
  const mismatches = [];
  rectanglesB.forEach(element => {
    const rectangle = rectToRbushRect(element);
    const intersectionArray = tree.search(rectangle);
    if (!intersectionArray || intersectionArray.length == 0) {
      mismatches.push(element);
      return;
    }

    const aboveThreshold = intersectionArray.find(intersection=>{
      const score = intersectionArea(rectangle, intersection) / (1.0*enlargedArea(rectangle, intersection));
      return score > similarityThreshold;
    });

    if (aboveThreshold) {
      matches.push(element);
    } else {
      mismatches.push(element);
    }

  });

  return {
    matches: matches,
    mismatches: mismatches
  }
}

module.exports = {
  PassthroughEncoder: PassthroughEncoder,
  rectIntersection: rectIntersection,
  rectUnion: rectUnion,
  rectAnalysis: rectAnalysis,

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
