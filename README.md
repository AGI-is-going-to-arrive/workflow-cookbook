<div align="center">
<br>

# 织经 · Workflow Cookbook

### Claude Code 多 Agent 编排实战手册

*The Orchestration Weave — A Hands-on Guide to Multi-Agent Workflows in Claude Code*

<br>

[![Read Online](https://img.shields.io/badge/Read_Online-织经-C8952E?style=for-the-badge&logo=bookstack&logoColor=white)](https://8bit-echo.github.io/workflow-cookbook/)
[![中文](https://img.shields.io/badge/语言-中文-E74C3C?style=flat-square)](#目录)
[![English](https://img.shields.io/badge/Language-English-3498DB?style=flat-square)](#table-of-contents)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

</div>

---

> **"经之以天，纬之以地。"** ——《左传》
>
> 两千年前，织工以经线为骨、纬线为肉，一梭一梭织就锦缎。经是结构——纵贯始终、不可移易；纬是功能——穿梭其间、变化万千。
>
> 今天，编排 AI Agent 亦如此：`meta` 与 `phase` 是经——确定性的结构骨架；`agent()` 与 `pipeline()` 是纬——在骨架中穿梭执行的智能单元。经纬交织，方成流水线。
>
> **当所有人都在手动指挥 Agent——这本书教你让它们自己编队。**

---

## 这本书讲什么

Claude Code 的 **Workflow** 特性是一个用 JavaScript 脚本化编排多 Agent 的确定性引擎。它不是 MCP，不是 Skills，不是 Subagents，更不是 Agent Teams——它是一种全新的、**可复用、可测试、可共享**的工程流水线。

> **实测环境**：Claude Code v2.1.148+，Opus 4.6/4.7 (1M context)，2026 年 5 月。Workflow 功能需通过 `CLAUDE_CODE_WORKFLOWS=1` 环境变量显式启用（在 `~/.claude/settings.json` 的 `env` 中设置，或启动时 `CLAUDE_CODE_WORKFLOWS=1 claude`）。本书所有 API 描述和示例均基于真实运行验证。

本书从零到一带你：

- 理解 Workflow 的本质定位与核心概念
- 掌握 `agent()` / `parallel()` / `pipeline()` / `schema` 等全部 API
- 实战 6 个完整 Recipe（代码审查、PR Review、深度研究、Bug 猎手……）
- 解锁进阶模式（预算控制、断点续传、Worktree 隔离、嵌套 Workflow）
- 横评 4 大优秀 Workflow 系统，提取可复用的精华模式
- 从零构建属于你自己的可复用 Workflow 库

**每个 Recipe 均在 Claude Code 中实测运行，附带真实输出。**

---

## 目录

### Part 1 · 认知篇 Understanding

| # | 章节 | 关键词 |
|---|------|--------|
| 01 | [Workflow 是什么](#ch01) | 确定性编排引擎 |
| 02 | [核心概念全景图](#ch02) | meta / phase / agent / parallel / pipeline / schema |
| 03 | [定位矩阵](#ch03) | Workflow vs Subagents vs Agent Teams vs Skills |

### Part 2 · 基础篇 Foundations

| # | 章节 | 关键词 |
|---|------|--------|
| 04 | [环境搭建 & Hello Workflow](#ch04) | 第一个 Workflow / smoke test |
| 05 | [agent() 完全指南](#ch05) | prompt / schema / model / isolation / agentType |
| 06 | [并发编排双刃剑](#ch06) | parallel() 屏障 vs pipeline() 流水线 |
| 07 | [结构化输出](#ch07) | JSON Schema / 数据流传递 |
| 08 | [进度监控与调试](#ch08) | phase() / log() / /workflows |

### Part 3 · 实战食谱 Recipes

| # | 章节 | 关键词 |
|---|------|--------|
| 09 | [分片代码审查](#ch09) | 大代码库分治 + 对抗验证 |
| 10 | [PR 多角色 Review](#ch10) | 安全 / 性能 / 架构多维度 |
| 11 | [生成-批评-修复 (GCF Loop)](#ch11) | 循环退出条件设计 |
| 12 | [深度研究](#ch12) | 多源搜索 + 交叉验证 |
| 13 | [Prompt/Agent 评估](#ch13) | A/B 测试 + 评委面板 |
| 14 | [Bug 猎手](#ch14) | 自繁殖发现池 + 对抗验证 |

### Part 4 · 进阶篇 Advanced Patterns

| # | 章节 | 关键词 |
|---|------|--------|
| 15 | [预算控制与动态循环](#ch15) | budget.total / remaining / loop |
| 16 | [断点续传](#ch16) | resumeFromRunId / 缓存命中 |
| 17 | [Worktree 隔离](#ch17) | 并行文件修改 |
| 18 | [嵌套 Workflow](#ch18) | workflow() 子流程 |
| 19 | [质量模式合集](#ch19) | 对抗验证 / 评委面板 / 循环到干 |

### Part 5 · 生态篇 Ecosystem

| # | 章节 | 关键词 |
|---|------|--------|
| 20 | [四大 Workflow 系统横评](#ch20) | ccg / OMC / OmO / Superpowers |
| 21 | [精华提取术](#ch21) | 解构 → 抽象 → 适配 → 验证 |
| 22 | [构建你的 Workflow 库](#ch22) | 目录结构 / 命名 / 版本管理 |

### 附录 Reference

| # | 内容 |
|---|------|
| A | [API 完整参考](#appA) |
| B | [常见问题与陷阱](#appB) |
| C | [最佳实践清单](#appC) |
| D | [术语表](#appD) |

---

## 四大 Workflow 系统速览

本书第 20 章深度横评了 4 个优秀的 Workflow 系统，并从中提取可复用模式：

| 系统 | 核心理念 | 独创模式 |
|------|---------|---------|
| [ccg-workflow](https://github.com/fengshao1227/ccg-workflow) | 多模型交叉验证 (Claude + Codex + Gemini) | 10 策略状态机 / Loop 检测 / Spec 演进 |
| [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) | 技能可嵌套组合 (autopilot ⊃ ralph ⊃ ultrawork) | 数学模糊度门控 / 三模型顾问 |
| [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) | 类别 > 模型名 / 人类干预是失败信号 | Hashline LINE#ID / 对抗规划 (Hyperplan) |
| [superpowers](https://github.com/obra/superpowers) | 方法论即插件 / 零依赖跨平台 | 技能即 TDD 测试 / 反理性化工程 / CSO |

---

## 快速开始

在 Claude Code 中运行你的第一个 Workflow：

```javascript
// 1. 在 Claude Code 对话中输入 "ultrawork" 关键词触发
// 2. 或直接使用 Workflow 工具

export const meta = {
  name: 'hello-workflow',
  description: 'My first workflow',
  phases: [
    { title: 'Greet', detail: 'Say hello from a subagent' },
  ],
}

phase('Greet')
const result = await agent('Say hello and confirm the workflow is working.', {
  label: 'greeter',
  schema: {
    type: 'object',
    properties: {
      message: { type: 'string' },
      working: { type: 'boolean' },
    },
    required: ['message', 'working'],
  },
})

log(`Result: ${result.message} (working: ${result.working})`)
return result
```

---

## 技术细节

- 所有 Recipe 均在 Claude Code (Opus 4.6+) 中实测
- 网站使用纯 HTML/CSS/JS（无构建步骤），部署在 GitHub Pages
- 中英文完全对照，一键切换
- 代码示例可直接复制运行

## 致谢

- [Anthropic](https://anthropic.com) — Claude Code 及 Workflow 特性
- [御舆 (claude-code-book)](https://github.com/lintsinghua/claude-code-book) — 架构深度剖析的先行者
- [AI 超元域](https://www.aivi.fyi/llms/claude-code-workflow) — Workflow 特性的早期解读
- ccg-workflow / oh-my-claudecode / oh-my-openagent / superpowers — 四大优秀 Workflow 系统

## License

MIT

---

<div align="center">

**[English Version](docs/en/README.md)**

<br>

*织经 · Workflow Cookbook — 经纬交织，方成流水线*

</div>
