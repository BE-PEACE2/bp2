// payment-status.js

const params = new URLSearchParams(window.location.search);
const orderId = params.get("order_id");
const name = params.get("name");
const email = params.get("email");
const phone = params.get("phone");
const age = params.get("age");
const sex = params.get("sex");
const amount = params.get("amount");
const currency = params.get("currency");

// Utility: safely set field or hide if missing
function setDetail(id, label, value) {
  const el = document.getElementById(id);
  if (el) {
    if (value) {
      el.textContent = label + decodeURIComponent(value);
    } else {
      el.style.display = "none";
    }
  }
}

// Fill in booking/payment details
function fillDetails() {
  setDetail("name", "👤 Name: ", name);
  setDetail("email", "📧 Email: ", email);
  setDetail("phone", "📱 Phone: ", phone);
  setDetail("age", "🎂 Age: ", age);
  setDetail("sex", "⚧ Sex: ", sex);
  setDetail("orderId", "🆔 Order ID: ", orderId);

  if (document.getElementById("amount") && amount && currency) {
    const formatted = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
    }).format(amount);
    document.getElementById("amount").textContent = "💳 Amount: " + formatted;
  }
}

// Poll backend to check payment status
async function checkOrderStatus() {
  if (!orderId) return;
  try {
    const res = await fetch(`/api/check-order?order_id=${orderId}`);
    const data = await res.json();
    console.log("🔎 Order check:", data);

    if (data.order_status === "PAID" && window.location.pathname.includes("pending")) {
      window.location.href =
        `/success.html?order_id=${orderId}&name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}&phone=${encodeURIComponent(phone)}&age=${encodeURIComponent(age)}&sex=${encodeURIComponent(sex)}&amount=${amount}&currency=${currency}`;
    }

    if (
      (data.order_status === "FAILED" || data.order_status === "CANCELLED") &&
      window.location.pathname.includes("pending")
    ) {
      window.location.href =
        `/cancel.html?order_id=${orderId}&name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}&phone=${encodeURIComponent(phone)}&age=${encodeURIComponent(age)}&sex=${encodeURIComponent(sex)}&amount=${amount}&currency=${currency}`;
    }
  } catch (err) {
    console.error("❌ Error checking order:", err);
    const note = document.querySelector(".redirect-note");
    if (note) {
      note.textContent = "⚠️ Unable to verify payment. Please refresh the page.";
    }
  }
}

// Add redirect countdown note
function addRedirectNote(message, seconds, redirectUrl) {
  let note = document.createElement("p");
  note.className = "redirect-note";
  document.querySelector("section").appendChild(note);

  function updateNote() {
    note.textContent = `${message} (${seconds}s)`;
    if (seconds === 0) {
      window.location.href = redirectUrl;
    }
    seconds--;
  }

  updateNote();
  let interval = setInterval(() => {
    updateNote();
    if (seconds < 0) clearInterval(interval);
  }, 1000);
}

// ✅ PDF Receipt Download
function setupReceiptDownload() {
  const btn = document.getElementById("downloadBtn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    if (!window.jspdf) {
      alert("⚠️ PDF generator not loaded.");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("BE PEACE - Consultation Receipt", 20, 20);

    doc.setFontSize(12);
    doc.text("🆔 Booking Reference: " + (orderId || ""), 20, 40);
    doc.text("👤 Name: " + (name || ""), 20, 50);
    doc.text("📧 Email: " + (email || ""), 20, 60);
    doc.text("📱 Phone: " + (phone || ""), 20, 70);
    doc.text("🎂 Age: " + (age || ""), 20, 80);
    doc.text("⚧ Sex: " + (sex || ""), 20, 90);

    const formattedAmount = amount && currency
      ? new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(amount)
      : "";
    doc.text("💳 Amount: " + formattedAmount, 20, 100);

    doc.text("✅ Status: Paid", 20, 120);
    doc.text("Date: " + new Date().toLocaleString(), 20, 130);

    doc.save("BEPEACE_Receipt.pdf");
  });
}

// On page load
fillDetails();

// If pending → poll Cashfree status
if (window.location.pathname.includes("pending")) {
  let attempts = 0;
  let interval = setInterval(async () => {
    attempts++;
    await checkOrderStatus();
    if (attempts === 20) {
      clearInterval(interval);
      interval = setInterval(checkOrderStatus, 5000);
    }
  }, 1000);
}

// Success / Cancel → auto redirect after 15s
if (window.location.pathname.includes("success")) {
  addRedirectNote("⏳ Redirecting to homepage", 15, "index.html");
  setupReceiptDownload(); // enable PDF download
}
if (window.location.pathname.includes("cancel")) {
  addRedirectNote("⏳ Redirecting to booking page", 15, "booking.html");
}