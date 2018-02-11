const qrcode = require('qrcode');
const uuid = require('uuid/v4');

function getInviteURL(user, invite) {
  // Remember to keep this in sync with its config/routes.js counterpart.
  return `${FoundationService.websiteBaseURL()}/vott/invites/${user.id}/${invite.id}`;
}

function sendInviteEmail(user, invite, callback) {
  const inviteURL = getInviteURL(user, invite);
  const from = { name: "VoTT", email: (process.env.INVITE_EMAIL_FROM || user.email) };
  const to = { email: user.email, name: user.name };
  const text = `You have been invited to collaborate on a VoTT project.\nClick on this link ${inviteURL} to get started.\nNOTE: This link is your password - DO NOT SHARE IT.`;
  const warning = '<p>NOTE: This link is your password - DO NOT SHARE IT.</p>';
  const html = `
                    ${warning}
                    <h3>You have been invited to collaborate on a VoTT project.</h3>
                    <p>
                    Click <a href='${inviteURL}'>here</a> to get started.</a>
                    </p>
                `;

  qrcode.toDataURL(inviteURL, (error, url) => {
    if (error) return callback(error);

    const qrimage = `<p>If you have VoTT installed, scan the QR code for convenience:</p><p><img src='${url}'></p>`;
    const htmlWithQR = html + qrimage + warning;

    EmailService.send(from, to, 'VoTT collaboration', htmlWithQR, text, callback);
  });

}

function findInviteForDefaultAdmin() {
  return AccessRight.findOne({ role: 'project-manager', project: null }).populate("user").then(right => {
    if (!right) return Promise.resolve();
    return Invite.findOne({ user: right.user.id });
  });
}

function createInviteForDefaultAdmin() {
  return User.findOrCreateDefaultAdmin().then(user => {
    return AccessRight.findOrCreate(
      { user: user.id, role: 'project-manager', project: null },
      { user: user.id, role: 'project-manager', project: null }
    ).then(right => {
      return Invite.create({ id: uuid(), user: user }).then(invite => {
        return new Promise((resolve, reject) => {
          sendInviteEmail(user, invite, error => {
            if (error) return reject(error);
            resolve(invite);
          });
        });
      });
    });
  });
}

module.exports = {

  /**
   * Intended to be called from invite hook on application startup. If the
   * default admin user environment variables are set, a user is created and an
   * email is sent to the user.
   */
  findOrCreateForDefaultAdmin: function () {
    return findInviteForDefaultAdmin().then(invite => {
      if (invite) return Promise.resolve();
      return createInviteForDefaultAdmin();
    });
  },

  inviteWithAccessRight: function (right) {
    const user = right.user;
    if (!user.email) {
      return Promise.reject("No email");
    }

    return Invite.create({ id: uuid(), user: user }).then(invite => {
      console.log(`Created root invite: /vott/invites/${invite.id}/${user.id}`);
      return new Promise((resolve, reject) => {
        sendInviteEmail(user, invite, function (error) {
          if (error) return reject(error);
          resolve(invite);
        });
      });
    });

  }

};
