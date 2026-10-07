# Bug: Start Recording unavailable

Date: 2026-09-26

## Problem and investigation

The actual localhost UI rendered Start recording disabled. The server health response was speechConfigured=false. frontend/app.js used that flag in refreshVoiceAvailability() and setBusy(), so the native disabled button could not invoke its attached toggleRecording handler. All required DOM nodes existed, the button was type=button, the module loaded after the DOM, and browser console inspection found no initialization error. This is a frontend availability bug before microphone capture, not a date-routing or Whisper inference failure.

After removing that gate, clicking reached getUserMedia() and the visible state changed to Requesting microphone. The in-app browser never resolved the permission request. It did not report denial, device absence, or a recorder exception. Its exposed evaluation scope does not expose navigator or isSecureContext; those values could not be inspected directly. The handler reached the microphone call, confirming the required API exists in this context. No successful microphone grant or physical recording was observed.

## Decision and implementation

Only frontend/app.js production behavior changed. Capture depends on browser support and busy state, rather than server Whisper credentials. The existing backend still reports missing credentials when audio is submitted. A pending permission request can be cancelled and times out after 20 seconds. Late streams are stopped and stale results cannot replace a newer recording. The UI, backend provider, legal pipeline, and datasets were not redesigned or changed.

## Tests and result

Six new tests in tests/voiceInput.test.js execute the actual frontend script with a controlled DOM, getUserMedia, and MediaRecorder. They verify missing-key availability before/after analysis, recorder start/stop and Blob submission without auto-analysis, denial recovery, pending cancellation/late track cleanup, permission timeout, and unsupported API gating. This is simulated recorder evidence, not real microphone evidence.

Full suite: 46 passed. Mapping benchmark: 104/104 Top-1 and Top-3 for both IPC/BNS. Current resolved reference replay: 5/5 Top-1 and Top-3. Browser typed query: 2024-06-20, IPC applies, IPC 379 Top-1, grounding Passed. Browser timeout and Cancel both restored Analyze and recording controls. No application console error was observed. Direct HTTP audio request returned 503 SPEECH_NOT_CONFIGURED. No actual browser audio upload occurred because microphone permission did not resolve. No Whisper transcription or recognition accuracy was measured.

All sampled protected artifact and legal-module SHA-256 hashes matched the pre-change baseline. Existing backend speech tests cover empty/oversized/unsupported audio and provider/network/timeout failures.

## Remaining limitation and next action

Use a browser that grants localhost microphone access, allow the microphone, and verify Start -> Stop -> audio upload. Set OPENAI_API_KEY in the server environment and restart to exercise actual Whisper. Live recorder, natural speech, unexpected device interruption, and ASR accuracy remain unverified here. No microphone permission settings were changed by this task.

