# 第 20 章 · 嵌套 Workflow

> 一句话：**在一个工作流脚本里，用 `workflow(nameOrRef, args?)` 内联调用另一个工作流，把验证过的工作流当作「可复用的子程序」拼装起来。但有一条铁律：嵌套只能一层。**
>
> 这一章聊的是 Workflow 的「模块化」这一面。前面你把 `agent()` 当函数用、把 `pipeline` 当控制流用；现在你把**整个工作流**当成一个可以被调用的单元。这是搭「工作流库」（第五部）的技术地基。

---

## 20.1 为什么需要嵌套：从复制粘贴到复用

你写的工作流一多，就会发现有些**模式老是重复出现**。

拿「对抗验证」（第 17 章）来说，「生成、独立验证、三态判决收口」这套结构，你在 Bug 猎手里用，在 PR 审查里用，在文档核查里也用。可你每次都把那二三十行 `pipeline + verdictSchema` 复制粘贴一遍，这就是典型的坏味道：

- 你改进了验证 prompt，就得回到每一处复制点，一个个手动同步。
- 每个调用点都有点小差异，它们就慢慢漂走了，最后谁也不敢动。

软件工程对付重复，标准答案是**抽取成可复用单元**。Workflow 的答案就是 `workflow()`：把「对抗验证」沉淀成一个独立的具名工作流，别的工作流需要时就**内联调用**它，跟调用一个函数一样。

```javascript
// （示意，未实跑）—— 主工作流内联调用一个验证子工作流
phase('Review')
const findings = await agent('找出这段代码的问题…', { schema: findingsSchema })

// 把「对抗验证」整个子工作流当函数调用
const verified = await workflow('adversarial-verify', { claims: findings.items })

log(`验证后保留 ${verified.confirmed.length} 项`)
return verified
```

`workflow('adversarial-verify', {...})` 这一行，跑的是另一个完整的工作流脚本（它内部可能有自己的 `pipeline`、自己的好几个 `agent()`），跑完把结果当返回值交回来。**这时候你复用的不再是一段代码，而是一个验证过的、自带 schema 契约的执行单元。**

<div class="callout info">

**官方语义（据 `_grounding.md` B 节）**：`workflow(nameOrRef, args?): Promise<any>`，作用是内联跑另一个工作流（具名，或 `{scriptPath}` 引用）。它**共享并发上限 / agent 计数 / 中止信号 / token 预算**，而且**嵌套仅一层**：子工作流里再调 `workflow()` 会抛错。（顺带一提可观测性：被内联调用的子工作流，在 `/workflows` 里会显示成一个 `▸ name` 分组，`name` 取子工作流的 `meta.name`，父子结构一眼可见。）这两条性质是本章的核心，下面分别展开。

</div>

---

## 20.2 两种调用方式：具名 与 scriptPath

`workflow()` 的第一个参数 `nameOrRef`，对应 `_grounding.md` 里 WorkflowInput 的两种定位方式：

**方式一：具名工作流。** 你传一个字符串名字，运行时就去找对应的工作流，可能是内置的，也可能是你沉淀在 `.claude/workflows/` 里的。想复用那些「已固化、反复用」的工作流，就走这条路：

```javascript
// （示意，未实跑）—— 按名字调用一个已沉淀的工作流
const result = await workflow('deep-research', { topic: args.topic })
```

**方式二：scriptPath 引用。** 你传一个 `{ scriptPath }` 对象，指向磁盘上的某个脚本文件。这对应 `_grounding.md` 里「`scriptPath` 优先级高于 script/name」的规则，适合调用那些还没固化成具名工作流、但已经落盘的脚本：

```javascript
// （示意，未实跑）—— 按脚本路径调用
const result = await workflow(
  { scriptPath: '.claude/workflows/scripts/verify-stage.js' },
  { claims }
)
```

两种方式的取舍：

| 方式 | 适合 | 类比 |
|---|---|---|
| 具名 `'name'` | 已固化、跨项目复用的标准工作流 | 调用已安装的库函数 |
| `{ scriptPath }` | 项目内、迭代中、尚未命名的工作流 | 调用本地相对路径的模块 |

参数 `args` 怎么传，跟顶层调用一个样：据 `_grounding.md`，它会变成子工作流脚本体内的全局 `args`。所以子工作流一读 `args.claims`，就拿到了你传进去的值。**这就是父子工作流之间的数据接口**。

<div class="callout info">

**「args 透传」和「未知具名工作流抛错」这两件事都已实测**（Run `wf_2b04881f-6a9`）。这次探针里：

