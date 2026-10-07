import { renderLegalPresentation } from "./legalPresentation.js";

const samples = {
  pre: "The alleged act happened on 2024-06-20 and concerns theft of movable property under IPC 379.",
  post: "The offense took place on 2024-07-12 and concerns organized crime with continuing unlawful activity by a syndicate.",
  span: "The conduct started on 2024-06-15 and continued until 2024-07-08, involving threats against the state.",
  missing: "The complaint concerns cheating and dishonest delivery of property, but the offense date is not yet available."
};

const routeLabels = {
  IPC_ONLY: "IPC applies",
  BNS_PRIMARY: "BNS applies",
  MULTI_PERIOD_REVIEW: "Multi-period review",
  CLARIFY: "Date clarification required"
};

let lastAnalyzedQuery = "";
let mediaRecorder = null;
let mediaStream = null;
let audioChunks = [];
let recordingStartedAt = 0;
let recordingCancelled = false;
let speechConfigured = false;
let analysisBusy = false;
let voiceBusy = false;
let microphoneRequest = 0;
let voiceInput = null;
let recordingLanguage = "auto";

const MAX_QUERY_CHARS = 4000;
const MAX_RECORDING_MS = 90_000;
const MIN_RECORDING_MS = 500;

const elements = {
  status: document.querySelector("#service-status"),
  query: document.querySelector("#query"),
  analyze: document.querySelector("#analyze-btn"),
  voice: document.querySelector("#voice-btn"),
  inputLanguage: document.querySelector("#input-language"),
  speechLanguage: document.querySelector("#speech-language"),
  cancelRecording: document.querySelector("#cancel-recording-btn"),
  voiceState: document.querySelector("#voice-state"),
  inputState: document.querySelector("#input-state"),
  languageState: document.querySelector("#language-state"),
  demoButtons: document.querySelectorAll(".demo-case"),
  route: document.querySelector("#route-pill"),
  offenseDate: document.querySelector("#offense-date"),
  allowedCorpus: document.querySelector("#allowed-corpus"),
  verifierStatus: document.querySelector("#verifier-status"),
  gateMessage: document.querySelector("#gate-message"),
  elapsed: document.querySelector("#elapsed"),
  retrievalList: document.querySelector("#retrieval-list"),
  iracOutput: document.querySelector("#irac-output"),
  iracCitations: document.querySelector("#irac-citations"),
  citationCount: document.querySelector("#citation-count"),
  warningList: document.querySelector("#warning-list"),
  warningCount: document.querySelector("#warning-count"),
  queryCount: document.querySelector("#query-count"),
  robot: document.querySelector("#robot-stage"),
  results: document.querySelector(".results"),
  workflow: document.querySelector(".workflow")
};
const resultLabelDefaults = Array.from(document.querySelectorAll("[data-result-label]"), node => ({ node, text: node.textContent }));
const interfaceTextDefaults = Array.from(document.querySelectorAll("[data-interface-text]"), node => ({ node, text: node.textContent }));
const interfacePlaceholderDefaults = Array.from(document.querySelectorAll("[data-interface-placeholder]"), node => ({ node, text: node.placeholder }));
let activeInterfaceText = null;

function resetInterfaceText() {
  interfaceTextDefaults.forEach(({ node, text }) => { node.textContent = text; });
  interfacePlaceholderDefaults.forEach(({ node, text }) => { node.placeholder = text; });
  if (activeInterfaceText) {
    elements.status.textContent = elements.status.dataset.state === "online" ? "Service online" : elements.status.dataset.state === "offline" ? "Service offline" : "Service unavailable";
    if (elements.voice.textContent === activeInterfaceText.startRecording) elements.voice.textContent = "Start recording";
    if (elements.voiceState.textContent === activeInterfaceText.voiceReady) elements.voiceState.textContent = "Local speech recognition ready";
    if (elements.voiceState.textContent === activeInterfaceText.voiceSetup) elements.voiceState.textContent = "Local speech setup required";
  }
  if (document.documentElement) document.documentElement.lang = "en";
  activeInterfaceText = null;
}

