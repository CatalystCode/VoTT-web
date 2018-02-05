module.exports = {
  createMockServices: function () {
    const queues = [];
    const queuedMessages = [];
    const deletedMessages = [];
    const tables = [];
    const inserts = [];
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
          callback("Not implemented.", null);
        },
        queryEntities: (tableName, query, nextPageToken, callback) => {
          queries.push({ tableName: tableName, query: query, nextPageToken: nextPageToken });
          callback(null, { entries: [] });
        }
      }
    };
  }
};
