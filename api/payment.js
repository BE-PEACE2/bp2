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
      country: paymentData.country || "Unknown",
      flag: paymentData.flag || "fi fi-xx",
      status: "confirmed",
      createdAt: new Date().toISOString(),
    });
    console.log(`✅ Booking saved to Firebase for ${paymentData.email}`);
  } catch (err) {
    console.error("🔥 Firebase write error:", err.message);
  }
}

// =====================================================
// Helper to run downstream booking/account/email process
// (used by both Cashfree webhook and PayPal IPN)
// =====================================================
async function processSuccessfulPayment(paymentsCollection, bookingsCollection, usersCollection, paymentDoc, order_status = "PAID") {
  const order_id = paymentDoc.orderId;

  // Prevent double-processing
  if (paymentDoc.bookingSaved) {
    console.log(`ℹ️ Booking already processed for ${order_id}`);
    return;
  }

  // mark processed
  await paymentsCollection.updateOne(
    { orderId: order_id },
    { $set: { bookingSaved: true, bookingConfirmedAt: new Date(), status: order_status } }
  );

  // Create booking in Mongo (idempotent upsert)
  await bookingsCollection.updateOne(
    { date: paymentDoc.date, slot: paymentDoc.slot },
    {
      $setOnInsert: {
        name: paymentDoc.name,
        email: paymentDoc.email,
        phone: paymentDoc.phone,
        concern: paymentDoc.concern,
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );

  // Save to Firebase
  await saveBookingToFirebase(paymentDoc);

  console.log(`✅ Booking confirmed and flagged for ${order_id}`);

  // Auto-create patient account if not exists
  let existingUser = await usersCollection.findOne({ email: paymentDoc.email });
  let tempPass;

  if (!existingUser) {
    tempPass = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPass, 10);

    await usersCollection.insertOne({
      name: paymentDoc.name,
      email: paymentDoc.email,
      phone: paymentDoc.phone,
      password: hashedPassword,
      createdAt: new Date(),
    });

    console.log(`👤 New patient account created: ${paymentDoc.email}`);

    // Create Firebase Authentication user
    try {
      await authAdmin.createUser({
        email: paymentDoc.email,
        password: tempPass,
        emailVerified: true,
        displayName: paymentDoc.name,
      });
      console.log(`✅ Firebase Auth user created for ${paymentDoc.email}`);
    } catch (error) {
      if (error.code === "auth/email-already-exists") {
        console.log(`ℹ️ Firebase user already exists: ${paymentDoc.email}`);
      } else {
        console.error("🔥 Firebase Auth creation error:", error);
      }
    }
  }

  // Send confirmation email (receipt PDF)
  try {
    const receiptBuffer = await generateReceipt({
      ...paymentDoc,
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
              <h3>Dear ${paymentDoc.name},</h3>
              <p>Thank you for choosing <b>BE PEACE</b> for your consultation.<br/>
              Your appointment with <b>Dr. Mahesh Yadav</b> has been successfully confirmed.</p>

              <h4 style="margin-top: 20px; color: #d81b60;">🩺 Consultation Details:</h4>
              <p>
                <b>Date & Time:</b> ${paymentDoc.date} at ${paymentDoc.slot}<br/>
                <b>Doctor:</b> Dr. Mahesh Yadav<br/>
                <b>Booking ID:</b> ${paymentDoc.orderId}<br/>
                <b>Consultation Type:</b> Video Consultation<br/>
              </p>

              ${!existingUser ? `
                <h4 style="margin-top: 20px; color: #d81b60;">👤 Your Account Details:</h4>
                <p><b>Login Email:</b> ${paymentDoc.email}<br/><b>Temporary Password:</b> ${tempPass}</p>
              ` : ""}

              <p>
                🔗 <a href="https://bepeace.in/dashboard.html"
                style="background-color: #d81b60; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 5px;">
                Go to Dashboard
                </a>
              </p>

              <p>At your scheduled time, please log in to your BE PEACE Dashboard to view and join your consultation.</p>

              <p style="color:#555; margin-top:15px;">
                Once logged in, you will find your consultation details and a <b>Join Consultation</b> button in your dashboard.
              </p>

              <hr style="margin: 30px 0; border: 0; border-top: 1px solid #eee;">
              <h4 style="color: #007b5e;">💳 Payment Details</h4>
              <p>
                <b>Amount Paid:</b> ${paymentDoc.currency === "INR" ? "₹" : "$"}${paymentDoc.amount}<br/>
                <b>Transaction ID:</b> ${paymentDoc.orderId}<br/>
                <b>Status:</b> ${order_status}<br/>
              </p>

              <p style="margin-top: 20px;">
                📄 <a href="https://bepeace.in/payment-success.html?order_id=${paymentDoc.orderId}"
                style="background-color: #007b5e; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 5px;">
                View Online Receipt
                </a>
              </p>

              <p style="font-size: 14px; color: #777; text-align: center;">
                Or find the attached PDF receipt for your records.
              </p>

              <hr style="margin: 30px 0; border: 0; border-top: 1px solid #eee;">
              <p style="font-size: 14px; color: #555;">
                Thank you for trusting BE PEACE.<br/>Your Health, Your Peace 🌿<br/>
                <a href="https://bepeace.in" style="color: #d81b60;">www.bepeace.in</a>
              </p>
            </td></tr>
          </table>
        </td></tr>
      </table>`;

    await sendEmail(paymentDoc.email, subject, html, [
      {
        filename: `BEPEACE_Receipt_${order_id}.pdf`,
        content: Buffer.from(receiptBuffer),
        contentType: "application/pdf",
      },
    ]);

    console.log(`📧 Confirmation email sent to ${paymentDoc.email}`);

    // Admin notification
    if (process.env.ADMIN_EMAIL && process.env.ADMIN_EMAIL !== paymentDoc.email) {
      try {
        await sendEmail(
          process.env.ADMIN_EMAIL,
          `🩺 New BE PEACE Booking: ${paymentDoc.name}`,
          `
          <div style="font-family: Arial, sans-serif; background:#f8f9fa; padding:20px;">
            <div style="max-width:600px; margin:auto; background:#ffffff; border-radius:10px; padding:25px;">
              <h2 style="color:#d81b60; text-align:center; margin-bottom:10px;">💙 BE PEACE - New Booking Alert</h2>
              <hr style="border:0; border-top:2px solid #7de0e0; margin:15px 0;">
              <p><b>Name:</b> ${paymentDoc.name}</p>
              <p><b>Email:</b> ${paymentDoc.email}</p>
              <p><b>Phone:</b> ${paymentDoc.phone}</p>
              <p><b>Date:</b> ${paymentDoc.date}</p>
              <p><b>Slot:</b> ${paymentDoc.slot}</p>
              <p><b>Concern:</b> ${paymentDoc.concern}</p>
              <p><b>Amount:</b> ${paymentDoc.currency === "INR" ? "₹" : "$"}${paymentDoc.amount}</p>
              <p><b>Order ID:</b> ${paymentDoc.orderId}</p>
              <p><b>Status:</b> ${order_status}</p>
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

// =====================================================
// 🧠 MAIN HANDLER
// =====================================================
export default async function handler(req, res) {
  const { path } = req.query; // e.g., /api/payment?path=create

  try {
    const dbConn = await connectDB();
    const payments = dbConn.collection("payments");
    const bookings = dbConn.collection("bookings");
    const users = dbConn.collection("users");

    // ===== CREATE ORDER =====
    if (path === "create" && req.method === "POST") {
      let {
        name,
        email,
        phone,
        amount,
        currency,
        date,
        slot,
        age,
        sex,
        concern,
        country,
        flag,
      } = req.body;

      if (!country) country = "Unknown";
      if (!flag) flag = "fi fi-xx";

      if (!date || !slot) return res.status(400).json({ error: "Date and slot required" });

      // Prevent double-booking
      const existingBooking = await bookings.findOne({ date, slot });
      if (existingBooking) return res.status(400).json({ error: "Slot already booked" });

      const orderId = (currency && currency.toUpperCase() !== "INR" ? "PAYPAL_" : "ORDER_") + Date.now();
      const cleanPhone = (phone || "").replace(/\D/g, "");
      const cleanCustomerId = (email || "").replace(/[^a-zA-Z0-9_-]/g, "_");

      // If currency is INR -> use Cashfree (existing flow)
      if (!currency || currency.toUpperCase() === "INR") {
        try {
          const response = await axios.post(
            "https://api.cashfree.com/pg/orders",
            {
              order_id: orderId,
              order_amount: Number(amount),
              order_currency: "INR",
              customer_details: {
                customer_id: cleanCustomerId,
                customer_name: name,
                customer_email: email,
                customer_phone: cleanPhone,
              },
              order_meta: {
                return_url: `${process.env.PAYMENT_RETURN_BASE || "https://bepeace.in"}/payment-success.html?order_id=${orderId}`,
                notify_url: process.env.CASHFREE_NOTIFY_URL || `https://bepeace.in/api/payment?path=webhook`,
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
            currency: "INR",
            date,
            slot,
            concern,
            country,
            status: "CREATED",
            gateway: "Cashfree",
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

      // Otherwise -> use PayPal (simple redirect flow)
      try {
        const paypalAmount = Number(amount) || 25;
        const paypalBusiness = process.env.PAYPAL_BUSINESS_EMAIL;
        const returnUrl = process.env.PAYPAL_RETURN_URL || `https://bepeace.in/payment-success.html`;
        const notifyUrl = process.env.PAYPAL_NOTIFY_URL || `https://bepeace.in/api/payment?path=paypal-webhook`;

        // Build PayPal classic checkout URL (works with PayPal Account Optional)
        const params = new URLSearchParams({
          cmd: "_xclick",
          business: paypalBusiness,
          item_name: "BePeace Consultation",
          amount: String(paypalAmount),
          currency_code: currency || "USD",
          return: returnUrl + `?order_id=${orderId}`,
          notify_url: notifyUrl,
          no_note: "1",
          bn: "BePeace_Payment",
        });

        const paypalURL = `https://www.paypal.com/cgi-bin/webscr?${params.toString()}`;

        await payments.insertOne({
          orderId,
          name,
          email,
          phone: cleanPhone,
          amount: paypalAmount,
          currency: currency || "USD",
          date,
          slot,
          concern,
          country,
          status: "INITIATED",
          gateway: "PayPal",
          createdAt: new Date(),
        });

        return res.status(200).json({ success: true, redirect: paypalURL, orderId });
      } catch (err) {
        console.error("💥 PayPal create error:", err.message);
        return res.status(500).json({ success: false, error: err.message });
      }
    }

    // ===== WEBHOOK (Cashfree → your site) =====
    if (req.method === "POST" && (path === "webhook" || req.headers["x-webhook-signature"])) {
      try {
        console.log("📩 Cashfree webhook received:", req.body);

        const payload = req.body?.data || req.body;
        const order_id = payload?.order?.order_id || payload?.order_id;
        const order_status = payload?.payment?.payment_status || payload?.order_status;

        if (!order_id || !order_status) return res.status(400).json({ error: "Invalid webhook data" });

        const payment = await payments.findOne({ orderId: order_id });
        if (!payment) return res.status(404).json({ error: "Payment not found" });

        await payments.updateOne({ orderId: order_id }, { $set: { status: order_status, updatedAt: new Date() } });

        if (["PAID", "SUCCESS"].includes(order_status)) {
          await processSuccessfulPayment(payments, bookings, users, payment, order_status);
        }

        console.log("✅ Webhook processed successfully:", order_id);
        return res.status(200).json({ success: true });
      } catch (err) {
        console.error("💥 Webhook error:", err.message);
        return res.status(500).json({ error: err.message });
      }
    }

    // ===== PAYPAL IPN (Instant Payment Notification) =====
    if (path === "paypal-webhook" && req.method === "POST") {
      try {
        console.log("📩 PayPal IPN received:", req.body);

        // Convert req.body to urlencoded string for validation
        const ipnParams = new URLSearchParams();
        for (const key of Object.keys(req.body || {})) {
          ipnParams.append(key, String(req.body[key]));
        }
        // Append cmd=_notify-validate
        const verifyBody = "cmd=_notify-validate&" + ipnParams.toString();

        // Validate with PayPal
        const verifyUrl = process.env.PAYPAL_IPN_VERIFY_URL || "https://ipnpb.paypal.com/cgi-bin/webscr";
        const verifyResp = await axios.post(verifyUrl, verifyBody, {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          timeout: 15000,
        });

        const verification = verifyResp.data;
        console.log("🔎 PayPal IPN verification response:", verification);

        // Only proceed if VERIFIED
        if (verification !== "VERIFIED") {
          console.warn("⚠️ PayPal IPN not verified:", verification);
          return res.status(400).json({ error: "IPN not verified" });
        }

        const orderId = req.body?.invoice || req.body?.custom || req.body?.item_number || req.body?.txn_id;
        const payment_status = req.body?.payment_status || req.body?.payment_status;

        if (!orderId) {
          console.warn("⚠️ PayPal IPN missing order identifier");
          // but still respond 200 to PayPal so they stop retrying; your app could log
          return res.status(200).send("OK");
        }

        // Try to find corresponding payment document
        const payment = await payments.findOne({ orderId });
        if (!payment) {
          // Sometimes PayPal doesn't pass our internal orderId - try matching by txn_id or payer_email / amount
          const possible = await payments.findOne({
            email: req.body?.payer_email,
            amount: Number(req.body?.mc_gross || req.body?.payment_gross || req.body?.mc_gross),
            currency: req.body?.mc_currency || req.body?.mc_currency,
            gateway: "PayPal",
          });
          if (possible) {
            console.log("ℹ️ Matched IPN to internal payment via email/amount");
            // use matched doc
            await payments.updateOne({ orderId: possible.orderId }, { $set: { status: payment_status, updatedAt: new Date(), txn_id: req.body?.txn_id } });
            await processSuccessfulPayment(payments, bookings, users, possible, payment_status);
            return res.status(200).send("OK");
          }
          console.warn("⚠️ PayPal IPN: payment doc not found for orderId:", orderId);
          return res.status(200).send("OK");
        }

        // Update DB with status and txn id
        await payments.updateOne({ orderId }, { $set: { status: payment_status, updatedAt: new Date(), txn_id: req.body?.txn_id } });

        if (payment_status === "Completed" || payment_status === "COMPLETED") {
          // Process same downstream
          await processSuccessfulPayment(payments, bookings, users, payment, payment_status);
        }

        return res.status(200).send("OK");
      } catch (err) {
        console.error("💥 PayPal IPN error:", err.message);
        // Always return 200 to PayPal to stop retries if you intentionally want to ignore — but log error
        return res.status(500).json({ error: err.message });
      }
    }

    // ===== VERIFY PAYMENT STATUS (Cashfree existing) =====
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
        await payments.updateOne({ orderId: order_id }, { $set: { status: data.order_status, updatedAt: new Date() } });
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
// 🧾 generateReceipt Helper (unchanged, using jspdf)
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
    ["Amount Paid", `${payment.currency === "INR" ? "₹" : "$"}${payment.amount}`],
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