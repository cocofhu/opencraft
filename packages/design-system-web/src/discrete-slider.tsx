import * as Slider from "@radix-ui/react-slider";
import { useEffect, useRef, useState } from "react";

export interface DiscreteSliderOption { readonly value: string; readonly label: string }

/** A single ordered choice. Radix owns capture, snapping, keys and ARIA;
 * preview is local and the consumer receives only completed choices. */
export function DiscreteSlider({ options, value, label, unsetLabel, disabled = false, onValueChange, preservePointerFocus }: {
  readonly options: readonly DiscreteSliderOption[];
  readonly value: string | null;
  readonly label: string;
  readonly unsetLabel: string;
  readonly disabled?: boolean;
  readonly onValueChange: (value: string) => void;
  readonly preservePointerFocus?: () => boolean;
}) {
  const [preview, setPreview] = useState<number | null>(null);
  const thumb = useRef<HTMLSpanElement>(null);
  const heldFocus = useRef(false);
  const choiceKey = JSON.stringify(options.map(option => option.value));
  useEffect(() => { setPreview(null); }, [value, choiceKey]);
  const selected = options.findIndex(option => option.value === value);
  const index = preview ?? Math.max(0, selected);
  const current = preview !== null || selected >= 0 ? options[index]?.label : unsetLabel;
  const restoreFocusability = () => {
    if (heldFocus.current) thumb.current?.setAttribute("tabindex", "0");
    heldFocus.current = false;
  };
  if (!options.length) return null;
  return <div className="ui-discrete-slider" data-unset={selected < 0 && preview === null || undefined}>
    <div className="ui-discrete-slider__value" aria-hidden="true">{current}</div>
    <Slider.Root className="ui-discrete-slider__control" min={0} max={Math.max(1, options.length - 1)} step={1}
      value={[index]} disabled={disabled || options.length === 1}
      onPointerDownCapture={() => {
        // A non-focusable span makes Radix's pointer-origin focus a no-op.
        // This preserves an editor lease without blur/refocus or custom gestures.
        heldFocus.current = preservePointerFocus?.() ?? false;
        if (heldFocus.current) thumb.current?.removeAttribute("tabindex");
      }}
      onPointerUp={() => {
        restoreFocusability();
        // Radix commits only a changed numeric value. An explicitly chosen
        // first stop must also commit when this choice was previously unset.
        if (!disabled && options.length > 1 && selected < 0 && preview === null) onValueChange(options[0].value);
      }}
      onPointerCancel={() => { restoreFocusability(); setPreview(null); }}
      onLostPointerCapture={() => { restoreFocusability(); setPreview(null); }}
      onKeyDown={event => {
        // Menu roving focus/typeahead must not consume slider adjustment keys.
        if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key)) event.stopPropagation();
        if (!disabled && options.length > 1 && selected < 0 && event.key === "Home") onValueChange(options[0].value);
      }}
      onValueChange={([next]) => setPreview(next)}
      onValueCommit={([next]) => {
        const option = options[next];
        if (option && option.value !== value) onValueChange(option.value);
        setPreview(null);
      }}>
      <Slider.Track className="ui-discrete-slider__track">
        <Slider.Range className="ui-discrete-slider__range" />
        <span className="ui-discrete-slider__ticks" aria-hidden="true">
          {options.map((option, position) => <span key={option.value} data-filled={position <= index || undefined} title={option.label} />)}
        </span>
      </Slider.Track>
      <Slider.Thumb ref={thumb} className="ui-discrete-slider__thumb" role="slider" aria-label={label}
        aria-disabled={disabled || options.length === 1} aria-valuemax={options.length - 1} aria-valuetext={current} />
    </Slider.Root>
    <div className="ui-discrete-slider__limits" aria-hidden="true"><span>{options[0].label}</span><span>{options.length > 1 ? options.at(-1)!.label : null}</span></div>
  </div>;
}
