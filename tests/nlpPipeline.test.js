import test from "node:test";
import assert from "node:assert/strict";
import { PROFILES, getProfile, inferLanguageFromScript } from "../backend/core/nlp/languageProfiles.js";
import { asciiDigits, scriptOf, splitSentences, tokenize } from "../backend/core/nlp/tokenizer.js";
import { stem } from "../backend/core/nlp/stemmer.js";
import { extractEntities } from "../backend/core/nlp/entities.js";
import { extractKeyphrases } from "../backend/core/nlp/keywords.js";
import { analyzeText, NLP_PIPELINE_STAGES } from "../backend/core/nlp/index.js";
import { PIPELINE_STAGES, describePipeline } from "../backend/core/nlp/pipeline.js";

const words = (text, code) => tokenize(text).filter(token => token.type === "word").map(token => token.text);

test("every language profile carries the resources the pipeline needs", () => {
  for (const code of ["hi", "mr", "gu", "ur", "en"]) {
    const profile = getProfile(code);
    assert.equal(profile.code, code);
    for (const key of ["name", "script", "stopwords", "negations", "suffixes", "sectionWords", "moneyWords", "lawNames", "offences"]) assert.ok(profile[key], `${code}.${key}`);
    assert.ok(profile.stopwords.size > 20, code);
    // Negations must never be removed as stop-words: they change legal meaning.
    for (const negation of profile.negations) assert.equal(profile.stopwords.has(negation), false, `${code} ${negation}`);
  }
  assert.equal(getProfile("hi-IN").code, "hi");
  assert.equal(getProfile("xx"), null);
});

test("tokenization keeps combining marks and joiners inside words in every script", () => {
  for (const [text, expected] of [["चोरी हुई", 2], ["ચોરી થઈ", 2], ["چوری ہو گئی", 3], ["theft happened", 2], ["क्षेत्र", 1], ["कृपया", 1]]) {
    assert.equal(tokenize(text).filter(token => token.type === "word").length, expected, text);
  }
  assert.deepEqual(tokenize("धारा 379।").map(token => token.type), ["word", "number", "punct"]);
  assert.equal(tokenize("मेरा_नाम")[0].type, "word");
});

test("digits of Indian and Arabic scripts convert one-for-one, so offsets stay valid", () => {
  assert.equal(asciiDigits("२० जून २०२४"), "20 जून 2024");
  assert.equal(asciiDigits("૨૦૨૪"), "2024");
  assert.equal(asciiDigits("۲۰۲۴ ٣٧٩"), "2024 379");
  assert.equal(asciiDigits("a1b"), "a1b");
  assert.equal(asciiDigits("२० जून").length, "२० जून".length);
  assert.equal(tokenize("२०२४").at(0).value, "2024");
});

test("scripts are identified from the characters themselves", () => {
  assert.equal(scriptOf("चोरी"), "devanagari");
  assert.equal(scriptOf("ચોરી"), "gujarati");
  assert.equal(scriptOf("چوری"), "arabic");
  assert.equal(scriptOf("theft"), "latin");
});

test("sentence splitting understands Indian full stops and does not break on abbreviations or decimals", () => {
  assert.deepEqual(splitSentences("पहला वाक्य। दूसरा वाक्य।"), ["पहला वाक्य।", "दूसरा वाक्य।"]);
  assert.deepEqual(splitSentences("پہلا جملہ۔ دوسرا جملہ؟ تیسرا!"), ["پہلا جملہ۔", "دوسرا جملہ؟", "تیسرا!"]);
  assert.equal(splitSentences("He paid Rs. 5000 on 20.06.2024 under Sec. 379. Then he left.").length, 2);
  assert.equal(splitSentences("The value was 3.14 units").length, 1);
  assert.deepEqual(splitSentences(""), []);
  assert.deepEqual(splitSentences("no ender"), ["no ender"]);
});

test("stemming strips one inflectional suffix, keeps a minimum stem and never touches function words", () => {
  const hindi = getProfile("hi");
  assert.equal(stem("चोरों", hindi), "चोर");
  assert.ok(stem("चोरी", hindi).length >= 2);
  assert.equal(stem("है", hindi), "है");
  assert.equal(stem("नहीं", hindi), "नहीं");
  const english = getProfile("en");
  assert.equal(stem("happened", english), "happen");
  assert.equal(stem("was", english), "was");
  assert.equal(stem("is", english), "is");
  for (const profile of Object.values(PROFILES)) {
    for (const word of ["a", "ab"]) assert.equal(stem(word, profile).length, word.length);
  }
});

