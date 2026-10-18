# OpenCraft mono2 migration

The 2026-10-17 decision makes GitHub `opencraft-app/opencraft` the target
writable upstream for OpenCraft core; mono2 owns downstream product composition
and consumes fixed revisions. See [transition status](docs/upstream-transition.md).
The cutover is not complete: preserve the current source until product isolation,
provenance review, upstream acceptance and the first pinned import are verified.
Historical mono2-only/mirror statements below describe prior decisions, not the
current target ownership. The original import was from
`git@git.woa.com:wisp/opencraft.git`.

## Import provenance

- Source branch: `codex/mono2-migration-source`
- Source commit: `af7e7d04b271d788c8177aad411675dbe29f7172`
- mono2 base: `7f636c34d155f31bdfc6df4c7d83a3d36c5d11d3`
- Import commit: `327368646e4e4dda2505caa108736f2d2a58cdb6`
- Login migration-tail source/merge: `c3daab35df63fb3e083792cbbab4930cd4922f3c` / `5865a68a9796d5af2fcd61392bcb12d9a3934da8`
- Runtime migration-tail source/merge: `a3e981f543d3662616a72930d12c52cbaa9adccd` / `84625b756a13d6b78b109116d1de9f694ef39962`
- Host-catalog recovery source/merge: `4b0d4e6b51b323c75d89d80aed311c47b028e157` / `36a3eb0011a76e8670b48663a5dc661ca6942aa8` (upstream feature `7ff9f46a1128d5f4c406cb38a0a94b53390d706a`)
- Refreshed mono2 base: `a8d70ca376455e41a72d6efac680e9eaeb708ad4` (merged by `70d009c3e0b9598537c40bcbd7bd0eda11e43894`)
- Prefix: `opencraft`
- Commands executed during the bounded migration window:

  ```bash
  git subtree add --prefix=opencraft /vela codex/mono2-migration-source --no-squash
  git subtree pull --prefix=opencraft /vela codex/mono2-migration-source --no-squash
  ```

The source repository remains a read-only historical and rollback reference
until it is archived. The tail pulls above only captured edits explicitly
requested before migration handoff; they do not establish an ongoing sync contract.
The old prohibition on consuming GitHub as upstream is superseded in the
2026-10-17 transition. Do not resume arbitrary history merges or dual writes.

## GitHub upstream and downstream consumption

Core changes belong upstream after cutover. Private Vela/IOA/Join code belongs
outside the consumed prefix, with product-owned generation and composition.
The public tree must independently build without mono2 siblings or credentials.
Until that boundary is implemented, this is a migration in progress.

The former single-direction `subtree split` mirror workflow is retired. Preserve
its historical commits and published tags; do not force-push a new history.
Create a normal GitHub PR from its existing main and record each accepted core
transfer. Do not blindly export the entire mixed mono2 subtree or internal logs.

mono2's `scripts/opencraft-upstream.py` provides a pinned tree import with a
normal local parent and `docs/upstream/opencraft.json` provenance. It copies
blobs, verifies exact subtree equality and records source commit/tree/URL,
without importing external commit ancestry or changing contributor identities.
Use `plan` before `import`; require the reviewed destination SHA and source tree.
Its test fixtures cover modes, symlinks, deletions, subsequent pins, dirty/stale
worktrees and protected aggregate names. Actual first consumption is pending;
never use an import to discard local changes not yet transferred upstream.

## Shared frontend boundary

OpenCraft currently consumes a bounded closure of Agent Console source from
the sibling `frontend/` service through
the downstream `products/vela/tooling/sync-mono2-agent-console.mjs`. The generated compatibility copy is
kept temporarily so Web, Expo, Electron, and extension builds remain
independent while stable cross-platform packages are extracted.

- Default source: `mono2/frontend/src`
- Generated target: `products/vela/plugins/lightvela-hermes/src/upstream/mono2`
- Drift check: `npm run check:mono2-agent-console --prefix products/vela`
- Regenerate: `npm run sync:mono2-agent-console --prefix products/vela`

The generator is invoked from the downstream product workspace; core no longer
ships a private compatibility CLI.
The three shared product snapshots likewise live in `products/vela/packages`,
with their generator and explicit verification commands in the product workspace.
No snapshot regeneration is implied by relocating its owner. The Console public
asset output now belongs to `products/vela/public`. Explicit product builds select
that local directory with `OPENCRAFT_PRODUCT_PUBLIC_DIR`; default core builds do
not copy it. Original asset URLs and bytes are preserved. This ownership transfer
does not clear historical provenance or complete the remaining cutover.

The manifest records a repository-relative source and the latest commit that
touched one of the files actually copied into the Agent Console closure or its
public assets. Unrelated frontend documentation and merge commits do not advance
this revision. It must never record a developer worktree path. Generated files
are not edited by hand.

