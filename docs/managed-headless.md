# 受管 Headless 与独立 Codex core

本方式保留 Headless 的下游 Host/HTTP/WS 语义，core 只承载原生 Codex CLI 和账户维护。
独立网站和版本化 Headless execution 通过同一更新事务切换；DSH 引擎、core 与 CLI 独立维护。
首次迁移必须停止旧内嵌 writer 后才能打开其原 Codex 目录；有活动任务时继续准备，等待自然结束。

## 所有权

| 资源 | 唯一 owner | 生命周期 |
|---|---|---|
| 原生 CLI、account-pool、OAuth、账户代理 | core | 网站/Headless 断开不终止原 turn |
| Host queue、sender、企业身份、Bot、附件、私有 Tasks、pins 投影 | Headless 的 CodexEngineAdapter | 原生 transport 只提供帧，不绕过 overlay；实例关闭释放存储 |
| DSH、agent 目录、执行 journal 与公共 Tasks | 内嵌 Local Agent，或显式配置的独立 DSH Host | 独立 Host 不随 Web/execution 更新停止 |
| SSH management/SSH Host、employee/speech 路由 | Headless | 沿用私有配置、Host/凭据/域名身份 |
| Web worker、历史静态 assets、update job | 稳定启动器 | 旧 WebSocket/worker 保留至断开；事务不依赖页面 |

显式 `coreHostOverlays` 使用 raw native Unix WebSocket，沿原 CodexEngineAdapter 执行
connect/send/subscribe/close。原纯 core bridge 和未选择 core 的默认方式保持独立，不能用
纯 bridge 的早返回代替 Headless overlay。账户 RPC 单次转发给认证 control socket；原生请求
由 Host 映射 ID、保留 client epoch、订阅/queue/goal/Bot 处理，结果未知不重放。

core 的数据目录 guard 与 overlay 的 `host-overlays-owner` guard 独立，均复用内核持有的
SQLite EXCLUSIVE 锁，进程退出释放。Headless 的安装级 server.lock 仍保护整个数据根。
Headless startup 通过已有 AppHost owner 完成一次内部 initialize 并释放临时逻辑连接，
使 queue/Goal 的恢复不依赖浏览器首次重连；初始化失败不开放正式 listener。
该连接不拥有队列、账户或额外存储。首次切换检查旧 CLI/任务；旧二进制未使用新 guard 不能当作自动排空。关闭 overlay 只关闭
其原生连接与 stores，不关闭 core。复用数据/项目 cwd，不从包目录推导身份。

## Codex Bot 来源与迁移

恢复依据为 join runtime SHA256
`ac9737d51dfe4b5b9896f9de96070f5a69b115f71c7fdad1d5fe7217d6877686` 中的
CodexBotBridge 与存活的早期 TypeScript。早期源只有 rooms/commands；最终部署中的
native/cwd/draft、message slots 与恢复分支从可定位 bundle 重建，不能称为完整原提交恢复。
该 JavaScript 模块配独立 TypeScript contract，未知 wire 输入在业务边界收窄。

Bot 借用唯一 CodexHostStateDatabase 的连接，不自行 CREATE/ALTER 或关闭连接。v1 SQL/name/checksum
保留，v2 追加三表；无账本的已知完整结构采纳，已知早期列序/缺列转换在同一事务中规范化并
保留记录。只接受有来源证据的对象与约束，未知表/索引/DDL拒绝，不移开重建。rooms 维护稳定
逻辑/native/cwd/draft 映射；commands 保存 admission fingerprint/receipt，未确认结果禁止重复提交；
slots 持久分配稳定消息 ID。原生 transcript 仍是会话历史 authority，不复制第二份正文。

代码回退不恢复 SQLite 数据。先在隔离副本证明实际旧 reader 接受升级后的库、继续保留
room/receipt/slot 语义，才能交付相应回退；不把备份存在当作任意旧版兼容证据。

## 回归边界

