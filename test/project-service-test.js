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
        taskType: "CLASSIFICATION" ,
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

});
