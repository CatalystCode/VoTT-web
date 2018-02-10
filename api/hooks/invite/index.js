module.exports = function inviteHook(sails) {
  return {
    initialize: function (cb) {
      sails.on('hook:orm:loaded', function () {

        InviteService.createForDefaultAdmin(function (error, invite) {
          return cb();
        });

      });

    }
  };
}
