// /api/payment.js
import connectDB from "../db.js";
import crypto from "crypto";
import axios from "axios";

export default async function handler(req, res) {
  const { path } = req.query; // /api/payment?path=create

  try {
    const db = await connectDB();
    const payments = db.collection("payments");
    const bookings = db.collection("bookings");
    const locks = db.collection("slotLocks");

    // =====================================================
    // 🟢 CREATE ORDER (called from frontend)
    // =====================================================
    if (path === "create" && req.method === "POST") {
      const { name, email, phone, amount, currency, date, slot, age, sex, concern } = req.body;
      if (!date || !slot) return res.status(400).json({ error: "Date and slot required" });

      const now = new Date();
      const expiry = new Date(now.getTime() + 5 * 60 * 1000); // 5-minute slot hold

      // Clean expired locks
      await locks.deleteMany({ expiresAt: { $lt: now } });

      // Prevent double-booking
      const existingBooking = await bookings.findOne({ date, slot });
      const activeLock = await locks.findOne({ date, slot });
      if (existingBooking) return res.status(400).json({ error: "Slot already booked" });
      if (activeLock) return res.status(400).json({ error: "Slot temporarily held, please try again soon" });

      // Lock slot
      await locks.insertOne({
        date,
        slot,
        heldBy: email,
        createdAt: now,
        expiresAt: expiry,
      });

      // Unique order
      const orderId = "ORDER_" + Date.now();

      // 💳 Create LIVE Cashfree order
      const response = await axios.post(
        "https://api.cashfree.com/pg/orders",
        {
          order_id: orderId,
          order_amount: amount,
          order_currency: currency,
          order_note: `Consultation booking for ${name} (${email})`,
          customer_details: {
            customer_id: phone,
            customer_name: name,
            customer_email: email,
            customer_phone: phone,
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
            "Content-Type": "application/json",
          },
        }
      );

      const { payment_session_id } = response.data;

      await payments.insertOne({
        orderId,
        name,
        email,
        phone,
        amount,
        currency,
        date,
        slot,
        age,
        sex,
        concern,
        status: "CREATED",
        createdAt: now,
      });

      return res.status(200).json({
        success: true,
        orderId,
        payment_session_id,
      });
    }

    // =====================================================
    // 🟢 VERIFY PAYMENT (manual verification after success)
    // =====================================================
    if (path === "verify" && req.method === "POST") {
      const { orderId } = req.body;
      const payment = await payments.findOne({ orderId });
      if (!payment) return res.status(404).json({ error: "Order not found" });

      await payments.updateOne(
        { orderId },
        { $set: { status: "PAID", verifiedAt: new Date() } }
      );

      const existingBooking = await bookings.findOne({ date: payment.date, slot: payment.slot });
      if (!existingBooking) {
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

      await locks.deleteOne({ date: payment.date, slot: payment.slot });
      return res.status(200).json({ success: true, message: "Payment verified and slot booked" });
    }

    // =====================================================
    // 🟢 WEBHOOK (Cashfree → auto payment confirmation)
    // =====================================================
    if (path === "webhook" && req.method === "POST") {
      // Log for debugging
      console.log("🔔 Cashfree Webhook Received:", req.body);

      const signature = req.headers["x-webhook-signature"];
      if (!signature) return res.status(400).json({ error: "Missing signature" });

      const computed = crypto
        .createHmac("sha256", process.env.CASHFREE_SECRET_KEY)
        .update(JSON.stringify(req.body))
        .digest("base64");

      if (signature !== computed)
        return res.status(400).json({ error: "Invalid signature" });

      if (!req.body?.data)
        return res.status(400).json({ error: "Invalid webhook data" });

      const { order_id, order_status } = req.body.data;
      const payment = await payments.findOne({ orderId: order_id });
      if (!payment) return res.status(404).json({ error: "Payment not found" });

      await payments.updateOne(
        { orderId: order_id },
        { $set: { status: order_status, updatedAt: new Date() } }
      );

      // Handle success
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
        await locks.deleteOne({ date: payment.date, slot: payment.slot });
      }

      // Handle failure or cancellation
      else if (order_status === "FAILED" || order_status === "CANCELLED") {
        await payments.updateOne(
          { orderId: order_id },
          { $set: { status: "FAILED", updatedAt: new Date() } }
        );
        await locks.deleteOne({ date: payment.date, slot: payment.slot });
      }

      return res.status(200).json({ success: true });
    }

    // =====================================================
    // 🟢 CLEANUP: Remove expired locks
    // =====================================================
    if (path === "cleanup" && req.method === "GET") {
      const now = new Date();
      const result = await locks.deleteMany({ expiresAt: { $lt: now } });
      return res.status(200).json({ success: true, removed: result.deletedCount });
    }

    // =====================================================
    // ❌ INVALID PATH
    // =====================================================
    return res.status(404).json({ error: "Invalid path" });
  } catch (err) {
    console.error("❌ Payment API error:", err.response?.data || err.message);
    return res.status(500).json({ error: "Server error" });
  }
}