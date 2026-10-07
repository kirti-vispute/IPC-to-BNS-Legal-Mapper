# Bug: Missing Offence Date Dead End

Date: 2026-09-26. No Git metadata available.

## Problem and Investigation

Query: "A person dishonestly took another person's mobile phone without consent."

Before: extractFacts produced no dates, offenseDate=null and theft-related phrases. routeByTemporalGate returned CLARIFY, allowedCodes=[] and reviewRequired=true. retrieveStatutes immediately returned []; synthesizeIrac's existing CLARIFY branch requested clarification before retrieval. The UI therefore gave no candidate provisions. This was orchestration/UX, not a date-extraction or theft-ranking bug.

## Decision and Implementation

Preserve Applicable Law Check and all legal/speech engines. In pipeline.js only for CLARIFY with zero extracted dates, call the existing retriever once per isolated corpus using its existing code-specific ranking context. Return up to three IPC and three BNS candidates; scores/order are exactly those produced by the retriever. Explicit references remain in facts and keep per-code priority. Ranking contexts are not applicable-law decisions.

The returned gate still has route CLARIFY and allowedCodes=[], with applicability UNDETERMINED and candidateCodes=[IPC,BNS]. candidateOnly=true and a source-bound candidateSummary ask for the offence date. No date is filled in. irac=null deliberately withholds IRAC rather than editing its generator or presenting a guessed governing statute. Unchanged verifyGrounding checks that summary with actual records, retains review/commencement warnings and reports NEEDS_REVIEW. Frontend uses existing areas and marks every result Candidate; no redesign or voice-only path.

## Tests and Result

Full suite 62/62 (previous 54). Mapping IPC/BNS both 104/104 Top-1/Top-3. Current resolved-reference no-write replay stays 5/5 Top-1/Top-3; historical sealed evaluation remains untouched. Dated pre-transition, post-transition and multi-period full-response hashes match the baseline after removing timing. New tests cover theft/cheating, explicit sections, no date/applicability/IRAC, citation provenance, identical existing ranking, ambiguous-date preservation, typed and voice parity, and UI/manual Analyze.

Actual missing-date theft returned grouped candidates IPC 378, IPC 379, IPC 92; BNS 303, BNS 129, BNS 320. The theft matches are first within each corpus. The UI and endpoint verified DATE REQUIRED/UNDETERMINED, candidate-only source/pages, review warning and no governing-law conclusion. Lower-ranked lexical alternatives are NOT confirmed legal answers; no new filtering or accuracy claim is made. Cheating returned IPC 420/415 and BNS 318 among candidates. No sealed predictions/labels/report/data/provenance or benchmark methodology were changed.

## Risks and Next Step

External API clients must accept irac:null when candidateOnly=true. No cross-corpus score comparison or applicability inference is warranted; these are independent lists. Weak/underspecified queries can still retrieve weak lexical alternatives. Invalid/unrecognized date strings yield no valid dates and ask the user for a clear offence date. Ambiguous dated and multi-period logic are deliberately unchanged. Next action: supply the actual offence date and Analyze again to get the ordinary routed IRAC. Any further ranking change requires separate evidence/approval. Rollback details: Rollback.md.
