const uuid = require('uuid/v4');
const expressFoundation = require('../foundation/express');

function ProjectController(projectService) {
    this.projectService = projectService;
}

ProjectController.prototype.list = function (req, res) {
    this.projectService.list(req.query.paginationToken).then(projects => {
        res.json(projects);
    }).catch(error => {
        expressFoundation.replyWithError(res, error);
    });
};

ProjectController.prototype.create = function (req, res) {
    this.projectService.create(req.body).then(project => {
        res.json(project);
    }).catch(error => {
        expressFoundation.replyWithError(res, error);
    });
};

ProjectController.prototype.read = function (req, res) {
    const projectId = req.params.id;
    this.projectService.read(projectId).then(project => {
        res.json(project);
    }).catch(error => {
        expressFoundation.replyWithError(res, error);
    });
};

ProjectController.prototype.update = function (req, res) {
    this.projectService.update(req.body).then(project => {
        res.json(project);
    }).catch(error => {
        expressFoundation.replyWithError(res, error);
    });
};

ProjectController.prototype.delete = function (req, res, next) {
    const projectId = req.params.id;
    this.projectService.delete(projectId).then(result => {
        res.json({});
    }).catch(error => {
        expressFoundation.replyWithError(res, error);
    });
};

ProjectController.prototype.allocateInstructionsImage = function (req, res) {
    const projectId = req.params.id;
    this.projectService.allocateInstructionsImage(projectId).then(image => {
        res.json(image);
    }).catch(error => {
        expressFoundation.replyWithError(res, error);
    });
};

ProjectController.prototype.commitInstructionsImage = function (req, res) {
    const projectId = req.params.id;
    const image = req.body;
    this.projectService.commitInstructionsImage(projectId, image).then(project => {
        res.json(image);
    }).catch(error => {
        expressFoundation.replyWithError(res, error);
    });
};

ProjectController.prototype.image = function (req, res) {
    const projectId = req.params.projectId;
    const imageId = req.params.imageId;
    const url = this.projectService.getImageURL(projectId, imageId);
    res.redirect(url);
};

module.exports = {
    ProjectController: ProjectController
};
