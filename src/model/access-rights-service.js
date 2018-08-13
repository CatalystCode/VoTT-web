const async = require('async');
const azureStorage = require('azure-storage');
const uuid = require('uuid/v4');

const storageFoundation = require('../foundation/storage');

const AccessRightsRole = Object.freeze({
    PROJECT_MANAGER: 'project-manager',
    PROJECT_COLLABORATOR: 'project-collaborator'
});

function AccessRightsService(tableService) {
    this.tableService = tableService;

    this.userTableName = 'Users';
    this.accessRightsByUserTableName = 'AccessRightsByUser';
    this.accessRightsByProjectTableName = 'AccessRightsByProject';
    this.prepare();
}

AccessRightsService.prototype.prepare = async function () {
    await this.ensureTablesExist();
    await this.ensureAdminUserAccessRights();
}

AccessRightsService.prototype.ensureTablesExist = function () {
    return Promise.all([
        storageFoundation.createTableIfNotExists(this.tableService, this.userTableName),
        storageFoundation.createTableIfNotExists(this.tableService, this.accessRightsByUserTableName),
        storageFoundation.createTableIfNotExists(this.tableService, this.accessRightsByProjectTableName)
    ]);
}

AccessRightsService.prototype.ensureAdminUserAccessRights = function () {
    const userId = process.env.VOTT_DEFAULT_ADMIN_GITHUB_USER;
    if (!userId) {
        return Promise.resolve();
    }

    return this.create('root', {
        userId: userId.toLowerCase(),
        name: process.env.VOTT_DEFAULT_ADMIN_NAME,
        email: process.env.VOTT_DEFAULT_ADMIN_EMAIL,
        role: AccessRightsRole.PROJECT_MANAGER
    }).catch(error => {
        if (error.statusCode && error.statusCode == 409) {
            console.log("Admin user access rights already present.");
            return;
        }
        return error;
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
    const entityByProject = mapProjectAccessRightToEntity(projectId, record);
    const entityByUser = mapUserAccessRightToEntity(projectId, record);
    return Promise.all([
        storageFoundation.insertEntity(this.tableService, this.accessRightsByProjectTableName, entityByProject),
        storageFoundation.insertEntity(this.tableService, this.accessRightsByUserTableName, entityByUser)
    ]);
}

AccessRightsService.prototype.read = function (projectId, userId) {
    if (!projectId) {
        projectId = 'root';
    }
    return storageFoundation.retrieveEntity(this.tableService, this.accessRightsByProjectTableName, projectId, userId.toLowerCase()).then(entity => {
        return this.mapEntityToAccessRight(entity);
    });
}

AccessRightsService.prototype.isRegistered = function (userId) {
    const tableQuery = new azureStorage.TableQuery().top(1).where('PartitionKey == ?', userId.toLowerCase());
    return storageFoundation.queryEntities(this.tableService, this.accessRightsByUserTableName, tableQuery).then(result => {
        return result.entries.length > 0;
    });
}

AccessRightsService.prototype.upsertUser = function (user) {
    const entity = mapUserToEntity(user);
    return storageFoundation.insertEntity(this.tableService, this.userTableName, entity).then(result => {
        return user;
    }).catch(error => {
        if (error.statusCode && error.statusCode == 409) {
            console.log("Admin user access rights already present.");
            return user;
        }
        return error;
    });
}

AccessRightsService.prototype.delete = function (projectId, userId) {
    const generator = azureStorage.TableUtilities.entityGenerator;
    const projectEntity = {
        PartitionKey: generator.String(projectId),
        RowKey: generator.String(userId.toLowerCase())
    };
    const userEntity = {
        PartitionKey: generator.String(userId.toLowerCase()),
        RowKey: generator.String(projectId)
    };
    return Promise.all([
        storageFoundation.deleteEntity(this.tableService, this.accessRightsByProjectTableName, projectEntity),
        storageFoundation.deleteEntity(this.tableService, this.accessRightsByUserTableName, userEntity)
    ]);
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

function mapProjectAccessRightToEntity(projectId, right) {
    const generator = azureStorage.TableUtilities.entityGenerator;
    return {
        PartitionKey: generator.String(projectId),
        RowKey: generator.String(right.userId.toLowerCase()),
        email: generator.String(right.email),
        role: generator.String(right.role)
    };
}

function mapUserAccessRightToEntity(projectId, right) {
    const generator = azureStorage.TableUtilities.entityGenerator;
    return {
        PartitionKey: generator.String(right.userId.toLowerCase()),
        RowKey: generator.String(projectId),
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
        RowKey: generator.String(user.username.toLowerCase()),
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
