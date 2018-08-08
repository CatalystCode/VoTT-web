const async = require('async');
const azureStorage = require('azure-storage');
const uuid = require('uuid/v4');

const storageFoundation = require('../foundation/storage');

function TrainingImageService(blobService, tableService, queueService, projectService) {
    this.blobService = blobService;
    this.tableService = tableService;
    this.queueService = queueService;
    this.projectService = projectService;

    // TODO: Ensure blob containers and tables are present.
    this.trainingImagesTableName = 'TrainingImages';
    this.ensureTablesExist();
}

TrainingImageService.prototype.ensureTablesExist = function () {
    return new Promise((resolve, reject) => {
        this.tableService.createTableIfNotExists(this.trainingImagesTableName, (error, result) => {
            if (error) {
                return reject(error);
            }
            return resolve(result);
        });
    });
}

TrainingImageService.prototype.list = function (projectId, currentToken, requestedLimit) {
    return new Promise((resolve, reject) => {
        const limit = requestedLimit ? parseInt(requestedLimit) : 128;
        const tableQuery = new azureStorage.TableQuery().top(limit).where('PartitionKey == ?', projectId);
        this.tableService.queryEntities(this.trainingImagesTableName, tableQuery, currentToken, (error, result) => {
            if (error) {
                return reject(error);
            }
            const records = result.entries.map(entity => {
                return this.mapEntityToImage(entity);
            });
            return resolve({
                currentToken: result.continuationToken,
                limit: limit,
                entries: records
            });
        });
    });
}

TrainingImageService.prototype.count = function (projectId, status) {
    return new Promise((resolve, reject) => {
        const tableQuery = new azureStorage.TableQuery().select('PrimaryKey').where('PartitionKey == ? and status == ?', projectId, status);
        this.tableService.queryEntities(this.trainingImagesTableName, tableQuery, null /*paginationToken*/, (error, result) => {
            if (error) {
                return reject(error);
            }
            return resolve(result.entries.length);
        });
    });
}

TrainingImageService.prototype.allocate = function (image) {
    const projectId = image.projectId;
    const containerName = this.projectService.getTrainingImageContainerName(projectId);
    return new Promise((resolve, reject) => {
        const sas = storageFoundation.createSAS(this.blobService, containerName);
        return resolve(Object.assign({ projectId: projectId }, sas));
    });
}

TrainingImageService.prototype.create = function (image) {
    return new Promise((resolve, reject) => {
        const pk = image.id;
        const projectId = image.projectId;
        const record = {
            id: pk,
            projectId: projectId,
            status: 'tag-pending'
        };

        const entity = mapImageToEntity(record);
        this.tableService.insertEntity(this.trainingImagesTableName, entity, (error, result, response) => {
            if (error) {
                return reject(error);
            }
            return resolve(record);
        });
    });
}

TrainingImageService.prototype.read = function (projectId) {
}

TrainingImageService.prototype.delete = function (projectId) {
    return new Promise((resolve, reject) => {
        const task = {
            PartitionKey: { '_': projectId },
            RowKey: { '_': projectId }
        };
        this.tableService.deleteEntity(this.projectTableName, task, (error, result, response) => {
            if (error) {
                return reject(error);
            }
            return resolve();
        });
    });
}

TrainingImageService.prototype.getImageURL = function (projectId, imageId) {
    // TODO: Consider using an SAS token.
    const containerName = this.projectService.getTrainingImageContainerName(projectId);
    const url = this.blobService.getUrl(containerName, imageId);
    return url;
}

TrainingImageService.prototype.mapEntityToImage = function (entity) {
    const imageId = entity.RowKey._;
    const projectId = entity.PartitionKey._;
    return {
        id: imageId,
        projectId: projectId,
        status: entity.status._,
        url: this.getImageURL(projectId, imageId)
    };
}

function mapImageToEntity(image) {
    const generator = azureStorage.TableUtilities.entityGenerator;
    return {
        PartitionKey: generator.String(image.projectId),
        RowKey: generator.String(image.id),
        status: image.status
    };
}

module.exports = {
    TrainingImageService: TrainingImageService
};
