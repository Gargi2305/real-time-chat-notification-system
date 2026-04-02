require("dotenv").config();
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendEmailNotification(to, fromName, message) {
  await transporter.sendMail({
    from: `"Chat App" <${process.env.EMAIL_USER}>`,
    to,
    subject: `New message from ${fromName}`,
    text: `${fromName} sent you: ${message}`,
  });

  console.log("📧 Email sent to", to);
}

module.exports = { sendEmailNotification };

// This file is for testing email sending functionality. We will call sendTestEmail from server.js when a message is received, to test if email notifications work.
