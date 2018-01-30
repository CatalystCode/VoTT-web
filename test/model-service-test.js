const assert = require('assert');
const modelService = require('../src/model-service');

function mockServices() {
  const queues = [];
  const queueMessages = [];
  const tables = [];
  const inserts = [];
  const queries = [];
  return {
    queueService: {
      queues: queues,
      createQueueIfNotExists: (queueName, callback) => {
        queues.push(queueName);
        callback();
      },
      queueMessages: queueMessages,
      createMessage: (queueName, message, callback) => {
        queueMessages.push({ queueName: queueName, message: message });
        callback();
      }
    },
    tableService: {
      tables: tables,
      createTableIfNotExists: (tableName, callback) => {
        tables.push(tableName);
        callback();
      },
      inserts: inserts,
      insertEntity: (tableName, record, callback) => {
        inserts.push({ tableName: tableName, record: record });
        callback();
      },
      queries: queries,
      queryEntities: (tableName, query, nextPageToken, callback) => {
        queries.push({ tableName: tableName, query: query, nextPageToken: nextPageToken });
        callback(null, { entries: [] });
      }
    }
  };
};

describe('Model Service', () => {

  describe('#setServices()', () => {

    it('should initialize queues and tables', () => {

      const createdQueues = [];
      const createdTables = [];
      return modelService.setServices({
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
        assert.deepEqual(createdQueues, ['training']);
        assert.deepEqual(createdTables, ['models']);
      });

    });

  });

  describe("#getModelContainerName()", () => {

    it('should end with -models', () => {
      const projectId = 'someProjectId';
      const containerName = modelService.getModelContainerName(projectId);
      assert.equal(containerName, `${projectId}-models`);
    });

  });

  describe('#getModelURL()', () => {

    it('should use the models container', () => {
      const projectId = 'someProjectId';
      const modelId = 'someModelId';
      modelService.setServices({
        blobService: {
          getUrl: (containerName, blobName) => {
            return `https://somestorageaccount.blob.core.windows.net/${containerName}/${blobName}`;
          }
        }
      });
      const modelURL = modelService.getModelURL(projectId, modelId);
      assert.equal(modelURL, 'https://somestorageaccount.blob.core.windows.net/someProjectId-models/someModelId');
    });

  });

  describe('#createModel()', () => {

    it('should create record and container', () => {
      const projectId = 'someProjectId';

      const services = mockServices();
      modelService.setServices(services);

      return modelService.createModel(projectId).then((model) => {
        if (!model.modelId) {
          assert.fail(`Expecting value for model.modelId: ${JSON.stringify(model)}`);
        }
        assert.equal(projectId, model.projectId);
        assert.equal('TRAINING_PENDING', model.status);

        const inserts = services.tableService.inserts;
        assert.equal(inserts.length, 1);

        const singleInsert = inserts[0];
        assert.equal('models', singleInsert.tableName);
        assert.equal(model.modelId, singleInsert.record.RowKey);
        assert.equal(model.projectId, singleInsert.record.PartitionKey);
        assert.equal(model.status, singleInsert.record.status);
      });

    });

  });

  describe("#readModels()", () => {

    it('should handle empty query results.', () => {
      const services = mockServices();
      modelService.setServices(services);

      const projectId = 'someProjectId';
      return modelService.readModels(projectId, null).then((results) => {
        assert.equal(results.entries.length, 0);
        assert.equal(results.nextPageToken, null);

        assert.equal(services.tableService.queries.length, 1);
        assert.equal(services.tableService.queries[0].tableName, "models");
        assert.equal(services.tableService.queries[0].nextPageToken, null);
      });
    });

    it('should transform database results.', () => {
      const projectId = 'someProjectId';
      const modelId = 'someModelId';
      const timestamp = new Date();
      const status = 'someStatus';
      const services = mockServices();
      services.tableService.queryEntities = (tableName, query, nextPageToken, callback) => {
        callback(null, {
          continuationToken: 'someToken',
          entries: [
            {
              PartitionKey: { _: projectId },
              RowKey: { _: modelId },
              Timestamp: { _: timestamp },
              status: { _: status }
            }
          ]
        });
      }
      modelService.setServices(services);

      return modelService.readModels(projectId, null).then((results) => {
        assert.equal(results.nextPageToken, JSON.stringify('someToken'));
        assert.equal(results.entries.length, 1);
        assert.deepEqual(results.entries[0], { projectId: projectId, modelId: modelId, created: timestamp, status: status });
      });
    });

  });

});
