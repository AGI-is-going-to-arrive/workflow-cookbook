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

Over the past two years, we've learned to **use** AI agents: write good prompts, wire up the right tools, spin up a few subtasks to run in parallel. The community has put out a pile of excellent workflow systems — `oh-my-claudecode`, `superpowers`, `oh-my-openagent`, `ccg-workflow` — each with its own bag of tricks, drilling a single agent into a well-trained team.

But pop the hood on any of them and you hit a shared, slightly awkward truth: **these systems all orchestrate by "praying" through prompts.**

They write the orchestration logic in Markdown and try to pin down a **probabilistic** language model by hammering home in the prompt "⛔ you MUST do A before B" and "never skip verification"; they use lifecycle hooks to drop "breadcrumbs" into every turn, nudging the agent "you're not done yet, go back and finish"; they persist progress to JSON state files, because the moment the context gets compacted, the agent forgets what it was doing.

These tricks are clever, and they work — but at bottom they lean on **natural language** and **runtime patches** to fake something that should be guaranteed by **code**: **deterministic control flow.**

> Why did they do this? Because for a long time, Claude Code gave you no native way to "orchestrate agents with code."
>
> Now Claude Code ships one, officially.

---

## The Deterministic Engine Claude Code Just Shipped: Dynamic Workflows

