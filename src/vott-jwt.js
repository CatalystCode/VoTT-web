'use strict';

const jsonwebtoken = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');

function TokenService(secretOrPrivateKey) {
    if (!secretOrPrivateKey) {
        throw new Error("Parameter secretOrPrivateKey must be present.");
    }
    this.secretOrPrivateKey = secretOrPrivateKey;
}

TokenService.prototype.sign = function (object, expiresIn) {
    return jsonwebtoken.sign(object, this.secretOrPrivateKey, { expiresIn: 86400 });
}

TokenService.prototype.verify = function (token, callback) {
    return jsonwebtoken.verify(token, this.secretOrPrivateKey, callback);
}

TokenService.prototype.createMiddleware = function () {
    const self = this;
    return function (request, response, next) {
        const authorization = request.headers['authorization'];
        if (!authorization) {
            return response.status(401).send({ message: 'No authorization.' });
        }

        const bearer = authorization.match(/Bearer\s+(.+)/i);
        if (!bearer) {
            return response.status(401).send({ message: 'Unsupported authorization type.' });
        }

        const token = bearer[1];
        self.verify(token, function (error, decoded) {
            if (error) {
                return response.status(401).send({ message: 'Unauthorized.' });
            }
            next();
        });
    }
}

module.exports = {
    TokenService: TokenService
};
