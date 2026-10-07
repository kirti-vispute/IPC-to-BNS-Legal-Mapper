export function synthesizeIrac(query, facts, gate, retrieved) {
  if (gate.route === "CLARIFY") {
    return {
      issue: "The statutory route cannot be selected because the offense date is missing or ambiguous.",
      rule: "The temporal gateway requires a clear offense date before it can decide whether IPC, BNS, or a multi-period review path applies.",
      application: "The submitted query should be revised to include the date when the alleged conduct occurred.",
      conclusion: "Clarification is required before retrieval or mapping can proceed.",
      citations: []
    };
  }

  const top = retrieved[0];
  const citationList = retrieved.map(
    (doc) => `${doc.code} ${doc.section}: ${doc.title} (${doc.source.authority}, ${doc.source.file}, p. ${doc.source.page})`
  );
  const ruleText = retrieved
    .map((doc) => `${doc.code} Section ${doc.section} - ${doc.excerpt}${doc.commencementException ? ` Important: ${doc.commencementException}` : ""}`)
    .join(" ");

  return {
    issue: `Determine the applicable statutory framework for a fact pattern dated ${formatPeriod(facts)}.`,
    rule: `${gate.message} Retrieved rule material: ${ruleText}`,
    application: buildApplication(query, facts, gate, retrieved),
    conclusion: top
      ? `${top.code} Section ${top.section} is the strongest retrieved candidate for this query. ${gate.reviewRequired ? "Human review is required before relying on the mapping." : "The answer remains bounded to the retrieved source text."}`
      : "No statutory candidate crossed the retrieval threshold; human review is required.",
    citations: citationList
  };
}

function formatPeriod(facts) {
  if (facts.offenseDate) return facts.offenseDate;
  const dates = facts.dates.map((date) => date.value).sort();
  if (dates.length > 1) return `${dates[0]} to ${dates.at(-1)}`;
  return "an unspecified date";
}

function buildApplication(query, facts, gate, retrieved) {
  const sectionPhrase = facts.sections.length ? `The query mentions section ${facts.sections.join(", ")}. ` : "";
  const keywordPhrase = facts.keywords.length ? `Detected legal terms include ${facts.keywords.join(", ")}. ` : "";
  const retrievalPhrase = retrieved.length
    ? `The retrieval layer returned ${retrieved.map((doc) => `${doc.code} ${doc.section}`).join(", ")}.`
    : "The retrieval layer did not return a matching statutory record.";

  return `${sectionPhrase}${keywordPhrase}${retrievalPhrase} The gateway route is ${gate.route}, so downstream synthesis is limited to the allowed corpus selection.`;
}