function applyInterfaceText(view) {
  if (view.outputTranslation !== "local-model" && view.interfaceLocalization !== "controlled-draft") return resetInterfaceText();
  activeInterfaceText = view.interfaceText;
  interfaceTextDefaults.forEach(({ node }) => { node.textContent = view.interfaceText[node.dataset.interfaceText] || node.textContent; });
  interfacePlaceholderDefaults.forEach(({ node }) => { node.placeholder = view.interfaceText[node.dataset.interfacePlaceholder] || node.placeholder; });
  elements.status.textContent = elements.status.dataset.state === "online" ? view.interfaceText.serviceOnline : elements.status.dataset.state === "offline" ? view.interfaceText.serviceOffline : view.interfaceText.serviceUnavailable;
  if (elements.voice.textContent === "Start recording") elements.voice.textContent = view.interfaceText.startRecording;
  if (elements.voiceState.textContent === "Local speech recognition ready") elements.voiceState.textContent = view.interfaceText.voiceReady;
  if (elements.voiceState.textContent === "Local speech setup required") elements.voiceState.textContent = view.interfaceText.voiceSetup;
  if (document.documentElement) document.documentElement.lang = view.outputLanguage;
}

function resetPresentationLabels() {
  resultLabelDefaults.forEach(({ node, text }) => { node.textContent = text; });
  [elements.gateMessage, elements.iracOutput, elements.retrievalList, elements.warningList].forEach(node => {
    node.removeAttribute("lang");
    node.removeAttribute("dir");
  });
}

// "idle" hides the empty result panels; "ready" shows a finished (or failed) analysis.
function setStage(stage) {
  if (elements.results) elements.results.dataset.state = stage;
  if (elements.workflow) elements.workflow.dataset.stage = stage;
}

function updateQueryCount() {
  if (!elements.queryCount) return;
  const length = elements.query.value.length;
  elements.queryCount.textContent = `${length} / ${MAX_QUERY_CHARS}`;
  elements.queryCount.dataset.state = length > MAX_QUERY_CHARS ? "over" : length > MAX_QUERY_CHARS * 0.9 ? "near" : "ok";
}

// While speech is being converted to text a small robot carries the audio in, listens and types it up.
// The transcript is held back until the loop in progress has finished, so the animation never cuts off mid-gesture.
function showRobot(visible) {
  if (elements.robot) elements.robot.hidden = !visible;
  elements.query.readOnly = visible;
  elements.query.dataset.busy = String(visible);
}

async function finishRobotLoop() {
  const running = elements.robot?.getAnimations?.({ subtree: true }) || [];
  let loop = null;
  for (const animation of running) {
    const timing = animation.effect?.getComputedTiming?.();
    if (timing && Number.isFinite(timing.duration) && timing.iterations === Infinity && (!loop || timing.duration > loop.duration)) {
      loop = { animation, duration: timing.duration };
    }
  }
  if (!loop) return;
  const elapsed = Number(loop.animation.currentTime) % loop.duration;
  await new Promise((resolve) => setTimeout(resolve, Math.max(0, loop.duration - elapsed)));
}

// The NLP panel (nlpPanel.js) listens for this event; nothing else depends on it.
function emitNlp(detail) {
  if (!detail?.nlp || typeof CustomEvent !== "function" || typeof document.dispatchEvent !== "function") return;
  document.dispatchEvent(new CustomEvent("nlp-analysis", { detail }));
}

