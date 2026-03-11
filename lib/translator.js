const axios = require("axios");
const { translateWithAI } = require("./ai");
const { supportedLanguages } = require("../config");

async function translate(text, targetLang, sourceLang = "auto") {
  const aiResult = await translateWithAI(text, supportedLanguages[targetLang] || targetLang);
  if (aiResult) return { text: aiResult, source: "AI" };

  try {
    const url = `https://api.mymemory.translated.net/get`;
    const params = {
      q: text.slice(0, 500),
      langpair: `${sourceLang}|${targetLang}`,
    };
    const res = await axios.get(url, { params, timeout: 8000 });
    const translated = res.data?.responseData?.translatedText;
    if (translated && translated !== text) {
      return { text: translated, source: "MyMemory" };
    }
  } catch {}

  return { text: "❌ Translation service unavailable. Please set OPENAI_API_KEY.", source: "error" };
}

function isValidLang(code) {
  return !!supportedLanguages[code];
}

module.exports = { translate, isValidLang };
