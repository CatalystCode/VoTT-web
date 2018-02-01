'use strict';

const jsonwebtoken = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');

function TokenService(secretOrPrivateKey) {
    if (secretOrPrivateKey) {
        this.secretOrPrivateKey = secretOrPrivateKey;
    }
    else {
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            throw new Error("Required environment variable JWT_SECRET is missing.");
        }
        this.secretOrPrivateKey = jwtSecret;
    }
}

TokenService.prototype.sign = function (object, expiresIn) {
    return jsonwebtoken.sign(object, this.secretOrPrivateKey, { expiresIn: 86400 });
}

TokenService.prototype.verify = function (token, callback) {
    return jsonwebtoken.verify(token, this.secretOrPrivateKey, callback);
}

TokenService.prototype.createAuthorizationPromise = function (request) {
    const self = this;
    return new Promise((resolve, reject) => {
        const authorization = request.headers['authorization'];
        if (!authorization) {
            return reject({ status: 401, message: 'No authorization.' });
        }

        const bearer = authorization.match(/Bearer\s+(.+)/i);
        if (!bearer) {
            return reject({ status: 401, message: 'Unsupported authorization type.' });
        }

        const token = bearer[1];
        self.verify(token, function (error, decoded) {
            if (error) {
                return reject({ status: 401, message: 'Unauthorized.' });
            }
            resolve(decoded);
        });
    });
}

TokenService.prototype.createCookiePromise = function (request) {
    const self = this;
    return new Promise((resolve, reject) => {
        if (!request.cookies.hasOwnProperty('token')) {
            return reject({ status: 401, message: 'No token.' });
        }

        const token = request.cookies.token;
        self.verify(token, function (error, decoded) {
            if (error) {
                return reject({ status: 401, message: 'Unauthorized.' });
            }
            resolve(decoded);
        });
    });
}

TokenService.prototype.createMiddleware = function () {
    const self = this;
    return function (request, response, next) {
        if (request.vottSession) {
            return next();
        }
        self.createCookiePromise(request)
            .then(decoded => {
                request.vottSession = decoded;
                next();
            }).catch(error => {
                if (request.vottSession) {
                    // The decoding did succeed, but the call to 'next()'
                    // resulted in an error.
                    return Promise.reject(error);
                }
                self.createAuthorizationPromise(request)
                    .then(decoded => {
                        request.locals.vottSession = decoded;
                        next();
                    })
                    .catch(error => {
                        return response.status(401).send({ message: 'Unauthorized.' });
                    });
            });
    }
}

module.exports = {
    createTokenService: function (secretOrPrivateKey) {
        return new TokenService(secretOrPrivateKey);
    }
};
