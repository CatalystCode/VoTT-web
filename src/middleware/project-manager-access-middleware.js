/**
 * ProjectManagerPolicyMiddleware ensures the request is associated to a user
 * who has project manager (or higher) access  to the project referenced
 * in the request.
 */
function ProjectManagerAccessMiddleware() {
    return function (req, res, next) {
        if (!req || !req.accessRights) {
            return;
        }

        const record = req.accessRights;
        if (record.projectId == 'root' || record.role == 'project-manager') {
            next();
            return;
        }

        res.status(403);
    }
}

module.exports = ProjectManagerAccessMiddleware;
