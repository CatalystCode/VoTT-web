/**
 * TrainingImageController
 *
 * @description :: Server-side logic for managing a project's training images.
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */
const uuid = require('uuid/v4');

module.exports = {

  find: function (req, res) {
    const projectId = req.query.projectId;
    if (!projectId) return res.badRequest("Missing projectId.");

    const query = TrainingImage.find({ project: projectId });
    const limit = (req.query.limit) ? parseInt(req.query.limit) : 32;
    query.limit(limit);

    const skip = (req.query.skip) ? parseInt(req.query.skip) : null;
    if (skip) {
      query.skip(skip);
    }

    query.exec(function (error, records) {
      if (error) return res.serverError(error);
      return res.json({
        limit: limit,
        skip: (records.length < limit) ? 0 : (skip + limit),
        records: records
      });
    });
  },

  create: function (req, res) {
    // TODO: Separate into a policy
    const image = req.body;
    if (!image) return res.badRequest("Missing body.");

    const projectId = image.projectId;
    if (!projectId) return res.badRequest("Missing projectId.");

    Project.findOne({ id: projectId }).exec(function (error, project) {
      if (error) return res.serverError(error);
      if (!project) return res.notFound();

      const containerName = ProjectService.getTrainingImageContainerName(project.id);
      const image = BlobService.createSAS(containerName);
      return res.json(image);
    });
  },

  update: function (req, res) {
    const project = req.project;
    const image = Object.assign({}, req.body);
    image.id = req.params.id;
    image.project = project;
    delete image.projectId;

    TrainingImageService.create(project, image).then(imageRecord => {
      res.json(imageRecord);
    }).catch(error => {
      res.serverError(error);
    });

  }

};

