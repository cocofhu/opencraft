# OpenCraft Electron fork

This directory owns the Electron source fork as an immutable upstream revision
plus an ordered, SHA-256-verified patch series. `manage.py checkout` materializes
the full source on an `opencraft/v44.8.0` branch under `.work/src/electron`.
The source definition, patches and build entry live in this repository; no
separate Electron fork repository or manually maintained source copy is needed.

The initial baseline is Electron **44.8.0**, commit
`60169b45c12488c6fda237af7f6425526a7ce5f0`, with Chromium **152.0.7977.167**.
`fork.json` is authoritative. Generated sources, dependencies and build outputs
are ignored; local changes are rejected rather than reset or overwritten.

## Source and build

Use Python 3.11+, Git, Chromium's platform build prerequisites and
[depot_tools](https://chromium.googlesource.com/chromium/tools/depot_tools.git).
The build entry currently supports Linux. macOS/Windows require their native
toolchains and separate validation; packaging an existing binary on Linux is
not a cross-compilation strategy for a modified Chromium runtime.

From the OpenCraft repository root:

```sh
python3 vendor/electron/manage.py checkout
python3 vendor/electron/manage.py verify
python3 vendor/electron/manage.py sync
python3 vendor/electron/manage.py build --jobs 16
vendor/electron/.work/src/out/OpenCraft/electron vendor/electron/probe.cjs
```

Every command accepts `--root /absolute/isolated/build-root` to move the gclient
tree outside the checkout. `sync` downloads Chromium/Node and runs Electron's
normal dependency/patch hooks. `build` compiles locally, without remote build
execution. These are explicit operations, not part of normal application builds.
On a root-only disposable Linux test environment, Electron may require the
explicit `--no-sandbox` CLI option; production sandbox policy is unchanged.

To update this fork, change the fixed upstream revision and dependency version,
rebase the ordered patches in a separate source checkout, regenerate their
checksums, then materialize into a new isolated root. Never repair a mismatch by
resetting another developer's source or weakening tree verification. Chromium
changes belong in Electron's own `patches/chromium` series, carried by one of
this directory's Electron patches.

## First native patch

`0001-observe-native-text-input-state.patch` reconnects offscreen text-input,
composition and cancellation notifications to Chromium's `TextInputManager`.
It adds the experimental `webContents.getNativeTextInputState()` method:

- Native active/type/mode/password metadata and document-local node ID.
- Native UTF-16 selection and composition ranges.
- Native selection-focus geometry or EditContext selection bounds in root
  viewport DIPs, when available. Empty/missing geometry stays unavailable.
- No field value or surrounding text is exported, including password values.

This is **observation only**. The browser-process caches are not an atomic
renderer snapshot; `nodeId` is not a globally unique editor identity. No input
lease, focus generation, strict target-bound commit/cancel or local OS IME
adapter is implemented by this patch. It must not authorize remote editing.

`probe.cjs` uses an isolated headless/offscreen process and profile to check
empty-input and end-of-text native caret availability. Fixture geometry is test
input; the bridge does not query page DOM. The probe fails on stock Electron
instead of silently using accessibility or guessed geometry. A successful source
replay, compilation and native probe are three different results. Real OS IME,
OOPIF, scrolling/zoom, full editing consistency and touch/DevTools coexistence
need subsequent native validation.

## Verification and runtime adoption

```sh
python3 -m unittest discover -s vendor/electron/tests -v
python3 vendor/electron/manage.py verify
```

The source tests reject corrupted patches, unknown clean commits, dirty source
and escaping patch paths. CI replays the real series without compiling Chromium.
It does not report native behavior as tested.

This foundation does **not** replace OpenCraft's installed Electron dependency
or packaged browser runtime. Runtime adoption must select the verified custom
artifact for both desktop packaging and the remote browser worker, check native
API capability, and preserve the existing browser session/permission ownership.
H.264, variable-frame-rate streaming and touch behavior are unchanged here.

Electron's MIT notice is retained in `LICENSE.electron` and in the expanded
upstream source. Built distributions must also retain Chromium and other bundled
dependency licenses and notices.
