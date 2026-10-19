# Global streaming segment reconciliation boundary

## Selected implementation and frozen requirements

Only `reconcileGlobalSegments` carries the selected direct source-equivalent
annotation. The [baseline](streaming-segments-baseline.json) preserves its old
file hash, annotation and actual author exposure. No whole-module disposition
is inferred. Adjacent semantic-class references, word segmentation, node identity,
session commit/CAS, compiler caches and fade CSS remain outside this change.

Keep the synchronous function contract: document ID, current segment strings,
previous readonly `{key,text,entering}` segments, streaming flag and the mutable
identity counter produce readonly segment records. Preserve existing matching,
key allocation order, entering flags, counter advancement and input immutability.
Previously shown text must not restart fade solely because Markdown reparses it
into a different container. Completion settles segments. Repeated strings, insertion,
deletion, rearrangement, growing words, whitespace and Unicode need frozen runtime
observations before authoring; do not replace the application's matching policy
with a guessed edit-distance algorithm. Counter/key syntax is compatibility data.

Existing public session tests require committed segment keys across appends and
quote reparenting, settled reused segments, completion and candidate-CAS isolation.
Freeze full public session outputs and sealed pure-function observations before
changing implementation. No tests or observation harness are added to the repository.
An external full-module transpilation executes historical code without displaying
its body; sanitize errors to avoid diagnostic source disclosure. This is a bounded
independent implementation process, not proof of strict author isolation or clearance
of historical source rights. The eight unresolved groups remain under review.

## Frozen executable observations

Before implementation, 50,176 pure-function inputs and 800 public
session sequences were frozen (SHA256 `fa7797e2bb9c20d0c66b6bf0494f20df4767fdeeadefd2caa53ff3e426af2a18`).
Same-position nonempty text growth takes precedence over matching a later exact
string; otherwise the earliest unconsumed exact prior string is reused globally.
An already consumed positional candidate cannot be reused. Reordering can preserve
keys, but a moved growing string is not automatically matched by prefix. Empty
strings are exact-match candidates, not prefixes for arbitrary growth. Reused
segments settle; new segments enter only while streaming. Returned records are
fresh even when their key/text are reused. Historical arguments are frozen to
detect mutation. Public sequences include an abandoned candidate, a newer committed
candidate and completion. This finite corpus supplements existing consumer tests.

## Replacement and retained failure evidence

The replacement builds per-text occurrence queues and tracks consumed prior
positions. A same-position exact or nonempty growing string wins; otherwise the
next unconsumed exact occurrence is selected. New keys consume the caller's
identity counter, and every output record is fresh. No parsing or fade timer moves
into this function. This avoids repeated whole-history search for duplicate text.

The first comparison found 564 differences, all involving empty strings: exact
same-position empty matches also have positional priority. The frozen corpus
already contained them. The correction adds that exact case without weakening
inputs; original mismatches remain external. Final comparison has zero differences
across 50,176 pure inputs and 800 full committed/abandoned/completed session sequences.
No historical function body was printed by the sealed observer. This bounded pass
does not erase prior author exposure or establish strict isolation.

Document typecheck, 44 existing document/cache/provenance tests, three existing
Workbench recovery tests and typography/platform boundaries pass. The real Web
streaming smoke renders 5,000 segments: maximum delay 96ms, no hidden spans after
500ms or completion, 37,513 DOM characters and no page errors. It uses synthetic
text and local Chromium, not employee login, native clients or real-provider
throughput. No repository tests or harness are added. Public Web build status is
recorded separately after its terminal result.

The public Web build completed with 791 runtime sources and zero browser
compatibility issues. Final inventory validation and its ten existing tests pass;
eight unresolved groups remain. Final AST-bounded byte comparison proves the
identity module prefix and suffix outside the selected declaration/annotation
are unchanged. All validation artifacts and retained failures are external.
