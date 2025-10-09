// /api/create-order-walkin.js
import connectDB from "../db.js";

// -----------  PRODUCTION-READY  -----------
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const { name, email, phone, amount = 499, purpose } = req.body;
    if (!name)
      return res.status(400).json({ success: false, message: "Patient name required" });

    // ✅ Cashfree Production Credentials (set in environment)
    const APP_ID = process.env.CASHFREE_APP_ID;
    const SECRET_KEY = process.env.CASHFREE_SECRET_KEY;

    // ✅ Cashfree PROD endpoint
    const BASE_URL = "https://api.cashfree.com/pg/orders";

    const orderId = "BEPEACE_" + Date.now(); // unique order ID

    // ✅ Order payload
    const payload = {
      order_id: orderId,
      order_amount: amount,
      order_currency: "INR",
      customer_details: {
        customer_id: "CUST_" + Date.now(),
        customer_name: name,
        customer_email: email || "noemail@bepeace.in",
        customer_phone: phone || "0000000000",
      },
      order_meta: {
        // Redirect back to BE PEACE site after successful payment
        return_url: `https://bepeace.in/consult.html?payment=success&orderId=${orderId}`,
      },
      order_note: purpose || "Virtual Consultation",
    };

    // ✅ Create Cashfree order
    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-api-version": "2022-09-01",
        "x-client-id": APP_ID,
        "x-client-secret": SECRET_KEY,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok || !data.payment_link) {
      console.error("Cashfree error:", data);
      return res
        .status(400)
        .json({ success: false, message: data.message || "Cashfree order error" });
    }

    // ✅ (Optional) Store minimal record in MongoDB
    const db = await connectDB();
    const payments = db.collection("payments");
    await payments.insertOne({
      orderId,
      name,
      email,
      phone,
      amount,
      purpose,
      status: "PENDING",
      paymentLink: data.payment_link,
      createdAt: new Date(),
    });

    // ✅ Send payment link back to frontend
    return res.status(200).json({
      success: true,
      orderId,
      paymentUrl: data.payment_link,
    });
  } catch (err) {
    console.error("Cashfree create-order error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error creating Cashfree order" });
  }
}