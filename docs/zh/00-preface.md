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

过去两年，我们学会了**使用** AI Agent：写好提示词、配好工具、开几个子任务并行跑一跑。社区中也涌现出一批优秀的工作流系统，如 `oh-my-claudecode`、`superpowers`、`oh-my-openagent`、`ccg-workflow`，各有特色，能将单个 Agent 组织成一支协调运作的团队。

但查看它们的实现会发现一个共同的事实：**这些系统都在用提示词「祈祷」式地编排。**

它们把编排逻辑写在 Markdown 里，靠在提示词中反复强调「⛔ 你必须先做 A 再做 B」「绝不允许跳过验证」，来约束一个**概率性**的语言模型。它们用生命周期钩子（hooks）在每一轮对话中插入「面包屑」，提示 Agent「任务尚未完成，继续执行」。它们还把进度写成 JSON 状态文件持久化，因为上下文一旦被压缩，Agent 就会丢失当前执行状态。

这些做法很巧妙，也确实有效。但本质上，这些方案是在用**自然语言**加**运行时补丁**，来模拟一个本该由**代码**保证的东西：**确定性的控制流**。

> 原因很简单：很长一段时间里，Claude Code 没有提供「用代码编排 Agent」的原生能力。
>
> 现在，官方正式提供了这个能力。

---

## 先看一个真实对比

同一件事，用 workflow 和不用各做一遍，以下是实测数据。

任务是给本书 6 个章节做事实核查：每章先挑出最关键的一个问题，再复核这条发现是真问题还是误报。一共 12 个 subagent 的活，6 次审查加 6 次复核。

不用 workflow 时，需要先开 6 个 subagent 并发审查，等全部返回后逐条阅读，再开 6 个去复核。用 workflow 时，写一小段 `pipeline` 脚本，每章审完就自动进入复核，跑完只返回一份结构化结论。两种方式都在 v2.1.156 上实际运行过，Run ID 在本节末。

