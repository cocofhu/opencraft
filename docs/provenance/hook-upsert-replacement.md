# Hook run upsert implementation boundary

## Selected scope and frozen requirements

Only `upsertHookRun` directly claims source-equivalent reconstruction. The
[baseline](hook-upsert-baseline.json) retains the exact historical file/function
hashes, annotation and actual exposure. Neighboring validation, Turn selection,
registry ordering, notification revision, mergeTurns and resume handling are not
rewrite targets. Protocol method/field names and hook metadata remain integration
facts rather than branding to remove.

Keep the synchronous readonly list/incoming-run contract and wrapper `{id,run}`.
Preserve the existing order, stable wrapper IDs, matching/reuse policy, complete
run metadata, state updates and structural sharing. Existing runtime tests require
start/completion updates of one execution, idempotent completion, a new execution
under a reused protocol ID with a suffixed wrapper key, and correct explicit/latest
Turn ownership. Do not infer identity from protocol ID alone or silently discard
unknown run metadata. Incoming/current records remain immutable.

Freeze sealed pure-function inputs and stateful update sequences before authoring:
all five statuses, duplicate/reused IDs, start/end timestamps, event/source changes,
entries and arbitrary metadata; retain reference-sharing observations as well as
JSON output. Existing AppServer session and Chat runtime tests cover real consumer
projection with synthetic transport, not employee/real-provider behavior. No tests
or observation harness are committed. Use full historical-module execution with
sanitized error messages; never dump emitted code or its data URL on failure.
This is a bounded independent implementation process, not strict author isolation,
whole-file classification or clearance of historical rights. Eight unresolved
source groups remain open.

## Frozen observations before replacement

The sealed corpus contains 21,830 list/incoming pairs and 150 six-update
sequences, SHA256 `83e0c7481aad0b0d0e5679653ca52e9c3aecc9a204a66ddd1c1860459fe2f7a3`. Frozen inputs detect
mutation; observations retain array, entry and incoming-run reference sharing.
The latest running entry with the same protocol run ID has priority, independently
of start time or event/source fields. Without one, the latest matching non-null
completion timestamp can be updated. Missing/null timestamps do not deduplicate;
zero and equal string metadata retain their observed raw equality behavior.
Otherwise append using the number of prior executions with that protocol ID as
the suffix, preserving list order and the matched wrapper ID.

Updates create a fresh list and matched wrapper containing only its ID and the
complete incoming run object; unrelated entries retain object identity. Previous
run metadata is not silently merged into the incoming record. Sparse legacy
wrapper suffixes retain this count-based compatibility policy. These are observed
application contracts, not a new protocol specification or historical-rights claim.
