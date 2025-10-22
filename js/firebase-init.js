// ✅ Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";

// ✅ BePeace Firebase Configuration (your unique keys)
 const firebaseConfig = {
    apiKey: "AIzaSyBE_Sn2MXGqkLZenbqN8hpqswwjm6BfIk0",
    authDomain: "bepeace-65238.firebaseapp.com",
    projectId: "bepeace-65238",
    storageBucket: "bepeace-65238.firebasestorage.app",
    messagingSenderId: "199738070495",
    appId: "1:199738070495:web:606db05feda8fe6899206a",
    measurementId: "G-CT6YH2ENVK"
  };

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const database = getDatabase(app);

// ✅ Export so other pages (like signup, login) can use it
export { app, auth, database };