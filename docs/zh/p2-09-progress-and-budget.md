# 第 09 章 · 进度·日志·续传·预算

> 基础篇的最后一块拼图：怎样让一个长流水线**看得见**（进度与日志）、**停得下/接得上**（断点续传）、**省着跑**（预算）。把一个工作流从「能跑」升级成「能放心交付」，靠的就是这三件事。

---

## 9.1 一图看懂：异步生命周期

把前八章的「启动 → 异步回执 → 看进度 → 完成通知」串成一条时间线。这一章讲的四件事，刚好挂在这条线的不同位置上：`phase()`/`log()` 给**运行中**那段加上可观测性，`/workflows` 是你**观察**的窗口，`budget` 在运行中**管着花钱**，`resumeFromRunId` 则让你在这条线**跑完后再接一段**。

```mermaid
sequenceDiagram
    participant You as 你
    participant WF as Workflow 运行时
    participant A as subagent 群
    You->>WF: Workflow({ script })
    WF-->>You: taskId / runId（立即返回，不等跑完）
    Note over You,WF: /workflows 实时进度树<br/>phase() 分组 · log() 叙述行
    WF->>A: agent() 扇出（budget.spent() 随之上升）
    A-->>WF: 返回值（文本 / 已验证对象 / null）
    WF-->>You: <task-notification> 完成通知：返回值 + 用量
    Note over You,WF: 改脚本 → resumeFromRunId 续传<br/>未改动调用秒级命中缓存
```

记住这条线长什么样：**Workflow 工具的返回值永远是「已启动」回执，不是结果**（第 04 章）。结果在 `<task-notification>` 里。本章这四个原语，就是把这条「看不见的」后台时间线变得**看得见、停得下、省着跑、接得上**。

---

## 9.2 进度：`phase()` + `log()` + `/workflows`

工作流跑起来之后，你得知道「它现在在干嘛」。这事靠三件工具一起搭出可观测性：

### `phase(title)` —— 把进度分组

`phase('Review')` 把当前阶段切过去，之后所有 `agent()` 调用都在进度树里归到「Review」这一组。再配上 `meta.phases` 声明，你就有了一棵结构化的进度树。下面是一个**完整可跑**的两阶段脚本（注意 `meta.phases` 里的 `title` 是怎么跟 `phase()` 的实参一一对上的）：

```javascript
export const meta = {
  name: 'two-phase',
  description: 'phase() groups agents in the live progress tree',
  phases: [
    { title: 'Scan', detail: 'find candidates' },
    { title: 'Verify', detail: 'check each one' },
  ],
}

const FOUND = {
  type: 'object',
  properties: { candidates: { type: 'array', items: { type: 'string' } } },
  required: ['candidates'],
}
const OK = {
  type: 'object',
  properties: { verified: { type: 'array', items: { type: 'string' } } },
  required: ['verified'],
}

phase('Scan')                                  // ← 切到 Scan 阶段
const found = await agent(
  'List three plausible naming smells one might find in a JS module.',
  { label: 'scan', phase: 'Scan', schema: FOUND }
)
log(`扫描到 ${found.candidates.length} 个候选`)  // ← 叙述行

phase('Verify')                                // ← 切到 Verify 阶段
const ok = await agent(
  `Of these candidates, which are genuinely smells? ${JSON.stringify(found.candidates)}`,
  { label: 'verify', phase: 'Verify', schema: OK }
)
log(`确认 ${ok.verified.length} 个`)
return ok
```

> 本段为**示意（未实跑）**；不过它依赖的 `phase()`/`schema`/`agent()`，真实行为都已经被第 04/06/08 章的真实运行（`hello` Run `wf_dacbd480-d5d`、`pipeline-demo` Run `wf_bf086b98-6ec`）验证过了。

<div class="callout warn">

**在 `parallel()` / `pipeline()` 内部，别依赖全局 `phase()`。** 多个分支同时往前跑，全局这个「当前阶段」就会被抢来抢去。正确的做法是给每个 `agent()` 显式传 `phase`：

```javascript
await pipeline(items,
  d => agent(d.prompt, { phase: 'Review', schema: R }),   // 显式归组
  r => agent(verify(r), { phase: 'Verify', schema: V }),
)
```

`opts.phase` 跟 `meta.phases` 的 `title` 按字符串精确匹配——名字一样就是同一组。

