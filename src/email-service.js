'use strict';

const sendgrid = require('@sendgrid/mail');

function EmailService() {
  sendgrid.setApiKey(process.env.SENDGRID_API_KEY);
}

/**
 * @param {Object} from Object in the form {email:"someone@example.com", name:"Someone"} 
 * @param {*} to 
 * @param {*} subject 
 * @param {*} html 
 * @param {*} text 
 */
EmailService.prototype.send = function (from, to, subject, html, text) {
  const msg = {
    to: to,
    from: from,
    subject: subject,
    text: text,
    html: html,
  };
  return sendgrid.send(msg);
}

module.exports = {
  createEmailService: function() {
    return new EmailService();
  }
}
