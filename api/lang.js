// File: /api/lang.js

export default async function handler(req, res) {
  const { text, target } = req.query;

  try {
    // 🌎 STEP 1 — Detect visitor location & preferred language
    const locationData = await fetch("https://ipapi.co/json/").then(r => r.json());
    const detectedLang = locationData.languages
      ? locationData.languages.split(",")[0].split("-")[0]
      : "en";

    // If no 'text' param, just return detected language & location
    if (!text) {
      return res.status(200).json({
        country: locationData.country_name,
        countryCode: locationData.country_code,
        detectedLang,
        message: `🌍 Detected language: ${detectedLang} from ${locationData.country_name}`,
      });
    }

    // 🌐 STEP 2 — Translate text using Google API
    const response = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target || detectedLang}&dt=t&q=${encodeURIComponent(
        text
      )}`
    );

    const data = await response.json();

    const translatedText =
      Array.isArray(data[0]) && Array.isArray(data[0][0]) ? data[0].map(t => t[0]).join("") : text;

    // ✅ STEP 3 — Respond with translation + context
    return res.status(200).json({
      original: text,
      translated: translatedText,
      from: data[2] || "auto",
      to: target || detectedLang,
      detectedLang,
      location: locationData.country_name,
      flag: String.fromCodePoint(...[...locationData.country_code].map(c => 127397 + c.charCodeAt())),
    });
  } catch (err) {
    console.error("❌ Translation error:", err);
    return res.status(500).json({ error: "Translation service failed." });
  }
}