/**
 * ProjectController
 *
 * @description :: Server-side logic for managing projects
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */
const uuid = require('uuid/v4');

module.exports = {

    create: function (req, res) {
        ProjectService.createProject(req.body).then(project => {
            res.json(project);
        }).catch(error => {
            res.serverError(error);
        });
    },

    destroy: function (req, res) {
        const projectId = req.params.id;
        ProjectService.destroyProject(projectId).then(result => {
            res.ok();
        }).catch(error => {
            res.serverError(error);
        });
    },

    allocateInstructionsImage: function (req, res) {
        const projectId = req.project.id;
        ProjectService.allocateInstructionsImage(projectId).then(image => {
            res.json(image);
        }).catch(error => {
            res.serverError(error);
        });
    },

    commitInstructionsImage: function (req, res) {
        const projectId = req.project.id;
        const image = req.body;
        ProjectService.commitInstructionsImage(projectId, image).then(project => {
            res.json(project);
        }).catch(error => {
            res.serverError(error);
        });
    },

    image: function (req, res) {
        const projectId = req.params.projectId;
        const imageId = req.params.imageId;
        const url = ProjectService.getImageURL(projectId, imageId);
        res.redirect(url);
    }

};

