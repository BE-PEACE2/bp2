// ==================== dashboard.js (Stable Clean Build) ====================

import { auth, database } from "./firebase-init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { ref, get, onValue } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";

const greeting = document.getElementById("greeting");
const todayList = document.getElementById("todayList");
const upcomingList = document.getElementById("upcomingList");
const pastList = document.getElementById("pastList");

let refreshTimer = null;
let hasInitialized = false;
let unsubscribeBookings = null;

function startForUser(user) {
  if (hasInitialized) return;
  if (!user) return (window.location.href = "login.html");
  hasInitialized = true;

  const name = user.displayName || (user.email ? user.email.split("@")[0] : "");
  if (greeting) greeting.textContent = `Hello ${name.toUpperCase()} 👋`;

  console.log(`📥 Subscribing to bookings for: ${user.email}`);
  subscribeToBookings(user.email);
}

// Initialize immediately if user is already available, else wait for auth state
if (auth.currentUser) {
  startForUser(auth.currentUser);
}
onAuthStateChanged(auth, (user) => startForUser(user));

window.addEventListener("beforeunload", () => {
  if (refreshTimer) clearInterval(refreshTimer);
  if (typeof unsubscribeBookings === "function") unsubscribeBookings();
});

// 🕒 Parse date and slot
function parseBookingDateTime(date, slot) {
  if (!date) return new Date();

  // Support ISO date, YYYY-MM-DD, and DD-MM-YYYY / DD/MM/YYYY
  let y, m, d;
  if (typeof date === "string" && date.includes("T")) {
    const iso = new Date(date);
    if (!isNaN(iso)) {
      y = iso.getFullYear();
      m = iso.getMonth() + 1;
      d = iso.getDate();
    }
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    [y, m, d] = date.split("-").map(Number);
  } else if (/^\d{2}[\/-]\d{2}[\/-]\d{4}$/.test(date)) {
    const parts = date.split(/[\/-]/).map(Number);
    d = parts[0];
    m = parts[1];
    y = parts[2];
  }

  const match = slot?.match(/(\d{1,2})(?::(\d{2}))?\s*([AP]M)?/i);
  let hour = 0,
    minute = 0;

  if (match) {
    hour = parseInt(match[1]);
    minute = match[2] ? parseInt(match[2]) : 0;
    const ampm = match[3]?.toUpperCase();
    if (ampm === "PM" && hour < 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
  }

  return new Date(y, m - 1, d, hour, minute);
}

// Extract email from various possible shapes
function extractBookingEmail(b) {
  return (
    b?.email ||
    b?.userEmail ||
    b?.user?.email ||
    b?.contact?.email ||
    null
  );
}

// 🧠 Fetch all bookings
async function loadBookings(email) {
  if (todayList) todayList.textContent = "Loading consultations...";
  if (upcomingList) upcomingList.textContent = "";
  if (pastList) pastList.textContent = "";

  try {
    const snap = await get(ref(database, "bookings"));
    if (!snap.exists()) {
      if (todayList) todayList.textContent = "No consultations yet.";
      if (upcomingList) upcomingList.innerHTML = `<div class="small-muted">No consultations yet.</div>`;
      if (pastList) pastList.innerHTML = `<div class="small-muted">No consultations yet.</div>`;
      return;
    }

    const data = snap.val();

    // Flatten any nested structure and collect leaf nodes that look like bookings
    const collectBookings = (root) => {
      const result = [];
      const stack = [root];
      while (stack.length) {
        const node = stack.pop();
        if (!node) continue;
        if (Array.isArray(node)) {
          for (const item of node) stack.push(item);
        } else if (typeof node === "object") {
          // Heuristic: treat as booking if it exposes an email field in known locations
          if (extractBookingEmail(node)) {
            result.push(node);
          } else {
            for (const k in node) stack.push(node[k]);
          }
        }
      }
      return result;
    };

    const flattened = collectBookings(data);
    const allBookings = flattened.filter((b) => {
      const be = extractBookingEmail(b);
      return be && be.toLowerCase() === email.toLowerCase();
    });

    console.log(`✅ Found ${allBookings.length} bookings for ${email}`);

    const now = new Date();
    const today = [];
    const upcoming = [];
    const past = [];

    for (const b of allBookings) {
      const bookingTime = parseBookingDateTime(b.date, b.slot);
      if (!bookingTime || isNaN(bookingTime)) continue;

      const bookingDate = new Date(bookingTime.getFullYear(), bookingTime.getMonth(), bookingTime.getDate());
      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      if (bookingDate.getTime() === todayDate.getTime()) {
        bookingTime >= now ? today.push(b) : past.push(b);
      } else if (bookingTime > now) {
        upcoming.push(b);
      } else {
        past.push(b);
      }
    }

    const sortByTime = (arr) =>
      arr.sort((a, b) => parseBookingDateTime(a.date, a.slot) - parseBookingDateTime(b.date, b.slot));

    renderList(todayList, sortByTime(today), true);
    renderList(upcomingList, sortByTime(upcoming), true);
    renderList(pastList, sortByTime(past), false);
  } catch (err) {
    console.error("❌ Error loading bookings:", err);
    if (todayList) todayList.textContent = "Error fetching consultations.";
  }
}

// 🔔 Realtime subscription for bookings
function subscribeToBookings(email) {
  if (typeof unsubscribeBookings === "function") unsubscribeBookings();
  const bookingsRef = ref(database, "bookings");
  unsubscribeBookings = onValue(bookingsRef, (snap) => {
    try {
      if (!snap.exists()) {
        if (todayList) todayList.textContent = "No consultations yet.";
        if (upcomingList) upcomingList.innerHTML = `<div class="small-muted">No consultations yet.</div>`;
        if (pastList) pastList.innerHTML = `<div class=\"small-muted\">No consultations yet.</div>`;
        return;
      }

      const data = snap.val();

      const collectBookings = (root) => {
        const result = [];
        const stack = [root];
        while (stack.length) {
          const node = stack.pop();
          if (!node) continue;
          if (Array.isArray(node)) {
            for (const item of node) stack.push(item);
          } else if (typeof node === "object") {
            if (extractBookingEmail(node)) {
              result.push(node);
            } else {
              for (const k in node) stack.push(node[k]);
            }
          }
        }
        return result;
      };

      const flattened = collectBookings(data);
      const allBookings = flattened.filter((b) => {
        const be = extractBookingEmail(b);
        return be && be.toLowerCase() === email.toLowerCase();
      });

      const now = new Date();
      const today = [];
      const upcoming = [];
      const past = [];

      for (const b of allBookings) {
        const bookingTime = parseBookingDateTime(b.date, b.slot);
        if (!bookingTime || isNaN(bookingTime)) continue;

        const bookingDate = new Date(bookingTime.getFullYear(), bookingTime.getMonth(), bookingTime.getDate());
        const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (bookingDate.getTime() === todayDate.getTime()) {
          bookingTime >= now ? today.push(b) : past.push(b);
        } else if (bookingTime > now) {
          upcoming.push(b);
        } else {
          past.push(b);
        }
      }

      const sortByTime = (arr) =>
        arr.sort((a, b) => parseBookingDateTime(a.date, a.slot) - parseBookingDateTime(b.date, b.slot));

      renderList(todayList, sortByTime(today), true);
      renderList(upcomingList, sortByTime(upcoming), true);
      renderList(pastList, sortByTime(past), false);
    } catch (e) {
      console.error("❌ Error rendering realtime bookings:", e);
      if (todayList) todayList.textContent = "Error fetching consultations.";
    }
  });
}

// 💬 Render lists
function renderList(container, list, isUpcoming) {
  if (!container) return;

  if (!Array.isArray(list) || list.length === 0) {
    container.innerHTML = `<div class="small-muted">No consultations yet.</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  const now = new Date();

  for (const booking of list) {
    const bookingTime = parseBookingDateTime(booking.date, booking.slot);
    if (!bookingTime || isNaN(bookingTime)) continue;

    const minutesUntil = (bookingTime - now) / 60000;
    const isSameDay = bookingTime.toDateString() === now.toDateString();
    const canJoin = isSameDay && minutesUntil <= 10 && minutesUntil > -60;

    let statusText = "";
    if (!isSameDay && bookingTime < now) {
      statusText = "🔴 Completed";
    } else if (canJoin) {
      statusText = "✅ Live now";
    } else if (bookingTime > now && isFinite(minutesUntil)) {
      statusText = `⏳ Starts in ${Math.max(0, Math.floor(minutesUntil))} min`;
    } else {
      statusText = "🔴 Completed";
    }

    const row = document.createElement("div");
    row.className = "appointment";
    row.innerHTML = `
      <div>
        <strong>${booking.name || "Consultation"}</strong><br>
        ${booking.date || ""} • ${booking.slot || ""}<br>
        <span class="status">${booking.status || "confirmed"}</span><br>
        <span class="countdown">${statusText}</span>
      </div>
      ${
        isUpcoming && canJoin
          ? `<button class="join-btn live" onclick="window.open('https://meet.bepeace.in/bepeace-${booking.order_id}','_blank')">Join</button>`
          : isUpcoming
          ? `<button class="join-btn disabled" disabled>Join (10 min before)</button>`
          : ""
      }
    `;
    fragment.appendChild(row);
  }

  container.replaceChildren(fragment);
}

window.toggleMenu = () => document.getElementById("sideMenu").classList.toggle("show");
window.logout = async () => {
  await signOut(auth);
  window.location.href = "login.html";
};