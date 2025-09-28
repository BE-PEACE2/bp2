// api/payment-webhook.js
import connectDB from "../db.js";
import sendEmail from "../utils/send-email.js"; // ✅ import helper

// helper: convert "10:30 AM" slot + date → Date object
function parseSlotToDate(date, slot) {
  const [time, meridiem] = slot.split(" ");
  let [hours, minutes] = time.split(":").map(Number);
  if (meridiem === "PM" && hours !== 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;

  return new Date(`${date}T${hours.toString().padStart(2, "0")}:${minutes}:00`);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const data = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    console.log("✅ Payment Webhook Data:", data);

    const orderId = data.order_id;
    const status = data.order_status?.toUpperCase();
    const customerEmail = data.customer_details?.customer_email;
    const customerName = data.customer_details?.customer_name;
    const amount = data.order_amount;
    const currency = data.order_currency;

    // connect DB + find booking
    const db = await connectDB();
    const bookings = db.collection("bookings");
    const booking = await bookings.findOne({ order_id: orderId });

    let meetingLink = null;
    let slotStart = null;
    let slotEnd = null;

    if ((status === "PAID" || status === "SUCCESS") && booking?.date && booking?.slot) {
      // parse slot to real datetime
      slotStart = parseSlotToDate(booking.date, booking.slot);
      slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000); // +1 hr

      // ✅ FIX: add query params for consult.html
      meetingLink = `https://bepeace.in/consult.html?room=${orderId}&date=${booking.date}&slot=${encodeURIComponent(
        booking.slot
      )}&name=${encodeURIComponent(customerName)}`;
    }

    // update DB
    await bookings.updateOne(
      { order_id: orderId },
      {
        $set: {
          status,
          meetingLink,
          slotStart,
          slotEnd,
          updatedAt: new Date()
        }
      }
    );

   let subject, patientEmailHTML, adminEmailHTML;

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
         If you did not book this consultation, please ignore this email.
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
        <p style="font-size:12px;color:#666;">
         This is an auto-generated email from <b>BE PEACE</b>.  
         Please be ready to join at the scheduled time.
        </p>
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

  // ✅ Send emails using utils/send-email.js
    await sendEmail(customerEmail, subject, patientEmailHTML);
    await sendEmail(
      process.env.ADMIN_EMAIL,
      status === "PAID" || status === "SUCCESS"
        ? "✅ New Booking - BE PEACE"
        : "❌ Failed Payment - BE PEACE",
      adminEmailHTML
    );

    return res.status(200).json({ message: "Webhook processed, emails sent" });

  } catch (err) {
    console.error("❌ Webhook error:", err);
    return res.status(500).json({ error: err.message });
  }
}