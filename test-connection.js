// test-connection.js
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME;

if (!uri) {
  console.error("❌ Missing MONGODB_URI in .env");
  process.exit(1);
}

if (!dbName) {
  console.error("❌ Missing DB_NAME in .env");
  process.exit(1);
}

async function testConnection() {
  try {
    console.log("🔄 Connecting to MongoDB...");
    const client = new MongoClient(uri);
    await client.connect();
    console.log("✅ MongoDB Connected");

    const db = client.db(dbName);
    const collections = await db.listCollections().toArray();
    console.log("📂 Collections in DB:", collections.map(c => c.name));

    await client.close();
    console.log("🔌 Connection closed");
  } catch (err) {
    console.error("❌ Connection failed:", err.message);
  }
}

testConnection();