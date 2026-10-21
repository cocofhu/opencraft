import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { definitions, queryDefinitionRevision } from '../../packages/observability-query/index.mjs';
export async function generate(directory=dirname(fileURLToPath(import.meta.url))) {
  const root=resolve(directory,'provisioning');
  for(const sub of ['datasources','dashboards'])await mkdir(resolve(root,sub),{recursive:true});
  await writeFile(resolve(root,'datasources/default.yaml'),`apiVersion: 1\ndatasources:\n  - name: OpenCraft metrics\n    uid: opencraft-prometheus\n    type: prometheus\n    access: proxy\n    url: http://127.0.0.1:23302\n    isDefault: true\n    editable: false\n    jsonData:\n      httpMethod: POST\n      timeInterval: 15s\n  - name: OpenCraft diagnostics\n    uid: opencraft-loki\n    type: loki\n    access: proxy\n    url: http://127.0.0.1:23303\n    editable: false\n    jsonData:\n      maxLines: 500\n`);
  await writeFile(resolve(root,'dashboards/default.yaml'),`apiVersion: 1\nproviders:\n  - name: OpenCraft\n    orgId: 1\n    folder: OpenCraft\n    type: file\n    disableDeletion: true\n    allowUiUpdates: false\n    options:\n      path: /etc/grafana/provisioning/dashboards\n`);
  const panels=Object.entries(definitions).filter(([,d])=>d.promql).map(([name,d],i)=>({id:i+1,type:'timeseries',title:d.title,
    description:`${name}; ${d.kind}; ${queryDefinitionRevision}. Absence of samples does not establish health. Exact rolling domain gauges are evaluated at the selected timestamp; counters/histograms are estimates.`,
    gridPos:{x:i%2*12,y:Math.floor(i/2)*8,w:12,h:8},datasource:{type:'prometheus',uid:'opencraft-prometheus'},
    targets:[{refId:'A',expr:d.promql,legendFormat:'{{component}}{{operation}}{{method}}{{outcome}}{{engine}}{{stage}}',range:true}],fieldConfig:{defaults:{unit:d.unit==='seconds'?'s':d.unit==='bytes'?'bytes':'short'},overrides:[]}}));
  const extraY=Math.ceil(panels.length/2)*8;
  panels.push({id:90,type:'timeseries',title:'Process CPU cores (sampled)',gridPos:{x:0,y:extraY,w:12,h:8},datasource:{type:'prometheus',uid:'opencraft-prometheus'},targets:[{refId:'A',expr:'rate(opencraft_process_cpu_seconds_total[5m])',legendFormat:'{{component}}',range:true}]});
  panels.push({id:100,type:'logs',title:'Captured diagnostics (safe structured metadata)',gridPos:{x:0,y:extraY+8,w:24,h:10},datasource:{type:'loki',uid:'opencraft-loki'},targets:[{refId:'A',expr:'{service_name="opencraft"}',queryType:'range',maxLines:100}]});
  await writeFile(resolve(root,'dashboards/overview.json'),JSON.stringify({uid:'opencraft-overview',title:'OpenCraft platform monitoring',schemaVersion:39,version:1,editable:false,timezone:'utc',refresh:'30s',time:{from:'now-15m',to:'now'},tags:['opencraft',queryDefinitionRevision],panels},null,2)+'\n');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await generate(process.argv[2]);
