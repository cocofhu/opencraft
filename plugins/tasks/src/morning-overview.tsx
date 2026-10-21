import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Users, Activity, Boxes, Send, ArrowRight, ChevronDown, ChevronUp, Clock, CircleHelp } from "lucide-react";
import { SettingsButton } from "@opencraft/extension-react";
import { useIntl } from "@opencraft/i18n/react";
import type { TaskDetail, TaskMember, TasksRequestPort } from "@opencraft/appserver-protocol";
import { isMorningResearchTask, isOverdueHandoff, readResearchHandoff, type ReadyResearchHandoff } from "./research-handoff";
import "./morning-overview.scss";

/** Read-only projection of the task authority; triage never implies an AI handoff. */
export function MorningOverview({ tasks, members, aiResearch, activity, port, onOpen }: {
  tasks: readonly TaskDetail[];
  members: readonly TaskMember[];
  aiResearch: boolean;
  activity: boolean;
  port: TasksRequestPort;
  onOpen(task: TaskDetail): void;
}) {
  const zh = useIntl().locale.startsWith("zh");
  const text = (cn: string, en: string) => zh ? cn : en;
  const candidates = aiResearch ? tasks.filter(isMorningResearchTask) : [];
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
  const active = candidates.filter(task => task.aiResearch === "proactive" || handoffFor(task));
  const decisions = active.filter(task => task.status === "in_review");
  const overdue = decisions.filter(task => { const report = handoffFor(task); return report && isOverdueHandoff(report, now); })
    .sort((a, b) => handoffFor(a)!.readyAt - handoffFor(b)!.readyAt);
  const waiting = decisions.filter(task => !overdue.includes(task));
  const running = active.filter(task => task.status === "in_progress");
  const queued = active.filter(task => task.status === "todo" || task.status === "backlog");
  const metrics = [
    { label: text("用户规模", "Users"), icon: Users, hint: text("累计用户与新增趋势", "Total users and growth") },
    { label: text("活跃用户", "Active users"), icon: Activity, hint: text("日活与近期活跃趋势", "Daily activity and recent trends") },
    { label: text("库存水位", "Instance inventory"), icon: Boxes, hint: text("可分配实例与地域分布", "Available instances by region") },
    { label: text("投稿水位", "Submission level"), icon: Send, hint: text("统计口径与数据待补充", "Definition and data to be added") },
  ];
  const groups = [
    { id: "overdue", title: text("等待人判断 · 超过 72 小时", "Awaiting a decision · over 72 hours"), items: overdue, empty: text("暂无等待判断超过 72 小时的事项", "No decision has been waiting over 72 hours") },
    { id: "review", title: text("产出待判断", "Research to review"), items: waiting, empty: text("暂无待判断的 AI 预研产出", "No AI research output to review") },
    { id: "running", title: text("AI 预研中", "AI research in progress"), items: running, empty: text("暂无进行中的 AI 预研", "No AI research is in progress") },
    { id: "queued", title: text("已标定预研 · 待启动", "Marked for research · not started"), items: queued, empty: text("暂无待启动的 AI 预研", "No AI research is queued") },
  ];
  return <section className="tasks-morning" aria-label={text("晨会总览", "Morning overview")}>
    <div className="tasks-morning__intro">
      <p>{text("产品运行情况与 AI 预研推进", "Product health and AI research progress")}</p>
      <span>{text("全看板 · 不受列表筛选影响", "Whole board · independent of browse filters")}</span>
    </div>
    <section className="tasks-morning__brief" aria-label={text("晨会简报", "Morning brief")}>
      <CircleHelp size={20} aria-hidden="true" />
      <div><h3>{text("今天，哪些事项需要人推动？", "What needs human attention today?")}</h3>
        {aiResearch ? <div className="tasks-morning__counts" aria-label={text("预研状态汇总", "Research status summary")}>
          <span><strong>{checking ? "—" : decisions.length}</strong>{text("待判断", "To review")}</span>
          <span className={overdue.length ? "tasks-morning__count--warning" : undefined}><strong>{checking || unavailable ? "—" : overdue.length}</strong>{text("等待超过 72 小时", "Waiting over 72h")}</span>
          <span><strong>{running.length}</strong>{text("预研中", "Researching")}</span>
          <span><strong>{queued.length}</strong>{text("待启动", "Queued")}</span>
        </div> : null}
        <p>{aiResearch && checking ? text("正在核实 AI 预研交接记录…", "Checking AI research handoffs…") : aiResearch
          ? text(`已核实 ${overdue.length} 项等待判断超过 72 小时；${running.length} 项预研中，${queued.length} 项待启动。`, `Verified: ${overdue.length} decisions waiting over 72 hours; ${running.length} researching; ${queued.length} queued.`)
          : text("当前连接尚未提供预研分流，请恢复支持该能力的任务连接。", "Research triage is unavailable on this task connection.")}</p>
        <span>{text("仅从 AI 产出就绪并进入判断队列时开始计时。待启动、预研中不计时；待补充上下文由具体跟进人关注。", "Waiting starts when AI output is ready and enters review. Queued and running research do not count. Context requests stay with their owners.")}</span>
      </div>
    </section>
    {aiResearch ? <div className="tasks-morning__groups">
      {unavailable && !checking ? <div role="status"><p>{text("部分交接记录暂不可用，超时统计尚不完整。", "Some handoffs are unavailable; overdue totals are incomplete.")}</p><SettingsButton variant="quiet" onClick={() => setRefresh(value => value + 1)}>{text("重新核实", "Retry")}</SettingsButton></div> : null}
      {groups.map(group => <section className="tasks-morning__group" key={group.id} aria-label={group.title}>
        <div className="tasks-morning__group-heading"><h3>{group.title}</h3><span>{group.items.length}</span></div>
        {!group.items.length ? <p className="tasks-morning__empty">{(group.id === "overdue" || group.id === "review") && checking ? text("正在核实交接记录…", "Checking handoffs…") : (group.id === "overdue" || group.id === "review") && unavailable ? text("交接记录尚未核实完整", "Handoff checks are incomplete") : group.empty}</p> : <ul>
          {group.items.map(task => {
            const report = handoffFor(task);
            const ageHours = report ? Math.max(0, Math.floor((now - report.readyAt) / 3_600_000)) : 0;
            const wait = task.status === "in_review" ? report
              ? text(`等待判断 ${ageHours} 小时`, `Waiting for a decision: ${ageHours} hours`)
              : checking ? text("正在核实交接记录…", "Checking handoff…")
                : reports.errors.has(task.id) || !activity ? text("交接记录暂不可用 · 未计算时长", "Handoff unavailable · time not calculated")
                  : text("尚无有效交接 · 未开始计时", "No valid handoff · clock not started")
              : text("未开始人工等待计时", "Human wait clock not started");
            return <MorningTaskCard key={task.id} task={task} report={report} overdue={group.id === "overdue"}
              owner={members.find(member => member.id === task.assigneeId)?.name ?? text("尚未承接", "Unassigned")}
              wait={wait} zh={zh} onOpen={onOpen} />;
          })}
        </ul>}
      </section>)}
    </div> : null}
    <section className="tasks-morning__metrics" aria-label={text("产品核心数据", "Core product metrics")}>
      {metrics.map(({ label, icon: Icon, hint }) => <section className="tasks-morning__metric" key={label} aria-label={label}>
        <div><Icon size={18} aria-hidden="true" /><h3>{label}</h3></div>
        <p className="tasks-morning__metric-value">{text("待补充", "To be added")}</p>
        <span>{hint}</span>
      </section>)}
    </section>
  </section>;
}


