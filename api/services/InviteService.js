const qrcode = require('qrcode');
const uuid = require('uuid/v4');

function getInviteURL(user, invite) {
  // Remember to keep this in sync with its config/routes.js counterpart.
  return `${FoundationService.websiteBaseURL()}/vott/invites/${user.id}/${invite.id}`;
}

function sendInviteEmail(user, invite, callback) {
  const inviteURL = getInviteURL(user, invite);
  const from = { name: "VoTT", email: (process.env.EMAIL_FROM || 'noreply@example.com') };
  const to = { email: user.email, name: user.name };
  const text = `You have been invited to collaborate on a VoTT project.\nClick on this link ${inviteURL} to get started.\nNOTE: This link is your password - DO NOT SHARE IT.`;
  const html = `
                    <h3>You have been invited to collaborate on a VoTT project.</h3>
                    <p>
                    Click <a href='${inviteURL}'>here</a> to get started.</a>
                    </p>
                `;

  qrcode.toDataURL(inviteURL, (error, url) => {
    if (error) return callback(error);

    const qrimage = `<p>If you have VoTT installed, scan the QR code for convenience:</p><p><img src='${url}'></p>`;
    const warning = '<p>NOTE: This link is your password - DO NOT SHARE IT.</p>';
    const htmlWithQR = html + qrimage + warning;

    EmailService.send(from, to, 'VoTT collaboration', htmlWithQR, text, callback);
  });

}

module.exports = {

  /**
   * Intended to be called from invite hook on application startup. If the
   * default admin user environment variables are set, a user is created and an
   * email is sent to the user.
   */
  createForDefaultAdmin: function (callback) {
    AccessRight.findOne({ role: 'project-manager' }).populate("user").exec(function (error, right) {
      if (right) {
        return callback(null, null);
      }

      User.createDefaultAdmin(function (error, user) {
        async.series(
          [
            (cb) => { AccessRight.create({ user: user, role: 'project-manager', project: null }).exec(cb); },
            (cb) => {
              Invite.create({ id: uuid(), user: user }).exec(function (error, invite) {
                sendInviteEmail(user, invite, cb);
              });
            },
          ],
          (error) => {
            callback(error);
          }
        );

      });

    });
  },

  inviteWithAccessRight: function (right) {
    const user = right.user;
    if (!user.email) {
      return Promise.reject("No email");
    }

    return new Promise((resolve, reject) => {
      Invite.create({ id: uuid(), user: user }).exec(function (error, invite) {
        if (error) return reject(error);

        sendInviteEmail(user, invite, function (error) {
          if (error) return reject(error);
          resolve(invite);
        });
      });

    });

  }

};
