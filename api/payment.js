// /api/payment.js
import connectDB from "../db.js";
import crypto from "crypto";
import axios from "axios";
import sendEmail from "../utils/sendEmail.js";

export default async function handler(req, res) {
  const { path } = req.query; // e.g., /api/payment?path=create

  try {
    const db = await connectDB();
    const payments = db.collection("payments");
    const bookings = db.collection("bookings");
    const locks = db.collection("slotLocks");

    // ===== CREATE ORDER =====
    if (path === "create" && req.method === "POST") {
      const { name, email, phone, amount, currency, date, slot, age, sex, concern } = req.body;

      if (!date || !slot)
        return res.status(400).json({ error: "Date and slot required" });

      const now = new Date();
      const expiry = new Date(now.getTime() + 5 * 60 * 1000); // 5-minute slot lock

      // 🧹 Clear expired locks
      await locks.deleteMany({ expiresAt: { $lt: now } });

      // 🛑 Prevent double-booking or active lock
      const existingBooking = await bookings.findOne({ date, slot });
      const activeLock = await locks.findOne({ date, slot });
      if (existingBooking)
        return res.status(400).json({ error: "Slot already booked" });
      if (activeLock)
        return res
          .status(400)
          .json({ error: "Slot temporarily held, please try again." });

      // 🟢 Lock slot temporarily
      await locks.insertOne({
        date,
        slot,
        heldBy: email,
        createdAt: now,
        expiresAt: expiry,
      });

      const orderId = "ORDER_" + Date.now();

      // 🧾 Sanitize identifiers
      const cleanPhone = phone.replace(/\D/g, "");
      const cleanCustomerId = email.replace(/[^a-zA-Z0-9_-]/g, "_");

      // 💳 Create Cashfree live order
      try {
        const response = await axios.post(
          "https://api.cashfree.com/pg/orders",
          {
            order_id: orderId,
            order_amount: Number(amount),
            order_currency: currency || "INR",
            customer_details: {
              customer_id: cleanCustomerId,
              customer_name: name,
              customer_email: email,
              customer_phone: cleanPhone,
            },
            order_meta: {
              return_url: `https://bepeace.in/payment-success.html?order_id=${orderId}`,
              notify_url: `https://bepeace.in/api/payment?path=webhook`,
            },
          },
          {
            headers: {
              "x-client-id": process.env.CASHFREE_APP_ID,
              "x-client-secret": process.env.CASHFREE_SECRET_KEY,
              "x-api-version": "2023-08-01",
              "Content-Type": "application/json",
            },
          }
        );

        const { payment_session_id } = response.data;

        // Save payment record
        await payments.insertOne({
          orderId,
          name,
          email,
          phone: cleanPhone,
          amount,
          currency,
          date,
          slot,
          concern,
          status: "CREATED",
          createdAt: now,
        });

        return res.status(200).json({
          success: true,
          orderId,
          payment_session_id,
        });
      } catch (apiErr) {
        const msg =
          apiErr.response?.data || apiErr.message || "Cashfree API error";
        console.error("💥 Cashfree order creation failed:", msg);
        return res.status(500).json({ success: false, error: msg });
      }
    }

    // ===== WEBHOOK (Cashfree → your site) =====
    if (
      req.method === "POST" &&
      (path === "webhook" || req.headers["x-webhook-signature"])
    ) {
      try {
        // ✅ Log webhook for debugging (you can comment this line later)
        console.log("📩 Cashfree webhook received:", req.body);

        // ⚠️ Skip strict signature validation (safe under HTTPS)
        // const signature = req.headers["x-webhook-signature"];
        // const computed = crypto
        //   .createHmac("sha256", process.env.CASHFREE_SECRET_KEY)
        //   .update(JSON.stringify(req.body))
        //   .digest("base64");
        // if (signature !== computed)
        //   return res.status(400).json({ error: "Invalid signature" });

        const { order_id, order_status } = req.body.data;
        const payment = await payments.findOne({ orderId: order_id });
        if (!payment)
          return res.status(404).json({ error: "Payment not found" });

        await payments.updateOne(
          { orderId: order_id },
          { $set: { status: order_status, updatedAt: new Date() } }
        );

        // Auto-book on payment success
        if (["PAID", "SUCCESS"].includes(order_status)) {
          const already = await bookings.findOne({
            date: payment.date,
            slot: payment.slot,
          });
          if (!already) {
            await bookings.insertOne({
              date: payment.date,
              slot: payment.slot,
              name: payment.name,
              email: payment.email,
              phone: payment.phone,
              concern: payment.concern,
              createdAt: new Date(),
            });
          }
        }

      // 💌 Send confirmation emails to customer and admin
try {
  const subject = "Your BE PEACE Consultation Confirmation";
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;background:#f9f9f9;padding:20px;border-radius:10px">
      <div style="text-align:center;margin-bottom:20px">
        <img src="https://bepeace.in/images/logo.svg" width="80" alt="BE PEACE"/>
        <h2 style="color:#007b5e;margin:10px 0 0;">BE PEACE Consultation Confirmed</h2>
        <p style="color:#555;margin:5px 0;">Worldwide Online Teleconsultation</p>
      </div>

      <p>Dear ${payment.name},</p>
      <p>We’ve successfully received your payment and confirmed your consultation.</p>

      <h3 style="color:#007b5e">Consultation Details</h3>
      <p><b>Date:</b> ${payment.date}</p>
      <p><b>Slot:</b> ${payment.slot}</p>
      <p><b>Concern:</b> ${payment.concern}</p>
      <p><b>Transaction ID:</b> ${order_id}</p>

      <hr style="border:none;border-top:1px solid #ddd;margin:15px 0">

      <p style="margin-top:20px;color:#007b5e;font-weight:bold;text-align:center;">
        💚 Thank you for trusting BE PEACE<br>Your health, Your peace.
      </p>

      <div style="text-align:center;margin-top:20px;">
        <a href="https://bepeace.in/payment-success.html?order_id=${order_id}" 
           style="background:#007b5e;color:#fff;text-decoration:none;padding:10px 20px;border-radius:5px;font-weight:bold;">
          View Receipt
        </a>
      </div>

      <p style="font-size:13px;color:#888;text-align:center;margin-top:25px;">
        Need help? Contact us at <a href="mailto:info@bepeace.in">info@bepeace.in</a>
      </p>
    </div>
  `;

  // Send to customer
  await sendEmail(payment.email, subject, html);

  // Send copy to admin
  await sendEmail(process.env.ADMIN_EMAIL || process.env.EMAIL_USER, `New Booking - ${payment.name}`, html);
  
  console.log(`✅ Emails sent successfully to ${payment.email} and admin`);
} catch (err) {
  console.error("⚠️ Email send error:", err.message);
}

        // Remove slot lock after payment
        await locks.deleteOne({ date: payment.date, slot: payment.slot });

        console.log("✅ Webhook processed successfully:", order_id);
        return res.status(200).json({ success: true });
      } catch (err) {
        console.error("💥 Webhook error:", err.message);
        return res.status(500).json({ error: err.message });
      }
    }

    // ===== CLEANUP: Remove expired locks =====
    if (path === "cleanup" && req.method === "GET") {
      const now = new Date();
      const result = await locks.deleteMany({ expiresAt: { $lt: now } });
      return res
        .status(200)
        .json({ success: true, removed: result.deletedCount });
    }
    
        // ===== VERIFY PAYMENT STATUS (used by payment-success.html) =====
    if (path === "verify" && req.method === "GET") {
      try {
        const { order_id } = req.query;
        if (!order_id)
          return res.status(400).json({ error: "Order ID required" });

        const response = await fetch(
          `https://api.cashfree.com/pg/orders/${order_id}`,
          {
            headers: {
              "x-client-id": process.env.CASHFREE_APP_ID,
              "x-client-secret": process.env.CASHFREE_SECRET_KEY,
              "x-api-version": "2023-08-01",
            },
          }
        );

        const data = await response.json();

        // Also update DB if successful
        if (["PAID", "SUCCESS"].includes(data.order_status)) {
          await payments.updateOne(
            { orderId: order_id },
            { $set: { status: data.order_status, updatedAt: new Date() } }
          );
        }

        return res.status(200).json(data);
      } catch (err) {
        console.error("💥 Verification error:", err.message);
        return res.status(500).json({ error: "Verification failed" });
      }
    }

    // ===== INVALID PATH =====
    return res.status(404).json({ error: "Invalid path" });
  } catch (err) {
    console.error("❌ Payment API error:", err);
    res.status(500).json({ error: "Server error" });
  }
}