# 附录 A · API 完整参考

> 本附录是全书的 API 速查，对照 Claude Code 官方分发包的类型定义 `sdk-tools.d.ts`（`WorkflowInput` / `WorkflowOutput` 接口）、Workflow 工具定义原文，以及本机真实运行记录（见 [附录 E](#/zh/app-e)）整理而成。
>
> 适用版本：Claude Code v2.1.150（`CLAUDE_CODE_WORKFLOWS=1`，本书实测会话主循环模型 Opus 4.7 (1M)）。功能为实验性，字段可能随版本演进——以你本机的类型定义为最终依据。

---

## A.0 怎么读这份参考：三档口径

API 文档最怕「言之凿凿，实则臆测」。本书把每条事实按可信度分成三档，正文里会用统一记号标注，请先认它们：

| 记号 | 含义 | 你可以怎样依赖它 |
|---|---|---|
| **【官方】** | 来自 Claude Code 官方工具定义 / `sdk-tools.d.ts` 类型 | 当作权威真值，正常陈述。 |
| **【实测】** | 本机真实跑过、有 Run ID（形如 `wf_59bf3654-183`） | 当作权威真值；会附上运行编号与数据。 |
| **【第三方·未核实】** | 来自社区第三方资料（某 YouTuber 的配套仓库 `claude-code-workflow-creator`，**非官方**），本书未独立复现 | **不要当事实**。仅在确有教学价值时提及，且必然带此标注。 |

<div class="callout info">

为什么要这么较真？因为网上能搜到的「Workflow API 细节」里，相当一部分来自一个第三方视频配套仓库——它不是官方产物，其中一些精确数字（错误类名、超时毫秒、重试次数等）我们**在本机无法复现**。把它们和官方、实测混在一起写，就是在制造看似权威的噪声。本附录宁可少写，也不把未核实的当真。

</div>

---

## A.1 Workflow 工具：入参 `WorkflowInput`【官方】

调用 Workflow 工具时的入参。脚本来源有三种（`script` / `name` / `scriptPath`），外加 `args`。**`scriptPath` 优先级最高**（高于 `script` 和 `name`）；`script` 与 `name` 的相对优先级官方未明确，故不要假设「`scriptPath` > `script` > `name`」这种三级排序。

| 字段 | 类型 | 说明 |
|---|---|---|
| `script` | `string?` | 自包含脚本。**必须**以纯字面量 `export const meta = {…}` 开头，随后是脚本体。 |
| `name` | `string?` | 预定义/具名工作流（内置或 `.claude/workflows/`），解析为一段自包含脚本。 |
| `args` | `object?` | 暴露给脚本的全局 `args`。用于参数化具名工作流。 |
| `scriptPath` | `string?` | 磁盘脚本路径。每次调用脚本都会落盘并在结果里返回该路径；可用 Write/Edit 改后用此字段重跑，无需重发整段脚本。**优先级最高**。 |
| `resumeFromRunId` | `string?` | 从某次运行断点续传。未改动的 `agent()` 调用返回缓存结果；**仅同会话**。续传前先停掉上一次运行（TaskStop）。 |

### 持久化-编辑循环：`scriptPath` 的真正威力

`script` 与 `scriptPath` 看似只是「内联 vs 路径」之别，实则后者解锁了一套高效的迭代节奏。【官方】每次调用脚本（无论用 `script` 还是 `scriptPath` 提交），Workflow 工具都会把脚本**落盘**，并在返回的 `WorkflowOutput.scriptPath` 里告诉你落在哪。于是循环成立：

```text
首次：用 script 提交  ──►  返回 scriptPath（脚本已落盘）
                              │
            用 Edit 改这个文件 ◄──┘
                              │
重跑：用 { scriptPath } 提交（无需重发整段脚本）──►  又返回 scriptPath
```

配合 `resumeFromRunId`，这套循环就是「改一处、只重跑改动之后的步骤」的基础（见 [A.10](#a10-续传-resume官方实测) 与 [附录 B](#/zh/app-b)）。

---

## A.2 Workflow 工具：返回 `WorkflowOutput`【官方】

Workflow 工具**始终异步**，立即返回回执（不是工作流结果）。

| 字段 | 类型 | 说明 |
|---|---|---|
| `status` | `"async_launched" \| "remote_launched"` | **只有这两种取值。** |
| `taskId` | `string` | 后台任务句柄。 |
| `runId` | `string?` | 本地运行标识（形如 `wf_…`），`resumeFromRunId` 用；`remote_launched` 无（用 CCR session URL 作续传句柄）。 |
| `summary` | `string?` | 摘要。 |
| `transcriptDir` | `string?` | subagent 执行记录目录。 |
| `scriptPath` | `string?` | 本次落盘脚本路径，可 Write/Edit 后作 `scriptPath` 重跑。 |
| `sessionUrl` | `string?` | `remote_launched` 时的 CCR session URL（即远端续传句柄）。 |
| `warning` | `string?` | 非阻塞提示（如本地 git 状态与待克隆的远端分支有偏离）。 |
| `error` | `string?` | 语法检查 / 提交前静态扫描失败时设置（此时工作流根本没跑）。 |

<div class="callout tip">

工作流的**真正结果**通过完成时的 `<task-notification>` 送达，内含返回值与用量统计（`agent_count` / `tool_uses` / `total_tokens` / `duration_ms`）。把 `taskId`/`runId` 当成「快递单号」、把 notification 当成「包裹」——别拿单号当包裹拆。

</div>

---

## A.3 脚本结构与执行环境

```javascript
export const meta = { /* 纯字面量，见 A.4 */ }
// ↑ 必须第一条语句；以下是脚本体（async 上下文，可直接 await）
phase('...')
const x = await agent('...', { /* opts */ })
const ys = await parallel([ () => agent('...'), () => agent('...') ])
const zs = await pipeline(items, stage1, stage2)
log('...')
return result
```

- 脚本体运行在 `async` 上下文，直接 `await`。【官方】
- 标准 JS 内置（`JSON` / `Math` / `Array` / …）可用。【官方】【实测】`Math.max(...)`、`JSON.stringify(...)` 在 `wf_59bf3654-183` 里正常工作。
- **无**文件系统 / Node API：脚本体里 `require` / `process` / `fetch` 全是 `undefined`【实测，`wf_59bf3654-183`】。文件、shell、网络只能放进 `agent()` 叶子里做——subagent 才有 Read/Write/Bash 等工具。
- **禁用 `Date.now()` / `Math.random()` / 无参 `new Date()`**——破坏续传所需的可重放性，双层拦截（见 [A.9](#a9-确定性沙箱双层防护实测)）。`new Date(具体值)` 正常【实测】。

### 脚本体内注入的全局

下表是脚本体不用 `import` 就能直接用的全局。其中 `agent` / `pipeline` / `parallel` / `phase` / `log` / `budget` / `args` / `workflow` 由**官方工具定义**列出；`console` / `setTimeout` / `clearTimeout` 则是本书**实测确认**也被注入的。

| 全局 | 类型/签名 | 口径 | 详见 |
|---|---|---|---|
| `agent` | `(prompt, opts?) => Promise<any>` | 【官方】 | [A.5](#a5-agentprompt-opts-promiseany官方) |
| `pipeline` | `(items, ...stages) => Promise<any[]>` | 【官方】 | [A.6](#a6-pipelineitems-stage1-stage2-promiseany官方) |
| `parallel` | `(thunks) => Promise<any[]>` | 【官方】 | [A.7](#a7-parallelthunks-promiseany官方) |
| `phase` | `(title) => void` | 【官方】 | [A.8](#a8-其它全局官方) |
| `log` | `(message) => void` | 【官方】 | [A.8](#a8-其它全局官方) |
| `budget` | `{ total, spent(), remaining() }` | 【官方】 | [A.8](#a8-其它全局官方) |
| `args` | `any` | 【官方】 | [A.11](#a11-args-原样透传与归一化实测) |
| `workflow` | `(nameOrRef, args?) => Promise<any>` | 【官方】 | [A.8](#a8-其它全局官方) |
| `console` | `object`（`console.log` 可用，输出进 workflow 日志） | 【实测，`wf_59bf3654-183`】 | 下方 |
| `setTimeout` | `function` | 【实测，`wf_59bf3654-183`】 | 下方 |
| `clearTimeout` | `function` | 【实测，`wf_59bf3654-183`】 | 下方 |

<div class="callout info">

**关于 `console` / `setTimeout` / `clearTimeout`**：在 `wf_59bf3654-183`（一个 0 agent 的自省工作流）里，`typeof console === 'object'`、`typeof setTimeout === 'function'`、`typeof clearTimeout === 'function'`，且 `console.log(...)` 调用成功（输出进 workflow 日志）。日常叙述进度优先用官方的 `log()`；`console.log` 更像调试旁路。这三个全局**确实存在**是实测事实；但第三方资料里关于 VM 同步超时（`setTimeout` 相关的具体毫秒数）等说法本书未核实，见 [A.14](#a14-第三方未核实清单谨慎)。

</div>

---

## A.4 `meta`（导出常量，纯字面量）【官方】

```javascript
export const meta = {
  name: 'review-changes',                    // 必填
  description: 'Review changed files',       // 必填，显示在权限确认对话框
  whenToUse: 'When a PR touches many files', // 可选，显示在工作流列表
  phases: [                                  // 可选，每项一个进度分组
    { title: 'Review' },
    { title: 'Verify', detail: 'sanity pass' },
  ],
}
```

| 字段 | 必填 | 口径 | 说明 |
|---|---|---|---|
| `name` | 是 | 【官方】 | 工作流名称。 |
| `description` | 是 | 【官方】 | **一行**，显示在权限确认对话框。 |
| `whenToUse` | 否 | 【官方】 | 适用场景，显示在工作流列表。 |
| `phases` | 否 | 【官方】 | `{ title, detail?, model? }[]`；`title` 与 `phase()` / `opts.phase` 按字符串精确匹配。 |

**约束**【官方】：`meta` 必须是纯字面量——不得有变量、函数调用、展开运算符、模板插值（运行时在执行脚本前**静态读取**它）。这条同时被本书实测的第三方校验器（`validate-workflow.mjs`）逐条检查（见 [附录 B](#/zh/app-b)）。

### `phases[].model` 的运行时效果：未定，按「安全做法」处理

`meta.phases[]` 的每项可带一个 `model`。**它的运行时语义本书无法独立核实**：官方工具描述措辞含糊（像是「某阶段用特定模型 override 时加上」），第三方资料则称它**纯展示用、运行时不读**——两说本书都不能断言。

根因是本书实测会话设了环境变量 `CLAUDE_CODE_SUBAGENT_MODEL=claude-opus-4-7[1m]`，它**覆盖一切 per-call model**：在 `wf_9c94951d-58c` 里，5 个分别标了 `haiku` / `inherit` / `opus` / 省略 / 「在标了 `model:'haiku'` 的阶段内」的 agent，**全部跑成了 Opus**。因此本会话**无法**把 `phases[].model` 与 `opts.model` 的效果分离开来。

<div class="callout warn">

**安全做法**：真正决定模型的，只信 `agent()` 的 `opts.model`。要某阶段跑 Haiku，就在该阶段每个 `agent()` 上写 `model: 'haiku'`；把 `phases[].model` 当作权限对话框里的「标签」用，别指望它单独生效。另外，如果你的环境（或 CI）设了 `CLAUDE_CODE_SUBAGENT_MODEL`，那么**脚本里所有 `model` 选项都会被静默忽略**——这是用户/CI 旋钮，脚本无法控制。

</div>

---

## A.5 `agent(prompt, opts?) → Promise<any>`【官方】

派发一个 subagent。这是工作流里唯一会真正花 token 的原语——纯编排（不调 `agent()`）是 0 token（`wf_59bf3654-183`、`wf_2b04881f-6a9` 均为 0 token / 个位数毫秒）。

```javascript
await agent(prompt, {
  label,       // string?  进度显示标签，默认自动编号
  phase,       // string?  显式归入某进度组（pipeline/parallel 内部务必用它）
  schema,      // object?  JSON Schema，强制结构化输出
  model,       // string?  覆盖模型（省略=继承主循环模型；简单任务可 'haiku'）
  isolation,   // 'worktree'?  在独立 git worktree 运行（昂贵）
  agentType,   // string?  自定义 subagent 类型（如 'Explore'）
})
```

### 返回语义【官方】【实测】

- 无 `schema` → 返回 subagent 最终文本（`string`）。
- 有 `schema` → 强制 subagent 调 `StructuredOutput` 工具，**在工具调用层校验**，返回**已验证对象**；不匹配则模型重试。本书每次带 schema 的运行都成功返回了已验证对象（如 `wf_dacbd480-d5d` 的 `sum=4` 为数字而非字符串）。**返回的就是对象，无需 `JSON.parse`。**
- 用户中途跳过该 agent → 返回 `null`（用 `.filter(Boolean)` 过滤）。【官方】

### 选项细节

| 选项 | 口径 | 说明 |
|---|---|---|
| `label` | 【官方】 | 覆盖 `/workflows` 里的显示标签；描述性 label 利于搜索与观察。**不参与续传缓存键**——改它不会让缓存失效。 |
| `phase` | 【官方】 | 显式归组；与 `meta.phases.title` 精确匹配。**在 pipeline/parallel 内部务必用它**，避免对全局 `phase()` 的竞争。同样**不参与缓存键**。 |
| `schema` | 【官方】 | JSON Schema；校验在工具调用层，故模型会自动重试到合规。**参与续传缓存键**。 |
| `model` | 【官方】 | 覆盖该 agent 模型；**省略则继承主循环模型**（推荐，除非用户指定或任务足够简单可用 `'haiku'`）。**参与续传缓存键**。注意会被 `CLAUDE_CODE_SUBAGENT_MODEL` 覆盖（见 A.4）。 |
| `isolation: 'worktree'` | 【官方】 | 在全新 git worktree 运行；**昂贵**（约 200–500ms 启动 + 磁盘/agent），仅当并行 agent 改文件会冲突时用；无改动自动清理；**结果返回 worktree 路径与分支**。**参与续传缓存键**。 |
| `agentType` | 【官方】【实测有校验】 | 用自定义 subagent 类型而非默认；**与 Agent 工具同一注册表解析**；与 `schema` 可组合（自定义 agent 的系统提示会被追加 StructuredOutput 指令）。**参与续传缓存键**。 |

### `agentType` 有校验，`model` 没有：一个真实的不对称【实测】

这是本书亲测出的一处关键差异，值得记牢：

- **`agentType` 有校验**【实测，`wf_a222f20f-0f5`】：传一个不存在的类型，会在**生成任何模型之前**（0 token / 4ms）就抛错，并列出全部可用 agent。报错原文：

```text
agent({agentType}): agent type 'definitely-not-a-real-agent-xyz' not found.
Available agents: claude, claude-code-guide, codex:codex-rescue, Explore,
general-purpose, get-current-datetime, init-architect, Plan, planner,
statusline-setup, team-architect, team-qa, team-reviewer, ui-ux-designer
```

> 也就是说，拼错 `agentType` 是「快速失败、零成本」——这点对调试非常友好。（注：默认 subagent 的类型名是 `workflow-subagent`，记录在每 agent 的 `agent-<id>.meta.json` 旁车文件里。）

- **`opts.model` 无校验**：这点本书**未能实测**（被 `CLAUDE_CODE_SUBAGENT_MODEL` 覆盖掩盖）。第三方资料声称 `model` 接受 `'inherit'` 字面量、且拼错（如 `'hauku'`）不在解析期报错、passthrough 后才失败——**（社区第三方资料声称，本书未独立实测）**。本书的稳妥建议：把 `model` 当成只接受你确认过的值（如 `'haiku'`、省略），不要依赖拼错的「宽容」。

---

## A.6 `pipeline(items, stage1, stage2, …) → Promise<any[]>`【官方】

每个 item **独立**流过全部 stage，**阶段间无屏障**。墙钟 ≈ 最慢的单条链，而非「各阶段最慢之和」。**多阶段默认用 `pipeline()`。**

- 每个 stage 回调收到 `(prevResult, originalItem, index)`。
- 第一阶段：`prevResult === item`。
- 某 stage 抛错 → 该 item 变 `null` 并跳过其余 stage。

```javascript
const out = await pipeline(items,
  (item, _orig, i) => agent(`stage1 for ${item}`, { phase: 'S1', schema: A }),
  (r, item, i)     => agent(`stage2 using ${r.x} (orig ${item})`, { phase: 'S2', schema: B }),
)
```

本书实测（`wf_bf086b98-6ec`，3 项 × 2 阶段）`agent_count=6` 印证了「每项独立过每阶段」；阶段签名 `(prev, orig, i)` 与上表一致。

## A.7 `parallel(thunks) → Promise<any[]>`【官方】

并发执行一组 **thunk**（`() => Promise`），**屏障**：等全部完成。结果顺序 = 输入顺序。仅当确实需要所有结果一起时才用。

- 异步 reject / 内部 `agent()` 出错 → 该位置 `null`；**thunk 体内同步 `throw` 会 reject 整个调用**（用前先 `.filter(Boolean)`）。

```javascript
const results = (await parallel(items.map(it => () => agent(prompt(it), { schema: S })))).filter(Boolean)
```

<div class="callout warn">

传给 `parallel()` 的必须是**函数数组（thunk）**（`() => agent(...)`），不是 Promise 数组（`agent(...)`）。后者会在构造数组时**立即开始执行**，从而不符合 `parallel(thunks)` 的 API、失去其异步失败归集语义（async reject / agent 出错 → 对应位置 `null`）。注意：并发上限是**每工作流**的（`min(16, 核心−2)`），不是 `parallel()` 专属——别把这条 warn 误读成「绕过运行时节流」。

</div>

## A.8 其它全局【官方】

| 全局 | 签名 | 说明 |
|---|---|---|
| `phase(title)` | `(string) => void` | 开启新阶段，其后 `agent()` 归入该组。 |
| `log(message)` | `(string) => void` | 向用户输出一行进度叙述（进度树上方）。 |
| `args` | `any` | Workflow 入参 `args` 的值（未传则 `undefined`）。详见 [A.11](#a11-args-原样透传与归一化实测)。 |
| `budget` | 见下 | 本回合 token 预算对象。 |
| `workflow(nameOrRef, args?)` | `(string\|{scriptPath}, any?) => Promise<any>` | 内联运行另一工作流；共享并发上限/agent 计数/中止信号/token 预算；**嵌套仅一层**。 |

### `budget`【官方】

```javascript
budget.total        // number | null：本回合 token 目标；null = 未设目标
budget.spent()      // number：本回合已花的 output token（主循环 + 所有工作流共享池）
budget.remaining()  // number：max(0, total - spent())；未设目标时为 Infinity
```

- `total` 来自用户的 `+500k` 式指令；未设时为 `null`（实测 `wf_59bf3654-183` 里 `budget.total === null`）。
- 它是**硬上限**：`spent()` 达 `total` 后再调 `agent()` 会抛错。池为主循环 + 所有工作流（含嵌套）**共享**。
- 动态循环务必用 `budget.total &&` 守卫，否则可能一路派 agent 撞上限。

### `workflow(nameOrRef, args?)`【官方】【实测】

内联运行另一个工作流（具名，或 `{ scriptPath }`）。共享并发上限 / agent 计数 / 中止信号 / token 预算。本书实测（`wf_2b04881f-6a9`）：

- `workflow({ scriptPath }, { n: 21 })` 内联跑子工作流、**args 透传**（子返回 `doubled: 42`）。
- 未知具名抛错并列出已注册具名工作流：`bughunt, bughunt-lite, deep-research, plan-hunter, review-branch`。
- **嵌套仅一层**：子工作流里再调 `workflow()` 抛错，原文：

```text
workflow() cannot be called from within a child workflow — nesting is limited
to one level. Inline the inner script or call its agents directly.
```

---

## A.9 确定性沙箱：双层防护【实测】

禁用 `Date.now()` / `Math.random()` / 无参 `new Date()` 是为了保住续传所需的可重放性。这套禁用是**双层**的，本书在 `wf_59bf3654-183` 上完整验证：

**第一层——提交时静态扫描拒绝**：脚本里出现**字面量** `Date.now()`（或 `Math.random()` / 无参 `new Date()`），在**提交时**就被静态源扫描拒绝，脚本**根本不运行**（返回 `error`，无 Run ID）。你 `try/catch` 也救不了——它在解析前就拦下了。报错原文：

```text
Workflow scripts must be deterministic: Date.now()/Math.random()/new Date() are
unavailable (breaks resume). Stamp results after the workflow returns, or pass
timestamps via args.
```

**第二层——运行时陷阱**：把调用**别名化**（如 `const D = Date; D.now()`）能绕过字面量扫描、通过提交，但调用会在**运行时抛错**，被脚本自己的 `try/catch` 接住。两条错误信息各不相同：

```text
Date.now() / new Date() are unavailable in workflow scripts (breaks resume).
Stamp results after the workflow returns, or pass timestamps via args.
```

```text
Math.random() is unavailable in workflow scripts (breaks resume).
For N independent samples, include the index in the agent label or prompt.
```

> 注意 `Math.random` 的运行时报错甚至**给了替代方案**：要 N 个独立样本，就把下标编进 agent 的 label 或 prompt（这正是确定性的正确姿势——同样的脚本 + 同样的 args 必须每次产出同样的结果）。

**仍然可用的**【实测】：`new Date(具体值)` 正常（`new Date(0)` → `1970-01-01T00:00:00.000Z`）；标准内置 `Math.max`、`JSON` 等照常工作。

**绕路写法**：需要时间戳，用 `args` 传入、或工作流返回后再盖戳；需要随机性，用 agent 下标变化提示词。

<div class="callout info">

第三方仓库还附带一个提交前 lint（`validate-workflow.mjs`），本书**实跑确认**了它的行为（合法脚本 `ok … passes`；违规脚本逐条报错）。它检查的「规则」（meta 须为首条纯字面量语句、禁用非确定性调用、宿主 API 警告、`parallel` 须传 thunk）以官方工具定义 + 本书实测为准；校验器只是把这些规则做成了可跑的 lint。详见 [附录 B](#/zh/app-b)。

</div>

---

## A.10 续传 resume【官方】【实测】

**机制**【官方】：同脚本 + 同 args 重跑时，**最长未改动的 `agent()` 前缀**秒级返回缓存结果；**第一个被编辑/新增的调用及其之后**全部 live 重跑。journal 记录每次 `agent()`（落为 `agent-<id>.jsonl`）。**仅同会话**；续传前先用 TaskStop 停掉上一次运行。

**实测**（`wf_9c94951d-58c`）：首跑 5 个 agent = **133,691 token / 32,959ms**；带 `{ scriptPath, resumeFromRunId }` **原样重跑** → 同一 Run ID、5 个结果完全一致、**0 新 token / 3ms**。也就是说，未改动的续传是「100% 缓存命中」，几乎零成本。

**缓存键由什么组成**：缓存键基于每个 `agent()` 的 `(prompt, opts)`；其中 `label` / `phase` 是装饰性的、**不参与缓存键**——改它们不会让缓存失效。至于「缓存键恰好等于 `schema` / `model` / `isolation` / `agentType` 这几个字段的精确组合」——**（社区第三方资料声称，本书未独立实测精确组成）**；本书已实测确认的是「改 `label` / `phase` 不破坏缓存、改 `prompt` 会」。

---

## A.11 `args` 原样透传与归一化【实测】

【实测，`wf_59bf3654-183`】传入 `args = { hello: 'world', n: 5, nested: { deep: true } }`，脚本里：`typeof args === 'object'`、原样可见（`nested.deep` 仍是 `true`）、`Array.isArray(args) === false`。**对象保持对象，不会被字符串化。**

正因如此，读 `args` 字段前要**归一化**——千万**别无条件** `JSON.parse(args)`（对象会直接抛错）。稳妥 idiom：

```javascript
// 仅当 args 是字符串时才尝试解析；对象/缺省都原样处理
const input = (typeof args === 'string')
  ? (() => { try { return JSON.parse(args) } catch { return {} } })()
  : (args ?? {})

const n = input.n ?? 1   // 现在可安全读字段
```

---

## A.12 触发与门控【官方】

- **门控**：环境变量 `CLAUDE_CODE_WORKFLOWS=1`。
- **触发**：①消息含 `ultrawork` 关键词；②直接调用 Workflow 工具；③具名工作流 / 触发它的技能或斜杠命令。
- **实时进度**：斜杠命令 `/workflows`。

---

## A.13 并发与规模【官方】

| 限制 | 值 | 口径 |
|---|---|---|
| 单工作流同时运行 agent | `min(16, CPU 核心数 − 2)`，超出**排队**（非报错） | 【官方】 |
| 单工作流 `agent()` 总数上限 | **1000**（失控循环兜底 "runaway-loop backstop"） | 【官方】 |
| 脚本体积上限 | **524288 字节（512KB）**（input-schema 的 `script.maxLength`） | 【官方】 |
| `workflow()` 嵌套层数 | **1 层**（子工作流内再调 `workflow()` 抛错） | 【官方】【实测】 |

---

## A.14 第三方·未核实清单（谨慎）

下列说法来自第三方仓库 `claude-code-workflow-creator`（某 YouTuber 的视频配套仓库，**非官方**）。本书在本机**无法触发/无法隔离**，既不能证实也不能证伪。**列在此处仅为提醒：当你在别处看到它们时，知道它们尚未被本书核实，不要当权威真值。**

> **更新 · R4 实测升级。** 下面这 4 条曾经也躺在「未核实」里，但本书已在本机**真实复现**，现已移出——它们现在是**实测事实**，不再是第三方声称：
>
> | 曾经第三方声称 → 现已实测 | 证据（Run ID / 报错原文） |
> |---|---|
> | VM **30000ms 同步超时** | Run `wf_e3b2b123-5f4`：无 `await` 的长同步循环在 30,222ms 处被终止，报错 `Script execution timed out after 30000ms`。仅约束**同步**执行，非 wall-clock 上限。 |
> | `isolation: 'remote'` 在本 build 禁用 | Run `wf_dace2fc6-966`：抛 `agent({isolation:'remote'}) is not available in this build`。**精化**：运行时只特判 `'worktree'`(执行) 与 `'remote'`(拒绝)，其它未知值**静默忽略**、不报错。 |
> | `meta` 保留键被拒（提交期） | 提交期静态拒绝，以 `constructor` 为例，报错 `reserved key name not allowed in meta: constructor`。（`__proto__` / `prototype` 未逐一测，但拒绝机制已确认。） |
> | `opts.model` **无提交期校验** | Run `wf_dace2fc6-966`：`model: 'totally-not-a-real-model-xyz'` 提交期不报错、agent 照跑。⚠ 本会话 `CLAUDE_CODE_SUBAGENT_MODEL` 覆盖了每调用 model，故「之后在 API 调用处失败」未能观察到。 |

| 第三方声称 | 本书态度 |
|---|---|
| 错误类名 `WorkflowAgentCapError` / `WorkflowBudgetExceededError` | **未核实**。官方只描述了行为（达 1000 上限 / 预算耗尽会出错），未给类名。 |
| 并发**下限** `max(2, …)` | **未核实**。官方只给了上限 `min(16, 核心−2)`。 |
| `stallMs` 默认 **180000ms**、停滞重试 **≤5 次** | **未核实**。（`setTimeout` 全局存在是实测事实，但这些毫秒/次数不是。） |
| 预算耗尽时在途 agent 完成且结果保留、不再启新 agent | **未核实**。 |
| schema 经 **AJV** 编译校验、subagent 不调工具时「最多再催两次」 | **未核实**。本书只确认「带 schema 必返回已验证对象、不匹配则重试」（官方+实测），**不**断言确切重试次数。 |
| `opts.model` 的 `'inherit'` 字面量的**确切语义** | **未核实精确语义**。注：「`model` 无提交期校验」部分已实测升级（见本节顶部表）；对比 `agentType` 实测确认有校验（A.5）。 |
| resume 缓存键 = `schema` / `model` / `isolation` / `agentType` 的**精确组合** | **未核实精确组成**。本书实测确认的是「`label` / `phase` 不入键、`prompt` 入键」（A.10）。 |

---

## A.15 最小骨架模板

```javascript
export const meta = {
  name: 'my-workflow',
  description: 'one-line description shown in the permission dialog',
  phases: [{ title: 'Work' }],
}

phase('Work')
const result = await agent('do the thing', {
  label: 'worker',
  schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
})
log(`done: ${result.ok}`)
return result
```

> 字段语义如有疑问，以你本机 `@anthropic-ai/claude-code/sdk-tools.d.ts` 中的 `WorkflowInput` / `WorkflowOutput` 为最终依据；行为细节以你本机的真实运行为准。
