# Conversation activity visuals

This topic owns process-summary rendering in the conversation detail page:
commands, read/search/edit tools, reasoning, image views, grouped tools and
active/completed context compaction, collaboration process headers/status and
Codex App thread-tool process rows. Its process glyphs use open contours, rounded joins and restrained detail.
It does not apply one font or one glyph shape to prose, identity logos, cards,
controls or returned documents.

## Shared owners

- `ActivityDisclosure` supplies interactive summaries. Noninteractive process
  records use `ActivitySummaryRow`; compaction must use it too. Both use the
  body typography role (14px/20px, regular weight), independently of the chat reading preference.
  Collaboration toggles and Codex App process rows consume the same header class
  and ActivityIcon rail; accompanying collaboration status uses this same owner.
  Their expanded content and agent identity chips are separate semantics.
  Expanded reasoning and returned documents retain chat/prose typography.
- `ActivityIcon` is the only process-glyph rail. Supply the glyph/identity;
  do not supply feature-local size, width, height, stroke, style or class overrides.
  Existing external logos use contain in this same slot, preserving aspect ratio;
  do not redraw, crop or force their silhouette to match an action glyph.
- `apps/workbench-web/src/styles/_conversation-activity.scss` owns the summary
  font role and optical calibration. The typography registry still owns font
  metrics. Shell/disclosure owners retain layout, hit areas, lifecycle and spacing.

The rail is centered in a 20px slot. Existing glyphs have different source
viewBoxes/padding, so calibrated canvases produce roughly 15px visible geometry
rather than identical outer boxes. Process and shared interface effective strokes
(SVG stroke × rendered width/viewBox width) stay near 1.2 CSS pixels. External identity artwork retains its original paths and aspect ratio; no added
strokes, filters or rendering hacks. Preserve normal vector antialiasing, caps/joins and theme color. Active,
completed, folded and expanded states do not choose independent metrics.

## Presentation choice

OpenCraft uses its existing body role, independently of reading preference, with
roughly15px visible glyphs alongside14px regular text. Do not shrink process copy
to metadata merely to balance icons; the shared rail calibrates each glyph without feature-local overrides.

## Enforcement and acceptance

Enter through AGENTS → design/ui/README → this topic only for activity/icon work.
`check-conversation-activity.mjs` runs inside existing `check:typography`, hence
boundaries/gate. It rejects feature-local rails, glyph sizing/stroke props and
activity font/SVG overrides outside the visual owner, including valid-but-wrong
font tokens. The compaction renderer must consume the shared summary. Parser
adversarial tests run in test:typography and test:control-standards; no baseline
or blanket exceptions. Future summaries use these owners rather than another
renderer-local style block. Source review still checks semantic fit; lint cannot
recognize every invented class or purpose.

Run `npm run smoke:conversation-activity-metrics` for the real Conversation at
DPR1/2, light/dark, narrow/wide, historical/live compaction and enlarged reading
preference. Check font role/weight/line height, painted bounds, centered rail,
label gap and effective stroke, then inspect screenshots. Run the existing
`npx tsx scripts/smoke-reasoning-disclosure.ts` and spacing regression for related
interaction changes. Glyph source/path identity must remain unchanged during
rendering-only calibration. Chromium simulation does not establish physical
macOS/Windows/iPhone rasterization.

## Why earlier checks missed compaction

The earlier calibration tested four activity glyphs but left compaction as a
separate plain flex row: it inherited chat text and hardcoded ListChecks12.
Generic font lint rejected numeric overrides but could not detect a missing role.
Shared summary reuse, required-consumer checks and actual mixed-row computed
styles now cover that omission instead of adding another local font override.

## Coverage follow-up

A passing compaction check did not prove every conversation process row was
covered: collaboration headers still inherited the chat size and used Bot14,
while Codex App rows chose their own metadata role. Keep the real timeline corpus
representative of these production consumers. The static contract requires shared
header/rail use in both collaboration renderers and Codex App thread-tool rows.
Screenshots wait for expanded prose geometry to settle; a computed-font assertion
alone cannot catch an image taken before ResizeObserver/disclosure layout settles.

## Process artwork and motion

`packages/design-system-web/src/activity-icons.tsx` owns the thinking, command, search, read, files, edit,
browser and agent SVGs. The brain remains recognizable with fewer internal
folds; command/search/file contours use deliberate openings. Supplemental
interface icons now use the same SVG package and receive optical calibration
from the rail stylesheet. External identities keep their own artwork. The
Workbench activity-glyphs entry is a compatibility re-export. Static navigation
and model controls never inherit the process pulse or cursor.

`ActivityIcon` receives the owning row's `running` state. Only a running glyph's
internal detail breathes or its command cursor blinks. Completion restores a
fully visible static glyph, independent of surrounding active work. Motion uses
opacity only, retains rail/text geometry and is disabled by reduced-motion
preferences. Historical records and static collaboration headers stay still.
