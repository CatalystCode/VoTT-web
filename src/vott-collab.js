'use strict';

const uuid = require('uuid/v4');

function CollaborationRequestHandler() {
}

CollaborationRequestHandler.prototype.setServices = function (configuration) {
    Object.assign(this, configuration);
    return Promise.resolve(configuration);
}

CollaborationRequestHandler.prototype.imageTagTask = function (args, request) {
    if (!request.vottSession) {
        return;
    }
    const projectId = args.projectId;
    const collaboratorId = request.vottSession.collaboratorId;
    const self = this;
    return self.collaboratorService.readCollaborator(projectId, collaboratorId)
        .then(collaborator => {
            return self.projectService.getNextTask(projectId);
        });
}

CollaborationRequestHandler.prototype.submitImageTags = function (args, res) {
    const taskId = args.taskId;
    const tags = args.tags;
    return this.projectService.submitImageTags(taskId, tags);
}

module.exports = {
    createGraphqlRoot: function () {
        return new CollaborationRequestHandler();
    }
};
