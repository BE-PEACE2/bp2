import nodemailer from "nodemailer";

// Reuse transporter to avoid reconnecting every time
let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: "smtp.zoho.in",
      port: 465,
      secure: true, // SSL
      auth: {
        user: process.env.EMAIL_USER, // e.g. info@bepeace.in
        pass: process.env.EMAIL_PASS,
      },
      pool: true,              // Keep connection open
      maxConnections: 3,       // Reuse up to 3 concurrent SMTP connections
      connectionTimeout: 10000 // 10s timeout
    });
  }
  return transporter;
}

export default async function sendEmail(to, subject, html, attempt = 1) {
  try {
    const mailOptions = {
      from: `"BE PEACE" <${process.env.EMAIL_USER}>`,
      to,
      replyTo: process.env.ADMIN_EMAIL,
      subject,
      html,
    };

    const transporter = getTransporter();

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${to} (id: ${info.messageId})`);
    return { success: true, id: info.messageId };
  } catch (err) {
    console.error(`❌ Email send error (attempt ${attempt}) →`, err.message);

    // 🌀 Retry once automatically after 2 seconds
    if (attempt < 2) {
      console.log("🔁 Retrying email to", to);
      await new Promise((r) => setTimeout(r, 2000));
      return sendEmail(to, subject, html, attempt + 1);
    }

    // ❗After retry, give up but return safely
    return { success: false, error: err.message };
  }
}