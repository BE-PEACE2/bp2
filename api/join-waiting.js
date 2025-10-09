// api/join-waiting.js
import connectDB from "../db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed" });
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ success: false, message: "orderId required" });

    const db = await connectDB();
    const payments = db.collection("payments"); // if you store payment verification records
    const waiting = db.collection("waiting");

    // OPTIONAL: verify payment with Cashfree server-side here using orderId.
    // If you have a payments collection with the details stored earlier, fetch and validate.
    // For now we trust the redirect but you should verify in production.
    // Example placeholder:
    // const pay = await payments.findOne({ orderId });
    // if(!pay || pay.status !== 'SUCCESS') return res.status(400).json({ success:false, message:'Payment not verified' });

    // Retrieve customer info from payments table if available; fallback to query params
    const payer = await payments.findOne({ orderId }) || {};
    const name = payer.customer_name || req.body.name || "Anonymous";
    const email = payer.customer_email || req.body.email || "";
    const phone = payer.customer_phone || req.body.phone || "";

    // Insert into waiting queue
    const doc = {
      orderId,
      name,
      email,
      phone,
      status: "waiting", // waiting | consulting | done
      createdAt: new Date(),
      calledAt: null,
      roomName: null
    };

    const insertRes = await waiting.insertOne(doc);

    // Determine position in queue (count waiting with earlier createdAt)
    const position = await waiting.countDocuments({ status: "waiting", createdAt: { $lte: doc.createdAt } });

    res.json({
      success: true,
      id: insertRes.insertedId,
      position
    });
  } catch (err) {
    console.error("join-waiting error", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}