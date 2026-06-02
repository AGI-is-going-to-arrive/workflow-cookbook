# Preface: Between Warp and Weft

> **"Warp it with the heavens, weft it with the earth."** — *Zuo Zhuan*, 28th Year of Duke Zhao
>
> Two thousand years ago, weavers made the warp the bone and the weft the flesh, throwing the shuttle pass after pass to weave brocade. The warp is structure, running end to end, drawn taut and unmoving; the weft is function, shuttling between, ever-changing. The warp fixes the form, the weft makes the splendor, and only when warp and weft interlace does a bolt of cloth come into being.
>
> Today, orchestrating AI agents is the same craft. `meta` and `phase` are the **warp**: a deterministic structural skeleton, pre-tensioned and immovable. `agent()`, `parallel()`, and `pipeline()` are the **weft**: the intelligent units that shuttle through that skeleton and execute. The warp decides the shape of the pipeline; the weft fills in the real work.
>
> This is why the book is named **Loom**.

---

## When Everyone Is "Directing" Agents

Over the past two years, we learned to **use** AI agents: write good prompts, wire up the right tools, spin up a few subtasks to run in parallel. The community produced a number of capable workflow systems, including `oh-my-claudecode`, `superpowers`, `oh-my-openagent`, and `ccg-workflow`, each with its own approach, organizing a single agent into a coordinated team.

But examine their implementations and you find a shared truth: **these systems all orchestrate by "praying" through prompts.**

They write the orchestration logic in Markdown and try to constrain a **probabilistic** language model by repeatedly emphasizing in the prompt "⛔ you MUST do A before B" and "never skip verification." They use lifecycle hooks to insert "breadcrumbs" into every turn, reminding the agent "task not yet complete, continue execution." They persist progress to JSON state files, because the moment the context gets compacted, the agent loses its execution state.

These techniques are clever, and they work. But fundamentally they rely on **natural language** and **runtime patches** to simulate something that should be guaranteed by **code**: **deterministic control flow.**

> The reason is straightforward: for a long time, Claude Code provided no native way to "orchestrate agents with code."
>
> Now it officially does.

---

## A Real Comparison First

Same job, done two ways, with a workflow and without. Here are the measured results.

The job: fact-check 6 chapters of this book. For each chapter, find the single most important problem, then check whether that finding is a real issue or a false positive. That is 12 subagents of work, 6 reviews plus 6 verifications.

Without a workflow, the process requires spinning up 6 subagents to review in parallel, waiting for all of them, reading through the results, then spinning up 6 more to verify. With a workflow, a short `pipeline` script handles this: each chapter proceeds to verification the moment its review finishes, and the run returns one structured result. Both approaches were actually run on v2.1.156; the Run IDs are at the end of this section.

