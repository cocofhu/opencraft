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
