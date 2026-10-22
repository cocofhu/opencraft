# Changelog

## v0.1.15

- Fix sidebar menus to a single exclusive owner: opening the list Filters menu closes any open row menu and opening a row menu closes the Filters menu, and a row menu whose target became disabled, removed or hidden closes instead of lingering.
- Sidebar menu open/close in the workbench shell still processes no rows and no projections; server and packaging behavior is unchanged from v0.1.14.

## v0.1.14

- Fix the catalog entry performance smoke to wait on the sidebar directory `aria-busy` state instead of the removed `Loading conversations…` status banner, so the release performance gate matches the current shell.
- Server and website runtime behavior is unchanged from v0.1.13.

## v0.1.13

- Support Linux server browser tabs over H.264 with shared Browser Use and persistent remote tabs.
- Integrate repository-owned Electron fork and native editing observation foundation.
- Refine workbench shell interactions, touch-friendly gutters, mobile sidebar crossfades, and typography badges.
- Harden AppHost connection boundaries, session recovery admissions, and reentrant inbound reply fences.
- Improve conversation continuity for multi-file patch groups, saved message aliases, and Turn resource inspection.
- Add shared Agent UI design guidance contracts and reference specifications.

## v0.1.12

- Unify workbench icons and align navigation controls across the website.
- Select PR checks by changed areas and remove duplicate CI runs and automatic DMG builds.
- Fix npm 12 archive path resolution and wait for public registry metadata propagation after publishing.

## v0.1.11

- Validate GitHub Actions npm Trusted Publishing with the configured `npm-release` environment.
- Server runtime behavior is unchanged from v0.1.10.

## v0.1.10

- First public npm release as `@opencraft-app/opencraft`.
- Managed website and execution gateway updates with health checks and rollback.
- Preserve running Codex tasks in an independently deployed core across execution gateway upgrades.
- Resume and roll back locally built releases through the same update transaction.
- This release supports Linux x64 and Node.js 24. Codex core, CLI, and DSH engine remain separately installed; it is not a fresh-server installer.
