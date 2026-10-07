export const LANGUAGE_NAMES = { en: "English", hi: "Hindi", mr: "Marathi", gu: "Gujarati", bn: "Bengali", ta: "Tamil", te: "Telugu", kn: "Kannada", ml: "Malayalam", pa: "Punjabi", ur: "Urdu" };

export function normalizeLanguageCode(value) {
  return typeof value === "string" ? value.trim().toLowerCase().replaceAll("_", "-").split("-")[0] || null : null;
}

export function speechLanguageStatus(language, probability) {
  if (!language) return "uncertain";
  if (!LANGUAGE_NAMES[language]) return "unsupported";
  return Number.isFinite(probability) && probability >= 0.8 && probability <= 1 ? "detected" : "uncertain";
}
