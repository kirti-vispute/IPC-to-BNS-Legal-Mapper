const MONTHS = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11
};

const DATE_PATTERNS = [
  /\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/g,
  /\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](20\d{2})\b/g,
  /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+([0-3]?\d),?\s+(20\d{2})\b/gi,
  /\b([0-3]?\d)\s+(january|february|march|april|may|june|july|august|september|october|november|december),?\s+(20\d{2})\b/gi
];

export function parseDateCandidate(match, patternIndex) {
  if (patternIndex === 0) return toIso(Number(match[1]), Number(match[2]), Number(match[3]));
  if (patternIndex === 1) return toIso(Number(match[3]), Number(match[2]), Number(match[1]));
  if (patternIndex === 2) return toIso(Number(match[3]), MONTHS[match[1].toLowerCase()] + 1, Number(match[2]));
  return toIso(Number(match[3]), MONTHS[match[2].toLowerCase()] + 1, Number(match[1]));
}

export function toIso(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

export function extractFacts(query) {
  const dates = [];
  DATE_PATTERNS.forEach((pattern, index) => {
    for (const match of query.matchAll(pattern)) {
      const iso = parseDateCandidate(match, index);
      if (!iso) continue;
      const contextStart = Math.max(0, match.index - 45);
      const contextEnd = Math.min(query.length, match.index + match[0].length + 45);
      dates.push({
        value: iso,
        raw: match[0],
        context: query.slice(contextStart, contextEnd)
      });
    }
  });

  const uniqueDates = Array.from(new Map(dates.map((date) => [date.value, date])).values());
  const sectionRefs = Array.from(
    query.matchAll(/\b(?:(ipc|bns)\s*(?:section\s*)?|section\s+)(\d{1,3}[a-z]{0,3})\b/gi)
  ).map((match) => ({ code: match[1]?.toUpperCase() || null, section: match[2].toUpperCase() }));

  const lower = query.toLowerCase().replace(/([a-z])\s+(['’])s\b/g, "$1$2s");
  const continuingSignal = /\b(continued|continuing|ongoing|from|between|until|through|spanning|completed after|started before)\b/.test(lower);
  const keywords = extractKeywords(lower);
  const legalPhrases = extractLegalPhrases(lower);

  return {
    dates: uniqueDates,
    offenseDate: chooseOffenseDate(uniqueDates, lower),
    sections: Array.from(new Set(sectionRefs.map((reference) => reference.section))),
    sectionRefs,
    keywords,
    legalPhrases,
    concepts: extractLegalConcepts(lower, keywords, legalPhrases),
    continuingSignal
  };
}

function chooseOffenseDate(dates, lowerQuery) {
  if (dates.length === 0) return null;
  if (dates.length === 1) return dates[0].value;

  const offenseHints = ["offense", "offence", "crime", "act", "incident", "conduct", "committed", "happened", "took place"];
  const ranked = dates
    .map((date) => ({
      ...date,
      score: offenseHints.reduce((sum, hint) => sum + (date.context.toLowerCase().includes(hint) ? 1 : 0), 0)
    }))
    .sort((a, b) => b.score - a.score);

  if (ranked[0].score > ranked[1].score) return ranked[0].value;
  if (/\b(continued|continuing|until|through|between|spanning)\b/.test(lowerQuery)) return null;
  return ranked[0].value;
}

function extractKeywords(lower) {
  const vocabulary = [
    "theft",
    "movable",
    "dishonest",
    "dishonestly",
    "property",
    "take",
    "took",
    "taking",
    "taken",
    "takes",
    "moved",
    "moves",
    "stolen",
    "steal",
    "steals",
    "stealing",
    "stole",
    "murder",
    "homicide",
    "killing",
    "mob",
    "lynching",
    "cheating",
    "cheated",
    "defraud",
    "defrauded",
    "defrauding",
    "defrauds",
    "fraud",
    "fraudulent",
    "fraudulently",
    "trick",
    "tricked",
    "unjustly",
    "unfairly",
    "unfaithfully",
    "treasonfully",
    "disloyalty",
    "deceive",
    "deceived",
    "deceiving",
    "deception",
    "deceptive",
    "induce",
    "induced",
    "induces",
    "inducement",
    "deliver",
    "delivered",
    "delivering",
    "delivers",
    "delivery",
    "transfer",
    "transferred",
    "transferring",
    "transfers",
    "sell",
    "sold",
    "selling",
    "give",
    "gave",
    "giving",
    "hand",
    "handed",
    "sedition",
    "sovereignty",
    "unity",
    "integrity",
    "organized",
    "crime",
    "syndicate",
    "continuing",
    "unlawful",
    "state",
    "threat",
    "assault",
    "assaulted",
    "attack",
    "attacked",
    "beat",
    "beaten",
    "hit",
    "struck",
    "blow",
    "physical",
    "hurt",
    "hurts",
    "injure",
    "injured",
    "injures",
    "injury",
    "injuries",
    "grievous",
    "serious",
    "seriously",
    "bodily",
    "pain",
    "wound",
    "wounded"
  ];

  return vocabulary.filter((word) => hasWord(lower, word));
}

function extractLegalPhrases(lower) {
  const phrasePatterns = [
    ["movable property", /\bmovable\s+property\b/],
    ["mobile phone", /\bmobile\s+phone\b/],
    ["phone property", /\b(?:(?:mobile|cell(?:ular)?|smart)\s*)?phones?\b/],
    ["dishonestly induced", /\bdishonestly\s+induc(?:e|ed|es|ing|ement)\b/],
    ["deliver property", /\bdeliver(?:s|ed|ing|y)?\s+(?:any\s+)?property\b/],
    ["give property", /\b(?:giv(?:e|es|ing)|gave)\s+(?:(?:him|her|them|a\s+person|someone)\s+)?(?:false\s+|any\s+)?property\b/],
    ["hand over property", /\bhand(?:ed)?\s+over\s+(?:any\s+)?property\b/],
    ["transfer property", /\btransfer(?:s|red|ring)?\s+(?:any\s+)?property\b/],
    ["sell property", /\bs(?:ell|old|elling)\s+(?:any\s+)?property\b/],
    ["delivery of property", /\b(?:caused\s+|resulted\s+in\s+)?delivery\s+of\s+(?:any\s+)?property\b/],
    ["deceived person", /\b(?:person\s+was\s+deceived|deceived\s+(?:a\s+)?person|person\s+deceived)\b/],
    ["tricked person", /\b(?:person\s+was\s+tricked|tricked\s+(?:a\s+)?person|person\s+tricked)\b/],
    ["deceived into property transfer", /\b(?:deceived|tricked|seduced|defrauded?)\s+(?:a\s+)?person\s+into\s+(?:giv(?:e|ing)|hand(?:ing)?\s+over|deliver(?:ing)?|transfer(?:ring)?|sell(?:ing)?)\s+(?:any\s+)?property\b/],
    ["led to property transfer", /\b(?:led|induced|persuaded|caused|made|forced)\s+(?:him|her|them|a\s+person|person|someone)?\s*(?:to\s+)?(?:give|hand\s+over|deliver|transfer|sell)\s+(?:(?:him|her|them|a\s+person|someone)\s+)?(?:false\s+|any\s+)?property\b/],
    ["without consent", /\bwithout\s+(?:the\s+)?(?:(?:that|another)\s+person['’]s\s+|(?:someone|somebody|anyone|anybody)\s+else['’]s\s+|[a-z][a-z0-9]*['’]s\s+|(?:his|her|their|its)\s+)?consent\b/],
    ["without permission", /\bwithout\s+(?:the\s+)?(?:(?:that|another)\s+person['’]s\s+|(?:someone|somebody|anyone|anybody)\s+else['’]s\s+|[a-z][a-z0-9]*['’]s\s+|(?:his|her|their|its)\s+)?permission\b/],
    ["out of possession", /\bout\s+of\s+(?:(?:another|that)\s+person['’]s\s+|[a-z][a-z0-9]*['’]s\s+|(?:his|her|their|its)\s+)?possession\b/],
    ["from possession", /\bfrom\s+(?:(?:another|that)\s+person['’]s\s+|[a-z][a-z0-9]*['’]s\s+|(?:his|her|their|its)\s+)?possession\b/],
    ["victim property stolen", /\b(?:(?:my|our|his|her|their|victim['’]s|complainant['’]s)\s+(?:[a-z]+\s+){1,3}(?:was|were|got)\s+stolen|got\s+(?:my|our|his|her|their|victim['’]s|complainant['’]s)\s+(?:[a-z]+\s+){1,4}stolen)\b/],
    ["seriously injured", /\bseriously\s+injur(?:e|ed|es|ing)\b/],
    ["serious injury", /\bserious\s+injur(?:y|ies)\b/],
    ["grievous hurt", /\bgrievous\s+hurt\b/],
    ["caused hurt", /\b(?:voluntarily\s+)?caus(?:e|ed|es|ing)\s+(?:bodily\s+)?hurt\b/],
    ["caused injury", /\b(?:caus(?:e|ed|es|ing)|inflict(?:ed|s|ing)?|seriously\s+injur(?:e|ed|es|ing))\s+(?:serious\s+|bodily\s+|grave\s+|grievous\s+)?injur(?:y|ies|e|ed|es|ing)\b/],
    ["physical injury", /\b(?:physical|bodily)\s+injur(?:y|ies|e|ed|es|ing)\b/],
    ["physical harm", /\b(?:caus(?:e|ed|es|ing)\s+)?(?:physical|bodily)\s+harm\b/],
    ["bodily pain", /\bbodily\s+pain\b/]
  ];

  return phrasePatterns.filter(([, pattern]) => pattern.test(lower)).map(([label]) => label);
}

function extractLegalConcepts(lower, keywords, legalPhrases) {
  const keywordSet = new Set(keywords);
  const phraseSet = new Set(legalPhrases);
  const concepts = new Set();

  const directHarm =
    hasAnyKeyword(keywordSet, ["hurt", "hurts", "injure", "injured", "injures", "injury", "injuries", "wound", "wounded", "bodily", "pain"]) ||
    phraseSet.has("seriously injured") ||
    phraseSet.has("serious injury") ||
    phraseSet.has("caused hurt") ||
    phraseSet.has("caused injury") ||
    phraseSet.has("physical injury") ||
    phraseSet.has("physical harm") ||
    phraseSet.has("bodily pain");
  const violenceWithHarm =
    hasAnyKeyword(keywordSet, ["assault", "assaulted", "attack", "attacked", "beat", "beaten", "hit", "struck", "blow"]) &&
    (directHarm || /\bcaus(?:e|ed|es|ing)\s+(?:injur|pain|hurt|(?:physical\s+|bodily\s+)harm)/i.test(lower));

  if (directHarm || violenceWithHarm) concepts.add("hurt");
  if (keywordSet.has("grievous") || phraseSet.has("grievous hurt")) concepts.add("grievous_hurt");
  if (hasCheatingConcept(keywordSet, phraseSet)) concepts.add("cheating");
  const phone = phraseSet.has("phone property");
  const unauthorized = phraseSet.has("without consent") || phraseSet.has("without permission");
  const taking = hasAnyKeyword(keywordSet, ["steal", "steals", "stole", "stealing", "take", "takes", "took", "taking", "taken", "stolen", "moved", "moves"]);
  if (phone && unauthorized && !taking && /\b(?:kept|keep|retained|left)\b[\s\S]{0,100}\b(?:with\s+(?:him|her|them)|(?:own|his|her|their)\s+possession)\b/.test(lower)) {
    // Retention is not proof of the taking required for theft; retrieve alternatives for review.
    concepts.add("unauthorized_property_retention");
  }
  if (/^(?:20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\s+)?(?:it\s+(?:was|is)\s+)?stolen[.!?\s]*$/.test(lower.trim())) concepts.add("reported_theft_unspecified");
  for (const sentence of lower.split(/[.!?]/)) {
    const death = /\b(?:caus(?:e|ed|es|ing)\b.{0,80}\bdeath|kill(?:ed|ing|s)?\b.{0,40}\b(?:person|man|woman|him|her))/.test(sentence);
    const intentional = /\b(?:intentionally|deliberately|intention\s+(?:of|to))\b/.test(sentence);
    const denied = /\b(?:not|never|didn't|did\s+not)\s+(?:(?:intentionally|deliberately)\s+)?(?:cause|caused|kill|killed)\b/.test(sentence);
    if (death && intentional && !denied) concepts.add("intentional_death_review");
    const following = /\b(?:follow(?:s|ed|ing)?|contact(?:s|ed|ing)?)\b/.test(sentence);
    const unwanted = /\b(?:unwanted|disinterest|unwelcome|despite\b.{0,30}\b(?:refusal|refused)|without\s+consent)\b/.test(sentence);
    const repeated = /\b(?:repeated(?:ly)?|persistent(?:ly)?|again\s+and\s+again)\b/.test(sentence);
    const monitoring = /\bmonitor(?:s|ed|ing)?\b.{0,80}\b(?:electronic|internet|e-?mail|communication)\b/.test(sentence);
    if ((following && unwanted && repeated) || (monitoring && (unwanted || repeated))) concepts.add("stalking_review");
  }

  return Array.from(concepts);
}

function hasCheatingConcept(keywords, phrases) {
  const deceptionCue =
    hasAnyKeyword(keywords, ["deceive", "deceived", "deceiving", "deception", "deceptive", "trick", "tricked", "cheated", "fraud", "fraudulent", "fraudulently"]) ||
    hasAnyKeyword(keywords, ["defraud", "defrauded", "defrauding", "defrauds"]) ||
    phrases.has("deceived person") ||
    phrases.has("tricked person") ||
    phrases.has("deceived into property transfer");
  const transferCue =
    hasAnyKeyword(keywords, ["deliver", "delivered", "delivering", "delivers", "delivery", "give", "gave", "giving", "hand", "handed"]) ||
    hasAnyKeyword(keywords, ["transfer", "transferred", "transferring", "transfers", "sell", "sold", "selling"]) ||
    phrases.has("deliver property") ||
    phrases.has("give property") ||
    phrases.has("hand over property") ||
    phrases.has("transfer property") ||
    phrases.has("sell property") ||
    phrases.has("delivery of property") ||
    phrases.has("deceived into property transfer") ||
    phrases.has("led to property transfer");
  const propertyCue = keywords.has("property") || transferCue;
  const dishonestCue = hasAnyKeyword(keywords, ["dishonest", "dishonestly", "unjustly", "unfairly", "unfaithfully", "treasonfully", "disloyalty"]);

  return deceptionCue && propertyCue && (transferCue || dishonestCue);
}

function hasAnyKeyword(keywords, values) {
  return values.some((value) => keywords.has(value));
}

function hasWord(lower, word) {
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(word)}([^a-z0-9]|$)`, "i").test(lower);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
