# React runtime provenance

## Current stable callback implementation

`useStableEvent` is an OpenCraft typed adapter over the unmodified public
`useEvent` export from **react-use-event-hook 0.9.6**, by Scott Rippey, licensed
under MIT. The workspace declares the exact version; the root lockfile pins:

- Project: <https://github.com/scottrippey/react-use-event-hook>
- Registry archive: <https://registry.npmjs.org/react-use-event-hook/-/react-use-event-hook-0.9.6.tgz>
- SHA512 integrity: `sha512-wNchkFrrlz64QQOJOf5+dFjy+27bJEwtS1SgliRXVsU60wo3pSntNRlwDws2qPHwrAP/wlm5IyQHBlPCya0JIQ==`
- Archive SHA1: `cbe75361a366a9abd65d9513851a8f2fcc3f6e08`

The published archive's `dist/esm/useEvent.js`, declaration, package metadata
and complete `LICENSE` were inspected, and the downloaded bytes matched the
registry integrity. The implementation keeps one command identity and publishes
the callback during React's insertion effect, before layout consumers. An
uncommitted suspended render cannot publish its callback. The public library
also rejects invocation before the first mount; OpenCraft's observer/layout
consumers invoke commands only after commit. No React private internals are used.

The npm metadata reports `gitHead` as
`35bc20cc9d789e2b95664915a72c7fd01b1cbbb2`; that object could not be resolved
through the current GitHub repository (raw source returned 404; Git tree API
returned 422). It is retained as registry metadata, not presented as a verified
Git source binding. The publicly downloaded archive's readable implementation,
license and immutable integrity are the source of this licensed disposition.

The library's environment selection requires `window` for its client effect.
Web and Electron renderers provide it; React Native 0.86.3 initializes
`global.window = global` before application modules in
[`Libraries/Core/setUpGlobals.js`](https://github.com/facebook/react-native/blob/v0.86.3/packages/react-native/Libraries/Core/setUpGlobals.js).
Server rendering runs no callback effects and must not invoke the command.

`NOTICE.json` retains the full copyright/permission text verbatim. The root
NOTICE points to it for source distributions. Vite emits complete dependency
notices at `licenses/dependencies.md` for Web/Electron renderer output; the Web
server packager retains that directory. Expo's config retains this full notice
in the public `extra.openSourceNotices` metadata embedded by Expo Constants.
Native signing/installation and an eventual release archive still require
their normal artifact review; a source conclusion is not proof of those steps.

`tests/react-runtime.test.tsx` exercises real React commits: command identity,
latest values during layout, abandoned Suspense work, StrictMode replay,
arguments/results/errors, first-mount invocation and the actual history backfill
consumer. `tests/react-runtime-notices.test.mjs` compares notices to the installed
package's license and lockfile and checks public/native product metadata.
These are renderer/runtime tests, not iPhone or Android hardware acceptance.

## Historical implementation (retained evidence)

Before the licensed replacement, the local wrapper was recorded as restoring
Codex Desktop's stable/latest callback behavior against:

- `reference://codex/.runtime/source-tree-build-r1973-initializer-state-control-closure/shared/use-latest-callback.js:10-38`

It used a local `useRef` / `useInsertionEffect` / `useCallback` implementation
and omitted the reference's private React dispatcher probe. That implementation
has been removed from the current adapter, not renamed or translated. The
current replacement is third-party licensed, not claimed to be clean-room work.
The former implementation and earlier Git history remain unverified; replacing
the current source does not grant rights to historical commits.

The package's presentation-activity helpers, exports and metadata were not part
of the callback replacement and remain unchanged OpenCraft code.
