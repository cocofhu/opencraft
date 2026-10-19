import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { DiscreteSlider, type DiscreteSliderOption } from "@opencraft/design-system-web/discrete-slider";
import { useIntl } from "@opencraft/i18n/react";
import { BrainCircuit, ChevronRight, Zap } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { useInputAuxiliaryMenuFocus } from "./use-input-auxiliary-menu-focus";

/** Presentation only. Catalog, selection and remembered defaults retain their owners. */
export function ComposerModelPicker({ label, fullLabel, effortLabel, disabled, open, onOpenChange, portalContainer, focus,
  efforts, effort, onEffortChange, serviceTiers, serviceTier, onServiceTierChange, children }: {
  readonly label: string;
  readonly fullLabel: string;
  readonly effortLabel?: string;
  readonly disabled: boolean;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly portalContainer?: HTMLElement | null;
  readonly focus: ReturnType<typeof useInputAuxiliaryMenuFocus>;
  readonly efforts: readonly DiscreteSliderOption[];
  readonly effort: string | null;
  readonly onEffortChange: (value: string) => void;
  readonly serviceTiers: readonly { readonly id: string; readonly name: string; readonly description: string }[];
  readonly serviceTier: string | null;
  readonly onServiceTierChange: (value: string | null) => void;
  readonly children: ReactNode;
}) {
  const intl = useIntl();
  const [modelsOpen, setModelsOpen] = useState(false);
  useEffect(() => { if (!open) setModelsOpen(false); }, [open]);
  const quick = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (modelsOpen && !focus.preservesEditorFocus()) {
      quick.current?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')?.focus({ preventScroll: true });
    }
  }, [modelsOpen]);
  const modelLabel = intl.formatMessage({ id: "chat.model", defaultMessage: "Model" });
  const reasoningLabel = intl.formatMessage({ id: "chat.reasoning", defaultMessage: "Reasoning" });
  const fast = serviceTiers.find(tier => tier.id === "fast" || tier.name.toLowerCase() === "fast");
  const fastEnabled = !!fast && serviceTier === fast.id;
  const triggerLabel = fastEnabled ? `${fullLabel} · ${fast.name}` : fullLabel;
  const title = (current?: string) => (
<div className="codex-composer-model-quick__header">
    <DropdownMenu.Item className="codex-composer-model-quick__title" onSelect={event => { event.preventDefault(); setModelsOpen(true); }}
      onKeyDown={event => {
        if (event.key === "ArrowDown" && efforts.length > 1) {
          event.preventDefault(); event.stopPropagation();
          quick.current?.querySelector<HTMLElement>('[role="slider"]')?.focus({ preventScroll: true });
        }
      }}>
            <span>{label} {current ? <span className="codex-composer-model-quick__effort">{current}</span> : null}</span>
            <ChevronRight size={18} aria-hidden="true" />
          </DropdownMenu.Item>
  {fast ? <DropdownMenu.CheckboxItem className="codex-composer-model-quick__fast" aria-label={fast.name} title={fast.description || fast.name}
    checked={fastEnabled} onSelect={event => event.preventDefault()} onCheckedChange={checked => onServiceTierChange(checked ? fast.id : null)}>
    <Zap size={20} fill={fastEnabled ? "currentColor" : "none"} aria-hidden="true" />
  </DropdownMenu.CheckboxItem> : null}</div>
  );
  return <>
    <DropdownMenu.Root modal={false} open={open} onOpenChange={next => { if (!next) setModelsOpen(false); onOpenChange(next); }}>
      <div className="codex-composer-picker codex-composer-picker--intelligence">
        <DropdownMenu.Trigger asChild>
          <button {...focus.triggerProps} className="codex-composer-mode codex-composer-mode--intelligence codex-composer-mode--depth"
            type="button" disabled={disabled} aria-label={triggerLabel} title={triggerLabel}>
            <BrainCircuit className="codex-composer-mode__model-icon" size={16} aria-hidden="true" />
            <span className="codex-composer-mode__model-label">{label}</span>
            {effortLabel ? <span className="codex-composer-mode__effort-label">{effortLabel}</span> : null}
            {fastEnabled ? <Zap className="codex-composer-mode__fast" size={14} fill="currentColor" aria-label={fast.name} /> : null}
          </button>
        </DropdownMenu.Trigger>
      </div>
      <DropdownMenu.Portal container={portalContainer}>
        <DropdownMenu.Content {...focus.contentProps} ref={node => { quick.current = node; focus.contentProps.ref(node); }} className={modelsOpen ? "codex-composer-selection-menu codex-composer-selection-menu--model-select" : "codex-composer-model-quick"} aria-label={modelsOpen ? modelLabel : fullLabel}
          side="top" align="center" sideOffset={12} collisionPadding={12}>
          {modelsOpen ? children : efforts.length ? <div role="group" aria-label={reasoningLabel}>
              <DiscreteSlider key={JSON.stringify(efforts.map(option => option.value))} appearance="capsule"
                renderValue={title} options={efforts} value={effort} label={reasoningLabel} unsetLabel={effortLabel ?? reasoningLabel}
                preservePointerFocus={focus.preservesEditorFocus} onValueChange={onEffortChange} />
          </div> : title()}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  </>;
}
