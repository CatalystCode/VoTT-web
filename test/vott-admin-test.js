const assert = require('assert');
const projectController = require('../src/vott-admin');

describe('Project graphql controller', () => {

  describe('#setServices()', () => {

    it('should initialize queues and tables', () => {

      const createdQueues = [];
      const createdTables = [];
      return projectController.setServices({
        queueService: {
          createQueueIfNotExists: (queueName, callback) => {
            createdQueues.push(queueName);
            callback();
          }
        },
        tableService: {
          createTableIfNotExists: (tableName, callback) => {
            createdTables.push(tableName);
            callback();
          }
        }
      }).then(data => {
        assert.deepEqual(createdQueues, [ ]);
        assert.deepEqual(createdTables, [ 'images', 'projects' ]);
      });

    });

  });

  describe("#getImageContainerName()", () => {

    it('should end with -images', () => {
      const projectId = 'someProjectId';
      const containerName = projectController.getImageContainerName(projectId);
      assert.equal(containerName, `${projectId}-images`);
    });

  });

  describe('#getImageURL()', () => {

    it('should use the images container', () => {
      const projectId = 'someProjectId';
      const modelId = 'someImageId';
      projectController.setServices({
        blobService: {
          getUrl: (containerName, blobName)=>{
            return `https://somestorageaccount.blob.core.windows.net/${containerName}/${blobName}`;
          }
        }
      });
      const imageURL = projectController.getImageURL(projectId, modelId);
      assert.equal(imageURL, 'https://somestorageaccount.blob.core.windows.net/someProjectId-images/someImageId');
    });

  });

});
