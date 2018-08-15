const expressFoundation = require('../foundation/express');
const uuid = require('uuid/v4');

function AccessRightsController(accessRightsService) {
    this.accessRightsService = accessRightsService;
}

AccessRightsController.prototype.list = function (req, res, next) {
    this.accessRightsService.list(req.params.projectId).then(result => {
        res.json(result);
    }).catch(error => {
        expressFoundation.replyWithError(res, error);
    });
};

AccessRightsController.prototype.create = function (req, res, next) {
    this.accessRightsService.create(req.params.projectId, req.body.userId, req.body.role, req.body.email).then(accessRight => {
        res.json(accessRight);
    }).catch(error => {
        expressFoundation.replyWithError(res, error);
    });
};

AccessRightsController.prototype.delete = function (req, res, next) {
    this.accessRightsService.delete(req.params.projectId, req.params.accessRightId).then(result => {
        res.json(result);
    }).catch(error => {
        expressFoundation.replyWithError(res, error);
    });
};

module.exports = AccessRightsController;
