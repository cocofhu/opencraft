# Dictation footer implementation boundary

## Selected scope and frozen requirements

The complete `packages/codex-composer/src/dictation-footer.tsx` carries a direct
semantic-adoption annotation naming recovered recording controls. Replace only
this module. The [baseline](dictation-footer-baseline.json) records its exact
historical hash, annotation and actual prior author exposure. No reference-product
implementation is required as authoring input. This process does not establish
strict author isolation, historical rights, or whole-composer clearance.

Keep the existing public component/props and the ComposerDictationInteraction
contract, CSS geometry, shared ProgressIndicator and licensed Lucide primitives.
The Composer transaction owns capture, retry, completion, draft mutation and
submission; the footer only presents that transaction and invokes its actions.
Keep startup, listening, transcription and failure states, accessible Chinese
labels/status, cancellation, retry, stop/write and explicit send gating. Startup
must not claim that an OS permission prompt is open. A successful finish is needed
before footer-requested send; do not invent a second recording or draft authority.

Preserve observed duration formatting and updates, bounded audio sample display,
resize and device pixel ratio behavior, resource subscription/animation cleanup,
phase transitions and interaction replacement. No synthetic sound without samples.
Freeze historical DOM/interaction/timer and canvas observations before authoring,
with actual input sequences, lifecycle and environment assumptions stated.
Existing native-speech/ledger/startup/composer tests and actual browser scenes
verify consumers; synthetic audio is not microphone, real ASR or native acceptance.
Do not add repository tests or an observation harness. Keep eight unresolved groups
open and retain historical source records and notices.
