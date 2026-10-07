import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { translationMeaningIssue } from "../backend/core/translationChecks.js";
import { analyzeMultilingualQuery } from "../backend/core/multilingual.js";

const fixtures = JSON.parse(readFileSync(new URL("./fixtures/multilingual-completion.json", import.meta.url)));
test("all configured native-language fixtures reject introduced actor roles and missing explicit intent", () => {
  for (const fixture of fixtures.filter(f => f.language !== "en")) {
    assert.equal(translationMeaningIssue(fixture.cheating, "The accused deceived the accused and dishonestly obtained property.", fixture.language)?.code, "TRANSLATION_ROLE_CHANGED", fixture.language);
    assert.equal(translationMeaningIssue(fixture.cheating, "The accused deceived a person into giving property to Beiman.", fixture.language)?.code, "TRANSLATION_INTENT_CHANGED", fixture.language);
    assert.equal(translationMeaningIssue(fixture.cheating, "The accused deceived a person and dishonestly induced delivery of property.", fixture.language), null);
  }
});

test("an explicit native accused role cannot be replaced solely by accuser", () => {
  for (const fixture of fixtures.filter(f => f.language !== "en")) {
    assert.equal(translationMeaningIssue(fixture.cheating,
      "The accuser tricked a man into giving property dishonestly.", fixture.language)?.code,
      "TRANSLATION_ROLE_CHANGED", fixture.language);
    assert.equal(translationMeaningIssue(fixture.cheating,
      "The defendant dishonestly deceived a person.", fixture.language), null, fixture.language);
    assert.equal(translationMeaningIssue(fixture.cheating,
      "The accused dishonestly deceived the accuser.", fixture.language), null, fixture.language);
  }
  assert.equal(translationMeaningIssue("ಆಸ್ತಿಯನ್ನು ನೀಡಲಾಯಿತು.", "The accuser gave property.", "kn"), null);
});

test("role inversion is retried once and cannot reach legal analysis while unresolved", async () => {
  const query = `2024-07-10 ${fixtures.find(f => f.language === "kn").cheating} BNS 318`;
  let attempts = 0;
  const corrected = await analyzeMultilingualQuery(query, { originalLanguage: "kn", worker: async payload => {
    if (payload.source !== "kn") return { texts: payload.texts.map(() => "ಮಾಹಿತಿ") };
    attempts++;
    if (attempts === 2) assert.equal(payload.quality, "review");
    return { texts: payload.texts.map(() => attempts === 1
      ? "The accuser tricked a man into giving property dishonestly."
      : "The accused tricked a man into giving property dishonestly.") };
  } });
  assert.equal(attempts, 2);
  assert.equal(corrected.multilingual.translationRetry, true);
  assert.equal(corrected.gate.route, "BNS_PRIMARY");
  assert.equal(corrected.facts.offenseDate, "2024-07-10");
  assert.equal(corrected.retrieved[0].id, "bns-318");
  assert.match(corrected.multilingual.englishQuery, /BNS 318/);
  let rejectedAttempts = 0;
  await assert.rejects(analyzeMultilingualQuery(query, { originalLanguage: "kn", worker: async payload => {
    rejectedAttempts++;
    return { texts: payload.texts.map(() => "The accuser tricked a man into giving property dishonestly.") };
  } }), error => error.code === "TRANSLATION_ROLE_CHANGED");
  assert.equal(rejectedAttempts, 2);
});
test("a semantic retry must preserve actors, dates and identifiers before legal analysis", async () => {
  let attempts = 0;
  const query = "2024-07-10 অভিযুক্ত একজন ব্যক্তিকে প্রতারণা করে অসৎভাবে সম্পত্তি দিতে প্ররোচিত করেছে।";
  const result = await analyzeMultilingualQuery(query, { originalLanguage: "bn", worker: async payload => {
    if (payload.source === "bn") {
      attempts++;
      if (attempts === 2) assert.equal(payload.quality, "review");
      return { texts: payload.texts.map(() => attempts === 1 ? "The accused defrauded the accused and unjustly obtained property." : "The accused deceived a person and dishonestly induced delivery of property.") };
    }
    return { texts: payload.texts.map(() => "বাংলা") };
  } });
  assert.equal(attempts, 2);
  assert.equal(result.multilingual.translationRetry, true);
  assert.equal(result.gate.route, "BNS_PRIMARY");
  assert.equal(result.retrieved[0].id, "bns-318");
  await assert.rejects(analyzeMultilingualQuery(query, { originalLanguage: "bn", worker: async payload => ({ texts: payload.texts.map(() => "The accused deceived the accused and unjustly obtained property.") }) }), error => error.code === "TRANSLATION_ROLE_CHANGED");
});
