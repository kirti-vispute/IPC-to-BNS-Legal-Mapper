import { corpus } from "./corpus.js";

const STOPWORDS = new Set([
  "the", "and", "or", "of", "to", "a", "an", "is", "was", "with", "under", "on", "in", "for", "by",
  "act", "alleged", "case", "concerns", "conduct", "continued", "date", "from", "happened", "incident",
  "involved", "january", "february", "march", "april", "may", "june", "july", "august", "september",
  "october", "november", "december", "offence", "offense", "occurred", "place", "took", "until",
  "his", "her", "their", "its", "it", "which", "law", "section", "apply"
]);

export function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token) && !/^\d{1,4}$/.test(token));
}

export function retrieveStatutes(query, facts, gate, limit = 3) {
  if (gate.allowedCodes.length === 0) return [];

  const docs = corpus.filter((doc) => gate.allowedCodes.includes(doc.code) && !isRepealed(doc));
  const docTokens = docs.map((doc) => new Set(tokenize([doc.section, doc.title, doc.text, doc.keywords.join(" ")].join(" "))));
  const queryTokens = Array.from(
    new Set(tokenize([query, facts.keywords.join(" "), (facts.legalPhrases || []).join(" "), facts.sections.join(" ")].join(" ")))
  );
  const idf = buildIdf(queryTokens, docTokens);

  const ranked = docs
    .map((doc, index) => ({
      ...doc,
      excerpt: buildExcerpt(doc.text, queryTokens),
      score: scoreDocument(doc, docTokens[index], queryTokens, facts, idf, gate)
    }))
    .filter((doc) => doc.score > 0)
    .sort(
      (a, b) =>
        explicitReferenceRank(b, facts, gate) - explicitReferenceRank(a, facts, gate) ||
        primaryRank(b, gate) - primaryRank(a, gate) ||
        b.score - a.score ||
        a.id.localeCompare(b.id)
    );

  return gate.route === "MULTI_PERIOD_REVIEW" ? diversifyByCode(ranked, gate.allowedCodes, limit) : ranked.slice(0, limit);
}

function diversifyByCode(ranked, codes, limit) {
  const selected = codes.map((code) => ranked.find((doc) => doc.code === code)).filter(Boolean);
  for (const doc of ranked) {
    if (selected.length >= limit) break;
    if (!selected.some((candidate) => candidate.id === doc.id)) selected.push(doc);
  }
  return selected.slice(0, limit);
}

function primaryRank(doc, gate) {
  return gate.route === "BNS_PRIMARY" && doc.code === "BNS" ? 1 : 0;
}

function isRepealed(doc) {
  return /\brepealed\b|\[repealed\]|^\s*rep\.\s+by/i.test(`${doc.title} ${doc.text.slice(0, 80)}`);
}

function buildExcerpt(text, queryTokens, maxLength = 560) {
  if (text.length <= maxLength) return text;
  const lower = text.toLowerCase();
  const positions = queryTokens
    .filter((token) => token.length > 3)
    .map((token) => lower.indexOf(token))
    .filter((position) => position >= 0);
  const anchor = positions.length ? Math.min(...positions) : 0;
  const start = Math.max(0, anchor - 80);
  const prefix = start > 0 ? "..." : "";
  return `${prefix}${text.slice(start, start + maxLength).trim()}...`;
}

function buildIdf(queryTokens, docTokens) {
  const idf = new Map();
  for (const token of new Set(queryTokens)) {
    const hits = docTokens.filter((tokens) => tokens.has(token)).length;
    idf.set(token, Math.log((docTokens.length + 1) / (hits + 1)) + 1);
  }
  return idf;
}

function scoreDocument(doc, tokens, queryTokens, facts, idf, gate) {
  let score = 0;
  const titleTokens = new Set(tokenize(doc.title));

  for (const token of queryTokens) {
    if (tokens.has(token)) score += idf.get(token) ?? 1;
    if (titleTokens.has(token)) score += 8;
  }

  if (exactReferenceMatches(doc, facts.sectionRefs || [], facts.sections)) score += 50;
  if (mappedReferenceMatches(doc, facts.sectionRefs || [], gate)) score += 30;
  score += legalFeatureBoost(doc, facts, gate);
  if (gate.route === "BNS_PRIMARY" && doc.code === "BNS") score += 2;
  if (gate.route === "IPC_ONLY" && doc.code === "IPC") score += 2;
  if (gate.route === "MULTI_PERIOD_REVIEW") score += 1;

  return Number(score.toFixed(3));
}

function exactReferenceMatches(doc, sectionRefs, sections) {
  if (!sectionRefs.length) return sections.includes(doc.section.toUpperCase());
  return sectionRefs.some(
    (reference) => reference.section === doc.section.toUpperCase() && (!reference.code || reference.code === doc.code)
  );
}

