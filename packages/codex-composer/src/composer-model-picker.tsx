import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { DiscreteSlider, type DiscreteSliderOption } from "@opencraft/design-system-web/discrete-slider";
import { FormattedMessage, useIntl } from "@opencraft/i18n/react";
import { BrainCircuit, Check, ChevronRight, ChevronsUpDown } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import type { useInputAuxiliaryMenuFocus } from "./use-input-auxiliary-menu-focus";

/** Presentation only. Catalog, selection and remembered defaults retain their owners. */
export function ComposerModelPicker({ label, fullLabel, effortLabel, disabled, open, onOpenChange, portalContainer, focus,
  efforts, effort, onEffortChange, children }: {
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
  readonly children: ReactNode;
}) {
  const intl = useIntl();
  const [configure, setConfigure] = useState(false);
  const [submenu, setSubmenu] = useState<"model" | "effort" | null>(null);
  const [sheetContainer, setSheetContainer] = useState<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const quick = useRef<HTMLDivElement | null>(null);
  const modelLabel = intl.formatMessage({ id: "chat.model", defaultMessage: "Model" });
  const reasoningLabel = intl.formatMessage({ id: "chat.reasoning", defaultMessage: "Reasoning" });
  const configureLabel = intl.formatMessage({ id: "composer.model.configureTitle", defaultMessage: "Configure" });
  const title = (current?: string) => (
<DropdownMenu.Item className="codex-composer-model-quick__title" onSelect={() => setConfigure(true)}
      onKeyDown={event => {
        if (event.key === "ArrowDown" && efforts.length > 1) {
          event.preventDefault(); event.stopPropagation();
          quick.current?.querySelector<HTMLElement>('[role="slider"]')?.focus({ preventScroll: true });
        }
      }}>
            <span>{label} {current ? <span className="codex-composer-model-quick__effort">{current}</span> : null}</span>
            <ChevronRight size={18} aria-hidden="true" />
          </DropdownMenu.Item>
  );
  return <>
    <DropdownMenu.Root modal={false} open={open} onOpenChange={onOpenChange}>
      <div className="codex-composer-picker codex-composer-picker--intelligence">
        <DropdownMenu.Trigger asChild>
          <button {...focus.triggerProps} ref={trigger} className="codex-composer-mode codex-composer-mode--intelligence codex-composer-mode--depth"
            type="button" disabled={disabled} aria-label={fullLabel} title={fullLabel}>
            <BrainCircuit className="codex-composer-mode__model-icon" size={16} aria-hidden="true" />
            <span className="codex-composer-mode__model-label">{label}</span>
            {effortLabel ? <span className="codex-composer-mode__effort-label">{effortLabel}</span> : null}
          </button>
        </DropdownMenu.Trigger>
      </div>
      <DropdownMenu.Portal container={portalContainer}>
        <DropdownMenu.Content {...focus.contentProps} ref={node => { quick.current = node; focus.contentProps.ref(node); }} className="codex-composer-model-quick" aria-label={fullLabel}
          side="top" align="center" sideOffset={12} collisionPadding={12}>
          {efforts.length ? <div role="group" aria-label={reasoningLabel}>
              <DiscreteSlider key={JSON.stringify(efforts.map(option => option.value))} appearance="capsule"
                renderValue={title} options={efforts} value={effort} label={reasoningLabel} unsetLabel={effortLabel ?? reasoningLabel}
                preservePointerFocus={focus.preservesEditorFocus} onValueChange={onEffortChange} />
          </div> : title()}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
    <Dialog.Root open={configure} onOpenChange={next => { if (next || submenu === null) setConfigure(next); }}>
      <Dialog.Portal container={portalContainer ?? undefined}>
        <Dialog.Overlay className="codex-composer-model-config__scrim" />
        <Dialog.Content ref={setSheetContainer} className="codex-composer-model-config" aria-describedby={undefined}
          onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus({ preventScroll: true }); }}>
          <div className="codex-composer-model-config__handle" aria-hidden="true" />
          <Dialog.Title className="codex-composer-model-config__title">{configureLabel}</Dialog.Title>
          <div className="codex-composer-model-config__rows">
            <DropdownMenu.Root modal={false} open={submenu === "model"} onOpenChange={next => setSubmenu(next ? "model" : null)}>
              <DropdownMenu.Trigger className="codex-composer-model-config__row">
                <span>{modelLabel}</span><span className="codex-composer-model-config__value">{label}</span><ChevronsUpDown size={16} aria-hidden="true" />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal container={sheetContainer}>
                <DropdownMenu.Content className="codex-composer-selection-menu codex-composer-selection-menu--intelligence"
                  data-has-detail="true" aria-label={modelLabel} side="top" align="center" sideOffset={8} collisionPadding={12}>
                  {children}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            {efforts.length ? <DropdownMenu.Root modal={false} open={submenu === "effort"} onOpenChange={next => setSubmenu(next ? "effort" : null)}>
              <DropdownMenu.Trigger className="codex-composer-model-config__row" disabled={efforts.length === 1}>
                <span>{reasoningLabel}</span><span className="codex-composer-model-config__value">{effortLabel ?? reasoningLabel}</span><ChevronsUpDown size={16} aria-hidden="true" />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal container={sheetContainer}>
                <DropdownMenu.Content className="codex-composer-selection-menu" aria-label={reasoningLabel} side="top" align="end" sideOffset={8} collisionPadding={12}>
                  <DropdownMenu.RadioGroup value={effort ?? ""} onValueChange={onEffortChange}>
                    {efforts.map(option => <DropdownMenu.RadioItem key={option.value} value={option.value} className="codex-composer-selection-menu__item">
                      <span className="codex-composer-selection-menu__copy">{option.label}</span>
                      <DropdownMenu.ItemIndicator><Check size={16} aria-hidden="true" /></DropdownMenu.ItemIndicator>
                    </DropdownMenu.RadioItem>)}
                  </DropdownMenu.RadioGroup>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root> : null}
          </div>
          <Dialog.Close className="codex-composer-model-config__done"><FormattedMessage id="composer.model.done" defaultMessage="Done" /></Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </>;
}
