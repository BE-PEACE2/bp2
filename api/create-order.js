// api/create-order.js
import connectDB from "../db.js";
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const {
      amount,
      currency,
      customer_name,
      customer_email,
      customer_phone,
      customer_age,
      customer_sex,
      date,
      slot
    } = req.body;

    // 🔒 Validate required fields
    if (
      !amount ||
      !currency ||
      !customer_name ||
      !customer_email ||
      !customer_phone ||
      !date ||
      !slot
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const clientId = process.env.CASHFREE_APP_ID;
    const clientSecret = process.env.CASHFREE_SECRET_KEY;

    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: "Cashfree API keys missing" });
    }

    // ✅ Always LIVE endpoint
    const baseURL = "https://api.cashfree.com/pg/orders";

    const orderId = "BEPEACE_" + Date.now();
    const customerId = "CUST_" + Date.now();

    // ✅ Fix phone formatting (add +91 if only 10 digits)
    let formattedPhone = customer_phone.trim();
    if (/^\d{10}$/.test(formattedPhone)) {
      formattedPhone = "+91" + formattedPhone;
    }

     // ✅ Normalize slot for DB (match get-slots)
    const normalizedSlot = slot.trim().toUpperCase();

    // ✅ Save pending booking in MongoDB
    const db = await connectDB();
    const bookings = db.collection("bookings");
    await bookings.insertOne({
      order_id: orderId,
      customer_name,
      customer_email,
      customer_phone: formattedPhone,
      customer_age,
      customer_sex,
      date,
      slot: normalizedSlot,
      amount,
      currency,
      status: "PENDING",
      createdAt: new Date(),
    });

    // 🔗 Create order on Cashfree
    const response = await fetch(baseURL, {
      method: "POST",
      headers: {
        "x-client-id": clientId,
        "x-client-secret": clientSecret,
        "x-api-version": "2022-09-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        order_id: orderId,
        order_amount: amount,
        order_currency: currency,
        customer_details: {
          customer_id: customerId,
          customer_name,
          customer_email,
          customer_phone: formattedPhone,
        },
        order_meta: {
          // ✅ Redirect page after payment
          return_url: `https://bepeace.in/payment-success.html?order_id=${orderId}&status={order_status}`,
          // ✅ Webhook for auto-update
          notify_url: "https://bepeace.in/api/payment-webhook",
        },
      }),
    });

    const cfData = await response.json();
    console.log("💳 Cashfree create-order:", cfData);

    if (cfData.payment_session_id) {
      return res.status(200).json({
        payment_session_id: cfData.payment_session_id,
        order_id: orderId,
      });
    } else {
      return res.status(400).json({
        error: "Failed to create order",
        details: cfData,
      });
    }
  } catch (err) {
    console.error("❌ create-order error:", err);
    return res.status(500).json({ error: err.message });
  }
}