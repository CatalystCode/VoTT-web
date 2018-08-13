function RegisteredUserAccessPolicyImpl(accessRightsService) {
    this.accessRightsService = accessRightsService;
}

RegisteredUserAccessPolicyImpl.prototype.handleRequest = function (req, res, next) {
    if (req.isUserRegistered != undefined) {
        this.enforceRegistration(req, res, next);
        return;
    }

    const userId = this.getUserId(req);
    this.accessRightsService.isRegistered(userId).then(registered => {
        console.log(`Registration for ${userId}: ${registered}`);
        req.isUserRegistered = registered;
        this.enforceRegistration(req, res, next);
    });
}

RegisteredUserAccessPolicyImpl.prototype.enforceRegistration = function (req, res, next) {
    if (!req.isUserRegistered) {
        res.status(403);
        res.send("Access denied.");
        return;
    }
    next();
}

/**
 * Returns the user's login name if present in the given request.
 * 
 * @param {*} req 
 */
RegisteredUserAccessPolicyImpl.prototype.getUserId = function (req) {
    if (!req.user) {
        return null;
    }
    return req.user.username;
}

/**
 * RegisteredUserAccessPolicy ensures the request is associated to a user
 * who has one or more access rights record.
 */
function RegisteredUserAccessPolicy(accessRightsService) {
    const policy = new RegisteredUserAccessPolicyImpl(accessRightsService);
    return function (req, res, next) {
        policy.handleRequest(req, res, next);
    }
}

module.exports = RegisteredUserAccessPolicy;
