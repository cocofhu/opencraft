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
must not claim that an OS permission prompt is open. The send button delegates directly to the existing Composer submission callback;
that owner finishes and validates the transaction. Stop delegates to finish alone.
Do not invent a second recording, completion gate or draft authority.

Preserve observed duration formatting and updates, bounded audio sample display,
resize and device pixel ratio behavior, resource subscription/animation cleanup,
phase transitions and interaction replacement. No synthetic sound without samples.
Freeze historical DOM/interaction/timer and canvas observations before authoring,
with actual input sequences, lifecycle and environment assumptions stated.
Existing native-speech/ledger/startup/composer tests and actual browser scenes
verify consumers; synthetic audio is not microphone, real ASR or native acceptance.
Do not add repository tests or an observation harness. Keep eight unresolved groups
open and retain historical source records and notices.

## Frozen current behavior before replacement

The sealed corpus contains 48 SSR presentations, 48 actual DOM button actions,
four phase lifecycles, 147 canvas/resize/sample scenarios and seven sampling-source
rebinding steps; SHA256 `6a49d8925bddba530eae5c4df41aa2573d7e0a94be88aa53fd8afc4f623e3d6c`.
DOM observations retain accessible labels, disabling, statuses and duration, not
icon implementation or reference-source expression. Timer ticks occur only while
listening, including null-start listening; other phases retain their last displayed
value. Valid samples are finite numbers in [0,1]; other values are ignored. Keep
512 samples, newest on the right, five CSS pixels between two-pixel round bars,
a two-pixel floor, vertical margins and the existing left-edge opacity fade.
Repaint is scheduled by valid samples or resize, coalescing pending frames; no
continual synthetic waveform is generated. Source replacement resets history and
releases its subscription/frame/observer. DPR and fractional widths remain covered.

The observer executes the historical module without printing its body; four
initial attempts exposed missing JSDOM browser APIs (matchMedia, getAnimations,
IntersectionObserver), with sanitized errors and no emitted-source diagnostics.
Those are environment repairs, not historical-module or requirement changes.
Canvas method traces and finite observations do not establish real microphone,
ASR, native platform or universal pixel equivalence. Real Chromium verification
will follow authoring. No repository tests or observer are added.
