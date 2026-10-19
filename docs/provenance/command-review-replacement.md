# Command and review renderer replacement

## Frozen requirements (2026-10-20)

1. Replace the complete command-and-review renderer module and all seven public
   components. Preserve public props and existing consumers, protocol fields,
   preference keys, CSS/ARIA contracts and chronological Item/Turn identity.
2. Reasoning consumes the shared returned-content presentation, selecting actual
   summary/detail once. Empty text cannot invent an explanation. Preserve initial
   folding, explicit controlled/uncontrolled choices, restoration, streaming DOM
   identity and active/settled line selection. Completion must not reset choices.
   Use the existing document/resource and disclosure/reflow ports; do not own
   timeline grouping, scroll following, Markdown grammar or a second text cache.
3. Command rendering consumes the shared presenter/classifier and detail policy,
   preserving command/output/error/exit/duration and skill-read presentation.
   Running and settled expansion choices remain compatible through lifecycle
   transitions. Render terminal text through the existing ANSI/normalization port,
   without executing command strings or interpreting output as markup.
4. Automatic review components consume shared action/title/summary/warning policy
   and display actual status, assessments and readable details. Their disclosure
   changes presentation only, never grants approval or issues an execution action.
   Replace the historically source-identical accessory artwork with an independently
   assembled generic shield/terminal symbol from the existing licensed icon set.
5. The interruption warning presents the supplied review/action/reason through
   existing localization and document ports. No native status, authorization,
   completion or success may be fabricated by a view.
6. Copy uses the existing text/rich clipboard ports, optional lazy HTML getter and
   localized label. Preserve observed feedback, repeated activation, rejection,
   timer cleanup and unmount behavior. Do not add a private clipboard owner.
7. Reuse immutable shared core presentation, application visibility, existing
   design system/activity disclosure, document/resource/clipboard contracts and
   public consumer wiring. Preserve working engine integrations and product locale.
   Document actual dependencies and remaining provenance instead of clearing them.
8. Freeze executable public observations before authoring. Reuse existing focused
   checks and browser smokes; temporary untracked observations are permitted, no
   added committed tests or harness. Validate actual Web controls, streaming,
   touch/keyboard, narrow/wide and light/dark presentation. Preserve notices,
   exact historical hashes, exposure and honest platform/rights limits.

## Authoring boundary

Exact baseline is [command-review-baseline.json](command-review-baseline.json).
The prior target implementation body has not been opened for this replacement.
Inputs so far are declaration-only compiler output, target import declarations,
existing consumers/fixtures, formal design and the existing shared disclosure and
context dependencies. The emitter includes the historical public documentation
comment calling the automatic-review accessory source-identical; that claim is
retained here as evidence, not propagated to replacement artwork.

The author previously saw other recovery-related code and artwork. This work is
requirements-first replacement with recorded exposure, not strict clean-room
isolation, historical rights clearance or a whole-renderer classification. The
still-unresolved shared classifier/presenter/document/activity dependencies are
ports, not implementation templates. No external recovered renderer or BB/Paseo
body is used as an authoring input. Implementation must follow this requirements
commit; observations and compatibility refinements will be appended separately.


## Public behavior frozen before implementation

The first exploratory browser invocation supplied a notification callback without
applying its state and used two invalid command fixture values (`completed` and
`NONE`). These samples are not final acceptance. The corrected baseline uses the
actual `complete` status and all three declared detail policies: 56 samples, no
page errors. A second 15-sample edge observation also has no page errors.

- Reasoning begins folded. Without an external callback its local choice persists
  through text growth and settlement. A supplied callback delegates choice to the
  consumer; `collapsed` overrides local choice. A supplied presentation and active
  override are honored. Only actual returned content creates the disclosure.
- Header and body use the existing activity/document ports. The body is lazy and
  removed after closure; the shared trigger may pre-mount it during attempted
  expansion even when a controlled parent declines the requested choice.
- Generic commands begin folded even when running/pending. The same choice
  survives status changes; expanded labels use the shared generic wording while
  folded labels include the actual command. Live elapsed time uses Item start,
  settled time uses reported duration. A background PTY retains its own wording.
- A single read uses a resource-link detail rather than a terminal body; resource
  activation emits the resolved file target/decision. Skill reads consume shared
  policy and can be hidden while running. Terminal output uses ANSI rendering,
  absent output says No output, and settled footers distinguish success, exit
  code (including unknown) and interruption. Copy command/output actions remain.
- A running review starts expanded; settled review starts folded. Its nested
  assessment disclosure is independent. Title, plain-text rationale, warning and
  lifecycle status come from shared core. Review lists retain supplied order,
  including approvals; the outer registry separately suppresses approved blocks.
- The interruption contract actually contains message/detail only, not a review
  or action. Requirement 5 means presenting that message with its explanatory
  tooltip; this observation corrects the initial generic wording without widening
  the protocol or inventing review fields.
- Copy supplies plain text or the lazy HTML/text MIME pair through existing ports.
  Success changes the accessible label to Copied and later restores it; failures
  leave the original action available and do not emit an unhandled page error.

Temporary browser evidence (not committed probes/harness):

- `opencraft-command-review-baseline-final.json` SHA-256 `3f4dccdb8c280d7be71b3f0bfe537ca21596860ae93397cb6ac12f61415bc8da`.
- `opencraft-command-review-edges.json` SHA-256 `4cd2bbc827e80a1046f17c72a2f91594debbe863cf5bb6f1824c862077a99677`.


## Implementation and compatibility refinements

