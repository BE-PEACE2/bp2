// /api/payment.js
import connectDB from "../db.js";
import crypto from "crypto";
import axios from "axios";
import sendEmail from "../utils/sendEmail.js";
import pkg from "jspdf";
const { jsPDF } = pkg;
import autoTable from "jspdf-autotable";

export default async function handler(req, res) {
  const { path } = req.query; // e.g., /api/payment?path=create

  try {
    const db = await connectDB();
    const payments = db.collection("payments");
    const bookings = db.collection("bookings");

    // ===== CREATE ORDER =====
    if (path === "create" && req.method === "POST") {
      const { name, email, phone, amount, currency, date, slot, age, sex, concern } = req.body;

      if (!date || !slot)
        return res.status(400).json({ error: "Date and slot required" });

      // 🛑 Prevent double-booking
      const existingBooking = await bookings.findOne({ date, slot });
      if (existingBooking)
        return res.status(400).json({ error: "Slot already booked" });

      const orderId = "ORDER_" + Date.now();

      // 🧾 Sanitize identifiers
      const cleanPhone = phone.replace(/\D/g, "");
      const cleanCustomerId = email.replace(/[^a-zA-Z0-9_-]/g, "_");

      // 💳 Create Cashfree live order
      try {
        const response = await axios.post(
          "https://api.cashfree.com/pg/orders",
          {
            order_id: orderId,
            order_amount: Number(amount),
            order_currency: currency || "INR",
            customer_details: {
              customer_id: cleanCustomerId,
              customer_name: name,
              customer_email: email,
              customer_phone: cleanPhone,
            },
            order_meta: {
              return_url: `https://bepeace.in/payment-success.html?order_id=${orderId}`,
              notify_url: `https://bepeace.in/api/payment?path=webhook`,
            },
          },
          {
            headers: {
              "x-client-id": process.env.CASHFREE_APP_ID,
              "x-client-secret": process.env.CASHFREE_SECRET_KEY,
              "x-api-version": "2023-08-01",
              "Content-Type": "application/json",
            },
          }
        );

        const { payment_session_id } = response.data;

        // Save payment record
        await payments.insertOne({
          orderId,
          name,
          email,
          phone: cleanPhone,
          amount,
          currency,
          date,
          slot,
          concern,
          status: "CREATED",
          createdAt: new Date(),
        });

        return res.status(200).json({
          success: true,
          orderId,
          payment_session_id,
        });
      } catch (apiErr) {
        const msg = apiErr.response?.data || apiErr.message || "Cashfree API error";
        console.error("💥 Cashfree order creation failed:", msg);
        return res.status(500).json({ success: false, error: msg });
      }
    }

    // ===== WEBHOOK (Cashfree → your site) =====
    if (
      req.method === "POST" &&
      (path === "webhook" || req.headers["x-webhook-signature"])
    ) {
      try {
        console.log("📩 Cashfree webhook received:", req.body);

        // ✅ Handle Cashfree webhook data safely for both formats
        const payload = req.body?.data || req.body;
        const order_id = payload?.order?.order_id || payload?.order_id;
        const order_status = payload?.payment?.payment_status || payload?.order_status;

        console.log("🔍 Parsed webhook:", { order_id, order_status });

        if (!order_id || !order_status)
          return res.status(400).json({ error: "Invalid webhook data" });

        const payment = await payments.findOne({ orderId: order_id });
        if (!payment)
          return res.status(404).json({ error: "Payment not found" });

        await payments.updateOne(
          { orderId: order_id },
          { $set: { status: order_status, updatedAt: new Date() } }
        );

        // ✅ Auto-book if successful
        if (["PAID", "SUCCESS"].includes(order_status)) {
          await bookings.updateOne(
            { date: payment.date, slot: payment.slot },
            {
              $setOnInsert: {
                name: payment.name,
                email: payment.email,
                phone: payment.phone,
                concern: payment.concern,
                createdAt: new Date(),
              },
            },
            { upsert: true }
          );
          console.log(`✅ Booking confirmed for ${payment.date} - ${payment.slot}`);
        }

        // 💌 Send receipt email
        try {
          const receiptBuffer = await generateReceipt({
            ...payment,
            orderId: order_id,
          });

          const subject = "Your BE PEACE Consultation Receipt 💚";
          const html = `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;background:#f9f9f9;padding:20px;border-radius:10px">
              <div style="text-align:center;margin-bottom:20px">
                <img src="https://bepeace.in/images/logo.svg" width="80" alt="BE PEACE"/>
                <h2 style="color:#007b5e;margin:10px 0 0;">Consultation Confirmed</h2>
                <p style="color:#555;margin:5px 0;">Worldwide Online Teleconsultation</p>
              </div>

              <p>Dear ${payment.name},</p>
              <p>Your consultation has been successfully booked and payment received.</p>

              <h3 style="color:#007b5e">Appointment Details</h3>
              <p><b>Date:</b> ${payment.date}</p>
              <p><b>Slot:</b> ${payment.slot}</p>
              <p><b>Transaction ID:</b> ${order_id}</p>

              <hr style="border:none;border-top:1px solid #ddd;margin:15px 0">

              <p style="text-align:center;color:#007b5e;font-weight:bold;">
                💚 Thank you for trusting BE PEACE<br>Your health, Your peace.
              </p>

              <p style="text-align:center;margin-top:20px;">
                <a href="https://bepeace.in/payment-success.html?order_id=${order_id}"
                  style="background:#007b5e;color:#fff;text-decoration:none;padding:10px 20px;border-radius:5px;font-weight:bold;">
                  View Online Receipt
                </a>
              </p>

              <p style="font-size:13px;color:#888;text-align:center;margin-top:25px;">
                Need help? Contact <a href="mailto:info@bepeace.in">info@bepeace.in</a>
              </p>
            </div>
          `;

          await sendEmail(payment.email, subject, html, [
            {
              filename: `BEPEACE_Receipt_${order_id}.pdf`,
              content: Buffer.from(receiptBuffer),
              contentType: "application/pdf",
            },
          ]);

          await sendEmail(
            process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
            `New Booking - ${payment.name}`,
            html,
            [
              {
                filename: `BEPEACE_Receipt_${order_id}.pdf`,
                content: Buffer.from(receiptBuffer),
                contentType: "application/pdf",
              },
            ]
          );

          console.log(`📧 Receipt emails sent to ${payment.email} and admin`);
        } catch (err) {
          console.error("⚠️ Email sending failed:", err.message);
        }

        console.log("✅ Webhook processed successfully:", order_id);
        return res.status(200).json({ success: true });
      } catch (err) {
        console.error("💥 Webhook error:", err.message);
        return res.status(500).json({ error: err.message });
      }
    }

    // ===== VERIFY PAYMENT STATUS =====
    if (path === "verify" && req.method === "GET") {
      try {
        const { order_id } = req.query;
        if (!order_id)
          return res.status(400).json({ error: "Order ID required" });

        const response = await fetch(
          `https://api.cashfree.com/pg/orders/${order_id}`,
          {
            headers: {
              "x-client-id": process.env.CASHFREE_APP_ID,
              "x-client-secret": process.env.CASHFREE_SECRET_KEY,
              "x-api-version": "2023-08-01",
            },
          }
        );

        const data = await response.json();

        if (["PAID", "SUCCESS"].includes(data.order_status)) {
          await payments.updateOne(
            { orderId: order_id },
            { $set: { status: data.order_status, updatedAt: new Date() } }
          );
        }

        return res.status(200).json(data);
      } catch (err) {
        console.error("💥 Verification error:", err.message);
        return res.status(500).json({ error: "Verification failed" });
      }
    }

    // ===== INVALID PATH =====
    return res.status(404).json({ error: "Invalid path" });
  } catch (err) {
    console.error("❌ Payment API error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

// =====================================================
// 🧾 generateReceipt Helper
// =====================================================
async function generateReceipt(payment) {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // 💚 Watermark + Header
  const logoUrl = "https://bepeace.in/images/logo.svg";
  try {
    const res = await fetch(logoUrl);
    const blob = await res.blob();
    const imgBase64 = await blobToBase64(blob);
    const watermarkSize = 90;
    const watermarkX = (pageWidth - watermarkSize) / 2;
    const watermarkY = (pageHeight - watermarkSize) / 2 - 10;

    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.08 }));
    doc.addImage(imgBase64, "PNG", watermarkX, watermarkY, watermarkSize, watermarkSize);
    doc.restoreGraphicsState();

    doc.addImage(imgBase64, "PNG", (pageWidth - 45) / 2, 10, 45, 35);
  } catch (e) {
    console.warn("⚠️ Logo load failed:", e.message);
  }

  doc.setFontSize(18);
  doc.setTextColor(0, 100, 0);
  doc.text("BE PEACE", pageWidth / 2, 55, { align: "center" });
  doc.setFontSize(12);
  doc.text("Worldwide Online Teleconsultation", pageWidth / 2, 61, { align: "center" });
  doc.text("www.bepeace.in", pageWidth / 2, 66, { align: "center" });
  doc.setFontSize(14);
  doc.text("Consultation Receipt", pageWidth / 2, 76, { align: "center" });

  const rows = [
    ["Booking Reference", payment.orderId],
    ["Name", payment.name],
    ["Email", payment.email],
    ["Phone", payment.phone],
    ["Age", payment.age || "—"],
    ["Sex", payment.sex || "—"],
    ["Date", payment.date],
    ["Slot", payment.slot],
    ["Amount Paid", `₹${payment.amount}`],
    ["Transaction ID", payment.orderId],
  ];

  autoTable(doc, {
    startY: 82,
    head: [["Field", "Details"]],
    body: rows,
    theme: "grid",
    styles: { fontSize: 12, cellPadding: 5 },
    headStyles: { fillColor: [0, 120, 80], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 250, 245] },
  });

  const msgY = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(13);
  doc.setTextColor(0, 100, 0);
  doc.text("Thank you for trusting BE PEACE 💚", pageWidth / 2, msgY, { align: "center" });
  doc.setFontSize(11);
  doc.setTextColor(60);
  doc.text("Your health, Your peace.", pageWidth / 2, msgY + 6, { align: "center" });

  const date = new Date().toLocaleString();
  const footerY = pageHeight - 25;
  doc.setDrawColor(0, 120, 80);
  doc.line(20, footerY, pageWidth - 20, footerY);
  doc.setFontSize(10);
  doc.text(`Generated on: ${date}`, 20, footerY + 6);
  doc.text("BE PEACE | Worldwide Online Teleconsultation", pageWidth / 2, footerY + 12, { align: "center" });
  doc.text("Support: info@bepeace.in", pageWidth / 2, footerY + 17, { align: "center" });

  return doc.output("arraybuffer");
}

// Helper: blob → base64
function blobToBase64(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}