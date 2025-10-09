// /api/verify-payment.js
import connectDB from "../db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const { orderId } = req.body;
    if (!orderId)
      return res.status(400).json({ success: false, message: "orderId required" });

    // ✅ Cashfree Production Credentials
    const APP_ID = process.env.CASHFREE_APP_ID;
    const SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
    const BASE_URL = "https://api.cashfree.com/pg/orders/";

    // ✅ Fetch payment status from Cashfree (PROD)
    const verifyRes = await fetch(BASE_URL + orderId, {
      headers: {
        accept: "application/json",
        "x-api-version": "2022-09-01",
        "x-client-id": APP_ID,
        "x-client-secret": SECRET_KEY,
      },
    });

    const data = await verifyRes.json();

    if (!verifyRes.ok) {
      console.error("Cashfree verify error:", data);
      return res.status(400).json({
        success: false,
        message: data.message || "Cashfree verification failed",
      });
    }

    // ✅ Extract status
    const status = data.order_status; // values: CREATED, PAID, EXPIRED, CANCELLED

    // ✅ Update in DB (if you store payment record)
    const db = await connectDB();
    const payments = db.collection("payments");
    await payments.updateOne(
      { orderId },
      { $set: { status, verifiedAt: new Date(), raw: data } },
      { upsert: true }
    );

    // ✅ Only allow success
    if (status === "PAID") {
      return res.json({
        success: true,
        verified: true,
        orderId,
        amount: data.order_amount,
      });
    } else {
      return res.json({
        success: true,
        verified: false,
        status,
        message: "Payment not successful yet",
      });
    }
  } catch (err) {
    console.error("verify-payment error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error verifying payment" });
  }
}