- **scriptPath 子调用 + args 透传**：父工作流用 `workflow({ scriptPath }, { n: 21 })` 调一个子脚本，子脚本里 `args.n` 读到 `21`、返回 `doubled: 42`。可见 args **原样传进了子工作流**：字段都在，依旧是一个真正的对象，而不是被转成了字符串。
- **未知具名抛错**：你调一个不存在的名字，运行时会抛错，并**把当前所有已注册的具名工作流列出来**。**v2.1.156 实测**（Run `wf_03e38250-1bb`），这份清单已经收窄到只剩一个内置：

  ```text
  workflow('definitely-no-such-workflow-xyz-r11'): no workflow with that name. Available: deep-research
  ```

  这跟第 16 章 `agentType` 给个未知值就抛错、并列出可用 agent，是**同一种「校验 + 列清单」**的友好设计。你名字拼错了，运行时直接告诉你有哪些能选。注意这份内置清单**已与官方文档对齐**：官方只把 `/deep-research` 列为 bundled workflow，所以 `Available:` 后面也就只剩它。（早期 v2.1.150 这里列的是五件套 `bughunt, bughunt-lite, deep-research, plan-hunter, review-branch`（Run `wf_2b04881f-6a9`），那批在 v2.1.156 已不在注册表，详见 [附录 A.13.1](#/zh/app-a)。当然，你机器上的清单还会带上你自己装在 `.claude/workflows/` 里的工作流。）

</div>

```mermaid
flowchart TD
    P["父工作流"] -->|"workflow('name', { claims })"| C["子工作流脚本"]
    C -->|"脚本体内读 args.claims"| W["子工作流内部<br/>pipeline / agent / parallel"]
    W -->|"return 结果"| C
    C -->|"Promise 兑现"| P
```

---

## 20.3 铁律：嵌套仅一层

这是本章最重要、也最容易踩的一条约束。据 `_grounding.md`：**嵌套仅一层。子工作流里再调 `workflow()` 会抛错。**

用图说话：

```mermaid
flowchart TD
    A["主工作流（第 0 层）"] -->|"workflow() ✅ 允许"| B["子工作流（第 1 层）"]
    B -->|"workflow() ❌ 抛错"| C["孙工作流（第 2 层）"]
    style C fill:#fdd,stroke:#c00
```

也就是说：

- **主工作流 → 子工作流**：允许。这是一层嵌套。
- **子工作流 → 孙工作流**：**禁止**，运行时抛错。

为什么定这条规则？可以从几个角度理解（机制层面的确切原因事实源未展开，以下为基于约束的合理推断）：

**防止无限递归、资源失控。** 要是允许任意深度嵌套，一个工作流就能无限地 `workflow()` 套下去，再配上循环，agent 数量能炸成天文数字。限制成一层，就是一道结构性的护栏。它和「单工作流 agent 总数上限 1000」（`_grounding.md`）是同一种「防失控」的思路。

**让心智模型保持简单。** 一层嵌套意味着调用关系就是「父子」两级，你永远能一眼看清「谁调了谁」。要是嵌套深度随便套，追踪执行、归因 token、调试都会变难。

这条规则对你的设计有个直接影响：**子工作流必须是「叶子级」的。它自己可以扇出很多 `agent()`、用 `pipeline` / `parallel`，但不能再委派给另一个工作流。** 所以你设计工作流库的时候，要把那些「会被别人调用的」工作流设计成不依赖再去调用别的工作流。

<div class="callout warn">

**别想着用嵌套去搭多层流水线。** 一个常见的错误念头是「我把大任务拆成 A→B→C 三个工作流，让 A 调 B、B 调 C」。这第二跳（B 调 C）会直接抛错。正确做法是：**在主工作流里用普通 JS 顺序调用**，`await workflow('B')` 再 `await workflow('C')`，或者把 B、C 的逻辑摊成 `pipeline` 的多个 stage。嵌套是拿来做「主流程复用一个独立子能力」的，不是拿来搭「深度管道」的。

</div>

<div class="callout info">

**这条铁律的报错原文，本书实测拿到了**（Run `wf_2b04881f-6a9`，0 agent / 0 token / 29ms，是一个纯编排探针，不烧模型）。脚本里让一个子工作流再去调 `workflow()`，运行时抛出来的原文是：

```text
workflow() cannot be called from within a child workflow — nesting is limited to one level. Inline the inner script or call its agents directly.
```

注意报错本身就给了你两条出路，跟本节的「正确做法」完全对得上：**Inline the inner script**（把内层脚本内联进来）或 **call its agents directly**（直接调它的 agent）。同一次运行还顺带验证了另外两件事，见 20.2 和 20.8。

</div>

---

## 20.4 共享的是什么：一个池，不是各管各的

`workflow()` 有一个极重要的性质：子工作流**不是**一个全新独立的世界，它和父工作流**共享**几样关键资源。据 `_grounding.md`，共享的是：**并发上限、agent 计数、中止信号、token 预算。**

一项项看清楚，这都意味着什么：

| 共享项 | 含义 | 你要注意的 |
|---|---|---|
| **并发上限** | 父子合用同一个 `min(16, CPU−2)` 名额池 | 子工作流的 agent 和父的 agent 抢同一批并发槽位 |
| **agent 计数** | 父子的 agent 数合并计入那个 1000 上限 | 子工作流的扇出会消耗父的全局配额 |
| **中止信号** | 父被中止，子也被中止 | 一处取消，整体停止，不会有「孤儿子流程」 |
| **token 预算** | 父子共用同一个 `budget` 池 | 子工作流烧的 token 直接从父的 `budget.remaining()` 里扣 |

最要当心的是**预算共享**。`budget` 是一个硬上限，一旦花完再调 `agent()` 就抛错，而且这个池子是主循环和所有工作流共用的（机制细节见[第 21 章 · 动态预算与规模化](#/zh/p4-21)）。落到嵌套上：子工作流烧的 token 直接从父的同一个 `budget` 里扣。所以你要是以为「每个子工作流各有各的预算」，第二个子工作流就会一头撞上预算耗尽。**正确的心智模型是：不管嵌不嵌套，整个回合就一个 token 池、一个并发池、一个 agent 计数器。** `workflow()` 只是把活儿组织得更模块化，不会给你变出额外的资源。

<div class="callout tip">

**这其实是好事。** 共享池意味着你在主工作流里设的 `budget` 上限，会**自动罩住**所有被它调用的子工作流，所以你不用在每个子工作流里再重复设一遍防线。一处设上限，整棵调用树都受这个上限约束。中止信号也一样：用户取消主流程，所有子流程一起干干净净地停，不留后台孤儿。**共享池给的是「整体可控」的保证，它并没有给你添限制。**

</div>

---

## 20.5 典型模式：用子工作流拼装主流程

把前面几节合到一起，来看一个主工作流，它把「研究 + 验证」这两个独立能力拼装了起来。

```javascript
// （示意，未实跑）—— 主流程内联复用两个子工作流
export const meta = {
  name: 'research-and-verify',
  description: '先调研究子工作流产出论断，再调验证子工作流逐条核验',
  phases: [{ title: 'Research', detail: '调研究子工作流' }, { title: 'Verify', detail: '调验证子工作流' }],
}

phase('Research')
// 第一跳：复用「深度研究」子工作流
const research = await workflow('deep-research', { topic: args.topic })
log(`研究产出 ${research.claims.length} 条论断`)

phase('Verify')
// 第二跳：在主流程里顺序调用另一个子工作流（不是在 research 内部调！）
const verified = await workflow('adversarial-verify', { claims: research.claims })

return {
  topic: args.topic,
  confirmed: verified.confirmed,
  refuted: verified.refuted,
}
```

请特别留意，这里的**两跳都发生在主工作流（第 0 层）**：`research` 和 `verify` 是**平级的、顺序的**两次调用，由主工作流用普通 `await` 串起来。这跟「让 `deep-research` 内部去调 `adversarial-verify`」（那会触发第 2 层嵌套、抛错）有本质区别。

这就是 20.3 节那条铁律的实践推论：**多步复用靠主流程的顺序/控制流来编排，而不是靠子工作流互相调用。** 主工作流是唯一的「编排层」，子工作流都是它直接调用的「能力单元」。

```mermaid
flowchart LR
    M["主工作流（编排层）"] -->|"第一跳 await"| R["deep-research<br/>（能力单元）"]
    R --> M
    M -->|"第二跳 await<br/>把 research.claims 传入"| V["adversarial-verify<br/>（能力单元）"]
    V --> M
    M --> O["合并收口"]
```

子工作流之间的数据流，照样走 `args` 进、`return` 出这条标准通道：`research.claims` 是第一个子工作流的返回值，当成 `args.claims` 喂给第二个。**这跟第 07 章「schema 是阶段间契约」的思想一脉相承**。这里的「阶段」是整个子工作流，契约是它的输入 `args` 形状和输出结构。

---

## 20.6 嵌套 vs 不嵌套：什么时候真的需要 workflow()

`workflow()` 很优雅，但不是所有「复用」都得用它。很多时候，直接在脚本里写个 JS 函数就够了，甚至更好。把这两种情况分清楚：

| 你想复用的是… | 用什么 | 理由 |
|---|---|---|
| 一段**纯计算**逻辑（去重、聚合、格式化） | 普通 JS 函数 | 确定性、零 agent 成本，不该动用 workflow |
| 一个 **schema 定义** | 一个 `const schema = {...}` 变量 | 直接共享对象即可 |
| 一段**固定的 prompt 模板** | 一个返回字符串的 JS 函数 | 轻量，无需工作流开销 |
| 一个**完整的、含多 agent 编排的能力单元** | `workflow()` | 这才是嵌套的正当用途 |
| 一个**已固化、跨项目复用**的标准流程 | 具名 `workflow('name')` | 沉淀为库，像调用第三方能力 |

<div class="callout warn">

**别为了「看起来模块化」就过度嵌套。** 如果一个「子工作流」内部其实只有一个 `agent()` 调用，那它根本不配叫工作流。把它写成主脚本里的一个 `agent()` 调用、或者一个返回 `agent(...)` 的 JS 函数就行了。`workflow()` 的开销和心智成本（独立脚本、独立 meta、跨文件追踪），只有在被复用的那个单元**本身就是一整套完整编排**时才划算。**判断标准就一句：这个单元要是不复用、直接内联进主脚本，会不会把主脚本撑到臃肿得没法看？** 会，才值得抽成子工作流。

</div>

---

## 20.7 与 Agent Teams 的边界

最后澄清一个容易搞混的点。Workflow 的 `workflow()` 嵌套，和 Agent Teams（`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`，见 `_grounding.md` A 节关联标志），听起来都像「让多个执行单元协作」，但它们是**完全不同**的东西。第 01 章已经划过界，这里从「组合」的角度再强调一遍：

| | `workflow()` 嵌套 | Agent Teams |
|---|---|---|
| 本质 | 一个工作流调用另一个工作流（确定性脚本） | 有状态、可互相通信的长期协作团队 |
| 控制流 | 父工作流的 JS 代码完全决定 | 团队成员通过消息动态协商 |
| 状态 | 无状态、一次性、可重放 | 有状态、可往返对话 |
| 嵌套 | 仅一层 | 不适用（是另一套模型） |

一句话：**`workflow()` 是「确定性地把子流程拼进主流程」，Agent Teams 是「让多个有状态 agent 像团队一样协作」。** 你的复用单元要是一段「输入→确定性编排→输出」的纯流程，就用 `workflow()`；你要的要是成员之间动态、有状态的来回协商，那就是 Agent Teams 的地盘了，不在本书 Workflow 的范畴里。

---

## 20.8 招牌组合：每个条目本身是一整个 Workflow

前面 20.5 节讲的是「主流程顺序拼装几个子工作流」。把它和 `pipeline`（第 08 章）叠到一起，就得到嵌套 Workflow 最具代表性的形态：**父流程是对一批条目跑的 `pipeline`，而每个条目都被甩给一个具名子工作流去独立处理。**

最经典的例子就是「审 10 个 PR」：

```javascript
// （示意，未实跑）父 pipeline，每个 PR 交给一个子 workflow 独立处理
const results = await pipeline(
  prs,
  pr => workflow('review-one-pr', { pr }),   // 每个条目本身是一整个 workflow
)
```

读这段代码：`prs` 是待审的一批 PR；`pipeline` 让每个 PR **独立流过**这条链；而链上那个 stage 是一整个 `workflow('review-one-pr', { pr })`，而不是单个 `agent()`。**每个条目都触发一次完整的子工作流**。子工作流 `review-one-pr` 内部可以自己扇出多个 `agent()`（按维度审、对抗验证、汇总），把「审一个 PR」这件事整个封装起来。父流程只管「把 N 个 PR 分发出去、收回 N 份结果」，单个 PR 到底怎么审的那些复杂度，全收进了子工作流里。

这正是 20.1 节「从复制粘贴到复用」的终点形态：**「审一个 PR」沉淀成一个具名能力单元，「审一批 PR」不过是对它做 `pipeline` 扇出。** 加一个 PR、改审查逻辑，都只动一处。

但有三条约束你必须时刻记牢，它们都是前几节铁律在这个形态下的直接推论：

**其一，仍然只有一层。** 这里的嵌套深度还是「父 pipeline（第 0 层）→ `review-one-pr`（第 1 层）」，正好一层。所以 `review-one-pr` 的脚本体内**绝不能再调 `workflow()`**：据 `_grounding.md`，子工作流里再调 `workflow()` 会抛错。`review-one-pr` 必须是「叶子级」的，它可以用 `agent()` / `parallel` / 内部 `pipeline` 随便扇出，但不能再委派给另一个工作流。你要是发现 `review-one-pr` 想调又一个子工作流，那就说明该把那段逻辑直接内联进它自己的脚本，或者上提到父 pipeline 这一层来编排。

**其二，所有子工作流的 agent 和 token 都计入父的同一个池。** 据 `_grounding.md`，`workflow()` 共享并发上限 / agent 计数 / 中止信号 / token 预算（详见 20.4 节）。所以这个形态下，**总 agent 数 ≈ PR 数 × 每个 `review-one-pr` 内部的 agent 数**，全部合并计入父的 1000 上限和父的 `budget` 池。审 10 个 PR、每个子工作流内部用 4 个 agent，那就是约 40 个 agent 一起从同一个预算里扣。规模放大得很快，记得结合[第 21 章](#/zh/p4-21)的预算自适应来收口。

**其三，子工作流抛错 → 该条目变 `null`。** 这是 `pipeline` 的既有语义（第 08 章）：某个 PR 的 `review-one-pr` 内部抛错了，该位置就变 `null` 跳过，不影响其余 PR。消费前照例 `results.filter(Boolean)`。

<div class="callout info">

**这个形态依赖的两条性质，都有真实运行背书。** ①**子工作流的 agent 计入父**：据 `_grounding.md` C 节，nested workflow() 运行 `wf_85e22b38-126` 证实子工作流的 `agent_count=1` 归到了父的计数里。②**嵌套仅一层**：本书又用 `wf_2b04881f-6a9` 直接拿到了越界报错原文（见 20.3），子工作流里再调 `workflow()`，会抛 `nesting is limited to one level`。本节这段「pipeline-of-nested」组合**本身未单独实跑**（所以标了「（示意，未实跑）」），但它只是把已验证的 `workflow()`（`wf_85e22b38-126` / `wf_2b04881f-6a9`）塞进同样已验证的 `pipeline`（`wf_bf086b98-6ec`，见第 08 章）里。两块都是实测过的积木，拼法是标准 JS。

</div>

```mermaid
flowchart TD
    P["父 pipeline（第 0 层）<br/>对 prs 扇出"] --> I1["PR #1 → workflow('review-one-pr')"]
    P --> I2["PR #2 → workflow('review-one-pr')"]
    P --> I3["PR #N → workflow('review-one-pr')"]
    I1 --> C1["子工作流（第 1 层）<br/>内部 agent/parallel<br/>❌ 不能再调 workflow()"]
    I2 --> C2["子工作流（第 1 层）"]
    I3 --> C3["子工作流（第 1 层）"]
    C1 & C2 & C3 --> R["收集 N 份结果<br/>filter(Boolean)"]
    style C1 fill:#eef
```

---

## 20.9 本章小结

- `workflow(nameOrRef, args?)` 在一个工作流里**内联调用另一个工作流**，把验证过的工作流当成可复用的「能力单元」，是搭工作流库的地基。
- 两种定位：**具名**（`'name'`，调用已固化/跨项目的标准工作流）和 **`{ scriptPath }`**（调用项目内、迭代中的脚本）。`args` 进、`return` 出，就是父子间的数据接口。
- **铁律：嵌套仅一层。** 子工作流里再调 `workflow()` 会抛错。多步复用靠**主流程的顺序/控制流**来编排（主工作流是唯一编排层），而不是靠子工作流互相调用。
- **共享一个池**：父子合用同一个并发上限、agent 计数（计入 1000 上限）、中止信号、token 预算（`budget` 硬上限对整棵调用树都生效）。心智模型就一句：整回合就一个资源池，`workflow()` 不会变出额外资源。
- 取舍：纯计算用 JS 函数、schema 用共享变量、prompt 用模板函数；只有**完整的多 agent 编排单元**才值得抽成 `workflow()`。别为「看起来模块化」就过度嵌套。
- 招牌组合（20.8）：**父 `pipeline` 扇出、每个条目本身是一整个子工作流**（比如「审 10 个 PR」），是「复用」的终点形态。仍然受一层嵌套约束（子工作流内不能再调 `workflow()`），而且所有子工作流的 agent / token 都合并计入父的同一个池。
- 与 Agent Teams 划界：`workflow()` 是确定性的子流程拼装；Agent Teams 是有状态的协作团队，不在本书范畴。

下一章，你钻进那个反复出现的「共享资源池」里最关键的一项，token 预算：怎么用 `budget.total` / `remaining()` 让工作流**根据剩余预算动态调整规模**。

> 继续阅读：[第 21 章 · 动态预算与规模化](#/zh/p4-21)
