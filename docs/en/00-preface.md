# Preface: Between Warp and Weft

> **"Warp it with the heavens, weft it with the earth."** — *Zuo Zhuan*, 28th Year of Duke Zhao
>
> Two thousand years ago, weavers made the warp the bone and the weft the flesh, throwing the shuttle pass after pass to weave brocade. The warp is structure — running end to end, drawn taut and unmoving; the weft is function — shuttling between, ever-changing. The warp fixes the form, the weft makes the splendor; only when warp and weft interlace does a bolt of cloth come into being.
>
> Today, orchestrating AI agents is no different: `meta` and `phase` are the **warp** — a deterministic structural skeleton, pre-tensioned and immovable; `agent()`, `parallel()`, and `pipeline()` are the **weft** — the intelligent units that shuttle through that skeleton and execute. The warp decides the shape of the pipeline; the weft fills in the real work.
>
> This is why the book is named **Loom**.

---

## When Everyone Is "Directing" Agents

Over the past two years, we have learned to **use** AI agents: write good prompts, wire up the right tools, spin up a few subtasks to run in parallel. The community has produced a wealth of excellent workflow systems — `oh-my-claudecode`, `superpowers`, `oh-my-openagent`, `ccg-workflow` — each with its own tricks, drilling a single agent into a well-trained team.

But if you pop the hood on any of them, you find a shared, slightly awkward truth: **these systems all orchestrate by "praying" through prompts.**

They write the orchestration logic in Markdown, and constrain a **probabilistic** language model by hammering home in the prompt "⛔ you MUST do A before B" and "never skip verification"; they use lifecycle hooks to inject "breadcrumbs" into every turn, reminding the agent "you're not done yet, go back and finish"; they persist progress to JSON state files, because the moment the context is compacted, the agent forgets what it was doing.

These techniques are clever, and they work — but in essence they use **natural language** and **runtime patches** to simulate something that should be guaranteed by **code**: **deterministic control flow.**

> They did this because, for a long time, Claude Code offered no native ability to "orchestrate agents with code."
>
> Now it does.

---

## CLAUDE_CODE_WORKFLOWS: The Deterministic Engine Quietly Added

Behind the feature flag `CLAUDE_CODE_WORKFLOWS`, Claude Code hides a built-in tool called **Workflow**. What it does, in one sentence:

> **Use a single pure-JavaScript script to deterministically orchestrate any number of subagents — with support for pipelines, concurrency, phases, budgets, structured output, and JSON Schema constraints — reusable, testable, and shareable.**

This is not MCP (a protocol for connecting external tools), not Skills (knowledge packs that inject prompts), not Subagents (one-off subtasks), and not Agent Teams (a stateful collaborating team). It is a **brand-new, orthogonal dimension of extension**: it takes the **orchestration logic** — what to do first, what next, what runs in parallel, what runs serially, how to verify the results — out of flighty prompts and moves it into **deterministic code**.

When you write:

```javascript
const results = await pipeline(
  dimensions,
  d => agent(d.reviewPrompt, { schema: FINDINGS }),
  review => parallel(review.findings.map(f => () =>
    agent(`Adversarially verify this finding: ${f.title}`, { schema: VERDICT })
  ))
)
```

`pipeline`, `parallel`, and `agent` are all **real functions**, executed **deterministically** by the JavaScript runtime. Which phase runs first, how many agents run concurrently, what condition the loop exits on — all of it is decided by code, no longer reliant on the model's "good intentions." And `schema` forces each subagent's output to **strictly match** a JSON Schema; if the model returns a non-conforming structure, the runtime makes it **retry** until it conforms.

This means: **the orchestration discipline the community painstakingly maintains through prompts can now be welded shut, once and for all, in code.**

---

## What This Book Is, and Isn't

**This is a Cookbook, not API documentation.**

There is no shortage of "here are the Workflow tool's parameters" listings out there. This book answers the harder, more useful questions:

- **When** should you use Workflow, and when Subagents / Skills / Agent Teams? (Part I · The Positioning Matrix)
- `parallel` and `pipeline` both seem to run things concurrently — **what exactly is the difference**, and how much wall-clock time do you waste by choosing wrong? (Part II · Foundations)
- What does a genuinely usable "sharded code review," "multi-dimension PR review," or "bug hunter" pipeline **actually look like**? (Part III · Recipes)
- How do you design "adversarial verification," "judge panels," and "loop-until-dry" so the results are **trustworthy** and not merely "looks right"? (Part IV · Advanced Patterns)
- Of those four excellent community systems, **which gems** can be rewritten as reusable assets with Workflow? (Part V · Ecosystem)
- How do you build, from scratch, your **own** reusable, shareable Workflow library? (Part V · Build Your Own Library)

