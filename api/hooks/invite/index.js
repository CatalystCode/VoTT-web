module.exports = function inviteHook(sails) {
    return {
     defaults: {
       __configKey__: {
         _hookTimeout: (1000 * 60 * 7)
       }
     },
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