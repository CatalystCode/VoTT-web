const assert = require('assert');
const mock = require('./mock-services');
const is = require('../src/image-service');

describe('Image Service', () => {

  let imageService = null;
  let services = null;

  beforeEach(()=>{
    imageService = is.createImageService();
    services = mock.createMockServices();
  });

  describe('#setServices()', () => {

    it('should initialize queues and tables', () => {

      return imageService.setServices(services).then(data => {
        assert.deepEqual(services.queueService.queues, [ ]);
        assert.deepEqual(services.tableService.tables, [ 'images', "imagetags" ]);
      });

    });

  });

  describe("#getImageContainerName()", () => {

    it('should end with -images', () => {
      const projectId = 'someProjectId';
      const containerName = imageService.getImageContainerName(projectId);
      assert.equal(containerName, `${projectId}-images`);
    });

  });

  describe('#getImageURL()', () => {

    it('should use the images container', () => {
      const projectId = 'someProjectId';
      const modelId = 'someImageId';
      return imageService.setServices(services).then(data=>{
        const imageURL = imageService.getImageURL(projectId, modelId);
        assert.equal(imageURL, 'https://somestorageaccount.blob.core.windows.net/someProjectId-images/someImageId');  
      });
    });

  });

});