> **The two runs:** the workflow run `wf_6fc26e37-02d` (`pipeline`) and the manual run `wf_372d53bf-419` (two `parallel` barriers standing in for doing it by hand); 12 agents each, measured locally on v2.1.156. The manual run already assumes the fastest by-hand case, so real by-hand work would only run slower. Full data in [`assets/transcripts/examples-r14.md`](https://github.com/AGI-is-going-to-arrive/workflow-cookbook/blob/main/assets/transcripts/examples-r14.md).

| Look here | Without a workflow | With a workflow (`pipeline`) |
|---|---|---|
| What lands in your main conversation | **47,080** characters, 12 full review write-ups | **357** characters, one structured result |
| Whether anything slips | Relies on human and model memory to track progress; items can be missed or skipped | Code counts off all 12, `schema` forces clean structure, and verification caught 1 false positive |

The first row is the key figure: for the same workload, the content returning to the main conversation differs by **a factor of 132**. The context window is the scarcest resource. Once those tens of thousands of characters of review text enter the main conversation, they remain there and are reprocessed on every subsequent turn, with token consumption increasing accordingly. With a workflow, the raw work stays in the sandbox and only the conclusion reaches the main conversation.

Speed is essentially the same, about 4 minutes either way, so speed alone is not a reason to choose a workflow. The time advantage comes from longer, multi-stage pipelines (see [Chapter 8](#/en/p2-08)).

---

<div class="callout info">

**Two layers of truth in this book (read this first)**

This book covers two layers. They come from different places, so keep them straight:

1. **How to use it (the user's view):** anchored to the official docs at `code.claude.com/docs/en/workflows`, covering how to trigger a workflow, approve it, save and rerun it, turn it on and off, and what the limits are. The official docs spell all of this out.
2. **What's actually in the script (the engine room):** the orchestration API of `agent()`, `parallel()`, `pipeline()`, `phase()`, `meta`, and `schema`. **The official public docs don't document this layer.** It exists and it runs (this book proves it with 40+ real run records, each tagged with a Run ID), but it comes from Claude Code's runtime contract and our own testing, not from the official docs.

Why cover the second layer at all? The official way to use workflows is "you describe the task, Claude writes the script," so you never write it by hand. But to read what Claude wrote, tweak it, and build a reusable library of your own, you need this API. That is what this book is for.

One caveat: dynamic workflows are a research preview, so these script-layer details can change without notice. Everywhere this book covers the script layer, it flags the content as "verified by testing, not officially documented." Before you rely on it in production, run it yourself to confirm.

</div>

## Dynamic Workflows: The Deterministic Orchestration Engine

Claude Code has shipped a capability called **Dynamic workflows**, in **research preview**, with the docs formally published at [`code.claude.com/docs/en/workflows`](https://code.claude.com/docs/en/workflows). In one sentence:

> **Use a single pure-JavaScript script to deterministically orchestrate hundreds of subagents (within the official caps: up to 1,000 per run, up to 16 concurrent), with support for pipelines, concurrency, phases, budgets, structured output, and JSON Schema constraints, and it's reusable, testable, and shareable.**

In the official framing, a dynamic workflow is a JavaScript script that Claude writes for you, and a runtime executes it in the background while your session stays responsive. It sits apart from Claude Code's other extension mechanisms: MCP is a protocol for connecting external tools, Skills are knowledge packs injected into prompts, Subagents are one-off subtasks, and Agent Teams are a stateful collaborating team. A workflow is a **new, orthogonal dimension of extension**. It pulls the **orchestration logic** (what to do first, what next, what runs in parallel, what runs serially, how to verify the results) out of slippery prompts and moves it into **deterministic code**.

For example:

```javascript
const results = await pipeline(
  dimensions,
  d => agent(d.reviewPrompt, { schema: FINDINGS }),
  review => parallel(review.findings.map(f => () =>
    agent(`Adversarially verify this finding: ${f.title}`, { schema: VERDICT })
  ))
)
```

`pipeline`, `parallel`, and `agent` are all **real functions**, executed deterministically by the JavaScript runtime. Code decides which phase runs first, how many agents run concurrently, and what condition the loop exits on, without depending on the model to self-direct. `schema` forces each subagent's output to **strictly match** a JSON Schema; if the model returns a non-conforming structure, the runtime requires it to **retry** until it conforms.

This means: **the orchestration discipline the community previously maintained through prompts can now be permanently fixed in code.**

Claude Code requires **v2.1.154 or later**, and every paid plan can use it (Anthropic API, Amazon Bedrock, Google Cloud Vertex AI, and Microsoft Foundry are all covered); Pro users turn it on from the "Dynamic workflows" row in `/config`. Once enabled, Claude Code also gives you a session-level effort tier that activates proactive orchestration, `/effort ultracode`: with it on, Claude orchestrates a workflow by default for the current session, and `/effort high` reverts it (see [Chapter 01 §1.6](#/en/p1-01)). This book aims to help you **fully master** this capability: not just using the built-in workflows, but learning to [**write your own from scratch**](#/en/p6-27).

---

## What This Book Is, and Isn't

**This is a Cookbook, not API documentation.**

There are already many "here are the Workflow tool's parameters" listings available. This book tackles the harder, more practical questions:

- **When** should you reach for Workflow, and when for Subagents / Skills / Agent Teams? (Part I · The Positioning Matrix)
- `parallel` and `pipeline` both seem to run things concurrently, so **what exactly is the difference**, and how much wall-clock time do you burn by picking wrong? (Part II · Foundations)
- What does a genuinely usable "sharded code review," "multi-dimension PR review," or "bug hunter" pipeline **actually look like**? (Part III · Recipes)
- How do you design "adversarial verification," "judge panels," and "loop-until-dry" so the results are **trustworthy** and not just "looks right"? (Part IV · Advanced Patterns)
- Of those four excellent community systems, **which gems** can you rewrite as reusable assets with Workflow? (Part V · Ecosystem)
- How do you build your **own** reusable, shareable Workflow library from scratch? (Part V · Build Your Own Library)

<div class="callout tip">

Every concept starts from "why you need it," builds intuition with a minimal runnable example, then layers up to recipes you can ship. You don't have to grasp all the theory first. Pick the recipe closest to your work, get it running, then come back for the principles. That works just as well.

</div>

---

## Three Non-Negotiable Promises

The fundamental difference between this book and the many "AI-generated tutorials" lies in three principles:

**One: Real runs, never fabricated.** Every output in this book marked "real run" comes from actually running a Workflow in a real Claude Code session, including the real `taskId`, `runId`, token usage, duration, and return value. These raw records live in the repository's [`assets/transcripts/`](https://github.com/AGI-is-going-to-arrive/workflow-cookbook/tree/main/assets/transcripts) directory, and you can check them line by line. Any script that was not actually run and serves only as illustration is **clearly marked**.

**Two: Cross-checked against sources, never guessed.** Every description of the Workflow API has been checked word-for-word against three sources: the official docs at [`code.claude.com/docs/en/workflows`](https://code.claude.com/docs/en/workflows), the type-definition file `sdk-tools.d.ts` (the `WorkflowInput` / `WorkflowOutput` interfaces) in Claude Code's official distribution, and the runtime tool definition. Every claim about environment variables, version numbers, or feature flags has been confirmed by testing on the local machine. The findings in this book that go beyond the official docs (the registry tested down to just `deep-research`, the serialization trap, the `parallel` sync-throw that crashes the run, worktree behavior, and so on) all carry their corresponding Run IDs so you can re-verify them.

**Three: Consistent across languages, side by side.** This book ships a full bilingual edition in Chinese and English, the two corresponding one-to-one with unified terminology. Click the language switch in the top-right of any chapter and you land on the other-language version of the same chapter.

---

## Test Environment Declaration

> All testing in this book was done in the environment below; use it as your baseline when you read the recipes:
>
> | Item | Value |
> |---|---|
> | Claude Code version | **v2.1.154+ (official minimum)**; this book tested across **v2.1.150 → v2.1.156**, with the core invariants re-verified on v2.1.156 (see [`assets/transcripts/examples-r11.md`](https://github.com/AGI-is-going-to-arrive/workflow-cookbook/blob/main/assets/transcripts/examples-r11.md)); the trigger-keyword rename (`workflow`→`ultracode`) was re-checked on **v2.1.160** (R16) |
> | Feature flag | `CLAUDE_CODE_WORKFLOWS=1` (confirmed present this session via `printenv`; the official user-facing entry is `/config`) |
> | effort system | `/effort`'s seven settings `low/medium/high/xhigh/max/ultracode/auto`; **ultracode = xhigh + proactive orchestration (this session only)**; this session is locked at `CLAUDE_CODE_EFFORT_LEVEL=max` |
> | Main model | **Opus 4.8 (1M context)** |
> | Subagent model | **`claude-opus-4-8[1m]`** (explicitly set by `CLAUDE_CODE_SUBAGENT_MODEL`, confirmed via `printenv`) |
> | Related flag | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` |
> | Test date | May 2026 (R11 re-verification) |
>
> Before using a workflow, first make sure it is **available** in your session: the official user-facing entry is the "Dynamic workflows" row in `/config` (Pro users must turn it on there), and power users can also set `CLAUDE_CODE_WORKFLOWS=1` explicitly (see [Chapter 01 §1.5](#/en/p1-01)). Specific behavior across versions (concurrency limits, budget semantics, resume details) may evolve. The book marks the source of key behaviors so you can re-verify them on your own version.

---

## How to Read

> **In a hurry?** Chapter 01 to build the mental model → Chapter 04 to get your first one running → Chapter 08 to understand `parallel` vs `pipeline` → pick a recipe from Part III and adapt it.
>
> **Experienced?** Go straight to Part III "Recipes" and Part IV "Advanced Patterns"; circle back to Parts I and II when you encounter a conceptual gap.
>
> **Want to master it systematically?** Front to back: run a recipe in every chapter, and in Part V rewrite the step in your own workflow that most needs improvement.
>
> **Want to build your own reusable workflow?** Recommended order: get your first one running with [Chapter 04](#/en/p2-04), learn to press `s` to save and rerun in [The Control Panel §6](#/en/p2-ops), study the from-scratch authoring process in [Chapter 27 §27](#/en/p6-27), then settle it into your own library with [Chapter 25 §25](#/en/p5-25).
>
> **Need ready-to-run scripts?** Every recipe in Parts III and IV is a complete, copy-paste-runnable script; Appendix A is a full API quick reference cross-checked against the official type definitions.
>
> **Just want the cheat-sheet?** [Appendix F · Pattern Catalog & Scenarios](#/en/app-f) is the book's one-page map: look up your scenario → recommended pattern → jump to the chapter with the real run.

---

## Acknowledgments and Disclaimer

This book was inspired by [Yu Yu · claude-code-book](https://github.com/lintsinghua/claude-code-book), which systematically dissects the architecture of Claude Code and pioneered the in-depth analysis of Claude Code's internals. Part V's analysis of the four community systems (`ccg-workflow`, `oh-my-claudecode`, `oh-my-openagent`, `superpowers`) rests on a genuine reading of their source code, aiming to extract the strengths of each rather than to rank them.

> **Disclaimer:** This book is written from an analysis of Claude Code's public distribution, type definitions, and product behavior, backed by real-run verification. Claude Code is a product of Anthropic PBC; this book is not affiliated with, authorized by, or representative of Anthropic. The views herein, and any errors, are the author's responsibility.

<div class="callout info">

Next: turn to [Chapter 01 · What Workflow Is](#/en/p1-01), starting from the basic definition of Workflow.

</div>
