# 附录 B · 陷阱与排错

> 写 Workflow 时最容易踩的坑，整理成一张速查表。每条按 **症状 → 原因 → 解法** 写：先说你看到什么、什么时候出现，再讲底下为什么，最后给一段能直接抄走的改法。
>
> 所有论断的 API 依据见 [附录 A](#/zh/app-a)，行为依据来自 [附录 E](#/zh/app-e) 列出的真实运行。适用版本是 Claude Code v2.1.154+（官方最低）。本书实测跨 v2.1.150 到 v2.1.156，核心不变量已在 v2.1.156 复核（见 `assets/transcripts/examples-r11.md`）。
>
> 怎么启用：官方入口是 `/config` 里的 "Dynamic workflows" 那一行。所有付费档（Pro、Max、Team、Enterprise）以及 Anthropic API、Amazon Bedrock、Google Cloud Vertex AI、Microsoft Foundry 上都能用。Pro 必须在这一行手动打开；其余付费档官方文档没说是否默认打开，请到你自己的 `/config` 看开关状态。环境变量 `CLAUDE_CODE_WORKFLOWS=1` 是 power-user 的底层开关，不是官方启用方式，也不取代 `/config`（详见 [第 4 章](#/zh/p2-04)）。

---

## B.1 速查总表

先扫一眼。每行链到下文的详解小节。

| # | 症状（你看到的） | 根因（一句话） | 速解 |
|---|---|---|---|
| 1 | 工具直接返回 `error`，工作流根本没跑 | `meta` 不是静态字面量（static literal） / 脚本首行不是 `export const meta` | [B.2](#b2-meta-非静态字面量（static literal）被拒) |
| 2 | 返回 `error` 字段，提示语法/解析失败 | 脚本有语法错，被启动前的静态检查拦下 | [B.3](#b3-语法错落进-error-字段) |
| 3 | 并发「没生效」，耗时≈串行总和，`parallel()` 无法管理这些调用、异步失败归集失效 | 给 `parallel()` 传了 Promise 数组而非函数数组 | [B.4](#b4-parallel-传了-promise-而非-thunk) |
| 4 | 字面写法在提交时直接被拒、脚本没跑（或别名形式运行时抛错），都提示禁用 API | 脚本里用了 `Date.now()` / `Math.random()` / 无参 `new Date()`，被确定性守卫双层拦截（提交期源码扫描 + 运行时陷阱） | [B.5](#b5-datenow-mathrandom-抛错) |
| 5 | 工作流不停地派 agent，token 飙升直到撞上限 | 动态循环没有 `budget.total &&` 守卫 | [B.6](#b6-无-budget-守卫的死循环) |
| 6 | 续传时该缓存的步骤又重新执行了（花了 token） | 脚本被改动过 / 跨会话 / 没先停上一次运行 | [B.7](#b7-续传没命中缓存) |
| 7 | 运行时抛错，提示嵌套层数超限 | 子工作流里又调了 `workflow()`（超过一层） | [B.8](#b8-嵌套超过一层抛错) |
| 8 | agent 反复重试、迟迟不返回，或耗时异常 | `schema` 约束过严，模型难以一次满足 | [B.9](#b9-schema-过严导致反复重试) |
| 9 | 外部模型/CLI「跑了但没产出文件」，以为它失败了 | 误以为 `ctx_execute`/子进程的写入会持久化到磁盘 | [B.10](#b10-沙箱写入不会持久化) |
| 10 | `parallel`/`pipeline` 结果里混着 `null`，后续 `.map` 报错 | 没在结果上 `.filter(Boolean)` | [B.11](#b11-结果里的-null-没过滤) |
| 11 | 进度树里 agent 没归到预期阶段，或 phase 标签错乱 | 在 `parallel`/`pipeline` 内部依赖全局 `phase()` | [B.12](#b12-并发块内的-phase-竞争) |
| 12 | `args` 在脚本里是 `undefined` | 调用 Workflow 时没传 `args`，或字段名拼错 | [B.13](#b13-args-未传或字段错位) |
| 13 | 想读返回值，却拿到 `taskId`，以为工作流是同步的 | Workflow 工具**始终异步**，回执 ≠ 结果 | [B.14](#b14-把异步回执当成结果) |
| 14 | `pipeline` 某项中途「消失」，最终条数变少 | 某 stage 抛错使该 item 变 `null` 并跳过其余 stage | [B.15](#b15-pipeline-单项静默掉队) |
| 15 | 想用文件系统/`fetch`/`require`，运行时报错或未定义 | 脚本无文件系统 / Node API | [B.16](#b16-想在脚本里用-node-api) |
| 16 | workflow 莫名失败、`0 token` 秒退，agent 几乎没跑 | `parallel()` 的 thunk **函数体内同步 throw**（≠ 异步 reject） | [B.17](#b17-parallel-thunk-体内同步-throw没接住就崩) |
| 17 | 无条件 `JSON.parse(args)` 抛错，或对象被二次解析 | `args` **原样透传**：对象保持对象、不是 JSON 字符串 | [B.18](#b18-无条件-jsonparseargs-的误解) |
| 18 | 给 `Date.now()` 套了 `try/catch` 却没接住，脚本根本没跑，或别名形式运行时抛 | 字面量在**提交时**静态拒绝；别名形式**运行时**陷阱抛错 | [B.19](#b19-trycatch-接不住-datenow) |
| 19 | `isolation` 拼错（如 `'worktreee'`）没报错，agent 却没被隔离 | 未知 `isolation` 值被**静默忽略**，只特判 `'worktree'`/`'remote'` | [B.20](#b20-isolation-拼错被静默忽略) |
| 20 | 拼错的 `model` 字符串没在提交期报错，以为它合法 | `model` **无提交期校验**（与 `agentType` 有校验相反） | [B.21](#b21-model-拼错不在提交期报错) |
| 21 | 「循环到干」漏写 `budget.total &&`，一路跑到 1000 agent 上限 | 未设目标时 `total===null`、`remaining()===Infinity`，裸 `remaining()` 守卫永不触发 | [B.22](#b22-budget-守卫漏-total-短路) |

---

## B.2 `meta` 非静态字面量（static literal）被拒

<div class="callout warn">

**症状**：调用 Workflow 工具后，立刻返回一个带 `error` 的 `WorkflowOutput`，没有派出任何 agent。通常是因为把版本号、时间戳或某个变量写进了 `meta`。

</div>

**原因**：运行时在**跑你脚本之前**就先静态读一遍 `meta`，因为它得拿 `name`/`description` 去填权限确认弹窗。这一步不执行你的代码，只做字面量求值。所以 `meta` 必须是**静态字面量（static literal）**，不能含变量引用、函数调用、展开运算符、模板插值。

```javascript
// ✗ 全部会被拒
export const meta = {
  name: `review-${args.target}`,        // 模板插值
  description: buildDesc(),              // 函数调用
  phases: [...basePhases, { title:'X' }],// 展开
  model: DEFAULT_MODEL,                  // 变量引用
}
```

**解法**：把动态的东西挪到 `meta` 之后的代码里去。`meta` 只放写死的静态文本；要表达会变的信息，运行时再用 `log()` / `phase()`。

```javascript
// ✓ meta 静态字面量（static literal）；动态信息放在 meta 之后
export const meta = {
  name: 'review',
  description: 'Review the target files for issues',
  phases: [{ title: 'Review' }],
}

phase('Review')
log(`reviewing target: ${args.target}`)   // 动态信息放这里
```

> 同源约束：脚本**首行必须是** `export const meta = {…}`，前面不能有别的语句。

---

## B.3 语法错落进 `error` 字段

**症状**：`WorkflowOutput.error` 有值，内容指向解析/语法问题；工作流没起来。

**原因**：Workflow 在派出任何 subagent 之前，会先给脚本做一遍语法检查。没过，就把错误写进 `error` 字段、立刻返回，**不消耗任何 agent/token**。这其实是好事：写错的脚本在花钱之前就被拦下来了。

**解法**：

1. 读 `error` 字段，照着定位行号和原因，改完再重发。
2. 脚本一复杂，就先存成 `.js` 文件、用 `scriptPath` 调用。这样你能先在编辑器或本地工具里把基本语法过一遍，再交给 Workflow。
3. 记着脚本是 `async` 上下文，可以直接 `await`，但顶层除了裸 `return`，**不要**写别的非法结构。

<div class="callout tip">

`error`（语法检查没过）跟运行时抛错是两码事。前者在启动前就同步返回；后者发生在执行途中，靠完成通知来体现，而且有些场景会被 `parallel`/`pipeline` 转成 `null`（见 [B.11](#b11-结果里的-null-没过滤)、[B.15](#b15-pipeline-单项静默掉队)）。

</div>

---

## B.4 `parallel()` 传了 Promise 而非 thunk

<div class="callout warn">

**症状**：多个 agent 未被 `parallel()` 统一管理，在数组构造时就各自开始运行。异步失败归集（async reject 或 agent 出错变 `null`）也随之失效。

</div>

**原因**：`parallel()` 收的是**函数数组**（`Array<() => Promise>`，也就是 thunk）。你写成 `parallel([ agent(...), agent(...) ])`，`agent(...)` 在数组**刚构造出来那一刻就被调用、立刻开跑**了，`parallel` 拿到手的是几个已经在跑的 Promise。三个后果：它**不符合 `parallel(thunks)` 的 API**；`parallel()` **没法按 thunk 去管这个调用**；它还**丢掉了「单个 thunk 异步 reject 时，该位置归集为 `null`」这套错误语义**，于是你事后 `.filter(Boolean)` 也拦不住了。

> 并发上限是 **per-workflow**（整个工作流共享）那道闸，跟你传的是 Promise 还是 thunk 没关系，也不是 `parallel()` 自己能开关的。

```javascript
// ✗ 立即执行；不符合 parallel(thunks) API，丢失「async reject → null」错误归集
const r = await parallel([
  agent('task A', { schema: S }),
  agent('task B', { schema: S }),
])

// ✓ 传 thunk，由 parallel 控制调度
const r = await parallel([
  () => agent('task A', { schema: S }),
  () => agent('task B', { schema: S }),
])
```

**解法**：永远拿 `() => agent(...)` 包一层。用 `.map` 批量生成时也一样：

```javascript
const r = await parallel(items.map(it => () => agent(prompt(it), { schema: S })))
```

> 真实印证：`parallel-demo`（Run `wf_52957913-6d2`）跑 3 个 thunk，实测 8.4s ≪ 3×5.5s，并发确实生效了（数据见 [primitives 运行记录](#/zh/p2-08)）。

---

## B.5 `Date.now()` / `Math.random()` 抛错

**症状**：脚本里出现 `Date.now()`、`Math.random()`，或者无参的 `new Date()`，报错指向这三个禁用 API。两种表现。**字面写法**在**提交时**就被拒，脚本压根没跑（回执里是 `error` 字段）。你用别名等动态手段把调用「藏」过了提交期检查，**运行时**一调用还是会抛错。

**原因**：这三个都会破坏**可重放性**。续传（`resumeFromRunId`）靠的是「同样的脚本 + 同样的输入 → 同样的执行路径」，运行时据此判断哪些 `agent()` 调用没变、可以复用缓存。脚本里掺了不确定来源，重放就对不齐了。所以它们被**两层**拦死。**第一层**是提交期的**源码静态扫描**：只要源码里出现这几个 token 的字面写法，哪怕写在注释、字符串、或永不执行的分支里，整段脚本在运行**前**就被拒，根本进不到执行。**第二层**是**运行时陷阱**：你用别名绕过了第一层，这些全局在运行时也已被改造，一调用就抛错。为什么禁得这么死，背后的确定性原理见 [第 01 章 §1.2](#/zh/p1-01)；两层的完整机理、报错原文、以及绕过和接住的误区见 [B.19](#b19-trycatch-接不住-datenow)。

**解法**：

| 你想要 | 改用 |
|---|---|
| 时间戳（命名/盖戳） | 通过 `args` 从外部传入：`args.runStamp`；或工作流返回后由主循环盖戳 |
| 随机性/打散 | 用 agent 的**下标**变化提示词（如 `parallel(items.map((it,i)=>...))` 里的 `i`），而非真随机 |
| 唯一 ID | 用稳定来源拼接：item 内容、下标、`args` 里传入的种子 |

```javascript
// ✗ 字面写法：提交期被静态扫描拒掉，脚本根本没跑（别名形式则运行时抛错）
const ts = Date.now()

// ✓ 时间戳由外部传入（调用方：Workflow({ script, args:{ runStamp: '<同步盖好的戳>' } })）
const ts = args.runStamp
```

> 标准 JS 内置（`JSON`、`Math` 的其它方法、`Array` 等等）照样能用，被禁的就这三个不确定性来源。

---

## B.6 无 `budget` 守卫的死循环

<div class="callout warn">

**症状**：工作流持续派发 agent，`budget.spent()` 不断上升，最终撞上「单工作流 agent 总数 1000」的兜底上限。如果用户设了目标，则会触发 `budget.total` 抛错。

</div>

**原因**：动态循环（「循环到干」「重试到通过」等类型）只检查业务条件、不检查预算，当模型反复无法收敛时，循环会持续运行。`budget` 是**硬上限**：`spent()` 达到 `total` 后，再调 `agent()` 会抛错。不应依赖这个兜底机制，而应主动加入预算守卫。

**解法**：循环条件里**同时**写上业务判据和预算判据。注意 `budget.total` 可能为 `null`（用户没设目标，这时 `remaining()` 是 `Infinity`），所以要用 `budget.total &&` 短路守卫，免得在「没设目标」时反倒提前退出了。

```javascript
let round = 0
const MAX_ROUNDS = 5
let done = false

while (!done && round < MAX_ROUNDS) {
  // 预算守卫：仅当用户设了目标(total 非 null)且余量不足一轮时，提前收手
  if (budget.total && budget.remaining() < 30_000) {
    log(`budget guard: ${budget.remaining()} left, stopping early`)
    break
  }
  const r = await agent(`round ${round} ...`, { schema: S })
  done = r.converged
  round++
}
```

> 你有两道护栏。第一道是你自己的 `MAX_ROUNDS` 加预算守卫，主动出手、优雅退出。第二道是运行时的 1000 agent 兜底，被动挡灾、防止失控。生产脚本应该靠第一道收尾，别去碰第二道。详见 [第 21 章 · 动态预算与规模化](#/zh/p4-21)。

---

## B.7 续传没命中缓存

**症状**：你用 `resumeFromRunId` 续传，本以为前面跑过的步骤会秒回（零 token），结果它们又**重新跑了一遍**，白白搭进时间和 token。

**原因**：缓存命中的门槛很严，下面任何一条不满足，对应的 `agent()` 就会重跑。

| 条件 | 说明 |
|---|---|
| 脚本**逐字未改** | 改了脚本（哪怕只动一行注释）会让其后的调用重新执行 |
| **同一会话** | 续传仅在同会话有效；跨会话缓存不可用 |
| 先**停掉上一次运行** | 续传前应 `TaskStop` 掉上一个 Task，再用 `resumeFromRunId` 重发 |
| 脚本**可重放** | 含 `Date.now()` 等不确定来源会破坏对齐（见 [B.5](#b5-datenow-mathrandom-抛错)） |

**解法**：

- 想**复用**前面的成果（只改后半段）：把前半段脚本逐字保持不动，改动只放在你想重跑的位置之后。
- 想**逼某段重跑**：故意改动它就行（缓存是按「这次调用变没变」来判的）。

> 真实印证：没动过的 `hello-workflow` 用 `resumeFromRunId` 续传，实测 `total_tokens=0`、`tool_uses=0`、`duration_ms=8`，返回值跟头一次一模一样（Run `wf_dacbd480-d5d` 复用，Task `w7pxch4w6`）。这就是「命中」的样子。你的续传要不是这副样子，就照上表一条条排查。详见 [第 22 章 · 断点续传与缓存](#/zh/p4-22)。

---

## B.8 嵌套超过一层抛错

**症状**：在一个被 `workflow()` 内联调起来的子工作流里，你又调了一次 `workflow()`，运行时抛错。

**原因**：嵌套**只允许一层**。父调子可以，子再调孙就抛错。这个护栏防的是递归失控：子流程跟父流程共用并发上限、agent 计数、中止信号和 token 预算，无限往下嵌套会让这些共享资源失去边界。

**解法**：

- 把「孙级」那层逻辑**摊平**进子工作流本身：直接写 `agent()`/`parallel()`/`pipeline()`，别再套一层 `workflow()`。
- 真要做多级编排，就让**主循环**去串好几个一层嵌套，而不是在脚本里一层层往下递归。

```javascript
// ✗ 子工作流内部再嵌套 → 抛错
// child.js: const x = await workflow({ scriptPath: './grandchild.js' })

// ✓ 把逻辑展平进子工作流
// child.js:
phase('Work')
const x = await agent('do the grandchild logic directly', { schema: S })
```

> 真实印证：父工作流用 `workflow({scriptPath})` 内联跑 hello 子流程，跑通了，子 agent 算进父流程的 `agent_count=1`/`total_tokens=26338`（Run `wf_85e22b38-126`）。这是**一层**，正常。详见 [第 20 章 · 嵌套 Workflow](#/zh/p4-20)。

---

## B.9 `schema` 过严导致反复重试

**症状**：某个带 `schema` 的 agent 老半天不返回、或者耗时明显偏长；从进度看它像「卡住」了。

**原因**：`schema` 的校验是在**工具调用层**做的。模型必须调 `StructuredOutput` 工具，而且输出要严格对上 schema，对不上就**重试**。schema 卡得太死（比如 `enum` 没列全、`required` 里塞了模型其实给不准的字段、数值 `pattern` 或范围太窄），模型可能得试好多次才偶然蒙对，表现出来就是变慢，甚至快要放弃。

**解法**：让 schema 管住产物的形状，但给模型留点合理的表达空间。

- `enum` 要把模型可能给的合法取值全覆盖到。拿不准就先用 `string` 跑一轮看看真实输出，再往窄了收。
- `required` 只列**真正必要**的字段，可选的信息别强制。
- 复杂的嵌套结构拆成两步走，先出文本、再结构化，比一步到位稳。
- 校验失败本来就会重试，所以偶尔重试很正常；只有**持续**重试才说明 schema 该放松了。

```javascript
// ✗ 过严：enum 漏项 + 强制模型估算它给不准的字段
schema: { type:'object', properties:{
  severity:{ type:'string', enum:['critical','high'] },   // 漏了 medium/low
  exactLineNumber:{ type:'integer' },                      // 模型常给不准
}, required:['severity','exactLineNumber'] }

// ✓ 覆盖全枚举；只强制必要字段
schema: { type:'object', properties:{
  severity:{ type:'string', enum:['critical','high','medium','low'] },
  location:{ type:'string' },        // 用描述性字符串，别逼它给精确行号
}, required:['severity'] }
```

> 反例参照：`frontend-review` 用的 `FINDINGS` schema 把 `severity` 定成四值 `enum`，其余都用 `string`，4 个 agent 顺顺当当产出 26 条发现，一点没卡（Run `wf_4c5caabb-b73`）。详见 [第 7 章 · 结构化输出与 Schema](#/zh/p2-07)。

---

## B.10 沙箱写入不会持久化

<div class="callout warn">

**症状**：你让一个 agent（或者在分析里用 `ctx_execute`、Bash 子进程）生成文件、写结果，回头在磁盘上却找不着，就误判成「它失败了」或「外部模型啥也没产出」。

</div>

**原因**：**文件写入只有原生 Write/Edit 工具会保存到磁盘**。`ctx_execute` 和 Bash 子进程是在子进程里跑的，用完就扔，它们往文件系统里写的东西**不持久化**到宿主机。同样的道理，脚本自己**没有文件系统 API**，它的产物是 `agent()` 的**返回值**（文本或结构化对象），不是磁盘上的文件。

**解法**：

- 想让文件写入磁盘：让工作流**把内容返回出来**，主循环再用 Write/Edit 写盘；或者在 agent 提示里明确要它**调用 Write 工具**（agent 手里有真实工具权限）。
- 别把「外部模型在沙箱里跑过、可磁盘上没文件」当成失败。先看看它的产物是不是以**返回值**的形式交回来了。
- 分析类的计算用 `ctx_execute` 没问题（只要你只 `console.log` 结论），但别指望它写出来的文件还在。

```javascript
// 工作流把内容当返回值交回，主循环负责写入磁盘
phase('Generate')
const doc = await agent('Write the migration guide as markdown. Return the full text.',
  { schema:{ type:'object', properties:{ markdown:{type:'string'} }, required:['markdown'] } })
return doc            // ← 主循环拿到 doc.markdown 后用 Write 写入磁盘
```

---

## B.11 结果里的 `null` 没过滤

**症状**：`parallel()` / `pipeline()` 返回的数组里混进了 `null`，紧跟着的 `.map(r => r.field)` 就抛 `Cannot read properties of null`。

**原因**：这两个原语都拿 `null` 来表示「这一项没有效结果」。三种情形：

- `parallel`：某个 thunk **异步失败**（返回的 promise reject，或者里头的 `agent()` 出错），该位置变 `null`，调用本身不 reject。注意 thunk 体内的**同步 `throw` 不会变 `null`**，它会 reject 整个 `parallel()` 调用，`.filter(Boolean)` 拦不住。但在 `await parallel(...)` 外面套 `try/catch` 能接住，workflow 仍能活着，只有没接住时才会崩（见 [B.17](#b17-parallel-thunk-体内同步-throw没接住就崩)）。
- `pipeline`：某个 item 在某 stage **抛错**（同步或异步都算），该 item 变 `null` 并跳过其余 stage。
- `agent`：用户**中途跳过**该 agent，返回 `null`。

**解法**：用结果之前，一律先 `.filter(Boolean)`。

```javascript
const results = (await parallel(thunks)).filter(Boolean)   // ✓ 先滤掉 null
const titles = results.map(r => r.title)                   // 现在安全
```

> 在 `pipeline` 内部跨 stage 合并时也得防一手：上一阶段可能给 `null`，下一阶段的回调就要先判空，或者确保只在过滤后的集合上往下走。详见 [第 8 章 · parallel vs pipeline](#/zh/p2-08)。

---

## B.12 并发块内的 `phase()` 竞争

**症状**：一用上 `parallel`/`pipeline`，进度树里的 agent 就归错了阶段，或者 phase 标签看着像在「抢来抢去」。

**原因**：全局 `phase()` 是**带状态**的，它一切换「当前阶段」，后面的 `agent()` 就归到那个阶段。可在 `parallel`/`pipeline` 里头，好几个 agent **并发**跑着，它们要都去依赖那个全局当前阶段，就会互相抢（谁先调谁后调说不准），归组也就跟着乱了。

**解法**：在 `parallel`/`pipeline` 内部，**永远用 `opts.phase` 显式归组**，不要去依赖外层的 `phase()`。`opts.phase` 的字符串要跟 `meta.phases[].title` 精确匹配。

```javascript
// ✓ 每个并发 agent 自带 phase，不争全局状态
const reviews = await parallel(dims.map(d => () =>
  agent(d.prompt, { label:`review:${d.key}`, phase:'Review', schema:FINDINGS })))
```

> `frontend-review` 和 `judge-panel` 的真实脚本，都在 `parallel` 里逐个写了 `phase:'Review'`/`phase:'Judge'`，正是为了这个。详见 [第 5 章 · meta 与 phase](#/zh/p2-05)。

---

## B.13 `args` 未传或字段错位

**症状**：脚本里读 `args.foo` 读到的是 `undefined`，逻辑全跑去走空分支了。

**原因**：`args` 就是 Workflow 入参 `args` 的值，**没传**它就是 `undefined`。常见的几种：调用时忘了带 `args`、字段名拼错了、或者把 `args` 和 `name`/`script` 的层级混淆了。

**解法**：

```javascript
// 调用方：args 是 WorkflowInput 的顶层字段
// Workflow({ script: '...', args: { target: 'src/auth', maxRounds: 3 } })

// 脚本里：先给默认值兜底，别假定一定有
const target = args?.target ?? 'src'
const maxRounds = args?.maxRounds ?? 5
```

> `args` 特别适合用来参数化**具名工作流**（`name` 加 `args`），让同一段逻辑套到不同输入上复用。详见 [附录 A](#/zh/app-a)。

---

## B.14 把异步回执当成结果

**症状**：期望 Workflow 工具返回工作流的「最终结果」，实际拿到的是 `{ status, taskId, runId, ... }`，因此误以为没有运行成功，或试图从中直接读取返回值。

**原因**：Workflow 工具**始终异步**。它立刻返回一个**回执**（`status` 只有 `"async_launched"` 或 `"remote_launched"` 两种取值），工作流在后台继续运行。**真正的返回值和用量统计**（`agent_count`/`tool_uses`/`total_tokens`/`duration_ms`）在完成时通过 `<task-notification>` 送达。

**解法**：

- 把 `taskId`/`runId` 收好：前者拿来追踪和停止（TaskStop），后者拿来续传（`resumeFromRunId`）。
- 想看实时进度，用斜杠命令 `/workflows`。
- 想拿结果就**等通知**，不要在回执里翻结果字段。

> 真实形态：第一批全部 10 次完成记录、9 个唯一 Run ID 的回执，都是先给 `taskId` 和 `runId`，用量数字全部来自完成通知（见 [附录 E](#/zh/app-e)）。

---

## B.15 pipeline 单项静默掉队

**症状**：`pipeline(items, ...)` 传进去 N 项，最后 `out.filter(Boolean).length < N`，有几项「没了」，可你又没看到明显报错。

**原因**：`pipeline` 的容错粒度是**单项**。某一项在任意 stage 抛错，**这一项**立刻变 `null`、跳过它**余下所有 stage**，但别的项不受牵连，照样往下流。一项坏了不拖垮整批是优点；可你要只盯最终条数，就会以为「丢数据了」。

**解法**：

- 认下这是设计如此：把 `null` 理解成「这一项在某个阶段失败了，已经被安全跳过」。
- 想搞清楚**为什么**掉队：在 stage 内部用结构化返回带上状态，或者让那个 stage 的 `agent` schema 多带一个 `ok`/`reason` 字段，事后统计。
- 关键路径上不允许丢项的话，可以在每个 stage 里 `try` 住、返回「降级结果」而别抛错，这样就能保住这一项接着往下走。

```javascript
const out = await pipeline(items,
  (it) => agent(`stage1 ${it}`, { phase:'S1', schema:A }),
  (r, it) => agent(`stage2 ${it}`, { phase:'S2', schema:B }),
)
const ok = out.filter(Boolean)
log(`pipeline kept ${ok.length}/${items.length} items`)   // 显式记录掉队
```

> 真实印证：`pipeline-demo` 3 项 × 2 阶段全部活下来，`agent_count=6`、返回 3 条（Run `wf_bf086b98-6ec`）。没掉队，是因为没有 stage 抛错。详见 [第 8 章 · parallel vs pipeline](#/zh/p2-08)。

---

## B.16 想在脚本里用 Node API

**症状**：脚本里写了 `require(...)`、`fs.readFile`、`fetch(...)`、`process.env`，运行时要么报未定义、要么抛错。

**原因**：脚本运行在一个**受限的 `async` 沙箱**里。标准 JS 内置（`JSON`、`Math`、`Array`、`Object`、`Promise` 等等）能用，但**没有**文件系统、网络、`require`、Node 全局。工作流的副作用全靠 `agent()` 派出去的 subagent 来干，握着真实工具权限的是它们，不是脚本本身。

**解法**：

| 你想做 | 在脚本里 | 正确做法 |
|---|---|---|
| 读文件 | ✗ `fs.readFile` | 让 agent 读：`agent('Read src/x.ts and summarize ...')` |
| 联网/抓取 | ✗ `fetch` | 让 agent 用其工具抓取，或预先把数据通过 `args` 传入 |
| 写文件 | ✗ `fs.writeFile` | agent 调 Write 工具，或返回内容由主循环写入磁盘（见 [B.10](#b10-沙箱写入不会持久化)） |
| 引第三方库 | ✗ `require('lodash')` | 用标准 JS 内置实现，或把计算交给 agent |
| 读环境变量 | ✗ `process.env` | 通过 `args` 显式传入需要的值 |

```javascript
// ✗ 脚本无 Node API
const src = require('fs').readFileSync('src/auth.ts', 'utf8')

// ✓ 让 subagent 去读，脚本只编排
const review = await agent('Read src/auth.ts and list security issues.',
  { schema: FINDINGS })
```

---

## B.17 `parallel` thunk 体内同步 throw（没接住就崩）

<div class="callout warn">

**症状**：一个本该「尽力而为」的 `parallel()` 调用，外层又没 `try/catch`，整个 workflow 就**莫名失败**：回执或通知里 status 是 `failed`、`total_tokens=0`、`duration_ms` 才几十毫秒，agent 几乎一个都没真跑起来（也就是「`0 token` 秒退」）。你以为「某个 thunk 抛错顶多变 `null`」，结果整批一块崩了。

</div>

**原因**：这跟 [B.4](#b4-parallel-传了-promise-而非-thunk) 是**姊妹陷阱**。B.4 是「类型传错了（传了 Promise 而非 thunk）」，本条是「thunk 传对了，但 thunk **函数体里同步 `throw`**」。`parallel()` 是一个个**调用** thunk 的。thunk 体里有同步 `throw`（比如裸 `throw`、`JSON.parse` 失败、断言、下标越界），异常会在 `parallel()` 拿到 promise **之前**就往上抛，于是它**没有机会把这一格收集成 `null`**，整个 `parallel()` 调用直接 **reject**。这跟异步失败是两套语义：异步 reject 只把那一格变 `null`，同步 throw 则掀掉整个调用。

**但「调用 reject」不等于「运行必崩」**。在 `await parallel(...)` 外面套一层 `try/catch`，就能**接住**它，workflow **照样活着**（实测 `wf_b7c75d40-c26`：`callRejected:true`、`caughtByTryCatch:true`、`runSurvived:true`）；只有**没接住**的同步 throw 才会把整个运行中止。还要注意：工具文档那句「a thunk that throws resolves to null」只对**返回的 promise 异步 reject**成立，对**同步 throw 不成立**。

```javascript
// ✗ thunk 体内同步 throw + 外层没 try/catch → 整个 parallel() reject → workflow 失败（0 token 秒退）
await parallel([
  () => agent('ok-1'),
  () => { throw new Error('boom') },                 // 同步抛，穿透 parallel
  () => agent('ok-2'),
])

// ✓ 给 await 套 try/catch：调用照样 reject，但被接住、workflow 活着（实测 runSurvived:true）
let results = []
try {
  results = await parallel([
    () => agent('ok-1'),
    () => { throw new Error('boom') },               // 同步抛 → parallel() reject
    () => agent('ok-2'),
  ])
} catch (e) { /* 接住 → 运行继续；但这一整批结果都没了，不像异步那样只丢一格 */ }

// ✓ 把风险逻辑移进被 await 的 agent() 调用里（只有异步路径才归集为 null）
await parallel([
  () => agent('ok-1'),
  () => agent('do the risky thing'),                  // 风险在异步路径内 → 出错变 null
  () => agent('ok-2'),
])

// ✓ 或自己 try/catch，把同步失败降级为可过滤的 null
await parallel([
  () => agent('ok-1'),
  async () => { try { return riskySync() } catch { return null } },
  () => agent('ok-2'),
])
```

**解法**：

- **把有风险的同步逻辑挪进 `agent()` 的异步路径**。`parallel()` 只对异步 reject 做「→ `null`」归集，这样单格出错变 `null`、其余照跑，是最省心的写法。
- 实在要在 thunk 体里做同步计算，就**自己 `try/catch`**、返回 `null`（或降级值），别让它裸抛。
- 兜底：在 `await parallel(...)` 外面套 `try/catch`。同步 throw 仍会 reject 整个调用，但你**接住了**它，运行就不会崩（实测 `runSurvived:true`）。代价是这一整批结果全丢，不像异步 reject 那样只丢一格。
- 用结果之前一律 `.filter(Boolean)`（见 [B.11](#b11-结果里的-null-没过滤)）。但要记牢：`.filter(Boolean)` 只能滤掉**异步 reject 产生的 `null`**，**对同步 throw 无能为力**（调用都 reject 了，你压根拿不到那个数组）。同步 throw 该靠上面那层 `try/catch` 兜，而不是 filter。

> 真实印证：脚本就一句 `parallel([好, () => { throw ... }, 好])`、外层没接，实测 workflow 状态 **failed**、`agent_count=1`、`total_tokens=0`、`duration_ms=26`（Run `wf_ed5e87f3-435`）。但只要在 `await` 外面套上 `try/catch`，同一个同步 throw 就被接住、运行存活（Run `wf_b7c75d40-c26`：`callRejected:true`、`caughtByTryCatch:true`、`runSurvived:true`）。同步 throw 跟异步 reject 的差别，又在 Run `wf_74ebe5ac-2db` 被反向印证：异步 reject 时那一格变 `null`、其余活着、workflow 完成。对照和原理见 [第 8 章 · §8.8 失败语义](#/zh/p2-08)。

---

## B.18 无条件 `JSON.parse(args)` 的误解

<div class="callout warn">

**症状**：脚本里写了 `const cfg = JSON.parse(args)`，结果要么当场抛 `Unexpected token o in JSON`（因为 `args` 本就是对象，被 `String()` 成 `"[object Object]"` 后再解析就崩了），要么把本来好端端的嵌套对象解析坏。你以为 `args` 是一段 JSON 文本，其实它是**已经反序列化好的对象**。

</div>

**原因**：`args` 是 Workflow 入参 `args` 的**原样**值：**对象保持对象、数组保持数组**，运行时**不会**给它字符串化。实测把 `{ hello:'world', n:5, nested:{ deep:true } }` 传进去，脚本里看到的就是 `typeof args === 'object'`、字段原样可见、`Array.isArray(args) === false`（Run `wf_59bf3654-183`，见 [附录 E · R4 沙箱记录](#/zh/app-e)）。对一个本就是对象的值再 `JSON.parse`，等于先隐式 `String(对象)` 拿到 `"[object Object]"`、再去解析，那必然失败。

**解法**：**先归一化、再读字段**。只有当 `typeof args === 'string'` 时才（带着 `try/catch`）`JSON.parse`，否则直接当对象用。绝不无条件 `JSON.parse(args)`。

```javascript
// ✗ 无条件 parse：args 是对象时直接抛错
const cfg = JSON.parse(args)

// ✓ 归一化 idiom：字符串才 parse，其余原样当对象
function readArgs(a) {
  if (a == null) return {}
  if (typeof a === 'string') {
    try { return JSON.parse(a) } catch { return {} }   // 容错：解析失败给空对象
  }
  return a                                              // 已是对象/数组：原样返回
}

const cfg = readArgs(args)
const target = cfg.target ?? 'src'
```

> 配套：`args` 没传时是 `undefined`，字段错位也会读到 `undefined`，见 [B.13](#b13-args-未传或字段错位)。这儿强调的是**类型**：它是对象，不是字符串。

---

## B.19 try/catch 接不住 `Date.now()`

<div class="callout warn">

**症状**：你「保险起见」给 `const ts = Date.now()` 套了 `try/catch`，指望失败时走兜底分支。结果**整个工作流压根没启动**（回执里直接是 `error` 字段），你那个 `catch` 一次都没轮到。换种写法（`const D = Date; D.now()`）倒是跑起来了，却在运行时抛错。

</div>

**原因**：确定性禁用是**两层防护**，而 `try/catch` 对它基本使不上劲：第一层根本拦不住，第二层虽能 `catch` 却不该依赖。

1. **字面量在提交时被静态拒绝**：`Date.now()` / `Math.random()` / 无参 `new Date()` 的**字面写法**，会被一道**源码静态扫描**在脚本**解析、运行之前**就拦下。脚本压根不执行，工具直接返回错误（原文：`Workflow scripts must be deterministic: Date.now()/Math.random()/new Date() are unavailable (breaks resume)…`，见 `sandbox-r4.md`）。脚本都没跑，`try/catch` 自然无从谈起。
2. **别名形式是运行时陷阱**：把调用「藏」起来（`const D = Date; D.now()`）能骗过静态扫描、顺利提交，但运行时注入的陷阱会**抛错**：`Date.now() / new Date() are unavailable in workflow scripts (breaks resume)…`。`Math.random()` 那条还顺手提示了解法：`…For N independent samples, include the index in the agent label or prompt.`（两层都实测过，Run `wf_59bf3654-183`）。

**解法**：别想着去「绕过」或者「接住」它，照 [B.5](#b5-datenow-mathrandom-抛错) 的办法从根上躲开：时间戳用 `args` 传进来或事后盖戳，随机性靠 agent 下标去变化提示词。

```javascript
// ✗ 字面量：提交期静态拒绝，脚本不运行，catch 形同虚设
try { const ts = Date.now() } catch { /* 永远到不了这里 */ }

// ✗ 别名：骗过静态扫描，但运行时抛错
const D = Date; const ts = D.now()      // 运行时 throw

// ✓ 从源头避开（见 B.5）
const ts = args.runStamp                // 外部传入，可重放
```

> 为啥管这么严？续传要的是「同脚本 + 同输入 → 同执行路径」，任何不确定来源都会把对齐搅黄。两层防护就是要让你**不可能**把不确定性偷渡进一个可重放的脚本里。这套确定性原理在 [第 01 章 §1.2](#/zh/p1-01) 讲得最透。

---

## B.20 `isolation` 拼错被静默忽略

<div class="callout warn">

**症状**：期望某个会改文件的 agent 运行在隔离的 git worktree 里，写了 `isolation: 'worktreee'`（多敲了一个 e）。**没有任何报错**，agent 正常返回，但实际**未被隔离**，与其他 agent 共用同一个工作目录，并行改文件时照样冲突。错误被「成功」的表象掩盖。

</div>

**原因**：运行时对 `isolation` 只**特判两个值**：`'worktree'`（执行隔离）和 `'remote'`（本 build 禁用，会抛 `agent({isolation:'remote'}) is not available in this build`）。**其它任何未知值都被静默忽略**，agent 就按默认（不隔离）照常跑。实测 `isolation: 'totally-bogus'` **不抛错、返回 OK**，只有 `'remote'` 抛错（Run `wf_dace2fc6-966`，见 [附录 E · R4 opts 校验记录](#/zh/app-e)）。所以拼错的 `'worktreee'` 跟「没写 isolation」是一回事。

**解法**：写 `isolation` 的时候**逐字核对**只能是 `'worktree'`，不要指望运行时报错来帮你抓拼写。要不要隔离的判断标准见 [第 19 章](#/zh/p4-19)（仅当并行改文件会冲突时才用，它昂贵）。

```javascript
// ✗ 拼错被静默忽略：agent 没隔离，并行改文件仍冲突，且无任何报错
await agent('refactor src/auth.ts', { isolation: 'worktreee' })

// ✓ 逐字写对
await agent('refactor src/auth.ts', { isolation: 'worktree' })
```

> 对照：`agentType` 拼错会**立即抛错**（见 [B.21](#b21-model-拼错不在提交期报错) 末尾），`isolation` 拼错却被吞掉。都是 opts 字段，校验严不严却不一样，务必记牢哪些会报错、哪些会沉默。

---

## B.21 `model` 拼错不在提交期报错

<div class="callout warn">

**症状**：`model: 'opus'` 误写为 `model: 'oputs'`，期望提交时被拦截。但脚本正常提交、agent 也正常运行，因此误以为该 model 名是合法的。

</div>

**原因**：`model` 字符串**没有提交期或解析期校验**。实测拿一个明摆着不存在的 `model: 'totally-not-a-real-model-xyz'`，既没在提交期被拒，agent 也照常返回 OK（Run `wf_dace2fc6-966`）。

<div class="callout info">

**实测的诚实边界**：本会话里 `CLAUDE_CODE_SUBAGENT_MODEL` 把一切 per-call `model` 都盖掉了（实跑的是 Opus），所以那个 bogus 字符串**从未真正发往 API**。也就是说「拼错会在 API 调用时失败」这一步，本会话**未能观测到**（社区第三方资料如此声称，本书未独立实测）。能确认的只有一条：**提交期不报错**。

</div>

**对比 `agentType`（有校验）**：未知的 `agentType` 会在**生成任何模型之前**（0 token / 4ms）就抛错，还把全部可用 agent 列给你，原文是 `agent({agentType}): agent type '…' not found. Available agents: claude, claude-code-guide, codex:codex-rescue, Explore, general-purpose, …`（Run `wf_a222f20f-0f5`）。这种「`agentType` 严校验、`model` 不校验」的不对称，是真实可教的差异。

```javascript
// ✗ model 拼错：提交期不报错，你拿不到早期反馈
await agent('do x', { model: 'oputs' })          // 静默通过

// ✗ agentType 拼错：立即抛错并列出可用 agent（0 token）
await agent('do x', { agentType: 'code-reviewr' })   // throw

// ✓ 两者都逐字核对；尤其 model 没有「拼错保护网」
await agent('do x', { model: 'opus', agentType: 'Explore' })
```

> 实践含义：`model` 拼错的代价**滞后**（最坏要到 API 层才暴露），所以更要靠 code review 或校验器（见 [附录 E · validator-r4](#/zh/app-e)）在提交前就抓住，别指望运行时替你兜底。

---

## B.22 budget 守卫漏 `total` 短路

<div class="callout warn">

**症状**：一个「循环到干 / 重试到通过」的动态循环，你本想拿预算守卫提前收手，却写成了 `if (budget.remaining() < 30000) break`。等到**用户没设 token 目标**时，这个守卫**永不触发**，循环就一路跑到运行时那道 **1000 agent 兜底上限**才被逼停，白白烧掉一大把 token。

</div>

**原因**：没设目标时 `budget.total === null`，`budget.remaining()` 返回的是 **`Infinity`**（`total===null` 的实测见 Run `wf_59bf3654-183`；budget 探针 `wf_fd09a6ed-38a` 实测返回 `{ totalIsNull:true, remainingBefore/After:"Infinity", guardRounds:0 }`，见 `r3-reverification.md`）。于是 `Infinity < 30000` 永远是 `false`，守卫形同虚设。你再把这守卫**当成唯一的循环出口**，循环就只剩业务条件这一道兜底了，业务一旦收敛不了，就一路撞上 1000 上限。

这条其实是 [B.6](#b6-无-budget-守卫的死循环) 的**精确化版本**：B.6 说「要有预算守卫」，本条说「守卫**必须**用 `budget.total &&` 短路，不然在『没设目标』这个最常见的情形下，它根本不工作」。

**解法**：守卫**始终**写成 `budget.total && budget.remaining() < 阈值`，只有用户真设了目标（`total` 非 null）时才让它生效；同时**永远**再配一个独立的 `MAX_ROUNDS` 硬上限，给「没设目标」时兜底。

```javascript
// ✗ 漏 total 短路：未设目标时 remaining()===Infinity，守卫永不触发，跑到 1000 上限
while (!done) {
  if (budget.remaining() < 30_000) break      // Infinity < 30000 → 永远 false
  const r = await agent(`round ${round++} ...`, { schema: S })
  done = r.converged
}

// ✓ total 短路 + 独立轮次硬上限（两道闸都不依赖对方）
let round = 0
const MAX_ROUNDS = 5
while (!done && round < MAX_ROUNDS) {          // ① 没设目标时由它兜底
  if (budget.total && budget.remaining() < 30_000) {   // ② 设了目标才生效
    log(`budget guard: ${budget.remaining()} left, stopping`)
    break
  }
  const r = await agent(`round ${round} ...`, { schema: S })
  done = r.converged
  round++
}
```

> 三道护栏各管一摊。`MAX_ROUNDS` 主动出手，对「没设目标」也管用；`budget.total &&` 守卫对「设了目标」的情形精准收尾；运行时 1000 agent 兜底则被动挡灾、防止失控。生产脚本应靠前两道收口，**绝不**拿 1000 当正常的退出点。详见 [第 21 章 · 动态预算与规模化](#/zh/p4-21)。

---

## B.23 排错心法（收尾）

上述问题可以归结为三条通用的排错判断：

1. **失败是发生在「启动前」还是「执行中」？** 启动前就看 `error` 字段（`meta` 或语法，[B.2](#b2-meta-非静态字面量（static literal）被拒)/[B.3](#b3-语法错落进-error-字段)），不花钱；执行中就看完成通知和 `null`（[B.5](#b5-datenow-mathrandom-抛错)/[B.11](#b11-结果里的-null-没过滤)/[B.15](#b15-pipeline-单项静默掉队)）。
2. **是不是把「沙箱」当成了「主机」？** 脚本没有 Node API，`ctx_execute` 和子进程的写入也不会保存到磁盘，所以副作用和文件操作都得过 agent 的真实工具（[B.10](#b10-沙箱写入不会持久化)/[B.16](#b16-想在脚本里用-node-api)）。
3. **是不是跟「可重放、确定性」较上劲了？** 禁用不确定来源，续传严格按「脚本逐字未改加同会话」来命中。这套约束换回来的，是确定性骨架和零成本缓存（[B.5](#b5-datenow-mathrandom-抛错)/[B.7](#b7-续传没命中缓存)）。

> 配套阅读：可勾选的正向清单见 [附录 C · 最佳实践清单](#/zh/app-c)，术语不清查 [附录 D · 术语表](#/zh/app-d)，字段语义查 [附录 A · API 完整参考](#/zh/app-a)。

---

## B.24 跨平台 corner cases（Windows / macOS / Linux）

> 前提（贯穿本节）：本书所有实测都在**单台 macOS（Darwin 25.5.0）**上跑，**没有任何 Windows / Linux 实测数据**。所以本节每条都严格分成两类证据。一类是**【平台无关·已实测】**：行为发生在 JS 运行时层、跟操作系统无关，机理是「同一个 JS 引擎跑同一段脚本」，所以哪怕只在 macOS 上跑过，结论对三平台一样成立。另一类是**【推断·未实测】**：行为**真的可能因平台而异**，比如路径、大小写、shell、git，这些**只能靠机理加通用知识推断**，会明确标着「未在 Windows / Linux 实测」，**绝不写成已实测的确定结论**。

### 本节对 workflow 作者的提醒

编写的 workflow 脚本终将在其他人的机器上运行：可能是同事的 Windows 笔记本，可能是 CI 里的 Linux 容器，也可能是 GitHub Pages 这类大小写敏感的部署环境。**一段在 Mac 上正常运行的脚本，换到其他平台可能出错。** 需要提前分清哪些部分可能出问题、哪些部分是稳定的。

最关键的一条认知：**Workflow 脚本本体运行在一个 JS 沙箱里，而这个沙箱在三个平台上是同一套实现**。因此脚本逻辑层面的行为（确定性守卫、`args` 传递方式、`require/process/fetch` 缺席、30000ms 同步超时、错误传播机制）**与操作系统无关**。真正可能因平台而异的行为，全部发生在**沙箱之外**：在 `agent()` 叶子里让 subagent 接触文件系统或 shell（此时才触及真实操作系统），或者涉及 git worktree、部署环境等外部设施。

下面把这两类掰开来讲。

### B.24.1 平台无关的那一半（已实测，三平台一致）

这些行为全发生在 JS 运行时层。机理很简单：**Workflow 的脚本沙箱是同一个 JS 引擎实现，三平台跑的是同一段代码、走同一条判定逻辑**。所以本书在 macOS 上的实测结论，可以直接外推到 Windows / Linux。这不是「猜它们一样」，而是「它们本来就是同一层」。

**① 确定性守卫是源码字符串级的扫描，连字符串里的 token 都拒。** 证据等级：**【平台无关·已实测】**（macOS 实测，机理决定三平台一致）。Workflow 禁用 `Date.now()` / `Math.random()` / 无参 `new Date()`，理由是它们破坏可重放性，续传就废了。这层静态扫描**不区分「真的调用」和「只是字符串里提到」**：哪怕这三个 token 裹在一个字符串字面量里、从头到尾**永不执行**，整个 workflow 也会在**提交时**就被拒，报错原文是：

```
Workflow scripts must be deterministic: Date.now()/Math.random()/new Date() are unavailable (breaks resume). Stamp results after the workflow returns, or pass timestamps via args.
```

之所以说平台无关：这层扫描发生在 Claude Code 收到脚本、提交给 Workflow 运行时**之前**，纯粹是源码文本匹配。Windows、macOS、Linux 上提交同一段含这种字符串的脚本，**都会被同样拒绝**。真正的 corner case 在这儿：你的 agent prompt 文本里**想提到这三个 API**（比如写一个「教 agent 别用非确定性 API」的 workflow，prompt 里很自然会写「不要使用 `Date.now()`」），**整个 workflow 会被这层扫描误伤、直接拒掉**。

```javascript
// 场景：prompt 里确实要提到这几个 API 的名字
// 绕法 A：把 token 拆开拼接，让静态扫描匹配不到完整串
const apiName = 'Date' + '.now()';        // 扫描器看到的是两个片段，不是完整 token
const warn = '不要在脚本里调用 ' + 'Math' + '.random()';

// 绕法 B：换个措辞，根本不写出完整 token
const warn2 = '不要用会破坏可重放性的时间/随机 API（如取当前毫秒数、伪随机数）';
```

<div class="callout warn">

**误伤陷阱**：守卫扫的是源码文本，不是真实调用。你在字符串里写 `Date.now()` 本想拿它当文档或提示，也照样会让整个脚本提交失败。要么拆开拼（`'Date'+'.now()'`），要么换个措辞。三平台一律拒。

</div>

**② `args` 原样透传，读字段前必须归一化。** 证据等级：**【平台无关·已实测】**（`wf_59bf3654-183`）。你传 `{hello, n, nested:{deep}}` 进去，脚本里 `args` 就是个对象：`typeof args === 'object'`、`Array.isArray(args) === false`、**不会被字符串化**；不传它就是 `undefined`。这套行为由 JS 运行时注入决定，**三平台一致**。实践提醒（也是个平台无关的坑）：**别无条件 `JSON.parse(args)`**，只有当 `typeof args === 'string'` 时才（带着 try/catch）parse，不然对象会被你 parse 报错。

**③ 宿主 API 缺席：`require` / `process` / `fetch` 全是 `undefined`。** 证据等级：**【平台无关·已实测】**（`wf_59bf3654-183`）。脚本沙箱里**没有** Node 那套：`require`、`process`、`fetch` 全是 `undefined`，没有文件系统、没有网络。这是沙箱的设计，**三平台一律如此**，没有「Windows 上能 `require`、Mac 上不能」这种事。这一条直接逼出一个**架构铁律**（对跨平台特别关键）：**所有碰文件、碰 shell、碰网络的活，只能塞进 `agent()` 叶子里**（只有 subagent 才有 Read/Write/Bash）。换句话说，**脚本本体永远平台无关，平台差异全被挤到 `agent()` 叶子那一层**。你想搞清楚「我这 workflow 在 Windows 上会不会出问题」，只要盯着 `agent()` 叶子里干了啥就行（见 B.24.2）。

**④ 30000ms 同步超时、错误传播语义。** 证据等级：**【平台无关·已实测】**（`wf_e3b2b123-5f4`，实测 30222ms 被中止）。一段长长的同步循环（`for(i=0;i<1e12;i++)`）会在 30000ms 被运行时掐断、workflow 标记 failed，报错 `Error: Script execution timed out after 30000ms`。这个上限只管**同步**执行（专抓死循环），异步 workflow 不受它约束。它是运行时的看门狗，**跟平台无关**，不会因为 Windows 的时钟精度或 Linux 的调度策略就变成别的数。

错误传播同样在 JS 运行时层、三平台一致，但你得**分清三种情况、别混为一谈**（与 [第 8 章 p2-08](#/zh/p2-08) 对照表一致）。第一种，**异步**出错：thunk 或 stage 返回的 Promise reject，或者 `agent()` 自己失败，只把**那一个**槽位或 item 变成 `null`，其余照常跑完、workflow 整体仍判 success（`wf_bbeb54c0-750`：`parallel` 拿到 `['P0', null, 'P2']`、`pipeline` 拿到 `['S2-A', null]`）。第二种，**`pipeline` 的 stage 体内同步 `throw` 也只隔离成 `null`**（`wf_76a9b42b-86f`：`['S2-A<-S1-A', null, 'S2-C<-S1-C']`，该 item 跳过其余 stage、别的 item 照常、workflow 成功）。第三种，**唯一会掀掉「收集成 `null`」语义的，是 `parallel` 的 thunk 体内同步 `throw`**：它在 `parallel` 拿到 promise 之前就穿透了那套逻辑、reject 整个 `parallel()` 调用。这种情况下，外层**没接住**就直接标记 failed（`wf_6cc89add-680`，0 token 就终止），但在 `await` 外面套 `try/catch` 就能接住、运行存活（`wf_b7c75d40-c26`：`runSurvived:true`；另见 [B.17](#b17-parallel-thunk-体内同步-throw没接住就崩)）。一句话：四种组合里只有「`parallel` thunk + 同步 throw」会 reject 整个调用（没接住才崩库），其余三种都隔离成 `null`。这跟操作系统无关，取决于 JS 引擎怎么区分同步异常和 Promise rejection，三平台一致。

**⑤ `meta` 必须静态字面量（static literal），外加各种校验。** 证据等级：**【平台无关·已实测】**。`meta` 必须是静态字面量（static literal）（保留键比如 `constructor` 会被拒）；未知的 `agentType` 在生成模型前就抛错并列出可用 agent；`isolation:'remote'` 被拒，而 `isolation:'totally-bogus'` 被静默忽略。这些校验全在运行时或提交期完成，**与操作系统无关，三平台一致**。机理跟 ① 一样：扫的是脚本结构和取值，不是 OS 行为。

<div class="callout info">

**一句话记住第一部分**：脚本沙箱是同一个 JS 引擎，脚本逻辑层面的一切（守卫、args、缺席的宿主 API、超时、错误传播、各种校验）**三平台一模一样**。本书虽说只在 macOS 实测，但这层的结论可以放心外推，它本来就跟 OS 无关。

</div>

### B.24.2 真正可能因平台而异的那一半（推断·未实测，按机理标注）

下面这些**确实会因平台不同而表现不同**。本书**没有 Windows / Linux 实测数据**，所以每条都是「机理推断加通用知识」，**请当成『需要你在目标平台自己验证』的提醒，而不是已证实的结论**。

**① 路径分隔符与文件名大小写敏感性（最常见的跨平台坑）。** 证据等级：**【推断·未实测】**。这属于**通用跨平台知识**，**不是本特性的实测结论**。本书没在 Windows / Linux 上实测过 `agent()` 叶子的文件读写行为。回想 B.24.1 ③：文件操作只能在 `agent()` 叶子里发生（subagent 用 Read/Write/Bash）。一碰文件，就踩进了真实操作系统的地盘，而这恰恰是经典的跨平台雷区。

- **路径分隔符**：Unix 系（macOS / Linux）用 `/`，Windows 原生用 `\`（虽说多数 API 也认 `/`）。你在 prompt 里硬编码 `dir/sub/file.txt` 这种路径让 subagent 去读写，**在 Windows 上稳不稳，取决于 subagent 实际用的工具或 shell 怎么解析**。本书未实测，按通用知识推断这里有风险。建议让 subagent 用相对路径，或者在 prompt 里把话说清楚「用你所在平台的原生路径写法」，别替它去拼绝对路径。

- **大小写敏感性**（这条尤其要命）：
  - macOS 默认文件系统（APFS）**大小写不敏感**，`README.md` 和 `readme.md` 被当成同一个文件。
  - Linux（ext4 等）**大小写敏感**，这俩是两个不同文件。
  - **GitHub Pages 部署环境是 Linux、大小写敏感**。

  你在 Mac 上写 workflow，让某个 `agent()` 生成 `Foo.md`，下游另一个 `agent()` 去读 `foo.md`，**在你 Mac 上正好读得到（大小写不敏感），一换到 Linux / GitHub Pages 就读不到、链接 404**。这是**本书部署本身就得当心的坑**（本 cookbook 的英文镜像走 GitHub Pages），但**它属于通用跨平台知识，不是 Workflow 特性的实测行为**。

<div class="callout warn">

**大小写陷阱（推断·未实测）**：Mac 默认大小写不敏感，Linux / GitHub Pages 大小写敏感。让 `agent()` 写文件、又让下游 `agent()` 读文件时，**文件名大小写必须完全一致**，不然 Mac 上跑通、Linux 上 404。本书未在 Linux 实测此现象，仅按文件系统的通用机理提醒一句。

</div>

**② worktree 隔离需要 git 仓库，非 git 目录下的行为待验证。** 证据等级：**【推断·未实测】**。`opts.isolation:'worktree'` 的机理是「在一个**独立的 git worktree** 里跑这个 agent」（昂贵，约 200-500ms 启动外加磁盘和 agent 开销，仅在并行改文件会冲突时用）。`git worktree` 是 git 的功能，**前提是当前目录得在一个 git 仓库里**。由此**推断**（未实测）：你在一个**非 git 目录**（或没初始化 git 的项目）里用 `isolation:'worktree'`，底层的 `git worktree add` 没仓库可挂，**很可能失败或退化**。但具体是抛错、还是静默退化成「不隔离」（类比 B.24.1 ⑤ 里 bogus isolation 被忽略那种行为），**本书没测过，不下结论**。这条跟 OS 关系不大，跟「有没有 git 仓库」关系更大，但它确实是个会让 workflow 在某些环境翻车的 corner case。安全做法：用 `isolation:'worktree'` 的 workflow，文档里写明「需在 git 仓库根目录运行」。

> 补充（推断）：worktree 还隐含一个前提，就是「目标平台装了可用的 `git`、且 worktree 子命令可用」。CI 镜像里 git 缺失或版本太老的情况确实有，同样未实测，仅作提醒。

**③ `agent()` 叶子里的 shell 差异。** 证据等级：**【推断·未实测】**。`agent()` 叶子里的 subagent 能跑 Bash。本书所有 Bash 实测都在 macOS（zsh/bash）上。**推断**（未实测）：你在 prompt 里让 subagent 跑**类 Unix shell 命令**（`ls`、`grep`、`rm -rf`、管道、`&&`），在 macOS / Linux 上预期一致；**一到 Windows**，原生 `cmd` / PowerShell 的语法、命令名、路径写法全不一样。这段命令跑不跑得起来，**取决于 Windows 那台机器上 subagent 的 Bash 到底由什么提供**（比如 Git Bash、WSL，或者啥都没有）。本书**完全没在 Windows 上验证过**，所以**不能保证**你硬编码的 shell 命令跨平台可移植。安全做法（推断层面的建议）：让 subagent 跑 shell 时**优先用跨平台稳妥的写法**，或者在 prompt 里描述「要达成什么目标」让 subagent 自己挑平台合适的命令，别把一长串 Unix-only 命令钉死在 prompt 里。

<div class="callout warn">

**shell 可移植性（推断·未实测）**：`agent()` 叶子能跑 Bash，但本书只在 macOS 验证过。把 Unix-only 命令（`rm -rf`、管道、`&&`）钉死进 prompt，在 Windows 上跑不跑得了**未经实测**。描述目标、让 subagent 自己选命令，比硬编码命令稳。

</div>

**④ 换行符、文件编码（小坑，推断）。** 证据等级：**【推断·未实测】**，属于通用知识，非本特性实测。`agent()` 写出来的文件：Windows 习惯 `CRLF`、Unix 习惯 `LF`，编码上偶尔有 BOM 差异。下游 agent 或外部工具对换行、编码敏感（比如某些 diff、某些解析器），**可能**在跨平台时表现不同。这属于通用的文件 IO 知识，**本书未实测**，只作一句提醒，不展开。

### B.24.3 给 workflow 作者的一页速查

| corner case | 证据等级 | 三平台一致？ | 要点 |
|---|---|---|---|
| 确定性守卫扫字符串里的 token | **平台无关·已实测** | ✅ 一致 | 连字符串里的 `Date.now()` 都拒；prompt 里要提就拆写或换措辞 |
| `args` 原样透传 + 归一化 | **平台无关·已实测** | ✅ 一致 | 仅 `typeof==='string'` 才 parse，别无条件 `JSON.parse` |
| `require/process/fetch` 缺席 | **平台无关·已实测** | ✅ 一致 | 文件/shell/网络只能进 `agent()` 叶子 |
| 30000ms 同步超时 / 错误传播 | **平台无关·已实测** | ✅ 一致 | 看门狗只管同步循环；唯 `parallel` thunk 同步 throw 会 reject 整个调用（外层没 `try/catch` 才崩库，接住则存活），其余（pipeline 同步 throw、异步 reject）→单槽 `null` |
| meta/agentType/isolation 校验 | **平台无关·已实测** | ✅ 一致 | 提交/运行时校验，与 OS 无关 |
| 路径分隔符 | **推断·未实测** | ⚠️ 可能不同 | 别硬拼绝对路径；让 subagent 用原生写法 |
| 文件名大小写敏感 | **推断·未实测** | ⚠️ **会不同** | Mac 不敏感 / Linux+GitHub Pages 敏感；读写文件名大小写要一致 |
| worktree 需 git 仓库 | **推断·未实测** | ⚠️ 取决于 git | 非 git 目录行为未测；文档注明「在 git 仓库根运行」 |
| `agent()` 叶子的 shell | **推断·未实测** | ⚠️ 可能不同 | Windows shell 未实测；描述目标>钉死 Unix 命令 |
| 换行/编码 | **推断·未实测** | ⚠️ 可能不同 | CRLF/LF、BOM；下游敏感时留意 |

**贯穿洞察**：Workflow 天然把「平台差异」收敛到了一条边界上。**脚本本体（JS 沙箱）永远平台无关，平台坑全在 `agent()` 叶子触碰真实 OS 的那一刻**。所以做跨平台审查时，脚本逻辑可以放心，**重点盯叶子里的文件路径、大小写、shell 命令**。本书在单台 macOS 上能坐实前者，后者就只能基于机理提醒你一句：**到目标平台自己验一遍**。

---

> 继续阅读：[附录 C · 最佳实践清单](#/zh/app-c)
