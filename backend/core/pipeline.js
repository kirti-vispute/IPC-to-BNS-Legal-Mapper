import { extractFacts } from "./dateExtractor.js";
import { routeByTemporalGate } from "./gateway.js";
import { retrieveStatutes } from "./retriever.js";
import { synthesizeIrac } from "./synthesizer.js";
import { verifyGrounding } from "./verifier.js";

export function analyzeQuery(query) {
  const normalizedQuery = String(query || "").trim();
  if (!normalizedQuery) throw new Error("Query is required.");

  const started = performance.now();
  const facts = extractFacts(normalizedQuery);
  const gate = routeByTemporalGate(facts);
  if (gate.route === "CLARIFY" && facts.dates.length === 0) {
    // These are ranking contexts only, never applicability decisions or assumed dates.
    const retrieved = ["IPC", "BNS"].flatMap(code => retrieveStatutes(normalizedQuery, facts, {
      route: code === "IPC" ? "IPC_ONLY" : "BNS_PRIMARY",
      allowedCodes: [code]
    }));
    const message = "Offence date not provided. Please state the date of the alleged offence to determine whether IPC or BNS applies. Statutory applicability remains undetermined; the provisions shown are candidates only.";
    const candidateGate = { ...gate, message, applicability: "UNDETERMINED", candidateCodes: ["IPC", "BNS"] };
    const candidateSummary = retrieved.length
      ? `Candidate provisions only: ${retrieved.map(doc => `${doc.code} Section ${doc.section}`).join(", ")}. ${message}`
      : `No matching statutory candidates were retrieved. ${message}`;
    return {
      query: normalizedQuery, facts, gate: candidateGate, retrieved,
      candidateOnly: true, candidateSummary, irac: null,
      verifier: verifyGrounding({ conclusion: candidateSummary }, candidateGate, retrieved, facts),
      elapsedMs: Math.round(performance.now() - started)
    };
  }
  const retrieved = retrieveStatutes(normalizedQuery, facts, gate);
  const irac = synthesizeIrac(normalizedQuery, facts, gate, retrieved);
  const verifier = verifyGrounding(irac, gate, retrieved, facts);

  return {
    query: normalizedQuery,
    facts,
    gate,
    retrieved,
    irac,
    verifier,
    elapsedMs: Math.round(performance.now() - started)
  };
}
