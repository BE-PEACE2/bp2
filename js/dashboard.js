// ==================== dashboard.js ====================

// Import Firebase modules
import { auth, database } from "./firebase-init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import {
  ref,
  get,
  query,
  orderByChild,
  equalTo
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js";

// Get DOM elements
const greeting = document.getElementById("greeting");
const todayList = document.getElementById("todayList");
const upcomingList = document.getElementById("upcomingList");
const pastList = document.getElementById("pastList");

// Watch authentication state
onAuthStateChanged(auth, (user) => {
  console.log("🔐 Authenticated user:", user ? user.email : "No user");
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const name = user.displayName || user.email.split("@")[0];
  greeting.textContent = `Hello ${name} 👋`;
  loadBookings(user.email);
});

// ================== FETCH BOOKINGS ==================
function loadBookings(email) {
  const bookingsRef = ref(database, "bookings");
  const userQuery = query(bookingsRef, orderByChild("email"), equalTo(email.toLowerCase()));

  get(userQuery)
    .then((snapshot) => {
      if (!snapshot.exists()) {
        todayList.textContent = "No consultations today.";
        upcomingList.textContent = "No upcoming consultations.";
        pastList.textContent = "No past consultations.";
        return;
      }

      const allBookings = snapshot.val();
      console.log("📬 Logged in email:", email);
      console.log("🗂️ Bookings fetched for this user:", allBookings);

      const now = new Date();
      const today = [];
      const upcoming = [];
      const past = [];

      Object.values(allBookings).forEach((b) => {
        try {
          const datePart = b.date; // e.g. "2025-10-30"
          const timePart = b.slot?.replace("AM", " AM").replace("PM", " PM") || "12:00 AM";
          const bookingDateTime = new Date(`${datePart} ${timePart}`);

          const bookingDate = new Date(datePart);
          const todayDate = new Date(now.toISOString().split("T")[0]);

          if (bookingDate.toDateString() === todayDate.toDateString() && bookingDateTime >= now) {
            today.push(b); // today’s upcoming
          } else if (bookingDateTime > now) {
            upcoming.push(b); // future
          } else {
            past.push(b); // past
          }
        } catch (err) {
          console.warn("⚠️ Invalid booking date:", b, err);
        }
      });

      renderList(todayList, today, true);
      renderList(upcomingList, upcoming, true);
      renderList(pastList, past, false);
    })
    .catch((error) => {
      console.error("❌ Error fetching bookings:", error);
      todayList.textContent = "Unable to load consultations. Please try again.";
      upcomingList.textContent = "";
      pastList.textContent = "";
    });
}

// ================== RENDER LIST ==================
function renderList(container, list, isUpcoming) {
  container.innerHTML = "";
  if (!list.length) {
    container.innerHTML = `<div class='small-muted'>No consultations yet.</div>`;
    return;
  }

  const now = new Date();

  list.forEach((b) => {
    const div = document.createElement("div");
    div.className = "appointment";

    const datePart = b.date;
    const timePart = b.slot?.replace("AM", " AM").replace("PM", " PM") || "12:00 AM";
    const bookingTime = new Date(`${datePart} ${timePart}`);

    // Show Join button only 10 minutes before consultation
    const minutesUntil = (bookingTime - now) / 60000;
    const canJoin = minutesUntil <= 10 && minutesUntil > -60; // within 10 mins before or up to 1 hour after

    div.innerHTML = `
      <div>
        <strong>${b.name || "Consultation"}</strong><br>
        ${b.date} • ${b.slot}<br>
        <span class="status">${b.status || "confirmed"}</span>
      </div>
      ${isUpcoming && canJoin
        ? `<button class="join-btn" onclick="window.open('https://meet.bepeace.in/bepeace-${b.order_id}','_blank')">Join</button>`
        : isUpcoming
        ? `<button class="join-btn disabled">Join (available 10 min before)</button>`
        : ""}
    `;
    container.append(div);
  });
}

// ================== MENU + LOGOUT ==================
window.toggleMenu = function () {
  document.getElementById("sideMenu").classList.toggle("show");
};

window.logout = async function () {
  await signOut(auth);
  window.location.href = "login.html";
};