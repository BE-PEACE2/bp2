import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // ✅ Parse webhook body (string → JSON if needed)
    const data = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    console.log("Payment Webhook Data:", data);

    const orderId = data.order_id || "N/A";
    const status = data.order_status?.toUpperCase() || "UNKNOWN";
    const customerEmail = data.customer_details?.customer_email || "test@example.com";
    const customerName = data.customer_details?.customer_name || "Customer";
    const amount = data.order_amount || "N/A";
    const currency = data.order_currency || "INR";

    // ✅ Setup Zoho SMTP
    const transporter = nodemailer.createTransport({
      host: "smtp.zoho.in",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // ✅ Patient email template
    const patientEmailHTML = `
      <h2>Booking Confirmed ✅</h2>
      <p>Dear <strong>${customerName}</strong>,</p>
      <p>Your payment of <strong>${currency} ${amount}</strong> has been received successfully.</p>
      <p>Order ID: <strong>${orderId}</strong></p>
      <p>Status: ${status}</p>
      <p>Thank you for booking your consultation with <strong>Dr. Mahesh Yadav</strong>.</p>
    `;

    // ✅ Admin email template
    const adminEmailHTML = `
      <h2>New Booking Alert 🚀</h2>
      <p><strong>${customerName}</strong> has successfully booked a consultation.</p>
      <ul>
        <li>📧 Email: ${customerEmail}</li>
        <li>💳 Amount: ${currency} ${amount}</li>
        <li>🆔 Order ID: ${orderId}</li>
        <li>📌 Status: ${status}</li>
      </ul>
    `;

    // ✅ Send email to patient
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: customerEmail,
      subject: "Your Booking Confirmation - BE PEACE",
      html: patientEmailHTML
    });

    // ✅ Send email to admin (you)
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.ADMIN_EMAIL, // 👈 set this in Vercel ENV
      subject: "📩 New Booking - BE PEACE",
      html: adminEmailHTML
    });

    return res.status(200).json({ message: "Webhook processed, emails sent" });

  } catch (err) {
    console.error("❌ Webhook error:", err);
    return res.status(500).json({ error: err.message });
  }
}