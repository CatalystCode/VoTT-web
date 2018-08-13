/**
 * RegisteredUserMiddleware ensures the request is associated to a user
 * who has one or more access rights record.
 */
function RegisteredUserMiddleware() {
    return function (req, res, next) {
        if (!req || !req.isUserRegistered) {
            res.status(403);
            res.send("Access denied.");
            return;
        }

        next();
    }
}

module.exports = RegisteredUserMiddleware;
