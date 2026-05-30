# 第 28 章 · 校验与调试

> 一句话：**Workflow 把「确定性」当铁律，所以它在两个时刻设了关卡。一个是你按下提交那一刻的静态扫描：合不合规，不合规脚本根本不让跑。另一个是运行期的运行时陷阱和上限：跑起来后还会因为别名违规、隔离不可用、同步死循环、未知 agentType 而抛错。这一章把这两道关卡讲透，提交期拒什么、运行期抛什么，每条都配上真实错误原文和 Run ID；再讲三件调试利器（`/workflows` 进度树、`agent-<id>.jsonl` journal、`resumeFromRunId` 增量重跑），让你出错以后能快速定位、改完不用从头烧 token。**
>
> 前面 27 章教你怎么把工作流写对。这一章假设你已经写好了，而且它出错了。出错是常态：`meta` 多塞了一个键、随手写了个 `Date.now()`、`isolation` 拼错、循环忘了守住预算。好消息是，Workflow 的错误信息坦白得出奇，它会**逐字告诉你**哪里错、为什么错、甚至怎么改。这一章就带你读懂这些信号。

---

本章所有论断分三层来源，请你边读边对照：

- **官方工具定义**：Claude Code 内置 Workflow 工具的描述和 input-schema（比如脚本体积上限、并发上限）。
- **本机真实实测**：`assets/transcripts/*-r4.md` 里那些带 Run ID 的运行记录，错误原文逐字摘出来。
- **第三方工具 `validate-workflow.mjs`**：它来自第三方仓库 `claude-code-workflow-creator`（某个 YouTube 创作者的配套仓库，**非 Claude/Anthropic 官方**），但**它的行为我们已经在本机实跑确认过**。所以本章引用它的时候统一标注「**第三方工具、行为已实测**」，既不把它当官方，也如实记下它到底输出了什么。

<div class="callout info">

