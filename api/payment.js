// /api/payment.js
import connectDB from "../db.js";
import crypto from "crypto";

export default async function handler(req, res) {
  const { path } = req.query; // /api/payment?path=create

  try {
    const db = await connectDB();
    const payments = db.collection("payments");

    // ===== CREATE ORDER =====
    if (path === "create" && req.method === "POST") {
      const { name, email, phone, amount } = req.body;
      const orderId = "ORDER_" + Date.now();

      await payments.insertOne({
        orderId,
        name,
        email,
        phone,
        amount,
        status: "CREATED",
        createdAt: new Date(),
      });

      return res.status(200).json({ success: true, orderId });
    }

    // ===== VERIFY PAYMENT =====
    if (path === "verify" && req.method === "POST") {
      const { orderId } = req.body;
      const payment = await payments.findOne({ orderId });
      if (!payment) return res.status(404).json({ error: "Order not found" });

      await payments.updateOne({ orderId }, { $set: { status: "PAID", verifiedAt: new Date() } });
      return res.status(200).json({ success: true });
    }

    // ===== WEBHOOK (Cashfree) =====
    if (path === "webhook" && req.method === "POST") {
      const signature = req.headers["x-webhook-signature"];
      const computed = crypto
        .createHmac("sha256", process.env.CASHFREE_SECRET_KEY)
        .update(JSON.stringify(req.body))
        .digest("base64");

      if (signature !== computed) {
        return res.status(400).json({ error: "Invalid signature" });
      }

      const { order_id, order_status } = req.body.data;
      await payments.updateOne(
        { orderId: order_id },
        { $set: { status: order_status, updatedAt: new Date() } }
      );

      return res.status(200).json({ success: true });
    }

    return res.status(404).json({ error: "Invalid path" });
  } catch (err) {
    console.error("Payment API error:", err);
    res.status(500).json({ error: "Server error" });
  }
}