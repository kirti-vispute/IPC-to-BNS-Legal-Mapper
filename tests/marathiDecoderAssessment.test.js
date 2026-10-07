import assert from "node:assert/strict";
import test from "node:test";
import { assessPairs, newlyLostCues } from "../scripts/score_marathi_decoder.mjs";
import { speechErrors } from "../scripts/validate_public_speech.mjs";

function pair(filename, reference, baseline, candidate, candidateMs = 80) {
  return { filename, baseline: { text: baseline, decodeMs: 100, metrics: speechErrors(reference, baseline) },
    candidate: { text: candidate, decodeMs: candidateMs, metrics: speechErrors(reference, candidate) },
    newlyLostCues: newlyLostCues(reference, baseline, candidate) };
}

test("decoder assessment accepts only nonregressing faster paired outputs", () => {
  assert.equal(assessPairs([pair("a", "hello", "hello", "hello")]).acceptedForNextStage, true);
  assert.equal(assessPairs([pair("a", "hello", "hello", "hello", 99)]).acceptedForNextStage, false);
});

test("one degraded clip rejects a decoder even if aggregate word errors improve", () => {
  const rows = [pair("a", "one two three four", "other other other other", "one two three four"),
    pair("b", "चोरी", "चोरी", "चर")];
  const result = assessPairs(rows);
  assert.ok(result.candidate.microWER < result.baseline.microWER);
  assert.equal(result.acceptedForNextStage, false);
  assert.deepEqual(result.regressions, ["b"]);
});

test("newly lost literal digits or an exact native negation cue remain visible", () => {
  assert.deepEqual(newlyLostCues("नाही २० 2024", "नाही २० 2024", "२० 2024"), ["नाही"]);
  assert.deepEqual(newlyLostCues("नाही २० 2024", "नाही २० 2024", "नाही २०"), ["2024"]);
  assert.deepEqual(newlyLostCues("नाही", "already lost", "already lost"), []);
});

test("empty transcripts and nonpositive or invalid timings cannot pass assessment", () => {
  assert.equal(assessPairs([pair("a", "hello", "hello", "")]).acceptedForNextStage, false);
  for (const value of [0, -1, NaN]) {
    assert.equal(assessPairs([pair("a", "hello", "hello", "hello", value)]).acceptedForNextStage, false);
  }
});

test("a late baseline or candidate invalidates timing even when the median looks faster", () => {
  const late = pair("late", "hello", "hello", "hello", 1_702_734);
  const fast = pair("fast", "hello", "hello", "hello", 80);
  assert.equal(assessPairs([late, fast, fast]).noErrors, false);
  assert.equal(assessPairs([late, fast, fast]).acceptedForNextStage, false);
  late.candidate.decodeMs = 80;
  late.baseline.decodeMs = 1_702_734;
  const result = assessPairs([late, fast, fast]);
  assert.equal(result.noErrors, false);
  assert.equal(result.acceptedForNextStage, false);
});
