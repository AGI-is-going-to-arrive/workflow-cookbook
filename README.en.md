<div align="center">
<br>

# Loom · The Workflow Cookbook

### A Hands-on Guide to Multi-Agent Orchestration in Claude Code

*织经 · Workflow Cookbook — 经纬交织，方成流水线*

<br>

[![Read Online](https://img.shields.io/badge/Read_Online-Loom-F05C00?style=for-the-badge&logo=bookstack&logoColor=white)](https://agi-is-going-to-arrive.github.io/workflow-cookbook/)

[![README English](https://img.shields.io/badge/README-English-3498DB?style=flat-square)](README.en.md) [![README 中文](https://img.shields.io/badge/README-中文-E74C3C?style=flat-square)](README.md) [![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

**📖 [Read the whole book online](https://agi-is-going-to-arrive.github.io/workflow-cookbook/)** ｜ Start from the cover: [English](docs/en/00-preface.md) · [中文](docs/zh/00-preface.md) ｜ 中文 README → **[README.md](README.md)**

</div>

---

> **"Warp it with the heavens, weft it with the earth."** — *Zuo Zhuan* (4th c. BCE)
>
> Two millennia ago, weavers built brocade thread by thread: the **warp** runs lengthwise — the structure, fixed and unmovable; the **weft** shuttles across — the function, ever-changing. Warp and weft interlace, and only then is there cloth.
>
> Orchestrating AI agents is the same: `meta` and `phase` are the warp — the deterministic skeleton; `agent()` and `pipeline()` are the weft — the intelligent units that shuttle through it. Interlace them, and you have a pipeline.
>
> **While everyone else hand-conducts their agents, this book teaches you to make them form up on their own.**

---

## What this book is about

Claude Code's **Workflow** feature (availability controlled by the feature flag `CLAUDE_CODE_WORKFLOWS`; once it's available, from v2.1.154 you can also use `/effort ultracode` to make Claude orchestrate proactively by default for the session) is an engine for **deterministically orchestrating multiple agents** with a JavaScript script. It is not MCP, not Skills, not Subagents, not Agent Teams — it is a new kind of engineering pipeline that is **reusable, testable, and shareable**.

This book takes you from zero to one: understand its essential positioning → master the full `agent()`/`parallel()`/`pipeline()`/`schema` API → work through 7 really-run recipes → unlock advanced patterns like adversarial verification / loop-until-dry / budget / resume → benchmark the four major community systems and extract their essence → build your own Workflow library → and master the full author → validate → debug flow from intent to ship.

> **This is not API documentation — it's a hands-on Cookbook. Approachable, and grounded in real runs: recipes that were actually run carry their Run ID and usage; scripts shown only for illustration are clearly marked.**

<details>
<summary><b>The book at a glance</b></summary>

| Metric | Value |
|------|------|
| Chapters | **29 chapters + 6 appendices** (six parts · Understanding / Foundations / Recipes / Advanced / Ecosystem / Authoring + Appendices A–F) |
| Volume | Chinese source 140k+ Han characters ｜ `docs/zh` ↔ `docs/en` **36 files mirrored one-to-one** |
| Real Workflow runs | **23 unique Run IDs** (R4 baseline 17 + R5 application-level 3 + R6 application-level 3; raw logs in [`assets/transcripts/`](assets/transcripts)) |
| Tested on | Claude Code **v2.1.150 – v2.1.154**, `CLAUDE_CODE_WORKFLOWS=1`, Opus 4.7 / 4.8 (1M) |
| Bilingual | Full zh/en parity, one-click switch |

</details>

> **Verification statement:** Every API description in this book is cross-checked word-for-word against the type definitions (`WorkflowInput`/`WorkflowOutput`) in Claude Code's official distribution package `sdk-tools.d.ts`; every output marked "real run" comes from actually executing a Workflow in a real session, and each is traceable in `assets/transcripts/`. Scripts that were not really run and are shown only for illustration are clearly labeled as such.

---

## Run your first Workflow in Claude Code

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

> **How to run it (important):** this is a **Workflow script**, not a standalone Node script — `export`/`meta`/`phase`/`agent`/`log` are global symbols injected by the Workflow runtime. **Running it with `node hello.js` immediately throws `phase is not defined` (on Windows and macOS alike).** The correct way: inside a Claude Code session with the **feature flag enabled** (macOS / Linux: `CLAUDE_CODE_WORKFLOWS=1 claude`; on Windows, or for a persistent setting, write it into the `env` of `~/.claude/settings.json` — that JSON form is cross-platform), just ask Claude to execute it — e.g. include the keyword `workflow` in your message (like "run this workflow"), and Claude invokes the built-in Workflow tool.
>
> Real return (`schema` forces structure; `sum` is the integer `4`, not a string): `{"message":"…","sum":4,"runtimeConfirmed":true}` (Run `wf_dacbd480-d5d`, 1 agent / 26,338 tokens / 5.5s).

---

## Table of Contents

### Part I · Understanding — Build the mental model

| # | Chapter | Keywords |
|:-:|------|--------|
| 01 | [What Workflow Is](docs/en/p1-01-what-is-workflow.md) | deterministic orchestration engine / async taskId / gating |
| 02 | [Why Deterministic Orchestration](docs/en/p1-02-why-deterministic.md) | the four pains of manual multi-agent |
| 03 | [The Positioning Matrix](docs/en/p1-03-positioning-matrix.md) | vs Subagents / Agent Teams / Skills / MCP |

### Part II · Foundations — The complete API guide

| # | Chapter | Keywords |
|:-:|------|--------|
| 04 | [Your First Workflow](docs/en/p2-04-first-workflow.md) | launch / async receipt / iteration loop |
| 05 | [meta & phase: The Warp](docs/en/p2-05-meta-and-phase.md) | pure literal / progress grouping |
| 06 | [The agent() Reference](docs/en/p2-06-agent-reference.md) | label/schema/model/isolation/agentType |
| 07 | [Structured Output & Schema](docs/en/p2-07-structured-output.md) | JSON Schema / validation retry |
| 08 | [parallel vs pipeline](docs/en/p2-08-parallel-vs-pipeline.md) | the most error-prone concurrency choice |
| 09 | [Progress, Logs, Resume, Budget](docs/en/p2-09-progress-and-budget.md) | phase/log / resume / budget |

### Part III · Recipes — Each bound to a real run

| # | Chapter | Real run |
|:-:|------|--------|
| 10 | [Sharded Code Review](docs/en/p3-10-sharded-review.md) | Scan→Review→Verify→Synthesize |
| 11 | [Multi-Dimension PR Review](docs/en/p3-11-pr-review.md) | dogfood this book's frontend, 26→16 issues |
| 12 | [Generate-Critique-Fix (GCF)](docs/en/p3-12-gcf-loop.md) | slugify caught 10 defects |
| 13 | [Deep Research](docs/en/p3-13-deep-research.md) | real retrieval + version-by-version checking |
| 14 | [Judge Panel](docs/en/p3-14-judge-panel.md) | 3 judges 3:0 + proactive verification |
| 15 | [Bug Hunter](docs/en/p3-15-bug-hunter.md) | 5/5 confirmed, refuters correct the hunter |
| 16 | [Docs & Migration Sweep](docs/en/p3-16-sweep.md) | read-only analysis vs real rewrite |

### Part IV · Advanced Patterns — Make results trustworthy

| # | Chapter | Keywords |
|:-:|------|--------|
| 17 | [Adversarial Verification](docs/en/p4-17-adversarial.md) | refute-by-default / vote counting |
| 18 | [Loop-Until-Dry & Completeness](docs/en/p4-18-loop-until-dry.md) | unknown-size discovery |
| 19 | [Worktree Isolation](docs/en/p4-19-worktree.md) | parallel file edits without clobbering |
| 20 | [Nested Workflows](docs/en/p4-20-nested.md) | workflow() sub-flows (really verified) |
| 21 | [Dynamic Budget & Scaling](docs/en/p4-21-budget-scaling.md) | budget.total / remaining |
| 22 | [Resume & Caching](docs/en/p4-22-resume-caching.md) | cache hit 0 tokens / 8ms (proven) |

### Part V · Ecosystem

| # | Chapter | Keywords |
|:-:|------|--------|
| 23 | [Four Systems Compared](docs/en/p5-23-four-systems.md) | ccg / superpowers / OMC / OmO |
| 24 | [The Art of Extraction](docs/en/p5-24-extraction.md) | deconstruct→abstract→adapt→verify |
| 25 | [Build Your Own Library](docs/en/p5-25-your-library.md) | named workflows / versioning / sharing |
| 26 | [Anti-Patterns](docs/en/p5-26-anti-patterns.md) | a real anti-pattern checklist |

### Part VI · Authoring — From intent to ship

| # | Chapter | Keywords |
|:-:|------|--------|
| 27 | [The Authoring Workflow](docs/en/p6-27-authoring.md) | intent → meta → primitives → validate → real run |
| 28 | [Validation & Debugging](docs/en/p6-28-validator-debug.md) | validate-workflow / journal triage |
| 29 | [Example Gallery](docs/en/p6-29-gallery.md) | 3 application-level real runs, logged |

### Appendices

| | Contents |
|:-:|------|
| [A](docs/en/app-a-api.md) | **API Reference** — cross-checked against official type definitions |
| [B](docs/en/app-b-pitfalls.md) | **Pitfalls & Troubleshooting** |
| [C](docs/en/app-c-best-practices.md) | **Best Practices** |
| [D](docs/en/app-d-glossary.md) | **Glossary** (zh/en) |
| [E](docs/en/app-e-sources.md) | **Sources** |
| [F](docs/en/app-f-patterns.md) | **Pattern Catalog & Scenarios** |

---

## Repository layout

```
workflow-cookbook/
├─ docs/zh/          # Chinese book (plain Markdown, readable directly on GitHub)
├─ docs/en/          # full English mirror
├─ assets/
│  └─ transcripts/   # raw logs for 23 unique Run IDs (R4 baseline 17 + R5 application-level 3 + R6 application-level 3)
├─ index.html        # companion static site (Bright Editorial / Newspaper theme, client-side Markdown)
└─ manifest.json     # site table of contents and zh/en mapping
```

Docs and site are decoupled: `docs/` is the "book" in plain Markdown; `index.html` is the rendering layer — zero build, deployable straight to GitHub Pages.

---

## Acknowledgements

- [Anthropic](https://anthropic.com) — Claude Code and the Workflow feature
- [AI Superdomain · Claude Code Workflow Analysis](https://www.aivi.fyi/llms/claude-code-workflow) — among the first to systematically explain this feature; the original inspiration for this book
- [Yuyu · claude-code-book](https://github.com/lintsinghua/claude-code-book) — a pioneer in deep architectural analysis
- ccg-workflow / oh-my-claudecode / oh-my-openagent / superpowers — four excellent community Workflow systems
- [Linux.Do community](https://linux.do/) — a Chinese community for technical exchange and inspiration

## License

MIT

> **Disclaimer:** This book is written based on analysis of Claude Code's public distribution package, type definitions, and product behavior, supplemented by real-run verification. Claude Code is a product of Anthropic PBC; this book is not affiliated with, authorized by, or representative of Anthropic.

<div align="center">
<br>

**[中文 README](README.md)** ｜ **[Read Online](https://agi-is-going-to-arrive.github.io/workflow-cookbook/)** ｜ *Loom · warp and weft, interlaced into a pipeline*

</div>
