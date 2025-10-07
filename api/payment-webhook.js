// /api/payment-webhook.js
import connectDB from "../db.js";
import sendEmail from "../utils/send-email.js"; // ✅ import helper

// helper: convert "10:30 AM" slot + date → Date object
function parseSlotToDate(date, slot) {
  if (!date || !slot) return null;
  const [time, meridiem] = slot.split(" ");
  let [hours, minutes] = time.split(":").map(Number);
  if (meridiem === "PM" && hours !== 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  return new Date(`${date}T${hours.toString().padStart(2, "0")}:${minutes}:00+05:30`);
}

export default async function handler(req, res) {
  // 🧩 Reject non-POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // 🧩 Parse webhook body safely
    const data = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    console.log("✅ Payment Webhook Data:", JSON.stringify(data, null, 2));

    // 🧩 Extract core fields
    const orderId = data.order_id || data.data?.order?.order_id;
    const status =
      data.order_status?.toUpperCase() ||
      data.data?.payment?.payment_status?.toUpperCase();
    const customerEmail =
      data.customer_details?.customer_email ||
      data.data?.customer_details?.customer_email;
    const customerName =
      data.customer_details?.customer_name ||
      data.data?.customer_details?.customer_name;
    const amount = data.order_amount || data.data?.order?.order_amount;
    const currency = data.order_currency || data.data?.order?.order_currency;

    if (!orderId) {
      console.error("❌ Missing orderId in webhook data");
      return res.status(200).send("Missing orderId (ignored)");
    }

    // 🧩 Connect DB
    const db = await connectDB();
    const bookings = db.collection("bookings");
    const booking = await bookings.findOne({ order_id: orderId });

    if (!booking) {
      console.warn("⚠️ No booking found for:", orderId);
      return res.status(200).send("No booking found");
    }

    // ✅ Prevent duplicate emails
    if (booking.emailSent) {
      console.log("⚠️ Email already sent for:", orderId);
      return res.status(200).send("Already processed");
    }

    // --- MAIN PROCESS (INLINE, NO BACKGROUND) ---
    let meetingLink = null;
    let slotStart = null;
    let slotEnd = null;

    if (
      (status === "PAID" || status === "SUCCESS") &&
      booking?.date &&
      booking?.slot
    ) {
      slotStart = parseSlotToDate(booking.date, booking.slot);
      slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
      meetingLink = `https://bepeace.in/consult.html?room=${orderId}&date=${booking.date}&slot=${encodeURIComponent(
        booking.slot
      )}&name=${encodeURIComponent(customerName || "Patient")}`;
    }

    await bookings.updateOne(
      { order_id: orderId },
      {
        $set: {
          status,
          meetingLink,
          slotStart,
          slotEnd,
          updatedAt: new Date(),
        },
      }
    );

    let subject, patientEmailHTML, adminEmailHTML, doctorEmailHTML;

    if (status === "PAID" || status === "SUCCESS") {
      // ✅ Success Email
      subject = "Your Booking Confirmation - BE PEACE";

      patientEmailHTML = `
        <h2>Booking Confirmed ✅</h2>
        <p>Dear <strong>${customerName}</strong>,</p>
        <p>Your consultation is booked.</p>
        <p><b>Date:</b> ${booking?.date}</p>
        <p><b>Time:</b> ${booking?.slot}</p>
        <p><b>Amount:</b> ${currency} ${amount}</p>
        <p>You can join 20 minutes before using this secure link:</p>
        <p>
          <a href="${meetingLink}"
             style="display:inline-block;padding:12px 20px;background:#007bff;color:#fff;text-decoration:none;border-radius:6px;">
             🔗 Join Consultation
          </a>
        </p>
        <p>(Link expires 1 hour after consultation time.)</p>
        <p style="font-size:12px;color:#666;">
         This is an auto-generated email from <b>BE PEACE</b>.
        </p>
      `;

      adminEmailHTML = `
        <h2>New Booking Alert 🚀</h2>
        <p>${customerName} booked a consultation.</p>
        <ul>
          <li>📧 ${customerEmail}</li>
          <li>💳 ${currency} ${amount}</li>
          <li>🗓 ${booking?.date}</li>
          <li>⏰ ${booking?.slot}</li>
          <li>🆔 ${orderId}</li>
        </ul>
        <p>
          <a href="${meetingLink}"
             style="display:inline-block;padding:12px 20px;background:#28a745;color:#fff;text-decoration:none;border-radius:6px;">
             ✅ Doctor Join Consultation
          </a>
        </p>
      `;

      doctorEmailHTML = `
        <h2>New Consultation Scheduled 👩‍⚕️</h2>
        <p><b>Patient:</b> ${customerName}</p>
        <p><b>Date:</b> ${booking?.date}</p>
        <p><b>Time:</b> ${booking?.slot}</p>
        <p><b>Order ID:</b> ${orderId}</p>
        <p><b>Join Link:</b></p>
        <a href="${meetingLink}"
           style="display:inline-block;padding:12px 20px;background:#17a2b8;color:#fff;text-decoration:none;border-radius:6px;">
           🩺 Start Consultation
        </a>
      `;
    } else {
      // ❌ Failed Email
      subject = "Your Payment Failed - BE PEACE";
      patientEmailHTML = `
        <h2>Payment Failed ❌</h2>
        <p>Dear <strong>${customerName}</strong>,</p>
        <p>Your payment of <strong>${currency} ${amount}</strong> could not be completed.</p>
        <p><a href="https://bepeace.in/booking.html"
             style="display:inline-block;padding:12px 20px;background:#28a745;color:#fff;text-decoration:none;border-radius:6px;">
             🔄 Retry Payment
        </a></p>
      `;
      adminEmailHTML = `
        <h2>⚠️ Failed Payment Alert</h2>
        <ul>
          <li>📧 ${customerEmail}</li>
          <li>💳 ${currency} ${amount}</li>
          <li>🆔 ${orderId}</li>
          <li>📌 Status: ${status}</li>
        </ul>
      `;
    }

    try {
      console.log("📨 Sending confirmation emails...");

      if (customerEmail)
        await sendEmail(customerEmail, subject, patientEmailHTML);
      if (process.env.ADMIN_EMAIL)
        await sendEmail(
          process.env.ADMIN_EMAIL,
          status === "PAID" || status === "SUCCESS"
            ? "✅ New Booking - BE PEACE"
            : "❌ Failed Payment - BE PEACE",
          adminEmailHTML
        );
      if (process.env.DOCTOR_EMAIL && (status === "PAID" || status === "SUCCESS")) {
        await sendEmail(
          process.env.DOCTOR_EMAIL,
          "🩺 New Consultation Scheduled - BE PEACE",
          doctorEmailHTML
        );
      }

      // wait 2 seconds to ensure SMTP handshake finishes
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (emailErr) {
      console.error("⚠️ Email send error:", emailErr);
    }

    // ✅ Mark booking as processed
    await bookings.updateOne(
      { order_id: orderId },
      { $set: { emailSent: true, updatedAt: new Date() } }
    );

    console.log("✅ Emails sent & booking updated:", orderId);

    // ✅ Respond only after everything completes
    res.status(200).send("OK");

  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.status(200).send("Handled");
  }
}