# 附录 D · 术语表

> 这份附录收了全书的核心术语，**中英对照**，每条给一句定义 + 章节定位，方便你边读边查。字段语义以 [附录 A · API 完整参考](#/zh/app-a) 为准；行为依据见 [附录 E · 信源索引](#/zh/app-e)。
>
> 怎么排的：先按主题分组（方便你建立体系），组内大致按出现顺序来；文末还附了 [D.9 字母序索引](#d9-字母序索引)，想快速跳转就看那里。

---

## D.1 顶层概念

| 术语（中 / 英） | 定义 | 定位 |
|---|---|---|
| **Workflow / 工作流** | Claude Code 的多 agent 编排原语：用一段 JS 脚本确定性地派发、串联多个 subagent。 | [第 1 章](#/zh/p1-01) |
| **`workflow` / `workflows`（触发关键词）** | 消息里带上这个词，Claude 收到「该用 Workflow 工具」的系统提示——2.1.154 官方的触发关键词。 | [第 1 章 · §1.5](#/zh/p1-01) |
| **ultrawork（已弃用为触发词）** | 早期社区昵称；2.1.154 官方二进制里它**仅作内部事件名** `ultrawork_request`，用户输入**不再触发**任何东西。触发请改用 `workflow`/`workflows`。（第三方 oh-my-openagent 仍用此词作入口，与官方无关。） | [附录 A · A.12](#/zh/app-a) |
| **`/effort`** | 斜杠命令，定本会话 Claude「用多大力」：七挡 `low/medium/high/xhigh/max/ultracode/auto`。Opus 4.8 默认 `high`。 | [第 1 章 · §1.6](#/zh/p1-01) |
| **ultracode** | `/effort` 的一个挡位 = **xhigh 推理 + 默认主动编排 workflow（仅本会话）**。论推理深度不及 `max`，胜在「默认就多开 agent」。只在 workflow 可用时才出现在 `/effort` 里。 | [第 1 章 · §1.6](#/zh/p1-01) |
| **ultrathink** | 与 `workflow` 同机制的关键词：消息里带上它，让 Claude「这一轮想得更深」，不涉及 workflow 编排。 | [第 1 章 · §1.6](#/zh/p1-01) |
| **CLAUDE_CODE_EFFORT_LEVEL** | 环境变量，**强制覆盖** `/effort` 的会话选择（值为 `unset`/`auto` 时不覆盖）。 | [第 1 章 · §1.6](#/zh/p1-01) |
| **确定性编排 / deterministic orchestration** | 由代码（而非模型自由发挥）决定「派几个 agent、按什么顺序、如何汇合」的编排方式，区别于纯提示词驱动。 | [第 2 章](#/zh/p1-02) |
| **subagent / 子智能体** | 由 `agent()` 派出去的一个独立干活单元，有自己的上下文和真实的工具权限；它「吐出的最后一段文本就是返回值」。 | [第 1 章](#/zh/p1-01) |
| **主循环 / main loop** | 你正在跟它对话的这个 Claude 会话；Workflow 工具调用就是它发起的，而且它跟所有工作流**共用一个 token 预算池**。 | [第 9 章](#/zh/p2-09) |
| **CLAUDE_CODE_WORKFLOWS** | 控制「能不能用」的环境变量：`1` 是**最可靠的用户侧开法**（设了之后可用性仍取服务端 flag，默认 true）、`0` 强制关、不设则看服务端 flag（非 Pro 账户默认开）。 | [附录 A · A.12](#/zh/app-a) |
| **CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS** | 关联的实验性标志（Agent Teams）；与 Workflow 同属实验能力族。 | [接地事实表](#/zh/p1-01) |
| **CLAUDE_CODE_SUBAGENT_MODEL** | 用户/CI 级的环境变量；只要一设上，它就**覆盖一切 per-call `model`**（脚本里写的 `opts.model`/`phases[].model` 都被静默忽略）。实测本会话设成 `claude-opus-4-7[1m]`，5 个带不同 model 选项的 agent 全跑了 Opus（Run `wf_9c94951d-58c`）。 | [附录 E · R4 模型解析记录](#/zh/app-e) |
| **ANTHROPIC_DEFAULT_HAIKU_MODEL / SONNET / OPUS** | 用户/CI 级的环境变量；把对应的**模型别名**整体重映射到你指定的模型。它跟 `CLAUDE_CODE_SUBAGENT_MODEL` 叠在一起，就是「两层模型覆盖」——本会话两层都指向 Opus，所以脚本里写 `model: 'haiku'` 实跑的还是 Opus（Run `wf_e8cb23ff-829`）。 | [附录 A · A.4](#/zh/app-a) |

---

## D.2 调用与返回（WorkflowInput / WorkflowOutput）

| 术语（中 / 英） | 定义 | 定位 |
|---|---|---|
| **WorkflowInput** | 你调用 Workflow 工具时传进去的入参接口，含 `script`/`name`/`args`/`scriptPath`/`resumeFromRunId`。 | [附录 A · A.1](#/zh/app-a) |
| **WorkflowOutput** | Workflow 工具给你的返回接口（是**回执**，不是结果），含 `status`/`taskId`/`runId` 等。 | [附录 A · A.2](#/zh/app-a) |
| **script** | 自包含的脚本字符串；开头**必须**是纯字面量的 `export const meta = {…}`。 | [附录 A · A.1](#/zh/app-a) |
| **name / 具名工作流** | 预先定义好的工作流名字（内置的，或放在 `.claude/workflows/` 里的），会被解析成一段脚本；常常配 `args` 来传参。 | [附录 A · A.1](#/zh/app-a) |
| **scriptPath** | 磁盘上的脚本路径；**优先级最高**，每次调用都会落盘，方便你 Write/Edit 改完再重跑。 | [附录 A · A.1](#/zh/app-a) |
| **status** | 回执的状态，**仅** `"async_launched"` 和 `"remote_launched"` 两种。 | [附录 A · A.2](#/zh/app-a) |
| **async_launched / remote_launched** | 前者是本地异步启动；后者是远端（CCR）启动，没有 `runId`，靠 `sessionUrl` 当续传句柄。 | [附录 A · A.2](#/zh/app-a) |
| **taskId / 任务句柄** | 后台任务的标识；拿来追踪和停止任务（TaskStop）。 | [附录 A · A.2](#/zh/app-a) |
| **runId / 运行标识** | 本地运行的标识（长得像 `wf_…`）；`resumeFromRunId` 续传时要用它；`remote_launched` 没有这个。 | [附录 A · A.2](#/zh/app-a) |
| **resumeFromRunId / 断点续传** | 从某一次运行接着往下跑：没改动过的 `agent()` 调用直接返回缓存结果（零成本）；**仅同会话**。 | [第 22 章](#/zh/p4-22) |
| **transcriptDir** | subagent 执行记录所在的目录（回执字段）。 | [附录 A · A.2](#/zh/app-a) |
| **sessionUrl** | `remote_launched` 时给你的那个 CCR session URL。 | [附录 A · A.2](#/zh/app-a) |
| **warning / error** | 回执里的非阻塞提示 / 语法检查没过的信息；`error` 在启动前就同步返回，不耗 token。 | [附录 A · A.2](#/zh/app-a) |
| **&lt;task-notification&gt; / 完成通知** | 工作流跑完时送过来的那条消息，里头装着**真正的返回值**和用量统计。 | [附录 A · A.2](#/zh/app-a) |

---

## D.3 脚本元数据与阶段

| 术语（中 / 英） | 定义 | 定位 |
|---|---|---|
| **meta** | 脚本导出的那个元数据常量，**必须纯字面量**；`name`/`description` 必填，`whenToUse`/`phases` 可选。 | [第 5 章](#/zh/p2-05) |
| **纯字面量 / pure literal** | 不带变量引用、函数调用、展开运算符、模板插值的字面值；这是 `meta` 的硬性要求（因为运行时还没开跑就要静态读它）。 | [第 5 章](#/zh/p2-05) |
| **phase / 阶段** | 把进度分个组。全局的 `phase(title)` 开一个新阶段，后面的 `agent()` 就都归到这一组；标题要跟 `meta.phases[].title` 精确对上。 | [第 5 章](#/zh/p2-05) |
| **phases（meta 字段）** | `{ title, detail?, model? }[]`，用声明式的写法把工作流的阶段列出来。 | [附录 A · A.4](#/zh/app-a) |
| **whenToUse** | `meta` 的可选字段，写清楚什么场景下用它，会显示在工作流列表里。 | [附录 A · A.4](#/zh/app-a) |
| **log / 进度叙述** | `log(message)` 给用户打一行进度叙述（落在进度树上方）。 | [第 9 章](#/zh/p2-09) |
| **/workflows** | 看工作流实时进度的斜杠命令。 | [附录 A · A.12](#/zh/app-a) |

---

## D.4 核心原语：agent / parallel / pipeline

| 术语（中 / 英） | 定义 | 定位 |
|---|---|---|
| **agent() / 派发智能体** | `agent(prompt, opts?) → Promise`：派出一个 subagent。没给 `schema` 就返回文本；给了 `schema` 就返回已验证对象；用户跳过了就返回 `null`。 | [第 6 章](#/zh/p2-06) |
| **parallel() / 并发屏障** | `parallel(thunks) → Promise<any[]>`：把一组 **thunk** 并发跑起来，是个**屏障**，要等它们全跑完；结果顺序=输入顺序；异步失败的会变成 `null`，但 thunk 体内同步 `throw` 会 reject 掉整个调用。 | [第 8 章](#/zh/p2-08) |
| **pipeline() / 流水线** | `pipeline(items, stage1, …) → Promise<any[]>`：每个 item **独立**地流过全部 stage，**阶段间无屏障**；某个 stage 抛错，这个 item 就变 `null` 并跳过剩下的 stage。**多阶段默认用它**。 | [第 8 章](#/zh/p2-08) |
| **屏障 / barrier** | 一个同步点：必须等一批任务**全部完成**才往下走。`parallel` 是屏障；`pipeline` 阶段间**无**屏障。 | [第 8 章](#/zh/p2-08) |
| **流水线 / pipeline（概念）** | 一种让各 item 在各阶段间**重叠**着流动的执行模型；墙钟 ≈ 最慢的那条单链，而不是各阶段最慢的加起来。 | [第 8 章](#/zh/p2-08) |
| **thunk** | 一个零参函数 `() => Promise`，相当于一个等着被执行的「待办」。`parallel` **必须**收 thunk 数组；你要是直接传 Promise，它会立刻执行、不符合 thunk API、还会丢掉「异步失败归集」的语义（异步 reject / agent 出错 → `null`）。 | [第 8 章](#/zh/p2-08) / [附录 B · B.4](#/zh/app-b) |
| **stage / 阶段（pipeline）** | `pipeline` 里的一个处理步骤；回调签名是 `(prevResult, originalItem, index)`，第一个阶段里 `prevResult === item`。 | [第 8 章](#/zh/p2-08) |
| **prevResult / originalItem** | stage 回调的参数：前一阶段的返回值 / 这一条的原始输入。有了后者，后面的阶段想引用原始输入就不用一层层穿过去了。 | [第 8 章](#/zh/p2-08) |

---

## D.5 agent 选项（opts）

| 术语（中 / 英） | 定义 | 定位 |
|---|---|---|
| **schema / 模式** | 一份 JSON Schema，作为 `opts.schema` 传给 `agent()`；它逼着 subagent 走结构化输出通道，并在**工具调用层**做校验，返回已验证对象；对不上模型就重试。 | [第 7 章](#/zh/p2-07) |
| **StructuredOutput 工具** | subagent 那一侧的**内置工具**：有 `schema` 时，subagent 被强制调用它来交输出，运行时就在这个工具调用层拿 schema 校验、对不上就重试。所以 `agent()` 拿到的是**已验证对象**，不用你再 `JSON.parse`。 | [第 7 章](#/zh/p2-07) |
| **结构化输出 / structured output** | 一个受 `schema` 约束、形状已验证的返回对象（跟自由文本不是一回事）。 | [第 7 章](#/zh/p2-07) |
| **label / 标签** | `opts.label`，用来覆盖 `/workflows` 和 transcript 里的显示名；label 起得有描述性，定位和搜索都方便。 | [第 6 章](#/zh/p2-06) |
| **opts.phase** | 明确把这个 agent 归到某个进度组里；**在 parallel/pipeline 内部必用**（不然会去抢全局 `phase()`）。 | [第 6 章](#/zh/p2-06) / [附录 B · B.12](#/zh/app-b) |
| **model（opts）** | 覆盖这个 agent 用的模型；不写就继承主循环的模型；简单任务可以用 `'haiku'`。 | [第 6 章](#/zh/p2-06) |
| **isolation: 'worktree'** | 让这个 agent 在一个独立的 git worktree 里跑；**昂贵**，仅当并行改文件会撞车时才用；没改动会自动清理。 | [第 19 章](#/zh/p4-19) |
| **agentType** | 用自定义的 subagent 类型（比如 `'Explore'`、`'code-reviewer'`），跟 Agent 工具走的是同一个注册表来解析；可以跟 `schema` 一起用。**有校验**：填了个不认识的值，在生成模型前（0 token）就抛错，还把可用的 agent 列给你（Run `wf_a222f20f-0f5`）——跟无校验的 `model` 正好是个对比。 | [第 6 章](#/zh/p2-06) / [附录 B · B.21](#/zh/app-b) |
| **workflow-subagent** | `agent()` 没指定 `agentType` 时用的**默认 subagent 类型**；它继承会话的 file/shell/Skill/ToolSearch 工具（延迟环境下默认 0 个 `mcp__` 工具、要用可经 ToolSearch 按需加载）。每个 agent 的 sidecar `agent-<id>.meta.json` 都记着这个类型（Run `wf_1d4c6a71-56a`）。 | [附录 E · R4 MCP 记录](#/zh/app-e) |

---

## D.6 预算与规模

| 术语（中 / 英） | 定义 | 定位 |
|---|---|---|
| **budget / 预算** | 本回合的 token 预算对象，含 `total`/`spent()`/`remaining()`；这是个**硬上限**，而且这个池是主循环+所有工作流一起共享的。 | [第 9 章](#/zh/p2-09) |
| **budget.total** | 本回合的 token 目标（来自用户那种 `+500k` 的指令）；`null` 表示没设（这时候 `remaining()` 就是 `Infinity`）。 | [第 21 章](#/zh/p4-21) |
| **budget.spent() / remaining()** | 已经花掉的 output token / 还剩的额度（`max(0, total − spent())`）。 | [第 21 章](#/zh/p4-21) |
| **预算守卫 / budget guard** | 在动态循环里用 `budget.total && budget.remaining() < 阈值` 主动提前退出的写法。 | [第 21 章](#/zh/p4-21) / [附录 B · B.6](#/zh/app-b) |
| **并发上限 / concurrency limit** | 单个工作流同时能跑的 agent 数上限：`min(16, CPU核心数 − 2)`，超出去的就排队。 | [第 21 章](#/zh/p4-21) |
| **agent 总数上限 / agent cap** | 单个工作流整个生命周期里 agent 总数的硬上限 **1000**（用来给失控循环兜底）。 | [附录 A · A.9](#/zh/app-a) |
| **脚本体积上限 / script size cap** | 单个脚本的上限 **524288 字节（512KB）**（就是工具 input-schema 里的 `script.maxLength`）。 | [附录 A · A.9](#/zh/app-a) |
| **VM 同步超时 / sync timeout** | 脚本**同步**执行的硬上限 **30000ms**——长的同步循环（比如 `for(;;){}`）会被掐断、workflow 变 `failed`（原文 `Error: Script execution timed out after 30000ms`，实测耗时 30222ms，Run `wf_e3b2b123-5f4`）。它**只约束同步段**：带 `await agent()` 的异步工作流跑上几分钟都没事。 | [附录 E · R4 沙箱记录](#/zh/app-e) |
| **WorkflowAgentCapError / WorkflowBudgetExceededError** | 撞到 1000 agent 上限 / 预算耗尽时报的那个错误**类名**。官方只讲了行为、**未给类名**——这俩类名属于**社区第三方资料声称，本书未独立实测**（没触发过这两个上限）。 | [附录 E · 参考解读](#/zh/app-e) |
| **stallMs / 停滞重试** | 据**社区第三方资料声称**：agent 停滞的默认阈值是 180000ms、重试 ≤5 次。**本书未核实**（没触发过）。 | [附录 E · 参考解读](#/zh/app-e) |

---

## D.7 嵌套与隔离

| 术语（中 / 英） | 定义 | 定位 |
|---|---|---|
| **workflow() / 嵌套工作流** | `workflow(nameOrRef, args?) → Promise`：内联跑起另一个工作流；并发上限/agent 计数/中止信号/token 预算都是共享的。 | [第 20 章](#/zh/p4-20) |
| **嵌套仅一层 / one-level nesting** | 父→子可以，子→孙就抛错；防止递归失控。 | [第 20 章](#/zh/p4-20) |
| **worktree / git 工作树隔离** | 一个独立的 git 工作目录；`isolation:'worktree'` 让 agent 在里头跑，避免并行改文件撞车；工具结果信封层会带上路径和分支（但脚本里 `agent()` 拿到的是 agent 常规返回值，不是 `{path,branch}` 对象，见 A.5）。 | [第 19 章](#/zh/p4-19) |
| **isolation / 隔离** | agent 运行环境的隔离策略；目前关键的取值是 `'worktree'`。 | [第 19 章](#/zh/p4-19) |

---

## D.8 用量、模式与生态

| 术语（中 / 英） | 定义 | 定位 |
|---|---|---|
| **agent_count** | 完成通知里的一个用量字段：这次运行实际派出去的 agent 总数（嵌套子流程的 agent 也算进父流程里）。 | [primitives 运行记录](#/zh/p2-08) |
| **tool_uses** | 一个用量字段：这次运行的工具调用次数；续传命中缓存时是 0。 | [第 22 章](#/zh/p4-22) |
| **total_tokens / duration_ms** | 用量字段：总 token / 墙钟毫秒。一条经验：token ≈ agent 数 × 每个 agent 的上下文（约 2.5–3 万）。 | [primitives 运行记录](#/zh/p2-08) |
| **缓存命中 / cache hit** | 续传时，没改动过的 `agent()` 调用直接拿现成结果用（零 token、零工具、约 8ms）。实测同脚本+同 args 重跑 = 100% 命中、0 token（Run `wf_9c94951d-58c` 续传）。 | [第 22 章](#/zh/p4-22) |
| **resume 缓存键 / resume cache key** | 用来判定某个 `agent()` 调用能不能命中缓存的依据。本书**实测确认**：「同脚本+同 args → 100% 命中」（`wf_9c94951d-58c`）；而且 R8 还单独隔离出了 **`label` 不入键、`prompt` 入键**（`wf_4ffde230-535`，改 label→0 token 全命中、改 prompt→91,044 重跑成 60,702≈2/3）。至于 `schema/model/isolation/agentType` 入不入键、`phase` 是不是不入键，据**社区第三方资料声称**、**本书未逐键独立核实**。 | [第 22 章](#/zh/p4-22) |
| **可重放性 / replayability** | 「同脚本+同输入→同执行路径」这么个性质；它是续传的前提，所以才禁用 `Date.now()`/`Math.random()`/无参 `new Date()`。 | [第 22 章](#/zh/p4-22) |
| **确定性双层防护 / determinism dual-layer ban** | 拦不确定调用的两道闸：①**字面量**在**提交时**就被源码静态扫描挡掉（脚本不会跑）；②**别名形式**（`const D=Date;D.now()`）骗过了扫描，到**运行时**也会被陷阱抛错。`try/catch` 这两层一层都拦不住（Run `wf_59bf3654-183`）。 | [第 22 章](#/zh/p4-22) / [附录 B · B.19](#/zh/app-b) |
| **对抗验证 / adversarial verification** | 用独立 agent 专门去「挑刺」，把第一版的盲区揪出来的那种模式（比如 Generate-Critique-Fix）。 | [第 17 章](#/zh/p4-17) |
| **评委面板 / judge panel** | 让多个独立评委照着 rubric 打分、再计票定胜负的 A/B 评估模式。 | [第 14 章](#/zh/p3-14) |
| **循环到干 / loop-until-dry** | 反复迭代，直到「再榨不出新东西」为止的模式，需要配收敛条件 + 轮次/预算守卫。 | [第 18 章](#/zh/p4-18) |
| **rubric / 评分量规** | 用 `schema` 把评估维度（比如 accuracy/clarity/completeness）固化成可计分的字段。 | [第 14 章](#/zh/p3-14) |
| **dogfooding / 吃自己的狗粮** | 拿这个特性来构建/审查这本书自己（比如用 Workflow 来评审本书前端）。 | [frontend-review 运行记录](#/zh/p3-11) |

---

## D.9 字母序索引

按英文术语的首字母快速跳转（中文别名看上面各表）：

- **A**：`agent()`（[D.4](#d4-核心原语agent-parallel-pipeline)）、`agentType`（[D.5](#d5-agent-选项opts)）、`agent_count`（[D.8](#d8-用量模式与生态)）、adversarial verification（[D.8](#d8-用量模式与生态)）、`args`（[D.2](#d2-调用与返回workflowinput-workflowoutput)）、`async_launched`（[D.2](#d2-调用与返回workflowinput-workflowoutput)）、`ANTHROPIC_DEFAULT_*_MODEL`（[D.1](#d1-顶层概念)）
- **B**：barrier / 屏障（[D.4](#d4-核心原语agent-parallel-pipeline)）、`budget`（[D.6](#d6-预算与规模)）
- **C**：cache hit（[D.8](#d8-用量模式与生态)）、concurrency limit（[D.6](#d6-预算与规模)）、`CLAUDE_CODE_WORKFLOWS`（[D.1](#d1-顶层概念)）、`CLAUDE_CODE_SUBAGENT_MODEL`（[D.1](#d1-顶层概念)）、`CLAUDE_CODE_EFFORT_LEVEL`（[D.1](#d1-顶层概念)）
- **D**：deterministic orchestration（[D.1](#d1-顶层概念)）、determinism dual-layer ban / 确定性双层防护（[D.8](#d8-用量模式与生态)）、dogfooding（[D.8](#d8-用量模式与生态)）、`duration_ms`（[D.8](#d8-用量模式与生态)）
- **E**：`error`（[D.2](#d2-调用与返回workflowinput-workflowoutput)）、`/effort`（[D.1](#d1-顶层概念)）、effort levels / 用力挡位（[D.1](#d1-顶层概念)）
- **I**：`isolation`（[D.7](#d7-嵌套与隔离)）
- **J**：judge panel（[D.8](#d8-用量模式与生态)）
- **L**：`label`（[D.5](#d5-agent-选项opts)）、`log`（[D.3](#d3-脚本元数据与阶段)）、loop-until-dry（[D.8](#d8-用量模式与生态)）
- **M**：`meta`（[D.3](#d3-脚本元数据与阶段)）、`model`（[D.5](#d5-agent-选项opts)）、main loop（[D.1](#d1-顶层概念)）
- **N**：`name`（[D.2](#d2-调用与返回workflowinput-workflowoutput)）、nesting（[D.7](#d7-嵌套与隔离)）
- **P**：`parallel()`（[D.4](#d4-核心原语agent-parallel-pipeline)）、`pipeline()`（[D.4](#d4-核心原语agent-parallel-pipeline)）、`phase`（[D.3](#d3-脚本元数据与阶段)）、`prevResult`（[D.4](#d4-核心原语agent-parallel-pipeline)）、pure literal（[D.3](#d3-脚本元数据与阶段)）
- **R**：`resumeFromRunId`（[D.2](#d2-调用与返回workflowinput-workflowoutput)）、resume 缓存键 / resume cache key（[D.8](#d8-用量模式与生态)）、`runId`（[D.2](#d2-调用与返回workflowinput-workflowoutput)）、replayability（[D.8](#d8-用量模式与生态)）、`remote_launched`（[D.2](#d2-调用与返回workflowinput-workflowoutput)）、rubric（[D.8](#d8-用量模式与生态)）
- **S**：`schema`（[D.5](#d5-agent-选项opts)）、StructuredOutput 工具（[D.5](#d5-agent-选项opts)）、`script` / `scriptPath`（[D.2](#d2-调用与返回workflowinput-workflowoutput)）、script size cap / 脚本体积上限（[D.6](#d6-预算与规模)）、stage（[D.4](#d4-核心原语agent-parallel-pipeline)）、`stallMs`（[D.6](#d6-预算与规模)）、`status`（[D.2](#d2-调用与返回workflowinput-workflowoutput)）、subagent（[D.1](#d1-顶层概念)）、`sessionUrl`（[D.2](#d2-调用与返回workflowinput-workflowoutput)）、sync timeout / VM 同步超时（[D.6](#d6-预算与规模)）
- **T**：`taskId`（[D.2](#d2-调用与返回workflowinput-workflowoutput)）、`<task-notification>`（[D.2](#d2-调用与返回workflowinput-workflowoutput)）、thunk（[D.4](#d4-核心原语agent-parallel-pipeline)）、`tool_uses` / `total_tokens`（[D.8](#d8-用量模式与生态)）、`transcriptDir`（[D.2](#d2-调用与返回workflowinput-workflowoutput)）
- **U**：ultracode（[D.1](#d1-顶层概念)）、ultrathink（[D.1](#d1-顶层概念)）、ultrawork（已弃用为触发词，[D.1](#d1-顶层概念)）
- **V**：VM 同步超时 / sync timeout（[D.6](#d6-预算与规模)）
- **W**：Workflow（[D.1](#d1-顶层概念)）、`workflow`/`workflows` 关键词（[D.1](#d1-顶层概念)）、`workflow()`（[D.7](#d7-嵌套与隔离)）、workflow-subagent（[D.5](#d5-agent-选项opts)）、`WorkflowInput` / `WorkflowOutput`（[D.2](#d2-调用与返回workflowinput-workflowoutput)）、`WorkflowAgentCapError` / `WorkflowBudgetExceededError`（[D.6](#d6-预算与规模)）、`whenToUse`（[D.3](#d3-脚本元数据与阶段)）、worktree（[D.7](#d7-嵌套与隔离)）、warning（[D.2](#d2-调用与返回workflowinput-workflowoutput)）

> 配套阅读：字段语义查 [附录 A · API 完整参考](#/zh/app-a)；坑与排错查 [附录 B · 陷阱与排错](#/zh/app-b)；正向清单查 [附录 C · 最佳实践清单](#/zh/app-c)。

> 继续阅读：[附录 E · 信源索引](#/zh/app-e)
