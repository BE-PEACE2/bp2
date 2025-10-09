// /api/waiting.js
import connectDB from "../db.js";
import jwt from "jsonwebtoken";

export default async function handler(req, res) {
  const { path } = req.query; // e.g., /api/waiting?path=join

  try {
    const db = await connectDB();
    const waiting = db.collection("waiting");
    const payments = db.collection("payments");

    // ===== JOIN WAITING LIST =====
    if (path === "join" && req.method === "POST") {
      const { orderId, name, email, phone } = req.body;
      if (!orderId) return res.status(400).json({ error: "Order ID required" });

      // Check if already in queue
      const existing = await waiting.findOne({ orderId, status: { $ne: "done" } });
      if (existing)
        return res.status(200).json({ success: true, message: "Already in waiting list" });

      // Optional: Verify payment status
      const payment = await payments.findOne({ orderId });
      if (!payment || !["PAID", "SUCCESS"].includes(payment.status)) {
        return res.status(400).json({ error: "Payment not verified" });
      }

      await waiting.insertOne({
        orderId,
        name,
        email,
        phone,
        status: "waiting",
        createdAt: new Date(),
      });

      return res.status(200).json({ success: true, message: "Added to waiting list" });
    }

    // ===== GET WAITING LIST =====
    if (path === "list" && req.method === "GET") {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

      const token = authHeader.split(" ")[1];
      jwt.verify(token, process.env.JWT_SECRET);

      const waitingList = await waiting
        .find({ status: { $ne: "done" } })
        .sort({ createdAt: 1 })
        .toArray();

      const enhanced = waitingList.map((p, i) => ({
        ...p,
        position: i + 1,
      }));

      return res.status(200).json({ success: true, waiting: enhanced });
    }

    // ===== GET SUMMARY =====
    if (path === "summary" && req.method === "GET") {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const waitingCount = await waiting.countDocuments({ status: "waiting" });
      const consultingCount = await waiting.countDocuments({ status: "consulting" });
      const completedToday = await waiting.countDocuments({
        status: "done",
        completedAt: { $gte: todayStart },
      });

      // Optional: link with payments for daily revenue
      const paymentsToday = await payments
        .aggregate([
          {
            $match: {
              status: { $in: ["PAID", "SUCCESS"] },
              verifiedAt: { $gte: todayStart },
            },
          },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ])
        .toArray();

      const revenueToday = paymentsToday.length > 0 ? paymentsToday[0].total : 0;

      return res.status(200).json({
        success: true,
        waitingCount,
        consultingCount,
        completedToday,
        revenueToday,
      });
    }

    // ===== START CONSULT =====
    if (path === "start" && req.method === "POST") {
      const { orderId } = req.body;
      if (!orderId) return res.status(400).json({ error: "Order ID required" });

      const roomName = `BEPEACE_${orderId}`;
      await waiting.updateOne(
        { orderId },
        { $set: { status: "consulting", roomName, calledAt: new Date() } }
      );

      return res.status(200).json({ success: true, roomName });
    }

    // ===== END CONSULT =====
    if (path === "end" && req.method === "POST") {
      const { orderId } = req.body;
      if (!orderId) return res.status(400).json({ error: "Order ID required" });

      await waiting.updateOne(
        { orderId },
        { $set: { status: "done", completedAt: new Date() } }
      );

      return res.status(200).json({ success: true, message: "Consultation ended" });
    }

    // ===== INVALID PATH =====
    return res.status(404).json({ error: "Invalid path" });

  } catch (err) {
    console.error("❌ Waiting API error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}