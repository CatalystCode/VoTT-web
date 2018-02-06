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
        countTrainingImagesByStatus:function(projectId) {
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
            statusCount:[
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


});
