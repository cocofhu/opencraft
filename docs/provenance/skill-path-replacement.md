# Skill path replacement

## Frozen behavioral requirements

Scope: replace `packages/chat-core/src/skill-path.ts` only. The baseline is
`7e200b7` (Git blob `11b74e7f84c0dc51c149bafd545a0e02765938e9`, SHA256
`fd34ea321f7e529dd57b38c8e4d79441fb2f520cdffdd71da71ac520a127b8f1`).
The historical file remains available in Git; replacement does not clear history.

Inputs are a file/directory path and optional working directory. Outputs are the
existing `SkillPathInfo` contract or null. The parser is presentation metadata,
not a filesystem reader, permission decision or evidence a skill exists.

1. Recognize `.codex/skills/<id>` and `.agents/skills/<id>`, with an optional
   `.system` directory before the ID. Reject unrelated `skills` directories.
2. Recognize `.codex/plugins/cache/<market>/<plugin>/<version>/skills/<id>`;
   return plugin identity, marketplace and a readable plugin name.
3. Resolve relative paths against the supplied working directory. Normalize
   slash/backslash separators and lexical dot segments without filesystem I/O.
4. Return the normalized skill root and ID, including for descendant resources.
   Only a direct, case-insensitive `SKILL.md` child is a definition file. A path
   beneath the direct `scripts` child is a script resource. A nested SKILL.md
   must not be mistaken for the root definition.
5. Display names split whitespace, hyphens and underscores and title-case words.
   Compatibility examples: `using-superpowers` → `Using Superpowers`,
   `my_plugin` → `My Plugin`, `HTTP-server` → `Http Server`, `testXML` → `Testxml`.
   Observed initialisms API/UI/SQL/MCP/CLI/LLM/URL retain uppercase. Dots remain
   part of a word. Empty names remain empty.
6. Keep existing exports, consumer rendering and read-activity lifecycle behavior.

## Authoring boundary

These requirements were written before the replacement. Inputs were OpenCraft
export signatures, the `SkillPathInfo` interface, existing consumer tests and
call sites, and black-box calls against the earlier OpenCraft module. No recovered
Desktop implementation or BB/Paseo source was opened for this replacement.
The author has reviewed other recovery-related modules earlier in the same
conversation; an interface extraction also exposed two lines of the old display
helper. Therefore this is a requirements-driven independent replacement,
**not a strict clean-room or redistribution-rights assertion**. No isolated,
unexposed implementation team is claimed.

The new design uses lexical path components and recognized directory layouts;
retained names and wire-path conventions are compatibility inputs. No historical
source annotation is deleted to represent the old module as original.