- connect 报告真实存储 outcome、拒绝第二 owner；账户 writer 仍由 core 独占。
- send 保留权限、summary、sender/企业身份、附件、Tasks、Bot receipt 与 unknown fence。
- subscribe 在 Host epoch 内恢复原 turn/queue/goal/approval，Bot slot 不变；不重放已确认或未知提交。
- close 释放 overlay/guard，core/CLI/原生工具继续；旧默认模式和不可用 core 的拒绝不回退为内嵌。
- 最终 Headless profile 的真实 systemd 安装、失败恢复、页面回退和启动器重启，分别核网站、执行、core。
- 真实目标的 Host/数据/私有路由与精确归档身份另验；隔离合成模型不证明 OAuth、付费推理或设备通知。

## 正式 profile 与入口

归档 `opencraftExecution.profile=headless` 以及 Web `headlessServer/headlessHostId` 必须匹配。
支持独立 DSH Host 的归档另声明 `opencraftExecution.independentDshHost=1`。配置独立 Host 时，
安装、启动恢复和页面回退均在启动 payload 前核验此能力；切换候选前也核验当前 execution
指针的回退基线。旧包不会因同为 profile v1 而获准打开 agent 数据。
新版 gateway 入口也在读取运行配置前检查该标识；此检查不能追溯改变旧二进制，手工启动
真正的旧包仍须先排空并停止独立 Host，不能绕过受管流程直接改指针。
部署设置 `OPENCRAFT_EXECUTION_PROFILE=headless` 后拒绝普通 daemon payload，不以字段缺失自动回退。
Headless 独立 unit 使用版本化 `execution/gateway.mjs`；`OPENCRAFT_HEADLESS_CONFIG` 是同 uid 0600
JSON 文件，仅包含 `argv` 字符串数组，解析沿既有 Headless 命令契约。配置保留数据根/公网 admission、
SSH/员工配置；`OPENCRAFT_RUNTIME_DIRECTORY`、`OPENCRAFT_DSH_EXECUTABLE`、`OPENCRAFT_CODEX_EXECUTABLE`
固定既有引擎位置。core socket/token 通过原正式变量传入，token 不在归档或网页配置中。

稳定 Web 设置 `OPENCRAFT_HEADLESS_BACKEND_URL=http://127.0.0.1:PORT`，Headless HTTP/WS 路由
转发给独立 execution；静态资产、更新授权及事务归稳定 Web。若原部署含 SSH/HTTP 复用，
`OPENCRAFT_HEADLESS_SSH_TARGET` 指向同一 Headless loopback origin，稳定入口按 HTTP/SSH
前缀透明分流，不认证、不改写 forwarded headers、不允许其他协议进入后端。
Headless 的 `--ssh-config ABSOLUTE_PRIVATE_JSON` 保留原 host key、公钥 principal 与限定
Codex desktop/proxy recipes；不能替换成 `--ssh-servers`（后者是出站连接目录）。
协议分流不授予 SSH 访问权；认证仍在 Headless，shell/PTY/subsystem/tcpip 不开放。

恢复来源为 live `ssh-http-ingress-desktop-v3.mjs` 的三个具名源边界与
`ssh-native-rpc-gateway.mjs` 的末尾业务函数，第三方 ws bundle 没有导入。
当前 JavaScript 分成入口与命令解析模块，原 TS 完整提交尚不可证实；receipt 记录原文件 hash。
SSH2 固定现网依赖 1.17.0，归档带当前 checkout 安装的必要 JavaScript 依赖闭包，不借远端 node_modules。
不携带可选 CPU/crypto native 加速器，使用 SSH2 自带 Node crypto 路径；实际密码握手另验。

网站更新保留旧 worker/WS lease；执行更新会断开 Headless HTTP/WS 和 SSH channel，客户端重连。
独立 core 中原生 turn 的继续完成须实测。默认内嵌 DSH 跟随 execution cgroup；
配置独立 DSH Host 后，DSH 原生 turn 也不随 execution 事务停止。
首次入口维护仍有断线窗口；core、CLI、DSH 引擎升级不由网站事务隐式执行。


## 受管站点更新源

