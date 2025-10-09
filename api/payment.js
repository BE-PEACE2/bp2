// /api/payment.js
import connectDB from "../db.js";
import crypto from "crypto";

export default async function handler(req, res) {
  const { path } = req.query; // e.g. /api/payment?path=create

  try {
    const db = await connectDB();
    const payments = db.collection("payments");
    const bookings = db.collection("bookings");

    // ===== CREATE ORDER =====
    if (path === "create" && req.method === "POST") {
      const { name, email, phone, amount, date, slot } = req.body;
      if (!name || !email || !amount)
        return res.status(400).json({ error: "Missing required fields" });

      const orderId = "ORDER_" + Date.now();

      await payments.insertOne({
        orderId,
        name,
        email,
        phone,
        amount,
        date,
        slot,
        status: "CREATED",
        createdAt: new Date(),
      });

      // Response goes to Cashfree front-end checkout
      return res.status(200).json({ success: true, orderId });
    }

    // ===== VERIFY PAYMENT (Manual verification after checkout) =====
    if (path === "verify" && req.method === "POST") {
      const { orderId } = req.body;
      if (!orderId) return res.status(400).json({ error: "Order ID required" });

      const payment = await payments.findOne({ orderId });
      if (!payment) return res.status(404).json({ error: "Order not found" });

      // Update status
      await payments.updateOne(
        { orderId },
        { $set: { status: "PAID", verifiedAt: new Date() } }
      );

      // Auto-create booking entry if not already present
      const exists = await bookings.findOne({ orderId });
      if (!exists) {
        await bookings.insertOne({
          orderId,
          name: payment.name,
          email: payment.email,
          phone: payment.phone,
          date: payment.date,
          slot: payment.slot,
          amount: payment.amount,
          status: "PAID",
          createdAt: new Date(),
        });
      }

      return res.status(200).json({ success: true, message: "Payment verified & booking saved" });
    }

    // ===== CASHFREE WEBHOOK (Automatic Payment Update) =====
    if (path === "webhook" && req.method === "POST") {
      const signature = req.headers["x-webhook-signature"];
      const computed = crypto
        .createHmac("sha256", process.env.CASHFREE_SECRET_KEY)
        .update(JSON.stringify(req.body))
        .digest("base64");

      if (signature !== computed)
        return res.status(400).json({ error: "Invalid signature" });

      const data = req.body.data || {};
      const { order_id, order_status, order_amount, customer_details } = data;

      // Update payment record
      await payments.updateOne(
        { orderId: order_id },
        {
          $set: {
            status: order_status,
            updatedAt: new Date(),
            webhookReceived: true,
          },
        },
        { upsert: true }
      );

      // If success, also save booking
      if (order_status === "PAID" || order_status === "SUCCESS") {
        const payment = await payments.findOne({ orderId: order_id });
        if (payment) {
          const exists = await bookings.findOne({ orderId: order_id });
          if (!exists) {
            await bookings.insertOne({
              orderId: order_id,
              name: payment.name || customer_details?.customer_name || "Unknown",
              email: payment.email || customer_details?.customer_email,
              phone: payment.phone || customer_details?.customer_phone,
              date: payment.date || null,
              slot: payment.slot || null,
              amount: order_amount,
              status: "PAID",
              createdAt: new Date(),
            });
          }
        }
      }

      return res.status(200).json({ success: true });
    }

    // ===== INVALID PATH =====
    return res.status(404).json({ error: "Invalid path" });

  } catch (err) {
    console.error("❌ Payment API error:", err);
    res.status(500).json({ error: "Server error" });
  }
}