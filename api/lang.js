// File: /api/lang.js

export default async function handler(req, res) {
  const { text, target } = req.query;

  try {
    // 🗺️ STEP 1: Safe IP and Language Detection
    let detectedLang = "en";
    let country = "India";
    let countryCode = "IN";

    try {
      const locationResponse = await fetch("https://ipapi.co/json/");
      const locationText = await locationResponse.text();

      let locationData = {};
      try {
        locationData = JSON.parse(locationText);
      } catch {
        console.warn("⚠️ ipapi.co returned non-JSON (likely rate-limited)");
      }

      if (locationData?.languages) {
        detectedLang = locationData.languages.split(",")[0].split("-")[0];
      }
      if (locationData?.country_name) {
        country = locationData.country_name;
      }
      if (locationData?.country_code) {
        countryCode = locationData.country_code;
      }
    } catch (err) {
      console.warn("⚠️ Location lookup failed:", err.message);
    }

    // 🏳️ Flag emoji
    const flag = getFlagEmoji(countryCode);

    // 🌐 STEP 2: Translation (if `text` is provided)
    if (text) {
      const tl = target || detectedLang || "en";
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${tl}&dt=t&q=${encodeURIComponent(
        text
      )}`;

      const response = await fetch(url);
      const raw = await response.text();

      const translated = parseGoogleTranslate(raw);

      return res.status(200).json({
        original: text,
        translated,
        detectedLang,
        to: tl,
        country,
        countryCode,
        flag
      });
    }

    // 🧭 STEP 3: Only detection (no translation)
    return res.status(200).json({
      detectedLang,
      country,
      countryCode,
      flag,
      message: `🌍 Detected ${detectedLang.toUpperCase()} from ${country}`
    });
  } catch (err) {
    console.error("❌ Translation error:", err);
    return res.status(500).json({
      error: "Translation service failed.",
      details: err.message
    });
  }
}

// 🏳️ Convert country code → flag emoji
function getFlagEmoji(code = "IN") {
  try {
    return String.fromCodePoint(...[...code.toUpperCase()].map(c => 127397 + c.charCodeAt()));
  } catch {
    return "🌐";
  }
}

// 🧠 Parse Google Translate response safely
function parseGoogleTranslate(raw) {
  try {
    // Typical format: [[[ "Hello", "Hola", ... ]], ...]
    const match = raw.match(/\[\[\["(.*?)"/);
    if (match && match[1]) return match[1];
  } catch (err) {
    console.warn("⚠️ Failed to parse translation response:", err.message);
  }
  return raw.slice(0, 200); // fallback: return first 200 chars
}