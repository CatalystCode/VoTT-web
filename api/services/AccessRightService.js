const uuid = require('uuid/v4');

module.exports = {

  find: function (project) {
    return AccessRight
      .find({ project: project.id })
      .populate('user');
  },

  findOrCreate: function (user, project, role) {
    const description = {
      user: user.id,
      project: project.id,
    };

    const record = {
      id: uuid(),
      user: user,
      project: project,
      role: role
    };

    return AccessRight
      .findOrCreate(description, record)
      .populate('user')
      .populate('project')
      .then(right => {
        // For some reason, the case of 'create' in 'findOrCreate' doesn't
        // populate the user and project relationships, so this is done by
        // hand here.
        if (typeof (right.user) == 'string') {
          right.user = user;
        }
        if (typeof (right.project) == 'string') {
          right.project = project;
        }
        return Promise.resolve(right);
      });

  }

};
