require("dotenv").config();

const { sendEmail } = require("./emailService");

sendEmail({
  to: process.env.TEST_RECEIVER_EMAIL,
  subject: "Reusable email service works",
  text: "This confirms the refactor is correct.",
}).catch(console.error);
