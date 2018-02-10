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
      res.json(rights.map(value => value.user));
    }).catch(error => {
      res.internalServerError(error);
    });
  },

  create: function (req, res) {
    const project = req.project;
    const name = req.body.name;
    const email = req.body.email;
    const role = req.body.role;

    UserService.findOrCreate(req.body.name, req.body.email).then(user => {
      return AccessRightService.findOrCreate(user, project, role);
    }).then(right => {
      return InviteService.inviteWithAccessRight(right).then(invite => {
        return Promise.resolve(right);
      });
    }).then(right => {
      res.json(right);
    }).catch(error => {
      res.internalServerError(error);
    });
  },

};