test("dates are recognised in every script and invalid calendar dates are rejected", () => {
  const find = (text, code) => extractEntities(text, getProfile(code)).filter(entity => entity.type === "DATE");
  assert.equal(find("20 जून 2024 को", "hi")[0].value, "2024-06-20");
  assert.equal(find("૨૦ જૂન ૨૦૨૪ ના રોજ", "gu")[0].value, "2024-06-20");
  assert.equal(find("20 جون 2024 کو", "ur")[0].value, "2024-06-20");
  assert.equal(find("on 20 June 2024 and 2024-07-01", "en").map(entity => entity.value).sort().join(), "2024-06-20,2024-07-01");
  assert.equal(find("31 February 2024", "en").length, 0);
  assert.equal(find("2024-13-40", "en").length, 0);
  assert.equal(find("June 3, 2024", "en")[0].value, "2024-06-03");
});

test("section references carry the code when present and are not confused with other numbers", () => {
  const sections = (text, code) => extractEntities(text, getProfile(code)).filter(entity => entity.type === "SECTION");
  assert.equal(sections("IPC धारा 379 के तहत", "hi")[0].value, "IPC 379");
  assert.equal(sections("IPC કલમ 420", "gu")[0].value, "IPC 420");
  assert.equal(sections("آئی پی سی دفعہ 379".replace("آئی پی سی", "IPC"), "ur")[0].value, "IPC 379");
  assert.equal(sections("under section 302A of the code", "en")[0].section, "302A");
  assert.equal(sections("BNS 303", "en")[0].code, "BNS");
  assert.equal(sections("he had 379 coins", "en").length, 0);
});

test("money, law names and offence terms are found through the language gazetteers", () => {
  const types = (text, code) => extractEntities(text, getProfile(code)).map(entity => [entity.type, entity.value]);
  assert.deepEqual(types("5000 रुपये खोए", "hi").find(item => item[0] === "MONEY"), ["MONEY", 5000]);
  assert.deepEqual(types("₹ 12,500 were taken", "en").find(item => item[0] === "MONEY"), ["MONEY", 12500]);
  assert.deepEqual(types("भारतीय दंड संहिता के अनुसार", "hi").find(item => item[0] === "LAW"), ["LAW", "IPC"]);
  assert.ok(types("मोबाइल की चोरी हुई", "hi").some(item => item[0] === "OFFENCE" && item[1] === "theft"));
  assert.ok(types("چوری کی رپورٹ", "ur").some(item => item[0] === "OFFENCE" && item[1] === "theft"));
  assert.ok(types("ચોરીની ફરિયાદ", "gu").some(item => item[0] === "OFFENCE" && item[1] === "theft"));
  assert.ok(types("a case of theft", "en").some(item => item[0] === "OFFENCE"));
});

test("overlapping entities are resolved to one span and entity offsets index the original text", () => {
  const text = "२० जून २०२४ को IPC धारा ३७९ के तहत";
  const entities = extractEntities(text, getProfile("hi"));
  for (const entity of entities) assert.equal(text.slice(entity.start, entity.end), entity.text);
  for (let i = 1; i < entities.length; i++) assert.ok(entities[i].start >= entities[i - 1].end);
  assert.equal(entities.filter(entity => entity.type === "LAW").length, 0, "IPC inside a section reference is not reported twice");
  assert.equal(entities.find(entity => entity.type === "SECTION").value, "IPC 379");
});

test("no PERSON, LOCATION or ORGANIZATION entity is ever produced, because there is no model for them", () => {
  const out = extractEntities("Ramesh Kumar of Mumbai filed a complaint against Tata Motors", getProfile("en"));
  assert.deepEqual(out.filter(entity => ["PERSON", "LOCATION", "ORGANIZATION"].includes(entity.type)), []);
});

test("RAKE scores phrases by word degree over frequency and never spans a stop-word", () => {
  const profile = getProfile("en");
  const tokens = tokenize("mobile phone theft and mobile phone fraud");
  const phrases = extractKeyphrases(tokens, profile);
  const byPhrase = Object.fromEntries(phrases.map(item => [item.phrase, item]));
  assert.ok(byPhrase["mobile phone theft"] && byPhrase["mobile phone fraud"]);
  // deg(mobile)=6, freq=2 -> 3; deg(phone)=6, freq=2 -> 3; deg(theft)=3, freq=1 -> 3  => 9
  assert.equal(byPhrase["mobile phone theft"].score, 9);
  for (const item of phrases) for (const word of item.phrase.split(" ")) assert.equal(profile.stopwords.has(word), false);
});

