// api/set-unavailable.js
import connectDB from "../db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const db = await connectDB();
    const unavailable = db.collection("unavailable");

    const { date, reason } = req.body;
    if (!date) {
      return res.status(400).json({ error: "Date is required" });
    }

    await unavailable.updateOne(
      { date },
      { $set: { reason: reason || "Doctor unavailable" } },
      { upsert: true }
    );

    res.status(200).json({ message: "Doctor marked unavailable", date, reason });
  } catch (err) {
    console.error("Set unavailable error:", err);
    res.status(500).json({ error: "Failed to update availability" });
  }
}