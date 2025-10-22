// ✅ Import Firebase Auth
import { auth, database } from './firebase-init.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";

// 🔍 Watch user login status
onAuthStateChanged(auth, async (user) => {
  const userNameEl = document.getElementById("userName");
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  if (user) {
    // ✅ User is logged in — fetch name
    const snapshot = await get(ref(database, 'users/' + user.uid));
    const userData = snapshot.val();

    if (userData && userNameEl) {
      userNameEl.textContent = `👋 Welcome, ${userData.name}`;
    }

    if (loginBtn) loginBtn.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "inline-block";
  } else {
    // 🚪 User is logged out
    if (userNameEl) userNameEl.textContent = "";
    if (loginBtn) loginBtn.style.display = "inline-block";
    if (logoutBtn) logoutBtn.style.display = "none";
  }
});

// 🚪 Logout function
window.logout = async function() {
  await signOut(auth);
  alert("You have been logged out.");
  window.location.href = "/login.html";
};