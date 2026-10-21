# OpenCraft Shell layout invariants

The Shell retains content and state while panels animate, resize, disappear or
change route.

## The authoritative state path

The right panel has one write path:

1. Shell state stores semantic visibility.
2. The route-scoped animation owner stores progress.
3. `setRightPanelVisibility` changes visibility, stops the current animation, and
   retargets the shared progress.
4. AppShell, HeaderSlot, floating bounds, and AppShellRightPanel only read the
   shared progress.


The panel component does not create its own visibility MotionValue and does not
publish its measured width back to its parent. This prevents a child remount,
route change, or effect cleanup from freezing only one consumer mid-animation.

## One lossless geometry transaction

For each frame, define:

- `W`: shell width
- `L`: animated left-panel width
- `C = W - L`: main-content capacity before the right panel
- `R`: right-panel target width
- `P`: shared right-panel progress, clamped to `[0, 1]`
- `A = P * R`: physical animated right-panel width
- `V = C - A`: physical main viewport width

The non-negotiable conservation rule is:

```text
L + V + A = W
```

No ResizeObserver snapshot or React state from a previous frame may take part
in this equation. The right panel's header reservation is `A` in regular mode
and `0` in full-width mode.

The semantic target width is distinct from the physical viewport:

```text
targetMain = open ? C - R : C
```

It is intentionally not the same value as the physical viewport during the
transition. Stable content placement can reason about the destination while
the DOM still renders the current animated frame.


## Mount lifetime follows progress

The panel remains mounted while either semantic visibility is true or progress
is greater than zero:

```text
isMounted = isVisible || animation.get() > 0
```

An `animationComplete` subscription causes the final render that unmounts the
panel at zero. Mount lifetime is not controlled by a component-local Promise.
The non-animated reduced-motion path forces the equivalent terminal update.


## The moving aperture and the stable surface are different elements

The outer `aside` owns animated width and opacity. Inside it, an absolute clip
element hides a surface whose width and minimum width remain equal to `R`.
Panel content therefore does not continuously reflow as the aperture opens or
closes.

`width` and `min-width` are one atomic constraint, not merely two properties
that usually receive the same number. The web adapter publishes `R` once as
`--app-shell-right-panel-target-width`, and both CSS declarations consume that
signal. This prevents a Motion runtime from advancing `width` while leaving
`min-width` at its initial frame, which would make tab-bar actions follow the
moving aperture during a resize.

The regular panel divider and shadow belong to the panel plane. The resize
handle is a sibling of the clipped content and uses the same target-width
model. Visible minimum and magnetic close shelf are separate configured
constraints. Between them, normalized width remains clamped while the pointer
travels; crossing the close shelf starts the close transaction. Numeric limits
belong to the current Shell geometry contract.


## Header ownership is measured independently

Header actions have two widths:

- `fitWidth`: the intrinsic max-content width of the actions, measured from an
  invisible out-of-flow duplicate;
- `slotWidth`: the animated layout width supplied by AppShell.

The visible animated slot is never used to measure its own minimum. This keeps
the reopen control alive when panel width reaches zero and prevents a
measurement feedback loop.


## Full width, responsive closure, and resize are explicit modes

Full-width mode gives the physical right panel all of `C`, collapses the main
viewport to zero, and gives the header reservation zero. It is not implemented
as an oversized regular panel.

Responsive closure carries a `window-resize` reason and records restoration
intent separately. Manual closure clears that intent. Resizing, visibility,
full-width state, and the active tab are separate state fields; none is inferred
from a transient DOM width.


## Timeline and rich-block overflow stay local

The main viewport, thread rows, and rich blocks all carry `min-width: 0`.
Code blocks use an inline-size containment boundary; their inner scroller owns
horizontal overflow and the `pre` element may use `width: max-content` only
inside that scroller. A long code line may scroll within the code block, but it
must never widen the thread, main viewport, or AppShell.


## Mobile contact ownership

The existing Shell touch controller owns one arbitration transaction. Code and
table renderers declare a scroll capability, not navigation handlers. Pending
contacts resolve to sidebar, content or native input; a committed owner keeps the
sequence until end/cancel. Only that owner writes movement. Slow local reading
and quick deliberate navigation compete before either commits; input, selection,
foreground dialogs, media and unregistered horizontal owners remain exclusive.
The [mobile gesture contract](../../design/invariants.md#mobile-sidebar-gestures)
owns thresholds and lifecycle details. Touch-action is scoped to enabled mobile
Shells and declared inline scrollports; native vertical input, pinch zoom,
keyboard/wheel and non-mobile/standalone presentation remain available. Pending horizontal recognition reserves the cancelable stream before its movement owner commits; the decision clock starts at meaningful motion, excluding stationary contact time. Unknown speed waits for a timed segment. Native
scroll acquisition, multi-touch, detached content and foreground layers revoke
pending input rather than creating two movement writers.

## OpenCraft acceptance rules

Every AppShell change must demonstrate all of the following:

1. At every sampled animation frame, `left + viewport + right == shell` within
   subpixel tolerance.
2. Closing reaches an exact zero-width right panel and then unmounts it.
3. Reversing a close animation preserves one shared progress and never exposes
   an unowned gutter.
4. Resizing the window during either direction recomputes `R` from the current
   `C` without using a stale child measurement.
5. The header reopen action remains visible at zero panel width.
6. Full-width mode produces `viewport == 0` and `headerReservation == 0`.
7. Long code, math, Mermaid, tool output, and streamed content cannot alter the
   AppShell conservation equation.
