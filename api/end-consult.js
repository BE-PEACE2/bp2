// /api/end-consult.js
import connectDB from "../db.js";
import jwt from "jsonwebtoken";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    // 🔐 Verify doctor token
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res.status(401).json({ success: false, message: "No token" });

    const token = authHeader.split(" ")[1];
    try {
      jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(403).json({ success: false, message: "Invalid or expired token" });
    }

    const { orderId } = req.body;
    if (!orderId)
      return res.status(400).json({ success: false, message: "orderId required" });

    const db = await connectDB();
    const waiting = db.collection("waiting");

    // ✅ Mark as done
    const result = await waiting.findOneAndUpdate(
      { orderId },
      {
        $set: {
          status: "done",
          completedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );

    if (!result.value) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    // ✅ Response
    res.json({
      success: true,
      message: "Consultation ended successfully",
      orderId,
    });
  } catch (err) {
    console.error("end-consult error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}