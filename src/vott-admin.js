'use strict';

const qrcode = require('qrcode');
const foundation = require('./vott-foundation');

// NOTE: The raw headers are in uppercase but are lowercased by express. 
const CLIENT_PRINCIPAL_NAME_HEADER = 'x-ms-client-principal-name';
const CLIENT_PRINCIPAL_ID_HEADER = 'x-ms-client-principal-id';
const CLIENT_PRINCIPAL_IDP_HEADER = 'x-ms-client-principal-idp';

function RequestHandler() {
}

RequestHandler.prototype.setServices = function (configuration) {
    Object.assign(this, configuration);
    return Promise.resolve(configuration);
}

function getUser(request) {
    return {
        id: request.headers[CLIENT_PRINCIPAL_ID_HEADER],
        name: request.headers[CLIENT_PRINCIPAL_NAME_HEADER],
        idp: request.headers[CLIENT_PRINCIPAL_IDP_HEADER]
    };
}

RequestHandler.prototype.projects = function (args, request) {
    // TODO: Ensure user has access to projectId.
    const nextPageToken = (args.nextPageToken) ? JSON.parse(args.nextPageToken) : null;
    return this.projectService.readProjects(nextPageToken);
}
RequestHandler.prototype.project = function (args, request) {
    // TODO: Ensure user has access to projectId.
    const projectId = args.projectId;
    return this.projectService.readProject(projectId);
}
RequestHandler.prototype.createProject = function (args, res) {
    // TODO: Ensure user has access to projectId.
    return this.projectService.createProject(args.name, args.taskType, args.objectClassNames, args.instructionsText);
}
RequestHandler.prototype.updateProject = function (args, res) {
    // TODO: Ensure user has access to projectId.
    return this.projectService.updateProject(args.projectId, args.name, args.taskType, args.objectClassNames, args.instructionsText);
}
RequestHandler.prototype.deleteProject = function (args, res) {
    // TODO: Ensure user has access to projectId.
    const projectId = args.projectId;
    return this.projectService.deleteProject(projectId);
}

RequestHandler.prototype.createInstructionsImage = function (args, res) {
    const self = this;
    const projectId = args.projectId;
    return this.projectService.readProject(projectId).then(project => {
        const imageContainerName = self.imageService.getImageContainerName(projectId);
        const file = foundation.createFileSAS(self.blobService, imageContainerName);
        return {
            projectId: projectId,
            fileId: file.fileId,
            fileURL: file.url
        };
    });
}
RequestHandler.prototype.commitInstructionsImage = function (args, res) {
    const projectId = args.image.projectId;
    const fileId = args.image.fileId;
    return this.projectService.updateInstructionsImage(projectId, fileId);
}

RequestHandler.prototype.createTrainingImage = function (args, res) {
    const self = this;
    const projectId = args.projectId;
    return this.projectService.readProject(projectId).then(project => {
        const imageContainerName = self.imageService.getImageContainerName(projectId);
        const file = foundation.createFileSAS(self.blobService, imageContainerName);
        return {
            projectId: projectId,
            fileId: file.fileId,
            fileURL: file.url
        };
    });
}
RequestHandler.prototype.commitTrainingImage = function (args, res) {
    const projectId = args.projectId;
    const fileId = args.fileId;
    return this.imageService.createTrainingImage(projectId, fileId);
}
RequestHandler.prototype.trainingImages = function (args, res) {
    const projectId = args.projectId;
    const nextPageToken = (args.nextPageToken) ? JSON.parse(args.nextPageToken) : null;
    return this.imageService.readTrainingImages(projectId, nextPageToken);
}

RequestHandler.prototype.createCollaborator = function (args, response) {
    // TODO: Ensure user has project access to the project.
    const projectId = args.projectId;
    const name = args.name;
    const email = args.email;
    const profile = args.profile;

    const self = this;
    return self.collaboratorService.createCollaborator(projectId, name, email, profile)
        .then((collaborator) => {
            return self.inviteService.createInvite(projectId, collaborator.collaboratorId)
                .then((invite) => {
                    return self.sendInviteEmail(collaborator, invite);
                });
        });
}

