import test from "node:test";
import assert from "node:assert/strict";
import { correctWithLexicon, inverseNormalizeEnglish, levenshtein, normalizeText, phraseSimilarity, postprocessTranscript,
  reviewWords, transliterateAcronyms } from "../backend/core/asrPostprocess.js";

const itn = text => { const log = []; return { text: inverseNormalizeEnglish(text, log), log }; };

test("text normalization removes zero-width characters and tidies spacing without touching letters", () => {
  assert.equal(normalizeText("  The​  act  happened ,  on 20 June.  "), "The act happened, on 20 June.");
  assert.equal(normalizeText("आज चोरी हुई।"), "आज चोरी हुई।");
});

test("Levenshtein distance is the classic edit distance", () => {
  assert.equal(levenshtein("kitten", "sitting"), 3);
  assert.equal(levenshtein("", "abc"), 3);
  assert.equal(levenshtein("same", "same"), 0);
});

test("spoken section numbers become digits in every common way of saying them", () => {
  const cases = [
    ["under section three seventy nine of the IPC", "under section 379 of the IPC"],
    ["IPC section three hundred and seventy nine", "IPC section 379"],
    ["section four twenty for cheating", "section 420 for cheating"],
    ["section three oh two", "section 302"],
    ["section three zero two", "section 302"],
    ["BNS section three seven nine", "BNS section 379"],
    ["section seventy nine applies", "section 79 applies"],
    ["section number five oh six", "section number 506"],
    ["section three twenty-one", "section 321"],
    ["section three eleven", "section 311"],
    ["IPC two ninety-four", "IPC 294"]
  ];
  for (const [input, expected] of cases) assert.equal(itn(input).text, expected, input);
});

test("numbers already written as digits, and number words outside a legal context, are left alone", () => {
  for (const sentence of ["under section 379 of the IPC", "He took three bikes and four phones.", "one of them left", "The section was long.",
    "Section 379 applies on 20 June 2024", "no one may enter", "Take the second turn in March"]) {
    assert.equal(itn(sentence).text, sentence, sentence);
  }
});

test("spoken dates become day-month-year with every way of saying the year", () => {
  const cases = [
    ["on the twenty first of June twenty twenty four", "on 21 June 2024"],
    ["on twenty first June two thousand and twenty four", "on 21 June 2024"],
    ["on the third of July two thousand twenty four", "on 3 July 2024"],
    ["on 3rd July twenty twenty four", "on 3rd July 2024"],
    ["it happened on fifteenth August nineteen ninety nine", "it happened on 15 August 1999"],
    ["on the thirtieth of June", "on 30 June"],
    ["on twenty-first June twenty twenty four", "on 21 June 2024"],
    ["on the first of January two thousand and five", "on 1 January 2005"]
  ];
  for (const [input, expected] of cases) assert.equal(itn(input).text, expected, input);
});

test("May and March are only read as months when a year follows", () => {
  assert.equal(itn("no one may enter the room").text, "no one may enter the room");
  assert.equal(itn("they will march on the fifth").text, "they will march on the fifth");
  assert.equal(itn("on the fifth of May twenty twenty four").text, "on 5 May 2024");
});

test("rupee amounts spoken in words become digits", () => {
  assert.equal(itn("he took fifty thousand rupees").text, "he took 50,000 rupees");
  assert.equal(itn("a loan of two lakh rupees").text, "a loan of 200,000 rupees");
  assert.equal(itn("he took fifty things").text, "he took fifty things");
});

test("every conversion is recorded so nothing is changed silently", () => {
  const { log } = itn("section three seventy nine on the twenty first of June twenty twenty four");
  assert.deepEqual(log.map(entry => [entry.kind, entry.from, entry.to]).sort(),
    [["date", "the twenty first of June twenty twenty four", "21 June 2024"], ["section", "three seventy nine", "379"]].sort());
});

test("acronyms written in Indian scripts or spelled out become IPC, BNS, BNSS and CrPC", () => {
  const run = text => { const log = []; return [transliterateAcronyms(text, log), log.length]; };
  assert.deepEqual(run("आईपीसी धारा 379 के तहत"), ["IPC धारा 379 के तहत", 1]);
  assert.deepEqual(run("आयपीसी कलम 379"), ["IPC कलम 379", 1]);
  assert.deepEqual(run("બીએનએસ કલમ 303"), ["BNS કલમ 303", 1]);
  assert.deepEqual(run("آئی پی سی دفعہ 379"), ["IPC دفعہ 379", 1]);
  assert.deepEqual(run("बीएनएसएस और सीआरपीसी"), ["BNSS और CrPC", 2]);
  assert.deepEqual(run("under I P C section 379"), ["under IPC section 379", 1]);
  assert.deepEqual(run("under I.P.C."), ["under IPC.", 1]);
  assert.deepEqual(run("In C and the B N S S rules"), ["In C and the BNSS rules", 1]);
});

