/**
 * ProjectCollaboratorAccessMiddleware ensures the request is associated to a user
 * who has project collaborator (or higher) access  to the project referenced
 * in the request.
 */
function ProjectCollaboratorAccessMiddleware() {
    return function (req, res, next) {
        if (!req || !req.accessRights) {
            res.status(403);
            res.send("Access denied.");
            return;
        }

        const record = req.accessRights;
        if (record.projectId == 'root' || record.role == 'project-manager' || record.role == 'project-collaborator') {
            next();
            return;
        }

        res.status(403);
        res.send("Access denied.");
    }
}

module.exports = ProjectCollaboratorAccessMiddleware;
