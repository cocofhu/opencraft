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


## Public behavior observations before implementation

The original runtime was executed through its exported API in Chromium, using the
real immutable contribution store. The ordinary lifecycle probe records 27
snapshots, and fresh-context bootstrap probes record 22 cases × 6 reads for each
of default presentation and a product policy that defaults to Canvas and hides
Neutral/Frost. All 264 bootstrap reads completed without page errors.

- Missing/invalid mode storage selects light even when the OS is dark. Only an
  explicit system preference follows media changes. Existing preference keys
  remain `vela.appearance-theme` and `vela.appearance-theme-id` in both policies.
- Missing or whitespace-only theme ID chooses the presentation default. An
  unavailable persisted ID remains requested while the visible fallback is the
  presentation default. Reappearing contributions restore the retained intent.
- Import creates the immutable snapshot without applying document CSS. Repeated
  initialization reapplies document/native projections without duplicating the
  media subscription or emitting unchanged snapshot notifications.
- Descriptors, catalog and snapshots are frozen. Explicit unavailable selection
  throws without changing selection. Repeating a selection does not notify; the later storage-instrumented
  observation confirms it still writes the selected preference. Connecting an empty contribution store refreshes the catalog and notifies.
- The explicit-element projection applies mode/classes/theme/compiler CSS only;
  product presentation belongs to document initialization. Preview returns the
  selected-mode compiler properties without mutating selection or document CSS.
- `defaultAppearanceThemeId` preserves a supplied default verbatim, including
  empty/whitespace strings. This helper behavior is distinct from stored-ID
  normalization. Compatibility IDs remain internal persisted identifiers.

Probe corrections retained in the working evidence: a real store rejects a
second live registration with the same ID, so replacement removes the owner
first; unavailable explicit selection is asserted as a rejection. Initial probe
startup timeouts are not attributed to the runtime without evidence. A no-window
Node invocation failed with `ReferenceError: window is not defined`; no SSR
compatibility claim follows from these browser observations. No target body was
read to diagnose these probes. Shared compiler/palettes remain unresolved ports.

Evidence digests (temporary executable observations, not a committed new harness):

- `opencraft-appearance-baseline.json` SHA-256 `802a523b3693d68e1097db4014c65e134f7846d4e2ca7df553a7d1a1b909f022`.
- `opencraft-appearance-bootstrap-baseline.json` SHA-256 `f08e35c7dbf3f20aec686b29b39c4ff0c003affb6305155e45f029d99d6882ac`.
- `opencraft-appearance-policy-baseline.json` SHA-256 `1ca211de6f06891fe69eacd215cea5f96afce2a708d6449fffcecd616a92b234`.

## Additional lifecycle observations (before implementation)

Storage instrumentation corrects the earlier uninstrumented no-write inference:
repeating either selection writes its preference key, without applying or notifying.
Storage read/write exceptions do not prevent in-memory selection. Synchronous
native bridge exceptions propagate after snapshot/storage/document updates and
before subscriber notification. This replacement preserves that failure boundary.

Replacing contribution sources first disconnects the old source, then publishes
the new catalog (two notifications). Old disposers and callbacks cannot clear the
new source. Extension catalog ordering follows registration order, not label sort.
When policy hides all built-ins, the runtime retains Neutral as its safety catalog;
a missing custom default remains requested and activates when contributed. Unknown
preview IDs fall back through the current available catalog, including hidden IDs.
These are browser public-port observations, not implementation-body inspection.

Additional temporary evidence (not a committed harness):

- `opencraft-appearance-lifecycle-baseline.json` SHA-256 `4c2f927da4bea5216c88d85d8844e80e5bafe6bd70af2d59a306e5555acea4fd`.

- `opencraft-appearance-custom-default-baseline.json` SHA-256 `88aff9af499cfa4585df982c271f9bf2bf043e8a7187cb5f44c713487000aa21`.

- `opencraft-appearance-policy-edges.json` SHA-256 `e19ab62e8fa6be9811b61905614381d36d55ecc4c8a1c6eae7c258d69b432d3f`.

## Implementation and compatibility refinement

The new implementation owns one frozen snapshot, a policy-filtered catalog and
one active contribution subscription. It adapts validated extension palettes at
that boundary, delegates CSS compilation unchanged, and projects only owned styles
and the existing native message. Root initialization owns product/meta projection;
React subscribes without controlling lifetime or remounting consumers.

The all-hidden/custom-default observation exposed a distinction during replacement:
an unrelated unavailable stored ID falls back to a built-in even after the custom
policy default becomes available. Only a matching requested custom ID activates
that extension. The replacement now implements that observed built-in fallback.
The complete custom-default comparison was rerun successfully. Initial new-source
checks also caught an incorrect presentation import and missing local bridge type;
both were corrected before final verification. Probe failures are not discarded or
represented as baseline product failures. No previous target body was consulted.

## Completed verification and limits

- Existing appearance/material/presentation tests: 13 passed; no added tests.
- Web TypeScript and platform-boundary checks passed.
- Complete JSON comparison against the original public executable behavior:
  27 operation snapshots plus previews/explicit-element projection; 396 bootstrap
  reads across default, downstream Canvas and all-hidden/custom-default policies;
  all seven storage/source/bridge lifecycle scenarios. Snapshots, CSS, classes,
  metadata, frozen objects, subscriptions, native messages and instrumented writes
  match for every recorded case. This finite comparison is not exhaustive proof.
- Actual SettingsContent in Chromium: 15 radio selections (five palettes × three
  modes), retained edited input and DOM identity, extension unload/reappearance,
  OS media changes and no page errors. The fixture reuses the existing material
  smoke's real component and extension supervisor. Temporary probes remain untracked;
  no tests or harness are added to the repository.
- Source inventory has no errors and still nine unresolved groups. Appearance alone
  leaves two unresolved renderer-expression paths; shared compiler/palettes and
  other consumers are not reclassified.

The browser/native-message observations do not constitute macOS vibrancy, Windows,
iOS/Android, real account login, paid inference or existing Join deployment
acceptance. Historical source rights, prior distribution and source dependencies
remain separately unresolved. Ordinary upstream CI/merge and Join runtime delivery
are separate events, recorded after they actually occur.
