// Light, rule-based suffix stripping (in the spirit of Larkey et al.'s light stemmers for Hindi and Arabic-script
// languages). It trims inflectional endings so related forms share a stem; it does NOT produce dictionary lemmas, and it
// is not a morphological analyser. A suffix is removed only when enough characters remain (2; 3 for English), and
// function words are never stemmed.

// English needs a longer floor: with two letters "was" would become "wa".
const minStem = profile => (profile.code === "en" ? 3 : 2);

export function stem(word, profile) {
  if (!profile || !word) return word;
  const surface = word.normalize("NFC");
  if (surface.length <= minStem(profile) + 1) return surface;
  if (profile.stopwords.has(surface.toLowerCase()) || profile.negations.has(surface.toLowerCase())) return surface;
  const lower = profile.code === "en" ? surface.toLowerCase() : surface;
  // Longest matching suffix first; only one suffix is stripped, which keeps the rule predictable.
  for (const suffix of [...profile.suffixes].sort((a, b) => b.length - a.length)) {
    if (lower.endsWith(suffix) && lower.length - suffix.length >= minStem(profile)) return lower.slice(0, lower.length - suffix.length);
  }
  return lower;
}

export const STEMMING_METHOD = "light rule-based suffix stripping (no lemmatizer)";
