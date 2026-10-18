# Connector artwork disposition

## Current core

The 23 connector brand images listed in
[the exact-source inventory](../connector-brand-sources.json) are excluded from
the current core. The former `assets/connector-brands` glob loader is removed.
`ConnectorIcon` consumes the unchanged connector category and existing
`lucide-react` icons; unknown servers retain a generic plug icon. The icons are
decorative, while the owning card, setup heading and quick-picker row retain
the service name and existing accessible label. No service or connector
operation has been removed. No runtime URL or remote artwork is loaded.

Lucide's existing ISC license and included Feather MIT notice are retained by
the dependency and the Web/Electron dependency-license output. This is replacement of the decorative image slots,
not independent recreation of any brand mark. Private the downstream product/managed site artwork stays
downstream. Historical files and distribution rights remain unverified; the
current-tree exclusion does not authorize publishing historical commits.

Validate the actual connector UI with `npm run test:connectors` and
`node --import tsx scripts/smoke-connector-library.ts`. Build Web and Electron
renderer assets and inspect their exact output for the old image hashes and
remaining image-loader references. No image bytes are retained in this document.

## Historical attribution (retained)

The 23 former brand assets were copied without modification from Octop
`ae65fe4e26854d2eaf751cee89341ec5d71569f0`,
`dashboard/src/assets/connectors`. They identify the corresponding services;
brand marks remain associated with their respective owners. No Octop UI styles
or runtime code are used. The upstream MIT notice is retained in
[connector-core/NOTICE.md](../../packages/connector-core/NOTICE.md).
