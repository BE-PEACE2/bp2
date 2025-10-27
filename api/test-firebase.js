import { db } from "../utils/firebase-admin.js";

export default async function handler(req, res) {
  const ref = db.ref("connection-test").push();
  await ref.set({ message: "Firebase connected ✅", timestamp: Date.now() });
  return res.status(200).json({ success: true });
}