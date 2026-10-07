export const BNS_COMMENCEMENT = "2024-07-01";

export function routeByTemporalGate(facts) {
  const sortedDates = facts.dates.map((date) => date.value).sort();
  const spansCutoff = facts.continuingSignal && sortedDates.length > 1 && sortedDates[0] < BNS_COMMENCEMENT && sortedDates.at(-1) >= BNS_COMMENCEMENT;

  if (spansCutoff) {
    return {
      route: "MULTI_PERIOD_REVIEW",
      allowedCodes: ["IPC", "BNS"],
      message: "The facts appear to span the IPC/BNS transition. Both corpora are retrieved and the output is flagged for review.",
      reviewRequired: true
    };
  }

  if (!facts.offenseDate) {
    return {
      route: "CLARIFY",
      allowedCodes: [],
      message: "A clear offense date is required before statutory retrieval.",
      reviewRequired: true
    };
  }

  if (facts.offenseDate < BNS_COMMENCEMENT) {
    return {
      route: "IPC_ONLY",
      allowedCodes: ["IPC"],
      message: "The offense date is before July 1, 2024, so BNS provisions are blocked as the charging framework.",
      reviewRequired: false
    };
  }

  return {
    route: "BNS_PRIMARY",
    allowedCodes: ["BNS", "IPC"],
    message: "The offense date is on or after July 1, 2024, so BNS provisions are primary with controlled IPC cross-reference context.",
    reviewRequired: false
  };
}
