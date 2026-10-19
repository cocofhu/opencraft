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
