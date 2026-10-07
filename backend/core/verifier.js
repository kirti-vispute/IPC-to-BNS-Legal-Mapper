export function verifyGrounding(irac, gate, retrieved, facts = {}) {
  const warnings = [];
  const conclusion = irac.conclusion.toLowerCase();
  const citedInConclusion = retrieved.some((doc) => conclusion.includes(doc.code.toLowerCase()) && conclusion.includes(doc.section.toLowerCase()));

  if (retrieved.length > 0 && !citedInConclusion) {
    warnings.push("Conclusion does not name a retrieved section.");
  }

  if (gate.reviewRequired) {
    warnings.push(gate.message);
  }

  if (retrieved.length === 0) {
    warnings.push("No retrieved source text is available for grounded synthesis.");
  }

  for (const doc of retrieved.filter((record) => record.commencementException)) {
    warnings.push(`${doc.code} ${doc.section}: ${doc.commencementException}`);
  }
  if (facts.concepts?.includes("unauthorized_property_retention")) {
    warnings.push("The processing text describes keeping property without consent but does not establish the taking action. Theft and misappropriation candidates need review; verify the original input or translation.");
  }
  if (facts.concepts?.includes("reported_theft_unspecified")) {
    warnings.push("The input reports stolen property without describing the act, property or parties. These retrieval candidates require additional facts and review.");
  }
  if (facts.concepts?.includes("intentional_death_review")) {
    warnings.push("Intentional death-causing facts retrieve culpable-homicide and murder provisions for comparison. Exceptions, intention, knowledge and the complete circumstances require expert review; ranking does not settle the offence.");
  }
  if (facts.concepts?.includes("stalking_review")) {
    warnings.push("Following or electronic-monitoring facts retrieve stalking provisions for review. Verify the statutory parties, repeated conduct, disinterest and exceptions before deciding whether the provision applies.");
  }

  return {
    status: warnings.length ? "NEEDS_REVIEW" : "PASSED",
    warnings
  };
}
