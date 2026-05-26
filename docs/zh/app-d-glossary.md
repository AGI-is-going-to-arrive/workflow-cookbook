# 附录 D · 术语表

> 本附录收录全书核心术语，**中英对照**，每条给一句定义 + 章节定位，便于随读随查。字段语义以 [附录 A · API 完整参考](#/zh/app-a) 为权威；行为依据见 [附录 E · 信源索引](#/zh/app-e)。
>
> 排列：先按主题分组（便于建立体系），组内大致按出现顺序；文末附 [D.9 字母序索引](#d9-字母序索引) 便于快速跳转。

---

## D.1 顶层概念

| 术语（中 / 英） | 定义 | 定位 |
|---|---|---|
| **Workflow / 工作流** | Claude Code 的多 agent 编排原语：用一段 JS 脚本确定性地派发、串联多个 subagent。特性昵称 **ultrawork**。 | [第 1 章](#/zh/p1-01) |
| **ultrawork** | Workflow 特性的昵称/触发关键词之一；消息中含此词可触发工作流。 | [附录 A · A.12](#/zh/app-a) |
| **确定性编排 / deterministic orchestration** | 由代码（而非模型自由发挥）决定「派几个 agent、按什么顺序、如何汇合」的编排方式，区别于纯提示词驱动。 | [第 2 章](#/zh/p1-02) |
| **subagent / 子智能体** | 由 `agent()` 派发的独立执行单元，拥有自己的上下文与真实工具权限；其「最终文本即返回值」。 | [第 1 章](#/zh/p1-01) |
| **主循环 / main loop** | 你正在对话的这个 Claude 会话；它发起 Workflow 工具调用，并与所有工作流**共享 token 预算池**。 | [第 9 章](#/zh/p2-09) |
| **CLAUDE_CODE_WORKFLOWS** | 门控环境变量；置 `1` 才启用 Workflow 特性。 | [附录 A · A.12](#/zh/app-a) |
| **CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS** | 关联的实验性标志（Agent Teams）；与 Workflow 同属实验能力族。 | [接地事实表](#/zh/p1-01) |
| **CLAUDE_CODE_SUBAGENT_MODEL** | 用户/CI 级环境变量；一旦设置，**覆盖一切 per-call `model`**（脚本里的 `opts.model`/`phases[].model` 被静默忽略）。实测本会话设为 `claude-opus-4-7[1m]`，5 个带不同 model 选项的 agent 全跑 Opus（Run `wf_9c94951d-58c`）。 | [附录 E · R4 模型解析记录](#/zh/app-e) |
| **ANTHROPIC_DEFAULT_HAIKU_MODEL / SONNET / OPUS** | 用户/CI 级环境变量；把对应**模型别名**整体重映射到指定模型。与 `CLAUDE_CODE_SUBAGENT_MODEL` 叠加构成「两层模型覆盖」——本会话两层都指向 Opus，故脚本 `model: 'haiku'` 实跑 Opus（Run `wf_e8cb23ff-829`）。 | [附录 A · A.4](#/zh/app-a) |

---

## D.2 调用与返回（WorkflowInput / WorkflowOutput）

| 术语（中 / 英） | 定义 | 定位 |
|---|---|---|
| **WorkflowInput** | 调用 Workflow 工具的入参接口，含 `script`/`name`/`args`/`scriptPath`/`resumeFromRunId`。 | [附录 A · A.1](#/zh/app-a) |
| **WorkflowOutput** | Workflow 工具的返回接口（**回执**，非结果），含 `status`/`taskId`/`runId` 等。 | [附录 A · A.2](#/zh/app-a) |
| **script** | 自包含脚本字符串；**必须**以纯字面量 `export const meta = {…}` 开头。 | [附录 A · A.1](#/zh/app-a) |
| **name / 具名工作流** | 预定义工作流名（内置或 `.claude/workflows/`），解析为一段脚本；常配 `args` 参数化。 | [附录 A · A.1](#/zh/app-a) |
| **scriptPath** | 磁盘脚本路径；**优先级最高**，每次调用都会落盘，便于 Write/Edit 后重跑。 | [附录 A · A.1](#/zh/app-a) |
| **status** | 回执状态，**仅** `"async_launched"` 或 `"remote_launched"` 两种。 | [附录 A · A.2](#/zh/app-a) |
| **async_launched / remote_launched** | 前者本地异步启动；后者远端（CCR）启动，无 `runId`、用 `sessionUrl` 作续传句柄。 | [附录 A · A.2](#/zh/app-a) |
| **taskId / 任务句柄** | 后台任务标识；用于追踪与停止（TaskStop）。 | [附录 A · A.2](#/zh/app-a) |
| **runId / 运行标识** | 本地运行标识（形如 `wf_…`）；`resumeFromRunId` 续传时使用；`remote_launched` 无。 | [附录 A · A.2](#/zh/app-a) |
| **resumeFromRunId / 断点续传** | 从某次运行续传：未改动的 `agent()` 调用返回缓存结果（零成本）；**仅同会话**。 | [第 22 章](#/zh/p4-22) |
| **transcriptDir** | subagent 执行记录目录（回执字段）。 | [附录 A · A.2](#/zh/app-a) |
| **sessionUrl** | `remote_launched` 时的 CCR session URL。 | [附录 A · A.2](#/zh/app-a) |
| **warning / error** | 回执里的非阻塞提示 / 语法检查失败信息；`error` 在启动前同步返回、不耗 token。 | [附录 A · A.2](#/zh/app-a) |
| **&lt;task-notification&gt; / 完成通知** | 工作流完成时送达的消息，内含**真正的返回值**与用量统计。 | [附录 A · A.2](#/zh/app-a) |

---

## D.3 脚本元数据与阶段

| 术语（中 / 英） | 定义 | 定位 |
|---|---|---|
| **meta** | 脚本导出的元数据常量，**必须纯字面量**；必填 `name`/`description`，可选 `whenToUse`/`phases`。 | [第 5 章](#/zh/p2-05) |
| **纯字面量 / pure literal** | 不含变量引用、函数调用、展开运算符、模板插值的字面值；`meta` 的硬性要求（运行时执行前静态读取）。 | [第 5 章](#/zh/p2-05) |
| **phase / 阶段** | 进度分组。全局 `phase(title)` 开启新阶段，其后 `agent()` 归入该组；标题与 `meta.phases[].title` 精确匹配。 | [第 5 章](#/zh/p2-05) |
| **phases（meta 字段）** | `{ title, detail?, model? }[]`，声明式列出工作流的阶段。 | [附录 A · A.4](#/zh/app-a) |
| **whenToUse** | `meta` 可选字段，描述适用场景，显示在工作流列表。 | [附录 A · A.4](#/zh/app-a) |
| **log / 进度叙述** | `log(message)` 向用户输出一行进度叙述（进度树上方）。 | [第 9 章](#/zh/p2-09) |
| **/workflows** | 查看工作流实时进度的斜杠命令。 | [附录 A · A.12](#/zh/app-a) |

---

## D.4 核心原语：agent / parallel / pipeline

| 术语（中 / 英） | 定义 | 定位 |
|---|---|---|
| **agent() / 派发智能体** | `agent(prompt, opts?) → Promise`：派一个 subagent。无 `schema` 返回文本；有 `schema` 返回已验证对象；用户跳过返回 `null`。 | [第 6 章](#/zh/p2-06) |
| **parallel() / 并发屏障** | `parallel(thunks) → Promise<any[]>`：并发执行一组 **thunk**，**屏障**等全部完成；结果顺序=输入顺序；异步失败变 `null`，但 thunk 体内同步 `throw` 会 reject 整个调用。 | [第 8 章](#/zh/p2-08) |
| **pipeline() / 流水线** | `pipeline(items, stage1, …) → Promise<any[]>`：每个 item **独立**流过全部 stage，**阶段间无屏障**；某 stage 抛错使该 item 变 `null` 并跳过其余 stage。**多阶段默认用它**。 | [第 8 章](#/zh/p2-08) |
| **屏障 / barrier** | 同步点：必须等一批任务**全部完成**才继续。`parallel` 是屏障；`pipeline` 阶段间**无**屏障。 | [第 8 章](#/zh/p2-08) |
| **流水线 / pipeline（概念）** | 让各 item 在各阶段间**重叠**流动的执行模型；墙钟 ≈ 最慢的单条链，而非各阶段最慢之和。 | [第 8 章](#/zh/p2-08) |
| **thunk** | 零参函数 `() => Promise`，延迟执行的「待办」。`parallel` **必须**收 thunk 数组，传 Promise 会立即执行、不符合 thunk API 并丢失错误归集语义（非「绕过并发上限」）。 | [第 8 章](#/zh/p2-08) / [附录 B · B.4](#/zh/app-b) |
| **stage / 阶段（pipeline）** | `pipeline` 的一个处理步骤；回调签名 `(prevResult, originalItem, index)`，首阶段 `prevResult === item`。 | [第 8 章](#/zh/p2-08) |
| **prevResult / originalItem** | stage 回调参数：前一阶段返回值 / 该条目的原始输入。后者让后续阶段引用原始输入而无需穿线。 | [第 8 章](#/zh/p2-08) |

---

## D.5 agent 选项（opts）

| 术语（中 / 英） | 定义 | 定位 |
|---|---|---|
| **schema / 模式** | JSON Schema，传给 `agent()` 的 `opts.schema`；它强制 subagent 走结构化输出通道并在**工具调用层**校验，返回已验证对象；不匹配则模型重试。 | [第 7 章](#/zh/p2-07) |
| **StructuredOutput 工具** | subagent 侧的**内置工具**：有 `schema` 时，subagent 被强制调用它来提交输出，运行时在该工具调用层用 schema 校验、不匹配即重试。故 `agent()` 拿到的是**已验证对象**，无需再 `JSON.parse`。 | [第 7 章](#/zh/p2-07) |
| **结构化输出 / structured output** | 受 `schema` 约束、形状已验证的返回对象（区别于自由文本）。 | [第 7 章](#/zh/p2-07) |
| **label / 标签** | `opts.label`，覆盖 `/workflows` 与 transcript 中的显示名；描述性 label 利于定位与搜索。 | [第 6 章](#/zh/p2-06) |
| **opts.phase** | 显式把该 agent 归入某进度组；**在 parallel/pipeline 内部必用**（避免竞争全局 `phase()`）。 | [第 6 章](#/zh/p2-06) / [附录 B · B.12](#/zh/app-b) |
| **model（opts）** | 覆盖该 agent 模型；省略则继承主循环模型；简单任务可用 `'haiku'`。 | [第 6 章](#/zh/p2-06) |
| **isolation: 'worktree'** | 让该 agent 在独立 git worktree 运行；**昂贵**，仅当并行改文件会冲突时用；无改动自动清理。 | [第 19 章](#/zh/p4-19) |
| **agentType** | 用自定义 subagent 类型（如 `'Explore'`、`'code-reviewer'`），与 Agent 工具同一注册表解析；可与 `schema` 组合。**有校验**：未知值在生成模型前（0 token）即抛错并列出可用 agent（Run `wf_a222f20f-0f5`）——与无校验的 `model` 形成对比。 | [第 6 章](#/zh/p2-06) / [附录 B · B.21](#/zh/app-b) |
| **workflow-subagent** | `agent()` 不指定 `agentType` 时的**默认 subagent 类型**；继承会话的 file/shell/Skill/ToolSearch 工具（延迟环境下默认 0 个 `mcp__` 工具、可经 ToolSearch 按需加载）。每个 agent 的 sidecar `agent-<id>.meta.json` 记录此类型（Run `wf_1d4c6a71-56a`）。 | [附录 E · R4 MCP 记录](#/zh/app-e) |

---

## D.6 预算与规模

| 术语（中 / 英） | 定义 | 定位 |
|---|---|---|
| **budget / 预算** | 本回合 token 预算对象，含 `total`/`spent()`/`remaining()`；是**硬上限**，池为主循环+所有工作流共享。 | [第 9 章](#/zh/p2-09) |
| **budget.total** | 本回合 token 目标（来自用户 `+500k` 式指令）；`null` 表示未设（此时 `remaining()` 为 `Infinity`）。 | [第 21 章](#/zh/p4-21) |
| **budget.spent() / remaining()** | 已花 output token / 剩余额度（`max(0, total − spent())`）。 | [第 21 章](#/zh/p4-21) |
| **预算守卫 / budget guard** | 动态循环里用 `budget.total && budget.remaining() < 阈值` 主动提前退出的写法。 | [第 21 章](#/zh/p4-21) / [附录 B · B.6](#/zh/app-b) |
| **并发上限 / concurrency limit** | 单工作流同时运行 agent 数上限：`min(16, CPU核心数 − 2)`，超出排队。 | [第 21 章](#/zh/p4-21) |
| **agent 总数上限 / agent cap** | 单工作流生命周期 agent 总数硬上限 **1000**（失控循环兜底）。 | [附录 A · A.9](#/zh/app-a) |
| **脚本体积上限 / script size cap** | 单脚本上限 **524288 字节（512KB）**（工具 input-schema 的 `script.maxLength`）。 | [附录 A · A.9](#/zh/app-a) |
| **VM 同步超时 / sync timeout** | 脚本**同步**执行的硬上限 **30000ms**——长同步循环（如 `for(;;){}`）会被中止、workflow `failed`（原文 `Error: Script execution timed out after 30000ms`，实测耗时 30222ms，Run `wf_e3b2b123-5f4`）。**只约束同步段**：含 `await agent()` 的异步工作流可正常跑数分钟。 | [附录 E · R4 沙箱记录](#/zh/app-e) |
| **WorkflowAgentCapError / WorkflowBudgetExceededError** | 达 1000 agent 上限 / 预算耗尽时的错误**类名**。官方只描述行为、**未给类名**——类名属**社区第三方资料声称，本书未独立实测**（未触发这两个上限）。 | [附录 E · 参考解读](#/zh/app-e) |
| **stallMs / 停滞重试** | 据**社区第三方资料声称**：agent 停滞默认阈值 180000ms、重试 ≤5 次。**本书未核实**（未触发）。 | [附录 E · 参考解读](#/zh/app-e) |

---

## D.7 嵌套与隔离

| 术语（中 / 英） | 定义 | 定位 |
|---|---|---|
| **workflow() / 嵌套工作流** | `workflow(nameOrRef, args?) → Promise`：内联运行另一工作流；共享并发上限/agent 计数/中止信号/token 预算。 | [第 20 章](#/zh/p4-20) |
| **嵌套仅一层 / one-level nesting** | 父→子可以，子→孙抛错；防止递归失控。 | [第 20 章](#/zh/p4-20) |
| **worktree / git 工作树隔离** | 独立的 git 工作目录；`isolation:'worktree'` 让 agent 在其中运行，避免并行改文件冲突；结果返回路径与分支。 | [第 19 章](#/zh/p4-19) |
| **isolation / 隔离** | agent 的运行环境隔离策略；当前关键取值为 `'worktree'`。 | [第 19 章](#/zh/p4-19) |

---

## D.8 用量、模式与生态

| 术语（中 / 英） | 定义 | 定位 |
|---|---|---|
| **agent_count** | 完成通知里的用量字段：本次运行实际派发的 agent 总数（嵌套子流程的 agent 也计入父流程）。 | [primitives 运行记录](#/zh/p2-08) |
| **tool_uses** | 用量字段：本次运行的工具调用次数；续传缓存命中时为 0。 | [第 22 章](#/zh/p4-22) |
| **total_tokens / duration_ms** | 用量字段：总 token / 墙钟毫秒。经验：token ≈ agent 数 × 每 agent 上下文（约 2.5–3 万）。 | [primitives 运行记录](#/zh/p2-08) |
| **缓存命中 / cache hit** | 续传时未改动的 `agent()` 调用直接复用结果（零 token、零工具、约 8ms）。实测同脚本+同 args 重跑 = 100% 命中、0 token（Run `wf_9c94951d-58c` 续传）。 | [第 22 章](#/zh/p4-22) |
| **resume 缓存键 / resume cache key** | 判定某 `agent()` 调用能否命中缓存的依据。本书**实测确认**：「同脚本+同 args → 100% 命中」（`wf_9c94951d-58c`）；且 R8 单独隔离出 **`label` 不入键、`prompt` 入键**（`wf_4ffde230-535`，改 label→0 token 全命中、改 prompt→91,044 重跑成 60,702≈2/3）。`schema/model/isolation/agentType` 是否入键、`phase` 是否不入键据**社区第三方资料声称**、**本书未逐键独立核实**。 | [第 22 章](#/zh/p4-22) |
| **可重放性 / replayability** | 「同脚本+同输入→同执行路径」的性质；续传的前提，故禁用 `Date.now()`/`Math.random()`/无参 `new Date()`。 | [第 22 章](#/zh/p4-22) |
| **确定性双层防护 / determinism dual-layer ban** | 禁用不确定调用的两道闸：①**字面量**在**提交时**被源码静态扫描拒绝（脚本不运行）；②**别名形式**（`const D=Date;D.now()`）骗过扫描后在**运行时**被陷阱抛错。`try/catch` 拦不住任何一层（Run `wf_59bf3654-183`）。 | [第 22 章](#/zh/p4-22) / [附录 B · B.19](#/zh/app-b) |
| **对抗验证 / adversarial verification** | 用独立 agent 专门「挑刺」来暴露第一版盲区的模式（如 Generate-Critique-Fix）。 | [第 17 章](#/zh/p4-17) |
| **评委面板 / judge panel** | 多个独立评委按 rubric 打分并计票定胜负的 A/B 评估模式。 | [第 14 章](#/zh/p3-14) |
| **循环到干 / loop-until-dry** | 反复迭代直到「再榨不出新增产出」为止的模式，需收敛条件 + 轮次/预算守卫。 | [第 18 章](#/zh/p4-18) |
| **rubric / 评分量规** | 用 `schema` 把评估维度（如 accuracy/clarity/completeness）固化为可计分字段。 | [第 14 章](#/zh/p3-14) |
| **dogfooding / 吃自己的狗粮** | 用本特性来构建/审查本书自身（如用 Workflow 评审本书前端）。 | [frontend-review 运行记录](#/zh/p3-11) |

---

## D.9 字母序索引

按英文术语首字母快速跳转（中文别名见上文各表）：

- **A**：`agent()`（[D.4](#d4-核心原语agent-parallel-pipeline)）、`agentType`（[D.5](#d5-agent-选项opts)）、`agent_count`（[D.8](#d8-用量模式与生态)）、adversarial verification（[D.8](#d8-用量模式与生态)）、`args`（[D.2](#d2-调用与返回workflowinput-workflowoutput)）、`async_launched`（[D.2](#d2-调用与返回workflowinput-workflowoutput)）、`ANTHROPIC_DEFAULT_*_MODEL`（[D.1](#d1-顶层概念)）
- **B**：barrier / 屏障（[D.4](#d4-核心原语agent-parallel-pipeline)）、`budget`（[D.6](#d6-预算与规模)）
- **C**：cache hit（[D.8](#d8-用量模式与生态)）、concurrency limit（[D.6](#d6-预算与规模)）、`CLAUDE_CODE_WORKFLOWS`（[D.1](#d1-顶层概念)）、`CLAUDE_CODE_SUBAGENT_MODEL`（[D.1](#d1-顶层概念)）
- **D**：deterministic orchestration（[D.1](#d1-顶层概念)）、determinism dual-layer ban / 确定性双层防护（[D.8](#d8-用量模式与生态)）、dogfooding（[D.8](#d8-用量模式与生态)）、`duration_ms`（[D.8](#d8-用量模式与生态)）
- **E**：`error`（[D.2](#d2-调用与返回workflowinput-workflowoutput)）
- **I**：`isolation`（[D.7](#d7-嵌套与隔离)）
- **J**：judge panel（[D.8](#d8-用量模式与生态)）
- **L**：`label`（[D.5](#d5-agent-选项opts)）、`log`（[D.3](#d3-脚本元数据与阶段)）、loop-until-dry（[D.8](#d8-用量模式与生态)）
- **M**：`meta`（[D.3](#d3-脚本元数据与阶段)）、`model`（[D.5](#d5-agent-选项opts)）、main loop（[D.1](#d1-顶层概念)）
- **N**：`name`（[D.2](#d2-调用与返回workflowinput-workflowoutput)）、nesting（[D.7](#d7-嵌套与隔离)）
- **P**：`parallel()`（[D.4](#d4-核心原语agent-parallel-pipeline)）、`pipeline()`（[D.4](#d4-核心原语agent-parallel-pipeline)）、`phase`（[D.3](#d3-脚本元数据与阶段)）、`prevResult`（[D.4](#d4-核心原语agent-parallel-pipeline)）、pure literal（[D.3](#d3-脚本元数据与阶段)）
- **R**：`resumeFromRunId`（[D.2](#d2-调用与返回workflowinput-workflowoutput)）、resume 缓存键 / resume cache key（[D.8](#d8-用量模式与生态)）、`runId`（[D.2](#d2-调用与返回workflowinput-workflowoutput)）、replayability（[D.8](#d8-用量模式与生态)）、`remote_launched`（[D.2](#d2-调用与返回workflowinput-workflowoutput)）、rubric（[D.8](#d8-用量模式与生态)）
- **S**：`schema`（[D.5](#d5-agent-选项opts)）、StructuredOutput 工具（[D.5](#d5-agent-选项opts)）、`script` / `scriptPath`（[D.2](#d2-调用与返回workflowinput-workflowoutput)）、script size cap / 脚本体积上限（[D.6](#d6-预算与规模)）、stage（[D.4](#d4-核心原语agent-parallel-pipeline)）、`stallMs`（[D.6](#d6-预算与规模)）、`status`（[D.2](#d2-调用与返回workflowinput-workflowoutput)）、subagent（[D.1](#d1-顶层概念)）、`sessionUrl`（[D.2](#d2-调用与返回workflowinput-workflowoutput)）、sync timeout / VM 同步超时（[D.6](#d6-预算与规模)）
- **T**：`taskId`（[D.2](#d2-调用与返回workflowinput-workflowoutput)）、`<task-notification>`（[D.2](#d2-调用与返回workflowinput-workflowoutput)）、thunk（[D.4](#d4-核心原语agent-parallel-pipeline)）、`tool_uses` / `total_tokens`（[D.8](#d8-用量模式与生态)）、`transcriptDir`（[D.2](#d2-调用与返回workflowinput-workflowoutput)）
- **U**：ultrawork（[D.1](#d1-顶层概念)）
- **V**：VM 同步超时 / sync timeout（[D.6](#d6-预算与规模)）
- **W**：Workflow（[D.1](#d1-顶层概念)）、`workflow()`（[D.7](#d7-嵌套与隔离)）、workflow-subagent（[D.5](#d5-agent-选项opts)）、`WorkflowInput` / `WorkflowOutput`（[D.2](#d2-调用与返回workflowinput-workflowoutput)）、`WorkflowAgentCapError` / `WorkflowBudgetExceededError`（[D.6](#d6-预算与规模)）、`whenToUse`（[D.3](#d3-脚本元数据与阶段)）、worktree（[D.7](#d7-嵌套与隔离)）、warning（[D.2](#d2-调用与返回workflowinput-workflowoutput)）

> 配套阅读：字段语义查 [附录 A · API 完整参考](#/zh/app-a)；坑与排错查 [附录 B · 陷阱与排错](#/zh/app-b)；正向清单查 [附录 C · 最佳实践清单](#/zh/app-c)。

> 继续阅读：[附录 E · 信源索引](#/zh/app-e)
