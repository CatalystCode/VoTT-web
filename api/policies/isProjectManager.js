/**
 * isProjectManager
 *
 * @module      :: Policy
 * @description :: Returns true if an authenticated user is allowed to manage a given project.
 * @docs        :: http://sailsjs.org/#!/documentation/concepts/Policies
 *
 */
module.exports = function (req, res, next) {
    // TODO: Re-use the request user if present.
    const configuration = JWTService.getDefaultConfiguration();
    JWTService.extractFromRequest(req, configuration, function (error, token) {
        if (error) return res.serverError(error);
        if (!token) return res.forbidden('Access denied.');

        const query = { role: 'project-manager', user: token.userId };
        AccessRight.find(query).populate('user').exec(function (error, rights) {
            if (error) return res.serverError(error);
            if (rights.length == 0) return res.forbidden('Access denied.');

            const projectId = RequestService.extractProjectId(req);
            const right = rights.find(record=>record.project == null || project.project == projectId);
    
            req.user = right.user;
            return next();
        });
    });

};
