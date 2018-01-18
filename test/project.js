const assert = require('assert');
const projectController = require('../src/project');

describe('Project graphql controller', () => {

  describe('#setServices()', () => {

    it('should initialize tables', () => {

      const createdTables = [];
      return projectController.setServices({
        tableService: {
          createTableIfNotExists: (tableName, callback) => {
            createdTables.push(tableName);
            callback();
          }
        }
      }).then(data => {
        assert.deepEqual(createdTables, ['images', 'projects']);
      });

    });

  });

  describe("#getImageContainerName()", () => {

    it('should end with .images', () => {
      const projectId = 'someProjectId';
      const containerName = projectController.getImageContainerName(projectId);
      assert.equal(containerName, projectId);
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
      assert.equal(imageURL, 'https://somestorageaccount.blob.core.windows.net/someProjectId/someImageId');
    });

  });

  describe("#getModelContainerName()", () => {

    it('should end with .models', () => {
      const projectId = 'someProjectId';
      const containerName = projectController.getModelContainerName(projectId);
      assert.equal(containerName, `${projectId}.models`);
    });

  });

  describe('#getModelURL()', () => {

    it('should use the models container', () => {
      const projectId = 'someProjectId';
      const modelId = 'someModelId';
      projectController.setServices({
        blobService: {
          getUrl: (containerName, blobName)=>{
            return `https://somestorageaccount.blob.core.windows.net/${containerName}/${blobName}`;
          }
        }
      });
      const modelURL = projectController.getModelURL(projectId, modelId);
      assert.equal(modelURL, 'https://somestorageaccount.blob.core.windows.net/someProjectId.models/someModelId');
    });

  });

});
