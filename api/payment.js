// /api/payment.js
import connectDB from "../db.js";
import crypto from "crypto";

export default async function handler(req, res) {
  const { path } = req.query; // /api/payment?path=create

  try {
    const db = await connectDB();
    const payments = db.collection("payments");
    const bookings = db.collection("bookings");
    const locks = db.collection("slotLocks");

    // ===== CREATE ORDER =====
    if (path === "create" && req.method === "POST") {
      const { name, email, phone, amount, currency, date, slot, customer_age, customer_sex, concern } = req.body;
      if (!date || !slot) return res.status(400).json({ error: "Date and slot required" });

      const now = new Date();
      const expiry = new Date(now.getTime() + 5 * 60 * 1000); // 5-minute hold window

      // 🧹 1️⃣ Clear expired locks
      await locks.deleteMany({ expiresAt: { $lt: now } });

      // 🛑 2️⃣ Prevent double-booking or active lock
      const existingBooking = await bookings.findOne({ date, slot });
      const activeLock = await locks.findOne({ date, slot });
      if (existingBooking) return res.status(400).json({ error: "Slot already booked" });
      if (activeLock) return res.status(400).json({ error: "Slot temporarily held, please try again soon" });

      // 🟢 3️⃣ Lock the slot
      await locks.insertOne({
        date,
        slot,
        heldBy: email,
        createdAt: now,
        expiresAt: expiry,
      });

      const orderId = "ORDER_" + Date.now();
      await payments.insertOne({
        orderId,
        name,
        email,
        phone,
        amount,
        currency,
        date,
        slot,
        concern,
        status: "CREATED",
        createdAt: now,
      });

      // ✅ Return mock session for now (replace with Cashfree’s session ID in production)
      return res.status(200).json({
        success: true,
        orderId,
        payment_session_id: "mock_session_" + orderId,
      });
    }

    // ===== VERIFY PAYMENT =====
    if (path === "verify" && req.method === "POST") {
      const { orderId } = req.body;
      const payment = await payments.findOne({ orderId });
      if (!payment) return res.status(404).json({ error: "Order not found" });

      // ✅ Mark payment success
      await payments.updateOne({ orderId }, { $set: { status: "PAID", verifiedAt: new Date() } });

      // 🟢 Create booking if not exists
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

      // 🧹 Remove lock
      await locks.deleteOne({ date: payment.date, slot: payment.slot });

      return res.status(200).json({ success: true, message: "Payment verified and slot booked" });
    }

    // ===== WEBHOOK (Cashfree) =====
    if (path === "webhook" && req.method === "POST") {
      const signature = req.headers["x-webhook-signature"];
      const computed = crypto
        .createHmac("sha256", process.env.CASHFREE_SECRET_KEY)
        .update(JSON.stringify(req.body))
        .digest("base64");

      if (signature !== computed) return res.status(400).json({ error: "Invalid signature" });

      const { order_id, order_status } = req.body.data;
      const payment = await payments.findOne({ orderId: order_id });
      if (!payment) return res.status(404).json({ error: "Payment not found" });

      await payments.updateOne(
        { orderId: order_id },
        { $set: { status: order_status, updatedAt: new Date() } }
      );

      // ✅ Auto-book if payment succeeded
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

      // 🧹 Remove lock after webhook
      await locks.deleteOne({ date: payment.date, slot: payment.slot });

      return res.status(200).json({ success: true });
    }

    // ===== CLEANUP: REMOVE EXPIRED LOCKS =====
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