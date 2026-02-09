require("dotenv").config();
const nodemailer = require("nodemailer");

// create transporter ONCE
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // ✅ sender account
    pass: process.env.EMAIL_PASS,
  },
});

// reusable email function
async function sendEmail({ to, subject, text }) {
  const info = await transporter.sendMail({
    from: process.env.EMAIL_USER, // ✅ sender
    to, // ✅ receiver
    subject,
    text,
  });

  console.log("📧 Email sent:", info.messageId);
}

module.exports = {
  sendEmail,
};

// This file is for testing email sending functionality. We will call sendTestEmail from server.js when a message is received, to test if email notifications work.
