'use strict';

const jsonwebtoken = require('jsonwebtoken');

function getAuthorizationToken(request) {
    const authorization = request.headers['authorization'];
    if (!authorization) {
        return null;
    }

    const bearer = authorization.match(/Bearer\s+(.+)/i);
    if (!bearer) {
        return null;
    }

    return bearer[1];
}

function getTokenCookie(request) {
    if (!request.cookies.hasOwnProperty('token')) {
        return null;
    }

    return request.cookies.token;
}

function sign(object, configuration) {
    return jsonwebtoken.sign(
        object,
        configuration.secretOrPrivateKey,
        { expiresIn: (configuration.expiresIn ? configuration.expiresIn : 86400) }
    );
}

function verify(token, configuration, callback) {
    return jsonwebtoken.verify(token, configuration.secretOrPrivateKey, callback);
}

module.exports = {

    getDefaultConfiguration: function () {
        return {
            secretOrPrivateKey: process.env.JWT_SECRET,
            expiresIn: 86400
        };
    },

    extractFromRequest: function (request, configuration, callback) {
        const authorizationToken = getAuthorizationToken(request);
        if (authorizationToken) {
            return verify(authorizationToken, configuration, callback);
        }

        const tokenCookie = getTokenCookie(request);
        if (tokenCookie) {
            return verify(tokenCookie, configuration, callback);
        }

        return callback(null, null);
    },

    sign: sign,
    verify: verify

};
