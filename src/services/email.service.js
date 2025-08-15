require("dotenv").config(); // load environment variables
const nodemailer = require("nodemailer");
const { renderTemplate } = require("../emails/templateRenderer");

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const fromEmail = process.env.FROM_EMAIL || smtpUser;

function ensureEmailConfig() {
  const missing = {
    SMTP_HOST: !smtpHost,
    SMTP_PORT: !process.env.SMTP_PORT,
    SMTP_USER: !smtpUser,
    SMTP_PASS: !smtpPass,
  };
  if (!smtpHost || !smtpUser || !smtpPass) {
    const missingKeys = Object.entries(missing)
      .filter(([, v]) => v)
      .map(([k]) => k);
    throw new Error(
      `Email configuration missing: ${missingKeys.join(
        ", "
      )}. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.`
    );
  }
}

function createTransporter() {
  ensureEmailConfig();
  const secure = smtpPort === 465; // true for 465, false for other ports
  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure,
    auth: { user: smtpUser, pass: smtpPass },
  });
}

async function sendMail({ to, subject, html, text }) {
  const transporter = createTransporter();
  return transporter.sendMail({
    from: fromEmail,
    to,
    subject,
    text,
    html,
  });
}

async function sendVerificationEmail({ to, name, verifyUrl, expiresIn }) {
  const appName = process.env.APP_NAME || "Next Match";
  const subject = `${appName} • Verify your email`;
  const text = `Hi ${
    name || "there"
  },\n\nPlease verify your email by clicking the link below:\n${verifyUrl}\n\nThis link expires in ${expiresIn}.\nIf you did not request this, you can ignore this email.`;
  const html = renderTemplate("verification", {
    appName,
    footerNote:
      process.env.EMAIL_FOOTER_NOTE || `${appName} • All rights reserved`,
    year: new Date().getFullYear(),
    name: name || "there",
    verifyUrl,
    expiresIn,
  });
  return sendMail({ to, subject, text, html });
}

module.exports = { sendMail, sendVerificationEmail };
