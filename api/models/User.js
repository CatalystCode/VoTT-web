/**
 * User.js
 *
 * @description :: TODO: You might write a short summary of how this model works and what it represents here.
 * @docs        :: http://sailsjs.org/documentation/concepts/models-and-orm/models
 */
const uuid = require('uuid/v4');

module.exports = {

  attributes: {
    id: {
      type: 'string',
      primaryKey: true
    },
    name: {
      type: 'string',
      required: true
    },
    email: {
      type: 'string',
      required: true
    },

  },

  findOrCreateDefaultAdmin: function () {
    if (!process.env.VOTT_DEFAULT_ADMIN_EMAIL) {
      return Promise.reject(new Error("Cannot create default admin user because VOTT_DEFAULT_ADMIN_EMAIL is not set."));
    }

    return User.findOrCreate(
      { email: process.env.VOTT_DEFAULT_ADMIN_EMAIL },
      {
        id: uuid(),
        name: process.env.VOTT_DEFAULT_ADMIN_NAME,
        email: process.env.VOTT_DEFAULT_ADMIN_EMAIL
      }
    );
  }

};
