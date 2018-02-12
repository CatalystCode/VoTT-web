/**
 * AccessRightController
 *
 * @description :: Server-side logic for managing projects
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */
const uuid = require('uuid/v4');

module.exports = {

  find: function (req, res) {
    const project = req.project;
    AccessRightService.find(project).then(rights => {
      res.json(rights);
    }).catch(error => {
      res.serverError(error);
    });
  },

  create: function (req, res) {
    const project = req.project;
    const name = req.body.name;
    const email = req.body.email;
    const role = req.body.role;

    AccessRightService.findOrCreate(project, name, email, role).then(right => {
      res.json(right);
    }).catch(error => {
      res.serverError(error);
    });
  },

};
