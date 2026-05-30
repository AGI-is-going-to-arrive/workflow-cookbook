# 前言：经纬之间

> **「经之以天，纬之以地。」**——《左传·昭公二十八年》
>
> 两千年前，织工以经线为骨、纬线为肉，一梭一梭织就锦缎。经线是结构，纵贯始终、张紧不移；纬线是功能，穿梭其间、变化万千。经定其形，纬成其华，经纬交织方成一匹布。
>
> 今天编排 AI Agent 也是同一回事。`meta` 与 `phase` 是**经**：确定性的结构骨架，预先张紧、不可动摇；`agent()`、`parallel()`、`pipeline()` 是**纬**：在骨架中穿梭执行的智能单元。经线决定流水线的形状，纬线填入真正的工作。
>
> 本书因此得名 **织经**。

---

## 当所有人都在「指挥」Agent

过去两年，我们学会了**使用** AI Agent：写好提示词、配好工具、开几个子任务并行跑一跑。社区里也冒出来一大批好用的工作流系统，比如 `oh-my-claudecode`、`superpowers`、`oh-my-openagent`、`ccg-workflow`，各有各的招，能把单个 Agent 调教成一支训练有素的团队。

但你要是拆开它们的引擎盖，会发现一个共同的、有点尴尬的事实：**这些系统都在用提示词「祈祷」式地编排。**

它们把编排逻辑写在 Markdown 里，靠在提示词里反复念叨「⛔ 你必须先做 A 再做 B」「绝不允许跳过验证」，来约束一个**概率性**的语言模型。它们用生命周期钩子（hooks）在每一轮对话里塞「面包屑」，提醒 Agent「你还没干完，回去接着干」。它们还把进度写成 JSON 状态文件落盘，因为上下文一旦被压缩，Agent 就会忘了自己在做什么。

这些招数很聪明，也确实管用。可它们骨子里是在用**自然语言**加**运行时补丁**，去凑一个本该由**代码**来保证的东西：**确定性的控制流**。

> 它们为什么这么干？因为很长一段时间里，Claude Code 根本没给你「用代码编排 Agent」的原生能力。
>
> 现在，官方把它正式做出来了。

---

## 先看一个真实对比

同一件事，用 workflow 和不用各做一遍，量出来的差别长这样。

任务是给本书 6 个章节做事实核查：每章先挑出最关键的一个问题，再复核这条发现是真问题还是误报。一共 12 个 subagent 的活，6 次审查加 6 次复核。

不用 workflow 时，你开 6 个 subagent 并发审查，等它们全回来、自己逐条读完，再开 6 个去复核。用 workflow 时，你写一小段 `pipeline` 脚本，让 6 章各自审完就复核，跑完只把一份结构化结论交回来。两种都在 v2.1.156 上真跑过，Run ID 在本节末。

| 看哪里 | 不用 workflow | 用 workflow（`pipeline`） |
|---|---|---|
| 回到你主对话的内容 | **47,080** 字符，12 段评审全文 | **357** 字符，一份结构化结论 |
| 会不会漏 | 全靠你和模型记着还剩哪几条，容易漏、容易跳步 | 代码点齐 12 条、`schema` 逼结构规整；复核还当场逮出 1 个误报 |

重点在第一行：同一摊活，回到你眼前的东西差了 **132 倍**。上下文窗口是最金贵的资源，可那四万多字符的评审全文一旦进了主对话就占着不走，之后每一轮都得连它一起重算，token 越烧越多。用 workflow，原始过程留在沙箱，回到你眼前的只有结论。

