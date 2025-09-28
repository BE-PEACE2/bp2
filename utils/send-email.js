// utils/send-email.js
import nodemailer from "nodemailer";

export default async function sendEmail(to, subject, html) {
  try {
    // ✅ Setup Zoho SMTP transporter
    const transporter = nodemailer.createTransport({
      host: "smtp.zoho.in",
      port: 465,
      secure: true, // SSL
      auth: {
        user: process.env.EMAIL_USER, // e.g., no-reply@bepeace.in
        pass: process.env.EMAIL_PASS
      }
    });

    // ✅ Email details
    const mailOptions = {
      from: `"BE PEACE" <${process.env.EMAIL_USER}>`, // Friendly sender name
      replyTo: process.env.ADMIN_EMAIL, // Patient replies will go here
      to, // Recipient(s)
      subject,
      html
    };

    // ✅ Send email
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent:", info.messageId);

    return { success: true, id: info.messageId };
  } catch (err) {
    console.error("❌ Email error:", err);
    return { success: false, error: err.message };
  }
}