import assert from "node:assert/strict";
import test from "node:test";
import { runDirectory, historyFiles, normalizeSpeech, speechErrors, eligibleRow, verifyDataset, summarize } from "../scripts/validate_public_speech.mjs";

test("speech diagnostics preserve Indic vowel signs and negation words", () => {
  for (const word of ["चोरी", "परवानगी", "नाही", "चोट", "हिंदी", "कन्नड"] ) {
    assert.equal(normalizeSpeech(word), word);
  }
  assert.equal(normalizeSpeech("चोरी।  नाही!"), "चोरी नाही");
  assert.equal(speechErrors("चोरी", "चर").wer, 1);
  assert.notEqual(speechErrors("चोरी", "चर").cer, 0);
});

test("speech edit rates allow insertions above100percent and handle empty hypotheses", () => {
  assert.equal(speechErrors("a", "x y z").wer, 3);
  assert.equal(speechErrors("a b", "").wer, 1);
  assert.equal(speechErrors("IPC 379", "ipc, 379!").wer, 0);
  assert.throws(() => speechErrors("", "words"));
});

test("speech CER counts Unicode code points rather than UTF16 surrogate halves", () => {
  const result = speechErrors("𑀓", "𑀔");
  assert.equal(result.referenceChars, 1);
  assert.equal(result.charEdits, 1);
});

test("fresh speech selection rejects known calls or utterances and unsuitable metadata", () => {
  const item = { row_idx: 20, row: { language: "mr", call_id: "new", utterance_id: "new-1",
    duration_sec: 20, transcription: "क".repeat(55), audio: [{ type: "audio/wav", src: "https://example.org/audio" }] } };
  assert.equal(eligibleRow(item, new Set(), new Set()), true);
  assert.equal(eligibleRow(item, new Set(["new"]), new Set()), false);
  assert.equal(eligibleRow(item, new Set(), new Set(["new-1"])), false);
  for (const delta of [{ duration_sec: 30 }, { language: "hi" }, { transcription: "short" }, { audio: [] }]) {
    assert.equal(Boolean(eligibleRow({ ...item, row: { ...item.row, ...delta } }, new Set(), new Set())), false);
  }
});

test("public speech download requires exact dataset identity revision and license", () => {
  const info = { id: "ConvoZenAI/indictelephony-bench", sha: "d1a7902dd956cd3eb10304d7142df602273d8bd6", cardData: { license: "cc-by-4.0" } };
  assert.doesNotThrow(() => verifyDataset(info));
  for (const delta of [{ id: "another" }, { sha: "changed" }, { cardData: { license: "unknown" } }]) {
    assert.throws(() => verifyDataset({ ...info, ...delta }));
  }
});

test("new public speech collection uses its own exact revision without weakening the old pin", () => {
  const revision = "aa72c79dbb97644e50ae26cfa267d8fa81a37ce7";
  const info = { id: "ConvoZenAI/indictelephony-bench", sha: revision, cardData: { license: "cc-by-4.0" } };
  assert.doesNotThrow(() => verifyDataset(info, revision));
  assert.throws(() => verifyDataset(info));
  assert.throws(() => verifyDataset({ ...info, sha: "a-later-revision" }, revision));
  assert.throws(() => verifyDataset({ ...info, cardData: { license: "unknown" } }, revision));
});

test("diagnostic summaries expose failed requests separately from edit rates", () => {
  const report = summarize([{ metrics: speechErrors("a b", "a") }, { error: "timeout" }]);
  assert.equal(report.total, 2);
  assert.equal(report.completed, 1);
  assert.equal(report.failed, 1);
  assert.equal(report.microWER, 0.5);
  assert.equal(report.allRequestsCompleted, false);
  assert.equal(summarize([{ error: "timeout" }]).microWER, null);
  assert.equal(summarize([]).allRequestsCompleted, false);
});

test("fresh diagnostic names cannot traverse into protected evidence paths", () => {
  assert.match(runDirectory("fresh-20261003"), /public-speech-validation/);
  for (const name of ["../evaluation", "..", "a/b", "a\\b", "C:\\", "", undefined]) {
    assert.throws(() => runDirectory(name));
  }
});

test("later speech collections can exclude earlier diagnostic calls without replacing old history", () => {
  const original = historyFiles();
  const later = historyFiles(["fresh-marathi-20261003", "fresh-marathi-20261003"]);
  assert.deepEqual(later.slice(0, original.length), original);
  assert.equal(later.length, original.length + 1);
  assert.equal(later.at(-1), "output/public-speech-validation/fresh-marathi-20261003/fixtures.json");
  assert.throws(() => historyFiles(["../evaluation"]));
});
