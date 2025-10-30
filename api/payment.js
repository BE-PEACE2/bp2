// /api/payment.js
import bcrypt from "bcryptjs";
import connectDB from "../db.js";
import crypto from "crypto";
import axios from "axios";
import sendEmail from "../utils/sendEmail.js";
import pkg from "jspdf";
const { jsPDF } = pkg;
import autoTable from "jspdf-autotable";
import { db, authAdmin } from "../utils/firebase-admin.js";

// =====================================================
// 🔥 Save Booking to Firebase
// =====================================================
async function saveBookingToFirebase(paymentData) {
  try {
     const bookingRef = db.ref("bookings").child(paymentData.orderId); // unique node
      // 🛑 Check if already exists
    const snapshot = await bookingRef.once("value");
    if (snapshot.exists()) {
      console.log(`ℹ️ Firebase booking already exists for ${paymentData.orderId}`);
      return;
    }

    await bookingRef.set({
      order_id: paymentData.orderId,
      name: paymentData.name,
      email: paymentData.email,
      phone: paymentData.phone,
      date: paymentData.date,
      slot: paymentData.slot,
      concern: paymentData.concern,
      amount: paymentData.amount,
      status: "confirmed",
      createdAt: new Date().toISOString(),
    });
    console.log(`✅ Booking saved to Firebase for ${paymentData.email}`);
  } catch (err) {
    console.error("🔥 Firebase write error:", err.message);
  }
}

