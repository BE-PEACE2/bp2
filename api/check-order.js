import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { order_id } = req.query;

    if (!order_id) {
      return res.status(400).json({ error: "Missing order_id" });
    }

    const clientId = process.env.CASHFREE_APP_ID;
    const clientSecret = process.env.CASHFREE_SECRET_KEY;

    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: "Cashfree credentials not set" });
    }

    // ✅ Switch between production and sandbox based on ENV
    const baseURL =
      process.env.CASHFREE_ENV === "SANDBOX"
        ? "https://sandbox.cashfree.com/pg/orders/"
        : "https://api.cashfree.com/pg/orders/";

    const apiURL = `${baseURL}${order_id}`;

    const response = await fetch(apiURL, {
      method: "GET",
      headers: {
        "x-client-id": clientId,
        "x-client-secret": clientSecret,
        "x-api-version": "2022-01-01"
      }
    });

    const data = await response.json();

    // Log in Vercel console for debugging
    console.log("Cashfree check-order response:", data);

    return res.status(response.status).json(data);

  } catch (err) {
    console.error("Cashfree check-order error:", err);
    return res.status(500).json({ error: err.message });
  }
}