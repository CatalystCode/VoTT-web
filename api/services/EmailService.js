'use strict';

let sendgrid;

function emailServiceEnabled() {
  if (!sails.config.hasOwnProperty('emailServiceEnabled')) {
    return true;
  }

  return sails.config.emailServiceEnabled;
}

function getSendgrid() {
  if (sendgrid) {
    return sendgrid;
  }

  if (!emailServiceEnabled()) {
    return null;
  }

  sendgrid = require('@sendgrid/mail');
  sendgrid.setApiKey(process.env.SENDGRID_API_KEY);
  return sendgrid;
}

module.exports = {

  /**
   * @param {Object} from Object in the form {email:"someone@example.com", name:"Someone"} 
   * @param {*} to 
   * @param {*} subject 
   * @param {*} html 
   * @param {*} text 
   */
  send: function (from, to, subject, html, text, callback) {
    const sg = getSendgrid();
    if (!sg) {
      return callback();
    }

    const msg = {
      to: to,
      from: from,
      subject: subject,
      text: text,
      html: html,
    };
    return sg.send(msg, false, callback);
  }
}
