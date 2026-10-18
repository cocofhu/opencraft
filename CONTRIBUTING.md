# Contributing to OpenCraft

GitHub is the target upstream for OpenCraft core. Open an issue or pull request
against `main`; use a separate branch and keep changes focused. Product identity
providers, company services and branding belong in downstream composition.

Read [the upstream boundaries](docs/upstream-transition.md) before transferring code
from a downstream repository. Do not replace current downstream changes with an
older snapshot or edit two copies of the same core feature independently.

Read [AGENTS.md](AGENTS.md) for ownership and [the build matrix](docs/build-matrix.md)
for the target platform. Use the pinned Node version in `.nvmrc` and `npm ci` in
your own checkout. Run checks relevant to the changed contract; describe actual
commands, results and limitations in the pull request. Platform behavior changes
need evidence from the affected client, including cancellation and restoration
when those lifecycles change. Do not claim a full platform build from unit tests.

Original contributions use Apache-2.0. Preserve third-party notices and record
source provenance for imported/adapted material. Existing inventory entries are
retained; the owner has removed source cleanup from the migration prerequisites.
Run `node scripts/check-source-provenance.mjs` after changing that inventory.
Do not include credentials, account data, local logs or
private worktree paths in commits or reports.

For releases, use the repository's
[release skill](.agents/skills/opencraft-release/SKILL.md) and exact-artifact
workflow. A contribution PR does not deploy anyone's running instance.