/** Presentation-only disclosure; the task and review workflow retain their existing owners. */
function MorningTaskCard({ task, report, overdue, owner, wait, zh, onOpen }: {
  task: TaskDetail;
  report: ReadyResearchHandoff | null | undefined;
  overdue: boolean;
  owner: string;
  wait: string;
  zh: boolean;
  onOpen(task: TaskDetail): void;
}) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const contentRef = useRef<HTMLDivElement>(null);
  const [canExpand, setCanExpand] = useState(false);
  useEffect(() => {
    if (expanded || !contentRef.current) return;
    const content = contentRef.current;
    const measure = () => setCanExpand(Array.from(content.querySelectorAll("dd, p")).some(field => field.scrollHeight > field.clientHeight + 1));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, [expanded, task.aiResearchReason, report]);
  const text = (cn: string, en: string) => zh ? cn : en;
  const reviewing = task.status === "in_review";
  const status = reviewing ? report ? text("待你判断", "Ready for review") : text("待核实交接", "Handoff unverified")
    : task.status === "in_progress" ? text("预研中", "Researching") : text("待启动", "Queued");
  return <li className={`tasks-morning__item${overdue ? " tasks-morning__item--overdue" : ""}`} data-morning-task-id={task.id}>
    <div className="tasks-morning__item-meta"><span className={`tasks-morning__status tasks-morning__status--${report ? "review" : "neutral"}`}>{status}</span>
      {reviewing ? <span className="tasks-morning__wait"><Clock size={14} aria-hidden="true" />{wait}</span> : null}
    </div>
    <h4>{task.title}</h4>
    <div ref={contentRef} id={contentId} className={`tasks-morning__content${expanded ? " is-expanded" : ""}`}>
      {report ? <dl className="tasks-morning__handoff">
        <div className="tasks-morning__decision"><dt>{text("需要你判断", "Your decision")}</dt><dd>{report.decision}</dd></div>
        <div><dt>{text("已完成的产出", "Research output")}</dt><dd>{report.output}</dd></div>
        <div><dt>{text("判断后下一步", "Next step after review")}</dt><dd>{report.nextStep}</dd></div>
      </dl> : <div className="tasks-morning__basis"><span>{text("预研依据", "Research basis")}</span><p>{task.aiResearchReason || text("预研依据待补充", "Research basis to be added")}</p></div>}
    </div>
    {canExpand ? <div className="tasks-morning__disclosure"><SettingsButton variant="quiet" aria-expanded={expanded} aria-controls={contentId} onClick={() => setExpanded(value => !value)}>
      {expanded ? text("收起摘要", "Collapse summary") : text("展开完整摘要", "Expand full summary")}{expanded ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
    </SettingsButton></div> : null}
    <div className="tasks-morning__item-footer"><div><span>{text("跟进人", "Owner")}</span><span>{owner}</span></div>
      <SettingsButton variant={reviewing && report ? "primary" : "secondary"} onClick={() => onOpen(task)} aria-label={text(`查看事项：${task.title}`, `Open task: ${task.title}`)}>
        {reviewing && report ? text("查看待判断事项", "Review details") : text("查看详情", "View details")}<ArrowRight size={16} aria-hidden="true" />
      </SettingsButton>
    </div>
    {!reviewing ? <span className="tasks-morning__clock-note">{wait}</span> : null}
  </li>;
}
