# MCP elicitation replacement

## Requirements fixed before implementation

Replace the complete `packages/chat-core/src/mcp-elicitation.ts` module at baseline
`914548543b1546262e81049ba2794891cd88104f`, historical Git blob
`6222e2ae56a87ad3ba87e275446990a540be34ba`, SHA256
`3c157e6ea96e1d930b501c3a15d0d4d3bbe12c7aa14eff3583a2e9a0a1d5f80f`.
The prior metadata and display helpers carried source-equivalent annotations;
preserve that history rather than treating annotation deletion as clearance.

Authoring inputs: AST-extracted exported signatures/types (no function bodies),
consumer projection and Web/Expo contracts, existing tests, and black-box
OpenCraft observations. No old module helper bodies or recovered Desktop/BB/Paseo
implementation was read for this replacement. The author has previously reviewed
other recovered modules; this is a requirements-driven independent replacement,
not strict clean-room isolation or historical rights clearance.

1. Preserve all five function exports and their public types. Normalize untrusted
   metadata/schema values as data; no I/O, submission, authorization or policy
   mutation occurs in this shared renderer-neutral module.
2. Normalize risk (`low`/`high` only), subtitle strings and deduplicated
   session/always persistence in input order. Generic form/openai-form and URL
   actions remain distinct. Tool-call approvals use typed snake-case metadata,
   connector/server fallback identity, raw params and ordered named display rows.
3. Suggestions require exact install/enable and connector/plugin tags plus
   string reason/id/name; preserve optional installation/plugin identity. Their
   persistAlways flag follows the observed scalar `persist: always` contract.
   URL connector-auth requires the codex_apps server and typed nested auth-failure
   metadata; malformed candidates fall back to ordinary form/URL presentation.
4. Preserve the implicit computer-use approval for the existing exact engine
   sentence, always-persistence and an empty requested-field schema. Keep the
   extracted application in params and a named display row. Other text, servers,
   persistence or nonempty forms do not manufacture this approval. Protocol names
   and sentences remain integration data, not product affiliation claims.
5. Normalize ordered schema properties to text/number/boolean/select/multi-select.
   Recognize string enum values and titled oneOf constants; keep defaults,
   required names, title/description, finite constraints and format. Handle
   arrays via their item choices. Public field descriptors drive both platforms;
   nested objects and unknown primitive schemas fall back to text presentation.
6. Drafts use normalized defaults. Validation trims scalar text, converts finite
   numeric strings with integer/min/max checks, applies text min/max lengths,
   retains booleans and ordered string arrays, omits optional empty values, and
   returns null content if any field has an error. Preserve established error
   messages and validation precedence. This is the existing UI subset, not full
   JSON Schema validation or a trust boundary; selection membership/format checks
   remain outside this module's established contract.
7. Text-like value previews preserve exact text and become expandable above 120
   characters. Structured values have readable JSON plus compact previews capped
   at 48 characters with ellipsis and expansion. Preserve JSON fallback behavior
   for undefined, circular or unserializable data. Never use display data as code.
8. Black-box matrix comparisons must cover metadata tags/modes/fallbacks, malformed
   inputs, schema/default/constraint variants, draft boundaries and previews.
   Exercise the real Web interaction component for form errors and typed submit,
   tool value expansion, persistence choices, suggestion/auth/URL presentation and
   actual action handoffs, using synthetic data. Typecheck Web and shared core;
   retain the shared Expo consumer contract without claiming native-device tests.

## Implementation observations

Requirements were committed as `b548b78` before implementation. The frozen draft
miscounted the exported functions as six; the actual five functions listed by
AST extraction are all replaced, with no scope reduction. All exported types
remain unchanged.

The replacement uses explicit tagged metadata routing, literal engine-sentence
recognition, typed field descriptors, and field-local validation with collected
outputs/errors. The display helper separates scalar text from structured JSON.
Draft/content creation retains prototype-like names as own data properties.

The first 8,198 black-box comparisons covered metadata modes/tags, persistence,
malformed inputs, primitive and choice schema variants/defaults, ten draft
variants per field set, and preview boundaries. Compatibility corrections from
observed outputs preserve implicit computer-use fallback precedence, item-choice
fallback for non-array fields, and integer markers even when choices take
presentation precedence. The final matrix has zero differences. No old helper
body was inspected to make these corrections.

## Verification and limits

- `node --import tsx --test tests/chat-mcp-elicitation.test.ts tests/chat-core.test.ts tests/chat-interaction-response.test.ts tests/source-provenance.test.mjs`: 127 passed.
- `npm run test:chat`: 740 passed. New tests cover mode/routing/persistence,
  required typed identities, exact fallback context, schema/default/validation
  boundaries, display limits/circular data and prototype-like own field names.
- Core and Web workspace typechecks and `npm run check:boundaries`: passed.
- `scripts/smoke-mcp-elicitation.ts`: passed at 390px and 1200px using the real
  pending-interaction panel and current theme properties, with no page errors.
  It verifies required/minimum errors, numeric/boolean/selection/array submission,
  risk display, complete expanded JSON, fifth parameter disclosure, session and
  permanent scope handoffs, denial, install/auth open-then-continue and generic
  URL decline. No response is emitted merely by opening setup. The narrow
  screenshot was visually inspected with readable approval controls.
- Inventory validation has no structural errors. Only this module moves to the
  independent replacement record; three chat-semantics paths and all eight
  unresolved groups remain. The release provenance gate remains unresolved.

Browser actions terminate at synthetic response/URL handoffs. No external tool
was authorized or executed, no connector account was linked, and no native-device
or authenticated service flow was tested. The shared public types and both
platform consumers are retained; this bounded result does not classify the
consuming renderer, other modules, historical commits or distribution rights.

A further 192-context matrix exposed two fallback-boundary requirements: preserve
explicit connector/tool identities when deriving computer-use app details, and
reject line-separated engine sentences. Those corrections and regression cases
were added; both the 192-context and original 8,198-call matrices now match with
zero differences. These observations refine item 4 of the frozen requirements.
