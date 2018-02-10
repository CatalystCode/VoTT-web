/**
 * isProjectManager
 *
 * @module      :: Policy
 * @description :: Returns true if an authenticated user is allowed to contribute to a given project.
 * @docs        :: http://sailsjs.org/#!/documentation/concepts/Policies
 *
 */
module.exports = function (req, res, next) {
    const projectId = RequestService.extractProjectId(req);
    if (!projectId) {
        return res.badRequest();
    }

    // TODO: Re-use the request user if present.
    const configuration = JWTService.getDefaultConfiguration();
    JWTService.extractFromRequest(req, configuration, function (error, token) {
        if (error) return res.serverError(error);
        if (!token) return res.forbidden('Access denied.');

        const query = { user: token.userId };
        AccessRight.find(query).populate('user').exec(function (error, records) {
            if (error) return res.serverError(error);
            if (!records || records.length == 0) return res.forbidden('Access denied.');

            const qualifyingRecord = records.find(record => record.role == 'project-manager' || record.role == 'project-collaborator' && record.project == projectId);
            if (!qualifyingRecord) return res.forbidden('Access denied.');

            req.user = qualifyingRecord.user;

            return next();
        });
    });
};
