const assert = require('assert');
const mock = require('./mock-services');
const ps = require('../src/project-service');

describe('Project Service', () => {

  let services = null;
  let projectService = null;

  beforeEach(() => {
    services = mock.createMockServices();
    services.tableService.retrieveEntity = (tableName, partitionKey, primaryKey, callback) => {
      callback(null, {
        RowKey: { _: primaryKey },
        name: "Some Project",
        taskType: "CLASSIFICATION",
        labels: "[]",
        instructionsText: "Do something.",
        instructionsImageId: "instructionsimageid"
      });
    };
    services.queueService.getMessage = (queueName, callback) => {
      callback(null, {
        messageId: "somemessageid",
        popReceipt: "somereceipt",
        messageText: JSON.stringify({
          imageId: "someimageid"
        })
      });
    };
    services.imageService = {
      getTaskQueueName: function (projectId) {
        return "tasks";
      },
      getImageURL: function (containerName, imageId) {
        return `https://example.com/${containerName}/${imageId}`;
      },
      readTrainingImage: function (projectId, imageId) {
        return Promise.resolve({});
      },
      updateTrainingImageWithTagContributions: function (projectId, imageId) {
        return Promise.resolve("OK");
      }
    };
    projectService = ps.createProjectService();
  });

  describe('#setServices()', () => {

    it('should initialize queues and tables', () => {
      return projectService.setServices(services).then(data => {
        assert.deepEqual(services.queueService.queues, []);
        assert.deepEqual(services.tableService.tables, ['projects']);
      });

    });

  });

  describe('#getNextTask()', () => {

    it('should decode queue message', () => {

      return projectService.setServices(services).then(data => {
        return projectService.getNextTask("someprojectid").then(task => {
          assert.deepEqual(task, {
            taskId: 'someprojectid.someimageid.somemessageid.somereceipt',
            projectId: 'someprojectid',
            messageId: 'somemessageid',
            imageURL: "https://example.com/someprojectid/someimageid",
            instructionsText: "Do something.",
            instructionsImageURL: "https://example.com/someprojectid/instructionsimageid",
            instructionsVideoURL: undefined,
            labels: [],
            popReceipt: "somereceipt",
            taskType: "CLASSIFICATION"
          });
        });
      });
    });

  });

  describe('#submitImageTags()', () => {

    it('should store image tag and remove queue message.', () => {
      const taskId = "projectId.someImageId.sampleMessageId.samplePopReceipt";
      const tags = [
        {
          label: 'guitar-neck',
          boundingBox: {
            x: 50,
            y: 10,
            width: 20,
            height: 30
          }
        },
        {
          label: 'guitar-body',
          boundingBox: {
            x: 20,
            y: 90,
            width: 70,
            height: 100
          }
        }
      ];

      const createdContributions = [];
      services.imageService.createImageTagContribution = function (imageId, tags) {
        const contribution = {
          imageId: imageId,
          tags: tags
        };
        createdContributions.push(contribution);
        return Promise.resolve(contribution);
      };

      return projectService.setServices(services).then(config => {
        return projectService.submitImageTags(taskId, tags).then(result => {
          assert.deepEqual(createdContributions, [{ imageId: "someImageId", tags: tags }]);
          assert.deepEqual(services.queueService.deletedMessages, [{ messageId: "sampleMessageId", popReceipt: "samplePopReceipt" }]);
          return result;
        });
      });

    });

  });

});
