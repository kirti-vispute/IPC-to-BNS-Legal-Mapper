# Translation Role And Intent Preservation

Date: 2026-10-02. Scope: multilingual input boundary, not legal routing.

## Problem And Investigation

The real model translated a Bengali cheating description into one where the accused deceives the accused. Gujarati explicit dishonesty became a proper-name-like `Beiman`. A plausible provision does not prove the translation preserved the facts.

## Decision And Implementation

`translationChecks.js` detects increased accused/defendant role mentions and omitted explicit dishonesty for configured native cue families. `multilingual.js` retries once with beam4, then fails safely with a review/rephrase message. Original text stays intact. Existing literal/date/offence checks still apply. This does not verify all actors, ownership, negation or complete meaning.

## Tests And Result

Regression checks cover all10 non-English fixtures, corrected retry, persistent failure, dates and BNS318 retrieval. Real matrix: Bengali retry completes; Gujarati and Kannada cheating remain safely rejected for lost intent. No expert semantic approval, model training or universal accuracy claim. Rollback: restore `multilingual.js` from the session copy; helper becomes unreferenced.
