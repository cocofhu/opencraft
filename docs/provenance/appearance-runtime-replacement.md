# Appearance runtime replacement

## Frozen requirements (2026-10-19)

1. Replace the complete appearance-theme module, preserving all public constants,
   types, functions and consumers. Keep the existing persisted IDs and preference
   keys so current selections and working integrations continue to function.
2. One application-owned observable snapshot owns theme preference, resolved mode,
   requested ID, applied fallback and available catalog. React consumes this same
   owner. Preserve stable read identity, subscriptions and idempotent root init.
3. Preserve the built-in catalog, presentation-policy filtering/default selection
   and orthogonal light/dark/system preference. Follow actual system media changes
   only as applicable, with deterministic behavior on missing or invalid storage.
4. Apply complete shared theme-compiler output to the document or an explicit
   non-document root, preserving unrelated CSS. Project mode/classes, theme ID,
   product presentation and theme-color meta through existing ownership boundaries.
   Selection and unload must not leave stale palette overrides behind.
5. Extension contributions supply validated light/dark palette inputs through the
   existing immutable store. Connect/update/disconnect may change available themes
   and applied fallback while retaining the requested ID for later reactivation.
   Preserve deterministic ordering, notification and cleanup behavior observed
   through public ports; do not create a second extension runtime or palette engine.
6. Preview cards consume the selected-mode palette through the same compiler,
   without mutating applied state. Native appearance messages contain only the
   existing preference/mode/opaque/background payload; do not widen bridge authority.
7. Preserve draft/DOM identity, real Settings selection and custom theme load/unload
   behavior across actual Web presentation. Cover persistence, system changes,
   fallback, repeated calls and lifecycle transitions, not just screenshots.
8. Reuse existing theme palettes/compiler, product presentation and contribution
   store unchanged as explicit dependency ports. Their recovered-source status is
   not resolved by independently replacing this runtime. Preserve notices, exact
   historical hashes and author exposure; do not claim historical rights clearance
   or strict author isolation. Validate focused tests, Web types/boundaries and
   actual Web controls before normal upstream PR CI/merge.

## Authoring boundary

The baseline is pinned in [appearance-runtime-baseline.json](appearance-runtime-baseline.json).
The prior target implementation body has not been opened for this replacement.
Inputs are declaration-only TypeScript output, imports, public consumer contracts,
existing tests and architecture/design requirements, plus executable public
behavior. The declaration emitter also exposes public documentation comments;
they describe ownership and are retained as input evidence. Targeted source searches
expose import/type names and function signatures, not old function bodies.

The inventory originally recorded this file at blob
`9d09c901a20970e6aa904e554f45896bc8e259f0` with the visible source-faithful theme
wording; the previous bounded wording correction is retained in the review log.
This replacement concerns the entire runtime implementation, not another wording
rename. Internal compatibility IDs are not displayed as product affiliation.

Existing theme preference/options ports and workbench-product/presentation ports
were read as dependency contracts. The first 55 lines of the still-unresolved
shared theme engine were also exposed, including its recovered-source annotation,
definition type and shell-material defaults. They are reused unchanged, not copied
or reclassified. The author has previously viewed other recovery-related code and
artwork. This is requirements-first independent replacement with recorded exposure,
not strict clean-room isolation. No external recovered renderer/BB/Paseo body is
used as an authoring input. Implementation follows this requirements commit;
public observations, refinements, failures and completed validation follow below.
