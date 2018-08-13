const azureStorage = require('azure-storage');
const uuid = require('uuid/v4');

const storageFoundation = require('../foundation/storage');

function TrainingRequestService(blobService, tableService, queueService, projectService, trainingImageService) {
    this.blobService = blobService;
    this.tableService = tableService;
    this.queueService = queueService;
    this.projectService = projectService;
    this.trainingImageService = trainingImageService;

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
    const entity = viewModelTransform(projectId);
    return this.trainingImageService.getReadyForTraining(projectId).then(images => {
        // TODO: Create the CSV.
        // TODO: Upload the CSV.
        const containerName = this.projectService.getModelContainerName(projectId);
        const blobName = this.getCsvBlobName(projectId, entity.RowKey._);
        const csvText = 'sample,content,here,only'
        storageFoundation.createBlockBlobFromText(this.blobService, containerName, blobName, csvText).then(result => {
            // TODO: Create the queue entry.
            return storageFoundation.insertEntity(this.tableService, this.trainingRequestsTableName, entity);
        });
    });
}

TrainingRequestService.prototype.delete = function (projectId, requestId) {
    const generator = azureStorage.TableUtilities.entityGenerator;
    const entity = {
        PartitionKey: generator.String(projectId),
        RowKey: generator.String(requestId)
    };
    return storageFoundation.deleteEntity(this.tableService, this.trainingRequestsTableName, entity);
}

TrainingRequestService.prototype.export = function (projectId, requestId) {
    return storageFoundation.retrieveEntity(this.tableService, this.trainingRequestsTableName, projectId, requestId).then(entity => {
        const containerName = this.projectService.getModelContainerName(projectId);
        const blobName = this.getCsvBlobName(projectId, requestId);
        const sas = storageFoundation.createSAS(
            this.blobService,
            containerName,
            blobName,
            null,
            azureStorage.BlobUtilities.SharedAccessPermissions.READ
        );
        return sas.url;
    });
}

TrainingRequestService.prototype.getCsvBlobName = function (projectId, requestId) {
    return `${requestId}.csv`;
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
        status: (entity.status) ? entity.status._ : 'pending',
        requestedBy: null,
        url: ''
    };
}

/**
        id: uuid(),
        status: 'pending',
        project: project,
        requestedBy: user
 * @param {*} projectId 
 */
function viewModelTransform(projectId) {
    const generator = azureStorage.TableUtilities.entityGenerator;
    return {
        PartitionKey: generator.String(projectId),
        RowKey: generator.String(uuid()),
        status: 'pending',
        requestedBy: null,
    };
}


module.exports = TrainingRequestService;
