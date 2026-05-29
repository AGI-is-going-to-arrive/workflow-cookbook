# 附录 A · API 完整参考

> 本附录是全书的 API 速查，对照 Claude Code 官方分发包的类型定义 `sdk-tools.d.ts`（`WorkflowInput` / `WorkflowOutput` 接口）、Workflow 工具定义原文，以及本机真实运行记录（见 [附录 E](#/zh/app-e)）整理而成。
>
> 适用版本：**Claude Code v2.1.154+（官方最低要求）**；本书的 API 形态多取自 v2.1.150–v2.1.156 的实测与二进制核查，核心不变量已在 **v2.1.156** 复核（`claude --version` 实测；主循环 Opus 4.8 (1M)，`CLAUDE_CODE_WORKFLOWS=1`，见 [`examples-r11.md`](https://github.com/AGI-is-going-to-arrive/workflow-cookbook/blob/main/assets/transcripts/examples-r11.md)）。这是官方的 **research preview** 特性，字段可能随版本演进——以你本机的类型定义为最终依据。

---

## A.0 怎么读这份参考：三档口径

API 文档最怕的就是「说得斩钉截铁，其实全是猜的」。所以本书把每条事实按可信度分成三档，正文里都会用一套统一的记号标出来，你先认一下：

| 记号 | 含义 | 你可以怎样依赖它 |
|---|---|---|
| **【官方】** | 来自 Claude Code 官方工具定义 / `sdk-tools.d.ts` 类型 | 当作权威真值，正常陈述。 |
| **【实测】** | 本机真实跑过、有 Run ID（形如 `wf_59bf3654-183`） | 当作权威真值；会附上运行编号与数据。 |
| **【第三方·未核实】** | 来自社区第三方资料（某 YouTuber 的配套仓库 `claude-code-workflow-creator`，**非官方**），本书未独立复现 | **不要当事实**。仅在确有教学价值时提及，且必然带此标注。 |

<div class="callout info">

为什么要这么较真？因为你在网上搜「Workflow API 细节」，搜到的内容里相当一部分都出自同一个第三方视频配套仓库——它不是官方产物，里头有些精确数字（错误类名、超时毫秒、重试次数等）此前我们**在本机无法 runtime 复现**（R10 已用 2.1.154 官方二进制核查证实了其中一批，见 [A.14](#a14-第三方未核实清单谨慎)——属「二进制确认」，强于第三方声称、但仍非 runtime 实测）。要是把没核实的跟官方的、实测的混在一起写，就是在造一堆看着挺权威、其实没谱的噪声。所以本附录宁可少写，也不把未核实的东西当真。

</div>

---

## A.1 Workflow 工具：入参 `WorkflowInput`【官方】

这是你调 Workflow 工具时传进去的入参。脚本从哪来有三种途径（`script` / `name` / `scriptPath`），再加一个 `args`。**`scriptPath` 优先级最高**（高于 `script` 和 `name`）；至于 `script` 和 `name` 谁先谁后，官方没说，所以别想当然以为是「`scriptPath` > `script` > `name`」这种三级排序。

| 字段 | 类型 | 说明 |
|---|---|---|
| `script` | `string?` | 自包含脚本。**必须**以纯字面量 `export const meta = {…}` 开头，随后是脚本体。 |
| `name` | `string?` | 预定义/具名工作流（内置或 `.claude/workflows/`），解析为一段自包含脚本。 |
| `args` | `object?` | 暴露给脚本的全局 `args`。用于参数化具名工作流。 |
| `scriptPath` | `string?` | 磁盘脚本路径。每次调用脚本都会落盘并在结果里返回该路径；可用 Write/Edit 改后用此字段重跑，无需重发整段脚本。**优先级最高**。 |
| `resumeFromRunId` | `string?` | 从某次运行断点续传。未改动的 `agent()` 调用返回缓存结果；**仅同会话**。续传前先停掉上一次运行（TaskStop）。 |

### 持久化-编辑循环：`scriptPath` 的真正威力

`script` 和 `scriptPath` 乍一看只是「内联 vs 路径」的区别，但后者其实给你解锁了一套很顺的迭代节奏。【官方】每次跑脚本（不管你用 `script` 还是 `scriptPath` 提交），Workflow 工具都会把脚本**落盘**，再在返回的 `WorkflowOutput.scriptPath` 里告诉你落到哪了。这么一来，循环就转起来了：

```text
首次：用 script 提交  ──►  返回 scriptPath（脚本已落盘）
                              │
            用 Edit 改这个文件 ◄──┘
                              │
重跑：用 { scriptPath } 提交（无需重发整段脚本）──►  又返回 scriptPath
```

再配上 `resumeFromRunId`，这套循环就成了「改一处、只重跑改动之后那几步」的底子（见 [A.10](#a10-续传-resume官方实测) 与 [附录 B](#/zh/app-b)）。

---

## A.2 Workflow 工具：返回 `WorkflowOutput`【官方】

Workflow 工具**始终异步**，它会马上给你一张回执（不是工作流跑完的结果）。

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

工作流的**真正结果**，是等它跑完时通过 `<task-notification>` 送过来的，里面带着返回值和用量统计（`agent_count` / `tool_uses` / `total_tokens` / `duration_ms`）。你就把 `taskId`/`runId` 想成「快递单号」、把 notification 想成「包裹」——别拿着单号就当包裹拆了。

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
- **没有**文件系统 / Node API：脚本体里 `require` / `process` / `fetch` 全是 `undefined`【实测，`wf_59bf3654-183`】。文件、shell、网络这些活只能塞进 `agent()` 叶子里去做——只有 subagent 才带 Read/Write/Bash 这些工具。
- **禁用 `Date.now()` / `Math.random()` / 无参 `new Date()`**——它们会破坏续传要靠的可重放性，所以有双层拦着（见 [A.9](#a9-确定性沙箱双层防护实测)）。`new Date(具体值)` 是正常的【实测】。

### 脚本体内注入的全局

下面这张表，列的是脚本体里不用 `import` 就能直接拿来用的全局。其中 `agent` / `pipeline` / `parallel` / `phase` / `log` / `budget` / `args` / `workflow` 是**官方工具定义**里列出来的；`console` / `setTimeout` / `clearTimeout` 则是本书**实测确认**也一并注入了的。

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

**说说 `console` / `setTimeout` / `clearTimeout`**：在 `wf_59bf3654-183`（一个 0 agent 的自省工作流）里，`typeof console === 'object'`、`typeof setTimeout === 'function'`、`typeof clearTimeout === 'function'`，而且 `console.log(...)` 也调用成功了（输出进 workflow 日志）。日常报告进度，还是优先用官方的 `log()`；`console.log` 更像是个调试用的旁路。这三个全局**确实存在**，这是实测出来的事实【实测，`wf_59bf3654-183`】。还有一条相关的实测事实：**VM 给同步执行设了 30000ms 超时**【实测，`wf_e3b2b123-5f4`】——一个不带 `await` 的长同步循环被掐断了、工作流 **failed**（实测耗时 30,222ms），报错一字不差是 `Error: Script execution timed out after 30000ms`。它管的是**同步**这块、专门用来抓死循环，**不是墙钟上限**（带 `await agent(...)` 的异步工作流照样能跑上好几分钟），细节见 [A.14](#a14-第三方未核实清单谨慎) 顶部那张实测升级表。

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

**约束**【官方】：`meta` 必须是纯字面量——不得有变量、函数调用、展开运算符、模板插值（运行时在跑脚本之前会**静态读取**它）。这一条，本书实测的那个第三方校验器（`validate-workflow.mjs`）也逐条查了（见 [附录 B](#/zh/app-b)）。

### `phases[].model` 的运行时效果：未定，按「安全做法」处理

`meta.phases[]` 里每一项都可以带一个 `model`。**它在运行时到底是什么语义，本书无法独立核实**：官方工具描述说得含含糊糊（像是「某阶段用特定模型 override 时加上」），第三方资料又说它**纯展示用、运行时根本不读**——这两种说法本书都不敢断言。

根上的原因是，跑这个探针的会话设了环境变量 `CLAUDE_CODE_SUBAGENT_MODEL`，它**覆盖一切 per-call model**：在 `wf_9c94951d-58c`（**早期 4.7 会话**，`CLAUDE_CODE_SUBAGENT_MODEL=claude-opus-4-7[1m]`）里，5 个分别标了 `haiku` / `inherit` / `opus` / 省略 / 「在标了 `model:'haiku'` 的阶段内」的 agent，**全部跑成了 Opus**。所以这一会话里，本书**无法**把 `phases[].model` 和 `opts.model` 各自的效果拆开来看。（另一条独立环境事实：R11 复核会话的该变量是 `claude-opus-4-8[1m]`，即 Opus 4.8——见 [附录 E · E.2](#/zh/app-e)；本节这个覆盖结论与具体型号无关，4.7、4.8 两个会话都成立。）

<div class="callout warn">

**安全做法**：真正决定模型的，只信 `agent()` 的 `opts.model`。想让某阶段跑 Haiku，就在那个阶段的每个 `agent()` 上都写上 `model: 'haiku'`；至于 `phases[].model`，就当它是权限对话框里的一个「标签」，别指望它自己能生效。还有，要是你的环境（或 CI）设了 `CLAUDE_CODE_SUBAGENT_MODEL`，那**脚本里所有 `model` 选项都会被静默忽略**——这是用户/CI 那头的旋钮，脚本无法控制。实测还有**第二层**覆盖：`ANTHROPIC_DEFAULT_HAIKU_MODEL` / `SONNET` / `OPUS` 会把**模型别名**整个重映射一遍（本会话这两层都指向 Opus，所以脚本里写 `model: 'haiku'`、实跑还是 Opus，`wf_e8cb23ff-829`）。所以排查「我指定的模型怎么没跑起来」时，这两类变量都得查一查。

</div>

---

## A.5 `agent(prompt, opts?) → Promise<any>`【官方】

派一个 subagent 出去干活。这是工作流里唯一会真正花 token 的原语——光编排、不调 `agent()`，那就是 0 token（`wf_59bf3654-183`、`wf_2b04881f-6a9` 都是 0 token / 个位数毫秒）。

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
- 有 `schema` → 强制 subagent 调 `StructuredOutput` 工具，**在工具调用层校验**，返回**已验证对象**；对不上模型就重试。本书每一次带 schema 的运行，都成功拿回了已验证对象（比如 `wf_dacbd480-d5d` 里的 `sum=4` 是个数字，不是字符串）。**拿到手的就是对象，无需 `JSON.parse`。**
- 用户中途跳过该 agent → 返回 `null`（用 `.filter(Boolean)` 过滤）。【官方】

### 选项细节

| 选项 | 口径 | 说明 |
|---|---|---|
| `label` | 【官方】【实测】 | 覆盖 `/workflows` 里的显示标签；描述性 label 利于搜索与观察。**R8 实测确认 `label` 不入续传缓存键**：只改某 agent 的 label、其余不变 → 续传 0 token 全命中（`wf_4ffde230-535`，见 A.10）。 |
| `phase` | 【官方】 | 显式归组；与 `meta.phases.title` 精确匹配。**在 pipeline/parallel 内部务必用它**，避免对全局 `phase()` 的竞争。（第三方称不参与续传缓存键，本书未独立核实。） |
| `schema` | 【官方】 | JSON Schema；校验在工具调用层，故模型会自动重试到合规。（第三方称参与续传缓存键，本书未独立核实。） |
| `model` | 【官方】 | 覆盖该 agent 模型；**省略则继承主循环模型**（推荐，除非用户指定或任务足够简单可用 `'haiku'`）。注意会被 `CLAUDE_CODE_SUBAGENT_MODEL` 覆盖（见 A.4）。（第三方称参与续传缓存键，本书未独立核实。） |
| `isolation: 'worktree'` | 【官方】【实测】 | 在全新 git worktree 运行；**昂贵**（约 200–500ms 启动 + 磁盘/agent），仅当并行 agent 改文件会冲突时用；无改动自动清理。**注意**：「返回 worktree 路径与分支」是 Agent 工具定义在**工具结果信封层**的说法，**不是脚本里 `agent()` 的返回值**——R9 实测（`wf_17307da4-707`）：一个在 worktree 里建文件的 `agent({isolation:'worktree'})`，脚本拿到的是 agent 的常规输出（无 schema 即 `string`），不是 `{path,branch}` 对象；实测 worktree 落在 `.claude/worktrees/wf_<runId>-N`、分支名 `worktree-wf_<runId>-N`。（第三方称参与续传缓存键，本书未独立核实。） |
| `agentType` | 【官方】【实测有校验】 | 用自定义 subagent 类型而非默认；**与 Agent 工具同一注册表解析**；与 `schema` 可组合（自定义 agent 的系统提示会被追加 StructuredOutput 指令）。（第三方称参与续传缓存键，本书未独立核实。） |

### `agentType` 有校验，`model` 没有：一个真实的不对称【实测】

这是本书亲手测出来的一处关键差异，值得记牢：

- **`agentType` 有校验**【实测，`wf_a222f20f-0f5`】：你传一个不存在的类型进去，它会在**生成任何模型之前**（0 token / 4ms）就抛错，还把全部可用 agent 列给你。报错原文：

```text
agent({agentType}): agent type 'definitely-not-a-real-agent-xyz' not found.
Available agents: claude, claude-code-guide, codex:codex-rescue, Explore,
general-purpose, get-current-datetime, init-architect, Plan, planner,
statusline-setup, team-architect, team-qa, team-reviewer, ui-ux-designer
```

> 换句话说，`agentType` 拼错了就是「快速失败、零成本」——这一点对调试特别友好。（注：默认 subagent 的类型名叫 `workflow-subagent`，记在每个 agent 的 `agent-<id>.meta.json` 旁车文件里。）

- **`opts.model` 无提交/解析期校验**【实测，`wf_dace2fc6-966`】：你传一个胡编的字符串 `'totally-not-a-real-model-xyz'`，它**不在提交/解析期被拒**，agent 照样运行（本会话因为 `CLAUDE_CODE_SUBAGENT_MODEL` 覆盖、实跑 Opus）。这就跟 `agentType` 形成对比了：`agentType` 是「快速失败、零成本」，而 `model` 不在解析期拦无效值。
- 但有两点本书**未能核实**——`'inherit'` 字面量的**精确语义**，还有「拼错（比如 `'hauku'`）会先 passthrough、到 **API 调用时**才失败」这一步：**（社区第三方资料声称，本书未独立实测）**。后面这点之所以没测到，是因为本会话的 `CLAUDE_CODE_SUBAGENT_MODEL` 覆盖了每调用 model、那个胡编的串压根没真正发到 API 去，所以 API 期的失败没法观测。本书给的稳妥建议是：把 `model` 当成只认你确认过的值（比如 `'haiku'`、或者省略），别去指望拼错了它会「宽容」。

---

## A.6 `pipeline(items, stage1, stage2, …) → Promise<any[]>`【官方】

每个 item 各自**独立**地流过全部 stage，**阶段之间没有屏障**。所以墙钟时间 ≈ 最慢的那一条单链，而非「各阶段最慢的加起来」。**多阶段就默认用 `pipeline()`。**

- 每个 stage 回调拿到的是 `(prevResult, originalItem, index)`。
- 第一阶段：`prevResult === item`。
- 哪个 stage 抛错了 → 那个 item 就变成 `null`、其余 stage 直接跳过。

```javascript
const out = await pipeline(items,
  (item, _orig, i) => agent(`stage1 for ${item}`, { phase: 'S1', schema: A }),
  (r, item, i)     => agent(`stage2 using ${r.x} (orig ${item})`, { phase: 'S2', schema: B }),
)
```

本书实测（`wf_bf086b98-6ec`，3 项 × 2 阶段）的 `agent_count=6` 就坐实了「每项各走各的、把每个阶段都过一遍」；阶段签名 `(prev, orig, i)` 也跟上表对得上。**「第一阶段 `prevResult === item`」这点，R9 又用一个 0-agent 探针单独钉死**（`wf_63b7a365-fdc`：两个 item 的 `prevResult === originalItem` 都返回 `true`，0 token / 6ms）。

## A.7 `parallel(thunks) → Promise<any[]>`【官方】

把一组 **thunk**（`() => Promise`）并发跑起来，**屏障**：等它们全部跑完。结果顺序 = 输入顺序。仅当你确实要把所有结果凑齐一起用时，才用它。

- 异步 reject / 内部 `agent()` 出错 → 这个位置就是 `null`；但**thunk 体里同步 `throw` 会把整个调用都 reject 掉**（用之前先 `.filter(Boolean)`）。

```javascript
const results = (await parallel(items.map(it => () => agent(prompt(it), { schema: S })))).filter(Boolean)
```

<div class="callout warn">

传给 `parallel()` 的必须是**函数数组（thunk）**（`() => agent(...)`），不能是 Promise 数组（`agent(...)`）。后者会在你构造数组的那一刻就**立即开始执行**，这样一来就不符合 `parallel(thunks)` 的 API、也丢掉了它那套异步失败归集语义（async reject / agent 出错 → 对应位置 `null`）。注意：并发上限是按**每工作流**算的（`min(16, 核心−2)`），不是 `parallel()` 专属的——别把这条 warn 误读成「能绕过运行时节流」。

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

- `total` 来自用户那条 `+500k` 式的指令；没设的时候是 `null`（实测 `wf_59bf3654-183` 里 `budget.total === null`）。
- 它是**硬上限**：`spent()` 一旦摸到 `total`，你再调 `agent()` 就会抛错。这个池子是主循环 + 所有工作流（含嵌套）**共享**的。
- 动态循环里务必拿 `budget.total &&` 守一下，否则可能一路狂派 agent、直接撞上限。

### `workflow(nameOrRef, args?)`【官方】【实测】

内联跑另一个工作流（具名的，或者给个 `{ scriptPath }`）。它跟主工作流**共享**并发上限 / agent 计数 / 中止信号 / token 预算。本书实测：

- `workflow({ scriptPath }, { n: 21 })` 把子工作流内联跑起来、**args 也透传过去**（子返回 `doubled: 42`，`wf_2b04881f-6a9`，v2.1.150）。
- 给一个不认识的具名，它会抛错、顺便把**已注册的具名工作流**列出来。**v2.1.156 实测，注册表里只剩 `deep-research` 一个**——报错原文 `Available: deep-research`（`wf_03e38250-1bb`），与官方文档「Claude Code 只自带 `/deep-research` 这一个 bundled workflow」完全吻合。早期 v2.1.150 这里列的是五件套 `bughunt, bughunt-lite, deep-research, plan-hunter, review-branch`（`wf_2b04881f-6a9`），但那批在 v2.1.156 已**不在**注册表了，详见 [A.13.1](#a131-内置具名工作流注册表的版本漂移实测)。
- **嵌套仅一层**：在子工作流里再调 `workflow()` 就抛错，原文：

```text
workflow() cannot be called from within a child workflow — nesting is limited
to one level. Inline the inner script or call its agents directly.
```

---

## A.9 确定性沙箱：双层防护【实测】

禁用 `Date.now()` / `Math.random()` / 无参 `new Date()`，是为了保住续传要靠的那份可重放性。这套禁用是**双层**的，本书在 `wf_59bf3654-183` 上从头到尾验证过：

**第一层——提交时静态扫描拒绝**：脚本里只要出现**字面量** `Date.now()`（或 `Math.random()` / 无参 `new Date()`），**提交时**就被静态源扫描拦下，脚本**根本不运行**（返回 `error`，无 Run ID）。你拿 `try/catch` 也救不了——它在解析之前就把你截住了。报错原文：

```text
Workflow scripts must be deterministic: Date.now()/Math.random()/new Date() are
unavailable (breaks resume). Stamp results after the workflow returns, or pass
timestamps via args.
```

**第二层——运行时陷阱**：把调用**别名化**（比如 `const D = Date; D.now()`），是能骗过字面量扫描、混过提交的，但这调用会在**运行时抛错**，被脚本自己的 `try/catch` 接住。两条错误信息各不相同：

```text
Date.now() / new Date() are unavailable in workflow scripts (breaks resume).
Stamp results after the workflow returns, or pass timestamps via args.
```

```text
Math.random() is unavailable in workflow scripts (breaks resume).
For N independent samples, include the index in the agent label or prompt.
```

> 留意一下，`Math.random` 的运行时报错甚至**把替代方案都给你了**：想要 N 个独立样本，就把下标编进 agent 的 label 或 prompt（这恰恰是确定性的正确姿势——同样的脚本 + 同样的 args 必须每次都产出同样的结果）。

**还能用的**【实测】：`new Date(具体值)` 正常（`new Date(0)` → `1970-01-01T00:00:00.000Z`）；标准内置 `Math.max`、`JSON` 这些都照常工作。

**绕路的写法**：要时间戳，就用 `args` 传进来、或者等工作流返回后再盖戳；要随机性，就拿 agent 下标去变提示词。

<div class="callout info">

那个第三方仓库还捎带一个提交前 lint（`validate-workflow.mjs`），它的行为本书**实跑确认**过（合法脚本会得到 `ok … passes`；违规脚本则逐条报错）。它查的那些「规则」（meta 须为首条纯字面量语句、禁用非确定性调用、宿主 API 警告、`parallel` 须传 thunk），都以官方工具定义 + 本书实测为准；校验器无非是把这些规则做成了一个能跑的 lint 而已。详见 [附录 B](#/zh/app-b)。

</div>

---

## A.10 续传 resume【官方】【实测】

**机制**【官方】：同脚本 + 同 args 重跑时，**最长未改动的 `agent()` 前缀**会秒级把缓存结果还给你；而**第一个被编辑/新增的调用及其之后**则全部 live 重跑。journal 把每次 `agent()` 都记下来（落为 `agent-<id>.jsonl`）。这只在**仅同会话**有效；续传之前先用 TaskStop 把上一次运行停掉。

**实测**（`wf_9c94951d-58c`）：头一次跑 5 个 agent = **133,691 token / 32,959ms**；带着 `{ scriptPath, resumeFromRunId }` **原样重跑一遍** → 同一个 Run ID、5 个结果一模一样、**0 新 token / 3ms**。也就是说，没改动的续传就是「100% 缓存命中」，几乎不花钱。

**缓存键到底由什么组成**：打底的是「同脚本 + 同 args 重跑 = 100% 缓存命中 / 0 新 token」（`wf_9c94951d-58c`，见上）。在这之上，**R8 受控实测**（基线 `wf_4ffde230-535`，3 个 agent / 91,044 token）单独把两个字段拎出来隔离了一下：

- **`label` 不入键【实测】**：只改某个 agent 的 `label`、别的都不动 → 续传 **0 token 全命中**。
- **`prompt` 入键【实测】**：只改它的 `prompt`（label 还原回去）→ 91,044 重跑成 **60,702 token**（≈基线的 2/3），改动点之前的 agent 还是命中、该 agent 及其下游才重跑。这就是 `label` 那次的正向对照，证明 resume 是**对内容敏感**的、并不是随便你改什么它都返回 0。

至于**剩下那些字段进不进键**——「`schema` / `model` / `isolation` / `agentType` 入键、`phase` 不入键」——**（社区第三方资料声称，本书未独立核实）**：这几个字段本书还没一个个隔离测过。详见 [A.14](#a14-第三方未核实清单谨慎)。

---

## A.11 `args` 原样透传与归一化【实测】

【实测，`wf_59bf3654-183`】传入 `args = { hello: 'world', n: 5, nested: { deep: true } }`，到脚本里：`typeof args === 'object'`、原样能看到（`nested.deep` 还是 `true`）、`Array.isArray(args) === false`。**对象还是对象，不会被字符串化。**

正因为这样，你读 `args` 字段之前得先**归一化**——千万**别上来就无条件** `JSON.parse(args)`（传进来是对象的话会直接抛错）。稳妥的 idiom：

```javascript
// 仅当 args 是字符串时才尝试解析；对象/缺省都原样处理
const input = (typeof args === 'string')
  ? (() => { try { return JSON.parse(args) } catch { return {} } })()
  : (args ?? {})

const n = input.n ?? 1   // 现在可安全读字段
```

---

## A.12 触发与门控【官方】

分两层（**能用** vs **会用**），别混（详见 [第 01 章 §1.5–1.6](#/zh/p1-01)）：

**第一层 · 能用（Workflow 工具在不在工具箱里）**。这一层本身又有「台面」和「底层」两副面孔，**官方台面优先**：

*官方台面入口（你该怎么做，信源=官方文档）*：
- ① 确认版本：`claude --version` ≥ **v2.1.154**（官方最低要求）；
- ② 确认账户：**所有付费档都可用**，Anthropic API、以及 Amazon Bedrock / Google Cloud Vertex AI / Microsoft Foundry 上也都可用；**Pro 用户需在 `/config` 里找到 "Dynamic workflows" 这一行手动打开**。【官方】

*底层 flag（原理层 / power-user，信源=客户端二进制 + 本机 `printenv`）*：可用性在客户端逻辑函数 **`FX5`** 里由 `CLAUDE_CODE_WORKFLOWS` + 服务端 flag `tengu_workflows_enabled` + 账户类型共同决定。
- `CLAUDE_CODE_WORKFLOWS=1` → power-user 的显式开关（本书会话 `printenv` 实测 `=1` 且工具可用）；`=0` → 强制关；不设 → 看服务端 flag。
- **务必看清分层**：这是从客户端二进制读出来的**底层机制**，**官方面向用户的入口是 `/config`**——不是「设了 `=1` 才算开」。两者并存、官方台面优先；`=1` 只是底层那一把更直接的开关，方便 CI / power-user 显式锁定。

**第二层 · 会用（让 Claude 这次／本会话去编排）**——官方 opt-in 清单（客户端注入给模型，逐条实测自二进制）：
- ① 消息含 `workflow` / `workflows` 关键词（**单次**）；
- ② `/effort ultracode`（**本会话常驻** + 推理提到 xhigh；详见 [第 01 章 §1.6](#/zh/p1-01)）；
- ③ 用户用自己的话直接要求（"run a workflow" / "fan out agents" / "orchestrate this with subagents"）；
- ④ 技能 / 斜杠命令（其指令要求用 Workflow）。（注：**直接调 Workflow 工具** `Workflow({ scriptPath })` 与**具名工作流** `{ name }` 属程序化发起，不在这份「让模型 opt-in」注入清单内。）

**实时进度**：斜杠命令 `/workflows`。

<div class="callout warn">

**`ultrawork` 已不是触发词。** 2.1.154 官方二进制里 `ultrawork` 仅作内部事件名 `ultrawork_request` 存在（`normalizeAttachmentForAPI` 类型白名单），用户输入它**不触发任何东西**；现官方触发关键词为 `workflow` / `workflows`。证据见 [`assets/transcripts/effort-ultracode-r10.md`](https://github.com/AGI-is-going-to-arrive/workflow-cookbook/blob/main/assets/transcripts/effort-ultracode-r10.md)。（第三方 oh-my-openagent 用 `ultrawork`/`ulw` 是其自有实现，与官方无关。）

</div>

---

## A.13 运行时与限制（并发 / 规模 / 行为约束）【官方】

下表对齐官方文档的 **"Behavior and limits"** 表（信源 `code.claude.com/docs/en/workflows`），并补上本书从 input-schema / 实测拿到的两条（脚本体积、嵌套层数）：

| 限制 | 值 | 口径 |
|---|---|---|
| 运行中插入用户输入 | **不行**——一个 run 跑起来后中途**不能**塞用户输入；**只有 agent 的权限提示能暂停它**。需要阶段间签收，就把每个阶段拆成**独立 workflow** | 【官方】 |
| 脚本对文件系统 / shell 的访问 | **脚本本身没有**——读写文件、跑命令全由 **agent** 干，脚本只负责编排（这也解释了 A.3「脚本体里 `require`/`process`/`fetch` 全 `undefined`」那条实测） | 【官方】（+ [A.3](#a3-脚本结构与执行环境) 实测佐证） |
| 单工作流同时运行 agent | **最多 16 个并发**（CPU 核心少的机器更少；合上二进制下限即 `min(16, max(2, 核心 − 2))`），超出**排队**（非报错） | 【官方】（下限 `max(2,…)` 见 [A.14](#a14-第三方未核实清单谨慎) 二进制确认） |
| 单 run `agent()` 总数上限 | **1000**（失控循环兜底 "runaway-loop backstop"） | 【官方】 |
| 脚本体积上限 | **524288 字节（512KB）**（input-schema 的 `script.maxLength`） | 【官方】 |
| `workflow()` 嵌套层数 | **1 层**（子工作流内再调 `workflow()` 抛错） | 【官方】【实测】 |

> 前两行（运行中不能插入输入、脚本无直接 fs/shell 访问）是官方 behavior & limits 表的原话，本书在此显式引用、不做改写。第三、四行的并发上限 16 与单 run 1000 agent 同样是官方表里的数；本书另在 [A.14 顶部实测升级表](#a14-第三方未核实清单谨慎)里给出并发**下限** `max(2, 核心−2)` 的二进制确认（强于第三方声称、非 runtime 触发）。

---

## A.13.1 内置具名工作流注册表的版本漂移【实测】

`workflow({ name })`（以及 `Workflow({ name })`）能调的「具名工作流」分两块：你自己放在 `.claude/workflows/` 里的，和 Claude Code **自带**的。自带这部分**在不同版本里变过**，这是本书实测出来的一处关键漂移，值得单独记一笔：

| 版本 | 内置具名工作流注册表（实测） | 证据 |
|---|---|---|
| **v2.1.156（当前）** | **仅 `deep-research`** | `wf_03e38250-1bb`：调一个不存在的名字，报错原文 `Available: deep-research` |
| v2.1.150（早期） | `bughunt`, `bughunt-lite`, `deep-research`, `plan-hunter`, `review-branch`（五件套） | `wf_2b04881f-6a9` |

- **以 v2.1.156 为准**：内置注册表**只剩 `deep-research`**，与官方文档一致——官方只把 `/deep-research` 列为 bundled workflow（多角度 fan-out 检索 → 抓取并交叉核对 → 对每条论断投票 → 输出带引用、已过滤的报告；**需 WebSearch 工具可用**）。【官方】
- 早期 v2.1.150 那四个（`bughunt` / `bughunt-lite` / `plan-hunter` / `review-branch`）**现已不在注册表**——更像早期的实验性内置，**不要再依赖它们**。书里凡以「调内置 `bughunt`」为前提的写法都已重定位为「自建工作流」（见 [第 15 章 · Bug 猎手](#/zh/p3-15)）。
- 你**自己**保存的工作流也会变成 `/` 命令、和 bundled 的一起出现在自动补全里——这条是稳的，不受上面漂移影响。【官方】

> 一句话：**别把「自带具名工作流」当成稳定 API 面**。v2.1.156 能稳稳依赖的内置只有 `deep-research`；其它要么自己写、要么放进 `.claude/workflows/` 自己管。

---

## A.14 第三方·未核实清单（谨慎）

下面这些说法，最初都出自第三方仓库 `claude-code-workflow-creator`（某 YouTuber 的视频配套仓库，**非官方**）。本书逐条核查后做了**证据分层**：有几条已在本机**实测复现**（R4，见下表）、有几条用 2.1.154 官方**二进制核查确认**（R10，强于第三方声称、但仍非 runtime 实测），**其余的确实仍无法在本机触发/隔离、未能核实**。**那些仍未核实的，你在别处碰到时心里得有数——别当权威真值。**

> **更新 · R4 实测升级。** 下面这 4 条，以前也躺在「未核实」里头，但本书已经在本机**真实复现**了，现在挪出来了——它们如今是**实测事实**，不再是第三方声称：
>
> | 曾经第三方声称 → 现已实测 | 证据（Run ID / 报错原文） |
> |---|---|
> | VM **30000ms 同步超时** | Run `wf_e3b2b123-5f4`：无 `await` 的长同步循环在 30,222ms 处被终止，报错 `Error: Script execution timed out after 30000ms`。仅约束**同步**执行，非 wall-clock 上限。 |
> | `isolation: 'remote'` 在本 build 禁用 | Run `wf_dace2fc6-966`：抛 `agent({isolation:'remote'}) is not available in this build`。**精化**：运行时只特判 `'worktree'`(执行) 与 `'remote'`(拒绝)，其它未知值**静默忽略**、不报错。 |
> | `meta` 保留键被拒（提交期） | 提交期静态拒绝，以 `constructor` 为例，报错 `reserved key name not allowed in meta: constructor`。（`__proto__` / `prototype` 未逐一测，但拒绝机制已确认。） |
> | `opts.model` **无提交期校验** | Run `wf_dace2fc6-966`：`model: 'totally-not-a-real-model-xyz'` 提交期不报错、agent 照跑。⚠ 本会话 `CLAUDE_CODE_SUBAGENT_MODEL` 覆盖了每调用 model，故「之后在 API 调用处失败」未能观察到。 |

| 第三方声称 | 本书态度 |
|---|---|
| 错误类名 `WorkflowAgentCapError` / `WorkflowBudgetExceededError` | **R10 二进制确认存在**（`this.name="WorkflowAgentCapError"`、`"WorkflowBudgetExceededError"`；证据 `effort-ultracode-r10.md §H`）。属二进制字符串确认、非 runtime 触发。 |
| 并发**下限** `max(2, cores−2)` | **R10 二进制确认**（`Math.max(2,H-2)` + `cpus()`）；配合官方上限 `min(16, 核心−2)`。二进制确认、非 runtime 触发。 |
| `stallMs` 默认 **180000ms**、停滞重试 **≤5 次** | **R10 二进制确认**（`AG3=180000`；紧邻常量 `i7K=5`，使用点未逐行追）。证据 `effort-ultracode-r10.md §H`。二进制确认、非 runtime 触发。 |
| 预算耗尽时在途 agent 完成且结果保留、不再启新 agent | **未核实**。 |
| schema 经 **AJV** 校验；subagent 不调工具时「最多再催两次」 | **AJV：R10 二进制确认**（`ajv`×55 + `StructuredOutput schema mismatch`）。**「最多再催两次」：二进制无 `up to twice` 字符串、存疑**。本书只断言「带 schema 必返回已验证对象、不匹配则重试」，不断言确切次数。 |
| `opts.model` 的 `'inherit'` 字面量的**确切语义** | **未核实精确语义**。注：「`model` 无提交期校验」部分已实测升级（见本节顶部表）；对比 `agentType` 实测确认有校验（A.5）。 |
| resume 缓存键里 `schema` / `model` / `isolation` / `agentType` 是否入键、`phase` 是否不入键 | **未核实**。本书实测确认的是「同脚本 + 同 args = 100% 命中」（`wf_9c94951d-58c`），以及 **R8 单独隔离的 `label`（不入键）/ `prompt`（入键）**（`wf_4ffde230-535`，已移出本清单，见 A.10）；这几个剩余字段尚未逐一隔离。 |

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

> 字段语义要是拿不准，就以你本机 `@anthropic-ai/claude-code/sdk-tools.d.ts` 里的 `WorkflowInput` / `WorkflowOutput` 为最终依据；行为细节，则以你本机真实跑出来的为准。
