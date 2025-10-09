// api/get-waiting-status.js
import connectDB from "../db.js";
import { ObjectId } from "mongodb";

export default async function handler(req, res) {
  try {
    const { orderId } = req.query;
    if (!orderId) return res.status(400).json({ success:false, message:"orderId required" });

    const db = await connectDB();
    const waiting = db.collection("waiting");

    const doc = await waiting.findOne({ orderId });
    if (!doc) return res.status(404).json({ success:false, message:"Not found" });

    // compute position in queue if still waiting
    let position = null;
    if(doc.status === "waiting") {
      position = await waiting.countDocuments({ status: "waiting", createdAt: { $lte: doc.createdAt } });
    }

    res.json({
      success: true,
      status: doc.status,
      position,
      roomName: doc.roomName || null
    });
  } catch (err) {
    console.error("get-waiting-status error", err);
    res.status(500).json({ success:false, message:"Server error" });
  }
}