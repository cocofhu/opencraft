import { DndContext, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MoreHorizontal as MoreIcon, Pencil as EditIcon } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { SettingsButton, SettingsNotice, SettingsPanel } from "@opencraft/extension-react";
import { useRef, useState, type ReactNode } from "react";
import { ModalSurface } from "./modal";
import { useWorkbenchPresentationRoot } from "./workbench-presentation-root";
import { moveToolbarAction } from "./toolbar-dock-model";
import { useToolbarDock } from "./toolbar-dock-state";
import { useAsyncNotices } from "./async-notices";
import "../styles/toolbar-dock.scss";

export interface ToolbarDockAction {
  readonly id: string;
  readonly label: string;
  readonly icon: ReactNode;
  readonly disabled?: boolean;
  readonly pending?: boolean;
  readonly dialog?: boolean;
  invoke(): void;
}

function SortableAction({ action, customize, selected, onToggle, onInvoke }: {
  action: ToolbarDockAction; customize?: boolean; selected?: boolean; onToggle?(): void; onInvoke?(element: HTMLButtonElement): void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: action.id });
  return <div ref={setNodeRef} className={customize ? "toolbar-dock__choice" : "toolbar-dock__item"}
    data-dragging={isDragging || undefined} style={{ transform: CSS.Transform.toString(transform), transition }}>
    {customize ? <>
      <button type="button" className="toolbar-dock__grip" {...attributes} {...listeners} aria-label={`拖动${action.label}`} title="拖动排序">⠿</button>
      <span className="toolbar-dock__choice-icon" aria-hidden="true">{action.icon}</span><span className="toolbar-dock__choice-label">{action.label}</span>
      <button type="button" className="toolbar-dock__toggle" aria-label={`${selected ? "移出" : "加入"}工具栏：${action.label}`} onClick={onToggle}>{selected ? "−" : "+"}</button>
    </> : <button type="button" className="chrome-button toolbar-dock__action" {...attributes} {...listeners}
      aria-roledescription="可拖动的工具栏按钮" aria-label={action.label} title={action.label} disabled={action.disabled}
      aria-busy={action.pending || undefined} aria-haspopup={action.dialog ? "dialog" : undefined}
      onClick={event => onInvoke?.(event.currentTarget)}>{action.icon}</button>}
  </div>;
}

