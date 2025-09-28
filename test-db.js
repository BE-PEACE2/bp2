const { MongoClient } = require("mongodb");
require("dotenv").config();

async function testConnection() {
  try {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    console.log("✅ Connected to MongoDB!");
    await client.close();
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
  }
}

testConnection();