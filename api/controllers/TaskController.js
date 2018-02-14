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
        TrainingImageService.pullTask(project).then(task => {
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
        //TODO: Ensure that the task's tags look something like this:
        //      [{"label":"mustang","boundingBox":{"y":5.874396135265698,"x":5.2560386473429945,"width":117.38485997886474,"height":119.34299516908213}}]
        TrainingImageService.pushTask(project, task, user).then(taskRecord => {
            if (!taskRecord) return res.notFound();
            res.json(taskRecord);
        }).catch(error => {
            res.serverError(error);
        });
    }

};

