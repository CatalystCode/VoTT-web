/**
 * ProjectController
 *
 * @description :: Server-side logic for managing projects
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */
const uuid = require('uuid/v4');

module.exports = {

    pullTask: function (req, res) {
        const project = req.project;
        ProjectService.pullTask(project).then(task => {
            if (!task) return res.notFound("No tasks pending at this time.");
            res.json(task);
        }).catch(error => {
            res.serverError(error);
        });
    },

    pushTask: function (req, res) {
        const project = req.project;
        const user = req.user;
        const task = req.body;
        ProjectService.pushTask(project, task, user).then(taskRecord => {
            if (!taskRecord) return res.notFound();
            res.json(taskRecord);
        }).catch(error => {
            res.serverError(error);
        });
    }

};

