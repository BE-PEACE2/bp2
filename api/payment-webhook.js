// api/payment-webhook.js
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

   let subject, patientEmailHTML, adminEmailHTML;

    if (status === "PAID" || status === "SUCCESS") {
      // ✅ Success Email
      subject = "Your Booking Confirmation - BE PEACE";
      patientEmailHTML = `
        <h2>Booking Confirmed ✅</h2>
        <p>Dear <strong>${customerName}</strong>,</p>
        <p>Your payment of <strong>${currency} ${amount}</strong> has been received successfully.</p>
        <p>Order ID: <strong>${orderId}</strong></p>
        <p>Status: ${status}</p>
        <p>Thank you for booking your consultation with <strong>Dr. Mahesh Yadav</strong>.</p>
      `;

      adminEmailHTML = `
        <h2>New Booking Alert 🚀</h2>
        <p><strong>${customerName}</strong> has successfully booked a consultation.</p>
        <ul>
          <li>📧 Email: ${customerEmail}</li>
          <li>💳 Amount: ${currency} ${amount}</li>
          <li>🆔 Order ID: ${orderId}</li>
          <li>📌 Status: ${status}</li>
        </ul>
      `;
    } else {
      // ❌ Failed / Cancelled Email WITH Retry Button
      subject = "Your Payment Failed - BE PEACE";
      patientEmailHTML = `
        <h2>Payment Failed ❌</h2>
        <p>Dear <strong>${customerName}</strong>,</p>
        <p>Unfortunately, your payment of <strong>${currency} ${amount}</strong> could not be completed.</p>
        <p>Order ID: <strong>${orderId}</strong></p>
        <p>Status: ${status}</p>
        <p>You can retry your booking securely by clicking below:</p>
        <p>
          <a href="https://bepeace.in/booking.html" 
             style="display:inline-block;padding:12px 20px;background:#28a745;color:#fff;text-decoration:none;border-radius:6px;">
             🔄 Retry Payment
          </a>
        </p>
      `;

      adminEmailHTML = `
        <h2>⚠️ Failed Payment Alert</h2>
        <p><strong>${customerName}</strong> attempted to book but the payment failed.</p>
        <ul>
          <li>📧 Email: ${customerEmail}</li>
          <li>💳 Amount: ${currency} ${amount}</li>
          <li>🆔 Order ID: ${orderId}</li>
          <li>📌 Status: ${status}</li>
        </ul>
      `;
    }

        // ✅ Send email to patient
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: customerEmail,
      subject, // ✅ dynamic now
      html: patientEmailHTML
    });

    // ✅ Send email to admin (you)
await transporter.sendMail({
  from: process.env.EMAIL_USER,
  to: process.env.ADMIN_EMAIL, // 👈 set in Vercel ENV
  subject: status === "PAID" || status === "SUCCESS"
    ? "✅ New Booking - BE PEACE"
    : "❌ Failed Payment - BE PEACE",
  html: adminEmailHTML
});

    return res.status(200).json({ message: "Webhook processed, emails sent" });

  } catch (err) {
    console.error("❌ Webhook error:", err);
    return res.status(500).json({ error: err.message });
  }
}