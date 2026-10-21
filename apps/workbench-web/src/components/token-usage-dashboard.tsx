import { useIntl } from "@opencraft/i18n/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { SettingsButton, SettingsNotice, SettingsPageHeader, SettingsSection, SettingsSelect, SettingsTextInput } from "@opencraft/extension-react";
import { TOKEN_USAGE_CONFIGURE, TOKEN_USAGE_QUERY, type TokenUsageSnapshot, type TokenUsageTurnDetail } from "@opencraft/appserver-protocol/token-usage";
import { useAppServerHosts } from "../runtime/appserver-runtime-context";
import { useWorkbenchPresentationActive } from "./workbench-presentation-activity";
import "./token-usage-dashboard.scss";

function today() { return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit"}).format(Date.now()); }
function before(days:number) {const date=new Date(today()+"T00:00:00Z");date.setUTCDate(date.getUTCDate()-days+1);return date.toISOString().slice(0,10);}
function formatCount(value:string,locale:string) {try{return new Intl.NumberFormat(locale).format(BigInt(value));}catch{return value;}}
function errorCode(error:unknown) { return error&&typeof error==="object"&&"code" in error ? error.code : null; }
/** Optional first-party page. The Settings route owns scrolling and geometry;
 * the Host owns collection even while this page is unmounted. */
export default function TokenUsageDashboard({hostId}:{hostId:string}) {
  const intl=useIntl();
  const {agentRuntimes,threadAttention}=useAppServerHosts();
  const readScope=useCallback(()=>threadAttention.getScope()??"anonymous",[threadAttention]);
  const accountScope=useSyncExternalStore(threadAttention.subscribe,readScope,readScope);
  return <TokenUsageDashboardView key={JSON.stringify([hostId,accountScope])} hostId={hostId} agentRuntimes={agentRuntimes} locale={intl.locale}/>;
}
export function TokenUsageDashboardView({hostId,agentRuntimes,locale="zh-CN"}:{hostId:string;agentRuntimes:ReturnType<typeof useAppServerHosts>["agentRuntimes"];locale?:string}) {
  const zh=locale.toLowerCase().startsWith("zh");
  const copy=(cn:string,en:string)=>zh?cn:en;
  const count=(value:string)=>formatCount(value,locale);
  const modelLabel=(key:string)=>formatModelLabel(key,copy);
  const stateLabel=(state:string)=>formatStateLabel(state,copy);
  const active=useWorkbenchPresentationActive();
  const subscribe=useCallback((listener:()=>void)=>agentRuntimes.subscribe(hostId,listener),[agentRuntimes,hostId]);
  const read=useCallback(()=>agentRuntimes.getSnapshot(hostId).phase,[agentRuntimes,hostId]);
  const connection=useSyncExternalStore(subscribe,read,read);
  const [from,setFrom]=useState(()=>before(7)),[through,setThrough]=useState(today);
  const [scope,setScope]=useState("self"),[actorId,setActor]=useState(""),[modelKey,setModel]=useState("");
  const [view,setView]=useState("threads"),[threadId,setThread]=useState("");
  const [snapshot,setSnapshot]=useState<TokenUsageSnapshot|null>(null),[error,setError]=useState<string|null>(null),[loading,setLoading]=useState(false);
  const [cursor,setCursor]=useState<string|null>(null),[refresh,setRefresh]=useState(0);
  const generation=useRef(0),revision=useRef(-1),inFlight=useRef(false);
  const page=useRef<HTMLDivElement>(null);
  const [reservedHeight,setReservedHeight]=useState<number>();
  const pendingScroll=useRef<{top:number;focusThread?:string}|null>(null);
  const summaryReturn=useRef<{top:number;cursor:string|null;thread:string}|null>(null);
  const viewport=()=>page.current?.closest<HTMLElement>(".settings-page__viewport")??null;
  const requestKey=JSON.stringify([hostId,from,through,scope,actorId,modelKey,view,threadId,connection]);
  const latestKey=useRef(requestKey);latestKey.current=requestKey;
  const [displayKey,setDisplayKey]=useState(requestKey);
  const visible=snapshot&&displayKey===requestKey?snapshot:null;
  useEffect(()=>{
    const epoch=++generation.current;revision.current=-1;setSnapshot(null);setError(null);
    setDisplayKey(requestKey);inFlight.current=false;
    return()=>{if(generation.current===epoch)generation.current++;};
  },[requestKey]);
  useEffect(()=>{
    if(!active)return;
    const epoch=generation.current, key=requestKey;
    let live=true;
    const load=async()=>{
      if(!live||inFlight.current)return;
      inFlight.current=true;setLoading(true);
      try{
        const result=await agentRuntimes.request(hostId,TOKEN_USAGE_QUERY,{from,through,scope,...(scope==="team"&&actorId?{actorId}:{}),...(modelKey?{modelKey}:{}),view:threadId?"turns":view,...(threadId?{threadId}:{}),...(cursor?{cursor}:{}),limit:50});
        if(!live||epoch!==generation.current||latestKey.current!==key)return;
        if(result.snapshotRevision<revision.current)return;
        revision.current=result.snapshotRevision;setSnapshot(result);setDisplayKey(key);setError(null);
      }catch(cause){
        if(!live||epoch!==generation.current||latestKey.current!==key)return;
        const code=errorCode(cause);
        if(code===401||code===403){setSnapshot(null);setError(code===401?copy("请登录后查看用量。","Sign in to view usage."):copy("当前身份无权查看此范围。","You cannot view this usage scope."));}
        else if(code===409){setCursor(null);setRefresh(n=>n+1);setError(copy("数据已更新，正在重取第一页。","Usage changed. Reloading the first page."));}
        else if(code===-32601){setSnapshot(null);setError(copy("此执行服务暂不支持 Token 统计。","This Host does not support token statistics."));}
        else setError(copy("刷新失败。显示的数据可能已过期，请重试。","Refresh failed. Displayed usage may be stale. Try again."));
      }finally{if(live&&epoch===generation.current){inFlight.current=false;setLoading(false);}}
    };
    void load();
    // A cursor represents one immutable revision. Refresh starts on page one.
    const timer=cursor?null:setInterval(()=>void load(),5000);
    return()=>{live=false;if(timer)clearInterval(timer);inFlight.current=false;};
  },[agentRuntimes,requestKey,hostId,from,through,scope,actorId,modelKey,view,threadId,cursor,refresh,active]);
  const configure=async(enabled:boolean)=>{
    if(loading)return;
    const epoch=generation.current,key=latestKey.current;
    const current=()=>epoch===generation.current&&key===latestKey.current;
    setLoading(true);
    try{
      await agentRuntimes.request(hostId,TOKEN_USAGE_CONFIGURE,{enabled});
      if(!current())return;
      setCursor(null);setRefresh(n=>n+1);
    }catch{if(current())setError(copy("计量设置未能保存，请重试。","Could not save collection settings. Try again."));}
    finally{if(current())setLoading(false);}
  };
  useLayoutEffect(()=>{
    if(reservedHeight!==undefined&&pendingScroll.current){
      const owner=viewport();if(owner)owner.scrollTop=pendingScroll.current.top;
    }
  },[requestKey,reservedHeight]);
  useLayoutEffect(()=>{
    if(!visible||loading||!pendingScroll.current)return;
    if(reservedHeight!==undefined){setReservedHeight(undefined);return;}
    const position=pendingScroll.current;pendingScroll.current=null;
    const owner=viewport();if(owner)owner.scrollTop=position.top;
    if(position.focusThread){
      const trigger=Array.from(page.current?.querySelectorAll<HTMLButtonElement>("button[data-usage-thread]")??[]).find(button=>button.dataset.usageThread===position.focusThread);
      trigger?.focus({preventScroll:true});
    }
  },[visible,loading,reservedHeight]);
  const change=(action:()=>void,nextCursor:string|null=null)=>{
    generation.current++;inFlight.current=false;
    setReservedHeight(page.current?.getBoundingClientRect().height);
    pendingScroll.current={top:viewport()?.scrollTop??0};
    setLoading(true);action();setCursor(nextCursor);
  };
  const openThread=(id:string)=>{
    summaryReturn.current={top:viewport()?.scrollTop??0,cursor,thread:id};
    change(()=>setThread(id));
  };
  const returnToSummary=()=>{
    const saved=summaryReturn.current;
    change(()=>setThread(""),saved?.cursor??null);
    if(saved)pendingScroll.current={top:saved.top,focusThread:saved.thread};
  };
  const range=(days:number)=>change(()=>{setFrom(before(days));setThrough(today());});
  const modelOptions=visible?.models??[];
  const details=visible?.view==="turns"?visible.rows as TokenUsageTurnDetail[]:null;
  return <div ref={page} className="token-usage__page" aria-busy={loading} style={{minHeight:reservedHeight}}>
    <SettingsPageHeader title={copy("Token 用量","Token usage")} description={copy("按轮次参与人均分 · 按轮次开始日统计 · Asia/Shanghai","Shared equally by turn participants \u00b7 Grouped by turn start date \u00b7 Asia/Shanghai")} />
    <SettingsSection title={copy("统计范围","Usage filters")} action={<SettingsButton disabled={loading} onClick={()=>{setCursor(null);setRefresh(n=>n+1);}}>{copy("刷新","Refresh")}</SettingsButton>}>
      <div className="token-usage__filters">
        <SettingsButton onClick={()=>range(7)}>{copy("近 7 日","Last 7 days")}</SettingsButton><SettingsButton onClick={()=>range(30)}>{copy("近 30 日","Last 30 days")}</SettingsButton>
        <label>{copy("开始日","From")}<SettingsTextInput type="date" value={from} max={through} onChange={e=>change(()=>setFrom(e.target.value))}/></label>
        <label>{copy("结束日","Through")}<SettingsTextInput type="date" value={through} min={from} onChange={e=>change(()=>setThrough(e.target.value))}/></label>
        <label>{copy("用量范围","Scope")}<SettingsSelect value={scope} onChange={e=>change(()=>{setScope(e.target.value);setActor("");})}><option value="self">{copy("我的用量","My usage")}</option>{visible?.canQueryTeam||scope==="team"?<option value="team">{copy("团队用量","Team usage")}</option>:null}</SettingsSelect></label>
        {scope==="team"?<label>{copy("人员 Actor ID","Person ID")}<SettingsTextInput value={actorId} placeholder={copy("全部人员","All people")} onChange={e=>change(()=>setActor(e.target.value))}/></label>:null}
        <label>{copy("模型","Model")}<SettingsSelect value={modelKey} onChange={e=>change(()=>setModel(e.target.value))}><option value="">{copy("全部模型","All models")}</option>{modelOptions.map(m=><option key={m.key} value={m.key}>{modelLabel(m.key)}</option>)}{modelKey&&!modelOptions.some(m=>m.key===modelKey)?<option value={modelKey}>{modelLabel(modelKey)}</option>:null}</SettingsSelect></label>
        <label>{copy("列表","View")}<SettingsSelect value={view} disabled={!!threadId} onChange={e=>change(()=>setView(e.target.value))}><option value="threads">{copy("会话汇总","Conversations")}</option><option value="turns">{copy("轮次明细","Turn details")}</option>{visible?.canQueryTeam?<option value="actors">{copy("人员汇总","People")}</option>:null}</SettingsSelect></label>
      </div>
    </SettingsSection>
    {error?<SettingsNotice role="alert">{error}</SettingsNotice>:null}
    {loading&&!visible?<p role="status">{copy("正在读取用量…","Loading usage\u2026")}</p>:null}
    {visible?<>
      <SettingsSection action={visible.canConfigure?<SettingsButton disabled={loading} onClick={()=>void configure(!visible.coverage.enabled)}>{visible.coverage.enabled?copy("暂停计量","Pause collection"):copy("启用计量","Enable collection")}</SettingsButton>:undefined} title={scope==="self"?copy("我的分摊用量","My allocated usage"):copy("团队用量","Team usage")} description={copy(`截至 ${new Date(visible.asOf).toLocaleString(locale)} · 修订 ${visible.snapshotRevision}`,`As of ${new Date(visible.asOf).toLocaleString(locale)} · Revision ${visible.snapshotRevision}`)}>
        {!visible.coverage.enabled?<SettingsNotice>{copy("计量已暂停，现有数据保留。","Collection is paused. Acquired usage is retained.")}</SettingsNotice>:null}
        {visible.coverage.partial?<SettingsNotice>{copy(`部分数据尚未齐全：${visible.coverage.missingUsage} 个轮次用量不完整，${visible.coverage.openGaps} 个未恢复缺口。`,`Partial coverage: ${visible.coverage.missingUsage} turns have incomplete usage; ${visible.coverage.openGaps} acquisition gaps remain open.`)}</SettingsNotice>:null}
        <dl className="token-usage__summary"><div><dt>Tokens</dt><dd>{count(visible.summary.tokens)}</dd></div><div><dt>{copy("轮次","Turns")}</dt><dd>{visible.summary.turns}</dd></div>{Object.entries(visible.summary.categories).map(([key,value])=><div key={key}><dt>{stateLabel(key)}</dt><dd>{count(value)}</dd></div>)}</dl>
        <p>{copy(`采集始于 ${new Date(visible.coverage.enabledAt).toLocaleString(locale)}。启用前已开始的轮次不补记。`,`Collection began ${new Date(visible.coverage.enabledAt).toLocaleString(locale)}. Earlier turns are excluded.`)}{visible.coverage.unknownModelTurns?copy(` ${visible.coverage.unknownModelTurns} 个轮次的模型身份未知。`,` ${visible.coverage.unknownModelTurns} turns have unknown model identity.`):""}</p>
      </SettingsSection>
      {visible.canQueryTeam&&visible.diagnostics?<SettingsSection title={copy("计量状态","Collection status")}>
        <p>{copy("最近成功采集","Last successful collection")}: {visible.diagnostics.lastSourceSuccessAt===null?copy("暂无成功记录","No successful collection yet"):new Date(visible.diagnostics.lastSourceSuccessAt).toLocaleString(locale)}</p>
        <details><summary>{copy("查看运行诊断","View runtime diagnostics")}</summary>
          <p>{copy("以下计数仅覆盖本次服务启动以来，不参与用量汇总；延迟为最近256次操作。","These process-local counters do not contribute to usage totals. Latencies cover the latest 256 operations.")}</p>
          <dl className="token-usage__summary">{Object.entries(visible.diagnostics.counts).map(([key,value])=><div key={key}><dt>{({collected:copy("采集","Collected"),corrected:copy("校正","Corrected"),deduplicated:copy("去重","Deduplicated"),excluded:copy("范围外","Excluded"),missing:copy("缺口","Gaps"),reconciled:copy("对账","Reconciled"),writeFailures:copy("落库失败","Write failures"),queryFailures:copy("查询失败","Query failures")} as Record<string,string>)[key]}</dt><dd>{count(String(value))}</dd></div>)}</dl>
          <p>{copy("落库延迟 p95","Write latency p95")}: {visible.diagnostics.writeLatency.p95Ms?.toFixed(1)??"—"} ms · {copy("查询延迟 p95","Query latency p95")}: {visible.diagnostics.queryLatency.p95Ms?.toFixed(1)??"—"} ms</p>
        </details>
      </SettingsSection>:null}
      <SettingsSection title={copy("每日用量","Daily usage")}>
        {visible.daily.length?<div className="token-usage__trend">{visible.daily.map(d=><div key={d.key}><time>{d.key}</time><meter min={0} max={1} value={ratio(d.tokens,visible.summary.tokens)} aria-label={`${d.key} ${count(d.tokens)} tokens`}/><span>{count(d.tokens)}</span></div>)}</div>:<p>{copy("该范围暂无计量记录。","No recorded usage in this range.")}</p>}
      </SettingsSection>
      <SettingsSection title={threadId?copy("会话的轮次明细","Conversation turn details"):view==="threads"?copy("会话汇总","Conversations"):view==="actors"?copy("人员汇总","People"):copy("轮次明细","Turn details")} action={threadId?<SettingsButton onClick={returnToSummary}>{copy("返回汇总","Back to summary")}</SettingsButton>:undefined}>
        {visible.rows.length===0?<p>{copy("该筛选范围暂无记录。","No records match these filters.")}</p>:details?<ol className="token-usage__rows">{details.map(t=><li key={t.turnId}><strong>{t.turnId}</strong><span>{new Date(t.startedAt).toLocaleString(locale)} · {stateLabel(t.allocationState)}</span><span>{copy(`分摊 ${count(t.allocatedTokens)} · 原始 ${t.rawTokens===null?"未知":count(t.rawTokens)} · ${t.participantCount} 人`,`Allocated ${count(t.allocatedTokens)} · Raw ${t.rawTokens===null?"Unknown":count(t.rawTokens)} · ${t.participantCount} participants`)}</span></li>)}</ol>:<ol className="token-usage__rows">{visible.rows.map(row=>"key" in row?<li key={row.key}>{view==="threads"?<SettingsButton data-usage-thread={row.key} onClick={()=>openThread(row.key)}>{row.key}</SettingsButton>:<strong>{row.key}</strong>}<span>{count(row.tokens)} tokens · {row.turns} {copy("轮","turns")}</span></li>:null)}</ol>}
        {visible.nextCursor?<SettingsButton onClick={()=>change(()=>{},visible.nextCursor)}>{copy("下一页","Next page")}</SettingsButton>:null}
        {cursor?<SettingsButton onClick={()=>change(()=>{})}>{copy("回到第一页","First page")}</SettingsButton>:null}
      </SettingsSection>
    </>:null}
  </div>;
}
function formatModelLabel(key:string,copy:(cn:string,en:string)=>string){try{const [provider,model]=JSON.parse(key);return `${provider??copy("未知提供方","Unknown provider")} / ${model??copy("未知模型","Unknown model")}`;}catch{return copy("未知模型","Unknown model");}}
function ratio(value:string,total:string){try{const n=BigInt(total);return n===0n?0:Number(BigInt(value)*10000n/n)/10000;}catch{return 0;}}
function formatStateLabel(state:string,copy:(cn:string,en:string)=>string){return ({settled:copy("已结算","Settled"),provisional:copy("暂定","Provisional"),pending:copy("待归属","Pending attribution"),system:copy("系统","System"),unknown:copy("未知","Unknown")} as Record<string,string>)[state]??state;}
