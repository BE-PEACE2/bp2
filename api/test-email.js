import sendEmail from "../utils/send-email.js";

export default async function handler(req, res) {
  try {
    const result = await sendEmail(
      "drmaheshyadav010145@gmail.com",
      "✅ Test Email from BE PEACE",
      "<p>If you see this, your Zoho SMTP works perfectly!</p>"
    );
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}