<div class="callout tip">

**Depth made accessible** is this book's creed. Every concept starts from "why you need it," builds intuition with a minimal runnable example, then layers up to production-grade recipes. You don't need to grasp all the theory first — pick the recipe closest to your work, get it running, then come back to understand the principles. That works just as well.

</div>

---

## Three Non-Negotiable Promises

What sets this book apart from the many "tutorials written by AI" comes down to three iron laws:

**One: Real runs, never fabricated.** Every output in this book marked "real run" comes from actually executing a Workflow in a real Claude Code session — including the real `taskId`, `runId`, token usage, duration, and return value. These raw records are kept in the repository's [`assets/transcripts/`](https://github.com/AGI-is-going-to-arrive/workflow-cookbook/tree/main/assets/transcripts) directory and can be checked line by line. Any script that was not actually run, and serves only as illustration, is **clearly marked**.

**Two: Cross-checked against sources, never guessed.** Every description of the Workflow API is checked word-for-word against the type-definition file `sdk-tools.d.ts` (the `WorkflowInput` / `WorkflowOutput` interfaces) in Claude Code's official distribution, and against the runtime tool definition. Claims about environment variables, version numbers, and feature flags are all confirmed by testing on the local machine.

**Three: Consistent across languages, side by side.** This book provides a complete bilingual edition in Chinese and English, with the two corresponding one-to-one and a unified terminology. Click the language switch in the top-right of any chapter and you'll jump to the other-language version of the same chapter.

---

## Test Environment Declaration

> All testing in this book was done in the following environment; please use it as your baseline when reading the recipes:
>
> | Item | Value |
> |---|---|
> | Claude Code version | **v2.1.150** (native binary) |
> | Feature flag | `CLAUDE_CODE_WORKFLOWS=1` (confirmed present in the session environment) |
> | Main model | Opus 4.7 (1M context) |
> | Subagent model | `claude-opus-4-7[1m]` (set by `CLAUDE_CODE_SUBAGENT_MODEL`) |
> | Related flag | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` |
> | Test date | May 2026 |
>
> Workflow is still an **experimental, opt-in** feature. The specific behavior of different versions (concurrency limits, budget semantics, resume details) may evolve. The book marks the source of key behaviors so you can re-verify them on your own version.

---

## How to Read

> **In a hurry?** Chapter 01 to build the mental model → Chapter 04 to get your first one running → Chapter 08 to nail `parallel` vs `pipeline` → pick a recipe from Part III and adapt it.
>
> **Experienced?** Go straight to Part III "Recipes" and Part IV "Advanced Patterns"; circle back to Parts I and II when you hit a conceptual gap.
>
> **Want to master it systematically?** Front to back, run a recipe by hand in every chapter, and in Part V rewrite the most painful step in your own workflow with Workflow.
>
> **Here to copy homework?** Every recipe in Parts III and IV is a complete, copy-paste-runnable script; Appendix A is a full API quick reference cross-checked against the official type definitions.
>
> **Just want the cheat-sheet?** [Appendix F · Pattern Catalog & Scenarios](#/en/app-f) is the book's one-page map: look up your scenario → recommended pattern → jump to the chapter with the real run.

---

## Acknowledgments and Disclaimer

The writing of this book was inspired by [Yu Yu · claude-code-book](https://github.com/lintsinghua/claude-code-book) — a book that systematically dissects the architecture of Claude Code and is a forerunner of the "pop the hood" spirit. Part V's analysis of the four community systems (`ccg-workflow`, `oh-my-claudecode`, `oh-my-openagent`, `superpowers`) is built on a genuine reading of their source code, aiming to "take the best" rather than to rank them.

> **Disclaimer:** This book is written based on analysis of Claude Code's public distribution, type definitions, and product behavior, supplemented by real-run verification. Claude Code is a product of Anthropic PBC; this book is not affiliated with, authorized by, or representative of Anthropic. The views — and any errors — herein are the author's responsibility.

<div class="callout info">

Ready? Turn to [Chapter 01 · What Workflow Is](#/en/p1-01), where we start from "what on earth this thing actually is."

</div>