RequestHandler.prototype.qrcodeForInvite = function (collaborator, invite) {
    return new Promise((resolve, reject) => {
        const urlQR = qrcode.toDataURL(invite.inviteURL, (error, url) => {
            if (error) return reject(error);
            resolve(url);
        });
    });
}

RequestHandler.prototype.sendInviteEmail = function (collaborator, invite) {
    return new Promise((resolve, reject) => {
        if (!this.emailService) {
            return resolve({
                inviteId: invite.inviteId,
                inviteURL: invite.inviteURL,
                collaborator: collaborator
            });
        }
        const vottInviteURL = invite.inviteURL.replace(/^http/i, 'vott');
        const from = { name: "VoTT", email: (process.env.EMAIL_FROM || 'noreply@example.com') };
        const to = { email: collaborator.email, name: collaborator.name };
        const text = `You have been invited to collaborate on a VoTT project.\nClick on this link ${invite.inviteURL} to get started.\nNOTE: This link is your password - DO NOT SHARE IT.`;
        const html = `
                        <h3>You have been invited to collaborate on a VoTT project.</h3>
                        <p>
                        Click <a href='${invite.inviteURL}'>here</a> to get started.</a>
                        </p>
                    `;
        this.qrcodeForInvite(collaborator, invite).then(url => {
            const qrimage = `<p>If you have VoTT installed, scan the QR code for convenience:</p><p><img src='${url}'></p>`;
            const warning = '<p>NOTE: This link is your password - DO NOT SHARE IT.</p>';
            const htmlWithQR = html + qrimage + warning;
            return this.emailService.send(
                from,
                to,
                'VoTT collaboration',
                htmlWithQR,
                text
            ).then(receipt => {
                return resolve({
                    inviteId: invite.inviteId,
                    inviteURL: invite.inviteURL,
                    collaborator: collaborator
                });
            });
        });
    });
}

RequestHandler.prototype.reinviteCollaborator = function (args, response) {
    // TODO: Ensure user has project access to the project.
    const projectId = args.projectId;
    const collaboratorId = args.collaboratorId;
    const self = this;
    return self.collaboratorService.readCollaborator(projectId, collaboratorId).then(collaborator => {
        return self.inviteService.createInvite(projectId, collaboratorId)
            .then(invite => {
                // TODO: Consider de-activating all previous invites for that collaborator.
                return self.sendInviteEmail(collaborator, invite);
            });
    });
}
RequestHandler.prototype.collaborators = function (args, response) {
    const projectId = args.projectId;
    const nextPageToken = (args.nextPageToken) ? JSON.parse(args.nextPageToken) : null;
    return this.collaboratorService.readCollaborators(projectId, nextPageToken);
}
RequestHandler.prototype.deleteCollaborator = function (args, request) {
    // TODO: Remove invites for the collaborator.
    const projectId = args.projectId;
    const collaboratorId = args.collaboratorId;
    return this.collaboratorService.deleteCollaborator(projectId, collaboratorId);
}
RequestHandler.prototype.models = function (args, request) {
    // TODO: Ensure user has project access to the project.
    const projectId = args.projectId;
    const nextPageToken = (args.nextPageToken) ? JSON.parse(args.nextPageToken) : null;
    return this.modelService.readModels(projectId, nextPageToken);
}
RequestHandler.prototype.createModel = function (args, response) {
    const projectId = args.projectId;
    return this.modelService.createModel(projectId);
}
RequestHandler.prototype.deleteModel = function (args, request) {
    const projectId = args.projectId;
    const modelId = args.modelId;
    return this.modelService.deleteModel(projectId, modelId);
}

module.exports = {
    createGraphqlRoot: function () {
        return new RequestHandler();
    }
};