> **这两次运行**：workflow 版 `wf_6fc26e37-02d`（`pipeline`），手动版 `wf_372d53bf-419`（`parallel` 两道屏障模拟手动流程）；均为 12 个 agent，本机 v2.1.156 实测。手动版已按最快操作估算，实际手动操作只会更慢。完整数据见 [`assets/transcripts/examples-r14.md`](https://github.com/AGI-is-going-to-arrive/workflow-cookbook/blob/main/assets/transcripts/examples-r14.md)。

| 看哪里 | 不用 workflow | 用 workflow（`pipeline`） |
|---|---|---|
| 回到你主对话的内容 | **47,080** 字符，12 段评审全文 | **357** 字符，一份结构化结论 |
| 会不会漏 | 依赖人工和模型记忆来跟踪进度，容易遗漏或跳步 | 代码逐条清点 12 项、`schema` 强制结构规整；复核还发现了 1 个误报 |

重点在第一行：同样的工作量，回到主对话的内容差了 **132 倍**。上下文窗口是最稀缺的资源，四万多字符的评审全文一旦进入主对话就会持续占用，之后每一轮都需要连同它一起重算，token 消耗逐轮递增。使用 workflow 后，原始过程留在沙箱内，回到主对话的只有结论。

速度方面两者基本持平，都在 4 分钟左右，因此不应以「加速」为目的选择 workflow。时间优势来自更长的多阶段流水线（见[第 8 章](#/zh/p2-08)）。

---

<div class="callout info">

**关于本书的两层真值（请先读这段）**

本书涉及两层内容，来源不同，需要区分：

1. **怎么用（用户视角）**：以官方文档 `code.claude.com/docs/en/workflows` 为准，包括怎么触发、怎么审批、怎么保存重跑、怎么开关、有哪些限制。这些官方都明确写了。
2. **脚本里到底有什么（引擎室）**：就是 `agent()`、`parallel()`、`pipeline()`、`phase()`、`meta`、`schema` 这套编排 API。**官方公开文档没写这一层。** 它真实存在、也跑得通（本书用 40 多条真实运行存证、每条都带 Run ID 来证明），但它来自 Claude Code 的运行时契约和我们的实测，并不是官方文档里的东西。

为什么要涵盖第二层？官方的用法是「描述任务，Claude 替你写脚本」，不需要手动编写。但如果要看懂 Claude 生成的脚本、做出修改、并建立一套可复用的工作流，就需要理解脚本层的 API。这正是本书的价值所在。

注意：Dynamic workflows 是 research preview，脚本层的细节官方随时可能调整。本书凡涉及脚本层的内容，都标注为「实测验证、官方未公开」；在生产环境使用前，建议自行运行验证。

</div>

## Dynamic workflows：官方的确定性编排引擎

Claude Code 推出了动态工作流（Dynamic workflows），目前状态为 research preview（研究预览），文档收录在 [`code.claude.com/docs/en/workflows`](https://code.claude.com/docs/en/workflows)。一句话概括：

> **用一段纯 JavaScript 脚本，确定性地编排成百上千个 subagent（受官方上限约束：单 run 至多 1000 个、并发至多 16 个），支持流水线、并发、阶段、预算、结构化输出与 JSON Schema 约束，并且可复用、可测试、可分享。**

按官方的描述，动态工作流是一段 JavaScript 脚本，由 Claude 生成，交给 runtime 在后台执行；执行期间会话保持可用，不会被阻塞。它与 Claude Code 的其他扩展机制定位不同：MCP 是连接外部工具的协议，Skills 是注入提示词的知识包，Subagents 是一次性的子任务，Agent Teams 是有状态的协作团队。工作流是一个**全新的、正交的扩展维度**，它把「先做什么、再做什么、哪些并行、哪些串行、结果如何验证」这套**编排逻辑**，从不稳定的提示词中提取出来，移入**确定性的代码**。

例如：

```javascript
const results = await pipeline(
  dimensions,
  d => agent(d.reviewPrompt, { schema: FINDINGS }),
  review => parallel(review.findings.map(f => () =>
    agent(`对抗性验证这条发现：${f.title}`, { schema: VERDICT })
  ))
)
```

`pipeline`、`parallel`、`agent` 都是**真实的函数**，由 JavaScript 运行时执行。哪个阶段先跑、几个 agent 并发、循环在什么条件下退出，全部由代码决定，而非依赖模型的自行判断。`schema` 会强制每个 subagent 的输出**严格匹配** JSON Schema，如果返回的结构不合规，运行时会要求模型**重试**，直到合规为止。

这意味着：**社区此前靠提示词维持的编排纪律，现在可以用代码一次性固化。**

官方要求 **Claude Code v2.1.154 及以上**，所有付费档均可使用（Anthropic API、Amazon Bedrock、Google Cloud Vertex AI、Microsoft Foundry 也覆盖）；Pro 用户需要在 `/config` 中找到 "Dynamic workflows" 一行手动开启。开启后，官方还提供了一个会话级的主动编排挡位 `/effort ultracode`：启用后当前会话默认以工作流方式编排，`/effort high` 恢复默认（详见 [第 01 章 §1.6](#/zh/p1-01)）。本书的目标是帮助你掌握这个能力：不仅会使用官方自带的工作流，还能 [**从零编写自己的工作流**](#/zh/p6-27)。

---

## 这本书是什么，不是什么

**这是一本 Cookbook（实战手册），不是 API 文档。**

「Workflow 工具有哪些参数」这类罗列已经很多。本书要回答的，是更难也更实用的问题：

- **何时**该用 Workflow，何时该用 Subagents / Skills / Agent Teams？（第一部 · 定位矩阵）
- `parallel` 和 `pipeline` 看着都能并发，**到底差在哪**，选错了会额外浪费多少 wall-clock 时间？（第二部 · 基础篇）
- 一个真正能用的「分片代码审查」「PR 多维评审」「Bug 猎手」流水线，**到底长什么样**？（第三部 · 实战食谱）
- 怎么设计「对抗验证」「评委面板」「循环到干」，让结果**可信**，而不只是「看起来对」？（第四部 · 进阶模式）
- 那四个优秀的社区系统，**哪些精华**能用 Workflow 重写成可复用的资产？（第五部 · 生态与借鉴）
- 怎么从零搭一个**属于你自己**的、可复用、可分享的 Workflow 库？（第五部 · 构建你的库）

<div class="callout tip">

每个概念都从「为什么需要它」讲起，先用一个最小可运行的例子建立直觉，再逐步扩展到可上线的配方。不必先通读全部理论。选一个最贴近实际工作的配方，照着跑通，再回头理解原理，同样有效。

</div>

---

## 三个不容妥协的承诺

本书与许多「AI 生成的教程」的根本区别，在于以下三条原则：

**一、真实运行，绝不伪造。** 书里每一段标着「真实运行」的输出，都来自在真实 Claude Code 会话里实际跑 Workflow 得到的原始结果，包括真实的 `taskId`、`runId`、token 用量、耗时和返回值。这些原始记录都存在仓库的 [`assets/transcripts/`](https://github.com/AGI-is-going-to-arrive/workflow-cookbook/tree/main/assets/transcripts) 目录里，你可以逐条核对。凡是没实际跑、只作示意的脚本，都会**明确标注**。

**二、信源对照，绝不臆测。** 所有关于 Workflow API 的说法，都拿三处信源逐字核对过：官方文档 [`code.claude.com/docs/en/workflows`](https://code.claude.com/docs/en/workflows)、Claude Code 官方分发包里的类型定义文件 `sdk-tools.d.ts`（`WorkflowInput` / `WorkflowOutput` 接口），以及运行时的工具定义。凡是涉及环境变量、版本号、功能标志的论断，都经本机实测确认。本书超出官方文档的那些发现（注册表实测只剩 `deep-research`、序列化陷阱、parallel 同步抛错会崩库、worktree 行为等），全部标注了对应的 Run ID，方便你复核。

**三、口径一致，中英对照。** 本书提供完整的中英双语版本，两种语言一一对应、术语统一。你在任意章节点右上角的语言切换，都会跳到同一章的另一语言版本。

---

## 实测环境声明

> 本书所有实测都在以下环境中完成，阅读配方时以此为基准：
>
> | 项 | 值 |
> |---|---|
> | Claude Code 版本 | **v2.1.154+（官方最低）**；本书实测跨 **v2.1.150 → v2.1.156**，核心不变量已在 v2.1.156 复核（见 [`assets/transcripts/examples-r11.md`](https://github.com/AGI-is-going-to-arrive/workflow-cookbook/blob/main/assets/transcripts/examples-r11.md)） |
> | 功能标志 | `CLAUDE_CODE_WORKFLOWS=1`（本会话 `printenv` 实测已确认存在；官方面向用户的入口是 `/config`） |
> | effort 体系 | `/effort` 七挡 `low/medium/high/xhigh/max/ultracode/auto`；**ultracode = xhigh + 主动编排（仅本会话）**；本会话锁在 `CLAUDE_CODE_EFFORT_LEVEL=max` |
> | 主模型 | **Opus 4.8（1M）** |
> | subagent 模型 | **`claude-opus-4-8[1m]`**（由 `CLAUDE_CODE_SUBAGENT_MODEL` 显式指定，`printenv` 实测） |
> | 关联标志 | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` |
> | 实测时间 | 2026 年 5 月（R11 复核） |
>
> 使用工作流前，先确认它在当前会话中**可用**：官方入口是 `/config` 的 "Dynamic workflows" 行（Pro 用户需在此手动开启），power-user 也可以显式设置 `CLAUDE_CODE_WORKFLOWS=1`（详见 [第 01 章 §1.5](#/zh/p1-01)）。不同版本的具体行为（并发上限、预算语义、续传细节）可能会变化。本书会标出关键行为的来源，便于在自己的版本上复核。

---

## 如何阅读

> **赶时间？** 第 01 章建立认知 → 第 04 章跑通第一个 → 第 08 章理解 `parallel` vs `pipeline` → 选一个第三部的配方照着改。
>
> **有经验？** 直接进入第三部「实战食谱」和第四部「进阶模式」，遇到概念缺口再回头查第一、二部。
>
> **想系统掌握？** 从头读到尾，每章动手跑一遍配方，最后在第五部用 Workflow 重写自己工作流中最需要改进的环节。
>
> **想构建属于自己的可复用工作流？** 建议按以下顺序：先用 [第 04 章](#/zh/p2-04) 跑通第一个，再到 [《操作面板》§6](#/zh/p2-ops) 学会按 `s` 保存重跑，接着读 [第 27 章 §27](#/zh/p6-27) 学习从零创作的流程，最后用 [第 25 章 §25](#/zh/p5-25) 将其收进自己的库。
>
> **需要可直接运行的脚本？** 第三、四部的每个配方都是完整的、可直接复制运行的脚本；附录 A 是对照官方类型定义的完整 API 速查。
>
> **只想速查？** [附录 F · 模式目录与场景速查表](#/zh/app-f) 是全书的一页纸总图：先按场景查推荐模式，再点进对应章节查看真实运行。

---

## 致谢与声明

本书的写作受 [御舆 · claude-code-book](https://github.com/lintsinghua/claude-code-book) 启发——该书系统剖析了 Claude Code 的架构，是深入分析 Claude Code 内部机制的先行者。第五部对四个社区系统（`ccg-workflow`、`oh-my-claudecode`、`oh-my-openagent`、`superpowers`）的剖析，都建立在实际阅读其源码的基础上，目的是提取各自的优势，而不是排名高下。

> **声明：** 本书是基于对 Claude Code 公开分发包、类型定义和产品行为的分析写成的，再辅以真实运行来验证。Claude Code 是 Anthropic PBC 的产品；本书不隶属于、未获授权于、也不代表 Anthropic。书中的观点和可能存在的错误，都由作者负责。

<div class="callout info">

下一步：翻到 [第 01 章 · Workflow 是什么](#/zh/p1-01)，从 Workflow 的基本定义开始。

</div>
