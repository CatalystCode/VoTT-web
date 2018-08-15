const async = require('async');
const azureStorage = require('azure-storage');
const uuid = require('uuid/v4');

const storageFoundation = require('../foundation/storage');

function ProjectService(blobService, tableService, queueService, accessRightsService) {
    this.blobService = blobService;
    this.tableService = tableService;
    this.queueService = queueService;
    this.accessRightsService = accessRightsService;

    this.projectTableName = 'Projects';
    this.prepare();
}

ProjectService.prototype.prepare = async function () {
    await this.ensureTablesExist();
}

ProjectService.prototype.ensureTablesExist = function () {
    return new Promise((resolve, reject) => {
        this.tableService.createTableIfNotExists(this.projectTableName, (error, result) => {
            if (error) {
                return reject(error);
            }
            return resolve(result);
        });
    });
}

ProjectService.prototype.list = function (paginationToken) {
    //TODO: Ensure user has access to each of the projects.
    return new Promise((resolve, reject) => {
        this.tableService.queryEntities(this.projectTableName, null, null, (error, result) => {
            if (error) {
                return reject(error);
            }
            // TODO: Map records
            return resolve(result.entries.map(mapEntityToProject));
        });
    });
}

ProjectService.prototype.create = function (project, owner) {
    const projectCopy = Object.assign({}, project);
    projectCopy.id = uuid();

    const taskQueueName = this.getTaskQueueName(projectCopy.id);
    const trainingImagesContainerName = this.getTrainingImageContainerName(projectCopy.id);
    const trainingQueueName = this.getTrainQueueName(projectCopy.id);
    const modelContainerName = this.getModelContainerName(projectCopy.id);

    const entity = mapProjectToEntity(projectCopy);
    return Promise.all([
        storageFoundation.createQueueIfNotExists(this.queueService, taskQueueName),
        storageFoundation.createQueueIfNotExists(this.queueService, trainingQueueName),
        storageFoundation.createContainerIfNotExists(this.blobService, trainingImagesContainerName, { publicAccessLevel: 'blob' }),
        storageFoundation.createContainerIfNotExists(this.blobService, modelContainerName, { publicAccessLevel: 'blob' }),
    ]).then(result => {
        return Promise.all([
            storageFoundation.insertEntity(this.tableService, this.projectTableName, entity),
            this.accessRightsService.create(projectCopy.id, owner, 'project-manager')
        ]).then(result => {
            return projectCopy;
        })
    });
}

ProjectService.prototype.read = function (projectId) {
    return new Promise((resolve, reject) => {
        this.tableService.retrieveEntity(this.projectTableName, projectId, projectId, (error, result, response) => {
            if (error) {
                return reject(error);
            }
            const record = mapEntityToProject(result);
            return resolve(record);
        });
    });
}

ProjectService.prototype.update = function (project) {
    return new Promise((resolve, reject) => {
        const task = mapProjectToEntity(project);
        this.tableService.replaceEntity(this.projectTableName, task, (error, result, response) => {
            if (error) {
                return reject(error);
            }
            return resolve();
        });
    });
}

ProjectService.prototype.delete = function (projectId) {
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

ProjectService.prototype.allocateInstructionsImage = function (projectId) {
    return new Promise((resolve, reject) => {
        const trainingImagesContainerName = this.getTrainingImageContainerName(projectId);
        const sas = storageFoundation.createSAS(this.blobService, trainingImagesContainerName);
        resolve({
            id: sas.id,
            url: sas.url
        });
    });
}

ProjectService.prototype.commitInstructionsImage = function (projectId, image) {
    return new Promise((resolve, reject) => {
        const entity = {
            PartitionKey: { '_': projectId },
            RowKey: { '_': projectId },
            instructionsImageId: { '_': image.id || image.instructionsImageId }
        };
        this.tableService.mergeEntity(this.projectTableName, entity, (error) => {
            if (error) {
                return reject(error);
            }
            return resolve();
        });
    });
}

ProjectService.prototype.getTrainingImageContainerName = function (projectId) {
    return `${projectId}-images`;
}

ProjectService.prototype.getTaskQueueName = function (projectId) {
    return `${projectId}-tasks`;
}

ProjectService.prototype.getModelContainerName = function (projectId) {
    return `${projectId}-models`;
}

ProjectService.prototype.getTrainQueueName = function (projectId) {
    return 'training';
}

ProjectService.prototype.getImageURL = function (projectId, imageId) {
    // TODO: Consider using an SAS token.
    const containerName = this.getTrainingImageContainerName(projectId);
    const url = this.blobService.getUrl(containerName, imageId);
    return url;
}

function mapProjectToEntity(project) {
    const generator = azureStorage.TableUtilities.entityGenerator;
    const projectId = project.projectId || project.id;
    const labels = project.labels.join(',');
    const entity = Object.assign(
        {
            PartitionKey: generator.String(projectId),
            RowKey: generator.String(projectId),
        },
        project
    );
    entity.labels = generator.String(labels);
    return entity;
}

function mapEntityToProject(entity) {
    const labels = tryArrayParse(entity.labels._);
    return {
        id: entity.RowKey._,
        name: entity.name._,
        type: entity.type._,
        labels: labels,
        instructionsText: entity.instructionsText._,
        instructionsImageId: (entity.instructionsImageId) ? entity.instructionsImageId._ : null
    };
}

function tryArrayParse(arrayString) {
    if (!arrayString) {
        return null;
    }

    if (arrayString.startsWith('[') && arrayString.endsWith(']')) {
        return JSON.parse(arrayString);
    }
    return arrayString.split(',');
}

module.exports = ProjectService;
