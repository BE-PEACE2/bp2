// api/test-db.js
import connectDB from "../db.js";

export default async function handler(req, res) {
  try {
    const db = await connectDB();
    const collections = await db.listCollections().toArray();

    res.status(200).json({
      message: "✅ MongoDB Connected!",
      collections,
    });
  } catch (err) {
    console.error("❌ DB connection error:", err); // full error in logs

    res.status(500).json({
      error: "Database connection failed",
      details: err.message, // show the reason in browser
    });
  }
}