Long term, move stable UI primitives, domain contracts, and repository
interfaces into explicit workspace packages. Delete each vendored slice only
after all OpenCraft targets consume the package and the full gate passes.

`shared/lightvela-agent-core` is the first extracted product-core slice. mono2
Web is its first behavioral consumer. The downstream Vela workspace declares it so
the generated HTTP repository compatibility file can resolve shared identity
and lifecycle functions; this does not make OpenCraft the policy owner or
authorize deleting the generated Agent Console closure. Promote additional
behavior only after frontend characterization tests pass, then validate the
OpenCraft adapter independently.

## One-time GitHub backport (2026-10-13)

The explicitly authorized source is GitHub `opencraft-app/opencraft` main at
`f55a774cd4c3b236abb7fa08e55695d0e9c3d543`. The fork tree at
`f7626b4b9f8cd38f6e187e52f012b2d743d548b5` equals mono2
`9a19588b99e8d1430fcfdf9a3ac80b13fbaf7c71:opencraft`.

Method A temporarily grafts that GitHub fork onto the mono2 commit, then runs
`git merge --no-commit --no-ff -X subtree=opencraft refs/github/main`.
The replace ref is removed immediately after computing the merge; the normal
local merge commit retains the original GitHub source as its second parent.
This describes the preserved Method A evidence, not the later Gongfeng delivery ancestry.
The completed merge is `7cadee2d9d55de8fdb682498f41f9ef587277aeb`, with
second parent `f55a774cd4c3b236abb7fa08e55695d0e9c3d543`. This ID is recorded
in a follow-up documentation commit, since a commit cannot contain its own hash.

This bounded backport brings the GitHub-side changes back to the sole write
source, with mono2 behavior retained and generated shared copies regenerated
from mono2. It does not establish reverse synchronization or change the
one-way public mirror contract above. Optional codex-core defaults off;
the initial five Host SQLite owners have startup admission and storage outcomes.
Stage 3 adds mono2 business SQLite through their physical owners, preserves
published Tasks/SSH history and known legacy records, and keeps optional owners
scoped to actual feature use. Vela embedded/full Web artwork is separated from
core by product identity; the fixed embedded presentation rejects machine/Host
configuration actions. The full integration gate and real internal end-to-end
acceptance remain stages 4/5, not claims made by this backport. Conflict and verification
evidence is in the [Task Pack](../docs/context/tasks/opencraft-github-backport-20261013.md).

## Gongfeng delivery history (2026-10-14)

The user requires all GitHub functionality, not the original Git history, and
currently authorizes only a branch push: no master integration, MR, automatic
merge, GitHub publication or release. This narrows the earlier merge approval.
The parent steward updated the read-only workbook in
`fcb3c4b29fa21caf741184ab65a6ba08e0548892` to record the current push-only scope.

The first normal push of source `5507fd36d610cadda22f9f955e1a25d2514a8779`
was rejected by Gongfeng `committer-check` on GitHub release commit
`4512442ce79f7c948255ddb83830658956b9d21c` (original author/committer
`hxy91819 <masonxhuang@proton.me>`). The source has 208 commits beyond
accepted mono2 base `1bf92e95a26120261e1bce9f1adaf9caf2457430`, including
187 incoming commits reachable from the frozen GitHub head. Changing one
email would not establish acceptance of all incoming identities.

In a separate delivery worktree, `git read-tree --reset -u` imports only the
fixed committed source tree onto that accepted base, followed by a normal
commit. The import commit is `090f4bcdf23f54dcafed142a9400826beae49733`, with exactly one parent,
`1bf92e95a26120261e1bce9f1adaf9caf2457430`. Its author and committer are the
real integrator `masonxhuang <masonxhuang@tencent.com>`, responsible for this
import operation, without claiming authorship of all original features.
The original GitHub contributors' metadata is not rewritten; original source,
local merge `7cadee2d9d55de8fdb682498f41f9ef587277aeb` and its second parent
`f55a774cd4c3b236abb7fa08e55695d0e9c3d543` remain on the local source branch
`steward/opencraft-github-backport` and at the fixed source SHA. GitHub remains
an attribution reference, not another write source.

Exact source/import tree receipts:

| Tree | Source and import hash |
|---|---|
| Repository root | `dd862ca9480fb78eb8c5d116843668078a1c9831` |
| `opencraft` | `5bed9f1e20b740210c57f3c96577f175e432acbd` |
| `frontend` | `ff1b354f0ae155f99d30d0351904bc63be30bf3e` |
| `shared` | `6e8c9d7e1ebd8e21b087a181e76ee6dbd45c5e93` |

