// api/remove-unavailable.js
import connectDB from "../db.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Only POST allowed" });
    }

    const db = await connectDB();
    const unavailable = db.collection("unavailable");

    const { date } = req.body;
    if (!date) {
      return res.status(400).json({ error: "Date is required" });
    }

    await unavailable.deleteOne({ date });

    res.status(200).json({ success: true, message: `Doctor available again on ${date}` });
  } catch (err) {
    console.error("Remove unavailable error:", err);
    res.status(500).json({ error: "Failed to remove unavailable" });
  }
}