稳定运行的 `runtime/controlled-registry.mjs` 只监听 loopback，以 `OPENCRAFT_RELEASE_CATALOG`
指定同 uid 0600 的 JSON：`schemaVersion:1`、`channel:"managed-headless"`、`selected:精确版本`、
`releases:[{version,buildId,archive:绝对归档路径,integrity:sha512-SRI}]`。维护者从已验证的下游
clean 源码构建完整 headless 归档，保留精确身份，原子替换 catalog；服务不发布公共 npm 包。
归档下载前再次校验目录中的字节与 integrity；网页沿正式 npm check/install 协议核验精确归档。
Web unit 配置 `OPENCRAFT_NPM_REGISTRY=http://127.0.0.1:PORT/` 与
`OPENCRAFT_UPDATE_CHANNEL=managed-headless`。不存在公共 latest fallback；目录暂不可用时安装不切换。
源代码升级脚本根据正式 status 中的 execution profile 选择 Headless 构建与归档，再走认证
install-local 事务。该流程仍要求 pinned bootstrap 已支持本 profile；首次启动器维护单独进行。


## 独立 DSH Host

`execution/dsh-host.mjs` 独立持有整个 Local Agent Host：DSH 进程、路由、SQLite、执行
journal、capability bridge、项目与模型服务一起保持运行。不能只配置 `OPENCRAFT_DSH_URL`，
否则 Host 更新仍会丢失执行代次和动态能力的所有者。

首次迁移先等待原生任务自然结束，停止旧内嵌 writer，再启动独立 unit；不要同时打开同一
agent 目录。使用固定候选包路径与实际 Node 路径安装 `opencraft-dsh-host.service`，不能指向
随网站更新移动的 execution-current。该 unit 与网站/execution 无 PartOf、BindsTo、Conflicts
或 stop propagation。DSH 引擎依赖同样安装到固定路径，不从可变源码目录加载插件。

跨入此迁移边界时，先停止稳定 Web 与 execution，在新的 `OPENCRAFT_WEB_STATE` 中以兼容
归档作为 `OPENCRAFT_WEB_RELEASE` 建立 current（初始 previous 为空），并使用该部署目录下
尚不存在的 `OPENCRAFT_EXECUTION_LINK`；继续复用原 Headless 数据根与 machine-id。
保留旧部署状态用于排空后的维护回退。不要在旧 current 仍指向内嵌包时启用独立 Host；
正常更新会拒绝该不兼容回退基线。新部署后续 previous 也只能指向声明独立 Host 能力的包。