function revealResults() {
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  elements.results?.scrollIntoView?.({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
}

// Changing the written language translates the text already in the box; an empty box is left alone.
// The first text is kept as the base, so choosing another language translates the original (no compounding
// errors) and choosing the original language again restores it exactly. Editing the text discards the base.
let writtenSelection = elements.inputLanguage?.value || "auto";
let translationBase = null;
let translationBusy = false;

function setTranslating(isBusy, message) {
  translationBusy = isBusy;
  analysisBusy = isBusy;
  elements.query.readOnly = isBusy;
  elements.analyze.disabled = isBusy || voiceBusy;
  elements.speechLanguage.disabled = isBusy || voiceBusy;
  if (elements.inputLanguage) elements.inputLanguage.disabled = isBusy || voiceBusy;
  refreshVoiceAvailability(true);
  elements.inputState.textContent = message;
}

function showTranslationNote(message, kind) {
  if (!elements.languageState) return;
  elements.languageState.textContent = message;
  elements.languageState.dataset.kind = "translation";
  if (kind) elements.languageState.dataset.state = kind;
  else elements.languageState.removeAttribute("data-state");
}

async function onWrittenLanguageChange() {
  const previous = writtenSelection;
  const target = elements.inputLanguage.value || "auto";
  writtenSelection = target;
  const current = elements.query.value;
  if (translationBusy || !current.trim() || target === "auto") return;
  const base = translationBase && translationBase.shown === current ? translationBase : { text: current, language: "auto", shown: current };
  const name = elements.inputLanguage.selectedOptions?.[0]?.textContent || target;
  setTranslating(true, `Translating to ${name}...`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  let message = activeInterfaceText?.ready || "Ready for analysis";
  try {
    const response = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: base.text, source: base.language, target }),
      signal: controller.signal
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Translation failed.");
    if (lastAnalyzedQuery) markResultsStale();
    voiceInput = null;
    clearSpeechReviewNotice();
    if (data.changed) {
      elements.query.value = data.text;
      translationBase = { text: base.text, language: data.sourceLanguage, shown: data.text };
      showTranslationNote(`Machine translation to ${name}. Check dates, names and section numbers before analyzing.`, "warning");
      message = "Translated - review, then analyze";
    } else {
      elements.query.value = base.text;
      translationBase = { text: base.text, language: data.sourceLanguage, shown: base.text };
      showTranslationNote(`The text is already in ${name}.`);
    }
    updateQueryCount();
  } catch (error) {
    elements.inputLanguage.value = previous;
    writtenSelection = previous;
    showTranslationNote(error.name === "AbortError" ? "Translation timed out. Your text is unchanged." : `${error.message} Your text is unchanged.`, "error");
  } finally {
    clearTimeout(timer);
    setTranslating(false, message);
    elements.inputLanguage.focus?.();
  }
}

elements.inputLanguage?.addEventListener("change", onWrittenLanguageChange);
elements.analyze.addEventListener("click", analyze);
elements.voice.addEventListener("click", toggleRecording);
elements.cancelRecording.addEventListener("click", cancelRecording);
elements.query.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") analyze();
});
elements.query.addEventListener("input", () => {
  updateQueryCount();
  if (translationBase && elements.query.value !== translationBase.shown) translationBase = null;
  if (elements.languageState?.dataset.kind === "translation") {
    elements.languageState.textContent = "";
    elements.languageState.removeAttribute("data-kind");
    elements.languageState.removeAttribute("data-state");
  }
  if (!elements.query.value.trim()) {
    voiceInput = null;
    clearSpeechReviewNotice();
  }
  if (lastAnalyzedQuery && elements.query.value.trim() !== lastAnalyzedQuery) markResultsStale();
});
elements.demoButtons.forEach((button) => {
  button.addEventListener("click", () => {
    voiceInput = null;
    clearSpeechReviewNotice();
    elements.query.value = samples[button.dataset.sample];
    updateQueryCount();
    elements.inputLanguage.value = "auto";
    markResultsStale("Demo case loaded · analyze to refresh results");
    elements.query.focus();
  });
});

checkHealth();

async function checkHealth() {
  try {
    const response = await fetch("/api/health");
    const data = await response.json();
    elements.status.textContent = data.ok ? "Service online" : "Service unavailable";
    elements.status.dataset.state = data.ok ? "online" : "offline";
    speechConfigured = Boolean(data.speechConfigured);
    refreshVoiceAvailability();
  } catch {
    elements.status.textContent = "Service offline";
    elements.status.dataset.state = "offline";
    speechConfigured = false;
    refreshVoiceAvailability();
  }
}