Claude Code just shipped a capability called **Dynamic workflows**, in **research preview**, with the docs now formally published at [`code.claude.com/docs/en/workflows`](https://code.claude.com/docs/en/workflows). Here's what it does, in one sentence:

> **Use a single pure-JavaScript script to deterministically orchestrate hundreds of subagents (within the official caps: up to 1,000 per run, up to 16 concurrent) — with support for pipelines, concurrency, phases, budgets, structured output, and JSON Schema constraints — reusable, testable, and shareable.**

In the official framing: a dynamic workflow is a JavaScript script that Claude writes for you, and a runtime executes it in the background while your session stays responsive. It's not MCP (a protocol for connecting external tools), not Skills (knowledge packs that inject prompts), not Subagents (one-off subtasks), and not Agent Teams (a stateful collaborating team). It's a **brand-new, orthogonal dimension of extension**: it pulls the **orchestration logic** — what to do first, what next, what runs in parallel, what runs serially, how to verify the results — out of slippery prompts and moves it into **deterministic code**.

Say you write this:

```javascript
const results = await pipeline(
  dimensions,
  d => agent(d.reviewPrompt, { schema: FINDINGS }),
  review => parallel(review.findings.map(f => () =>
    agent(`Adversarially verify this finding: ${f.title}`, { schema: VERDICT })
  ))
)
```

`pipeline`, `parallel`, and `agent` are all **real functions**, executed **deterministically** by the JavaScript runtime. Which phase runs first, how many agents run concurrently, what condition the loop exits on — code decides all of it, with no more leaning on the model's "good intentions." And `schema` forces each subagent's output to **strictly match** a JSON Schema; if the model hands back a non-conforming structure, the runtime makes it **retry** until it conforms.

What this means: **the orchestration discipline the community painstakingly maintains through prompts can now be welded shut, once and for all, in code.**

It requires **Claude Code v2.1.154 or later**, and it's available on all paid plans (Anthropic API, Amazon Bedrock, Google Cloud Vertex AI, and Microsoft Foundry are all covered); Pro users turn it on from the "Dynamic workflows" row in `/config`. Once it's on, the official also gives you a session-level master switch, `/effort ultracode`: one phrase, and Claude orchestrates a workflow by default across the whole session (see [Chapter 01 §1.6](#/en/p1-01)). What this book sets out to do is help you **truly master** this freshly shipped capability — not just using the bundled one, but learning to **write your own** workflows.

---

## What This Book Is, and Isn't

**This is a Cookbook, not API documentation.**

There's no shortage of "here are the Workflow tool's parameters" listings out there. This book tackles the harder, more useful questions:

- **When** should you reach for Workflow, and when for Subagents / Skills / Agent Teams? (Part I · The Positioning Matrix)
- `parallel` and `pipeline` both seem to run things concurrently — **what exactly is the difference**, and how much wall-clock time do you burn by picking wrong? (Part II · Foundations)
- What does a genuinely usable "sharded code review," "multi-dimension PR review," or "bug hunter" pipeline **actually look like**? (Part III · Recipes)
- How do you design "adversarial verification," "judge panels," and "loop-until-dry" so the results are **trustworthy** and not just "looks right"? (Part IV · Advanced Patterns)
- Of those four excellent community systems, **which gems** can you rewrite as reusable assets with Workflow? (Part V · Ecosystem)
- How do you build your **own** reusable, shareable Workflow library from scratch? (Part V · Build Your Own Library)

<div class="callout tip">

**Depth made accessible** is this book's creed. Every concept starts from "why you need it," builds intuition with a minimal runnable example, then layers up to production-grade recipes. You don't have to grasp all the theory first — pick the recipe closest to your work, get it running, then come back for the principles. That works just as well.

</div>

---

## Three Non-Negotiable Promises

What sets this book apart from the many "tutorials written by AI" comes down to three iron laws:

**One: Real runs, never fabricated.** Every output in this book marked "real run" comes from actually running a Workflow in a real Claude Code session — including the real `taskId`, `runId`, token usage, duration, and return value. These raw records live in the repository's [`assets/transcripts/`](https://github.com/AGI-is-going-to-arrive/workflow-cookbook/tree/main/assets/transcripts) directory, and you can check them line by line. Any script that wasn't actually run, and serves only as illustration, is **clearly marked**.

**Two: Cross-checked against sources, never guessed.** Every description of the Workflow API is checked word-for-word against three sources: the official docs at [`code.claude.com/docs/en/workflows`](https://code.claude.com/docs/en/workflows), the type-definition file `sdk-tools.d.ts` (the `WorkflowInput` / `WorkflowOutput` interfaces) in Claude Code's official distribution, and the runtime tool definition. Any claim about environment variables, version numbers, or feature flags is confirmed by testing on the local machine. The findings in this book that go beyond the official docs (the registry tested down to just `deep-research`, the serialization trap, the `parallel` sync-throw that fails the whole run, worktree behavior, and so on) all carry their corresponding Run IDs so you can re-verify them.

**Three: Consistent across languages, side by side.** This book ships a complete bilingual edition in Chinese and English, the two corresponding one-to-one with a unified terminology. Click the language switch in the top-right of any chapter and you'll land on the other-language version of the same chapter.

---

## Test Environment Declaration

> All testing in this book was done in the environment below; use it as your baseline when you read the recipes:
>
> | Item | Value |
> |---|---|
> | Claude Code version | **v2.1.154+ (official minimum)**; this book tested across **v2.1.150 → v2.1.156**, with the core invariants re-verified on v2.1.156 (see [`assets/transcripts/examples-r11.md`](https://github.com/AGI-is-going-to-arrive/workflow-cookbook/blob/main/assets/transcripts/examples-r11.md)) |
> | Feature flag | `CLAUDE_CODE_WORKFLOWS=1` (confirmed present this session via `printenv`; the official user-facing entry is `/config`) |
> | effort system | `/effort`'s seven settings `low/medium/high/xhigh/max/ultracode/auto`; **ultracode = xhigh + proactive orchestration (this session only)**; this session is locked at `CLAUDE_CODE_EFFORT_LEVEL=max` |
> | Main model | **Opus 4.8 (1M context)** |
> | Subagent model | **`claude-opus-4-8[1m]`** (explicitly set by `CLAUDE_CODE_SUBAGENT_MODEL`, confirmed via `printenv`) |
> | Related flag | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` |
> | Test date | May 2026 (R11 re-verification) |
>
> Before using a workflow, first make sure it's **available** in your session: the official user-facing entry is the "Dynamic workflows" row in `/config` (Pro users must turn it on there), and power users can also set `CLAUDE_CODE_WORKFLOWS=1` explicitly (see [Chapter 01 §1.5](#/en/p1-01)). The specific behavior across versions (concurrency limits, budget semantics, resume details) may evolve. The book marks the source of key behaviors so you can re-verify them on your own version.

---

## How to Read

> **In a hurry?** Chapter 01 to build the mental model → Chapter 04 to get your first one running → Chapter 08 to nail `parallel` vs `pipeline` → grab a recipe from Part III and adapt it.
>
> **Experienced?** Go straight to Part III "Recipes" and Part IV "Advanced Patterns"; circle back to Parts I and II whenever you hit a conceptual gap.
>
> **Want to master it systematically?** Front to back — run a recipe by hand in every chapter, and in Part V rewrite the most painful step in your own workflow with Workflow.
>
> **Here to copy homework?** Every recipe in Parts III and IV is a complete, copy-paste-runnable script; Appendix A is a full API quick reference cross-checked against the official type definitions.
>
> **Just want the cheat-sheet?** [Appendix F · Pattern Catalog & Scenarios](#/en/app-f) is the book's one-page map: look up your scenario → recommended pattern → jump to the chapter with the real run.

---

## Acknowledgments and Disclaimer

This book was inspired by [Yu Yu · claude-code-book](https://github.com/lintsinghua/claude-code-book) — a book that systematically dissects the architecture of Claude Code and is a forerunner of the "pop the hood" spirit. Part V's analysis of the four community systems (`ccg-workflow`, `oh-my-claudecode`, `oh-my-openagent`, `superpowers`) rests on a genuine reading of their source code, aiming to "take the best" rather than to rank them.

> **Disclaimer:** This book is written from an analysis of Claude Code's public distribution, type definitions, and product behavior, backed by real-run verification. Claude Code is a product of Anthropic PBC; this book is not affiliated with, authorized by, or representative of Anthropic. The views — and any errors — herein are the author's responsibility.

<div class="callout info">

Ready? Turn to [Chapter 01 · What Workflow Is](#/en/p1-01), where we start from "what on earth this thing actually is."

</div>
