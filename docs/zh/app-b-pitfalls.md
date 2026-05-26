# 附录 B · 陷阱与排错

> 本附录把写 Workflow 时最常踩的坑做成查得快、对得准的速查表。每条按 **症状 → 原因 → 解法** 组织：先描述你会看到什么、什么时候发生，再讲清楚底层为什么，最后给出可直接照搬的改法。
>
> 所有论断的 API 依据见 [附录 A](#/zh/app-a)，行为依据来自 [附录 E](#/zh/app-e) 列出的真实运行。适用版本：Claude Code v2.1.150（`CLAUDE_CODE_WORKFLOWS=1`）。

---

## B.1 速查总表

先扫一眼。每行链到下文的详解小节。

| # | 症状（你看到的） | 根因（一句话） | 速解 |
|---|---|---|---|
| 1 | 工具直接返回 `error`，工作流根本没跑 | `meta` 不是纯字面量 / 脚本首行不是 `export const meta` | [B.2](#b2-meta-非纯字面量被拒) |
| 2 | 返回 `error` 字段，提示语法/解析失败 | 脚本体有语法错，被启动前的静态检查拦下 | [B.3](#b3-语法错落进-error-字段) |
| 3 | 并发「没生效」，耗时≈串行总和，`parallel()` 无法管理这些调用、异步失败归集失效 | 给 `parallel()` 传了 Promise 数组而非函数数组 | [B.4](#b4-parallel-传了-promise-而非-thunk) |
| 4 | 运行时抛错，提示禁用 API | 脚本里用了 `Date.now()` / `Math.random()` / 无参 `new Date()` | [B.5](#b5-datenow-mathrandom-抛错) |
| 5 | 工作流不停地派 agent，token 飙升直到撞上限 | 动态循环没有 `budget.total &&` 守卫 | [B.6](#b6-无-budget-守卫的死循环) |
| 6 | 续传时该缓存的步骤又重新执行了（花了 token） | 脚本被改动过 / 跨会话 / 没先停上一次运行 | [B.7](#b7-续传没命中缓存) |
| 7 | 运行时抛错，提示嵌套层数超限 | 子工作流里又调了 `workflow()`（超过一层） | [B.8](#b8-嵌套超过一层抛错) |
| 8 | agent 反复重试、迟迟不返回，或耗时异常 | `schema` 约束过严，模型难以一次满足 | [B.9](#b9-schema-过严导致反复重试) |
| 9 | 外部模型/CLI「跑了但没产出文件」，以为它失败了 | 误以为 `ctx_execute`/子进程的写入会落盘 | [B.10](#b10-沙箱写入不落盘的误解) |
| 10 | `parallel`/`pipeline` 结果里混着 `null`，后续 `.map` 报错 | 没在结果上 `.filter(Boolean)` | [B.11](#b11-结果里的-null-没过滤) |
| 11 | 进度树里 agent 没归到预期阶段，或 phase 标签错乱 | 在 `parallel`/`pipeline` 内部依赖全局 `phase()` | [B.12](#b12-并发块内的-phase-竞争) |
| 12 | `args` 在脚本里是 `undefined` | 调用 Workflow 时没传 `args`，或字段名拼错 | [B.13](#b13-args-未传或字段错位) |
| 13 | 想读返回值，却拿到 `taskId`，以为工作流是同步的 | Workflow 工具**始终异步**，回执 ≠ 结果 | [B.14](#b14-把异步回执当成结果) |
| 14 | `pipeline` 某项中途「消失」，最终条数变少 | 某 stage 抛错使该 item 变 `null` 并跳过其余 stage | [B.15](#b15-pipeline-单项静默掉队) |
| 15 | 想用文件系统/`fetch`/`require`，运行时报错或未定义 | 脚本体无文件系统 / Node API | [B.16](#b16-想在脚本体里用-node-api) |
| 16 | workflow 莫名失败、`0 token` 秒退，agent 几乎没跑 | `parallel()` 的 thunk **函数体内同步 throw**（≠ 异步 reject） | [B.17](#b17-parallel-thunk-体内同步-throw-崩溃) |
| 17 | 无条件 `JSON.parse(args)` 抛错，或对象被二次解析 | `args` **原样透传**：对象保持对象、不是 JSON 字符串 | [B.18](#b18-无条件-jsonparseargs-的误解) |
| 18 | 给 `Date.now()` 套了 `try/catch` 却没接住——脚本根本没跑，或别名形式运行时抛 | 字面量在**提交时**静态拒绝；别名形式**运行时**陷阱抛错 | [B.19](#b19-trycatch-接不住-datenow) |
| 19 | `isolation` 拼错（如 `'worktreee'`）没报错，agent 却没被隔离 | 未知 `isolation` 值被**静默忽略**，只特判 `'worktree'`/`'remote'` | [B.20](#b20-isolation-拼错被静默忽略) |
| 20 | 拼错的 `model` 字符串没在提交期报错，以为它合法 | `model` **无提交期校验**（与 `agentType` 有校验相反） | [B.21](#b21-model-拼错不在提交期报错) |
| 21 | 「循环到干」漏写 `budget.total &&`，一路跑到 1000 agent 上限 | 未设目标时 `total===null`、`remaining()===Infinity`，裸 `remaining()` 守卫永不触发 | [B.22](#b22-budget-守卫漏-total-短路) |

---

## B.2 `meta` 非纯字面量被拒

<div class="callout warn">

**症状**：调用 Workflow 工具立即返回带 `error` 的 `WorkflowOutput`，工作流一个 agent 都没派。常见于你把版本号、时间戳、或某个变量「顺手」拼进了 `meta`。

</div>

**原因**：运行时在**执行脚本之前**就静态读取 `meta`（它要拿 `name`/`description` 去填权限确认弹窗）。这一步不运行你的代码，只做字面量求值。因此 `meta` 必须是**纯字面量**——不得含变量引用、函数调用、展开运算符、模板插值。

```javascript
// ✗ 全部会被拒
export const meta = {
  name: `review-${args.target}`,        // 模板插值
  description: buildDesc(),              // 函数调用
  phases: [...basePhases, { title:'X' }],// 展开
  model: DEFAULT_MODEL,                  // 变量引用
}
```

**解法**：把动态内容挪到脚本体里——`meta` 只放静态文本，运行时再用 `log()` / `phase()` 表达可变信息。

```javascript
// ✓ meta 纯字面量；动态信息进脚本体
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

**症状**：`WorkflowOutput.error` 被设置，内容指向解析/语法问题；工作流没启动。

**原因**：Workflow 在派发任何 subagent 前会对脚本做一次语法检查。检查失败 → 把错误写进 `error` 字段、立即返回，**不消耗任何 agent/token**。这是好事：它把「写错的脚本」挡在花钱之前。

**解法**：

1. 读 `error` 字段定位行号/原因，修正后重发。
2. 复杂脚本建议先落盘成 `.js` 文件，用 `scriptPath` 调用——这样可以用编辑器/本地工具先做基本的语法核查，再交给 Workflow。
3. 注意脚本体是 `async` 上下文，可直接 `await`，但**不要**在顶层写裸 `return` 之外的非法结构。

<div class="callout tip">

`error`（语法检查失败）与运行时抛错是两回事：前者在启动前同步返回；后者发生在执行中，通过完成通知体现，且某些场景会被 `parallel`/`pipeline` 转成 `null`（见 [B.11](#b11-结果里的-null-没过滤)、[B.15](#b15-pipeline-单项静默掉队)）。

</div>

---

## B.4 `parallel()` 传了 Promise 而非 thunk

<div class="callout warn">

**症状**：几个 agent 没有被 `parallel()` 统一管理——它们在数组构造时各自立即启动；异步失败归集（async reject / agent 出错变 `null`）也不生效。

</div>

**原因**：`parallel()` 接收的是**函数数组**（`Array<() => Promise>`，即 thunk）。如果你写成 `parallel([ agent(...), agent(...) ])`，那么 `agent(...)` 在数组**构造的那一刻就被调用并立即开始执行**了——`parallel` 拿到的是已经在跑的 Promise。这既**不符合 `parallel(thunks)` 的 API**，`parallel()` 也**无法按 thunk 管理该调用**，更**丢失了「单个 reject → 该位置 null」的错误归集语义**（用前 `.filter(Boolean)` 也就拦不住它了）。

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

**解法**：永远用 `() => agent(...)` 包一层。用 `.map` 生成时也一样：

```javascript
const r = await parallel(items.map(it => () => agent(prompt(it), { schema: S })))
```

> 真实印证：`parallel-demo`（Run `wf_52957913-6d2`）3 个 thunk 实测 8.4s ≪ 3×5.5s，并发真实生效（数据见 [primitives 运行记录](#/zh/p2-08)）。这正是 thunk 写法换来的。

---

## B.5 `Date.now()` / `Math.random()` 抛错

**症状**：脚本运行时抛错，指向 `Date.now()`、`Math.random()`，或无参 `new Date()`。

**原因**：这三者破坏**可重放性**。续传（`resumeFromRunId`）的前提是「同样的脚本 + 同样的输入 → 同样的执行路径」，运行时才能判断哪些 `agent()` 调用未变、可直接复用缓存。一旦脚本里有不确定来源，重放就无从对齐，因此运行时**直接禁用**它们。

**解法**：

| 你想要 | 改用 |
|---|---|
| 时间戳（命名/盖戳） | 通过 `args` 从外部传入：`args.runStamp`；或工作流返回后由主循环盖戳 |
| 随机性/打散 | 用 agent 的**下标**变化提示词（如 `parallel(items.map((it,i)=>...))` 里的 `i`），而非真随机 |
| 唯一 ID | 用稳定来源拼接：item 内容、下标、`args` 里传入的种子 |

```javascript
// ✗ 运行时抛错
const ts = Date.now()

// ✓ 时间戳由外部传入（调用方：Workflow({ script, args:{ runStamp: '<同步盖好的戳>' } })）
const ts = args.runStamp
```

> 标准 JS 内置（`JSON`/`Math` 的其它方法/`Array`…）仍可用——被禁的只有这三个不确定性来源。

---

## B.6 无 `budget` 守卫的死循环

<div class="callout warn">

**症状**：工作流停不下来，一轮接一轮派 agent，`budget.spent()` 一路涨，最终撞上「单工作流 agent 总数 1000」的兜底上限，或在用户设了目标时撞 `budget.total` 抛错。

</div>

**原因**：动态循环（「循环到干」「重试到通过」这类）如果只看业务条件、不看预算，遇到模型反复给不出收敛结果时就会无限迭代。`budget` 是**硬上限**：`spent()` 达到 `total` 后再调 `agent()` 会抛错——但你不该让它兜底，而应主动守卫。

**解法**：循环条件里**同时**写业务判据和预算判据。注意 `budget.total` 可能为 `null`（用户没设目标，此时 `remaining()` 为 `Infinity`），所以要用 `budget.total &&` 短路守卫，避免在「没设目标」时反而提前退出。

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

> 双重护栏：①你自己的 `MAX_ROUNDS` + 预算守卫（主动、优雅退出）；②运行时的 1000 agent 兜底（被动、防失控）。生产脚本应靠①收尾，不要触碰②。详见 [第 21 章 · 动态预算与规模化](#/zh/p4-21)。

---

## B.7 续传没命中缓存

**症状**：用 `resumeFromRunId` 续传，本以为前面跑过的步骤会瞬时返回（零 token），结果它们又**重新执行**了，花了时间和 token。

**原因**：缓存命中的条件很严格，任一不满足就会重跑对应 `agent()`：

| 条件 | 说明 |
|---|---|
| 脚本**逐字未改** | 改了脚本（哪怕只动一行注释）会让其后的调用重新执行 |
| **同一会话** | 续传仅在同会话有效；跨会话缓存不可用 |
| 先**停掉上一次运行** | 续传前应 `TaskStop` 掉上一个 Task，再用 `resumeFromRunId` 重发 |
| 脚本**可重放** | 含 `Date.now()` 等不确定来源会破坏对齐（见 [B.5](#b5-datenow-mathrandom-抛错)） |

**解法**：

- 想**复用**前面成果（只改后段）：保持前段脚本逐字不变，改动只发生在你希望重跑的位置之后。
- 想**强制重跑**某段：故意改动它即可（缓存按「调用是否变化」判定）。

> 真实印证：未改动的 `hello-workflow` 用 `resumeFromRunId` 续传，实测 `total_tokens=0`、`tool_uses=0`、`duration_ms=8`，返回值与首次完全一致（Run `wf_dacbd480-d5d` 复用，Task `w7pxch4w6`）。这就是「命中」的字面样子——若你的续传不是这个样子，对照上表逐条排查。详见 [第 22 章 · 断点续传与缓存](#/zh/p4-22)。

---

## B.8 嵌套超过一层抛错

**症状**：在一个被 `workflow()` 内联调用的子工作流里，又调了 `workflow()`，运行时抛错。

**原因**：嵌套**仅允许一层**。父 → 子可以；子 → 孙会抛错。这是刻意的护栏，防止递归失控（子流程共享父流程的并发上限、agent 计数、中止信号与 token 预算，无限嵌套会让这些共享资源失去边界）。

**解法**：

- 把「孙级」逻辑**展平**进子工作流本身（直接写 `agent()`/`parallel()`/`pipeline()`，而不是再 `workflow()`）。
- 如果确实需要多级编排，改由**主循环**串联多个一层嵌套，而不是在脚本内部深度递归。

```javascript
// ✗ 子工作流内部再嵌套 → 抛错
// child.js: const x = await workflow({ scriptPath: './grandchild.js' })

// ✓ 把逻辑展平进子工作流
// child.js:
phase('Work')
const x = await agent('do the grandchild logic directly', { schema: S })
```

> 真实印证：父工作流 `workflow({scriptPath})` 内联跑 hello 子流程成功，子 agent 计入父流程 `agent_count=1`/`total_tokens=26338`（Run `wf_85e22b38-126`）——这是**一层**，正常。详见 [第 20 章 · 嵌套 Workflow](#/zh/p4-20)。

---

## B.9 `schema` 过严导致反复重试

**症状**：某个带 `schema` 的 agent 迟迟不返回、或耗时明显偏长；进度上看它像在「卡住」。

**原因**：`schema` 的校验发生在**工具调用层**——模型必须调 `StructuredOutput` 工具且输出严格匹配 schema，不匹配就**重试**。如果 schema 约束得太死（如 `enum` 列举不全、`required` 含模型其实无法可靠产出的字段、数值 `pattern`/范围过窄），模型可能要试很多次才偶然命中，表现为变慢甚至接近放弃。

**解法**：让 schema「约束产物形状，但给模型留出合理表达空间」。

- `enum` 要覆盖模型可能给的全部合法取值；拿不准就先用 `string` 跑一轮看真实输出，再收窄。
- `required` 只列**真正必要**的字段；可选信息别强制。
- 复杂嵌套结构拆成两阶段（先产文本、再结构化），比一步到位更稳。
- 校验失败会重试，所以「偶尔重试」是正常的；只有**持续**重试才说明 schema 需要放松。

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

> 反例参照：`frontend-review` 用的 `FINDINGS` schema 把 `severity` 定为四值 `enum`、其余用 `string`，4 个 agent 顺利产出 26 条发现无卡顿（Run `wf_4c5caabb-b73`）。详见 [第 7 章 · 结构化输出与 Schema](#/zh/p2-07)。

---

## B.10 沙箱写入不落盘的误解

<div class="callout warn">

**症状**：你让一个 agent（或在分析里用 `ctx_execute` / Bash 子进程）「生成文件 / 写结果」，事后在磁盘上找不到，误判为「它失败了」或「外部模型零产出」。

</div>

**原因**：**文件写入只有原生 Write/Edit 工具会落盘**。`ctx_execute` 与 Bash 子进程在子进程里运行、用完即弃，它们对文件系统的写入**不持久化**到宿主机。同理，脚本体本身**无文件系统 API**——它的「产物」是 `agent()` 的**返回值**（文本或结构化对象），不是磁盘文件。

**解法**：

- 想要文件落盘：让工作流**返回内容**，由主循环用 Write/Edit 写盘；或在 agent 提示里明确要求它**调用 Write 工具**（agent 有真实工具权限）。
- 别把「外部模型在沙箱里跑了但磁盘没文件」当成失败——先确认它的产物是不是以**返回值**形式交回来了。
- 分析类计算用 `ctx_execute` 没问题（只要你只 `console.log` 结论），但别指望它写出的文件还在。

```javascript
// 工作流把内容当返回值交回，主循环负责落盘
phase('Generate')
const doc = await agent('Write the migration guide as markdown. Return the full text.',
  { schema:{ type:'object', properties:{ markdown:{type:'string'} }, required:['markdown'] } })
return doc            // ← 主循环拿到 doc.markdown 后用 Write 落盘
```

---

## B.11 结果里的 `null` 没过滤

**症状**：`parallel()` / `pipeline()` 返回的数组里混入 `null`，紧接着的 `.map(r => r.field)` 抛 `Cannot read properties of null`。

**原因**：两个原语都用 `null` 表达「这一项没有有效结果」：

- `parallel`：某 thunk 的**异步失败**（返回的 promise reject，或内部 `agent()` 出错）→ 该位置 `null`、调用本身不 reject。注意：thunk 体内的**同步 `throw` 不会变 `null`**，而是 reject 整个调用、令 workflow 崩溃（见 [B.17](#b17-parallel-thunk-体内同步-throw-崩溃)）。
- `pipeline`：某 item 在某 stage **抛错**（同步或异步）→ 该 item 变 `null` 并跳过其余 stage。
- `agent`：用户**中途跳过**该 agent → 返回 `null`。

**解法**：消费结果前一律 `.filter(Boolean)`。

```javascript
const results = (await parallel(thunks)).filter(Boolean)   // ✓ 先滤掉 null
const titles = results.map(r => r.title)                   // 现在安全
```

> 在 `pipeline` 内部跨 stage 合并时也要防御：如果上一阶段可能给 `null`，下一阶段回调要先判空（或确保只在过滤后的集合上继续）。详见 [第 8 章 · parallel vs pipeline](#/zh/p2-08)。

---

## B.12 并发块内的 `phase()` 竞争

**症状**：用了 `parallel`/`pipeline` 后，进度树里的 agent 归错了阶段，或 phase 标签看起来「抢来抢去」。

**原因**：全局 `phase()` 是**有状态**的——它切换「当前阶段」，其后的 `agent()` 归入该阶段。但在 `parallel`/`pipeline` 里，多个 agent **并发**运行，若它们都依赖那个全局当前阶段，就会互相竞争（谁先调谁后调不确定），归组随之错乱。

**解法**：在 `parallel`/`pipeline` 内部，**永远用 `opts.phase` 显式归组**，不要依赖外层的 `phase()`。`opts.phase` 的字符串要与 `meta.phases[].title` 精确匹配。

```javascript
// ✓ 每个并发 agent 自带 phase，不争全局状态
const reviews = await parallel(dims.map(d => () =>
  agent(d.prompt, { label:`review:${d.key}`, phase:'Review', schema:FINDINGS })))
```

> `frontend-review` 与 `judge-panel` 的真实脚本都在 `parallel` 内逐个写 `phase:'Review'`/`phase:'Judge'`，正是为此。详见 [第 5 章 · meta 与 phase](#/zh/p2-05)。

---

## B.13 `args` 未传或字段错位

**症状**：脚本里读 `args.foo` 得到 `undefined`，逻辑全走了空分支。

**原因**：`args` 是 Workflow 入参 `args` 的值；**没传**就是 `undefined`。常见于：调用时忘了带 `args`、字段名拼错、或把 `args` 和 `name`/`script` 的层级搞混。

**解法**：

```javascript
// 调用方：args 是 WorkflowInput 的顶层字段
// Workflow({ script: '...', args: { target: 'src/auth', maxRounds: 3 } })

// 脚本里：先给默认值兜底，别假定一定有
const target = args?.target ?? 'src'
const maxRounds = args?.maxRounds ?? 5
```

> `args` 尤其适合参数化**具名工作流**（`name` + `args`），把同一段逻辑复用到不同输入上。详见 [附录 A](#/zh/app-a)。

---

## B.14 把异步回执当成结果

**症状**：你期望 Workflow 工具返回工作流的「最终结果」，拿到的却是 `{ status, taskId, runId, ... }`，于是误以为没跑成功或想直接读返回值。

**原因**：Workflow 工具**始终异步**。它立即返回一个**回执**（`status` 只会是 `"async_launched"` 或 `"remote_launched"`），工作流在后台运行。**真正的返回值与用量统计**（`agent_count`/`tool_uses`/`total_tokens`/`duration_ms`）通过完成时的 `<task-notification>` 送达。

**解法**：

- 把 `taskId`/`runId` 收好：前者用于追踪/停止（TaskStop），后者用于续传（`resumeFromRunId`）。
- 想看实时进度用斜杠命令 `/workflows`。
- 想拿结果，**等通知**——不要在回执里找结果字段。

> 真实形态：第一批全部 10 次完成记录 / 9 个唯一 Run ID 的回执都先给 `taskId`+`runId`，用量数字全部来自完成通知（见 [附录 E](#/zh/app-e)）。

---

## B.15 pipeline 单项静默掉队

**症状**：`pipeline(items, ...)` 传入 N 项，最终 `out.filter(Boolean).length < N`，某些项「没了」，但也没看到明显报错。

**原因**：`pipeline` 的容错粒度是**单项**——某项在任一 stage 抛错，**该项**立即变 `null` 并跳过其**余下所有 stage**，但其它项不受影响、继续流动。这是优点（一项坏不拖垮整批），但如果你只看最终条数会以为「丢数据」。

**解法**：

- 接受这是设计行为：把 `null` 理解为「这一项在某个阶段失败了，已被安全跳过」。
- 想知道**为什么**掉队：在 stage 内部用结构化返回携带状态，或让该 stage 的 `agent` schema 带一个 `ok`/`reason` 字段，事后统计。
- 关键路径上若不允许丢项，可在每个 stage 内 `try` 住并返回「降级结果」而非抛错，从而保住该项继续往下走。

```javascript
const out = await pipeline(items,
  (it) => agent(`stage1 ${it}`, { phase:'S1', schema:A }),
  (r, it) => agent(`stage2 ${it}`, { phase:'S2', schema:B }),
)
const ok = out.filter(Boolean)
log(`pipeline kept ${ok.length}/${items.length} items`)   // 显式记录掉队
```

> 真实印证：`pipeline-demo` 3 项 × 2 阶段全部存活，`agent_count=6`、返回 3 条（Run `wf_bf086b98-6ec`）——没有掉队是因为没有 stage 抛错。详见 [第 8 章 · parallel vs pipeline](#/zh/p2-08)。

---

## B.16 想在脚本体里用 Node API

**症状**：脚本里写 `require(...)`、`fs.readFile`、`fetch(...)`、`process.env`，运行时报未定义或抛错。

**原因**：脚本体是一个**受限的 `async` 沙箱**：标准 JS 内置（`JSON`/`Math`/`Array`/`Object`/`Promise`…）可用，但**没有**文件系统、网络、`require`、Node 全局这类能力。工作流的「副作用」全部通过 `agent()` 派发的 subagent 完成——是它们（不是脚本体）持有真实工具权限。

**解法**：

| 你想做 | 在脚本体里 | 正确做法 |
|---|---|---|
| 读文件 | ✗ `fs.readFile` | 让 agent 读：`agent('Read src/x.ts and summarize ...')` |
| 联网/抓取 | ✗ `fetch` | 让 agent 用其工具抓取，或预先把数据通过 `args` 传入 |
| 写文件 | ✗ `fs.writeFile` | agent 调 Write 工具，或返回内容由主循环落盘（见 [B.10](#b10-沙箱写入不落盘的误解)） |
| 引第三方库 | ✗ `require('lodash')` | 用标准 JS 内置实现，或把计算交给 agent |
| 读环境变量 | ✗ `process.env` | 通过 `args` 显式传入需要的值 |

```javascript
// ✗ 脚本体无 Node API
const src = require('fs').readFileSync('src/auth.ts', 'utf8')

// ✓ 让 subagent 去读，脚本体只编排
const review = await agent('Read src/auth.ts and list security issues.',
  { schema: FINDINGS })
```

---

## B.17 `parallel` thunk 体内同步 throw 崩溃

<div class="callout warn">

**症状**：一个本该「尽力而为」的 `parallel()` 调用，整个 workflow 却**莫名失败**——回执/通知显示 status `failed`、`total_tokens=0`、`duration_ms` 只有几十毫秒，agent 几乎一个都没真正跑起来（「`0 token` 秒退」）。你以为「某个 thunk 抛错只会变 `null`」，结果整批一起崩了。

</div>

**原因**：这与 [B.4](#b4-parallel-传了-promise-而非-thunk) 是**姊妹陷阱**——B.4 是「传错类型（Promise 而非 thunk）」，本条是「传对了 thunk，但 thunk **函数体内同步 `throw`**」。`parallel()` 是逐个**调用** thunk 的：若 thunk 体内有同步 `throw`（如裸 `throw`、`JSON.parse` 失败、断言、下标越界），异常在 `parallel()` 拿到 promise **之前**就向上抛出，于是它**没有机会把这一格收集成 `null`**，整个 `parallel()` 调用 **reject**；外层不 `try/catch` 就让 **workflow 失败**。注意：工具那句「a thunk that throws resolves to null」只对**返回的 promise 异步 reject**成立，对**同步 throw 不成立**。

```javascript
// ✗ thunk 体内同步 throw → 整个 parallel() reject → workflow 失败（0 token 秒退）
await parallel([
  () => agent('ok-1'),
  () => { throw new Error('boom') },                 // 同步抛，穿透 parallel
  () => agent('ok-2'),
])

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

- **把风险的同步逻辑挪进 `agent()` 的异步路径**——`parallel()` 只对异步 reject 做「→ `null`」归集。
- 实在要在 thunk 体里做同步计算，就**自己 `try/catch`** 并返回 `null`（或降级值），别让它裸抛。
- 消费结果前一律 `.filter(Boolean)`（见 [B.11](#b11-结果里的-null-没过滤)）——但请记住：`.filter(Boolean)` 只能滤掉**异步 reject 产生的 `null`**，**拦不住同步 throw**（那时 workflow 已经崩了，根本走不到 filter）。

> 真实印证：脚本仅为 `parallel([好, () => { throw ... }, 好])`，实测 workflow 状态 **failed**、`agent_count=1`、`total_tokens=0`、`duration_ms=26`（Run `wf_ed5e87f3-435`）。同步 throw 与异步 reject 的差异在 Run `wf_74ebe5ac-2db`（异步 reject → 该格 `null`、其余存活、workflow 完成）被反向确认。完整对照与原理见 [第 8 章 · §8.8 失败语义](#/zh/p2-08)。

---

## B.18 无条件 `JSON.parse(args)` 的误解

<div class="callout warn">

**症状**：脚本里写 `const cfg = JSON.parse(args)`，结果要么直接抛 `Unexpected token o in JSON`（因为 `args` 已经是对象、被 `String()` 成 `"[object Object]"` 再解析失败），要么把本就嵌套的对象「解析坏」。你以为 `args` 是一段 JSON 文本，其实它是**已经反序列化好的对象**。

</div>

**原因**：`args` 是 Workflow 入参 `args` 的**原样**值——**对象保持对象、数组保持数组**，运行时**不会**把它字符串化。实测把 `{ hello:'world', n:5, nested:{ deep:true } }` 传进去，脚本里看到的就是 `typeof args === 'object'`、字段原样可见、`Array.isArray(args) === false`（Run `wf_59bf3654-183`，见 [附录 E · R4 沙箱记录](#/zh/app-e)）。对一个本就是对象的值再 `JSON.parse`，等于先隐式 `String(对象)` 得到 `"[object Object]"`、再去解析——必然失败。

**解法**：**先归一化、再读字段**。只有当 `typeof args === 'string'` 时才（带 `try/catch` 地）`JSON.parse`；否则直接当对象用。绝不无条件 `JSON.parse(args)`。

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

> 配套：`args` 没传时是 `undefined`、字段错位会读到 `undefined`，见 [B.13](#b13-args-未传或字段错位)；这里强调的是**类型**——它是对象不是字符串。

---

## B.19 try/catch 接不住 `Date.now()`

<div class="callout warn">

**症状**：你「保险起见」给 `const ts = Date.now()` 套了 `try/catch`，期望失败时走兜底分支——结果**整个工作流根本没启动**（回执里直接是 `error` 字段），你的 `catch` 一次都没执行。换一种写法（`const D = Date; D.now()`）倒是跑起来了，却在运行时抛错。

</div>

**原因**：确定性禁用是**双层防护**，两层都不是你的 `try/catch` 能拦的：

1. **字面量在提交时被静态拒绝**：`Date.now()` / `Math.random()` / 无参 `new Date()` 的**字面写法**会被一次**源码静态扫描**在脚本**解析/运行之前**拦下——脚本压根不执行，工具直接返回错误（原文：`Workflow scripts must be deterministic: Date.now()/Math.random()/new Date() are unavailable (breaks resume)…`，见 `sandbox-r4.md`）。脚本没运行，`try/catch` 自然无从谈起。
2. **别名形式是运行时陷阱**：把调用「藏」起来（`const D = Date; D.now()`）能骗过静态扫描、提交通过，但运行时被注入的陷阱**抛错**——`Date.now() / new Date() are unavailable in workflow scripts (breaks resume)…`；`Math.random()` 那条还顺带提示解法：`…For N independent samples, include the index in the agent label or prompt.`（两层均实测，Run `wf_59bf3654-183`）。

**解法**：别试图「绕过」或「接住」——按 [B.5](#b5-datenow-mathrandom-抛错) 的方式从根上避开：时间戳用 `args` 传入或事后盖戳，随机性用 agent 下标变化提示词。

```javascript
// ✗ 字面量：提交期静态拒绝，脚本不运行，catch 形同虚设
try { const ts = Date.now() } catch { /* 永远到不了这里 */ }

// ✗ 别名：骗过静态扫描，但运行时抛错
const D = Date; const ts = D.now()      // 运行时 throw

// ✓ 从源头避开（见 B.5）
const ts = args.runStamp                // 外部传入，可重放
```

> 为什么这么严？因为续传要求「同脚本+同输入→同执行路径」，任何不确定来源都会破坏对齐。双层防护正是为了让你**不可能**把不确定性偷渡进可重放的脚本。

---

## B.20 `isolation` 拼错被静默忽略

<div class="callout warn">

**症状**：你想让某个会改文件的 agent 跑在隔离的 git worktree 里，写了 `isolation: 'worktreee'`（多打一个 e）。**没有任何报错**，agent 正常返回——但它其实**没有被隔离**，和别的 agent 共用同一工作目录，并行改文件时照样冲突。这是个隐蔽坑：错误被「成功」的表象掩盖了。

</div>

**原因**：运行时对 `isolation` 只**特判两个值**——`'worktree'`（执行隔离）与 `'remote'`（本 build 禁用，会抛 `agent({isolation:'remote'}) is not available in this build`）；**其它任何未知值都被静默忽略**，agent 按默认（不隔离）正常运行。实测 `isolation: 'totally-bogus'` **不抛错、返回 OK**，只有 `'remote'` 抛错（Run `wf_dace2fc6-966`，见 [附录 E · R4 opts 校验记录](#/zh/app-e)）。所以拼错的 `'worktreee'` 等同于「没写 isolation」。

**解法**：写 `isolation` 时**逐字核对**只能是 `'worktree'`；不要依赖运行时报错来抓拼写。需要隔离的判断标准见 [第 19 章](#/zh/p4-19)（仅当并行改文件会冲突时才用，它昂贵）。

```javascript
// ✗ 拼错被静默忽略：agent 没隔离，并行改文件仍冲突，且无任何报错
await agent('refactor src/auth.ts', { isolation: 'worktreee' })

// ✓ 逐字写对
await agent('refactor src/auth.ts', { isolation: 'worktree' })
```

> 对照：`agentType` 拼错会**立即抛错**（见 [B.21](#b21-model-拼错不在提交期报错) 末尾），`isolation` 拼错却被吞掉——同是 opts 字段，校验严格度不一致，务必记牢哪些「会报错、哪些会沉默」。

---

## B.21 `model` 拼错不在提交期报错

<div class="callout warn">

**症状**：你把 `model: 'opus'` 误写成 `model: 'oputs'`，期望提交时被挡下——结果脚本顺利提交、agent 正常运行，你误以为这个 model 名是合法的。

</div>

**原因**：`model` 字符串**没有提交/解析期校验**。实测一个明显不存在的 `model: 'totally-not-a-real-model-xyz'` 既没在提交期被拒、agent 也照常返回 OK（Run `wf_dace2fc6-966`）。

<div class="callout info">

**实测的诚实边界**：本会话 `CLAUDE_CODE_SUBAGENT_MODEL` 覆盖了一切 per-call `model`（实跑 Opus），所以那个 bogus 字符串**从未真正发往 API**——「拼错会在 API 调用时失败」这一步本会话**未能观测到**（社区第三方资料如此声称，本书未独立实测）。能确认的只有：**提交期不报错**。

</div>

**对比 `agentType`（有校验）**：未知 `agentType` 会在**生成任何模型之前**（0 token / 4ms）就抛错，并列出全部可用 agent——原文 `agent({agentType}): agent type '…' not found. Available agents: claude, claude-code-guide, codex:codex-rescue, Explore, general-purpose, …`（Run `wf_a222f20f-0f5`）。这一「`agentType` 严校验、`model` 不校验」的不对称，是真实可教的差异。

```javascript
// ✗ model 拼错：提交期不报错，你拿不到早期反馈
await agent('do x', { model: 'oputs' })          // 静默通过

// ✗ agentType 拼错：立即抛错并列出可用 agent（0 token）
await agent('do x', { agentType: 'code-reviewr' })   // throw

// ✓ 两者都逐字核对；尤其 model 没有「拼错保护网」
await agent('do x', { model: 'opus', agentType: 'Explore' })
```

> 实践含义：`model` 拼错的代价**滞后**（最坏到 API 层才暴露），所以更要靠 code review / 校验器（见 [附录 E · validator-r4](#/zh/app-e)）在提交前抓；别指望运行时替你兜。

---

## B.22 budget 守卫漏 `total` 短路

<div class="callout warn">

**症状**：一个「循环到干 / 重试到通过」的动态循环，本想用预算守卫提前收手，却写成了 `if (budget.remaining() < 30000) break`。在**用户没设 token 目标**时，这个守卫**永不触发**，循环一路跑到运行时的 **1000 agent 官方兜底上限**才被迫停下，烧掉大量 token。

</div>

**原因**：未设目标时 `budget.total === null`、`budget.remaining()` 返回 **`Infinity`**（实测 `total===null` 见 Run `wf_59bf3654-183`；budget 探针 `wf_fd09a6ed-38a` 实测返回 `{ totalIsNull:true, remainingBefore/After:"Infinity", guardRounds:0 }`，见 `r3-reverification.md`）。于是 `Infinity < 30000` 恒为 `false`，守卫形同不存在；而你若把守卫**当成唯一的循环出口**，循环就只剩业务条件兜底——业务一旦不收敛，便一路撞 1000 上限。

这其实是 [B.6](#b6-无-budget-守卫的死循环) 的**精确化版本**：B.6 讲「要有预算守卫」，本条讲「守卫**必须**用 `budget.total &&` 短路，否则在『没设目标』这一最常见情形下它根本不工作」。

**解法**：守卫**始终**写成 `budget.total && budget.remaining() < 阈值`——只有用户真的设了目标（`total` 非 null）时才让它生效；同时**永远**配一个独立的 `MAX_ROUNDS` 硬上限作为「没设目标」时的兜底。

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

> 双重护栏的分工：`MAX_ROUNDS`（主动、对「没设目标」也有效）+ `budget.total &&` 守卫（对「设了目标」精准收尾）+ 运行时 1000 agent 兜底（被动、防失控）。生产脚本应靠前两道收口，**绝不**把 1000 当正常退出点。详见 [第 21 章 · 动态预算与规模化](#/zh/p4-21)。

---

## B.23 排错心法（收尾）

把上面的坑归纳成三句可迁移的判断：

1. **失败发生在「启动前」还是「执行中」？** 启动前 → 看 `error` 字段（`meta`/语法，[B.2](#b2-meta-非纯字面量被拒)/[B.3](#b3-语法错落进-error-字段)），不花钱；执行中 → 看完成通知与 `null`（[B.5](#b5-datenow-mathrandom-抛错)/[B.11](#b11-结果里的-null-没过滤)/[B.15](#b15-pipeline-单项静默掉队)）。
2. **是不是把「沙箱」当成了「主机」？** 脚本体无 Node API、`ctx_execute`/子进程写入不落盘——副作用与文件操作都得过 agent 的真实工具（[B.10](#b10-沙箱写入不落盘的误解)/[B.16](#b16-想在脚本体里用-node-api)）。
3. **是不是和「可重放/确定性」过不去？** 禁用不确定来源、续传严格按「脚本逐字未改 + 同会话」命中——这套约束换来的是确定性骨架与零成本缓存（[B.5](#b5-datenow-mathrandom-抛错)/[B.7](#b7-续传没命中缓存)）。

> 配套阅读：可勾选的正向清单见 [附录 C · 最佳实践清单](#/zh/app-c)；术语不清查 [附录 D · 术语表](#/zh/app-d)；字段语义查 [附录 A · API 完整参考](#/zh/app-a)。

> 继续阅读：[附录 C · 最佳实践清单](#/zh/app-c)
