import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Clock, CircleHelp } from "lucide-react";
import { SettingsButton, SettingsSelect } from "@opencraft/extension-react";
import { useIntl } from "@opencraft/i18n/react";
import type { TaskConversation, TaskDetail, TaskMember, TasksRequestPort } from "@opencraft/appserver-protocol";
import { isMorningResearchTask, isOverdueHandoff, readResearchHandoff, type ReadyResearchHandoff } from "./research-handoff";
import "./ai-follow-up.scss";

/** Read-only projection of the task authority; triage never implies an AI handoff. */
export function AIFollowUp({ tasks, members, aiResearch, activity, port, onOpenConversation }: {
  tasks: readonly TaskDetail[];
  members: readonly TaskMember[];
  aiResearch: boolean;
  activity: boolean;
  port: TasksRequestPort;
  onOpenConversation?: (link: TaskConversation) => void;
}) {
  const zh = useIntl().locale.startsWith("zh");
  const text = (cn: string, en: string) => zh ? cn : en;
  const [ownerFilter, setOwnerFilter] = useState("");
  const candidates = aiResearch ? tasks.filter(isMorningResearchTask) : [];
  const ownerName = (id: string | null | undefined) => members.find(member => member.id === id)?.name ?? id ?? text("未分配", "Unassigned");
  const ownerIds = [...new Set(candidates.flatMap(task => task.assigneeId ? [task.assigneeId] : []))];
  // Keep a selected owner reachable if their last item disappears during refresh.
  if (ownerFilter.startsWith("member:") && !ownerIds.includes(ownerFilter.slice(7))) ownerIds.push(ownerFilter.slice(7));
  const reviewKey = JSON.stringify(candidates.filter(task => task.status === "in_review").map(task => [task.id, task.revision, task.latestProgress?.eventId]));
  const [reports, setReports] = useState<{ key: string; values: ReadonlyMap<string, ReadyResearchHandoff | null>; errors: ReadonlySet<string>; loading: boolean }>({ key: "", values: new Map(), errors: new Set(), loading: false });
  const [refresh, setRefresh] = useState(0);
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(timer); }, []);
  const reader = useMemo(() => ({ request: port.request }), [port.request]);
  useEffect(() => {
    let live = true;
    const ids = (JSON.parse(reviewKey) as Array<[string, number, string | undefined]>).map(row => row[0]);
    const values = new Map<string, ReadyResearchHandoff | null>(), errors = new Set<string>();
    setReports({ key: reviewKey, values, errors, loading: activity && ids.length > 0 });
    if (activity) void (async () => {
      let cursor = 0;
      await Promise.all(Array.from({ length: Math.min(4, ids.length) }, async () => {
        while (live && cursor < ids.length) {
          const id = ids[cursor++]!;
          try { values.set(id, await readResearchHandoff(reader, id)); } catch { errors.add(id); }
        }
      }));
      if (live) setReports({ key: reviewKey, values, errors, loading: false });
    })();
    return () => { live = false; };
  }, [reviewKey, activity, reader, refresh]);
  const checking = reports.loading || reports.key !== reviewKey;
  const unavailable = !activity || reports.errors.size > 0;
  const handoffFor = (task: TaskDetail) => reports.key === reviewKey ? reports.values.get(task.id) : undefined;
  // A triage-only decision is not evidence of prior AI work.
  const active = candidates.filter(task => (task.aiResearch === "proactive" || handoffFor(task)) &&
    (!ownerFilter || (ownerFilter === "unassigned" ? !task.assigneeId : task.assigneeId === ownerFilter.slice(7))));
  const decisions = active.filter(task => task.status === "in_review");
  const overdue = decisions.filter(task => { const report = handoffFor(task); return report && isOverdueHandoff(report, now); })
    .sort((a, b) => handoffFor(a)!.readyAt - handoffFor(b)!.readyAt);
  const waiting = decisions.filter(task => !overdue.includes(task));
  const running = active.filter(task => task.status === "in_progress");
  const queued = active.filter(task => task.status === "todo" || task.status === "backlog");
  const groups = [
    { id: "overdue", title: text("等待人判断 · 超过 72 小时", "Awaiting a decision · over 72 hours"), items: overdue, empty: text("暂无等待判断超过 72 小时的事项", "No decision has been waiting over 72 hours") },
    { id: "review", title: text("产出待判断", "Research to review"), items: waiting, empty: text("暂无待判断的 AI 预研产出", "No AI research output to review") },
    { id: "running", title: text("AI 预研中", "AI research in progress"), items: running, empty: text("暂无进行中的 AI 预研", "No AI research is in progress") },
    { id: "queued", title: text("已标定预研 · 待启动", "Marked for research · not started"), items: queued, empty: text("暂无待启动的 AI 预研", "No AI research is queued") },
  ];
  return <section className="tasks-ai-follow-up" aria-label={text("AI 跟进", "AI follow-up")}>
    <div className="tasks-ai-follow-up__intro">
      <p>{text("按 Owner 跟进 AI 预研、待决策事项与下一步协作", "Follow AI research and decisions by owner")}</p>
    </div>
    {aiResearch ? <div className="tasks-ai-follow-up__filters">
      <label><span>Owner</span><SettingsSelect aria-label={text("按 Owner 筛选", "Filter by owner")} value={ownerFilter} onChange={event => setOwnerFilter(event.target.value)}>
        <option value="">{text("所有 Owner", "All owners")}</option>
        <option value="unassigned">{text("未分配", "Unassigned")}</option>
        {ownerIds.map(id => <option key={id} value={`member:${id}`}>{ownerName(id)}</option>)}
      </SettingsSelect></label>
    </div> : null}
    <section className="tasks-ai-follow-up__brief" aria-label={text("AI 跟进汇总", "AI follow-up summary")}>
      <CircleHelp size={20} aria-hidden="true" />
      <div><h3>{text("当前跟进情况", "Current follow-up")}</h3>
        {aiResearch ? <div className="tasks-ai-follow-up__counts" aria-label={text("预研状态汇总", "Research status summary")}>
          <span><strong>{checking ? "—" : decisions.length}</strong>{text("待判断", "To review")}</span>
          <span className={overdue.length ? "tasks-ai-follow-up__count--warning" : undefined}><strong>{checking || unavailable ? "—" : overdue.length}</strong>{text("等待超过 72 小时", "Waiting over 72h")}</span>
          <span><strong>{running.length}</strong>{text("预研中", "Researching")}</span>
          <span><strong>{queued.length}</strong>{text("待启动", "Queued")}</span>
        </div> : null}
        <p>{aiResearch && checking ? text("正在核实 AI 预研交接记录…", "Checking AI research handoffs…") : aiResearch
          ? text(`已核实 ${overdue.length} 项等待判断超过 72 小时；${running.length} 项预研中，${queued.length} 项待启动。`, `Verified: ${overdue.length} decisions waiting over 72 hours; ${running.length} researching; ${queued.length} queued.`)
          : text("当前连接尚未提供预研分流，请恢复支持该能力的任务连接。", "Research triage is unavailable on this task connection.")}</p>
        <span>{text("仅从 AI 产出就绪并进入判断队列时开始计时。待启动、预研中不计时；待补充上下文由具体跟进人关注。", "Waiting starts when AI output is ready and enters review. Queued and running research do not count. Context requests stay with their owners.")}</span>
      </div>
    </section>
    {aiResearch ? <div className="tasks-ai-follow-up__groups">
      {unavailable && !checking ? <div role="status"><p>{text("部分交接记录暂不可用，超时统计尚不完整。", "Some handoffs are unavailable; overdue totals are incomplete.")}</p><SettingsButton variant="quiet" onClick={() => setRefresh(value => value + 1)}>{text("重新核实", "Retry")}</SettingsButton></div> : null}
      {groups.map(group => <section className="tasks-ai-follow-up__group" key={group.id} aria-label={group.title}>
        <div className="tasks-ai-follow-up__group-heading"><h3>{group.title}</h3><span>{group.items.length}</span></div>
        {!group.items.length ? <p className="tasks-ai-follow-up__empty">{(group.id === "overdue" || group.id === "review") && checking ? text("正在核实交接记录…", "Checking handoffs…") : (group.id === "overdue" || group.id === "review") && unavailable ? text("交接记录尚未核实完整", "Handoff checks are incomplete") : group.empty}</p> : <ul>
          {group.items.map(task => {
            const report = handoffFor(task);
            const ageHours = report ? Math.max(0, Math.floor((now - report.readyAt) / 3_600_000)) : 0;
            const wait = task.status === "in_review" ? report
              ? text(`等待判断 ${ageHours} 小时`, `Waiting for a decision: ${ageHours} hours`)
              : checking ? text("正在核实交接记录…", "Checking handoff…")
                : reports.errors.has(task.id) || !activity ? text("交接记录暂不可用 · 未计算时长", "Handoff unavailable · time not calculated")
                  : text("尚无有效交接 · 未开始计时", "No valid handoff · clock not started")
              : text("未开始人工等待计时", "Human wait clock not started");
            return <FollowUpTaskCard key={task.id} task={task} report={report} overdue={group.id === "overdue"}
              owner={ownerName(task.assigneeId)}
              wait={wait} zh={zh} onOpenConversation={onOpenConversation} />;
          })}
        </ul>}
      </section>)}
    </div> : null}
  </section>;
}


