console.log("✅ header-auth.js LOADED");

import { 
  getAuth, 
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

import { 
  ref, 
  get 
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";

import { app, database } from "./firebase-init.js";

console.log("✅ header-auth.js EXECUTING");

const auth = getAuth(app);

// ✅ Render header
function renderHeader(role) {
  const btnBox = document.getElementById("headerButtons");
  if (!btnBox) return;

  btnBox.innerHTML = "";

  if (!role) {
    btnBox.innerHTML = `
      <a href="/signup.html" class="header-btn">Sign Up</a>
      <a href="/login.html" class="header-btn">Login</a>
    `;
    return;
  }

  const dashboardLink = role === "doctor"
    ? "/doctor-dashboard.html"
    : "/dashboard.html";

  btnBox.innerHTML = `
    <a href="${dashboardLink}" class="header-btn">Dashboard</a>
    <button id="logoutBtn" class="header-btn danger">Logout</button>
  `;

  document.getElementById("logoutBtn").addEventListener("click", () => {
    signOut(auth).then(() => {
      window.location.href = "/login.html";
    });
  });
}

// ✅ Wait for headerButtons to appear (because partial loads)
function waitForHeader() {
  const btnBox = document.getElementById("headerButtons");
  if (!btnBox) {
    setTimeout(waitForHeader, 100);
    return;
  }

  console.log("✅ headerButtons detected");

  // ✅ Firebase login detection
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      console.log("👤 No user logged in");
      renderHeader(null);
      return;
    }

    console.log("👤 Logged in:", user.email);

    // ✅ READ REAL ROLE FROM DATABASE
    const snap = await get(ref(database, "users/" + user.uid));
    const role = snap.val()?.role || "patient";

    console.log("✅ Role from Firebase:", role);

    renderHeader(role);
  });
}

// ✅ Start logic
waitForHeader();