function mappedReferenceMatches(doc, sectionRefs, gate) {
  if (gate.route !== "MULTI_PERIOD_REVIEW" && doc.code !== gate.allowedCodes[0]) return false;
  return sectionRefs.some((reference) => {
    if (!reference.code || reference.code === doc.code) return false;
    return doc.mapsTo.includes(`${reference.code.toLowerCase()}-${reference.section.toLowerCase()}`);
  });
}

function legalFeatureBoost(doc, facts, gate) {
  return theftFeatureBoost(doc, facts, gate) + cheatingFeatureBoost(doc, facts, gate) + hurtFeatureBoost(doc, facts, gate) + retentionFeatureBoost(doc, facts, gate) + reviewFeatureBoost(doc, facts);
}

function theftFeatureBoost(doc, facts, gate) {
  if (!hasTheftCue(facts)) return 0;
  const reviewOnly = facts.concepts?.includes("unauthorized_property_retention");
  if (reviewOnly && ["ipc-378", "ipc-379", "bns-303"].includes(doc.id)) return 30;
  if (doc.code === "IPC" && doc.section === "378") return gate.route === "IPC_ONLY" || gate.route === "MULTI_PERIOD_REVIEW" ? 35 : 0;
  if (doc.code === "IPC" && doc.section === "379") return gate.route === "IPC_ONLY" || gate.route === "MULTI_PERIOD_REVIEW" ? 40 : 0;
  if (doc.code === "BNS" && doc.section === "303") return gate.route === "BNS_PRIMARY" || gate.route === "MULTI_PERIOD_REVIEW" ? 35 : 0;
  return 0;
}

function hasTheftCue(facts) {
  const keywords = new Set(facts.keywords || []);
  const phrases = new Set(facts.legalPhrases || []);
  if (keywords.has("theft")) return true;

  const propertyCue = phrases.has("movable property") || phrases.has("mobile phone") || phrases.has("phone property") || keywords.has("property");
  if (facts.concepts?.some(concept => ["unauthorized_property_retention", "reported_theft_unspecified"].includes(concept))) return true;
  if (phrases.has("victim property stolen")) return true;
  if (propertyCue && hasAnyKeyword(keywords, ["steal", "steals", "stealing", "stole"])) return true;
  const takingCue = hasAnyKeyword(keywords, ["stolen", "take", "took", "taking", "taken", "takes", "moved", "moves"]);
  const possessionCue = phrases.has("out of possession") || phrases.has("from possession");
  const consentCue = phrases.has("without consent") || phrases.has("without permission");
  const dishonestCue = keywords.has("dishonest") || keywords.has("dishonestly");

  return propertyCue && consentCue && (takingCue || possessionCue || dishonestCue);
}

function retentionFeatureBoost(doc, facts) {
  return facts.concepts?.includes("unauthorized_property_retention") && ["ipc-403", "bns-314"].includes(doc.id) ? 35 : 0;
}

function reviewFeatureBoost(doc, facts) {
  if (facts.sectionRefs?.length) return 0;
  if (facts.concepts?.includes("intentional_death_review") && ["ipc-299", "ipc-300", "bns-100", "bns-101"].includes(doc.id)) return 35;
  if (facts.concepts?.includes("stalking_review") && ["ipc-354d", "bns-78"].includes(doc.id)) return 35;
  return 0;
}

function cheatingFeatureBoost(doc, facts, gate) {
  if (!hasCheatingCue(facts, gate)) return 0;
  if (doc.code === "BNS" && doc.section === "318") return gate.route === "BNS_PRIMARY" || gate.route === "MULTI_PERIOD_REVIEW" ? 35 : 0;
  if (doc.code === "IPC" && doc.section === "420") return gate.route === "IPC_ONLY" || gate.route === "MULTI_PERIOD_REVIEW" ? 35 : 0;
  if (doc.code === "IPC" && doc.section === "415") return gate.route === "IPC_ONLY" || gate.route === "MULTI_PERIOD_REVIEW" ? 25 : 0;
  return 0;
}

