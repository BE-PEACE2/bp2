// api/create-order.js
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
    } = req.body;

    // 🔒 Validate required fields
    if (!amount || !currency || !customer_name || !customer_email || !customer_phone) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const clientId = process.env.CASHFREE_APP_ID;
    const clientSecret = process.env.CASHFREE_SECRET_KEY;

    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: "Cashfree API keys missing" });
    }

    // ✅ Always LIVE endpoint (not sandbox)
    const baseURL = "https://api.cashfree.com/pg/orders";

    const orderId = "ORDER_" + Date.now();
    const customerId = "CUST_" + Date.now();

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
          customer_phone,
        },
        order_meta: {
          // Always redirect user to pending page after payment attempt
          return_url: `https://bepeace.in/pending.html?order_id=${orderId}&name=${encodeURIComponent(
            customer_name
          )}&email=${encodeURIComponent(customer_email)}&phone=${encodeURIComponent(
            customer_phone
          )}&age=${encodeURIComponent(customer_age)}&sex=${encodeURIComponent(
            customer_sex
          )}&amount=${amount}&currency=${currency}`,

          // Cashfree will notify backend
          notify_url: "https://bepeace.in/api/payment-webhook",
        },
      }),
    });

    const data = await response.json();
    console.log("✅ Cashfree create-order response:", data);

    return res.status(response.status).json(data);
  } catch (err) {
    console.error("❌ Cashfree create-order error:", err);
    return res.status(500).json({ error: err.message });
  }
}