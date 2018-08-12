const azureStorage = require('azure-storage');
const uuid = require('uuid/v4');

const storageFoundation = require('../foundation/storage');

function TrainingRequestService(blobService, tableService, queueService) {
    this.blobService = blobService;
    this.tableService = tableService;
    this.queueService = queueService;

    this.trainingRequestsTableName = 'TrainingRequests';
    this.prepare();
}

TrainingRequestService.prototype.prepare = async function () {
    await this.ensureTablesExist();
}

TrainingRequestService.prototype.ensureTablesExist = function () {
    return Promise.all([
        storageFoundation.createTableIfNotExists(this.tableService, this.trainingRequestsTableName)
    ]);
}

TrainingRequestService.prototype.list = function (projectId, currentToken, requestedLimit) {
    const limit = requestedLimit ? parseInt(requestedLimit) : 128;
    const tableQuery = new azureStorage.TableQuery().top(limit).where('PartitionKey == ?', projectId);
    return storageFoundation.queryEntities(this.tableService, this.trainingRequestsTableName, tableQuery, currentToken).then(result => {
        const records = result.entries.map(entity => {
            return this.modelViewTransform(entity);
        });
        return {
            currentToken: result.continuationToken,
            limit: limit,
            entries: records
        };
    });
}

TrainingRequestService.prototype.create = function (projectId) {
    // TODO: Create the CSV.
    // TODO: Upload the CSV.
    // TODO: Create the queue entry.
    const entityByProject = viewModelTransform(projectId);
    return storageFoundation.insertEntity(this.tableService, this.trainingRequestsTableName, entityByProject);
}

TrainingRequestService.prototype.delete = function (projectId, requestId) {
    const generator = azureStorage.TableUtilities.entityGenerator;
    const entity = {
        PartitionKey: generator.String(projectId),
        RowKey: generator.String(requestId)
    };
    return storageFoundation.deleteEntity(this.tableService, this.trainingRequestsTableName, entity);
}

/**
 *         <th scope="row">{{request.id}}</th>
        <td>{{ request.createdAt }}</td>
        <td>{{ request.status }}</td>
 * @param {*} rightEntity 
 */
TrainingRequestService.prototype.modelViewTransform = function (entity) {
    return {
        projectId: entity.PartitionKey._,
        id: entity.RowKey._,
        createdAt: entity.Timestamp._,
        status: (entity.status) ? entity.status._ : 'queued',
        url : ''
    };
}

function viewModelTransform(projectId) {
    const generator = azureStorage.TableUtilities.entityGenerator;
    return {
        PartitionKey: generator.String(projectId),
        RowKey: generator.String(uuid()),
        status: 'queued'
    };
}


module.exports = TrainingRequestService;
