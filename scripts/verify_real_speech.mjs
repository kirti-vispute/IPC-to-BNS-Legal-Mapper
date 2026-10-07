import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { transcribeAudio } from "../backend/core/transcriber.js";
import { analyzeMultilingualQuery } from "../backend/core/multilingual.js";

const DIR = "output/voice-verification/real-speech";
const selected = process.argv.includes("--selected");
const outputFile = selected ? "selected-observations.json" : "observations.json";
const { fixtures } = JSON.parse(await readFile(join(DIR, "fixtures.json"), "utf8"));
const observations = [];

async function analyze(text, metadata) {
  try {
    const result = await analyzeMultilingualQuery(text, metadata);
    return {
      succeeded: true,
      inputLanguage: result.input?.inputLanguage ?? result.multilingual?.inputLanguage ?? "en",
      processingLanguage: result.input?.processingLanguage ?? result.multilingual?.processingLanguage ?? "en",
      englishProcessingInput: result.input?.processedInput ?? result.multilingual?.englishQuery ?? text,
      outputLanguage: result.input?.outputLanguage ?? result.multilingual?.outputLanguage ?? "en",
      finalPresentationLanguage: result.multilingual?.presentation?.outputLanguage ?? result.input?.outputLanguage ?? "en",
      date: result.facts?.dates ?? [],
      route: result.gate?.route ?? null,
      retrieved: result.retrieved?.map(item => item.id) ?? [],
      citations: result.retrieved?.map(item => item.source) ?? [],
      iracProduced: Boolean(result.irac)
    };
  } catch (error) {
    return { succeeded: false, code: error.code ?? error.name, message: error.message };
  }
}

for (const fixture of fixtures) {
  const observation = {
    filename: fixture.filename, sourceLanguage: fixture.language,
    audioFormat: fixture.mimeType, expectedTranscript: fixture.transcript,
    licensedSource: fixture.source, license: fixture.license,
    speech: null, voice: null, typed: null
  };
  try {
    const speech = await transcribeAudio({
      audio: await readFile(join(DIR, fixture.filename)), contentType: fixture.mimeType,
      language: selected ? fixture.language : "auto"
    });
    observation.speech = {
      detectedLanguage: speech.detectedLanguage ?? speech.inputLanguage,
      inputLanguage: speech.inputLanguage, languageProbability: speech.languageProbability,
      languageStatus: speech.languageStatus, nativeTranscript: speech.text,
      languageSource: speech.languageSource,
      matchesSourceLanguage: (speech.detectedLanguage ?? speech.inputLanguage) === fixture.language
    };
    observation.voice = await analyze(speech.text, speech);
  } catch (error) {
    observation.speech = { error: error.code ?? error.message };
  }
  if (!selected) observation.typed = await analyze(fixture.transcript);
  observations.push(observation);
  await writeFile(join(DIR, outputFile), JSON.stringify({
    disclaimer: "Real human audio software observations, not legal accuracy or a controlled spoken legal-query benchmark.",
    observations
  }, null, 2));
  console.log(JSON.stringify({ filename: fixture.filename, speech: observation.speech,
    voice: observation.voice && { succeeded: observation.voice.succeeded, code: observation.voice.code,
      outputLanguage: observation.voice.outputLanguage, finalPresentationLanguage: observation.voice.finalPresentationLanguage,
      route: observation.voice.route },
    typed: observation.typed && { succeeded: observation.typed.succeeded, code: observation.typed.code,
      outputLanguage: observation.typed.outputLanguage, route: observation.typed.route } }));
}
