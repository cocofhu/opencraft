# Composer action artwork

Microphone, lightning, stop, permission and settings glyphs share the restrained rounded line-art language of
conversation activity glyphs. `packages/design-system-web/src/action-icons.tsx`
owns their SVG artwork. Voice input, Composer controls and settings entrances consume the same exports;
no feature carries a second bolt or microphone path.

Use a simple capsule and open receiver for the microphone, with a matching slash
when the existing voice state requires it. Commands, full-access permissions,
Fast menu actions and the compact Fast indicator use one lightning silhouette.
Fast retains its existing filled enabled state and accessible checked/label semantics.
These are action glyphs, not provider logos or activity rows.

Existing control owners retain geometry: the microphone uses the shared
`ui-composer-input-icon` token (20px normally, 24px on touch), with the existing
44px touch target. Model/menu/compact glyphs retain their respective slots and
labels. The 24-unit SVG artwork uses 1.5-unit round strokes and `currentColor`;
small markers and larger touch controls remain optically appropriate to their role.
Do not import the process rail into input controls or reduce the microphone's
existing touch size to make all outer canvases identical.

This artwork owns no animation or behavior. Recording feedback remains with the
voice footer; recording, failure/retry, cancel and draft/selection ownership are
unchanged. Decorative SVGs are hidden from accessibility; a supplied label creates
an image role only where the existing consumer needs it.

Validate the real Composer and voice contribution at narrow/wide widths and in
both themes. Check microphone idle/error, Fast off/on in its menu and expanded/
collapsed footer, command/permission icons, original hit areas and stable editor
geometry. Existing dictation and model-menu smoke scenarios retain interaction
coverage. Browser speech/Host fixtures do not establish physical microphone or
external ASR behavior.

The stop control retains its ring and rounded square, and its existing pending
spinner. Read and edit permissions share one folded-page silhouette with distinct
line/code interiors; the permission entrance keeps its checked shield. Settings
entrances share one rounded six-tooth gear with an open hub. Existing color,
selection, danger, disabled and busy semantics belong to their controls.

The left/right split-panel and sidebar toggles are explicitly retained as drawn,
per user feedback. Do not replace their artwork or change their geometry while
unifying action icons. They also demonstrate the desired restrained proportions.
