const expressFoundation = require('../foundation/express');
const uuid = require('uuid/v4');

function AccessRightsController(accessRightsService) {
    this.accessRightsService = accessRightsService;
}

AccessRightsController.prototype.list = function (req, res, next) {
    this.accessRightsService.list(req.query.projectId).then(result => {
        res.json(result);
    }).catch(error => {
        expressFoundation.replyWithError(res, error);
    });
};

AccessRightsController.prototype.create = function (req, res, next) {
    this.accessRightsService.create(req.body).then(accessRight => {
        res.json(accessRight);
    }).catch(error => {
        expressFoundation.replyWithError(res, error);
    });
};

AccessRightsController.prototype.delete = function (req, res, next) {
    this.accessRightsService.delete(req.query.projectId, req.params.id).then(result => {
        res.json(result);
    }).catch(error => {
        expressFoundation.replyWithError(res, error);
    });
};

module.exports = AccessRightsController;