速度上两边没差，都 4 分钟上下，所以别冲着「更快」用它，省时间得靠更长的多阶段流水线（见[第 8 章](#/zh/p2-08)）。

> **这两次运行**：用 workflow 那遍 `wf_6fc26e37-02d`（`pipeline`），不用那遍 `wf_372d53bf-419`（`parallel` 两道屏障模拟手动）；都是 12 个 agent，本机 v2.1.156 实测。「不用」那遍已按手动最快的情况算，真动手只会更慢。完整数据见 [`assets/transcripts/examples-r14.md`](https://github.com/AGI-is-going-to-arrive/workflow-cookbook/blob/main/assets/transcripts/examples-r14.md)。

---

<div class="callout info">

**关于本书的两层真值（请先读这段）**

这本书讲两层东西，来源不一样，得分清楚：

1. **怎么用（用户视角）**：以官方文档 `code.claude.com/docs/en/workflows` 为准，包括怎么触发、怎么审批、怎么保存重跑、怎么开关、有哪些限制。这些官方都明确写了。
2. **脚本里到底有什么（引擎室）**：就是 `agent()`、`parallel()`、`pipeline()`、`phase()`、`meta`、`schema` 这套编排 API。**官方公开文档没写这一层。** 它真实存在、也跑得通（本书用 40 多条真实运行存证、每条都带 Run ID 来证明），但它来自 Claude Code 的运行时契约和我们的实测，并不是官方文档里的东西。

为什么还要讲第二层？因为官方的用法是「你描述任务，Claude 替你写脚本」，你不用自己动手写。但你要想看懂 Claude 写了什么、自己改一改、再建立起一套可复用的工作流，就得懂脚本里这套 API。这正是本书的价值所在。

提醒一句：Dynamic workflows 是 research preview，脚本层这些细节官方随时可能改。本书凡讲脚本层的地方，都按「实测来的、官方未公开」标注；真要上生产，自己再跑一遍验证。

</div>

## 官方刚正式发布的确定性引擎：Dynamic workflows

Claude Code 官方刚推出了一个叫**动态工作流（Dynamic workflows）**的能力，状态是 **research preview（研究预览）**，文档已正式收录在 [`code.claude.com/docs/en/workflows`](https://code.claude.com/docs/en/workflows)。它干的事，一句话说清楚：

> **用一段纯 JavaScript 脚本，确定性地编排成百上千个 subagent（受官方上限约束：单 run 至多 1000 个、并发至多 16 个），支持流水线、并发、阶段、预算、结构化输出与 JSON Schema 约束，并且可复用、可测试、可分享。**

按官方的说法，动态工作流就是一段 JavaScript 脚本，由 Claude 替你写出来，再交给一个 runtime 在后台跑；跑的时候你的会话照样能用，不会被卡住。它和 Claude Code 其他几种扩展机制是两码事：MCP 是连外部工具的协议，Skills 是往提示词里塞的知识包，Subagents 是一次性的子任务，Agent Teams 是有状态的协作团队。工作流则是一个**全新的、正交的扩展维度**，它把「先做什么、再做什么、哪些并行、哪些串行、出了结果怎么验证」这套**编排逻辑**，从飘忽不定的提示词里拎出来，搬进了**确定性的代码**。

你写下这么一段：

```javascript
const results = await pipeline(
  dimensions,
  d => agent(d.reviewPrompt, { schema: FINDINGS }),
  review => parallel(review.findings.map(f => () =>
    agent(`对抗性验证这条发现：${f.title}`, { schema: VERDICT })
  ))
)
```

`pipeline`、`parallel`、`agent` 全是**真实的函数**，由 JavaScript 运行时**确定性地**跑起来。哪个阶段先跑、几个 agent 并发、循环到什么条件才退出，全由代码说了算，不再指望模型「自觉」。而 `schema` 会强制每个 subagent 的产物**严格匹配** JSON Schema，模型要是返回的结构不合规，运行时就让它**重试**，直到合规为止。

这就意味着：**社区那些靠提示词苦苦撑着的编排纪律，现在能用代码一次性焊死。**

官方要求 **Claude Code v2.1.154 及以上**，所有付费档都能用（Anthropic API、Amazon Bedrock、Google Cloud Vertex AI、Microsoft Foundry 也覆盖）；Pro 用户得自己在 `/config` 里找到 "Dynamic workflows" 那一行手动打开。开起来之后，官方还给了一个会话级的主动编排挡位 `/effort ultracode`：开启后整场会话默认主动用工作流编排，`/effort high` 还原（详见 [第 01 章 §1.6](#/zh/p1-01)）。这本书要带你把这个刚发布的能力**真正用透**：不光会用官方自带的，还能上手 [**写出属于你自己**](#/zh/p6-27) 的工作流。

---

## 这本书是什么，不是什么

**这是一本 Cookbook（食谱书），不是 API 文档。**

「Workflow 工具有哪些参数」这种罗列，市面上一抓一大把。本书要回答的，是更难、也更有用的问题：

- **何时**该用 Workflow，何时该用 Subagents / Skills / Agent Teams？（第一部 · 定位矩阵）
- `parallel` 和 `pipeline` 看着都能并发，**到底差在哪**，选错了会白白浪费多少墙钟时间？（第二部 · 基础篇）
- 一个真正能用的「分片代码审查」「PR 多维评审」「Bug 猎手」流水线，**到底长什么样**？（第三部 · 实战食谱）
- 怎么设计「对抗验证」「评委面板」「循环到干」，让结果**可信**，而不只是「看起来对」？（第四部 · 进阶模式）
- 那四个优秀的社区系统，**哪些精华**能用 Workflow 重写成可复用的资产？（第五部 · 生态与借鉴）
- 怎么从零搭一个**属于你自己**的、可复用、可分享的 Workflow 库？（第五部 · 构建你的库）

<div class="callout tip">

**深入浅出**是本书的写作信条。每个概念都从「为什么需要它」讲起，先用一个最小可运行的例子帮你建立直觉，再一步步加码到生产级的配方。你不用先把理论全啃完，挑一个最贴近你工作的配方，照着跑通，再回头理解原理，照样有效。

</div>

---

## 三个不容妥协的承诺

本书跟许多「AI 写的教程」最大的不一样，就在这三条铁律：

**一、真实运行，绝不伪造。** 书里每一段标着「真实运行」的输出，都来自在真实 Claude Code 会话里实际跑 Workflow 得到的原始结果，包括真实的 `taskId`、`runId`、token 用量、耗时和返回值。这些原始记录都存在仓库的 [`assets/transcripts/`](https://github.com/AGI-is-going-to-arrive/workflow-cookbook/tree/main/assets/transcripts) 目录里，你可以逐条核对。凡是没实际跑、只作示意的脚本，都会**明确标注**。

**二、信源对照，绝不臆测。** 所有关于 Workflow API 的说法，都拿三处信源逐字核对过：官方文档 [`code.claude.com/docs/en/workflows`](https://code.claude.com/docs/en/workflows)、Claude Code 官方分发包里的类型定义文件 `sdk-tools.d.ts`（`WorkflowInput` / `WorkflowOutput` 接口），以及运行时的工具定义。凡是涉及环境变量、版本号、功能标志的论断，都经本机实测确认。本书超出官方文档的那些发现（注册表实测只剩 `deep-research`、序列化陷阱、parallel 同步抛错会崩库、worktree 行为等），全部标注了对应的 Run ID，方便你复核。

**三、口径一致，中英对照。** 本书提供完整的中英双语版本，两种语言一一对应、术语统一。你在任意章节点右上角的语言切换，都会跳到同一章的另一语言版本。

---

## 实测环境声明

> 本书所有实测都在下面这套环境里完成，你读配方时拿它当基准就行：
>
> | 项 | 值 |
> |---|---|
> | Claude Code 版本 | **v2.1.154+（官方最低）**；本书实测跨 **v2.1.150 → v2.1.156**，核心不变量已在 v2.1.156 复核（见 [`assets/transcripts/examples-r11.md`](https://github.com/AGI-is-going-to-arrive/workflow-cookbook/blob/main/assets/transcripts/examples-r11.md)） |
> | 功能标志 | `CLAUDE_CODE_WORKFLOWS=1`（本会话 `printenv` 实测在场；官方面向用户的入口是 `/config`） |
> | effort 体系 | `/effort` 七挡 `low/medium/high/xhigh/max/ultracode/auto`；**ultracode = xhigh + 主动编排（仅本会话）**；本会话锁在 `CLAUDE_CODE_EFFORT_LEVEL=max` |
> | 主模型 | **Opus 4.8（1M）** |
> | subagent 模型 | **`claude-opus-4-8[1m]`**（由 `CLAUDE_CODE_SUBAGENT_MODEL` 显式指定，`printenv` 实测） |
> | 关联标志 | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` |
> | 实测时间 | 2026 年 5 月（R11 复核） |
>
> 用工作流前，先确认它在你的会话里**可用**：官方台面入口是 `/config` 的 "Dynamic workflows" 行（Pro 用户必须在这儿手动开），power-user 也可以显式设 `CLAUDE_CODE_WORKFLOWS=1`（详见 [第 01 章 §1.5](#/zh/p1-01)）。不同版本的具体行为（并发上限、预算语义、续传细节）可能会变。书里会标出关键行为的来源，方便你在自己的版本上复核。

---

## 如何阅读

> **赶时间？** 第 01 章建立认知 → 第 04 章跑通第一个 → 第 08 章搞懂 `parallel` vs `pipeline` → 挑一个第三部的配方照着改。
>
> **有经验？** 直接进第三部「实战食谱」和第四部「进阶模式」，碰到概念缺口再回头查第一、二部。
>
> **想系统掌握？** 从头读到尾，每章都动手跑一遍配方，最后在第五部用 Workflow 重写你自己工作流里最痛的那个环节。
>
> **想搭一个属于自己的、可复用的工作流？** 按这条顺序走：先用 [第 04 章](#/zh/p2-04) 跑通第一个，再到 [《操作面板》§6](#/zh/p2-ops) 学会按 `s` 保存重跑，接着读 [第 27 章 §27](#/zh/p6-27) 学从零创作的流程，最后用 [第 25 章 §25](#/zh/p5-25) 把它沉淀成你自己的库。
>
> **来抄作业？** 第三、四部的每个配方都是能直接复制就跑的完整脚本；附录 A 是对照官方类型定义的完整 API 速查。
>
> **只想速查？** [附录 F · 模式目录与场景速查表](#/zh/app-f) 是全书的一页纸总图：先按场景查推荐模式，再点进对应章节看真实运行。

---

## 致谢与声明

本书的写作受了 [御舆 · claude-code-book](https://github.com/lintsinghua/claude-code-book) 的启发——那本书把 Claude Code 的架构系统地剖了一遍，是「拆开引擎盖」这股劲儿的先行者。第五部对四个社区系统（`ccg-workflow`、`oh-my-claudecode`、`oh-my-openagent`、`superpowers`）的剖析，都建立在真读过它们源码的基础上，图的是「取其精华」，而不是评高下。

> **声明：** 本书是基于对 Claude Code 公开分发包、类型定义和产品行为的分析写成的，再辅以真实运行来验证。Claude Code 是 Anthropic PBC 的产品；本书不隶属于、未获授权于、也不代表 Anthropic。书中的观点和可能存在的错误，都由作者负责。

<div class="callout info">

准备好了吗？翻到 [第 01 章 · Workflow 是什么](#/zh/p1-01)，我们就从「它到底是个什么东西」讲起。

</div>
