const expressFoundation = require('../foundation/express');
const uuid = require('uuid/v4');

function TrainingImageController(trainingImageService) {
    this.trainingImageService = trainingImageService;
}

TrainingImageController.prototype.list = function (req, res, next) {
    this.trainingImageService.list(req.query.projectId, req.query.paginationToken).then(images => {
        res.json({
            entries: images
        });
    }).catch(error => {
        expressFoundation.replyWithError(res, error);
    });
};

TrainingImageController.prototype.allocate = function (req, res, next) {
    this.trainingImageService.allocate(req.body).then(image => {
        res.json(image);
    }).catch(error => {
        expressFoundation.replyWithError(res, error);
    });
};

TrainingImageController.prototype.create = function (req, res, next) {
    this.trainingImageService.create(req.body).then(image => {
        res.json(image);
    }).catch(error => {
        expressFoundation.replyWithError(res, error);
    });
};

TrainingImageController.prototype.stats = function (req, res, next) {
    const projectId = req.query.projectId;
    // TODO: Find a way to do these counts in one go, a la 'select status, count(*) from trainingimage group by status;'
    Promise.all([
        this.trainingImageService.count(projectId, 'tag-pending').then(count => Promise.resolve({ status: 'tag-pending', count: count })),
        this.trainingImageService.count(projectId, 'ready-for-training').then(count => Promise.resolve({ status: 'ready-for-training', count: count })),
        this.trainingImageService.count(projectId, 'in-conflict').then(count => Promise.resolve({ status: 'in-conflict', count: count }))
    ]).then(counts => {
        res.json({ statusCount: counts });
    }).catch(error => {
        expressFoundation.replyWithError(res, error);
    });
}

module.exports = {
    TrainingImageController: TrainingImageController
};