**两道关卡，一句话先立住**。**提交期**是静态扫描：不跑你的代码，只读源码和 `meta` 字面量，一违规直接拒、连 `taskId` 都不给你。**运行期**是真跑：脚本已经在 VM 里执行了，违规靠抛错（`throw`）暴露出来，这时候你手里已经有 `runId`（`wf_...`）了。「为什么禁掉非确定性调用、为什么要分两层拦」这个底层道理在 [第 01 章 §1.2](#/zh/p1-01) 讲过，本章则把每一道关卡**具体拒/抛什么**、配上错误原文和 Run ID 一条条钉死。下面两节分头拆解。

</div>

```mermaid
flowchart TD
    Start["你提交 script"] --> Static{"提交期静态扫描"}
    Static -->|"meta 非首语句 / 非纯字面量<br/>(含保留键 constructor)"| Reject1["拒绝：返回 error 字段<br/>无 Run ID"]
    Static -->|"字面量 Date.now() / Math.random()<br/>/ 无参 new Date()"| Reject2["拒绝：'must be deterministic'<br/>无 Run ID"]
    Static -->|"通过"| Run["分配 runId (wf_...)<br/>进入 VM 执行"]
    Run --> RT{"运行期陷阱 / 上限"}
    RT -->|"别名 Date.now()"| E1["运行时抛错"]
    RT -->|"isolation:'remote'"| E2["抛 'not available in this build'"]
    RT -->|"未知 agentType"| E3["生成前 0 token 抛错<br/>列出可用 agent"]
    RT -->|"同步死循环 > 30s"| E4["failed: timed out after 30000ms"]
    RT -->|"一切正常"| OK["async_launched ✓"]
```

---

## 28.1 提交前用校验器把关：`validate-workflow.mjs`

在把脚本交给 Workflow 工具之前，你可以先拿一个**静态 lint** 过一遍。这个 lint 就是第三方仓库自带的那个 `validate-workflow.mjs`。

<div class="callout warn">

**先讲清来历**：`validate-workflow.mjs` 来自第三方仓库 `claude-code-workflow-creator`，**不是 Claude/Anthropic 官方工具**。但本书**已经在本机实跑确认了它的真实行为**（Node v22.22.0，2026-05-25），所以下面引用的都是它**实测**输出的原文，不是照抄它的文档。它检查的那些规则本身（`meta` 须首语句、确定性禁用、宿主 API、thunk 形状）都能溯源到**官方工具定义 + 本书实测**，这个 lint 只是把这些规则做成了一个能在本地跑的脚本而已。

</div>

### 为什么要有这一步

提交期的静态拒绝固然能拦下违规脚本，但它有两个不方便的地方。一是**反馈得等一个网络往返**（你得真的去调一次工具）；二是它**一次只报第一类致命错**（提交一被拒就停了，你看不到还有哪些地方也出了问题）。本地 lint 正好补上这个缺口：它**一次把全部问题都列出来**（错误 + 警告），而且**一个 token 都不花、一次调用都不发**。把它接进保存钩子或者 CI，你就能在按下提交之前先自查一遍。

### 它检查什么

按照本机实测（`assets/transcripts/validator-r4.md`）加上官方规则，它覆盖下面这些检查项：

| 检查项 | 由什么触发 | 严重级 |
|---|---|---|
| 脚本体积上限（来源：**官方 input-schema 的 `script.maxLength`**，非 validator 实测） | 源码超过 **524288 字节（512KB）** | ERROR |
| `meta` 必须是**首语句** | `export const meta` 之前有任何代码（如一个 `const`） | ERROR |
| `meta` 必须**纯字面量** | `meta` 里有变量引用 / 函数调用 / 展开运算符 / 模板插值 / 保留键（如 `constructor`）；或缺 `name`/`description` | ERROR |
| 禁用非确定性调用 | 字面量 `Date.now()` / `Math.random()` / 无参 `new Date()` | ERROR |
| 宿主 API 警告 | 编排层里出现 `require` / `import` / `process` | warning |
| `parallel([...])` 裸 promise 警告 | `parallel([agent(...), agent(...)])` 直接传 promise，而非 thunk | warning |

注意把 **ERROR** 和 **warning** 分清楚：**ERROR 会让退出码变成 1**（应当阻断提交）；**只有 warning 的时候退出码还是 0**（脚本能跑，只是有改进空间）。

### 实测示例一：合法脚本 → 通过，退出 0

拿一个真能跑的工作流（前面那个模型解析测试脚本）喂进去：

```bash
  $ node validate-workflow.mjs <…>/model-resolution-test-wf_9c94951d-58c.js
  ok — model-resolution-test-wf_9c94951d-58c.js passes (1853 bytes)
  (exit=0)
```

它打印 `ok … passes`，带上字节数，退出码 0。这就是「干净」长什么样。

### 实测示例二：违规脚本 → 逐条报错，退出 1

我们故意写了个一次踩中好几条规则的脚本：

```javascript
  // A deliberately broken workflow, to capture the validator's real output.
  const setupBeforeMeta = 5 // code before meta → ERROR: meta must be first

  export const meta = {
    name: 'bad-example',
    description: 'demonstrates validator errors',
  }

  const stamp = Date.now() // banned non-deterministic call → ERROR
  const fs = require('node:fs') // host API in orchestrator → warning

  const results = await parallel([agent('do x'), agent('do y')]) // bare promises → warning
  return { stamp, results }
```

校验器的输出（逐字摘自实测）：

```text
  warn  `require()` at line 10 — no Node/host APIs in the orchestrator; do file/shell work inside an agent() instead
  warn  parallel([...]) at line 12 looks like it holds bare agent(...) calls — wrap each as a thunk: () => agent(...)
  ERROR `export const meta` must be the FIRST statement (line 4) — code precedes it
  ERROR banned non-deterministic call `Date.now()` at line 9 — it throws inside a workflow (breaks resume)

  2 error(s) in bad-example.js — fix before running.
  (exit=1)
```

它一次就把 4 个问题全列了出来：2 个 ERROR（`meta` 不是首语句、字面量 `Date.now()`）加 2 个 warning（编排层里的 `require`、`parallel` 传了裸 promise）。最后一行明明白白告诉你 `2 error(s) … fix before running`，退出码 1。

<div class="callout tip">

**把它接进工作流**：这个 lint 值钱的地方，就是**提交之前**先把那些会被静态拒绝的脚本拦下来，而且一次看全。一个朴素的用法是保存 `.claude/workflows/*.js` 的时候顺手跑它，或者在 CI 里对 PR 改动到的工作流脚本跑它。注意它是个**静态预检**，比 Workflow 工具自己的提交期拒绝**管得更宽**（它还报 warning），但本质是同一个源头：`meta`-first、确定性禁用、宿主 API、thunk 形状这些规则，最后都以**官方工具定义 + 本书实测**为准。

</div>

---

## 28.2 提交期 vs 运行期：两类拒绝的边界

校验器是「你自己先查一遍」。真正的关卡是 Workflow 工具本身，它在两个时刻把关。搞清楚错误是在哪一刻冒出来的，就是定位问题的第一步：**有没有拿到 `runId`，就是那条分界线**。

| 维度 | 提交期（静态拒绝） | 运行期（运行时抛错 / 上限） |
|---|---|---|
| 发生时刻 | 脚本被解析/执行**之前**，只做静态扫描 | 脚本已在 VM 里**执行中** |
| 有没有 `runId` | **没有**（连工作流都没启动） | **有**（`wf_...`，可用于续传/排错） |
| 返回形态 | `WorkflowOutput` 带 `error` 字段 | 运行 `failed`，或脚本内 `try/catch` 接住的异常 |
| 典型触发 | `meta` 非首语句/非纯字面量、字面量 `Date.now()` | 别名 `Date.now()`、`isolation:'remote'`、同步死循环、未知 agentType |
| 能否 `try/catch` 兜住 | **不能**（脚本没跑，何来 try） | **能**（异常在你的代码里抛出） |

下面一类一类看真实的错误原文。

### 提交期拒绝（无 Run ID）

**(1) 字面量 `Date.now()` / `Math.random()` / 无参 `new Date()`：静态扫描拒绝**

脚本里只要出现这些**字面量形式**的非确定性调用，就会在**提交时**被静态扫描拒掉，脚本根本不解析、也不运行。逐字错误原文如下：

```text
  Workflow scripts must be deterministic: Date.now()/Math.random()/new Date() are
  unavailable (breaks resume). Stamp results after the workflow returns, or pass
  timestamps via args.
```

<div class="callout warn">

**`try/catch` 接不住它**。很多人的第一反应是「那我把 `Date.now()` 包进 `try/catch` 不就行了」，不行。这是**提交时的静态源码扫描**，发生在脚本被解析/执行**之前**，你的 `try/catch` 还没轮到运行，脚本就已经被拒了。要时间戳，就用 `args` 传进去，或者等工作流返回以后再盖戳。（信源：`sandbox-r4.md` §A，提交拒绝实测，无 Run ID。）

</div>

**(2) `meta` 保留键：静态拒绝**

`meta` 必须是「纯字面量」，而且不能含保留键。我们提交了 `export const meta = { name, description, constructor: 'evil' }`，结果在**提交时被拒**，逐字原文：

```text
  Script must begin with `export const meta = { name, description, phases }` (pure literal).
  meta must be a pure literal: reserved key name not allowed in meta: constructor
```

这就证实了「保留键（`__proto__` / `constructor` / `prototype`）会被拒」（本书拿 `constructor` 实测）。同样**没有 Run ID**，工作流压根没启动。（信源：`repo-claims-r4.md` §X1。）

### 运行期抛错（带 Run ID）

下面这些**过了**提交期静态扫描（拿到了 `runId`），但跑起来以后因为各种原因抛错或者失败。

**(1) 别名形式的非确定性调用：运行时陷阱抛错**

如果你用别名绕开静态扫描（`const D = Date; D.now()`），提交**会过**，但这个调用会在**运行时**被 VM 的陷阱逮住、抛错，而且能被脚本自己的 `try/catch` 接住。实测返回（`wf_59bf3654-183`，0 agent / 0 token / 4ms）里，两个别名调用各自抛出了**不一样**的错误信息：

```json
  {
    "aliasedDateNowError": "Date.now() / new Date() are unavailable in workflow scripts (breaks resume). Stamp results after the workflow returns, or pass timestamps via args.",
    "aliasedMathRandomError": "Math.random() is unavailable in workflow scripts (breaks resume). For N independent samples, include the index in the agent label or prompt."
  }
```

注意 `Math.random()` 的运行时错误甚至**直接把替代方案给你了**：「为 N 个独立采样，把下标编进 agent 标签或提示词」。而 `new Date(具体值)` 是正常的（`new Date(0)` → `1970-01-01T00:00:00.000Z`）。这就是所谓「**双层防护**」：字面量被提交期拦下，别名被运行期拦下（这套两层模型的来由见 [第 01 章 §1.2](#/zh/p1-01)）。（信源：`sandbox-r4.md` §B。）

**(2) `isolation:'remote'` 抛错；未知 isolation 静默忽略**

`opts.isolation` 在运行期只对两个值做特判。实测（`wf_dace2fc6-966`，3 agent / 52,014 token / 5,253ms）：

```json
  {
    "isoRemote": { "threw": true, "err": "agent({isolation:'remote'}) is not available in this build" },
    "isoBogus":  { "threw": false, "result": "OK" },
    "badModel":  { "threw": false, "result": "OK" }
  }
```

- `isolation:'remote'` → **抛错**，逐字 `agent({isolation:'remote'}) is not available in this build`（证实 `'remote'` 是存在的，只是本 build 禁用了）。
- `isolation:'totally-bogus'` → **不抛错**，agent 照常返回 `OK`。

这纠正了一个常见的误解：运行时只对 `'worktree'`（执行隔离）和 `'remote'`（拒绝）做特判，**其它未知值被静默忽略**，并不是「只接受 `'worktree'`、其余一概报错」。所以 `isolation` 拼错了（比如 `'worktreee'`）不会报错，可你的 agent 也**根本没被隔离**，这就是个静默陷阱。（信源：`repo-claims-r4.md` §X2。）

**(3) `opts.model` 无解析期校验**

还是这次运行（`wf_dace2fc6-966`），`model: 'totally-not-a-real-model-xyz'` 这个**一眼就是拼错**的模型字符串，**并没有**在提交/解析期被拒，agent 照常跑、照常返回 `OK`。这跟 `agentType` 形成了鲜明对比（见下）。

<div class="callout info">

**为什么这次会话观测不到「到 API 那一步才失败」**：这次会话设了 `CLAUDE_CODE_SUBAGENT_MODEL=claude-opus-4-7[1m]`，它会**覆盖每一个 per-call `model`**，所以那个 bogus 字符串从来没真正发给 API，「拼错会在 API 调用时失败」这一步因为被覆盖了所以**没被观测到**（属第三方声称、未核实）。本书只断言已实测的那部分：`model` **无解析期校验**（这个覆盖变量的完整机制见 [附录 A · A.4](#/zh/app-a)）。（信源：`repo-claims-r4.md` §X4 + `sandbox-r4.md` §C。）

</div>

**(4) VM 同步超时 = 30000ms：抓死循环**

一个纯同步的长循环 `for (i=0; i<1e12; i++) {}`（一个 `await` 都没有）被中止了，工作流 **failed**。逐字失败原文和 Run ID：

```text
  Error: Script execution timed out after 30000ms
```

- **Run ID**：`wf_e3b2b123-5f4` · **status: failed** · 0 agent · 实测耗时 **30222ms**。

这就证实了 **30000ms 同步执行上限**。关键要理解：它只管**同步**那部分活儿（用来抓死循环），**不是墙钟上限**。带 `await agent(...)` 的异步工作流跑上几分钟太常见了（比如 `wf_6090decc-8a5` 那个深度研究跑了 298,530ms 也没事）。（信源：`repo-claims-r4.md` §X3。）

**(5) 未知 `agentType`：生成前 0 token 抛错，并列出可用 agent**

跟「没校验的 `model`」正相反，`agentType` 是**有校验**的。未知值会在**生成模型之前**（0 token / 4ms）就抛错，还把全部可用 agent 给你列出来。逐字错误原文和 Run ID（`wf_a222f20f-0f5`）如下：

```text
  agent({agentType}): agent type '…' not found. Available agents: claude,
  claude-code-guide, codex:codex-rescue, Explore, general-purpose,
  get-current-datetime, init-architect, Plan, planner, statusline-setup,
  team-architect, team-qa, team-reviewer, ui-ux-designer
```

这是个**好心**的错误：它不光告诉你这个 agentType 不存在，还把当前会话能用的 14 个 agent 名字全列出来，让你照着改就行。（信源：`assets/transcripts/` + grounding A2。）

下面把这两类拒绝的「检查 → 时机 → 带不带 Run ID」浓缩成一张图：

```mermaid
flowchart LR
    subgraph SUBMIT["提交期（静态，无 Run ID）"]
      direction TB
      S1["meta 非首语句 / 非纯字面量 / 保留键"]
      S2["字面量 Date.now()/Math.random()/无参 new Date()"]
    end
    subgraph RUNTIME["运行期（带 Run ID）"]
      direction TB
      R1["别名 Date.now() → 运行时抛错"]
      R2["isolation:'remote' → not available in this build"]
      R3["未知 isolation → 静默忽略（陷阱）"]
      R4["bogus model → 无解析期校验，照跑"]
      R5["同步死循环 > 30s → timed out after 30000ms (failed)"]
      R6["未知 agentType → 0 token 抛错 + 列出可用 agent"]
    end
    SUBMIT -->|"通过后分配 wf_..."| RUNTIME
```

---

## 28.3 三件调试利器

脚本跑起来之后出了问题，怎么定位？Workflow 给了你三件互补的工具：**实时看进度、回放每个 agent 的明细、改完增量重跑**。

### 利器一：`/workflows` 实时进度树

Workflow 工具**永远是异步的**：一调用就立刻返回 `taskId`/`runId`，等跑完了才发 `<task-notification>`。它跑着的这段时间里，你不是只能干等。斜杠命令 `/workflows` 给你一棵**实时进度树**，按 `phase()` 分组，一个 agent 一个 agent 地显示状态。想看工作流这会儿跑到哪了、哪个 agent 卡住了、哪个阶段还没开始，这就是第一现场。

```mermaid
flowchart TD
    Root["/workflows 进度树"] --> P1["▸ Phase: Review"]
    P1 --> A1["✓ review:bugs (done)"]
    P1 --> A2["⟳ review:security (running)"]
    P1 --> A3["• review:a11y (queued)"]
    Root --> P2["▸ Phase: Verify"]
    P2 --> A4["• 等待 Review 产出发现…"]
```

<div class="callout tip">

**配合 `log()` 一起用**：脚本里的 `log(message)` 会把一行叙述打到进度树**上方**。你就把它当成给人看的旁白，在关键节点写一句（比如 `log('维度 1 审出 7 条，开始扇出验证')`），进度树读起来就从一堆 agent 名变成有上下文的过程叙事了。注意 `log()` 不影响返回值，纯粹是展示用的。（`phase()`/`log()`/`/workflows` 这套可观测性原语的全貌见 [第 09 章 §9.2](#/zh/p2-09)。）

</div>

### 利器二：`agent-<id>.jsonl` journal

`WorkflowOutput` 里有个 `transcriptDir` 字段，指向本次运行的记录目录，这个字段本身是**工具契约确认**的（`sdk-tools.d.ts`）。在它底下，**每一次 `agent()` 调用**都会落一份 journal。**文件名 `agent-<id>.jsonl` 来自 Workflow 工具契约**（工具描述的「续传兜底」一段就点名让你去读 transcript 目录下的 `agent-<id>.jsonl`），逐行 JSON 记下这个 subagent 的完整往返：它收到的提示、它的工具调用、它的最终输出。哪个 agent 返回了出乎意料的结果，或者带 schema 的 agent 一直在重试，你打开它对应的 journal，就能看到它到底想了什么、调了什么工具、为什么没满足 schema。

> 说明：`transcriptDir`（`sdk-tools.d.ts`）和文件名 `agent-<id>.jsonl`（Workflow 工具描述的「续传兜底」段点名）都有**工具契约**背书；但 `.jsonl` 的**逐行内容形态**本书未做逐字核验，而且本机实测在盘上**确切见到的是 sidecar `agent-<id>.meta.json`**（记着这个 agent 的元信息，实测里是 `{"agentType":"workflow-subagent"}`，默认 agent 类型），所以那部分属**观测/推断**。

<div class="callout info">

**journal 是 resume 的物理基础**：续传之所以能秒级返回缓存，恰恰是因为每次 `agent()` 的结果都被 journal 记下来了。下面讲的 `resumeFromRunId` 读的就是这些 journal。所以 journal 不光是事后排错用的，也是增量重跑的数据来源。

</div>

### 利器三：`resumeFromRunId` 增量重跑

调试工作流最烧钱的地方，就是**每改一行就从头烧一遍 token**。`resumeFromRunId` 治的就是这个：把上一次的 `runId` 传进 `WorkflowInput.resumeFromRunId`，**最长未改动的 `agent()` 前缀**会秒级返回缓存结果，只有**第一个被编辑/新增的调用、以及它之后的**才 live 重跑（续传与缓存的完整机制在 [第 22 章](#/zh/p4-22)）。

实测对比最能说明问题（`wf_9c94951d-58c`）：

| 运行 | agent 数 | total tokens | duration |
|---|---|---|---|
| 首跑 | 5 | 133,691 | 32,959ms |
| 续传（同脚本 + 同 args） | 5（全缓存） | **0** | **3ms** |

同脚本、同 args 续传，5 个结果一模一样、**0 新 token / 3ms**。改一处再续传，这处之前的 agent 照样走缓存，之后的才重算。

<div class="callout warn">

**续传的三条铁律**：①**仅同会话**，跨会话不命中；②**续传前先把上一次运行停掉**（用 `TaskStop`），不然两次运行会打架；③缓存粒度是「**最长未改动前缀**」，你要是在脚本中间插一个 agent，它之后的所有 agent 都会重跑（哪怕内容压根没变），因为前缀被打断了。所以调试的时候尽量**从后往前**改，或者把最可能反复调的那个 agent 放到脚本靠后的位置。

</div>

### 关于「schema 不匹配时模型重试」

带 `schema` 的 `agent()` 会强制 subagent 去调 `StructuredOutput` 工具、在工具调用那一层校验，**不匹配模型就重试**。这是官方工具定义里写明的行为，本书每次带 schema 的运行也都成功返回了已验证的对象（schema 校验机制详见 [第 07 章](#/zh/p2-07)）。

<div class="callout warn">

**重试次数：别去断言具体数字**。第三方仓库声称「用 AJV 编译 schema、subagent 始终不调用时最多再催两次后失败」，但**确切的重试次数属第三方声称、未核实**，本书**不**断言任何具体数字。你只要知道两点：①这机制是存在的（不匹配会重试）；②要是某个带 schema 的 agent 迟迟不返回、或者耗时异常，多半是 **schema 约束太严**、模型反复满足不了。这时打开它的 `agent-<id>.jsonl` 看它每一次的尝试，常常就能定位是哪个字段卡住，适当松一松约束就行。

</div>

### 一张「出错了怎么办」决策树

把本章这三类信号（提交期、运行期、调试）串成一棵决策树：

```mermaid
flowchart TD
    Q0["工作流出了问题"] --> Q1{"拿到 runId 了吗?"}
    Q1 -->|"没有，返回 error 字段"| SUBMIT["提交期被拒"]
    SUBMIT --> S1["读 error 原文：<br/>'must be deterministic' → 删字面量 Date.now()/Math.random()<br/>'reserved key name' / 'pure literal' → 清理 meta<br/>先跑 validate-workflow.mjs 一次看全部问题"]
    Q1 -->|"有 wf_..."| Q2{"是 failed 还是结果不对?"}
    Q2 -->|"failed"| F1{"看失败原文"}
    F1 -->|"timed out after 30000ms"| F1a["有同步死循环 → 拆成 await / 加 break"]
    F1 -->|"not available in this build"| F1b["isolation:'remote' 本 build 禁用 → 改 'worktree' 或去掉"]
    F1 -->|"agent type … not found"| F1c["照错误里列出的可用 agent 改 agentType"]
    Q2 -->|"结果不对 / agent 行为怪"| D1["看 /workflows 进度树定位是哪个 agent"]
    D1 --> D2["打开 transcriptDir/agent-<id>.jsonl 看它的往返"]
    D2 --> D3{"是 schema 反复不满足?"}
    D3 -->|"是"| D3a["放松 schema 约束"]
    D3 -->|"否，逻辑问题"| D4["改脚本 → resumeFromRunId 增量重跑<br/>(先 TaskStop 停上一次)"]
    D3a --> D4
```

---

## 小结

校验与调试的核心，就是先分清「错误是在哪一刻冒出来的」，再拿对应的工具去定位：

- **两道关卡**：**提交期**静态扫描（无 Run ID）拒掉 `meta` 非纯字面量/非首语句、字面量 `Date.now()`/`Math.random()`/无参 `new Date()`；**运行期**（带 `runId`）抛出别名非确定性调用、`isolation:'remote'`（`not available in this build`）、同步死循环（`timed out after 30000ms`）、未知 `agentType`（0 token 抛错并列出可用 agent）这类错误。分界线就一条：**有没有 `runId`**。
- **第三方 lint `validate-workflow.mjs`（行为已实测）**：提交前在本地一次把所有问题列全（ERROR 阻断、warning 放行），不烧 token。
- **三件调试利器**：`/workflows` 实时进度树看「跑到哪了」；`transcriptDir` 下的 `agent-<id>.jsonl` journal 看「某个 agent 到底怎么了」；`resumeFromRunId` 增量重跑（最长未改前缀走缓存，**0 token / 3ms** 实测）让你改完不用从头烧 token，但记得**仅同会话、续传前先 `TaskStop`**。
- **一条克制原则**：schema 不匹配会触发模型重试，但**确切重试次数属第三方未核实，别去断言数字**；碰到带 schema 的 agent 迟迟不返回，先怀疑 schema 太严，打开它的 journal 定位卡住的字段。

把这两道关卡的错误原文记熟，再把这三件利器使顺手，你就能把「工作流出错」从「推倒重来」变成「读信号、点一下、增量重跑」。

继续阅读：[第 29 章 · 示例画廊](#/zh/p6-29)
