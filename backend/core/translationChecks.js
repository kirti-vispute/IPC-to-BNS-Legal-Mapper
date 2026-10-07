const ACCUSED = {
  hi: /आरोपी|अभियुक्त/gu, mr: /आरोपी/gu, gu: /આરોપી/gu, bn: /অভিযুক্ত/gu,
  ta: /குற்றம்\s*சாட்டப்பட்ட/gu, te: /నిందిత/gu, kn: /ಆರೋಪಿ/gu,
  ml: /പ്രതി/gu, pa: /ਦੋਸ਼ੀ/gu, ur: /ملزم/gu
};
const DISHONEST = {
  hi: /बेईमान/u, mr: /अप्रामाणिक/u, gu: /બેઈમાન/u, bn: /অসৎ/u,
  ta: /நேர்மையற்ற/u, te: /నిజాయితీ\s*లేకుండా/u, kn: /ಅಪ್ರಾಮಾಣಿಕ/u,
  ml: /സത്യസന്ധതയില്ലാതെ/u, pa: /ਬੇਈਮਾਨ/u, ur: /بے\s*ایمانی/u
};

export function translationMeaningIssue(original, english, language) {
  const sourceAccused = ACCUSED[language] ? [...original.matchAll(ACCUSED[language])].length : 0;
  const targetAccused = (english.match(/\b(?:accused|defendant)\b/gi) || []).length;
  if (sourceAccused > 0 && targetAccused > sourceAccused) return { code: "TRANSLATION_ROLE_CHANGED", reason: "The translation added an accused/defendant role. Rephrase or review the original input." };
  // Accuser is the opposite party, not a synonym for the explicit source role.
  if (sourceAccused > 0 && targetAccused === 0 && /\baccuser\b/i.test(english)) {
    return { code: "TRANSLATION_ROLE_CHANGED", reason: "The translation replaced an explicit accused role with accuser. Rephrase or review the original input." };
  }
  if (DISHONEST[language]?.test(original) && !/\b(?:dishonest(?:ly)?|fraud(?:ulent(?:ly)?)?|unjust(?:ly)?|unfair(?:ly)?|disloyal(?:ty)?|unfaithful(?:ly)?|treasonful(?:ly)?)\b|without\s+(?:being\s+)?honest/i.test(english)) {
    return { code: "TRANSLATION_INTENT_CHANGED", reason: "The translation did not preserve an explicit dishonesty cue. Rephrase or review the original input." };
  }
  return null;
}
