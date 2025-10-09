// /api/payment.js
import connectDB from "../db.js";
import crypto from "crypto";
import axios from "axios";

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

      if (!date || !slot) return res.status(400).json({ error: "Date and slot required" });

      const now = new Date();
      const expiry = new Date(now.getTime() + 5 * 60 * 1000); // 5-minute slot lock

      // 🧹 Clear expired locks
      await locks.deleteMany({ expiresAt: { $lt: now } });

      // 🛑 Prevent double-booking or active lock
      const existingBooking = await bookings.findOne({ date, slot });
      const activeLock = await locks.findOne({ date, slot });
      if (existingBooking) return res.status(400).json({ error: "Slot already booked" });
      if (activeLock) return res.status(400).json({ error: "Slot temporarily held, please try again." });

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
      const cleanPhone = phone.replace(/\D/g, ""); // only digits
      const cleanCustomerId = email.replace(/[^a-zA-Z0-9_-]/g, "_"); // safe ID

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
        const msg = apiErr.response?.data || apiErr.message || "Cashfree API error";
        console.error("💥 Cashfree order creation failed:", msg);
        return res.status(500).json({ success: false, error: msg });
      }
    }

    // ===== WEBHOOK (Cashfree → your site) =====
    if (path === "webhook" && req.method === "POST") {
      const signature = req.headers["x-webhook-signature"];

      const computed = crypto
        .createHmac("sha256", process.env.CASHFREE_SECRET_KEY)
        .update(JSON.stringify(req.body))
        .digest("base64");

      if (signature !== computed)
        return res.status(400).json({ error: "Invalid signature" });

      const { order_id, order_status } = req.body.data;
      const payment = await payments.findOne({ orderId: order_id });
      if (!payment) return res.status(404).json({ error: "Payment not found" });

      await payments.updateOne(
        { orderId: order_id },
        { $set: { status: order_status, updatedAt: new Date() } }
      );

      // Auto-book on payment success
      if (order_status === "PAID" || order_status === "SUCCESS") {
        const already = await bookings.findOne({ date: payment.date, slot: payment.slot });
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

      // Remove slot lock after payment
      await locks.deleteOne({ date: payment.date, slot: payment.slot });

      return res.status(200).json({ success: true });
    }

    // ===== CLEANUP: Remove expired locks (optional GET route) =====
    if (path === "cleanup" && req.method === "GET") {
      const now = new Date();
      const result = await locks.deleteMany({ expiresAt: { $lt: now } });
      return res.status(200).json({ success: true, removed: result.deletedCount });
    }

    // ===== INVALID PATH =====
    return res.status(404).json({ error: "Invalid path" });
  } catch (err) {
    console.error("❌ Payment API error:", err);
    res.status(500).json({ error: "Server error" });
  }
}