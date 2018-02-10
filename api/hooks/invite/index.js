module.exports = function inviteHook(sails) {
  return {
    initialize: function (cb) {
      sails.on('hook:orm:loaded', function () {

        InviteService.findOrCreateForDefaultAdmin().then(invite => {
          cb();
        }).catch(error => {
          cb(error);
        });

      });

    }
  };
}
