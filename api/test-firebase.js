import { db } from "../utils/firebase-admin.js";

export default async function handler(req, res) {
  try {
    const ref = db.ref("connection-test").push();
    await ref.set({
      message: "Firebase connected ✅",
      timestamp: new Date().toISOString(),
    });
    res.status(200).json({ success: true, message: "Firebase connected ✅" });
  } catch (error) {
    console.error("🔥 Firebase test error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}