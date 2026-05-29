# 第 04 章 · 第一个 Workflow

> 理论讲完了，动手。这一章我们从「确认环境」到「跑通并读懂第一个 Workflow」，把启动、异步、进度、迭代这套循环从头走一遍。每一步都拿**真实运行**的输出来对。

---

## 4.1 前置：先确认「能用」

第 01 章 §1.5 把这件事拆成了「能用 / 会用」两层。动手前，先确认「能用」这层。

**开启与关闭。** Dynamic workflows 目前是 research preview（研究预览），需要 Claude Code v2.1.154 或更高版本（本书实测用 v2.1.156；先 `claude --version` 看一眼，低了就先升级——本书的运行跨 v2.1.150 → v2.1.156，核心机制在 v2.1.156 复核仍成立）。所有付费计划都能用，也支持 Anthropic API 以及 Amazon Bedrock、Google Cloud Vertex AI、Microsoft Foundry。

- **怎么开**：除 Pro 外的付费计划**默认就开着**，什么都不用做。**Pro 计划**要在 `/config` 里找到「Dynamic workflows」那一行手动打开。
- **怎么关**（下面任选一种，都会一直生效）：在 `/config` 里关掉；或在 `~/.claude/settings.json` 写 `"disableWorkflows": true`；或设环境变量 `CLAUDE_CODE_DISABLE_WORKFLOWS=1`（启动时读取）。
- **整个团队/组织一起关**：在 managed settings 里写 `"disableWorkflows": true`，或用 Claude Code 管理后台的开关。
- 关掉之后：bundled 命令（如 `/deep-research`）用不了，prompt 里的 `workflow` 关键词不再触发，`ultracode` 也会从 `/effort` 菜单里消失。

<div class="callout info">

**关于 `CLAUDE_CODE_WORKFLOWS=1`。** 这是个真实存在的环境变量（本书的测试环境里就设着它），但它**不是官方文档给的开启方式**。官方只把 `/config`／默认开当作开启路径，而且官方记录的环境变量只有**关闭**用的那一个。所以别把 `CLAUDE_CODE_WORKFLOWS=1` 当成「必须设了才能用」——把它当个底层观测开关看就行。本书 R11 复核会话里 `printenv` 实测它确实在、就是 `1`，且 Workflow 工具可用：

```text
CLAUDE_CODE_WORKFLOWS = 1
```

</div>

<div class="callout tip">

**两个 0 成本的确认法**：① 直接在对话里说一句「跑个最小 workflow 确认运行时」——句子里带了 `workflow` 这个词，Claude 就会去调 Workflow 工具：开着就能跑，没开它会告诉你用不了。② 敲 `/effort`，看滑块里有没有 `ultracode` 这一格——有，就说明 workflow 已经「能用」了（道理见 §1.6）。

</div>

至于「会用」——想让 Claude **默认就主动**编排，可以 `/effort ultracode` 一次设定、整场常驻（细节见第 01 章 §1.6）。本章的脚本都直接调 Workflow 工具来跑，不依赖这个常驻设定。

<div class="callout tip">