</div>

### `log(message)` —— 给用户一行叙述

`log()` 在进度树上方打一行叙述文字。它是**单参数、无返回值**的：`log(message: string): void`（见 `_grounding.md` B 节）。用它来报里程碑、报计数、报决策——一个旁观者哪怕不看代码、只盯着 `log()` 行，也能跟上工作流跑到哪了：

```javascript
log(`扫描到 ${shards.length} 个分片，开始并发审查`)
// ... 一轮工作之后 ...
log(`${bugs.length}/10 已发现，剩余预算 ${Math.round(budget.remaining() / 1000)}k`)
```

把 `log()` 当成「工作流的旁白」。一条好旁白会回答三个问题：**扇出了多少**（`扫描到 N 个分片`）、**收敛到几个**（`确认 M 个`）、**还剩多少预算**（`剩余 Xk`）。下一节的预算循环里，每一轮都 `log()` 一行进度，就是这个用法的范本。

<div class="callout info">

**`console.log` 也能用，但管的事不一样。** 本书沙箱自省运行（Run `wf_59bf3654-183`）实测确认：脚本里 `console` 是注入进来的对象、`console.log` 能调，它的输出会进**工作流日志**。区别在于：`log()` 是给用户看的进度旁白（显示在进度树上方），`console.log` 更像你开发时随手记的诊断输出（落进日志）。想让旁观者跟上进展，用 `log()`；想留下排查痕迹，用 `console.log`。

</div>

### `/workflows` —— 实时进度树

