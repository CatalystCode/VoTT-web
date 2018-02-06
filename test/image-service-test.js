const assert = require('assert');
const mock = require('./mock-services');
const is = require('../src/image-service');

describe('Image Service', () => {

  let imageService = null;
  let services = null;

  beforeEach(() => {
    imageService = is.createImageService();
    services = mock.createMockServices();
  });

  describe('#setServices()', () => {

    it('should initialize queues and tables', () => {

      return imageService.setServices(services).then(data => {
        assert.deepEqual(services.queueService.queues, []);
        assert.deepEqual(services.tableService.tables, ['images', "imagetagcontributions"]);
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
      return imageService.setServices(services).then(data => {
        const imageURL = imageService.getImageURL(projectId, modelId);
        assert.equal(imageURL, 'https://somestorageaccount.blob.core.windows.net/someProjectId-images/someImageId');
      });
    });

  });

  describe('#createImageTagContribution()', () => {
    it('should insert entity and return mapped object.', () => {
      const tags = [
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
      return imageService.setServices(services).then(data => {
        return imageService.createImageTagContribution("someimageid", tags).then(record => {
          assert.deepEqual(record.imageId, "someimageid");
          assert.deepEqual(record.tags, tags);
          return record;
        });
      });
    });
  });

  describe('#countTrainingImagesByStatus()', () => {

    it('should group each record by status', () => {
      const records = [
        { status: { _: is.trainingImageStates.TAG_PENDING } },
        { status: { _: is.trainingImageStates.TAG_PENDING } },
        { status: { _: is.trainingImageStates.TAG_PENDING } },
        { status: { _: is.trainingImageStates.TAG_PENDING } },
        { status: { _: is.trainingImageStates.READY_FOR_TRAINING } },
        { status: { _: is.trainingImageStates.READY_FOR_TRAINING } },
        { status: { _: is.trainingImageStates.READY_FOR_TRAINING } },
        { status: { _: is.trainingImageStates.IN_CONFLICT } },
        { status: { _: is.trainingImageStates.IN_CONFLICT } },
      ];

      services.tableService.queryEntities = (tableName, query, paginationToken, callback) => {
        return callback(null, { entries: records });
      };

      return imageService.setServices(services).then(result => {
        return imageService.countTrainingImagesByStatus('someprojectid').then(counts => {
          assert.deepEqual(counts, {
            TAG_PENDING: 4,
            READY_FOR_TRAINING: 3,
            IN_CONFLICT: 2,
            TOTAL: 9
          });
        });
      });

    });

  });

  describe('#updateTrainingImageWithTagContributions()', () => {

    it('should update images record stats with two object detection contributions in agreement', () => {
      const contributions = [
        {
          PartitionKey: { _: 'someImageId' },
          RowKey: { _: 'contribution00' },
          tags: {
            _: JSON.stringify([{
              label: 'guitar-body',
              boundingBox: { x: 20, y: 90, width: 70, height: 100 }
            }])
          }
        },
        {
          PartitionKey: { _: 'someImageId' },
          RowKey: { _: 'contribution01' },
          tags: {
            _: JSON.stringify([{
              label: 'guitar-body',
              boundingBox: { x: 21, y: 88, width: 72, height: 99 }
            }])
          }
        }
      ];

      services.tableService.queryEntities = (tableName, query, paginationToken, callback) => {
        if (tableName == 'imagetagcontributions') {
          return callback(null, { entries: contributions });
        }

        return callback("Missing query support.", null);
      };

      return imageService.setServices(services).then(data => {
        return imageService.updateTrainingImageWithTagContributions('someProjectId', 'someImageId').then(result => {
          assert.deepEqual(
            services.tableService.mergedRecords,
            [{
              tableName: 'images',
              entityDescriptor: {
                PartitionKey: 'someProjectId',
                RowKey: 'someImageId',
                status: 'READY_FOR_TRAINING',
                tags: '[{"label":"guitar-body","boundingBox":{"x":21,"y":88,"width":72,"height":99}},{"label":"guitar-body","boundingBox":{"x":20,"y":90,"width":70,"height":100}}]'
              }
            }]
          );
        });
      });
    });

    it('should update images record stats with two object detection contributions in conflict', () => {
      const contributions = [
        {
          PartitionKey: { _: 'someImageId' },
          RowKey: { _: 'contribution00' },
          tags: {
            _: JSON.stringify([{
              label: 'guitar-body',
              boundingBox: { x: 20, y: 90, width: 70, height: 100 }
            }])
          }
        },
        {
          PartitionKey: { _: 'someImageId' },
          RowKey: { _: 'contribution01' },
          tags: {
            _: JSON.stringify([{
              label: 'guitar-body',
              boundingBox: { x: 21, y: 88, width: 30, height: 40 }
            }])
          }
        }
      ];

      services.tableService.queryEntities = (tableName, query, paginationToken, callback) => {
        if (tableName == 'imagetagcontributions') {
          return callback(null, { entries: contributions });
        }

        return callback("Missing query support.", null);
      };

      return imageService.setServices(services).then(data => {
        return imageService.updateTrainingImageWithTagContributions('someProjectId', 'someImageId').then(result => {
          assert.deepEqual(
            services.tableService.mergedRecords,
            [{
              tableName: 'images',
              entityDescriptor: {
                PartitionKey: 'someProjectId',
                RowKey: 'someImageId',
                status: 'IN_CONFLICT',
                tags: '[]'
              }
            }]
          );
        });
      });
    });



    it('should update images record stats with three object detection contributions with a tie-breaker', () => {
      const contributions = [
        {
          PartitionKey: { _: 'someImageId' },
          RowKey: { _: 'contribution00' },
          tags: {
            _: JSON.stringify([{
              label: 'guitar-body',
              boundingBox: { x: 20, y: 90, width: 70, height: 100 }
            }])
          }
        },
        {
          PartitionKey: { _: 'someImageId' },
          RowKey: { _: 'contribution01' },
          tags: {
            _: JSON.stringify([{
              label: 'guitar-body',
              boundingBox: { x: 22, y: 89, width: 30, height: 40 }
            }])
          }
        }, {
          PartitionKey: { _: 'someImageId' },
          RowKey: { _: 'contribution02' },
          tags: {
            _: JSON.stringify([{
              label: 'guitar-body',
              boundingBox: { x: 21, y: 88, width: 72, height: 99 }
            }])
          }
        }
      ];

      services.tableService.queryEntities = (tableName, query, paginationToken, callback) => {
        if (tableName == 'imagetagcontributions') {
          return callback(null, { entries: contributions });
        }

        return callback("Missing query support.", null);
      };

      return imageService.setServices(services).then(data => {
        return imageService.updateTrainingImageWithTagContributions('someProjectId', 'someImageId').then(result => {
          assert.deepEqual(
            services.tableService.mergedRecords,
            [{
              tableName: 'images',
              entityDescriptor: {
                PartitionKey: 'someProjectId',
                RowKey: 'someImageId',
                status: 'READY_FOR_TRAINING',
                tags: '[{"label":"guitar-body","boundingBox":{"x":21,"y":88,"width":72,"height":99}},{"label":"guitar-body","boundingBox":{"x":20,"y":90,"width":70,"height":100}}]'
              }
            }]
          );
        });
      });
    });



    it('should update images record stats with three object detection contributions in disagreement', () => {
      const contributions = [
        {
          PartitionKey: { _: 'someImageId' },
          RowKey: { _: 'contribution00' },
          tags: {
            _: JSON.stringify([{
              label: 'guitar-body',
              boundingBox: { x: 20, y: 90, width: 70, height: 100 }
            }])
          }
        },
        {
          PartitionKey: { _: 'someImageId' },
          RowKey: { _: 'contribution01' },
          tags: {
            _: JSON.stringify([{
              label: 'guitar-body',
              boundingBox: { x: 22, y: 89, width: 30, height: 40 }
            }])
          }
        }, {
          PartitionKey: { _: 'someImageId' },
          RowKey: { _: 'contribution02' },
          tags: {
            _: JSON.stringify([{
              label: 'guitar-body',
              boundingBox: { x: 0, y: 0, width: 72, height: 99 }
            }])
          }
        }
      ];

      services.tableService.queryEntities = (tableName, query, paginationToken, callback) => {
        if (tableName == 'imagetagcontributions') {
          return callback(null, { entries: contributions });
        }

        return callback("Missing query support.", null);
      };

      return imageService.setServices(services).then(data => {
        return imageService.updateTrainingImageWithTagContributions('someProjectId', 'someImageId').then(result => {
          assert.deepEqual(
            services.tableService.mergedRecords,
            [{
              tableName: 'images',
              entityDescriptor: {
                PartitionKey: 'someProjectId',
                RowKey: 'someImageId',
                status: 'IN_CONFLICT',
                tags: '[]'
              }
            }]
          );
        });
      });
    });



  });

});
