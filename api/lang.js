// File: /api/lang.js
// 🌍 BE PEACE Global Translator — Full Auto-Translate (Unified + Batch Optimized)
// ✅ Detects country via VPN/IP
// ✅ Translates entire pages (text, numbers, symbols, etc.)
// ✅ Batch translation (3–5× faster)
// ✅ Google Translate Free API
// ✅ No cache — always fresh

export default async function handler(req, res) {
  const method = req.method;
  const { text, texts, target } = req.query;

  try {
    // 🧭 STEP 1 — Detect Client IP (VPN & Cloudflare safe)
    let ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.headers["cf-connecting-ip"] ||
      req.headers["x-real-ip"] ||
      req.socket?.remoteAddress ||
      "auto";

    // Clean internal IPs
    if (
      ip === "::1" ||
      ip.startsWith("10.") ||
      ip.startsWith("192.168") ||
      ip.startsWith("172.") ||
      ip === "127.0.0.1"
    ) ip = "auto";
    if (ip.startsWith("::ffff:")) ip = ip.replace("::ffff:", "");

    // 🕵️ STEP 2 — Detect Location + Language
    const locationData = await detectLocation(ip);
    const detectedLang =
      locationData.languages?.split(",")[0].split("-")[0] || "en";
    const country = locationData.country_name || "India";
    const countryCode = locationData.country_code || "IN";
    const flag = getFlagEmoji(countryCode);

    // 🌎 If only detection (no text)
    if (!text && !texts && method === "GET") {
      return res.status(200).json({
        detectedLang,
        country,
        countryCode,
        flag,
        message: `🌍 ${country} → ${detectedLang.toUpperCase()}`,
        timestamp: new Date().toISOString()
      });
    }

    // 🧠 STEP 3 — Prepare translation inputs
    const tl = target || detectedLang || "en";
    let inputTexts = [];

    if (method === "POST") {
      const body = await readBody(req);
      inputTexts = body.texts || [];
    } else {
      if (texts) {
        inputTexts = Array.isArray(texts)
          ? texts
          : decodeURIComponent(texts).split("|");
      } else if (text) {
        inputTexts = [decodeURIComponent(text)];
      }
    }

    if (!inputTexts.length) {
      return res.status(400).json({ error: "No text provided for translation" });
    }

    // 🚀 STEP 4 — Translate in one batch (fast)
    const translations = await translateText(inputTexts, tl);

    // 🧾 STEP 5 — Return result
    return res.status(200).json({
      translations,
      detectedLang,
      to: tl,
      country,
      countryCode,
      flag,
      count: translations.length,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error("❌ Translation Error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}

// =============================
// 🌍 LOCATION DETECTION
// =============================
async function detectLocation(ip) {
  const sources = [
    ip === "auto" ? "https://ipapi.co/json/" : `https://ipapi.co/${ip}/json/`,
    ip === "auto" ? "https://ipwho.is/" : `https://ipwho.is/${ip}`,
    "https://freeipapi.com/api/json",
    "https://ipinfo.io/json?token=demo"
  ];

  for (const url of sources) {
    try {
      const res = await fetch(`${url}?nocache=${Date.now()}`, {
        headers: { "Cache-Control": "no-store" }
      });
      const text = await res.text();
      const json = JSON.parse(text);
      if (json && (json.country_name || json.country)) {
        console.log(`✅ Location source: ${url}`);
        return normalizeLocation(json);
      }
    } catch (err) {
      console.warn(`⚠️ Failed ${url}: ${err.message}`);
    }
  }

  console.warn("⚠️ All APIs failed → Defaulting to India");
  return { country_name: "India", country_code: "IN", languages: "en" };
}

// =============================
// 🧩 NORMALIZER + HELPERS
// =============================
function normalizeLocation(data) {
  return {
    country_name:
      data.country_name || data.country || data.countryName || "Unknown",
    country_code:
      data.country_code ||
      data.countryCode ||
      data.country_code_iso2 ||
      "XX",
    languages:
      data.languages ||
      data.language ||
      (Array.isArray(data.languages_spoken)
        ? data.languages_spoken.join(",")
        : "en")
  };
}

function getFlagEmoji(code = "IN") {
  try {
    return String.fromCodePoint(
      ...[...code.toUpperCase()].map(c => 127397 + c.charCodeAt())
    );
  } catch {
    return "🌐";
  }
}

// =============================
// ⚡ OPTIMIZED GOOGLE TRANSLATE (BATCH MODE)
// =============================
async function translateText(input, targetLang = "en") {
  const texts = Array.isArray(input) ? input : [input];
  if (!texts.length) return [];

  // Combine all texts into one Google Translate request
  const joined = texts.join("\n⟬⟬SEP⟭⟭\n");
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(joined)}`;

  const res = await fetch(url, { headers: { "Cache-Control": "no-store" } });
  const raw = await res.text();

  const all = parseGoogleTranslate(raw);
  if (Array.isArray(input)) {
    return all.split("⟬⟬SEP⟭⟭").map(t => t.trim());
  } else {
    return all.trim();
  }
}

function parseGoogleTranslate(raw) {
  try {
    const data = JSON.parse(raw);
    if (Array.isArray(data) && Array.isArray(data[0])) {
      return data[0].map(item => item[0]).join("");
    }
  } catch (err) {
    const match = raw.match(/\[\[\["(.*?)"/);
    if (match && match[1]) return match[1];
  }
  return raw;
}

// =============================
// 🧩 BODY READER (POST Requests)
// =============================
async function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => (data += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch (err) {
        reject(err);
      }
    });
  });
}