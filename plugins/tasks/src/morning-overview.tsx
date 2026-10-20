import { Users, Activity, Boxes, Send, ArrowUpRight, CircleHelp } from "lucide-react";
import { SettingsButton } from "@opencraft/extension-react";
import { useIntl } from "@opencraft/i18n/react";
import type { TaskDetail, TaskMember } from "@opencraft/appserver-protocol";
import "./morning-overview.scss";

/** Read-only projection of the task authority; triage never implies an AI handoff. */
export function MorningOverview({ tasks, members, aiResearch, onOpen }: {
  tasks: readonly TaskDetail[];
  members: readonly TaskMember[];
  aiResearch: boolean;
  onOpen(task: TaskDetail): void;
}) {
  const zh = useIntl().locale.startsWith("zh");
  const text = (cn: string, en: string) => zh ? cn : en;
  const active = tasks.filter(task => task.status !== "done" && task.status !== "canceled");
  const decisions = aiResearch ? active.filter(task => task.aiResearch === "needs_decision") : [];
  const context = aiResearch ? active.filter(task => task.aiResearch === "needs_context") : [];
  const proactive = aiResearch ? active.filter(task => task.aiResearch === "proactive") : [];
  const unassessed = aiResearch ? active.filter(task => !task.aiResearch || task.aiResearch === "unassessed") : [];
  const metrics = [
    { label: text("用户规模", "Users"), icon: Users, hint: text("累计用户与新增趋势", "Total users and growth") },
    { label: text("活跃用户", "Active users"), icon: Activity, hint: text("日活与近期活跃趋势", "Daily activity and recent trends") },
    { label: text("库存水位", "Instance inventory"), icon: Boxes, hint: text("可分配实例与地域分布", "Available instances by region") },
    { label: text("投稿水位", "Submission level"), icon: Send, hint: text("统计口径与数据待补充", "Definition and data to be added") },
  ];
  const groups = [
    { id: "decision", title: text("需要人判断", "Needs a decision"), items: decisions, empty: text("当前没有标记为需人判断的事项", "No items are marked as needing a decision") },
    { id: "context", title: text("需要补充上下文", "Needs context"), items: context, empty: text("当前没有标记为缺少上下文的事项", "No items are marked as needing context") },
  ];
  return <section className="tasks-morning" aria-label={text("晨会总览", "Morning overview")}>
    <div className="tasks-morning__intro">
      <p>{text("产品运行情况与 AI 推进卡点", "Product health and what AI needs to move forward")}</p>
      <span>{text("全看板 · 不受列表筛选影响", "Whole board · independent of browse filters")}</span>
    </div>
    <section className="tasks-morning__metrics" aria-label={text("产品核心数据", "Core product metrics")}>
      {metrics.map(({ label, icon: Icon, hint }) => <section className="tasks-morning__metric" key={label} aria-label={label}>
        <div><Icon size={18} aria-hidden="true" /><h3>{label}</h3></div>
        <p className="tasks-morning__metric-value">{text("待补充", "To be added")}</p>
        <span>{hint}</span>
      </section>)}
    </section>
    <section className="tasks-morning__brief" aria-label={text("晨会简报", "Morning brief")}>
      <CircleHelp size={20} aria-hidden="true" />
      <div><h3>{text("今天，哪些事项需要人推动？", "What needs human attention today?")}</h3>
        <p>{aiResearch
          ? text(`现有预研分流中，${decisions.length} 项需人判断，${context.length} 项需补充上下文。`, `Research triage: ${decisions.length} need a decision; ${context.length} need context.`)
          : text("当前连接尚未提供预研分流，请恢复支持该能力的任务连接。", "Research triage is unavailable on this task connection.")}</p>
        <span>{text("以下依据来自事项的预研判断。阶段产出与有效交接尚未接入，等待时长待补充。", "Based on recorded research assessments. Stage outputs and decision-ready handoffs are not connected yet; waiting times will be added.")}</span>
      </div>
    </section>
    {aiResearch ? <div className="tasks-morning__groups">
      {groups.map(group => <section className="tasks-morning__group" key={group.id} aria-label={group.title}>
        <div className="tasks-morning__group-heading"><h3>{group.title}</h3><span>{group.items.length}</span></div>
        {!group.items.length ? <p className="tasks-morning__empty">{group.empty}</p> : <ul>
          {group.items.map(task => <li className="tasks-morning__item" key={task.id} data-morning-task-id={task.id}>
            <div className="tasks-morning__item-heading"><h4>{task.title}</h4><SettingsButton variant="quiet" aria-label={`${text("查看事项", "Open item")}: ${task.title}`} onClick={() => onOpen(task)}><ArrowUpRight size={16} aria-hidden="true" />{text("查看事项", "Open item")}</SettingsButton></div>
            <p>{task.aiResearchReason || text("判断依据待补充", "Assessment rationale to be added")}</p>
            <div className="tasks-morning__item-footer"><span>{text("负责人", "Assignee")} · {task.assigneeId ? members.find(member => member.id === task.assigneeId)?.name ?? task.assigneeId : text("未分配", "Unassigned")}</span><span>{text("等待时长 · 待补充", "Waiting time · to be added")}</span></div>
          </li>)}
        </ul>}
      </section>)}
      <details className="tasks-morning__pool"><summary>{text(`可主动预研 ${proactive.length} 项 · 尚未判断 ${unassessed.length} 项`, `Ready for research: ${proactive.length} · Unassessed: ${unassessed.length}`)}</summary>
        <p>{text("可主动预研表示上下文足够，不代表 AI 已开始或已完成。没有负责人也可以先开展预研。", "Ready means enough context exists; it does not mean AI has started or finished. Research can begin without an assignee.")}</p>
        {[...proactive, ...unassessed].map(task => <SettingsButton key={task.id} variant="quiet" onClick={() => onOpen(task)}>{task.title}<ArrowUpRight size={14} aria-hidden="true" /></SettingsButton>)}
      </details>
    </div> : null}
  </section>;
}
