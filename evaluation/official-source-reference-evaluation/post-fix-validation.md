# Post-Fix Validation

Date: 2026-09-09

## Scope

This validates the targeted retrieval fix that implemented only the confirmed issues from `retrieval-debug-report.md`:

1. `mobile` must not trigger `mob`.
2. Explicit same-code section references must retain high priority.
3. Narrow theft-element phrase boosts should improve strong theft fact retrieval.

No production code was changed during this validation. The cheating fact-only fix was not implemented.

Immutable artifacts were not modified:

- `evaluation/runs/blind-predictions.json`
- `evaluation/official-source-reference-evaluation/official-source-reference-labels.json`
- `evaluation/official-source-reference-evaluation/official-source-reference-report.json`
- official-source evaluation methodology

## Regression Results

### Full Test Suite

Command:

```text
npm run test
```

Result:

```text
21 passed, 0 failed
```

### 104/104 IPC-BNS Retrieval Benchmark

Command:

```text
npm run evaluate
```

Result:

| Benchmark split | Cases | Top-1 | Top-3 |
|---|---:|---:|---:|
| Post-commencement BNS retrieval | 104 | 104/104, `100%` | 104/104, `100%` |
| Pre-commencement IPC retrieval | 104 | 104/104, `100%` | 104/104, `100%` |

This benchmark is derived from the official BPR&D IPC-BNS comparison rows. It is a retrieval consistency check, not independent legal validation.

## Before vs After on Resolved Official-Source Cases

The original sealed official-source evaluation remains unchanged because it reads historical sealed predictions:

| Metric | Sealed baseline before fix | Current pipeline after targeted fix |
|---|---:|---:|
| Top-1 provision accuracy on 5 resolved cases | `40%` | `80%` |
| Acceptable Top-3 any-hit on 5 resolved cases | `40%` | `80%` |

Current no-write replay of the 5 resolved official-source cases:

| Case | Reference | Current Top-3 | Result |
|---|---|---|---|
| `blind-001` | `IPC-378` | `IPC-378`, `IPC-379`, `IPC-92` | Pass |
| `blind-002` | `BNS-303` | `BNS-303`, `BNS-314`, `BNS-129` | Pass |
| `blind-004` | `BNS-318` | `BNS-314`, `BNS-320`, `BNS-232` | Fail |
| `blind-007` | `BNS-111` | `BNS-111`, `BNS-146`, `BNS-189` | Pass |
| `blind-010` | `BNS-127` | `BNS-127`, `BNS-126`, `BNS-142` | Pass |

Interpretation:

The targeted theft/mobile/section-reference fix improves the resolved-case replay from `40%` to `80%`. The remaining failure is the known cheating fact-only case `blind-004`, which was intentionally not fixed in this pass.

## Unseen Fact-Only Theft Queries

These queries were not part of the five resolved cases used in the error analysis. They are diagnostic prompts, not official labels.

| ID | Query | Route | Top results | Outcome |
|---|---|---|---|---|
| `unseen-theft-001` | On 19 June 2024, a mobile phone was taken from a school bag without consent. | `IPC_ONLY` | `IPC-378`, `IPC-379`, `IPC-313` | Generalizes successfully to mobile-phone theft without explicit section. |
| `unseen-theft-002` | On 25 June 2024, movable property was carried away from another person possession without consent. | `IPC_ONLY` | `IPC-92`, `IPC-356`, `IPC-403` | Fails. Phrase is missing supported action/possession pattern because `carried away` and non-possessive `person possession` are not covered. |
| `unseen-theft-003` | On 12 July 2024, a mobile phone was taken without consent. | `BNS_PRIMARY` | `BNS-303`, `BNS-129`, `BNS-155` | Generalizes successfully to post-commencement mobile-phone theft. |
| `unseen-theft-004` | On 12 July 2024, a gold ring was taken from another person without consent. | `BNS_PRIMARY` | `BNS-129`, `BNS-351`, `BNS-232` | Fails. `gold ring` is not recognized as a property/object cue by the narrow fix. |
| `unseen-theft-005` | On 18 June 2024, a laptop was removed from its owner without permission. | `IPC_ONLY` | `IPC-154`, `IPC-81`, `IPC-156` | Fails. `laptop`, `removed`, and `without permission` are outside the deliberately narrow theft cues. |

Unseen theft summary:

- Successful: 2/5
- Failed: 3/5

This shows partial generalization. The fix helps when unseen wording still contains the specific supported cues, especially `mobile phone`, `taken`, and `without consent`. It does not generalize broadly to every theft synonym or stolen-object description.

## Unrelated Query Checks

These checks verify that `IPC 92/89/88` were not globally suppressed.

