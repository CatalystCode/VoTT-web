/**
 * An AccessRightsInjector is a part of the AccessRightsMiddleware that sets a
 * request's accessRights based on the values provided by the request.
 * 
 * @param {*} accessRightsService 
 */
function AccessRightsInjector(accessRightsService) {
    this.accessRightsService = accessRightsService;
}

/**
 * The processRequest method is the one called by the middleware.
 *  
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 */
AccessRightsInjector.prototype.processRequest = function (req, res, next) {
    if (req.accessRights) {
        next();
        return;
    }
    const userId = this.getUserId(req);
    this.accessRightsService.read(
        this.getProjectId(req),
        userId
    ).then(record => {
        req.accessRights = record;
        req.isUserRegistered = true;
        console.log("Recording access rights:");
        console.log(JSON.stringify(record));
        next();
    }).catch(error => {
        req.accessRights = null;
        if (error.statusCode == 404) {
            console.log(`No access rights for ${userId}, checking for registration...`);
            this.accessRightsService.isRegistered(userId).then(registered => {
                console.log(`Registration for ${userId}: ${registered}`);
                req.isUserRegistered = registered;
                next();
            });
            return;
        }
        next();
    });
}

/**
 * Returns project's primary key value if present in the given request.
 * 
 * @param {*} req 
 */
AccessRightsInjector.prototype.getProjectId = function (req) {
    const values = [
        req.query.projectId,
        req.params.projectId,
        (req.body ? req.body.projectId : null)
    ];
    return values.find(value => value);
}

/**
 * Returns the user's login name if present in the given request.
 * 
 * @param {*} req 
 */
AccessRightsInjector.prototype.getUserId = function (req) {
    if (!req.user) {
        return null;
    }
    return req.user.username;
}

/**
 * An AccessRightsMiddleware will attempt to the a request's accessRights
 * property set based on the values associated to the request.
 * 
 * @param {*} accessRightsService 
 */
function AccessRightsMiddleware(accessRightsService) {
    const policy = new AccessRightsInjector(accessRightsService);
    return function (req, res, next) {
        return policy.processRequest(req, res, next);
    }
}

module.exports = AccessRightsMiddleware;