斜杠命令 `/workflows` 会打开一棵实时树：每个 phase 一个分组框，框里是各 agent 的标签（来自 `label`）和状态。`meta.phases` 里写的 `title` 决定分组框，`agent()` 的 `label` 决定叶子节点叫什么名字——所以**描述性的 label 既利于搜索，也利于观察**。这里写的是脚本侧「怎么把进度做出来」；至于在 `/workflows` 视图里**怎么操作**这棵树（方向键钻取、`p`/`x`/`r` 暂停停止重启、`s` 存成命令），见[《官方操作面板》](#/zh/p2-ops)。

---

## 9.3 完成通知里的真实用量

每个工作流跑完，完成通知都会带一份用量统计。这就是你估成本的依据。把本书基础篇的三次真实运行汇总一下：

| Workflow | agent_count | tool_uses | total_tokens | duration_ms |
|---|---|---|---|---|
| hello（单 agent + schema） | 1 | 1 | 26,338 | 5,506 |
| parallel（3 并发） | 3 | 3 | 78,844 | 8,395 |
| pipeline（3 项 × 2 阶段） | 6 | 8 | 158,982 | 26,743 |

两条经验法则：

- **token ≈ agent 数 × 每 agent 上下文**（约 2.5–3 万 / agent，会随提示和产物上下浮动）。
- **墙钟看的是关键路径**，不是 agent 总数——并发会把 N 个 agent 的时间压到差不多「最慢的那一个」。

<div class="callout info">

**编排本身不花模型钱。** 上面那条「token ≈ agent 数 ×…」还有个干净的边界：**一个不调任何 `agent()` 的纯编排工作流，花 0 token。** 本书实测的两个例子都印证了这点——沙箱自省运行（`wf_59bf3654-183`）和嵌套工作流运行（`wf_2b04881f-6a9`）都是 **0 agent / 0 token**（分别 4ms、29ms 跑完）。换句话说，`phase()`/`log()`/`pipeline()`/`parallel()` 这套编排骨架自己不烧 token，**token 只在 `agent()` 真正派出 subagent 时才产生**。这也就解释了为什么省钱的根本姿势是：把控制逻辑尽量留在脚本（编排层）里，只把「要动模型的活」丢进 `agent()`。

</div>

---

## 9.4 断点续传：`resumeFromRunId`

长流水线最怕的就是「跑到第 8 步崩了，前 7 步那些昂贵结果全白费」。Workflow 用**断点续传**来解决这个：

```javascript
// 改完脚本后，带上一次的 runId 重跑
Workflow({ scriptPath: ".../my-flow-wf_xxx.js", resumeFromRunId: "wf_xxx" })
```

机制是这样：**最长一段没改过的 `agent()` 前缀**直接吐缓存结果（秒级），只有**第一个被改过/新增的调用、以及它之后**的全部调用，才会重新真跑一遍。「同样的脚本 + 同样的 args → 100% 缓存命中」。

这不是口号——本书实测拿到了**字面证据**。拿第 04 章那次 `hello-workflow`（Run `wf_dacbd480-d5d`）来说，用**未改动的脚本** + `resumeFromRunId` 重跑一遍，两次运行的真实用量是：

| 运行 | agent_count | tool_uses | total_tokens | duration_ms |
|---|---|---|---|---|
| 首次（真实执行） | 1 | 1 | **26,338** | **5,506** |
| 续传（缓存命中） | **0** | **0** | **0** | **8** |

两次的返回值**逐字节相同**（`{"message":"...","sum":4,"runtimeConfirmed":true}`）。续传那次**0 token、0 工具调用、8 毫秒**——它压根**没有重新派发 subagent**，直接拿缓存结果复用了（见 `assets/transcripts/advanced.md`，沿用同一 Run ID `wf_dacbd480-d5d`）。这就是「重跑前 7 步几乎免费」的字面依据：没改过的前缀按缓存返回，你只为真正改动的那一段重新掏钱。

<div class="callout info">

**脚本禁用 `Date.now()` / `Math.random()` / 无参 `new Date()`，根本原因就在这里**：续传靠的是「同样的执行必然跑出同样的结果」这种可重放性。时间和随机这种非确定的东西会把它破坏掉（同一段脚本两次跑出不一样的结果，缓存就没法比对了）。

这条「确定性守卫」实测是**双层**的，别想绕：

- **第一层 · 提交期源码扫描**：只要这三个被禁字面量在脚本**任何位置**出现——哪怕是在注释里、字符串字面量里、或者一段永远不会执行的闭包里——整段脚本会在运行**前**被拒，**根本进不去执行、try/catch 也接不住**。被拒原文：`Workflow scripts must be deterministic: Date.now()/Math.random()/new Date() are unavailable (breaks resume). Stamp results after the workflow returns, or pass timestamps via args.`
- **第二层 · 运行时陷阱**：就算你用动态手段（比如拼字符串去取 `Date`/`Math`）骗过第一层、让脚本被接受，运行时这些全局也已经被改造过，一**调用**就抛错（这层**可以** try/catch，但别依赖它兜底）。

要时间戳？用 `args` 传进来，或者等工作流跑完后在外面盖戳。要随机？用 agent 的下标 `index` 去改提示词。

</div>

续传是**同会话**内才有的能力（缓存就活在本次会话里）；续传之前，应该先用 `TaskStop` 把上一次运行停掉。完整用法、缓存命中的规律、跨会话怎么兜底，见 [第 22 章 · 断点续传与缓存](#/zh/p4-22)。

---

## 9.5 预算：`budget`

当用户用「+500k」这种指令给本回合定下 token 目标，脚本里的全局 `budget` 就让你照着它**动态调节**工作流的规模和深度。它有三个成员（见 `_grounding.md` B 节）：

```javascript
budget.total        // number | null：本回合 token 目标；null = 未设目标
budget.spent()      // number：本回合已花的 output token（主循环 + 所有工作流共享池）
budget.remaining()  // number：max(0, total - spent())；未设目标时为 Infinity
```

按官方工具定义，它是个**硬上限**：`spent()` 一旦摸到 `total`，再调 `agent()` 就会**抛错**。这层「预算耗尽即停」的设计，是为了不让工作流失控地猛烧 token。

<div class="callout info">

**`spent()` 计的是「本回合 output token」，而且是主循环 + 所有工作流的共享池**（官方）。换句话说：你在主对话里花掉的 output，加上同一回合任何工作流里 `agent()` 花掉的，全都算进同一个 `spent()`。所以 `budget` 管的是「这一整个回合」的总开销，不是某个单独的工作流。

</div>

### 9.5.1 实测：未设目标时 `budget.total === null`

想搞懂 `budget`，得先看清最常见的那种情形——「**没设目标**」时它到底是什么值。本书的沙箱自省运行（Run `wf_59bf3654-183`，0 agent / 0 token / 4ms）在脚本里直接把 `budget` 读了出来：返回对象里 `typeof budget === 'object'`，而且 **`budget.total === null`**。

这就把第一条关键事实坐实了：

- **未设目标 → `budget.total === null`**（实测，`wf_59bf3654-183`）——不是 `0`，也不是某个默认数。

另外两条来自官方 API 定义（`_grounding.md` B 节），跟 `total` 的取值正好咬合：

- **`total` 为 null 时，`budget.remaining()` 返回 `Infinity`**（`remaining()` 定义为 `max(0, total - spent())`，total 为 null 时就等于没上限）——这是个会咬人的值，下面 9.5.3 专门讲它。
- **`budget.spent()` 跟 `total` 是不是 null 没关系**：它永远反映本回合真实花掉的 output token。按本书基线，1 个 agent 跑一个来回约 2.6 万 token（hello，`wf_dacbd480-d5d`），`spent()` 会随每次 `agent()` 往上累加。

**一条探针把这三件事一次性坐实。** 本书另外跑了一条带 1 个真实 agent 的预算探针（Run `wf_fd09a6ed-38a`，1 agent / 26,211 token / 6,933ms），在未设目标的会话里一次就读全了：`budget.total === null`、agent 跑之前跑之后 `budget.remaining()` **实测都是 `Infinity`**（`remainingBefore` / `remainingAfter` 都是 `"Infinity"`——是真读到的，不是「按定义推断」出来的）、而同一次里 `budget.spent()` 确实**涨了**（`spentIncreased: true`，从近 0 升到那约 2.6 万 token）。这就把上面三条从「各自单独成立」收紧成了「同一次运行里同时成立」，也刚好印证下面这句：开关（`total`）始终 `null`、余额（`remaining()`）始终 `Infinity`，计数器（`spent()`）却照涨不误。

换句话说：`total` 是「用户有没有设目标」的开关（没设就是 `null`），`spent()` 是「实际花了多少」的计数器，这俩各管各的。这个区别是后面所有用法的地基。

### 9.5.2 两种典型用法

**① 动态循环（按预算决定干多久）：**

```javascript
const BUGS = {
  type: 'object',
  properties: { bugs: { type: 'array', items: { type: 'string' } } },
  required: ['bugs'],
}

const bugs = []
while (budget.total && budget.remaining() > 50_000) {   // ← 必须有 budget.total &&
  const r = await agent('Find one more distinct bug in this module.', {
    label: `hunt:${bugs.length}`,
    schema: BUGS,
  })
  bugs.push(...r.bugs)
  log(`${bugs.length} 个，剩余 ${Math.round(budget.remaining() / 1000)}k`)
}
```

**② 静态扩缩（按预算一次性决定扇出多少）：**

```javascript
// 有目标：每 10 万 token 配 1 个 agent；没目标：退回安全默认值 5
const FLEET = budget.total ? Math.floor(budget.total / 100_000) : 5
log(`本次扇出 ${FLEET} 个 agent`)
```

两种模式**都靠 `budget.total` 来判别「有没有目标」**：动态循环把它当 `while` 守卫，静态扩缩把它当三元表达式的条件。这不是凑巧——下一节就讲为什么**必须**这么写。

### 9.5.3 警告：无守卫的 `while` 会跑到天荒地老

反面写法，就是一个故意**只判 `remaining()`、不判 `total`** 的循环——

```javascript
// ✗ 反例：缺少 budget.total 守卫
while (budget.remaining() > 50_000) { /* ... 派 agent ... */ }
```

把 9.5.1 的两条事实接起来，它的下场就推得出来：未设目标时 `budget.total === null`（实测，`wf_59bf3654-183`），而按官方定义此时 `remaining()` 返回 `Infinity`——于是这个反例的判据 `Infinity > 50_000` **永远为真**。这一点还有一条**正向实测**佐证：带守卫的 `while (budget.total && …)` 在未设目标时**实跑 0 轮**——`wf_fd09a6ed-38a` 的 `guardRounds: 0` 就是它，守卫把循环掐死在第 0 轮，根本没机会失控。

<div class="callout warn">

**未设目标时，没守卫的 `while (budget.remaining() > N)` 会变成死循环。** 因为 `remaining()` 返回 `Infinity`、`Infinity > N` 恒真，循环就会一直派 agent，直到撞上**单工作流 1000 个 agent 的全局兜底上限**才停（官方硬约束，`_grounding.md`）。反过来，正确写法 `while (budget.total && budget.remaining() > N)` 在未设目标时，会因为 `budget.total` 是 `null`（假值）而**短路**成假、一轮都不跑——这正是为什么动态循环**必须**带这个守卫。**口诀：动态循环的条件，第一项永远是 `budget.total &&`。**

</div>

<div class="callout info">

**关于「预算耗尽抛什么错」和同步超时**：官方散文文档只描述了**行为**——预算耗尽后再调 `agent()` 会出错、达到 1000 agent 上限会出错——但**没有给出错误类名**。这两类错误的类名分别是 `WorkflowBudgetExceededError` 和 `WorkflowAgentCapError`——这两个**类名本书已经过 R10 二进制核查确认**（不再是「第三方未核实」的声称）。仍未实测的只剩**抛错那一刻在途 agent 的处置语义**（已派出的 agent 是被中止还是放任跑完），所以即便类名可靠，也别把控制流押在 `catch` 某个具名异常上。另外，原本跟类名一起被划进「未核实」的同步超时说法，本书现在也已经**实测确认**了：脚本 VM 的 **30000ms 同步超时**是真的（Run `wf_e3b2b123-5f4`：一个没有 `await` 的长同步循环在 30,222ms 处被掐断，报错原文 `Error: Script execution timed out after 30000ms`）。注意它只管**同步**执行（用来掐死死循环），**不是** wall-clock 上限——带 `await agent()` 的工作流照样能跑上好几分钟。

</div>

预算的完整玩法（连带规模化策略）见 [第 21 章 · 动态预算与规模化](#/zh/p4-21)。

---

## 9.6 把可观测性当成一等公民

社区系统给我们上过一课（见第五部）：**编排不光要会调度，还得「说清楚自己在干嘛」**。一个不报进度的工作流，跑 5 分钟和卡死 5 分钟，从外面看根本没区别。

实践清单：

- 每个 `agent()` 都给个**描述性 `label`**（`review:auth.ts` 比 `agent-7` 强）。
- 每到一个里程碑就 `log()` 一行（扇出多少、收敛到几个、还剩多少预算）。
- 用 `phase()` / `opts.phase` 把进度分组，让 `/workflows` 那棵树看着清爽。
- 工作流要是做了**有损取舍**（只取 top-N、不重试、抽样），**一定 `log()` 出来**——不然静默截断会被人误读成「全覆盖了」。

---

## 9.7 本章小结

- **异步生命周期**：启动立刻返回 `taskId`/`runId` 回执 → `/workflows` 看进度 → `<task-notification>` 带回结果和用量；本章四原语分别挂在这条线的不同位置（9.1）。
- **进度**：`phase()` 分组、`log()` 叙述、`/workflows` 看实时树；并发内部用 `opts.phase`，别用全局 `phase()`。
- **用量**：完成通知带 `agent_count`/`tool_uses`/`total_tokens`/`duration_ms`；token≈agent 数×每 agent 上下文，墙钟看关键路径。
- **续传**：`resumeFromRunId` 让没改过的前缀秒级命中缓存——实测 **0 token / 0 工具调用 / 8 ms**（Run `wf_dacbd480-d5d`）；可重放性的要求决定了 `Date.now`/`Math.random` 被禁用。
- **预算**：`budget.total/spent()/remaining()` 是官方硬上限，`spent()` 是本回合 output token、主循环+所有工作流共享一个池。实测未设目标时 `total === null`（Run `wf_59bf3654-183`）；按官方定义此时 `remaining()` 为 `Infinity`，所以**动态循环务必用 `budget.total &&` 守卫**，否则 `Infinity > N` 恒真，会一路冲到官方 1000 个 agent 兜底上限。
- 把可观测性当一等公民：描述性 label、里程碑 log、显式 phase、有损取舍要说出来。

**基础篇到这里就讲完了**——`meta`/`phase`/`agent`/`schema`/`parallel`/`pipeline`/`log`/`resume`/`budget` 的全部核心，你已经拿下了。从第三部开始，我们把这些拼成真正能用的配方；目标是奔着真实运行去，**已实跑的配方附上 Run ID 和真实用量（见 [`assets/transcripts/`](https://github.com/AGI-is-going-to-arrive/workflow-cookbook/tree/main/assets/transcripts)），没实跑的示意脚本会明确标注**。

> 继续阅读：[第 10 章 · 分片代码审查](#/zh/p3-10)
