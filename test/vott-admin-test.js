const assert = require('assert');
const mock = require('./mock-services');
const admin = require('../src/vott-admin');

describe('Admin Service', () => {

  let services = null;
  let requestHandler = null;

  beforeEach(() => {
    services = mock.createMockServices();
    requestHandler = admin.createGraphqlRoot();
  });

  describe('#setServices()', () => {
    it('should initialize queues and tables', () => {
      return requestHandler.setServices(services);
    });
  });

  describe('#trainingImageStats()', () => {
    it('should conform to graphql schema', () => {
      services.imageService = {
        countTrainingImagesByStatus: function (projectId) {
          return Promise.resolve({
            TAG_PENDING: 4,
            READY_FOR_TRAINING: 3,
            IN_CONFLICT: 2,
            TOTAL: 9
          });
        }
      };
      return requestHandler.setServices(services).then(result => {
        const args = { projectId: 'someprojectid' };
        return requestHandler.trainingImageStats(args).then(response => {
          assert.deepEqual(response, {
            statusCount: [
              { status: 'IN_CONFLICT', count: 2 },
              { status: 'READY_FOR_TRAINING', count: 3 },
              { status: 'TAG_PENDING', count: 4 },
              { status: 'TOTAL', count: 9 },
            ]
          });
        });
      });
    });
  });

  describe('#annotationsCSV()', () => {
    it('should support object detection tags', () => {
      services.modelService = {
        readModel: (projectId, modelId) => Promise.resolve({})
      };
      services.imageService = {
        getTrainingImagesWithTags: (projectId, modelId) => Promise.resolve([
          { imageId: 'image01', fileURL: 'http://example.com/someprojectid/image01.jpg', tags: [{ label: 'guitar', boundingBox: { x: 0, y: 1, width: 127, height: 126 } }] }
        ])
      }
      return requestHandler.setServices(services).then(result => {
        const request = { params: { projectId: 'someprojectid' } };
        const responseHeaders = {};
        const responseData = [];
        const response = {
          set: function (key, value) { responseHeaders[key] = value; },
          send: function (data) { responseData.push(data); }
        }
        return requestHandler.annotationsCSV(request, response).then(csv => {
          assert.deepEqual(responseData, ['http://example.com/someprojectid/image01.jpg,0,1,127,126,guitar\n']);
        });
      });
    });
    it('should support image classification tags', () => {
      services.modelService = {
        readModel: (projectId, modelId) => Promise.resolve({})
      };
      services.imageService = {
        getTrainingImagesWithTags: (projectId, modelId) => Promise.resolve([
          { imageId: 'image01', fileURL: 'http://example.com/someprojectid/image01.jpg', tags: [{ label: 'bass' }] }
        ])
      }
      return requestHandler.setServices(services).then(result => {
        const request = { params: { projectId: 'someprojectid' } };
        const responseHeaders = {};
        const responseData = [];
        const response = {
          set: function (key, value) { responseHeaders[key] = value; },
          send: function (data) { responseData.push(data); }
        }
        return requestHandler.annotationsCSV(request, response).then(csv => {
          assert.deepEqual(responseData, ['http://example.com/someprojectid/image01.jpg,bass\n']);
        });
      });
    });
  });


});
