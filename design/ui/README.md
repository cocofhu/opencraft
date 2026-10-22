# UI design topics

Load this index only for a UI implementation/review task. It routes to existing
owners; it does not introduce a second theme, component library or token registry.

| Task | Load next | Authority / validation |
|---|---|---|
| Text, font, weight, size, menus, form labels, content typography | [Typography](typography.md) | Existing design-system registry; `npm run check:typography`, `npm run test:typography`, `npm run smoke:typography` |
| Conversation process-summary parity, SVG size, optical weight and clarity | [Activity icons](activity-icons.md) | Shared summary/rail owner; activity policy in typography gate; real Conversation metrics smoke |
| Layout, pane ownership, adaptive presentation | [Workspace invariants](../invariants.md) | Existing Shell geometry and platform adapters |
| Colors, surfaces, controls | [Workbench language](../../docs/workbench-design-language.md), [platform theme ownership](../../docs/platform-architecture.md#theme-surfaces-and-native-appearance) | Existing theme engine and shared controls |

For a future topic such as SVG icons, add one scoped document and a corresponding
check under this index when its contract is actually designed. Reuse existing icon
owners; do not prebuild a general design framework or load every topic for every task.

Before editing: identify the semantic role, its current owner, affected consumers
and platform exceptions. After editing: validate the owner and one real consumer.
A screenshot, token reference, or passing lint alone does not prove semantic fit.

IM settings consume shared section rhythm, semantic empty-state typography and
utility modal/SettingsPanel surfaces. Compact stacked forms use
settings-panel-form; reserved validation belongs below its associated input.