独立 Host、execution 与稳定 Web 模板均使用 `User=opencraft`，须保持同一稳定 uid 运行，
以便读取私有 descriptor。Host unit 创建 `/run/opencraft-dsh-host`，权限 0700，descriptor
为 0600；部署前将数据根、模型目录和工作目录交给该用户，配置文件也必须属于该用户。
稳定 Web 的部署状态、归档和 npm 配置须对该用户可用，并沿
[Web 部署权限](web-deployment.md#服务器执行端更新) 配置仅重启指定 execution unit 的
systemd/Polkit 授权。迁移前读取现网三个 unit 的 `User`、目录与文件所有者；模板变化不会
自动修改已经安装的服务，不可只改变 Host 的 uid 后直接启用 descriptor。

`OPENCRAFT_DSH_HOST_CONFIG` 指向同 uid、0600 JSON，配置包含：

```json
{
  "descriptorPath": "/run/opencraft-dsh-host/connection.json",
  "dataDirectory": "/var/lib/opencraft/agent",
  "machineIdentityDirectory": "/var/lib/opencraft",
  "modelStorageDirectory": "/var/lib/opencraft/models",
  "projectStorageDirectory": "/var/lib/opencraft/projects",
  "projectlessWorkspaceDirectory": "/var/lib/opencraft/workspaces",
  "skillsDirectory": "/var/lib/opencraft/skills",
  "runtimeDirectory": "/srv/opencraft",
  "dshExecutable": "/opt/opencraft-dsh-runtime/node_modules/@deepseek-ai/dsh/lib/bin.js",
  "dshCapabilityPlugin": "/opt/opencraft-dsh-host/execution/dsh-capability-plugin.mjs",
  "speechModelManagement": true
}
```

`machineIdentityDirectory` 指向原 Headless 的数据根，复用其 machine-id；默认是 agent
目录的父目录，也可显式传入原 machineIdentity。execution 校验原 machineId 一致。
独立 Host 复用 agent 存储 owner claim，拒绝第二
writer，启动后原子写入私有 descriptor；不把含连接令牌的 descriptor 放进日志或归档。
execution 与稳定 Web unit 同时设置 `OPENCRAFT_DSH_HOST_DESCRIPTOR`，稳定 Web 另设置
`OPENCRAFT_DSH_HOST_UNIT=opencraft-dsh-host.service`。execution 验证 descriptor 的数据目录
与自身 agent 目录一致，连接存活的 Host；关闭 execution 仅释放连接。更新事务检查服务
cgroup/停止传播，并核对更新前后 Host/DSH PID，拒绝把被重启的引擎当作连续更新。
日常健康检查读取当前 ready Host/引擎身份，不把启动时 PID 当永久基线。每次 `/appserver`
连接重新校验 descriptor 的 uid、权限、数据目录、machineId 和 health；Host 故障恢复后即使
端口/token 改变，同一网关也能接受重连。Host 暂不可用时返回 503，不打开第二个内嵌 writer。

`npm run smoke:dsh-continuity` 使用真实 DSH 和本地合成模型，在无项目新建任务后执行一次
原生 bash，替换网关，再验证原 turn 完成、工具只运行一次、模型请求不重放且引擎 PID 不变。
同一隔离测试另验证杀死引擎后的健康恢复，以及 Host 关闭/重开后同一 Web 网关读取原会话。
浏览器提供的动态工具仍在连接断开时撤销；不能把原生任务连续性扩大为已断开客户端工具
仍可调用。DSH Host、插件或引擎自身升级单独排空维护，不在网站一键更新中隐式重启。

## 企业 npm 更新源

下游产品的 CI 脚本可在本机部署健康验证后，将同一精确归档发布至企业 npm 的
`managed-headless` channel；配置、重试与其他环境设置由下游产品 CI 维护。
这与历史 loopback catalog 是两种显式来源；迁移时设置 registry/channel/userconfig，
保留原 catalog 与服务作为回退，不做公共 latest fallback。

## 固定旧部署的历史恢复工具

原2026-10-14 受管站点 SSH owner仅接受v1账本。正式owner的v2只设置同一
`PRAGMA user_version=1`，不改变连接表或凭据语义，但原未修改旧入口仍拒绝两行账本。
因此不能将它直接列作迁移后的可用回退，也不能删除v2记录或恢复旧数据库来绕过检查。

首次维护可用 `node --import tsx scripts/recovery/prepare-join-legacy-fallback.ts INPUT OUTPUT`
在同一checkout构建一个明确标识的兼容旧入口。工具只接受固定旧bundle SHA256、其唯一
SSH owner检查位置及与正式 `SSH_CONNECTION_MIGRATIONS` 相同的v1 schema；v2必须仍为
已发布的纯user_version维护语句。生成物只补该单一旧owner对精确已知v1/v2名字和checksum
的接受，保留原schema检查、事务、加密密钥及读写行为。未知源、checksum、迁移或未来版本
拒绝；不打开数据库、不修改迁移账本、不引入第二writer。输出新文件且拒绝覆盖输入或已有文件。

原bundle、生成物和含实际路径的回退配置都保留在部署私有证据，不进入Git；正常启动和后续
受管更新不运行生成器。只有该固定历史入口需要此恢复工具，旧部署回退保留期结束后可移除。
维护前应在真实隔离副本完成旧→新→兼容旧完整入口启动和必要读取，核记录/账本digest，
将生成物精确hash和兼容入口配置纳入快照。回退时指向经审查的兼容产物并保留当前数据，
准确称“兼容旧版回退”，不能称原未修改旧binary接受新账本。
