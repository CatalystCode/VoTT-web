/**
 * TrainingImageController
 *
 * @description :: Server-side logic for managing a project's training images.
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */
const uuid = require('uuid/v4');

module.exports = {

  find: function (req, res) {
    const projectId = req.project.id;

    const query = TrainingImage.find({ project: projectId });
    const limit = (req.query.limit) ? parseInt(req.query.limit) : 32;
    query.limit(limit);

    const skip = (req.query.skip) ? parseInt(req.query.skip) : null;
    if (skip) {
      query.skip(skip);
    }

    query.then(records => {
      return res.json({
        limit: limit,
        skip: (records.length < limit) ? 0 : (skip + limit),
        entries: records.map(value => {
          const url = ProjectService.getImageURL(projectId, value.id);
          value.url = url;
          return value;
        })
      });
    }).catch(error => {
      res.serverError(error);
    });
  },

  create: function (req, res) {
    const projectId = req.project.id;
    const containerName = ProjectService.getTrainingImageContainerName(projectId);
    const sas = BlobService.createSAS(containerName);
    const image = Object.assign({ projectId: projectId }, sas);
    return res.json(image);
  },

  update: function (req, res) {
    const project = req.project;
    const image = Object.assign({ project: project }, req.body);
    delete image.projectId;

    TrainingImageService.create(project, image).then(imageRecord => {
      res.json(imageRecord);
    }).catch(error => {
      res.serverError(error);
    });
  },

  stats: function (req, res) {
    const projectId = req.project.id;
    // TODO: Find a way to do these counts in one go, a la 'select status, count(*) from trainingimage group by status;'
    Promise.all([
      TrainingImage.count({ project: projectId, status: 'tag-pending' }).then(count => Promise.resolve({ status: 'tag-pending', count: count })),
      TrainingImage.count({ project: projectId, status: 'ready-for-training' }).then(count => Promise.resolve({ status: 'ready-for-training', count: count })),
      TrainingImage.count({ project: projectId, status: 'in-conflict' }).then(count => Promise.resolve({ status: 'in-conflict', count: count }))
    ]).then(counts => {
      res.json({ statusCount: counts });
    }).catch(error => {
      res.serverError(error);
    });
  }

};