function refreshVoiceAvailability(preserveMessage = false) {
  const browserSupported = Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
  elements.voice.disabled = analysisBusy || voiceBusy || !browserSupported;

  if (!browserSupported) {
    elements.voiceState.textContent = "Voice input is not supported in this browser";
  } else if (!voiceBusy && !preserveMessage) {
    elements.voiceState.textContent = speechConfigured ? "Local speech recognition ready" : "Local speech setup required";
  }
}

async function toggleRecording() {
  if (mediaRecorder?.state === "recording") {
    mediaRecorder.stop();
    return;
  }

  setVoiceBusy(true, "Requesting microphone...");
  // Spoken and written language are independent: the recording uses only the spoken-language choice.
  recordingLanguage = elements.speechLanguage.value || "auto";
  elements.cancelRecording.hidden = false;
  const requestId = ++microphoneRequest;
  let permissionTimer;
  try {
    // A browser can leave permission unanswered; late streams must be released after cancellation.
    const permission = navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      if (requestId !== microphoneRequest) {
        stream.getTracks().forEach((track) => track.stop());
        return null;
      }
      return stream;
    });
    const grantedStream = await Promise.race([
      permission,
      new Promise((resolve, reject) => {
        permissionTimer = setTimeout(() => reject(new Error("MICROPHONE_PERMISSION_TIMEOUT")), 20_000);
      })
    ]);
    if (requestId !== microphoneRequest || !grantedStream) return;
    mediaStream = grantedStream;
    const mimeType = chooseRecordingMimeType();
    mediaRecorder = mimeType ? new MediaRecorder(mediaStream, { mimeType }) : new MediaRecorder(mediaStream);
    audioChunks = [];
    recordingCancelled = false;
    recordingStartedAt = Date.now();

    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size) audioChunks.push(event.data);
    });
    mediaRecorder.addEventListener("stop", handleRecordingStopped, { once: true });
    mediaRecorder.start();
    setVoiceBusy(true, "Recording...");
    elements.voice.disabled = false;
    elements.voice.textContent = "Stop recording";
    elements.voice.dataset.recording = "true";
    elements.cancelRecording.hidden = false;

    setTimeout(() => {
      if (mediaRecorder?.state === "recording") mediaRecorder.stop();
    }, MAX_RECORDING_MS);
  } catch (error) {
    if (requestId !== microphoneRequest) return;
    microphoneRequest++;
    stopMediaStream();
    const denied = error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError";
    showVoiceError(error?.message === "MICROPHONE_PERMISSION_TIMEOUT"
      ? "Microphone access is still pending. Allow microphone access for localhost in your browser, then try again."
      : denied
      ? "Microphone permission was denied. You can continue by typing."
      : "The microphone could not be started. You can continue by typing.");
  } finally {
    clearTimeout(permissionTimer);
  }
}

function cancelRecording() {
  if (mediaRecorder?.state !== "recording") {
    if (!voiceBusy || mediaRecorder) return;
    microphoneRequest++;
    resetRecordingControls();
    setVoiceBusy(false, "Microphone request cancelled");
    return;
  }
  recordingCancelled = true;
  mediaRecorder.stop();
}

