# Fact-Only Multilingual Theft Retrieval

Date: 2026-10-01. Updated2026-10-02. Status: targeted fixes implemented and tested; general legal correctness is not certified.

## 2026-10-02 Implementation

User authorized completing the remaining-task list. Extract phone/cell-phone variants, owner-qualified consent/permission and spaced possessives without changing raw facts or date routing. Retention lacking a taking action retrieves theft/misappropriation candidates with NEEDS_REVIEW; isolated stolen text needs additional facts. No substring `mobile` -> `mob`, query-specific answer list, fuzzy expansion or corpus-crossing boost is used.

Five new retrieval/review tests cover positives, medical/borrowing/receipt negatives, exact-section priority, ambiguity and death/stalking comparison. Full204 tests pass; mapping104/104 each and current5/5 replay unchanged. Real synthetic11-language matrix53/55: all33 theft fixtures (pre/post/missing-date) return expected candidate families; GU/KN cheating translations are safely rejected for lost intent. Translated ownership can still be ambiguous; family hits are not proof of complete meaning preservation. Historical results below are retained as history.

## Problem

Several dated native-language phone-taking queries select IPC correctly but return unrelated provisions when the user does not supply `IPC 379`. Explicit-section samples pass, masking the issue.

## Investigation

Real local translation plus the production `analyzeMultilingualQuery()` path reproduced failures in Bengali, Tamil, Kannada, Malayalam, and Urdu. The live Bengali page also returned IPC 92/89/313. A short Hindi theft query returned IPC 215/410/411. An English `phone was stolen without permission` query omitted BNS 303. See `output/multilingual-verification/overall-retest-2026-10-01.md` for exact results and scope.

The date and IPC/BNS route were correct. Translated English often changed the taking phrase or used `cell phone`; `hasTheftCue()` in `backend/core/retriever.js` requires narrow property/taking/consent cues. The resulting ranking can be dominated by generic legal words. This is retrieval/query-representation behavior, not a corpus or temporal-gateway finding.

## Decision

No production change in this testing task. Any future fix must be narrow, evidence-based, preserve corpus routing and explicit section priority, and add positive and negative regressions across affected languages. The current tests do not establish legal correctness beyond controlled source references.

## Tests and Result

Full suite 190/190; crosswalk benchmark 104/104 IPC and 104/104 BNS; current five-case replay 5/5. Five fact-only multilingual pre-transition queries nevertheless missed IPC 378/379 in Top-3. No sealed evaluation result was changed.
