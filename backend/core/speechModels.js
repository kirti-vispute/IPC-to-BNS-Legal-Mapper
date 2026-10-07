// Single source of truth for which local speech model serves which spoken language.
//
// Languages marked `genericFallback: false` are served ONLY by their language-tuned model. If it is not installed
// the request fails with a setup message; it is never quietly routed to a generic multilingual Whisper model.
// Measured on 12 held-out FLEURS test clips per language (scripts/evaluate_speech_models.py), generic Whisper
// medium reached 139% WER on Gujarati and 37.9% on Hindi, against 44.8% and 9.7% for the tuned models.
//
// To add or replace a model: change `directory` / `source` here, run its setup command, nothing else.

export const SPEECH_MODEL_REGISTRY = {
  hi: {
    language: "Hindi", script: "Devanagari", engine: "faster-whisper", genericFallback: false,
    directory: "hindi-medium-ct2", configKey: "hindiModelPath", statusKey: "hindiModelReady", envVar: "LOCAL_SPEECH_HINDI_MODEL",
    label: "Hindi-tuned Whisper medium (local CPU int8)",
    source: { repo: "vasista22/whisper-hindi-medium", license: "Apache-2.0", base: "openai/whisper-medium" },
    setup: "python scripts/setup_indic_speech.py --only hindi", timeoutMs: 180_000
  },
  ur: {
    language: "Urdu", script: "Arabic (Nastaliq)", engine: "faster-whisper", genericFallback: false,
    directory: "urdu-large-v3-ct2", configKey: "urduModelPath", statusKey: "urduModelReady", envVar: "LOCAL_SPEECH_URDU_MODEL",
    label: "Urdu-tuned Whisper large-v3-turbo (local CPU int8)",
    source: { repo: "kingabzpro/whisper-large-v3-urdu-ct2", license: "Apache-2.0", base: "openai/whisper-large-v3-turbo" },
    setup: "python scripts/setup_indic_speech.py --only urdu", timeoutMs: 180_000
  },
  gu: {
    language: "Gujarati", script: "Gujarati", engine: "faster-whisper", genericFallback: false,
    directory: "gujarati-medium-ct2", configKey: "gujaratiModelPath", statusKey: "gujaratiModelReady", envVar: "LOCAL_SPEECH_GUJARATI_MODEL",
    label: "Gujarati-tuned Whisper medium (local CPU int8)",
    source: { repo: "vasista22/whisper-gujarati-medium", license: "Apache-2.0", base: "openai/whisper-medium" },
    setup: "python scripts/setup_indic_speech.py --only gujarati", timeoutMs: 180_000
  },
  mr: {
    language: "Marathi", script: "Devanagari", engine: "faster-whisper", genericFallback: true,
    directory: "marathi-small-ct2", label: "Marathi-tuned Whisper small (local CPU int8)",
    source: { repo: "durgesh10/whisper-small-marathi", license: "Apache-2.0", base: "openai/whisper-small" },
    setup: "python scripts/setup_marathi_speech.py", timeoutMs: 120_000
  },
  en: {
    language: "English", script: "Latin", engine: "whistle", genericFallback: true,
    directory: "whistle", label: "Cactus Whistle (local CPU)",
    source: { repo: "Cactus-Compute/whistle", license: "Apache-2.0", base: null },
    setup: "python scripts/setup_indic_speech.py --only whistle", timeoutMs: 120_000
  }
};

// Languages that must use their tuned model and may never fall back to generic Whisper.
export const TUNED_ONLY_LANGUAGES = Object.entries(SPEECH_MODEL_REGISTRY)
  .filter(([, entry]) => entry.genericFallback === false).map(([code]) => code);

export function missingModelMessage(language) {
  const entry = SPEECH_MODEL_REGISTRY[language];
  if (!entry) return "Local speech model is missing. Run the local speech setup.";
  return `The local ${entry.language} speech model is missing (${entry.directory}). Run: ${entry.setup}. `
    + `A generic Whisper model is deliberately not used for ${entry.language} because it is much less accurate.`;
}

// What the interface and documentation may truthfully show about the speech layer.
export function describeRegistry(status = {}) {
  return Object.entries(SPEECH_MODEL_REGISTRY).map(([code, entry]) => ({
    code, language: entry.language, script: entry.script, engine: entry.engine, model: entry.label,
    sourceRepo: entry.source.repo, license: entry.source.license, genericFallback: entry.genericFallback,
    installed: entry.statusKey ? Boolean(status[entry.statusKey])
      : code === "mr" ? Boolean(status.marathiModelReady) : code === "en" ? Boolean(status.whistleReady) : null,
    setup: entry.setup
  }));
}