test("keyphrases keep negations inside the phrase because they carry meaning", () => {
  const phrases = extractKeyphrases(tokenize("he took the property without consent"), getProfile("en")).map(item => item.phrase);
  assert.ok(phrases.some(phrase => phrase.includes("without consent")), phrases.join("|"));
});

test("the pipeline reports each stage and states honestly what it cannot do", () => {
  const result = analyzeText("20 जून 2024 को चोरी हुई। आईपीसी धारा 379 के तहत।", { language: "hi" });
  assert.equal(result.language.code, "hi");
  assert.equal(result.language.source, "provided");
  assert.equal(result.normalization.corrections.length, 1);
  assert.ok(result.normalization.text.includes("IPC धारा 379"));
  assert.equal(result.sentences.length, 2);
  assert.ok(result.stats.tokens > 5 && result.stats.entities >= 3);
  assert.ok(result.entities.some(entity => entity.type === "SECTION"));
  assert.equal(result.capabilities.lemmatization, false);
  assert.equal(result.capabilities.sentiment, false);
  assert.deepEqual(result.capabilities.namedEntities.notSupported, ["PERSON", "LOCATION", "ORGANIZATION"]);
  assert.equal(result.classification.available, false);
  assert.deepEqual(NLP_PIPELINE_STAGES.slice(0, 3), ["language", "normalization", "sentences"]);
});

test("English text gets the project's existing rule-based legal concept classification", () => {
  const result = analyzeText("The accused took my phone without consent and I want to report the theft.", { language: "en" });
  assert.equal(result.classification.available, true);
  assert.match(result.classification.source, /existing rule-based/);
  assert.ok(Array.isArray(result.classification.concepts));
});

test("language is inferred from script when none is given, and Devanagari is reported as ambiguous", () => {
  assert.equal(analyzeText("ચોરી થઈ").language.code, "gu");
  assert.equal(analyzeText("چوری ہوئی").language.code, "ur");
  assert.equal(analyzeText("a theft happened").language.code, "en");
  const devanagari = analyzeText("चोरी हुई");
  assert.equal(devanagari.language.ambiguous, true);
  assert.deepEqual(devanagari.language.alternatives, ["mr"]);
  assert.deepEqual(inferLanguageFromScript("12345"), { language: null, confidence: "none", ambiguous: false });
});

test("empty, unknown-language and punctuation-only input never throws", () => {
  for (const [text, language] of [["", "hi"], ["   ", "gu"], ["!!!", "ur"], ["12345", "hi"], ["text", "zz"], [null, "en"]]) {
    const result = analyzeText(text, { language });
    assert.ok(Array.isArray(result.tokens) && Array.isArray(result.entities), String(text));
  }
});

test("the pipeline description lists only stages that name real files and the categories in use", () => {
  const description = describePipeline({ hindiModelReady: true });
  assert.ok(description.stages.length >= 15);
  const categories = new Set(description.stages.flatMap(item => item.categories));
  assert.deepEqual([...categories].sort(), ["AML", "DL", "ML", "NLP"]);
  for (const item of PIPELINE_STAGES) {
    assert.ok(item.concepts.length && item.detail && item.group, item.id);
    for (const file of item.file.split(",").map(part => part.trim())) assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${item.id}: ${file}`);
  }
  assert.equal(description.registry.find(item => item.code === "hi").installed, true);
  assert.equal(description.registry.find(item => item.code === "gu").genericFallback, false);
});

import { existsSync } from "node:fs";

test("stop-words are identified and flagged, never deleted, and negations are never identified as stop-words", () => {
  const result = analyzeText("The accused did not take the phone without consent.", { language: "en" });
  const surface = result.tokens.filter(token => token.type === "word").map(token => token.text);
  assert.deepEqual(surface.slice(0, 3), ["The", "accused", "did"], "the token list still contains every word");
  assert.ok(result.stopwords.identified.includes("The") || result.stopwords.identified.includes("the"));
  assert.ok(result.tokens.find(token => token.text === "The").stopword);
  for (const negation of ["not", "without"]) {
    assert.equal(result.stopwords.identified.includes(negation), false, negation);
    assert.equal(result.tokens.find(token => token.text === negation).negation, true, negation);
  }
  assert.deepEqual(result.stopwords.keptNegations.sort(), ["not", "without"]);
  assert.equal("removed" in result.stopwords, false, "no field claims the stop-words were removed");
});
