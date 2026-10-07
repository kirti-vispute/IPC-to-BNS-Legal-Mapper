import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { analyzeMultilingualQuery } from "../backend/core/multilingual.js";
import { transcribeAudio } from "../backend/core/transcriber.js";
import { analyzeQuery } from "../backend/core/pipeline.js";
import { renderLegalPresentation } from "../frontend/legalPresentation.js";

const observations = [];
async function check(name, speech, expectedRoute, evidenceType) {
  try {
    const result = await analyzeMultilingualQuery(speech.text, { ...speech });
    const canonical = analyzeQuery(result.input.processedInput);
    for (const field of ["facts", "gate", "retrieved", "irac", "verifier"]) assert.deepEqual(result[field], canonical[field]);
    assert.equal(result.input.originalInput, speech.text);
    assert.equal(result.input.inputLanguage, speech.inputLanguage);
    assert.equal(result.input.outputLanguage, speech.inputLanguage);
    if (expectedRoute) assert.equal(result.gate.route, expectedRoute);
    if (result.multilingual) {
      result.multilingual.presentation.provisions.forEach((doc, index) => {
        assert.deepEqual(doc.source, result.retrieved[index].source);
        assert.equal(doc.sourceText, result.retrieved[index].excerpt);
      });
      renderLegalPresentation(result.multilingual.presentation);
    }
    const theftCandidateCoverage = result.candidateOnly ? ["ipc-378", "bns-303"].every(id => result.retrieved.some(doc => doc.id === id)) : null;
    observations.push({ name, evidenceType, passed: true, theftCandidateCoverage, speech, result });
    console.log(JSON.stringify({ name, evidenceType, passed: true, theftCandidateCoverage, language: result.input.inputLanguage, route: result.gate.route, dates: result.facts.dates, top3: result.retrieved.map(d => d.id) }));
  } catch (error) {
    observations.push({ name, evidenceType, passed: false, speech, error: error.code || error.message });
    console.log(JSON.stringify(observations.at(-1)));
    process.exitCode = 1;
  }
}

const args = process.argv.slice(2);
if (args[0] === "--summarize") {
  const recorded = JSON.parse(await readFile("output/voice-verification/native-handoff-results.json", "utf8"));
  const checks = recorded.observations.map(observation => {
    const result = observation.result;
    const ids = result?.retrieved.map(doc => doc.id) || [];
    // Expectations apply only to this script's known theft fixtures, not general legal labels.
    const expectedGroups = !result || observation.name === "mr/MULTI_PERIOD_REVIEW" ? []
      : result.candidateOnly ? [["ipc-378", "ipc-379"], ["bns-303"]]
      : result.gate.route === "IPC_ONLY" ? [["ipc-378", "ipc-379"]] : [["bns-303"]];
    return { name: observation.name, nativeTranscript: observation.speech.text,
      pipelineChecksPassed: observation.passed, english: result?.input.processedInput, retrieved: ids,
      expectedTheftCandidatesFound: expectedGroups.length ? expectedGroups.every(group => group.some(id => ids.includes(id))) : null };
  });
  const report = { disclaimer: "Recorded controlled-transcript/real-translation software checks, NOT audio recognition, independent legal labels or accuracy.",
    pipelineChecksPassed: checks.filter(check => check.pipelineChecksPassed).length, total: checks.length, checks };
  await writeFile("output/voice-verification/acceptance-summary.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(checks.some(check => !check.pipelineChecksPassed || check.expectedTheftCandidatesFound === false) ? 1 : 0);
}
if (args[0] === "--audio") {
  const speech = await transcribeAudio({ audio: await readFile(args[1]), contentType: args[2] || "audio/wav" });
  await check(args[1], speech, args[3], "REAL_LOCAL_AUDIO_ASR_AND_TRANSLATION_NOT_HUMAN_ACCURACY");
} else {
  const fixtures = [
    ["hi", "20 जून 2024 को चोरी हुई। IPC 379", "IPC_ONLY"],
    ["mr", "20 जून 2024 रोजी चोरी झाली. IPC 379", "IPC_ONLY"],
    ["hi", "15 अगस्त 2024 को चोरी हुई। BNS 303", "BNS_PRIMARY"],
    ["mr", "15 ऑगस्ट 2024 रोजी चोरी झाली. BNS 303", "BNS_PRIMARY"],
    ["hi", "घटना की तारीख नहीं दी गई है लेकिन चोरी हुई है।", "CLARIFY"],
    ["mr", "या घटनेची तारीख दिलेली नाही पण चोरी झाली आहे.", "CLARIFY"],
    ["mr", "फसवणुकीचे कृत्य 20 जून 2024 रोजी सुरू झाले आणि 10 जुलै 2024 पर्यंत सुरू राहिले.", "MULTI_PERIOD_REVIEW"],
    ["hi", "15 August 2024 ko accused ne mobile phone चोरी किया.", "BNS_PRIMARY"]
  ];
  for (const [language, text, route] of fixtures) await check(`${language}/${route}`, {
    text, originalInput: text, inputLanguage: language, inputMode: "voice", languageProbability: 0.99
  }, route, "CONTROLLED_NATIVE_TRANSCRIPT_AND_SPEECH_METADATA_REAL_LOCAL_TRANSLATION_NOT_AUDIO_ASR");
}
await mkdir("output/voice-verification", { recursive: true });
await writeFile(`output/voice-verification/${args[0] === "--audio" ? "audio" : "native-handoff"}-results.json`, JSON.stringify({
  disclaimer: "Software/inference checks, not legal or human-speaker accuracy. Controlled transcript fixtures do not test speech recognition.", observations
}, null, 2));
