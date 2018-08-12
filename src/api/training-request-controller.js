const expressFoundation = require('../foundation/express');

function TrainingRequestController(trainingRequestService) {
    this.trainingRequestService = trainingRequestService;
}

TrainingRequestController.prototype.list = function (req, res, next) {
    const currentToken = req.query.currentToken ? JSON.parse(req.query.currentToken) : null;
    this.trainingRequestService.list(req.query.projectId, currentToken, req.query.limit).then(result => {
        res.json(result.entries);
    }).catch(error => {
        expressFoundation.replyWithError(res, error);
    });
};

TrainingRequestController.prototype.create = function (req, res, next) {
    this.trainingRequestService.create(req.query.projectId).then(result => {
        res.json(result);
    }).catch(error => {
        expressFoundation.replyWithError(res, error);
    });
};

TrainingRequestController.prototype.delete = function (req, res, next) {
    this.trainingRequestService.delete(req.query.requestId).then(result => {
        res.json(result);
    }).catch(error => {
        expressFoundation.replyWithError(res, error);
    });
};

module.exports = TrainingRequestController;
