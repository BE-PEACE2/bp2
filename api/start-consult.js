// api/start-consult.js
import connectDB from "../db.js";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success:false, message:"Method not allowed" });
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token provided" });
    const token = authHeader.split(" ")[1];
    jwt.verify(token, process.env.JWT_SECRET);

    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ success:false, message:"orderId required" });

    const db = await connectDB();
    const waiting = db.collection("waiting");

    // Create unique room name: BePeace_<orderId>_<random>
    const rand = randomBytes(3).toString("hex");
    const roomName = `BePeace_${orderId}_${rand}`;

    const update = await waiting.findOneAndUpdate(
      { orderId, status: "waiting" },
      { $set: { status: "consulting", calledAt: new Date(), roomName } },
      { returnDocument: "after" }
    );

    if (!update.value) {
      return res.status(400).json({ success:false, message:"Patient not found or already in consult" });
    }

    // Return roomName to doctor so they can open the room
    res.json({ success:true, roomName, orderId });
  } catch (err) {
    console.error("start-consult error", err);
    res.status(500).json({ success:false, message:"Server error" });
  }
}