function hasCheatingCue(facts, gate) {
  const keywords = new Set(facts.keywords || []);
  const phrases = new Set(facts.legalPhrases || []);
  const concepts = new Set(facts.concepts || []);
  if (keywords.has("cheating")) return true;
  if (concepts.has("cheating")) return true;

  const deceptionCue = hasAnyKeyword(keywords, ["deceive", "deceived", "deceiving", "deception", "deceptive", "trick", "tricked", "cheated"]) ||
    hasAnyKeyword(keywords, ["defraud", "defrauded", "defrauding", "defrauds"]) ||
    phrases.has("deceived person") ||
    phrases.has("tricked person") ||
    phrases.has("deceived into property transfer");
  const dishonestCue = hasAnyKeyword(keywords, ["dishonest", "dishonestly", "fraud", "fraudulent", "fraudulently", "unjustly", "unfairly", "unfaithfully", "treasonfully", "disloyalty"]);
  const inducementCue = hasAnyKeyword(keywords, ["induce", "induced", "induces", "inducement"]) ||
    phrases.has("dishonestly induced") ||
    phrases.has("led to property transfer") ||
    phrases.has("deceived into property transfer");
  const deliveryCue =
    hasAnyKeyword(keywords, ["deliver", "delivered", "delivering", "delivers", "delivery", "give", "gave", "giving", "hand", "handed"]) ||
    hasAnyKeyword(keywords, ["transfer", "transferred", "transferring", "transfers", "sell", "sold", "selling"]) ||
    phrases.has("deliver property") ||
    phrases.has("give property") ||
    phrases.has("hand over property") ||
    phrases.has("transfer property") ||
    phrases.has("sell property") ||
    phrases.has("delivery of property") ||
    keywords.has("property");

  if (gate.route === "MULTI_PERIOD_REVIEW" && deceptionCue && deliveryCue) return true;
  return deceptionCue && dishonestCue && inducementCue && deliveryCue;
}

function hurtFeatureBoost(doc, facts, gate) {
  if (facts.sectionRefs?.length) return 0;
  const cue = hurtCue(facts);
  if (!cue.present) return 0;
  const post = gate.route === "BNS_PRIMARY" || gate.route === "MULTI_PERIOD_REVIEW";
  const pre = gate.route === "IPC_ONLY" || gate.route === "MULTI_PERIOD_REVIEW";

  if (cue.grievous) {
    if (doc.code === "BNS" && doc.section === "117") return post ? 45 : 0;
    if (doc.code === "BNS" && doc.section === "116") return post ? 38 : 0;
    if (doc.code === "IPC" && doc.section === "322") return pre ? 45 : 0;
    if (doc.code === "IPC" && doc.section === "320") return pre ? 38 : 0;
    if (doc.code === "IPC" && doc.section === "325") return pre ? 35 : 0;
  }

  if (cue.serious) {
    if (doc.code === "BNS" && doc.section === "117") return post ? 24 : 0;
    if (doc.code === "BNS" && doc.section === "116") return post ? 20 : 0;
    if (doc.code === "IPC" && doc.section === "322") return pre ? 24 : 0;
    if (doc.code === "IPC" && doc.section === "320") return pre ? 20 : 0;
  }

  if (doc.code === "BNS" && doc.section === "115") return post ? 40 : 0;
  if (doc.code === "BNS" && doc.section === "114") return post ? 36 : 0;
  if (doc.code === "BNS" && doc.section === "117") return post ? 26 : 0;
  if (doc.code === "BNS" && doc.section === "116") return post ? 22 : 0;
  if (doc.code === "IPC" && doc.section === "321") return pre ? 40 : 0;
  if (doc.code === "IPC" && doc.section === "319") return pre ? 36 : 0;
  if (doc.code === "IPC" && doc.section === "322") return pre ? 26 : 0;
  if (doc.code === "IPC" && doc.section === "320") return pre ? 22 : 0;
  if (doc.code === "IPC" && doc.section === "323") return pre ? 25 : 0;
  return 0;
}

function hurtCue(facts) {
  const keywords = new Set(facts.keywords || []);
  const phrases = new Set(facts.legalPhrases || []);
  const concepts = new Set(facts.concepts || []);
  const grievous = concepts.has("grievous_hurt") || keywords.has("grievous") || phrases.has("grievous hurt");
  const serious = hasAnyKeyword(keywords, ["serious", "seriously"]) ||
    phrases.has("seriously injured") ||
    phrases.has("serious injury");
  const actualHarm = concepts.has("hurt") ||
    hasAnyKeyword(keywords, ["hurt", "hurts", "injure", "injured", "injures", "injury", "injuries", "wound", "wounded", "bodily", "pain"]) ||
    serious ||
    phrases.has("caused hurt") ||
    phrases.has("caused injury") ||
    phrases.has("physical injury") ||
    phrases.has("physical harm") ||
    phrases.has("bodily pain");

  return { present: actualHarm || grievous, grievous, serious };
}

function hasAnyKeyword(keywords, values) {
  return values.some((value) => keywords.has(value));
}

function explicitReferenceRank(doc, facts, gate) {
  const sectionRefs = facts.sectionRefs || [];
  const primaryCode = gate.allowedCodes[0];
  if (!sectionRefs.length || doc.code !== primaryCode) return 0;
  return sectionRefs.some(
    (reference) => reference.code === doc.code && reference.section === doc.section.toUpperCase()
  )
    ? 1
    : 0;
}

export function getCorpus() {
  return corpus;
}
