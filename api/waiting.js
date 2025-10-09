// /api/waiting.js
import connectDB from "../db.js";
import jwt from "jsonwebtoken";

export default async function handler(req, res) {
  const { path } = req.query; // /api/waiting?path=join

  try {
    const db = await connectDB();
    const waiting = db.collection("waiting");

    // ===== JOIN WAITING LIST =====
    if (path === "join" && req.method === "POST") {
      const { orderId, name, email, phone } = req.body;
      if (!orderId) return res.status(400).json({ error: "Order ID required" });

      await waiting.insertOne({
        orderId,
        name,
        email,
        phone,
        status: "waiting",
        createdAt: new Date(),
      });

      return res.status(200).json({ success: true });
    }

    // ===== GET WAITING LIST =====
    if (path === "list" && req.method === "GET") {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
      const token = authHeader.split(" ")[1];
      jwt.verify(token, process.env.JWT_SECRET);

      const waitingList = await waiting.find({ status: { $ne: "done" } }).sort({ createdAt: 1 }).toArray();
      const enhanced = waitingList.map((p, i) => ({
        ...p,
        position: i + 1,
      }));

      return res.status(200).json({ success: true, waiting: enhanced });
    }

    // ===== GET SUMMARY =====
    if (path === "summary" && req.method === "GET") {
      const today = new Date().toISOString().split("T")[0];
      const waitingCount = await waiting.countDocuments({ status: "waiting" });
      const consultingCount = await waiting.countDocuments({ status: "consulting" });
      const completedToday = await waiting.countDocuments({
        status: "done",
        completedAt: { $gte: new Date(today) },
      });

      return res.status(200).json({
        success: true,
        waitingCount,
        consultingCount,
        completedToday,
        revenueToday: 0, // (optional, if you want to link payments here)
      });
    }

    // ===== START CONSULT =====
    if (path === "start" && req.method === "POST") {
      const { orderId } = req.body;
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
      await waiting.updateOne(
        { orderId },
        { $set: { status: "done", completedAt: new Date() } }
      );
      return res.status(200).json({ success: true });
    }

    return res.status(404).json({ error: "Invalid path" });
  } catch (err) {
    console.error("Waiting API error:", err);
    res.status(500).json({ error: "Server error" });
  }
}