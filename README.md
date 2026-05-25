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

> **「经之以天，纬之以地。」** ——《左传》
>
> 两千年前，织工以经线为骨、纬线为肉，一梭一梭织就锦缎。经是结构——纵贯始终、不可移易；纬是功能——穿梭其间、变化万千。
>
> 今天，编排 AI Agent 亦如此：`meta` 与 `phase` 是经——确定性的结构骨架；`agent()` 与 `pipeline()` 是纬——在骨架中穿梭执行的智能单元。经纬交织，方成流水线。
>
> **当所有人都在手动指挥 Agent——这本书教你让它们自己编队。**

---

## 这本书讲什么

Claude Code 的 **Workflow** 特性（功能标志 `CLAUDE_CODE_WORKFLOWS`，社区昵称 *ultrawork*）是一个用 JavaScript 脚本**确定性编排多 Agent** 的引擎。它不是 MCP，不是 Skills，不是 Subagents，也不是 Agent Teams——而是一种全新的、**可复用、可测试、可分享**的工程流水线。

本书从零到一带你：理解它的本质定位 → 掌握 `agent()`/`parallel()`/`pipeline()`/`schema` 全部 API → 实战 7 个真实运行的配方 → 解锁对抗验证 / 循环到干 / 预算 / 续传等进阶模式 → 横评四大社区系统并提取精华 → 构建属于你自己的 Workflow 库 → 掌握从意图到上线的创作、校验与调试全流程。

> **这不是 API 文档，是一本实战 Cookbook。深入浅出，每个配方都在 Claude Code 中真实跑过。**

<details>
<summary><b>本书数据一览</b></summary>

| 指标 | 数量 |
|------|------|
| 正文章节 | **29 章 + 6 篇附录**（六部 · 认知/基础/食谱/进阶/生态/创作 + 附录 A–F） |
| 全书篇幅 | 中文正文 14 万+ 汉字 ｜ `docs/zh` ↔ `docs/en` **36 篇逐篇对照** |
| 真实 Workflow 运行 | **20 个唯一 Run ID**（R4 基线 17 + R5 应用级 3；原始记录见 [`assets/transcripts/`](assets/transcripts)） |
| 实测环境 | Claude Code **v2.1.150**，`CLAUDE_CODE_WORKFLOWS=1`，Opus 4.7 (1M) |
| 双语 | 中英完全对照，一键切换 |

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

> **如何运行（重要）**：这是一段 **Workflow 脚本**，不是独立的 Node 脚本——`export`/`meta`/`phase`/`agent`/`log` 都是 Workflow 运行时注入的全局符号。**用 `node hello.js` 跑会立刻报 `phase is not defined`（Windows / macOS 皆然）。** 正确方式：在**已开启功能标志**的 Claude Code 会话里（`CLAUDE_CODE_WORKFLOWS=1 claude`，或写入 `~/.claude/settings.json` 的 `env`），直接让 Claude 执行它——例如对它说「ultrawork：跑这个工作流」，由 Claude 调用内置的 Workflow 工具运行。
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
| 05 | [meta 与 phase：经线](docs/zh/p2-05-meta-and-phase.md) | 纯字面量 / 进度分组 |
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
│  └─ transcripts/   # 20 个唯一 Run ID 的原始运行记录（R4 基线 17 + R5 应用级 3）
├─ index.html        # 配套静态站点（明亮报纸编辑风，客户端渲染 Markdown）
└─ manifest.json     # 站点目录与中英映射
```

文档与网站解耦：`docs/` 是纯 Markdown 的「书」，`index.html` 是渲染层——零构建，可直接部署到 GitHub Pages。

---

## 致谢

- [Anthropic](https://anthropic.com) — Claude Code 及 Workflow 特性
- [AI 超元域 · Claude Code Workflow 解析](https://www.aivi.fyi/llms/claude-code-workflow) — 最早系统解读这一特性的作者之一，本书的最初灵感来源
- [御舆 · claude-code-book](https://github.com/lintsinghua/claude-code-book) — 架构深度剖析的先行者
- ccg-workflow / oh-my-claudecode / oh-my-openagent / superpowers — 四大优秀社区 Workflow 系统
- [Linux.Do 社区](https://linux.do/) — 技术交流与灵感激荡的中文社区

## License

MIT

> **声明：** 本书基于对 Claude Code 公开分发包、类型定义与产品行为的分析编写，并辅以真实运行验证。Claude Code 为 Anthropic PBC 产品；本书不隶属于、未获授权于、也不代表 Anthropic。

<div align="center">
<br>

**[English README](README.en.md)** ｜ **[在线阅读](https://agi-is-going-to-arrive.github.io/workflow-cookbook/)** ｜ *织经 · 经纬交织，方成流水线*

</div>
