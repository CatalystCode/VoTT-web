/**
 * TrainingImage.js
 *
 * @description :: TODO: You might write a short summary of how this model works and what it represents here.
 * @docs        :: http://sailsjs.org/documentation/concepts/models-and-orm/models
 */

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
    status: {
      type: 'string',
      required: true,
      enum: ['tag-pending', 'ready-for-training', 'in-conflict'],
      defaultsTo: 'tag-pending'
    },
    tags: {
      type: 'json',
      required: false
    },
    project: {
      model: 'Project',
      required: true
    },
    contributions: {
      collection: 'TrainingImageTagContribution',
      via: 'image'
    },

    takeStatusFromContributions: function() {

    }

  }
};