async function handleRecordingStopped() {
  const durationMs = Date.now() - recordingStartedAt;
  const mimeType = mediaRecorder?.mimeType || audioChunks[0]?.type || "audio/webm";
  stopMediaStream();
  resetRecordingControls();

  if (recordingCancelled) {
    setVoiceBusy(false, "Recording cancelled");
    return;
  }

  const audio = new Blob(audioChunks, { type: mimeType });
  audioChunks = [];
  if (durationMs < MIN_RECORDING_MS || !audio.size) {
    showVoiceError("No usable speech was recorded. Please try again.");
    return;
  }

  setVoiceBusy(true, "Transcribing locally...");
  showRobot(true);
  const controller = new AbortController();
  const transcriptionTimer = setTimeout(() => controller.abort(), ["hi", "ur", "gu"].includes(recordingLanguage) ? 190_000 : 130_000);
  let reviewNotice = null;
  let failed = false;
  try {
    const response = await fetch(`/api/transcribe?mode=transcribe&language=${encodeURIComponent(recordingLanguage)}`, {
      method: "POST",
      headers: { "Content-Type": audio.type || "audio/webm" },
      body: audio,
      signal: controller.signal
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Speech transcription failed.");

    await finishRobotLoop();
    showRobot(false);
    elements.query.value = data.text;
    updateQueryCount();
    emitNlp({ nlp: data.nlp, source: "speech", model: data.model, transcription: {
      rawText: data.rawText, corrections: data.corrections || [], confidence: data.confidence ?? null, confidenceLevel: data.confidenceLevel || null,
      uncertainWords: data.uncertainWords || [], uncertainSegments: data.uncertainSegments || [] } });
    voiceInput = { inputMode: "voice", inputLanguage: data.inputLanguage || data.originalLanguage,
      languageProbability: data.languageProbability, languageSource: data.languageSource, originalInput: data.text };
    markResultsStale("Transcription complete · review before analysis");
    elements.voiceState.textContent = data.languageStatus === "selected"
      ? `Selected language: ${data.languageName} · review the transcript before analysis`
      : data.languageStatus === "detected"
      ? `Detected language: ${data.languageName} · review the transcript before analysis`
      : data.languageStatus === "unsupported"
      ? `Unsupported spoken language: ${data.languageName} · transcript preserved`
      : "Spoken language uncertain · transcript preserved; try a longer recording";
    reviewNotice = getSpeechReviewNotice(data);
    if (reviewNotice) elements.voiceState.textContent = reviewNotice.message;
    elements.query.focus();
  } catch (error) {
    failed = true;
    showVoiceError(error.name === "AbortError" ? "Local transcription timed out. Try a shorter recording." : error.message);
  } finally {
    clearTimeout(transcriptionTimer);
    showRobot(false);
    setVoiceBusy(false, elements.voiceState.textContent, reviewNotice);
    if (failed) elements.voiceState.dataset.state = "error";
  }
}

function chooseRecordingMimeType() {
  return ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"]
    .find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function stopMediaStream() {
  mediaStream?.getTracks().forEach((track) => track.stop());
  mediaStream = null;
}

function resetRecordingControls() {
  elements.voice.textContent = "Start recording";
  elements.voice.removeAttribute("data-recording");
  elements.cancelRecording.hidden = true;
  mediaRecorder = null;
}

function getSpeechReviewNotice(data) {
  if (recordingLanguage !== "mr" || !Object.hasOwn(data, "speechReview")) return null;
  const review = data.speechReview;
  const assessed = review?.version === 1 && review.status === "assessed" && review.textModified === false
    && typeof review.requiresReview === "boolean" && Number.isSafeInteger(review.windowCount)
    && review.windowCount > 0 && review.windowCount <= 128;
  if (assessed && !review.requiresReview) return null;
  const incomplete = assessed && review.requiresReview;
  return { status: incomplete ? "incomplete" : "unavailable", language: "mr",
    message: incomplete
      ? "मराठी लिप्यंतरण अपूर्ण असू शकते. विश्लेषणापूर्वी मजकूर, तारखा आणि कलमे तपासा; गरज असल्यास पुन्हा रेकॉर्ड करा."
      : "मराठी लिप्यंतरणाची पूर्णता तपासता आली नाही. विश्लेषणापूर्वी मजकूर, तारखा आणि कलमे तपासा." };
}

function clearSpeechReviewNotice() {
  if (elements.voiceState.dataset.reviewStatus) {
    setVoiceBusy(false, speechConfigured ? "Local speech recognition ready" : "Local speech setup required");
  }
}

function setVoiceBusy(isBusy, message, reviewNotice = null) {
  voiceBusy = isBusy;
  elements.voiceState.removeAttribute("data-state");
  elements.voiceState.removeAttribute("data-review-status");
  elements.voiceState.lang = reviewNotice?.language || "en";
  if (reviewNotice) {
    elements.voiceState.dataset.state = "warning";
    elements.voiceState.dataset.reviewStatus = reviewNotice.status;
  }
  elements.voiceState.textContent = message;
  elements.analyze.disabled = analysisBusy || isBusy;
  elements.voice.disabled = analysisBusy || (isBusy && mediaRecorder?.state !== "recording");
  elements.speechLanguage.disabled = isBusy || analysisBusy;
  if (elements.inputLanguage) elements.inputLanguage.disabled = isBusy || analysisBusy;
  if (!isBusy) refreshVoiceAvailability(true);
}

function showVoiceError(message) {
  resetRecordingControls();
  setVoiceBusy(false, message);
  elements.voiceState.textContent = message;
  elements.voiceState.dataset.state = "error";
}

async function analyze() {
  if (translationBusy) return;
  const query = elements.query.value.trim();
  if (!query) {
    renderError("Enter case facts or a legal query before analysis.");
    setStage("idle");
    elements.query.focus();
    return;
  }

  if (elements.languageState?.dataset.kind === "translation") {
    elements.languageState.removeAttribute("data-kind");
    elements.languageState.removeAttribute("data-state");
  }
  setBusy(true);
  const controller = new AbortController();
  const analysisTimer = setTimeout(() => controller.abort(), 400_000);
  try {
    const selectedInputLanguage = elements.inputLanguage?.value || "auto";
    const languagePayload = voiceInput || selectedInputLanguage === "auto" ? {} : { originalLanguage: selectedInputLanguage };
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, ...languagePayload, ...voiceInput }),
      signal: controller.signal
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Analysis failed.");
    renderResult(data);
    setStage("ready");
    emitNlp({ nlp: data.nlp, source: "analysis", facts: data.facts });
    lastAnalyzedQuery = query;
    revealResults();
  } catch (error) {
    renderError(error.name === "AbortError" ? "Local analysis timed out. Shorten the query or use English; your original text is unchanged." : error.message);
  } finally {
    clearTimeout(analysisTimer);
    setBusy(false);
  }
}

function setBusy(isBusy) {
  analysisBusy = isBusy;
  elements.analyze.disabled = isBusy || voiceBusy;
  if (elements.inputLanguage) elements.inputLanguage.disabled = isBusy || voiceBusy;
  elements.speechLanguage.disabled = isBusy || voiceBusy;
  refreshVoiceAvailability(true);
  elements.analyze.dataset.busy = String(isBusy);
  elements.analyze.textContent = isBusy ? "Analyzing..." : activeInterfaceText?.analyze || "Analyze query";
  elements.inputState.textContent = isBusy
    ? voiceInput && voiceInput.inputLanguage !== "en" ? "Translating and analyzing locally..." : "Analyzing legal query..."
    : activeInterfaceText?.ready || "Ready for analysis";
}

function renderResult(data) {
  if (data.multilingual) {
    if (data.multilingual.presentation?.schemaVersion !== 2) return renderError("The multilingual presentation version is unsupported. Restart the server and reload the page.");
    return renderStructuredResult(data);
  }
  resetPresentationLabels();
  resetInterfaceText();
  const presentation = {};
  const localized = (key, fallback) => presentation[key] || fallback;
  if (elements.languageState) elements.languageState.textContent = data.input
    ? `Input: ${data.input.languageName}${data.input.languageSource === "user-selected" ? " (selected)" : ""} | Input mode: Voice | Processing: English | Output: ${data.input.languageName}` : "Input language: English";
  elements.route.textContent = localized("routeLabel", data.candidateOnly ? "DATE REQUIRED" : routeLabels[data.gate.route] || data.gate.route);
  elements.route.dataset.route = data.gate.route;
  elements.offenseDate.textContent = data.facts.dates.length ? formatDates(data.facts) : localized("dateRequired", formatDates(data.facts));
  elements.allowedCorpus.textContent = data.candidateOnly
    ? `${data.gate.candidateCodes.join(" + ")} (${localized("corpusCandidateLabel", "candidates only")})`
    : data.gate.allowedCodes.join(" + ") || "No corpus selected";
  elements.verifierStatus.textContent = localized("verifierLabel", formatStatus(data.verifier.status));
  elements.verifierStatus.dataset.status = data.verifier.status;
  elements.gateMessage.textContent = localized("gateMessage", data.gate.message);
  elements.gateMessage.dir = "auto";
  elements.gateMessage.lang = data.multilingual?.originalLanguage || "en";
  elements.iracOutput.lang = elements.gateMessage.lang;
  elements.elapsed.textContent = `${data.elapsedMs} ms`;
  const citations = data.irac?.citations || [];
  elements.citationCount.textContent = `${citations.length} ${citations.length === 1 ? "source" : "sources"}`;

  elements.retrievalList.innerHTML = data.retrieved.length
    ? data.retrieved.map((doc, index) => `
        <li class="retrieval-item">
          <div class="provision-heading">
            <strong>${escapeHtml(doc.code)} ${escapeHtml(doc.section)}${data.candidateOnly ? ` · ${escapeHtml(localized("candidateLabel", "Candidate"))}` : ""}</strong>
            <span class="score">Relevance ${escapeHtml(doc.score)}</span>
          </div>
          <h3 dir="auto">${escapeHtml(localized(`retrieved.${index}.title`, doc.title))}</h3>
          ${data.multilingual ? `<details class="statutory-source"><summary>Original statutory source</summary><p dir="ltr" lang="en">${escapeHtml(doc.excerpt)}</p></details>` : `<p dir="auto">${escapeHtml(doc.excerpt)}</p>`}
          <small class="source-line">
            ${escapeHtml(doc.source.authority)}<br>
            ${escapeHtml(doc.source.file)} · PDF page ${escapeHtml(doc.source.page)}
          </small>
        </li>
      `).join("")
    : `<li class="empty">No matching statute was retrieved for the allowed corpus.</li>`;

  elements.iracOutput.innerHTML = data.candidateOnly
    ? `<p dir="auto">${escapeHtml(localized("candidateSummary", data.candidateSummary))}</p>`
    : ["issue", "rule", "application", "conclusion"]
    .map((key) => `
      <section class="irac-section">
        <h3>${titleCase(key)}</h3>
        <p dir="auto">${escapeHtml(localized(`irac.${key}`, data.irac[key]))}</p>
        ${data.multilingual && key === "rule" ? `<details class="statutory-source"><summary>Original statutory source</summary><p dir="ltr" lang="en">${escapeHtml(data.irac.rule.split(" Retrieved rule material:").slice(1).join(" Retrieved rule material:").trimStart())}</p></details>` : ""}
      </section>
    `).join("");

  elements.iracCitations.hidden = citations.length === 0;
  elements.iracCitations.innerHTML = citations.length
    ? `<h3>Bound citations</h3><ul>${citations.map((citation) => `<li>${escapeHtml(citation)}</li>`).join("")}</ul>`
    : "";

  const warnings = data.verifier.warnings.map((warning, index) => localized(`warnings.${index}`, warning));
  if (presentation.reviewNotice) warnings.push(presentation.reviewNotice);
  elements.warningCount.textContent = String(warnings.length);
  elements.warningList.innerHTML = warnings.length
    ? warnings.map((warning) => `<li dir="auto">${escapeHtml(warning)}</li>`).join("")
    : `<li class="empty success-message">No review warnings for this run.</li>`;
}

function renderStructuredResult(data) {
  const view = data.multilingual.presentation;
  const rendered = renderLegalPresentation(view);
  const decision = view.decision;
  applyInterfaceText(view);
  document.querySelectorAll("[data-result-label]").forEach(node => { node.textContent = view.labels[node.dataset.resultLabel]; });
  const ui = activeInterfaceText;
  elements.languageState.textContent = `${ui?.input || "Input"}: ${data.multilingual.languageName}${data.input?.languageSource === "user-selected" ? ` (${ui?.selected || "selected"})` : ""} | ${ui?.inputMode || "Input mode"}: ${data.input?.inputMode === "voice" ? ui?.voiceMode || "Voice" : ui?.textMode || "Text"} | ${ui?.processing || "Processing"}: English | ${ui?.output || "Output"}: ${data.multilingual.languageName}`;
  elements.route.textContent = decision.routeLabel;
  elements.route.dataset.route = decision.route;
  elements.offenseDate.textContent = decision.canonicalDates.length ? decision.canonicalDates.join(" / ") : view.labels.dateRequired;
  elements.allowedCorpus.textContent = decision.candidateOnly ? `${decision.candidateCodes.join(" + ")} (${view.labels.candidatesOnly}) · ${view.labels.undetermined}` : decision.allowedCodes.join(" + ");
  elements.verifierStatus.textContent = decision.verifierLabel;
  elements.verifierStatus.dataset.status = decision.verifierStatus;
  elements.gateMessage.textContent = rendered.explanationText;
  elements.gateMessage.lang = view.outputLanguage;
  elements.gateMessage.dir = "auto";
  elements.iracOutput.lang = view.outputLanguage;
  elements.retrievalList.lang = view.outputLanguage;
  elements.warningList.lang = view.outputLanguage;
  elements.elapsed.textContent = `${data.elapsedMs} ms`;
  const citations = view.irac?.citations || [];
  elements.citationCount.textContent = `${citations.length} ${citations.length === 1 ? view.labels.source : view.labels.sources}`;
  elements.retrievalList.innerHTML = rendered.retrievalHtml;
  elements.iracOutput.innerHTML = rendered.iracHtml;
  elements.iracCitations.innerHTML = rendered.citationsHtml;
  elements.iracCitations.hidden = citations.length === 0;
  elements.warningList.innerHTML = rendered.warningsHtml;
  elements.warningCount.textContent = String(view.warnings.length);
}

function renderError(message) {
  setStage("ready");
  resetPresentationLabels();
  resetInterfaceText();
  if (elements.languageState) elements.languageState.textContent = "";
  elements.route.textContent = "Analysis unavailable";
  elements.route.dataset.route = "ERROR";
  elements.offenseDate.textContent = "Not available";
  elements.allowedCorpus.textContent = "Not determined";
  elements.verifierStatus.textContent = "Not run";
  elements.gateMessage.textContent = message;
  elements.elapsed.textContent = "Not run";
  elements.retrievalList.innerHTML = `<li class="empty">No provisions retrieved.</li>`;
  elements.iracOutput.innerHTML = `<p class="empty">IRAC synthesis was not generated.</p>`;
  elements.iracCitations.hidden = true;
  elements.iracCitations.innerHTML = "";
  elements.warningList.innerHTML = `<li>${escapeHtml(message)}</li>`;
  elements.warningCount.textContent = "1";
}

function markResultsStale(inputMessage = "Query changed · analyze to refresh results") {
  resetPresentationLabels();
  resetInterfaceText();
  if (elements.languageState) elements.languageState.textContent = "";
  lastAnalyzedQuery = "";
  setStage("idle");
  elements.inputState.textContent = inputMessage;
  elements.route.textContent = "Awaiting analysis";
  elements.route.dataset.route = "WAITING";
  elements.offenseDate.textContent = "Not analyzed";
  elements.allowedCorpus.textContent = "Not determined";
  elements.verifierStatus.textContent = "Not run";
  elements.verifierStatus.removeAttribute("data-status");
  elements.gateMessage.textContent = "Analyze the current query to determine the applicable statutory framework.";
  elements.elapsed.textContent = "Not run";
  elements.retrievalList.innerHTML = `<li class="empty">Retrieved provisions will appear after analysis.</li>`;
  elements.iracOutput.innerHTML = `<p class="empty">Issue, rule, application, and conclusion will appear after analysis.</p>`;
  elements.iracCitations.hidden = true;
  elements.iracCitations.innerHTML = "";
  elements.citationCount.textContent = "0 sources";
  elements.warningCount.textContent = "0";
  elements.warningList.innerHTML = `<li class="empty">Warnings and unresolved conditions will appear here.</li>`;
}

function formatDates(facts) {
  const dates = [...new Set((facts.dates || []).map((item) => item.value))];
  if (dates.length > 1) return `${dates[0]} to ${dates.at(-1)}`;
  return facts.offenseDate || dates[0] || "Clarification required";
}

function formatStatus(value) {
  return String(value).toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function titleCase(value) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
