// /api/doctor.js
import connectDB from "../db.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

export default async function handler(req, res) {
  const { path } = req.query; // example: /api/doctor?path=login

  try {
    const db = await connectDB();

    // ===== LOGIN =====
    if (path === "login" && req.method === "POST") {
      const { email, password } = req.body;
      if (!email || !password)
        return res.status(400).json({ error: "Email and password required" });

      const doctor = await db.collection("doctors").findOne({ email });
      if (!doctor) return res.status(404).json({ error: "Doctor not found" });

      const match = await bcrypt.compare(password, doctor.passwordHash);
      if (!match) return res.status(401).json({ error: "Invalid password" });

      const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "12h" });
      return res.status(200).json({ token });
    }

    // ===== GET BOOKINGS =====
    if (path === "bookings" && req.method === "GET") {
      const authHeader = req.headers.authorization;
      if (!authHeader)
        return res.status(401).json({ error: "Unauthorized" });

      const token = authHeader.split(" ")[1];
      jwt.verify(token, process.env.JWT_SECRET);

      const bookings = await db.collection("bookings").find().sort({ date: 1, slot: 1 }).toArray();
      return res.status(200).json({ bookings });
    }

    return res.status(404).json({ error: "Invalid path" });
  } catch (err) {
    console.error("Doctor API error:", err);
    res.status(500).json({ error: "Server error" });
  }
}