| ID | Query | Route | Top results | Interpretation |
|---|---|---|---|---|
| `unrelated-001` | On 20 June 2024, a surgeon acted in good faith for a person benefit without consent. | `IPC_ONLY` | `IPC-92`, `IPC-89`, `IPC-88` | Good. Consent/general-exception provisions still rank correctly for a non-theft query. |
| `unrelated-002` | On 20 June 2024, an act was done in good faith for the benefit of a child with guardian consent. | `IPC_ONLY` | `IPC-89`, `IPC-92`, `IPC-88` | Good. `IPC 89` remains available for child/guardian consent facts. |
| `unrelated-003` | On 20 June 2024, a person fired against a mob during private defence. | `IPC_ONLY` | `IPC-106`, `IPC-98`, `IPC-99` | Good. True `mob` still triggers mob/private-defence related retrieval. |
| `unrelated-004` | On 20 June 2024, a complaint concerns mob lynching by a crowd. | `IPC_ONLY` | `IPC-300`, `IPC-88`, `IPC-106` | Mixed. True `mob` and `lynching` are detected, but the retrieval remains shallow for mob-lynching-specific characterization. This is outside the theft fix. |

Conclusion:

`IPC 92`, `IPC 89`, and `IPC 88` are not incorrectly suppressed. They still rank when the query is actually about consent, good faith, guardian consent, or general exceptions.

## Mobile/Mob Verification

Diagnostic inputs:

| Query | Extracted keywords | Legal phrases | Result |
|---|---|---|---|
| `mobile` | none | none | Pass. No `mob`. |
| `mobile phone theft on 20 June 2024` | `theft` | `mobile phone` | Pass. No `mob`. |
| `movable property theft on 20 June 2024` | `theft`, `movable`, `property` | `movable property` | Pass. No `mob`. |
| `mob` | `mob` | none | Pass. True `mob` detected. |
| `mob lynching on 20 June 2024` | `mob`, `lynching` | none | Pass. True `mob lynching` detected. |

The validation set found no case where `mobile` triggered `mob`.

## Explicit Section Priority

| Query | Route | Top result | Result |
|---|---|---|---|
| The alleged act happened on 2024-06-20 and concerns theft of movable property under IPC 379. | `IPC_ONLY` | `IPC-379` | Pass |
| The offence occurred on 2024-07-12 and concerns theft under IPC 379. | `BNS_PRIMARY` | `BNS-303` | Pass. IPC reference maps to BNS under post-commencement routing. |
| The offence occurred on 2024-07-12 and concerns theft under BNS 303. | `BNS_PRIMARY` | `BNS-303` | Pass |
| The offence occurred on 2024-06-20 and concerns an act done in good faith under IPC 92. | `IPC_ONLY` | `IPC-92` | Pass |

The same-code explicit section guard works where the referenced code is the primary routed code. It does not break official IPC-to-BNS mapping for post-commencement queries.

## Evidence of Overfitting

There is some evidence of narrowness, but not harmful overfitting:

- Positive: The fix generalizes beyond the exact five cases to unseen `mobile phone` theft wording.
- Positive: The fix does not suppress `IPC 92/89/88` for unrelated consent/good-faith queries.
- Positive: The 104/104 official mapping benchmark remains unchanged at `100%`.
- Limitation: The fix does not handle broader theft synonyms or object nouns such as `gold ring`, `laptop`, `removed`, `carried away`, and `without permission`.

The fix appears intentionally narrow rather than overbroad. It improves the confirmed failure shape without pretending to solve all theft paraphrases.

## Remaining Retrieval Failures

1. `blind-004` remains unresolved in the current pipeline.

   Query:

   > On 12 July 2024, a person was deceived and dishonestly induced to deliver property.

   Reference:

   - `BNS-318`

   Current result:

   - `BNS-314`, `BNS-320`, `BNS-232`

   Reason:

   - The cheating fact-only boost was intentionally not implemented in this pass.

2. Broader theft paraphrases remain weak.

   Examples:

   - `gold ring was taken ... without consent`
   - `laptop was removed ... without permission`
   - `movable property was carried away ...`

   Reason:

   - The fix only recognizes narrow high-confidence theft cues from the debug report.

3. Mob-lynching characterization remains shallow.

   Example:

   - `mob lynching on 20 June 2024`

   Reason:

   - This was outside the retrieval-debug fix scope and was not tuned.

## Final Assessment

The targeted fix is validated as safe and useful:

- tests pass
- official 104/104 retrieval benchmark still passes
- explicit section priority works
- `mobile` no longer triggers `mob`
- unrelated consent/general-exception provisions are not suppressed
- current resolved-case replay improves from `40%` to `80%`

The improvement partially generalizes, but only to queries that share the supported theft cues. The remaining gap is not the Applicable Law Check; it is still phrase/entity coverage in retrieval, especially for cheating and broader theft paraphrases.
