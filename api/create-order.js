import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { amount, currency, customer_name, customer_email, customer_phone } = req.body;

    if (!amount || !currency || !customer_name || !customer_email || !customer_phone) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const clientId = process.env.CASHFREE_APP_ID;
    const clientSecret = process.env.CASHFREE_SECRET_KEY;

    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: "Cashfree API keys missing" });
    }

    // ✅ Sandbox vs Production
    const baseURL =
      process.env.CASHFREE_ENV === "SANDBOX"
        ? "https://sandbox.cashfree.com/pg/orders"
        : "https://api.cashfree.com/pg/orders";

    const orderId = "ORDER_" + Date.now();
    const customerId = "CUST_" + Date.now();

    const response = await fetch(baseURL, {
      method: "POST",
      headers: {
        "x-client-id": clientId,
        "x-client-secret": clientSecret,
        "x-api-version": "2022-01-01",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        order_id: orderId,
        order_amount: amount,
        order_currency: currency,
        customer_details: {
          customer_id: customerId,
          customer_name,
          customer_email,
          customer_phone
        },
        order_meta: {
  return_url: `https://bepeace.in/success?order_id={order_id}&name=${encodeURIComponent(customer_name)}&email=${encodeURIComponent(customer_email)}&amount=${amount}&currency=${currency}`,
  cancel_url: `https://bepeace.in/cancel?order_id={order_id}&name=${encodeURIComponent(customer_name)}&email=${encodeURIComponent(customer_email)}&amount=${amount}&currency=${currency}`,
  pending_url: `https://bepeace.in/pending?order_id={order_id}&name=${encodeURIComponent(customer_name)}&email=${encodeURIComponent(customer_email)}&amount=${amount}&currency=${currency}`,
  notify_url: `https://bepeace.in/api/payment-webhook`
}
      })
    });

    const data = await response.json();
    console.log("Cashfree create-order response:", data);

    return res.status(response.status).json(data);

  } catch (err) {
    console.error("Cashfree create-order error:", err);
    return res.status(500).json({ error: err.message });
  }
}