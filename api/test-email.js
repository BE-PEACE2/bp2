// api/test-email.js
import sendEmail from "../utils/send-email.js";

export default async function handler(req, res) {
  try {
    const testRecipient = process.env.ADMIN_EMAIL || "info@bepeace.in";

    const subject = "✅ BE PEACE Email Test Successful";
    const html = `
      <h2>Test Email from BE PEACE Server</h2>
      <p>This message confirms that your Zoho SMTP setup is working correctly.</p>
      <p>✅ If you received this, your email sending system is <b>fully functional</b>.</p>
      <hr>
      <p style="font-size:12px;color:#777;">Sent automatically from BE PEACE server at ${new Date().toLocaleString()}</p>
    `;

    await sendEmail(testRecipient, subject, html);

    console.log("📨 Test email sent successfully to:", testRecipient);
    return res.status(200).json({ success: true, message: `Email sent to ${testRecipient}` });
  } catch (err) {
    console.error("❌ Test email failed:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}