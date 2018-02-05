module.exports = {
  createMockServices: function () {
    const queues = [];
    const queuedMessages = [];
    const deletedMessages = [];
    const tables = [];
    const inserts = [];
    const mergedRecords = [];
    const queries = [];
    return {
      blobService: {
        getUrl: (containerName, blobName) => {
          return `https://somestorageaccount.blob.core.windows.net/${containerName}/${blobName}`;
        }
      },
      queueService: {
        queues: queues,
        createQueueIfNotExists: (queueName, callback) => {
          queues.push(queueName);
          callback();
        },
        queueMessages: queuedMessages,
        createMessage: (queueName, message, callback) => {
          queuedMessages.push({ queueName: queueName, message: message });
          callback();
        },
        getMessage: (queueName, callback) => {
          callback("No messages", null);
        },
        deletedMessages: deletedMessages,
        deleteMessage: (queueName, messageId, popReceipt, callback) => {
          deletedMessages.push({ messageId: messageId, popReceipt: popReceipt });
          callback(null, "Deleted");
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
        retrieveEntity: (tableName, partitionKey, primaryKey, callback) => {
          queries.push({ tableName: tableName, query: { partitionKey: partitionKey, primaryKey: primaryKey } });
          callback(null, {
            PartitionKey: { _: partitionKey },
            RowKey: { _: primaryKey }
          });
        },
        queryEntities: (tableName, query, nextPageToken, callback) => {
          queries.push({ tableName: tableName, query: query, nextPageToken: nextPageToken });
          callback(null, { entries: [] });
        },
        mergedRecords: mergedRecords,
        mergeEntity: (tableName, entityDescriptor, callback) => {
          mergedRecords.push({tableName: tableName, entityDescriptor: entityDescriptor});
          callback(null, entityDescriptor);
        }
      }
    };
  }
};
