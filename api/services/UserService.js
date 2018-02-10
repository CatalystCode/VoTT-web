const uuid = require('uuid/v4');

module.exports = {

  findOrCreate: function (name, email) {
    const record = {
      id: uuid(),
      name: name,
      email: email
    };

    return new Promise((resolve, reject) => {
      User.findOrCreate({ email: email }, record).exec(function (error, user) {
        if (error) return reject(error);
        resolve(user);
      });
    });

  }

};