**新手别被「写脚本」三个字劝退——这段脚本不用你手写，是 Claude 替你写的。** 官方给普通用户设计的入口是一条很顺的闭环。你**用大白话**说一句带 `workflow` 的需求，比如「跑个 workflow 把这仓库的 TODO 扫一遍归类」。Claude 就替你把这段编排脚本写出来。开跑前弹一次审批，你过一眼就行；拿不准就点 `View raw script` 看原文。跑完满意的话，按一个键把它**存成一条 `/` 命令**，下次直接复用。所以本章下面那些脚本，你**读懂**就够了——真正动手时，是 Claude 写、你审、你存。这条闭环的台面操作（每个键怎么按、审批 4 个选项是什么、按 `s` 存命令）在[《官方操作面板》](#/zh/p2-ops)有照着就能上手的完整演示；本章专注「脚本本身长什么样、怎么读懂它、怎么迭代它」。

</div>

---

## 4.2 Hello, Workflow

下面是本书第一个真跑过的脚本。它只干一件事：派一个 subagent 出去，让它返回一份结构化的「运行确认」。

```javascript
export const meta = {
  name: 'hello-workflow',
  description: 'Smoke test: one subagent returns schema-constrained structured output',
  phases: [{ title: 'Greet', detail: 'One subagent confirms the runtime' }],
}

phase('Greet')
const r = await agent(
  'You are a smoke test for the Claude Code Workflow runtime. Return a one-sentence ' +
  'confirmation message, the integer value of 2+2, and a boolean confirming you ran ' +
  'as a workflow subagent.',
  {
    label: 'smoke',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        sum: { type: 'number' },
        runtimeConfirmed: { type: 'boolean' },
      },
      required: ['message', 'sum', 'runtimeConfirmed'],
    },
  }
)
log(`smoke result: ${JSON.stringify(r)}`)
return r
```

一行行拆开看（呼应第 01 章的「经纬」）：

| 行 | 作用 |
|---|---|
| `export const meta = {…}` | **经线**：纯字面量，写明名称、描述、阶段。运行时开跑前先静态读它一遍。 |
| `phase('Greet')` | 切到「Greet」阶段，后面派的 agent 在进度树里都归到这一组。 |
| `agent(prompt, { schema })` | **纬线**：派一个 subagent 出去，`schema` 强制它返回一个已验证的结构化对象。 |
| `log(...)` | 给你打一行进度。 |
| `return r` | 工作流最后的返回值，会出现在完成通知里。 |

<div class="callout warn">

**这是 Workflow 脚本，不是 Node 脚本——新手第一坑。** `meta`/`phase`/`agent`/`log`/`budget`/`args` 都是 Workflow **运行时注入的全局符号**（`_grounding.md` B 节：「运行时注入，无需 import」）。你把这段存成 `hello.js`、用 `node hello.js` 单跑，Node 压根没有这些全局，立马就给你抛 `ReferenceError: phase is not defined`——**Windows、macOS、Linux 三平台一模一样**（这跟操作系统没关系，纯粹是因为 Node 根本没有 Workflow 运行时这一层）。它只能在**工作流可用的 Claude Code 会话里**跑，由 Claude 调用内置 Workflow 工具。怎么确认「可用」、官方怎么开，见 §4.1 和 [第 01 章 §1.5](#/zh/p1-01)。触发也简单：消息里带上 `workflow` 这个词就行（见 §4.1）。本书实测就是这么把它跑通的：runtime 确认、schema 强制 `sum=4` 为**数字**、约 2.6 万 token / 约 5.5 秒（真实回执和用量见 4.3、4.4）。

</div>

---

## 4.3 启动：你会立刻拿到一个回执

脚本一交给 Workflow 工具，它**不会等跑完**，当场就甩回来一个回执。这是真实输出：

```text
Workflow launched in background. Task ID: wi7ye81mb
Summary: Smoke test: one subagent returns schema-constrained structured output
Transcript dir: ...\subagents\workflows\wf_dacbd480-d5d
Script file: ...\workflows\scripts\hello-workflow-wf_dacbd480-d5d.js
Run ID: wf_dacbd480-d5d
You will be notified when it completes. Use /workflows to watch live progress.
```

这段回执，对应的就是 `_grounding.md` B 节里 `WorkflowOutput` 的那几个真实字段。一一对上，列成一张表：

| 回执里看到的 | `WorkflowOutput` 字段 | 含义 / 用途 |
|---|---|---|
| `Task ID: wi7ye81mb` | `taskId: string` | 后台任务的句柄（可以配合 TaskStop 把它停掉）。 |
| `Run ID: wf_dacbd480-d5d` | `runId?: string` | 这次运行的标识，**断点续传得靠它**（仅限同一 session，退出即从头跑；第 22 章）；`remote_launched` 时没这一项。 |
| `Script file: ...js` | `scriptPath?` | 你的脚本被**写到了磁盘上**——这是迭代的关键（见 4.5）。 |
| `Transcript dir: ...` | `transcriptDir?` | subagent 完整执行记录所在的目录。 |
| `Summary: Smoke test...` | `summary?` | 回显的那行摘要（也就是 `meta.description`）。 |

<div class="callout info">

**回执的 `status` 只有两种取值。** 按 `_grounding.md` B 节，`WorkflowOutput.status` 就是 `"async_launched" | "remote_launched"`——**没有第三种**，尤其**没有**那种表示「已完成」的同步状态。本地跑就是 `async_launched`（你这次就是），跑在 CCR 远端就是 `remote_launched`（这时没有 `runId`，续传句柄改用返回的 session URL）。语法检查没过的话，返回会多带一个 `error` 字段（见 4.7）。**把这条记牢，你就不会再指望「调一下 Workflow 就能直接拿到结果」了。**

</div>

<div class="callout info">

**为什么要做成异步的？** 因为一个工作流可能扇出几十个 subagent，跑上几分钟、甚至更久。做成异步，你启动完就能接着干别的，跑完了再收到通知。所以——**Workflow 工具返回的不是结果，而是一张「已启动」的回执**。真正的结果在完成通知里。

</div>

---

## 4.4 进度与完成

启动以后，用斜杠命令 **`/workflows`** 就能看到一棵**实时进度树**：眼下在哪个 phase（来自 `meta.phases` 和 `phase()`）、哪些 agent 在跑、哪些跑完了（叶子节点的名字来自每个 `agent()` 的 `label`）。它就是「启动之后、通知之前」这段时间里你的观察窗口——一块一直在刷新的进度面板。`phase`/`log`/`/workflows` 这三者怎么配合，是第 09 章的专题。

等工作流真正跑完，你会收到一条**完成通知**。`hello-workflow` 的真实完成通知，核心就是这段返回值：

```json
{
  "message": "The Claude Code Workflow runtime smoke test executed successfully as a workflow subagent.",
  "sum": 4,
  "runtimeConfirmed": true
}
```

再附上一份真实用量：

```text
agent_count = 1   tool_uses = 1   total_tokens = 26338   duration_ms = 5506
```

怎么读：

- `sum` 是数字 `4`，**不是**字符串 `"4"`——因为 schema 里写了 `type: 'number'`，校验层把类型给兜住了（这就是结构化输出的威力，详见第 07 章）。
- 最简单的一次 agent 往返 ≈ **5.5 秒 / 2.6 万 token**。拿它当基线单位，你就能估更大工作流要花多少。

```mermaid
sequenceDiagram
    participant You as 你
    participant WF as Workflow 运行时
    participant A as subagent "smoke"
    You->>WF: Workflow({ script })
    WF-->>You: taskId wi7ye81mb · runId wf_…（立即）
    Note over You: 用 /workflows 看进度
    WF->>A: agent(prompt, { schema })
    A->>A: 调 StructuredOutput，校验通过
    A-->>WF: {message, sum:4, runtimeConfirmed:true}
    WF-->>You: 完成通知：返回值 + 用量
```

---

## 4.5 迭代循环：脚本即文件

因为脚本已经落了盘（就是回执里的 `Script file` / `WorkflowOutput.scriptPath`），迭代一个工作流就不用每次都把整段代码重发一遍。这样一来就有了一个**「改盘上文件 → `scriptPath` 重跑」的迭代闭环**：

```mermaid
flowchart LR
    A["首次启动<br/>Workflow({ script })"] --> B["回执给出<br/>scriptPath + runId"]
    B --> C["Write/Edit<br/>直接改那个 .js"]
    C --> D["Workflow({ scriptPath })<br/>重跑（可加 resumeFromRunId）"]
    D --> C
    style A fill:#69d
    style D fill:#2d6
```

拿到回执里的 `Script file` 路径之后，每一轮迭代就是这两步：

1. 用 `Write`/`Edit` 直接改那个 `.js` 文件；
2. 用 `{ scriptPath: "<那个路径>" }` 重新调一次 Workflow（`scriptPath` 优先级高于 `script`/`name`）。

要是还想把上次那些**烧钱的中间结果**接着用，就加上 `resumeFromRunId`：

```javascript
// 改完脚本后，断点续传重跑：未改动的 agent() 调用秒级返回缓存结果
Workflow({ scriptPath: ".../hello-workflow-wf_dacbd480-d5d.js", resumeFromRunId: "wf_dacbd480-d5d" })
```

「同样的脚本 + 同样的 args → 100% 缓存命中」。这也正是脚本里禁用 `Date.now()` / `Math.random()` 的原因（它们会破坏可重放性）。

要提醒一句：`resumeFromRunId` **只在同一个 session 里有效**。你要是退出了 Claude Code，那份缓存就跟着 session 走了；下次再进来，这个工作流是**从头跑**，不会接上之前的进度。所以续传是「同会话内」的能力，别指望它跨重启。续传的细节见第 22 章。

---

## 4.6 让它稍微大一点：两个 agent

把 hello 扩成「两个并发 agent + 一句汇总」，顺手体会一下 `parallel()`：

```javascript
export const meta = {
  name: 'hello-parallel',
  description: 'Two concurrent agents, then a one-line summary',
  phases: [{ title: 'Ask', detail: 'Two agents in parallel' }],
}

phase('Ask')
const [a, b] = await parallel([
  () => agent('In one sentence: what is a barrier in concurrency?', {
    label: 'q-barrier',
    schema: { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'] },
  }),
  () => agent('In one sentence: what is a pipeline in concurrency?', {
    label: 'q-pipeline',
    schema: { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'] },
  }),
])
log('both answers in')
return { barrier: a?.answer, pipeline: b?.answer }
```

注意 `parallel()` 收的是一个 **thunk 数组**（`() => …`），不是 Promise 数组——这是新手栽的第一个跟头，第 08 章会细讲。

> 上面这段 `hello-parallel` 只是**示意**（未单独实跑）；它依赖的 `parallel()` 到底怎么跑，已经由第 08 章的 `parallel-demo`（Run `wf_52957913-6d2`）验证过了。

---

## 4.7 新手最常见的四个错

第一次写 Workflow，下面这几个坑几乎人人都要撞一遍。一个个拆开，「错」长什么样、「对」该怎么写：

**① `meta` 不是纯字面量（包括「在 `meta` 里算值」）。** `meta` 必须是「死」字面量，运行时在**静态解析阶段**就把它读了——任何变量引用、函数调用、展开、模板插值，都会让它拒绝启动。新手尤其爱在 `meta` 里「顺手算一下」（拼个名字、按日期生成描述），这恰恰是被坑的重灾区：

```javascript
// ✗ 错：变量引用 + 模板插值 + 函数调用，全是「计算」
const NAME = 'x'
export const meta = { name: NAME, description: `run ${NAME} at ${Date.now()}` }
// ✓ 对：纯字面量，一个字一个字写死
export const meta = { name: 'x', description: 'run x' }
```

**② schema 漏了 `required` 字段。** 传 `schema` 的时候，别写完 `properties` 就收手——还得在 `required` 里把**必须出现**的字段列上，不然模型可能就合法地把它漏掉，你下游 `r.sum + 1` 就会拿到 `undefined`：

```javascript
// ✗ 错：声明了 sum，却没把它列进 required —— 模型可以不返回它
schema: { type: 'object', properties: { sum: { type: 'number' } } }
// ✓ 对：required 钉死「这个字段一定要有」
schema: { type: 'object', properties: { sum: { type: 'number' } }, required: ['sum'] }
```

**③ 把它当同步调用，以为「调完就能拿到结果」。** 这是最伤人的一个认知错。Workflow **始终异步**：调用立即甩回一张回执（`status` 只会是 `async_launched`/`remote_launched`，见 4.3），结果在**完成通知**里。任何「`const result = Workflow(...)` 然后立刻用 `result.sum`」的写法都是错的——那一刻 `result` 只是回执，不是产物。

**④ 语法错误。** 脚本语法检查没过，`WorkflowOutput` 会带一个 `error` 字段告诉你错在哪，工作流**不会启动**。先在本地把脚本写对，再交上去。

<div class="callout warn">

**别在脚本里用 `Date.now()` / `Math.random()` / 无参 `new Date()`**——它们会破坏可重放性，让续传缓存失效（见 4.5）。这道禁令是**两层**拦你的，别想绕：

- **第一层 · 提交期源码扫描**：脚本源码里**只要出现**这几个字面量——哪怕写在注释里、写在永远不会执行的分支里、甚至只是个字符串——整段脚本在**开跑之前**就被拒了，根本不进运行时，你也**没法 try/catch**。
- **第二层 · 运行时陷阱**：就算你用动态花招骗过第一层（让源码里看不到这些字面 token），运行时这些全局也早被改造过，一调用照样抛错。这层理论上接得住，但别去赌。

要时间戳，就用 `args` 传进来；要随机性，就拿 agent 的下标 `index` 去改提示词。

</div>

---

## 4.8 本章小结

- 先确认工作流在你会话里可用：付费计划默认开着，Pro 要在 `/config` 的 "Dynamic workflows" 行手动打开（关闭三法见 §4.1）；`CLAUDE_CODE_WORKFLOWS=1` 只是个底层观测开关，不是官方开启路径（两层见 [§1.5](#/zh/p1-01)）；拿不准就让 Claude 跑个最小工作流确认一下。
- 它是 **Workflow 脚本，不是 Node 脚本**：`meta`/`phase`/`agent`/`log` 都是运行时注入的全局，`node hello.js` 会在三平台一致地报 `phase is not defined`，只能由 Claude 在工作流可用的会话里跑。
- 启动 Workflow **当场返回回执**（`WorkflowOutput`：`taskId`/`runId`/`scriptPath`/`transcriptDir`；`status` 只有 `async_launched`/`remote_launched`），结果在**完成通知**里；用 `/workflows` 看实时进度。
- 真实基线：单 agent ≈ 5.5s / 2.6 万 token；`schema` 保证返回类型（`sum` 是数字 4，不是字符串）。
- 迭代靠「脚本即文件」这个闭环：改盘上的 `.js` + `scriptPath` 重跑；加 `resumeFromRunId` 复用缓存。
- 官方闭环的**收尾**：跑通一个满意的 run，在 `/workflows` 视图里按 `s` 就能把它**存成一条 `/` 命令**，下次直接复用——「构建你自己的 workflow」对新手最自然的入口就是这条（怎么积累成一个库见 [第 25 章](#/zh/p5-25)）。
- 新手四坑：① 在 `meta` 里算值（必须纯字面量）；② schema 漏了 `required`；③ 把它当同步调用、以为立刻就能拿到结果；④ 语法错误，进 `error` 字段、不启动。

基础篇走到这儿，你已经能跑通、读懂、迭代一个 Workflow 了。接下来三章（05/06/07）把经线（`meta`/`phase`）、纬线核心（`agent()`）和结构化输出（`schema`）一个个讲透，第 08 章再把并发模型钉死。

> 跑起来之后，怎么看进度、怎么停、怎么把满意的 run 按 `s` 存成 `/` 命令？终端里这一整套操作面见[《官方操作面板》](#/zh/p2-ops)。

> 继续阅读：[第 05 章 · meta 与 phase：经线](#/zh/p2-05)
