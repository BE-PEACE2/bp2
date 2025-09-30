// api/doctor-login.js
import jwt from "jsonwebtoken";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { email, password } = req.body;

    // Check credentials against .env
    if (
      email === process.env.DOCTOR_EMAIL &&
      password === process.env.DOCTOR_PASSWORD
    ) {
      // Create JWT token valid for 12 hours
      const token = jwt.sign(
        { email, role: "doctor" },
        process.env.JWT_SECRET,
        { expiresIn: "12h" }
      );

      return res.status(200).json({ success: true, token });
    } else {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }
  } catch (err) {
    console.error("❌ Login error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}