# Review-Support Provisions

Date: 2026-10-02.

## Problem And Investigation

Fact-only intentional-death queries need competing statutory definitions rather than a guessed murder conclusion. Stalking text existed as a comparative-chart mapping-reference, not a complete primary IPC354D source.

## Decision And Implementation

Narrow sentence features surface IPC299/300 or BNS100/101 for intentional-death comparison and IPC354D/BNS78 for repeated unwanted following/contact or monitoring. Explicit references retain priority; allowed-code filtering and gateway remain unchanged. Grounding status requires review of statutory parties, elements and exceptions, not a final offence classification.

A separately downloaded official NCW IPC PDF supplies complete354D text, exceptions and punishments on PDF pages80-81. URL: https://cdn.ncw.gov.in/wp-content/uploads/2022/12/THEINDIANPENALCODE1860_0.pdf . SHA-256:39a9a403de2a50ff9424d6a874f6fcca209272d466addd35157e809e501e8d7f. `build_ipc_supplement.py` extracts/validates it; `corpus.js` verifies supplemental PDF/record hashes and preserves original identifiers/mappings. No frozen corpus, original provenance or evaluation file was edited.

## Tests And Result

Positive pre/post cases surface comparison provisions with NEEDS_REVIEW; ordinary medical/engineering negatives do not get review features; IPC-only isolation is preserved. Full204 tests,104/104 mapping benchmarks and5/5 current replay pass. This adds retrieval support, not gold labels for unresolved blind cases. No legal expert validation exists. Rollback instructions are in Rollback.md.