A separate provenance documentation commit changes only this file,
`docs/context/project/upstream-subtrees.md` and the backport Task/checkpoint.
The parent workbook commit and the installation transfer below subsequently
add only workbook/provenance documentation and one Playwright test difference.
The final root/opencraft hashes therefore differ from the original import;
all product production code and dependency files remain identical to the fixed source. Stage 4 gate/review evidence for product code `85f82407e`
and stage 5's recorded partial real acceptance are carried forward by file
identity, not reported as rerun or full real-environment acceptance.
No uncommitted installation-worktree files are imported. Newer remote master
`d0d248d6115eaa432daa02150d9250f33e9d2b0b` is not merged into this delivery.

Only the normal refspec
`refs/heads/steward/opencraft-github-backport-delivery:refs/heads/steward/opencraft-github-backport`
is authorized for this operation; no force, tags, master or identity-rule changes.
Stage 7 has not executed. The delivered history no longer has the frozen GitHub
head as a parent, so the earlier Method A split rehearsal cannot prove public
fast-forward ancestry. Revalidate `subtree split` (including any `--onto`
assumption), source/export tree equality, approved public email mapping,
full-history sensitive-information scan and actual GitHub main ancestry in an
isolated export clone before a separately authorized mirror delivery. If
fast-forward proof fails, stop rather than force-push. This delivery conversion
does not establish continuous or bidirectional synchronization.

### Installation record transfer

Source installation commit `68d05a072033206d67e39ae411ffd9586173b560`
was transferred with `git cherry-pick -x` as
`651e41b725c2ad8b9adad8922a2c815edfe30eb3`. It changes only the backport
Task/checkpoint and `tests/playwright/web-updates.spec.mjs`; the two documentation
append conflicts retain both delivery provenance and installation evidence.
The test blob equals the source exactly:
`87a115ffa522c21fd6c4c22b928c459ff6ef1134`.
No original GitHub ancestry is attached by this transfer.

The installed 10000 website is `0.1.12-local.mono2.20261014`,
buildId `20261014025453-d246b9a0a7d4`, built from fixed source `5507fd36d`;
normal URL is `https://opencraft.preview.test/`. The installation thread verified
Web typecheck, release 10/10, updates 12/12, browser e2e 10/10 and independent
review `thr_6v4ukksd92` with no findings. The parent verified health/version GET.
Execution gateway/daemon/DSH/core/CLI processes and start ticks remained unchanged;
execution still uses its old deployment, including core `ff7ad4a`.
This transfer carries that evidence without reinstalling dependencies, rerunning
full gates or deploying again. The final allowed difference from source `5507fd36d`
is the steward workbook, four provenance documents and this one test file;
all other tracked files remain equal. Installation artifacts stay in the original
worktree's ignored `opencraft/.local/server-install-20261014/`.

## 本机试用图标反馈 — 2026-10-14

用户最新要求取代“core单独采用新图标视觉语言”：core 导航按 mono2 `frontend/src/pages/marketing/agent-settings-page.tsx` 与 `frontend/src/styles.css` 的真实 Agent Console 图形/角色样式统一（14px、1.8描边、轮廓；选中改变行背景/文字）。保留 GitHub #27 的语义映射与新功能图形；两个 Vela 面保留旧 consumer 形状、尺寸、显式描边和状态。品牌及内容 SVG 不受通用覆盖。

#27 的旧 `SidebarNavigationItem` 图谱测试不能代替 mono2 unified Shell：真实 Shell 的直接 SVG 和 Settings leading slot、父 inset 必须一起测量，包含窄屏媒体规则。图标修复只更新本机网站，不改变执行模式、账户或独立 core/CLI；阶段 5 外部验收、master 合入和公开镜像仍分开推进。

### Renderer dictionary adaptation

The Agent Console sync adapter preserves every locale as a literal dynamic
import instead of copying the Next SSR eager dictionary policy into renderers.
Management View loaders await `prepareInitialLocale`; runtime locale generations
still fence a late switch. Adaptation belongs to
the downstream `products/vela/tooling/sync-mono2-agent-console.mjs`, never a hand edit of the generated tree.
Frontend SSR and its region policy remain owned by frontend. Run sync/check plus
`smoke-startup-boundaries.ts` when changing this boundary.


### Product Web build configuration

Private Web presets, artifact boundary checks and release CLI belong to downstream
products. A product's trusted local Vite config composes the core
`createWorkbenchWebConfig` factory; the core default retains generic capability
selection and platform constraints without private hosts, environment definitions,
SDK dedupe or product output directories. Product runners retain the original
preview bridge, noVNC patch, core Vite and browser compatibility stages. Explicit
Join CI and native Bot callers select the downstream config; historical receipt
rebuilds retain the original commands when that fixed source predates the runner.
This extraction preserves client implementations and does not establish source
redistribution rights or authorize a public release.
