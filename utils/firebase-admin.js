// utils/firebase-admin.js
import admin from "firebase-admin";
import { readFileSync, existsSync } from "fs";

let serviceAccount;

try {
  // ✅ 1️⃣ Load from environment (Vercel)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

    // 🔑 Important: restore newline characters in private key
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
    }
  }

  // ✅ 2️⃣ Load from local file (for local development)
  else if (existsSync("utils/serviceAccountKey.json")) {
    const fileContent = readFileSync("utils/serviceAccountKey.json", "utf8");
    serviceAccount = JSON.parse(fileContent);
  }

  // 🚨 3️⃣ Throw error if no key found
  else {
    throw new Error("❌ Firebase service account key not found");
  }

  // ✅ 4️⃣ Initialize Firebase Admin only once
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${serviceAccount.project_id}-default-rtdb.asia-southeast1.firebasedatabase.app`,
    });
    console.log("🔥 Firebase Admin connected successfully");
  }
} catch (error) {
  console.error("💥 Firebase Admin initialization error:", error.message);
}

export const db = admin.database();
export const authAdmin = admin.auth();
export default admin;