Requirements commits `8c0bf6f` and `46746fc` precede the complete implementation
`8243a29`. The module independently adapts shared core presentation into explicit
view state, review assessments, a scoped live clock, terminal details and mounted
action feedback. Shield and Terminal are composed from the existing Lucide ISC /
Feather-derived MIT dependency; no historical custom SVG path was reused. Existing
notices and licenses remain unchanged.

The complete target body was replaced without opening the prior implementation.
Later edge controls execute its pinned Git blob through a local Vite loader that
returns source directly to the compiler without printing its body. This is public
executable observation, not author-body inspection. Shared core formatter/classifier,
reasoning, clipboard and resource dependency bodies were inspected as unchanged
ports; their status is not cleared here. A transient declaration-emitter invocation
ran before npm installation completed and failed to resolve TypeScript; the same
emitter succeeded after the installation became terminal.

Initial new-source observations caught interrupted commands being incorrectly
classified by their stop icon. Expansion is now selected by semantic action kind,
with the shared capability deciding whether a terminal body exists. A provisional
capability-only classifier was rejected because reads also expose generic data.
Additional observations moved assessment details into the command body while
retaining only its icon in the header, restored missing-result text/footer, and
measured the copy feedback timeout as 1500ms. Shared icon metrics are owned by
CSS; a local Brain stroke prop caught by the boundary check was removed. These
failed/intermediate runs are retained separately and not counted as acceptance.

## Completed verification and limits

- Existing reasoning performance and provenance suites: 14 tests passed. Web
  types, typography/activity visual ownership and platform boundaries passed.
- The 56-sample original public-operation trace matches the replacement's labels,
  text, buttons, callbacks, resource and clipboard records. All 15 additional
  choice/clock/clipboard-failure states also match. Ten additional DOM states plus
  one instrumented timeout observation match for review accessories, unavailable
  results, semantic reads/search/list, empty commands and copy feedback. All three
  final traces have no page errors. This compares the recorded semantic fields,
  not every DOM byte, animation frame or possible input.
- An initial accessory observation correctly failed on an intercepted command
  toggle and motivated the placement correction. One later extra probe timed out
  at startup while separate local Vite fixtures shared a cache; separate cache
  directories resolved it and the full extra trace was rerun. The failure is not
  reported as product acceptance or silently counted as passing.
- Existing actual Conversation/reasoning smoke passes all 12 combinations of
  Codex/Hermes/DSH, light/dark and mouse/touch, including returned Markdown,
  independent disclosures, streaming identity, restored choices, 13 empty reasoning
  Items interleaved with 60 tools, and single Thinking/work ownership. Five further
  locale headers pass. An earlier smoke was deliberately stopped to correct the
  classifier and is not an acceptance run.
- Existing activity-spacing smoke passes 96 observations of opening, closing,
  growth and reversal across light/dark and mouse/touch with viewport ownership.
- Actual command/review browser rendering passes at 390/1024px and light/dark:
  keyboard expansion, independent assessment detail, output growth retaining the
  original terminal DOM, and command copy. Light narrow and dark wide screenshots
  were inspected; the new shield/terminal accessory is intentionally different.
- Release Web build passed, including browser compatibility for 790 runtime
  sources with zero issues. Final upstream-base integration checks are recorded
  separately below after they actually complete.

No new tests or harness are committed. Temporary local probes and synthetic
engine data do not establish native Electron/iPhone hardware, actual account
login, live paid inference or external service acceptance. Nine source groups
remain unresolved; this leaves one renderer-expression path, and does not clear
historical distribution or unchanged dependency provenance.

Temporary final evidence digests:

- `opencraft-command-review-baseline-final.json` SHA-256 `3f4dccdb8c280d7be71b3f0bfe537ca21596860ae93397cb6ac12f61415bc8da`.
- `opencraft-command-review-after-v3.json` SHA-256 `9a22b79397edc80c5b57021b00c6a69618e8fd462e3900800aeb281c15bb2109`.
- `opencraft-command-review-edges-final.json` SHA-256 `b6118014d6ca96dcf98383fa6325088450b3a073ce2a276a8ddc4fb534b35eb9`.
- `opencraft-command-review-extra-baseline.json` SHA-256 `cf7c122cc13dded0778a5b0237b9402a3857fcb48aa38f2f600769f3e8b3e212`.
- `opencraft-command-review-extra-final.json` SHA-256 `5e4022532596f753b2435e881a12bef89ba9221f6a0cbb24224a50b53b1ab07d`.
- `opencraft-command-review-visual.json` SHA-256 `8e6494cc12af5415d998089ba2afafaff00f3fc892744fae30266fffa8e92c1c`.

## Upstream base integration verification

Merged the normally accepted appearance PR #128 (`43d4fd47e9b0c3a8f7a796b69c82abb31f885bee`)
into this isolated feature branch without conflicts. On the resulting source,
Web types, platform/typography/activity boundaries, all 14 existing focused tests
and release Web build passed again; the final browser compatibility check covers
790 runtime source files with zero issues. Inventory reports errors=[] and
releaseReady=false with nine unresolved groups and one remaining expression path.
Normal PR CI and actual downstream deployment are separate subsequent events.

### Accepted upstream baseline follow-up

After PR #127 was accepted, the normal feature merge `4eec9b492d64143a563789367fc429204923d556` retained the accepted sidebar implementation from main `fdcbc11`. The replacement module itself is unchanged. The combined branch passes the existing 14 reasoning/provenance checks, Web types, typography/activity/platform boundaries, the four desktop/mobile × light/dark command/review keyboard/copy/stream identity observations (12 samples, no page errors), and the release Web build with 791 browser runtime sources and no compatibility issues. This finite recheck does not extend the author-exposure or historical-rights claims above. No tests or harness were added.
