'use strict';

const sendgrid = require('@sendgrid/mail');

sendgrid.setApiKey(process.env.SENDGRID_API_KEY);

module.exports = {

  /**
   * @param {Object} from Object in the form {email:"someone@example.com", name:"Someone"} 
   * @param {*} to 
   * @param {*} subject 
   * @param {*} html 
   * @param {*} text 
   */
  send: function (from, to, subject, html, text, callback) {
    const msg = {
      to: to,
      from: from,
      subject: subject,
      text: text,
      html: html,
    };
    return sendgrid.send(msg, false, callback);
  }
}