test("acronym replacement does not fire inside longer words or unrelated text", () => {
  const log = [];
  for (const text of ["आईपीसीएक शब्द", "ordinary text", "I need a pen", "the b n x thing"]) {
    assert.equal(transliterateAcronyms(text, log), text);
  }
  assert.equal(log.length, 0);
});

test("lexicon correction fixes near-misses of long legal terms and records them", () => {
  const log = [];
  assert.equal(correctWithLexicon("under the Bharatiya Nyaya Sanhitha rules", log), "under the Bharatiya Nyaya Sanhita rules");
  assert.equal(correctWithLexicon("a case of dishonest intension and movable propperty", log),
    "a case of dishonest intention and movable property");
  assert.equal(correctWithLexicon("the crime of extortian was reported", []), "the crime of extortion was reported");
  assert.ok(log.length >= 1 && log.every(entry => entry.kind === "lexicon"));
});

test("lexicon correction never rewrites ordinary words or correct legal terms", () => {
  const sentences = [
    "The man was walking home and stalking nobody.", "He left the property without a word.", "She was chatting about cheating at cards.",
    "The Bharatiya Nyaya Sanhita and the Indian Penal Code both apply.", "criminal breach of trust is serious", "Organized crime is a matter of movable property.",
    "dishonest intention", "a robbery and a theft occurred in the market", "Whoever commits extortion shall be punished."
  ];
  for (const sentence of sentences) {
    const log = [];
    assert.equal(correctWithLexicon(sentence, log), sentence, sentence);
    assert.equal(log.length, 0, sentence);
  }
});

test("phrase similarity combines letter and consonant-skeleton agreement", () => {
  assert.ok(phraseSimilarity("Bharati and Ayya Sanhada", "Bharatiya Nyaya Sanhita") >= 0.7);
  assert.ok(phraseSimilarity("walking", "stalking") < 0.9);
  assert.equal(phraseSimilarity("theft", "theft"), 1);
});

test("word confidence flags uncertain words and treats numbers more strictly", () => {
  const review = reviewWords([
    { w: "The", p: 0.99 }, { w: "act", p: 0.97 }, { w: "Sinatra", p: 0.31 }, { w: "379", p: 0.7 }, { w: "June", p: 0.95 },
    { w: "twenty", p: 0.45 }, { w: ".", p: 0.1 }
  ]);
  assert.deepEqual(review.uncertain.map(item => item.word), ["Sinatra", "twenty", "379"]);
  assert.equal(review.uncertain[0].probability, 0.31);
  assert.ok(review.average > 0.6 && review.average < 0.8);
  assert.deepEqual(reviewWords(null), { average: null, uncertain: [] });
  assert.deepEqual(reviewWords([{ w: "ok", p: 0.99 }]).uncertain, []);
});

test("the full pipeline turns a typical spoken legal sentence into clean, analysable text", () => {
  const result = postprocessTranscript("The  offence took place on the twenty first of June twenty twenty four under section three seventy nine of the I P C",
    { language: "en", words: [{ w: "Sinatra", p: 0.2 }, { w: "June", p: 0.9 }] });
  assert.equal(result.text, "The offence took place on 21 June 2024 under section 379 of the IPC");
  assert.equal(result.rawText.includes("twenty first"), true);
  assert.deepEqual(result.corrections.map(entry => entry.kind).sort(), ["acronym", "date", "section"]);
  assert.deepEqual(result.uncertainWords, [{ word: "Sinatra", probability: 0.2 }]);
});

test("English-only stages never run on Indian-language transcripts, but acronyms still normalise", () => {
  const result = postprocessTranscript("आईपीसी धारा तीन सौ उनासी और section three seventy nine", { language: "hi" });
  assert.equal(result.text, "IPC धारा तीन सौ उनासी और section three seventy nine");
});

test("clean transcripts pass through unchanged, so the stage is safe to run on every recording", () => {
  for (const text of ["The alleged act happened on 20 June 2024 and concerns theft of movable property under IPC section 379.",
    "आज चोरी हुई।", "Original transcript.", "20 जून 2024 को चोरी हुई। IPC 379"]) {
    const result = postprocessTranscript(text, { language: /[A-Za-z]/.test(text) && !/[^\x00-\x7f]/.test(text) ? "en" : "hi" });
    assert.equal(result.text, text);
    assert.equal(result.corrections.length, 0);
  }
});
