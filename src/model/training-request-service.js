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

TrainingRequestService.prototype.generateCSV = function (projectId) {
    return this.trainingImageService.getReadyForTraining(projectId).then(images => {
        return images.map(image => {
            return image.annotations.map(annotation => {
                const boundingBox = annotation.boundingBox;
                if (boundingBox) {
                    // This means the annotation is for an object detection project.
                    return `${image.url},${Math.round(boundingBox.x)},${Math.round(boundingBox.y)},${Math.round(boundingBox.width)},${Math.round(boundingBox.height)},${annotation.label}`;
                } else {
                    // This means the annotation is for an image classification project.
                    return `${image.url},${annotation.label}`;
                }
            }).join('\n');
        }).join('\n');
    });
}

TrainingRequestService.prototype.create = function (projectId) {
    return this.generateCSV(projectId).then(csvText => {
        const entity = viewModelTransform(projectId);
        const requestId = entity.RowKey._;
        const containerName = this.projectService.getModelContainerName(projectId);
        const blobName = this.getCsvBlobName(projectId, requestId);
        storageFoundation.createBlockBlobFromText(this.blobService, containerName, blobName, csvText).then(result => {
            const queueName = this.projectService.getTrainQueueName(projectId);
            const url = storageFoundation.createSAS(
                this.blobService,
                containerName,
                blobName,
                60 * 24 * 7,
                azureStorage.BlobUtilities.SharedAccessPermissions.READ
            ).url;
            const queueMessage = JSON.stringify({
                projectId: projectId,
                requestId: requestId,
                url: url
            });
            return storageFoundation.createMessage(this.queueService, queueName, queueMessage).then(result => {
                return storageFoundation.insertEntity(this.tableService, this.trainingRequestsTableName, entity);
            });
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