/** A compact decision summary; conversation navigation retains its existing owner. */
function FollowUpTaskCard({ task, report, overdue, owner, wait, zh, onOpenConversation }: {
  task: TaskDetail;
  report: ReadyResearchHandoff | null | undefined;
  overdue: boolean;
  owner: string;
  wait: string;
  zh: boolean;
  onOpenConversation?: (link: TaskConversation) => void;
}) {
  const text = (cn: string, en: string) => zh ? cn : en;
  const links = task.conversations;
  return <li className={`tasks-ai-follow-up__item${overdue ? " tasks-ai-follow-up__item--overdue" : ""}`} data-ai-follow-up-task-id={task.id}>
    <h4>{task.title}</h4>
    <dl className="tasks-ai-follow-up__handoff">
      <div className="tasks-ai-follow-up__decision"><dt>{text("待决策", "Decision needed")}</dt><dd>{report?.decision ?? text("暂无待决策项", "No decision requested")}</dd></div>
    </dl>
    <p className="tasks-ai-follow-up__wait"><Clock size={14} aria-hidden="true" />{wait}</p>
    <div className="tasks-ai-follow-up__item-footer"><div><span>Owner</span><span>{owner}</span></div>
      {!links.length ? <span className="tasks-ai-follow-up__unlinked">{text("未关联会话", "No linked conversation")}</span>
        : !onOpenConversation ? <span className="tasks-ai-follow-up__unlinked">{text("当前连接不支持打开会话", "Conversation navigation unavailable")}</span>
        : links.length === 1 ? <SettingsButton variant="secondary" onClick={() => onOpenConversation(links[0]!)} aria-label={text(`打开会话：${task.title}`, `Open conversation: ${task.title}`)}>
          {text("打开会话", "Open conversation")}<ArrowUpRight size={16} aria-hidden="true" />
        </SettingsButton> : <DropdownMenu.Root><DropdownMenu.Trigger asChild>
          <SettingsButton variant="secondary" aria-label={text(`选择关联会话：${task.title}`, `Choose conversation: ${task.title}`)}>{text("打开会话", "Open conversation")} ({links.length})<ArrowUpRight size={16} aria-hidden="true" /></SettingsButton>
        </DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content className="tasks-card-menu" sideOffset={4}>
          {links.map((link, index) => <DropdownMenu.Item key={JSON.stringify([link.serverId, link.threadId])} onSelect={() => onOpenConversation(link)}>{text(`关联会话 ${index + 1}`, `Linked conversation ${index + 1}`)}</DropdownMenu.Item>)}
        </DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>}
    </div>
  </li>;
}
