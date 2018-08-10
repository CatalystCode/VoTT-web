const async = require('async');
const azureStorage = require('azure-storage');
const uuid = require('uuid/v4');

const storageFoundation = require('../foundation/storage');

function AccessRightsService(tableService) {
    this.tableService = tableService;

    this.userTableName = 'Users';
    this.accessRightsByProjectTableName = 'AccessRightsByProject';
    this.ensureTablesExist();
}

AccessRightsService.prototype.ensureTablesExist = function () {
    return new Promise((resolve, reject) => {
        async.series(
            [
                (callback) => { this.tableService.createTableIfNotExists(this.userTableName, callback); },
                (callback) => { this.tableService.createTableIfNotExists(this.accessRightsByProjectTableName, callback); }
            ],
            (error, results) => {
                if (error) return reject(error);
                resolve(results);
            }
        );
    });
}

AccessRightsService.prototype.list = function (projectId) {
    const tableQuery = new azureStorage.TableQuery().where('PartitionKey == ?', projectId);
    return storageFoundation.queryEntities(this.tableService, this.accessRightsByProjectTableName, tableQuery).then(result => {
        return result.entries.map(entity => {
            return this.mapEntityToAccessRight(entity);
        });
    });
}

AccessRightsService.prototype.create = function (projectId, record) {
    const entityByProject = mapAccessRightToEntity(projectId, record);
    return storageFoundation.insertEntity(this.tableService, this.accessRightsByProjectTableName, entityByProject);
}

AccessRightsService.prototype.read = function (projectId, userId) {
    if (!projectId) {
        projectId = 'root';
    }
    return storageFoundation.retrieveEntity(this.tableService, this.accessRightsByProjectTableName, projectId, userId).then(entity => {
        return this.mapEntityToAccessRight(entity);
    });
}

AccessRightsService.prototype.upsertUser = function (user) {
    return new Promise((resolve, reject) => {
        const entity = mapUserToEntity(user);
        this.tableService.insertEntity(this.userTableName, entity, (error, result, response) => {
            if (error) {
                return reject(error);
            }
            return resolve(user);
        });
    });
}

AccessRightsService.prototype.delete = function (projectId, userId) {
    const generator = azureStorage.TableUtilities.entityGenerator;
    const entity = {
        PartitionKey: generator.String(projectId),
        RowKey: generator.String(userId)
    };
    return storageFoundation.deleteEntity(this.tableService, this.accessRightsByProjectTableName, entity);
}

AccessRightsService.prototype.mapEntityToAccessRight = function (rightEntity) {
    const userId = rightEntity.RowKey._;
    const projectId = rightEntity.PartitionKey._;
    return {
        id: userId,
        projectId: projectId,
        role: rightEntity.role._,
        user: {
            userId: userId,
            name: (rightEntity.name) ? rightEntity.name._ : null,
            email: rightEntity.email._
        }
    };
}

function mapAccessRightToEntity(projectId, right) {
    const generator = azureStorage.TableUtilities.entityGenerator;
    return {
        PartitionKey: generator.String(projectId),
        RowKey: generator.String(right.userId),
        email: generator.String(right.email),
        role: generator.String(right.role)
    };
}

/**
 * Github replies with something like:
 * {
 *   "id":"1117904",
 *   "displayName":"Juan Carlos Jimenez",
 *   "username":"jcjimenez",
 *   "provider":"github",
 *   ...
 * }
 * @param {*} user representing Github user interpreted by passport.
 */
function mapUserToEntity(user) {
    const generator = azureStorage.TableUtilities.entityGenerator;
    return {
        PartitionKey: generator.String(user.provider),
        RowKey: generator.String(user.username),
        name: generator.String(user.displayName)
    };
}

function mapEntityToUser(user) {
    return {
        provider: rightEntity.RowKey._,
        username: rightEntity.PartitionKey._,
        displayName: rightEntity.displayName._
    };
}

module.exports = AccessRightsService;
