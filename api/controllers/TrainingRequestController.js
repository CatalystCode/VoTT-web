/**
 * TrainingRequestController
 *
 * @description :: Server-side logic for managing a project's training requests.
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */

module.exports = {

  find: function (req, res) {
    const project = req.project;
    TrainingRequestService.find(project).then(trainingRequests => {
      res.json(trainingRequests);
    }).catch(error => {
      res.serverError(error);
    });
  },

  create: function (req, res) {
    const user = req.user;
    const project = req.project;
    TrainingRequestService.create(project, user).then(trainingRequest => {
      res.json(trainingRequest);
    }).catch(error => {
      res.serverError(error);
    });
  }

};

