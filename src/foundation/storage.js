const azureStorage = require('azure-storage');
const uuid = require('uuid/v4');

module.exports = {
    createSAS: function (blobService, containerName, blobName, durationInMinutes, permissions) {
        const startDate = new Date();
        const expiryDate = new Date(startDate);
        const expiryMinutes = startDate.getMinutes() + (durationInMinutes ? durationInMinutes : 10);
        expiryDate.setMinutes(expiryMinutes);

        const BlobUtilities = azureStorage.BlobUtilities;
        const sharedAccessPolicy = {
            AccessPolicy: {
                Permissions: (permissions ? permissions : BlobUtilities.SharedAccessPermissions.WRITE),
                Start: startDate,
                Expiry: expiryDate
            }
        };

        if (!blobName) {
            blobName = uuid();
        }

        const signature = blobService.generateSharedAccessSignature(
            containerName,
            blobName,
            sharedAccessPolicy
        );
        const url = blobService.getUrl(containerName, blobName, signature);
        return {
            url: url,
            id: blobName,
        }
    },
    createContainerIfNotExists: function (blobService, containerName, options) {
        return new Promise((resolve, reject) => {
            blobService.createContainerIfNotExists(containerName, options, (error, result) => {
                if (error) {
                    return reject(error);
                }
                return resolve(result);
            });
        });
    },
    deleteContainer: function (blobService, containerName) {
        return new Promise((resolve, reject) => {
            blobService.deleteContainer(containerName, (error, result) => {
                if (error) {
                    return reject(error);
                }
                return resolve(result);
            });
        });
    },
    createBlockBlobFromText: function (blobService, containerName, blobName, content, options) {
        return new Promise((resolve, reject) => {
            blobService.createBlockBlobFromText(containerName, blobName, content, options, (error, result) => {
                if (error) {
                    return reject(error);
                }
                return resolve(result);
            });
        });
    },
    createTableIfNotExists: function (tableService, tableName) {
        return new Promise((resolve, reject) => {
            tableService.createTableIfNotExists(tableName, (error, result) => {
                if (error) {
                    return reject(error);
                }
                return resolve(result);
            });
        });
    },
    insertEntity: function (tableService, tableName, entity) {
        return new Promise((resolve, reject) => {
            tableService.insertEntity(tableName, entity, (error, result, response) => {
                if (error) {
                    return reject(error);
                }
                return resolve(result, response);
            });
        });
    },
    deleteEntity: function (tableService, tableName, entity) {
        return new Promise((resolve, reject) => {
            tableService.deleteEntity(tableName, entity, (error) => {
                if (error) {
                    return reject(error);
                }
                return resolve();
            });
        });
    },
    mergeEntity: function (tableService, tableName, entity) {
        return new Promise((resolve, reject) => {
            tableService.mergeEntity(tableName, entity, (error, result) => {
                if (error) {
                    return reject(error);
                }
                return resolve(result);
            });
        });
    },
    retrieveEntity: function (tableService, tableName, partitionKey, primaryKey) {
        return new Promise((resolve, reject) => {
            tableService.retrieveEntity(tableName, partitionKey, primaryKey, (error, entity) => {
                if (error) {
                    return reject(error);
                }
                return resolve(entity);
            });
        });
    },
    queryEntities: function (tableService, tableName, query, currentToken) {
        return new Promise((resolve, reject) => {
            tableService.queryEntities(tableName, query, currentToken, (error, result, response) => {
                if (error) {
                    return reject(error);
                }
                resolve(result, response);
            });
        });
    },
    createQueueIfNotExists: function (queueService, queueName) {
        return new Promise((resolve, reject) => {
            queueService.createQueueIfNotExists(queueName, (error) => {
                if (error) {
                    return reject(error);
                }
                resolve({});
            });
        });
    },
    deleteQueue: function (queueService, queueName) {
        return new Promise((resolve, reject) => {
            queueService.deleteQueue(queueName, (error) => {
                if (error) {
                    return reject(error);
                }
                resolve({});
            });
        });
    },
    createMessage: function (queueService, queueName, message) {
        return new Promise((resolve, reject) => {
            queueService.createMessage(queueName, message, (error) => {
                if (error) {
                    return reject(error);
                }
                resolve({});
            });
        });
    },
    getMessage: function (queueService, queueName) {
        return new Promise((resolve, reject) => {
            queueService.getMessage(queueName, (error, message) => {
                if (error) return reject(error);
                resolve(message);
            });
        });
    },
};
