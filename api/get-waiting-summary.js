// /api/get-waiting-summary.js
import connectDB from "../db.js";
import jwt from "jsonwebtoken";

export default async function handler(req, res) {
  try {
    // --- Verify doctor token ---
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res.status(401).json({ success: false, message: "No token" });
    const token = authHeader.split(" ")[1];
    try {
      jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(403).json({ success: false, message: "Invalid token" });
    }

    const db = await connectDB();
    const waiting = db.collection("waiting");
    const payments = db.collection("payments");

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // --- counts from waiting list ---
    const waitingCount = await waiting.countDocuments({ status: "waiting" });
    const consultingCount = await waiting.countDocuments({ status: "consulting" });
    const completedToday = await waiting.countDocuments({
      status: "done",
      calledAt: { $gte: todayStart, $lte: todayEnd },
    });

    // --- revenue today (verified Cashfree payments only) ---
    const todayPayments = await payments
      .find({
        status: "PAID",
        createdAt: { $gte: todayStart, $lte: todayEnd },
      })
      .toArray();

    const revenueToday = todayPayments.reduce(
      (sum, p) => sum + Number(p.amount || 0),
      0
    );

    res.json({
      success: true,
      waitingCount,
      consultingCount,
      completedToday,
      revenueToday,
    });
  } catch (err) {
    console.error("get-waiting-summary error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}