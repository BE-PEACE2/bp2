export default function handler(req, res) {
  res.status(200).json({
    EMAIL_USER: process.env.EMAIL_USER || "Not Found",
    EMAIL_PASS: process.env.EMAIL_PASS ? "Set" : "Not Found",
    CASHFREE_APP_ID: process.env.CASHFREE_APP_ID ? "Set" : "Not Found",
    CASHFREE_SECRET_KEY: process.env.CASHFREE_SECRET_KEY ? "Set" : "Not Found",
  });
}