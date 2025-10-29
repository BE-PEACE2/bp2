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
const upcomingList = document.getElementById("upcomingList");
const pastList = document.getElementById("pastList");

// Watch authentication state
onAuthStateChanged(auth, (user) => {
  // 🔍 DEBUG LOG
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
        upcomingList.textContent = "No upcoming consultations.";
        pastList.textContent = "";
        return;
      }

      const allBookings = snapshot.val();
      console.log("Logged in email:", email);
      console.log("Bookings fetched for this user:", allBookings);

      const now = new Date();
      const upcoming = [];
      const past = [];

      Object.values(allBookings).forEach((b) => {
        const dt = new Date(b.date);
        if (dt >= now) upcoming.push(b);
        else past.push(b);
      });

      renderList(upcomingList, upcoming, true);
      renderList(pastList, past, false);
    })
    .catch((error) => {
      console.error("Error fetching bookings:", error);
      upcomingList.textContent = "Unable to load consultations. Please try again.";
    });
}

// ================== RENDER LIST ==================
function renderList(container, list, isUpcoming) {
  container.innerHTML = "";
  if (!list.length) {
    container.innerHTML = `<div class='small-muted'>No consultations yet.</div>`;
    return;
  }

  list.forEach((b) => {
    const div = document.createElement("div");
    div.className = "appointment";
    div.innerHTML = `
      <div>
        <strong>${b.name || "Consultation"}</strong><br>
        ${b.date} • ${b.slot}<br>
        <span class="status">${b.status || "pending"}</span>
      </div>
      ${isUpcoming ? `<button class="join-btn" onclick="window.open('https://meet.bepeace.in/bepeace-${b.order_id}','_blank')">Join</button>` : ""}
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