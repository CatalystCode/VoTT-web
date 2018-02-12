/**
 * projectIdPolicy
 *
 * @module      :: Policy
 * @description :: Ensures the project reference is present in the request via
 *                 req.body.projectId, req.params.projectId, or
 *                 req.query.projectId. The project is then loaded from the
 *                 database and associated to the request.
 * @docs        :: http://sailsjs.org/#!/documentation/concepts/Policies
 *
 */

module.exports = function (req, res, next) {
  const projectId = RequestService.extractProjectId(req);
  if (!projectId) return res.badRequest('Missing projectId.');

  Project.findOne({ id: projectId }).exec(function (error, project) {
    if (error) return res.serverError(error);
    if (!project) return res.notFound('Project not found.');

    req.project = project;
    next();
  });

};