function DropZone({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <section ref={setNodeRef} className="toolbar-dock__zone" data-over={isOver || undefined} aria-label={label}>
    <h3>{label}</h3>{children}
  </section>;
}

export function ToolbarDock({ scope, dockId, actions, label, defaultActions = [], onActionTrigger, returnFocus }: {
  scope: string; dockId: string; defaultActions?: readonly string[]; actions: readonly ToolbarDockAction[]; label: string;
  onActionTrigger(element: HTMLElement): void; returnFocus(): HTMLElement | null;
}) {
  const state = useToolbarDock(scope, dockId, actions.map(action => action.id), defaultActions);
  const portal = useWorkbenchPresentationRoot();
  const notices = useAsyncNotices();
  const overflow = useRef<HTMLButtonElement | null>(null);
  const handoff = useRef(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState<readonly string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const byId = new Map(actions.map(action => [action.id, action]));
  const docked = state.projection.docked.flatMap(({ id }) => byId.has(id) ? [byId.get(id)!] : []);
  const invoke = (action: ToolbarDockAction, element: HTMLElement) => {
    onActionTrigger(element); handoff.current = action.dialog === true; setMenuOpen(false); action.invoke();
  };
  const saveOrder = async (order: readonly string[]) => {
    try { await state.save(order); } catch {
      notices.error({ key: `toolbar-dock:${scope}:${dockId}`, message: "工具栏设置保存失败，请重试。" });
    }
  };
  const draftDocked = draft === null ? [] : actions.filter(action => draft.includes(action.id)).sort((a, b) => draft.indexOf(a.id) - draft.indexOf(b.id));
  const draftMore = draft === null ? [] : actions.filter(action => !draft.includes(action.id));
  return <>
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => {
      if (!over || active.id === over.id) return;
      const ids = docked.map(action => action.id);
      const from = ids.indexOf(String(active.id)); const to = ids.indexOf(String(over.id));
      if (from < 0 || to < 0) return;
      const next = [...state.order];
      const a = next.indexOf(ids[from]!); const b = next.indexOf(ids[to]!);
      next.splice(a, 1); next.splice(b, 0, ids[from]!); void saveOrder(next);
    }}>
      <div className="toolbar-dock" role="toolbar" aria-label={label}>
        <SortableContext items={docked.map(action => action.id)} strategy={horizontalListSortingStrategy}>
          {docked.map(action => <SortableAction key={action.id} action={action} onInvoke={element => invoke(action, element)} />)}
        </SortableContext>
      </div>
    </DndContext>
    <DropdownMenu.Root modal={false} open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenu.Trigger asChild><button ref={overflow} type="button" className="chrome-button" aria-label={label} title={label}><MoreIcon size={16} aria-hidden="true" /></button></DropdownMenu.Trigger>
      <DropdownMenu.Portal container={portal}><DropdownMenu.Content className="workbench-context-menu" align="end" sideOffset={4}
        onCloseAutoFocus={event => { if (handoff.current) { event.preventDefault(); handoff.current = false; } }}>
        {state.projection.overflow.map(({ id }) => byId.get(id)!).map(action => <DropdownMenu.Item key={action.id} disabled={action.disabled}
          aria-busy={action.pending || undefined} onSelect={() => invoke(action, overflow.current!)}>{action.icon}{action.label}</DropdownMenu.Item>)}
        <DropdownMenu.Separator />
        <DropdownMenu.Item onSelect={() => { handoff.current = true; setSaveError(false); setDraft([...state.order]); }}><EditIcon size={16} aria-hidden="true" />自定义工具栏</DropdownMenu.Item>
      </DropdownMenu.Content></DropdownMenu.Portal>
    </DropdownMenu.Root>
    {draft !== null ? <ModalSurface label="自定义工具栏" size="compact" appearance="utility" onDismiss={() => { if (!saving) setDraft(null); }} returnFocus={() => overflow.current ?? returnFocus()}>
      <SettingsPanel title="自定义工具栏" footer={<>
        <SettingsButton variant="quiet" disabled={saving} onClick={() => setDraft([...defaultActions])}>恢复默认</SettingsButton>
        <SettingsButton variant="quiet" disabled={saving} onClick={() => setDraft(null)}>取消</SettingsButton>
        <SettingsButton disabled={saving} onClick={() => { setSaving(true); setSaveError(false); void state.save(draft).then(() => setDraft(null)).catch(() => setSaveError(true)).finally(() => setSaving(false)); }}>保存</SettingsButton>
      </>}>
        <SettingsNotice>拖动调整顺序，在工具栏和更多菜单之间移动。空间不足时自动收进更多菜单。</SettingsNotice>
        {saveError ? <SettingsNotice tone="error" role="alert">工具栏设置保存失败，请重试。</SettingsNotice> : null}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => {
          if (!over || saving || active.id === over.id) return;
          const id = String(active.id); const target = String(over.id);
          if (draft.includes(id) && draft.includes(target)) {
            const next = [...draft]; const from = next.indexOf(id); const to = next.indexOf(target);
            next.splice(from, 1); next.splice(to, 0, id); setDraft(next);
          } else setDraft(moveToolbarAction(draft, id, target.startsWith("@") ? null : target, target === "@dock" || draft.includes(target)));
        }}>
          <div className="toolbar-dock__editor" aria-busy={saving || undefined} inert={saving || undefined}>
            <DropZone id="@dock" label="工具栏"><SortableContext items={draftDocked.map(action => action.id)} strategy={verticalListSortingStrategy}>
              {draftDocked.map(action => <SortableAction key={action.id} action={action} customize selected onToggle={() => setDraft(moveToolbarAction(draft, action.id, null, false))} />)}
            </SortableContext>{!draftDocked.length ? <p>拖到这里添加常用操作</p> : null}</DropZone>
            <DropZone id="@more" label="更多菜单"><SortableContext items={draftMore.map(action => action.id)} strategy={verticalListSortingStrategy}>
              {draftMore.map(action => <SortableAction key={action.id} action={action} customize onToggle={() => setDraft(moveToolbarAction(draft, action.id, null, true))} />)}
            </SortableContext>{!draftMore.length ? <p>所有操作已加入工具栏</p> : null}</DropZone>
          </div>
        </DndContext>
      </SettingsPanel>
    </ModalSurface> : null}
  </>;
}
