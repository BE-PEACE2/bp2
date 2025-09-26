// payment-status.js

const params = new URLSearchParams(window.location.search);
const orderId = params.get("order_id");
const name = params.get("name");
const email = params.get("email");
const amount = params.get("amount");
const currency = params.get("currency");

// Fill in details if present
function fillDetails() {
  if (document.getElementById("name") && name) {
    document.getElementById("name").textContent = "👤 Name: " + decodeURIComponent(name);
  }
  if (document.getElementById("email") && email) {
    document.getElementById("email").textContent = "📧 Email: " + decodeURIComponent(email);
  }
  if (document.getElementById("orderId") && orderId) {
    document.getElementById("orderId").textContent = "🆔 Order ID: " + orderId;
  }
  if (document.getElementById("amount") && amount && currency) {
    const formatted = new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(amount);
    document.getElementById("amount").textContent = "💳 Amount: " + formatted;
  }
}

// Verify order with backend
async function checkOrderStatus() {
  if (!orderId) return;
  try {
    const res = await fetch(`/api/check-order?order_id=${orderId}`);
    const data = await res.json();
    console.log("🔎 Order check:", data);

    if (data.order_status === "PAID" && window.location.pathname.includes("pending")) {
      window.location.href = `/success.html?order_id=${orderId}&name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}&amount=${amount}&currency=${currency}`;
    }
    if ((data.order_status === "FAILED" || data.order_status === "CANCELLED") && window.location.pathname.includes("pending")) {
      window.location.href = `/cancel.html?order_id=${orderId}&name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}&amount=${amount}&currency=${currency}`;
    }
  } catch (err) {
    console.error("❌ Error checking order:", err);
  }
}

// Add a redirect note with countdown
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

  updateNote(); // show immediately
  let interval = setInterval(() => {
    updateNote();
    if (seconds < 0) clearInterval(interval);
  }, 1000);
}

// Run on page load
fillDetails();

// Pending → poll for status
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

// Success/Cancel → add countdown redirect
if (window.location.pathname.includes("success")) {
  addRedirectNote("⏳ Redirecting to homepage", 15, "index.html");
}
if (window.location.pathname.includes("cancel")) {
  addRedirectNote("⏳ Redirecting to booking page", 15, "booking.html");
}