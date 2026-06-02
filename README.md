<div align="center">
<br>

# 织经 · Workflow Cookbook

### Claude Code 多 Agent 编排实战手册

*The Orchestration Weave — A Hands-on Guide to Multi-Agent Workflows in Claude Code*

<br>

[![在线阅读](https://img.shields.io/badge/在线阅读-织经-F05C00?style=for-the-badge&logo=bookstack&logoColor=white)](https://agi-is-going-to-arrive.github.io/workflow-cookbook/)

[![README 中文](https://img.shields.io/badge/README-中文-E74C3C?style=flat-square)](README.md) [![README English](https://img.shields.io/badge/README-English-3498DB?style=flat-square)](README.en.md) [![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

**📖 [在线阅读全书](https://agi-is-going-to-arrive.github.io/workflow-cookbook/)** ｜ 从封面开始：[中文](docs/zh/00-preface.md) · [English](docs/en/00-preface.md) ｜ English README → **[README.en.md](README.en.md)**

</div>

---

> **「经之以天，纬之以地。」**（《左传》）
>
> 两千年前，织工以经线为骨、纬线为肉，一梭一梭织就锦缎。经是结构，纵贯始终、不可移易；纬是功能，穿梭其间、变化万千。
>
> 今天，编排 AI Agent 也是这样。`meta` 与 `phase` 是经，是确定性的结构骨架；`agent()` 与 `pipeline()` 是纬，是在骨架中穿梭执行的智能单元。经纬交织，方成流水线。
>
> 当所有人都在手动指挥 Agent，这本书教你让它们自己编队。

---

## 这本书讲什么

**动态工作流（Dynamic workflows）** 是 Claude Code 的一个引擎，让你用一段 JavaScript 脚本**确定性地编排多个 Agent**。你在 `/config` 的 "Dynamic workflows" 这一行把它打开；这个开关底层对应 `CLAUDE_CODE_WORKFLOWS=1` 这个功能标志，power user 也可以直接设它。工具可用之后，从 v2.1.154 起你还能用 `/effort ultracode` 让 Claude 本会话默认主动编排。它和 MCP、Skills、Subagents、Agent Teams 都不是一回事，是一种全新的、**可复用、可测试、可分享**的工程流水线。

本书从零到一覆盖完整路径：先理解工作流在几种扩展机制中的位置，再掌握 `agent()`/`parallel()`/`pipeline()`/`schema` 全部 API，然后实战 7 个真实运行的配方。之后学习对抗验证、循环到干、预算、续传等进阶模式，横评四大社区系统并提取精华，构建属于自己的 Workflow 库，最终掌握从意图到上线的创作、校验与调试全流程。

> **这是一本实战 Cookbook，不是 API 文档。配方都以真实运行为骨：已实跑的附 Run ID 与用量，仅作示意的脚本明确标注。**

<details>
<summary><b>本书数据一览</b></summary>

| 指标 | 数量 |
|------|------|
| 正文章节 | **29 章 + 7 篇附录**（六部 · 认知/基础/食谱/进阶/生态/创作 + 附录 A–G） |
| 全书篇幅 | 中文正文 14 万+ 汉字 ｜ `docs/zh` ↔ `docs/en` **38 篇逐篇对照** |
| 真实 Workflow 运行 | **23 个唯一 Run ID**（R4 基线 17 + R5 应用级 3 + R6 应用级 3；原始记录见 [`assets/transcripts/`](assets/transcripts)） |
| 实测环境 | Claude Code **v2.1.150 – v2.1.160**（核心机制至 v2.1.156，触发词改名于 v2.1.160 复核），`CLAUDE_CODE_WORKFLOWS=1`，Opus 4.7 / 4.8 (1M) |
| 双语 | 中英完全对照，随时切换 |

</details>

> **实测声明：** 本书所有 API 描述均对照 Claude Code 官方分发包的类型定义 `sdk-tools.d.ts`（`WorkflowInput`/`WorkflowOutput`）逐字核对；所有标注「真实运行」的输出，均来自在真实会话中实际执行 Workflow 所得的原始结果，可在 `assets/transcripts/` 逐条溯源。未实跑、仅作示意的脚本均已明确标注。

---

## 在 Claude Code 里跑通第一个 Workflow

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

> **如何运行（重要）**：这是一段 **Workflow 脚本**，不是独立的 Node 脚本。`export`/`meta`/`phase`/`agent`/`log` 都是 Workflow 运行时注入的全局符号。**用 `node hello.js` 运行会立刻报 `phase is not defined`（Windows / macOS 均如此）。** 需要在已开启工作流的 Claude Code 会话中运行。官方入口是 `/config` 的 "Dynamic workflows" 这一行；在 macOS / Linux 上，power user 也可以用 `CLAUDE_CODE_WORKFLOWS=1 claude` 启动，Windows 或需要长期生效则写入 `~/.claude/settings.json` 的 `env`，这种 JSON 写法跨平台。开启之后直接让 Claude 执行脚本，例如在消息中带上 `ultracode` 关键词（如「ultracode 跑这个 workflow」），由 Claude 调用内置的 Workflow 工具运行。
>
> 真实返回（`schema` 强制结构化，`sum` 为整数 `4` 而非字符串）：`{"message":"…","sum":4,"runtimeConfirmed":true}`（Run `wf_dacbd480-d5d`，1 agent / 26,338 token / 5.5s）。

---

## 目录

### 第一部 · 认知篇 — 建立心智模型

| # | 章节 | 关键词 |
|:-:|------|--------|
| 01 | [Workflow 是什么](docs/zh/p1-01-what-is-workflow.md) | 确定性编排引擎 / 异步 taskId / 门控 |
| 02 | [为什么需要确定性编排](docs/zh/p1-02-why-deterministic.md) | 手动多 Agent 的四大痛点 |
| 03 | [定位矩阵：五种扩展机制](docs/zh/p1-03-positioning-matrix.md) | vs Subagents / Agent Teams / Skills / MCP |

### 第二部 · 基础篇 — API 完全指南

| # | 章节 | 关键词 |
|:-:|------|--------|
| 04 | [第一个 Workflow](docs/zh/p2-04-first-workflow.md) | 启动 / 异步回执 / 迭代循环 |
| 05 | [meta 与 phase：经线](docs/zh/p2-05-meta-and-phase.md) | 静态字面量 / 进度分组 |
| 06 | [agent() 完全指南](docs/zh/p2-06-agent-reference.md) | label/schema/model/isolation/agentType |
| 07 | [结构化输出与 Schema](docs/zh/p2-07-structured-output.md) | JSON Schema / 校验重试 |
| 08 | [parallel 屏障 vs pipeline 流水线](docs/zh/p2-08-parallel-vs-pipeline.md) | 最易错的并发抉择 |
| 09 | [进度·日志·续传·预算](docs/zh/p2-09-progress-and-budget.md) | phase/log / resume / budget |

### 第三部 · 实战食谱 — 每篇绑定真实运行

| # | 章节 | 真实运行 |
|:-:|------|--------|
| 10 | [分片代码审查](docs/zh/p3-10-sharded-review.md) | Scan→Review→Verify→Synthesize |
| 11 | [PR 多维 Review](docs/zh/p3-11-pr-review.md) | dogfood 审本书前端，26→16 问题 |
| 12 | [生成-批评-修复 (GCF)](docs/zh/p3-12-gcf-loop.md) | slugify 揪出 10 缺陷 |
| 13 | [深度研究](docs/zh/p3-13-deep-research.md) | 真实检索 + 逐版本核实 |
| 14 | [评委面板](docs/zh/p3-14-judge-panel.md) | 3 评委 3:0 + 主动求证 |
| 15 | [Bug 猎手](docs/zh/p3-15-bug-hunter.md) | 5/5 确认，证伪者纠正猎手 |
| 16 | [文档与迁移大扫除](docs/zh/p3-16-sweep.md) | 只读分析 vs 真实改写 |

### 第四部 · 进阶模式 — 让结果可信

| # | 章节 | 关键词 |
|:-:|------|--------|
| 17 | [对抗验证](docs/zh/p4-17-adversarial.md) | refute-by-default / 计票 |
| 18 | [循环到干与完整性批评](docs/zh/p4-18-loop-until-dry.md) | 未知规模发现 |
| 19 | [Worktree 隔离](docs/zh/p4-19-worktree.md) | 并行改文件防踩踏 |
| 20 | [嵌套 Workflow](docs/zh/p4-20-nested.md) | workflow() 子流程（真实印证） |
| 21 | [动态预算与规模化](docs/zh/p4-21-budget-scaling.md) | budget.total / remaining |
| 22 | [断点续传与缓存](docs/zh/p4-22-resume-caching.md) | 缓存命中 0 token / 8ms（实证） |

### 第五部 · 生态与借鉴

| # | 章节 | 关键词 |
|:-:|------|--------|
| 23 | [四大系统横评](docs/zh/p5-23-four-systems.md) | ccg / superpowers / OMC / OmO |
| 24 | [精华提取术](docs/zh/p5-24-extraction.md) | 解构→抽象→适配→验证 |
| 25 | [构建你自己的 Workflow 库](docs/zh/p5-25-your-library.md) | 具名工作流 / 版本 / 分享 |
| 26 | [反模式与陷阱](docs/zh/p5-26-anti-patterns.md) | 真实反模式清单 |

### 第六部 · 创作篇 — 从意图到上线

| # | 章节 | 关键词 |
|:-:|------|--------|
| 27 | [工作流创作流程](docs/zh/p6-27-authoring.md) | 意图 → meta → 原语 → 校验 → 真跑 |
| 28 | [校验与调试](docs/zh/p6-28-validator-debug.md) | validate-workflow / journal 排错 |
| 29 | [示例画廊](docs/zh/p6-29-gallery.md) | 3 个应用级工作流真跑实录 |

### 附录 Reference

| | 内容 |
|:-:|------|
| [A](docs/zh/app-a-api.md) | **API 完整参考** — 对照官方类型定义 |
| [B](docs/zh/app-b-pitfalls.md) | **陷阱与排错** |
| [C](docs/zh/app-c-best-practices.md) | **最佳实践清单** |
| [D](docs/zh/app-d-glossary.md) | **术语表**（中英对照） |
| [E](docs/zh/app-e-sources.md) | **信源索引** |
| [F](docs/zh/app-f-patterns.md) | **模式目录与场景速查** |

---

## 仓库结构

```
workflow-cookbook/
├─ docs/zh/          # 中文书（纯 Markdown，可在 GitHub 直接阅读）
├─ docs/en/          # 完整英文镜像
├─ assets/
│  └─ transcripts/   # 23 个唯一 Run ID 的原始运行记录（R4 基线 17 + R5 应用级 3 + R6 应用级 3）
├─ index.html        # 配套静态站点（明亮报纸编辑风，客户端渲染 Markdown）
└─ manifest.json     # 站点目录与中英映射
```

文档与网站解耦：`docs/` 是纯 Markdown 的「书」，`index.html` 是渲染层。它零构建，可直接部署到 GitHub Pages。

本地预览：页面运行时通过 `fetch` 加载 `docs/`，直接用 `file://` 打开会被浏览器的同源策略拦截，因此需要从仓库根目录启动一个本地 HTTP 服务器。macOS/Linux 运行 `python3 -m http.server 8000`，Windows 运行 `python -m http.server 8000`，然后打开 `http://localhost:8000`。（或在任意系统上使用 `npx serve`，按其输出的地址打开。）

---

## 致谢

- [Anthropic](https://anthropic.com)：Claude Code 及 Workflow 特性
- [AI 超元域 · Claude Code Workflow 解析](https://www.aivi.fyi/llms/claude-code-workflow)：最早系统解读这一特性的作者之一，本书的最初灵感来源
- [御舆 · claude-code-book](https://github.com/lintsinghua/claude-code-book)：架构深度剖析的先行者
- ccg-workflow / oh-my-claudecode / oh-my-openagent / superpowers：四大优秀社区 Workflow 系统
- [Linux.Do 社区](https://linux.do/)：技术交流与灵感激荡的中文社区

## License

MIT

> **声明：** 本书基于对 Claude Code 公开分发包、类型定义与产品行为的分析编写，并辅以真实运行验证。Claude Code 为 Anthropic PBC 产品；本书不隶属于、未获授权于、也不代表 Anthropic。

<div align="center">
<br>

**[English README](README.en.md)** ｜ **[在线阅读](https://agi-is-going-to-arrive.github.io/workflow-cookbook/)** ｜ *织经 · 经纬交织，方成流水线*

</div>