// =====================================================
// 🧠 MAIN HANDLER
// =====================================================
export default async function handler(req, res) {
  const { path } = req.query; // e.g., /api/payment?path=create

  try {
    const db = await connectDB();
    const payments = db.collection("payments");
    const bookings = db.collection("bookings");
    const users = db.collection("users");

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
      const cleanPhone = phone.replace(/\D/g, "");
      const cleanCustomerId = email.replace(/[^a-zA-Z0-9_-]/g, "_");

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
    if (req.method === "POST" && (path === "webhook" || req.headers["x-webhook-signature"])) {
      try {
        console.log("📩 Cashfree webhook received:", req.body);

        const payload = req.body?.data || req.body;
        const order_id = payload?.order?.order_id || payload?.order_id;
        const order_status = payload?.payment?.payment_status || payload?.order_status;

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
  // Reuse the same 'payment' object we already have above
  if (!payment) return res.status(404).json({ error: "Payment not found" });

  // 🛑 Prevent double-processing if already handled
  if (payment.bookingSaved) {
    console.log(`ℹ️ Booking already processed for ${order_id}`);
    return res.status(200).json({ success: true, message: "Already processed" });
  }
 
   // ✅ Mark Mongo payment as processed before anything else
          await payments.updateOne(
            { orderId: order_id },
            { $set: { bookingSaved: true, bookingConfirmedAt: new Date() } }
          );

  // ✅ Create booking in Mongo (if not already)
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

  // ✅ Save to Firebase (unique key prevents duplicates)
  await saveBookingToFirebase(payment);


  console.log(`✅ Booking confirmed and flagged for ${order_id}`);

 
          // 👤 Auto-create patient account if not exists
let existingUser = await users.findOne({ email: payment.email });
let tempPass;

// If user doesn't exist in MongoDB → create both account + Firebase Auth
if (!existingUser) {
  tempPass = Math.random().toString(36).slice(-8);
  const hashedPassword = await bcrypt.hash(tempPass, 10);

  await users.insertOne({
    name: payment.name,
    email: payment.email,
    phone: payment.phone,
    password: hashedPassword,
    createdAt: new Date(),
  });

  console.log(`👤 New patient account created: ${payment.email}`);

  // 🔐 Create Firebase Authentication user (use same password as emailed)
  try {
    await authAdmin.createUser({
      email: payment.email,
      password: tempPass,
      emailVerified: true,
      displayName: payment.name,
    });
    console.log(`✅ Firebase Auth user created for ${payment.email}`);
  } catch (error) {
    if (error.code === "auth/email-already-exists") {
      console.log(`ℹ️ Firebase user already exists: ${payment.email}`);
    } else {
      console.error("🔥 Firebase Auth creation error:", error);
    }
  }
}
         
          // 💌 Send BE PEACE Confirmation Email (only once)
          try {
            const receiptBuffer = await generateReceipt({
              ...payment,
              orderId: order_id,
            });

            const subject = "Your BE PEACE Consultation Confirmed 💚 (Receipt & Details Inside)";

            const html = `
            <table width="100%" style="font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 20px;">
              <tr><td align="center">
                <table width="600" style="background-color: #ffffff; border-radius: 10px;">
                  <tr>
                    <td style="background-color: #7de0e0; padding: 20px; text-align: center;">
                      <h2 style="color: #d81b60; margin: 0;">💙 BE PEACE</h2>
                      <p style="margin: 5px 0 0 0; color: #333;">Your Health, Your Peace</p>
                    </td>
                  </tr>
                  <tr><td style="padding: 30px; color: #333;">
                    <h3>Dear ${payment.name},</h3>
                    <p>Thank you for choosing <b>BE PEACE</b> for your consultation.<br>
                    Your appointment with <b>Dr. Mahesh Yadav</b> has been successfully confirmed.</p>

                    <h4 style="margin-top: 20px; color: #d81b60;">🩺 Consultation Details:</h4>
                    <p>
                      <b>Date & Time:</b> ${payment.date} at ${payment.slot}<br>
                      <b>Doctor:</b> Dr. Mahesh Yadav<br>
                      <b>Booking ID:</b> ${payment.orderId}<br>
                      <b>Consultation Type:</b> Video Consultation<br>
                    </p>

                    ${
                      !existingUser
                        ? `
                    <h4 style="margin-top: 20px; color: #d81b60;">👤 Your Account Details:</h4>
                    <p><b>Login Email:</b> ${payment.email}<br>
                    <b>Temporary Password:</b> ${tempPass}</p>
                    `
                        : ""
                    }

                    <p>
                      🔗 <a href="https://bepeace.in/dashboard.html"
                      style="background-color: #d81b60; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 5px;">
                      Go to Dashboard
                      </a>
                    </p>

                    <p>At your scheduled time, please log in to your BE PEACE Dashboard to view and join your consultation.</p>

<p>
  🔗 <a href="https://bepeace.in/login.html?redirect=/dashboard.html"
  style="background-color: #d81b60; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 5px;">
  Log In to Dashboard
  </a>
</p>

<p style="color:#555; margin-top:15px;">
  Once logged in, you will find your consultation details and a <b>Join Consultation</b> button in your dashboard.
</p>
                    <hr style="margin: 30px 0; border: 0; border-top: 1px solid #eee;">

                    <h4 style="color: #007b5e;">💳 Payment Details</h4>
                    <p>
                      <b>Amount Paid:</b> ₹${payment.amount}<br>
                      <b>Transaction ID:</b> ${payment.orderId}<br>
                      <b>Status:</b> ${order_status}<br>
                    </p>

                    <p style="margin-top: 20px;">
                      📄 <a href="https://bepeace.in/payment-success.html?order_id=${order_id}"
                      style="background-color: #007b5e; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 5px;">
                      View Online Receipt
                      </a>
                    </p>

                    <p style="font-size: 14px; color: #777; text-align: center;">
                      Or find the attached PDF receipt for your records.
                    </p>

                    <hr style="margin: 30px 0; border: 0; border-top: 1px solid #eee;">
                    <p style="font-size: 14px; color: #555;">
                      Thank you for trusting BE PEACE.<br>Your Health, Your Peace 🌿<br>
                      <a href="https://bepeace.in" style="color: #d81b60;">www.bepeace.in</a>
                    </p>
                  </td></tr>
                </table>
              </td></tr>
            </table>`;

            await sendEmail(payment.email, subject, html, [
              {
                filename: `BEPEACE_Receipt_${order_id}.pdf`,
                content: Buffer.from(receiptBuffer),
                contentType: "application/pdf",
              },
            ]);

            console.log(`📧 Confirmation email sent to ${payment.email}`);

            // 📨 Send one clean admin notification (only if different from patient)
if (process.env.ADMIN_EMAIL && process.env.ADMIN_EMAIL !== payment.email) {
  try {
    await sendEmail(
  process.env.ADMIN_EMAIL,
  `🩺 New BE PEACE Booking: ${payment.name}`,
  `
  <div style="font-family: Arial, sans-serif; background:#f8f9fa; padding:20px;">
    <div style="max-width:600px; margin:auto; background:#ffffff; border-radius:10px; padding:25px;">
      <h2 style="color:#d81b60; text-align:center; margin-bottom:10px;">💙 BE PEACE - New Booking Alert</h2>
      <hr style="border:0; border-top:2px solid #7de0e0; margin:15px 0;">
      <p><b>Name:</b> ${payment.name}</p>
      <p><b>Email:</b> ${payment.email}</p>
      <p><b>Phone:</b> ${payment.phone}</p>
      <p><b>Date:</b> ${payment.date}</p>
      <p><b>Slot:</b> ${payment.slot}</p>
      <p><b>Concern:</b> ${payment.concern}</p>
      <p><b>Amount:</b> ₹${payment.amount}</p>
      <p><b>Order ID:</b> ${payment.orderId}</p>
      <p><b>Status:</b> ${order_status}</p>
      <hr style="border:0; border-top:1px solid #eee; margin:20px 0;">
      <p style="text-align:center;">
        <a href="https://bepeace.in/dashboard.html"
           style="background:#d81b60; color:white; padding:10px 20px; text-decoration:none; border-radius:5px;">
           Open Dashboard
        </a>
      </p>
    </div>
  </div>
  `
);
    console.log(`📧 Admin notification sent to ${process.env.ADMIN_EMAIL}`);
  } catch (adminErr) {
    console.error("⚠️ Failed to send admin notification:", adminErr.message);
  }
}

          } catch (err) {
            console.error("⚠️ Unified email sending failed:", err.message);
          }
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
      const { order_id } = req.query;
      if (!order_id) return res.status(400).json({ error: "Order ID required" });

      const response = await fetch(`https://api.cashfree.com/pg/orders/${order_id}`, {
        headers: {
          "x-client-id": process.env.CASHFREE_APP_ID,
          "x-client-secret": process.env.CASHFREE_SECRET_KEY,
          "x-api-version": "2023-08-01",
        },
      });

      const data = await response.json();
      if (["PAID", "SUCCESS"].includes(data.order_status)) {
        await payments.updateOne(
          { orderId: order_id },
          { $set: { status: data.order_status, updatedAt: new Date() } }
        );
      }

      return res.status(200).json(data);
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

  const logoUrl = "https://bepeace.in/images/logo.svg";
  try {
    const res = await fetch(logoUrl);
    const blob = await res.blob();
    const imgBase64 = await blobToBase64(blob);
    const size = 90;
    const x = (pageWidth - size) / 2;
    const y = (pageHeight - size) / 2 - 10;
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.08 }));
    doc.addImage(imgBase64, "PNG", x, y, size, size);
    doc.restoreGraphicsState();
    doc.addImage(imgBase64, "PNG", (pageWidth - 45) / 2, 10, 45, 35);
  } catch {}

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
  doc.text("Your health, Your peace.", pageWidth / 2, msgY + 6, { align: "center" });

  const date = new Date().toLocaleString();
  const footerY = pageHeight - 25;
  doc.line(20, footerY, pageWidth - 20, footerY);
  doc.setFontSize(10);
  doc.text(`Generated on: ${date}`, 20, footerY + 6);
  doc.text("Support: info@bepeace.in", pageWidth / 2, footerY + 12, { align: "center" });

  return doc.output("arraybuffer");
}

function blobToBase64(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}