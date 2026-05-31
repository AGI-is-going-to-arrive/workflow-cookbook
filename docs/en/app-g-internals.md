# Appendix G · Under the Hood: How a Workflow Actually Runs on Your Machine (Measured)

> This appendix is for the curious. The body of the book teaches you what to write; this page shows you what you can actually *see* once a workflow runs. Everything here was either measured first-hand on this machine (Claude Code **v2.1.156**) and traces to a Run ID, or it comes from the Workflow tool's runtime contract and is labeled as such. Nothing here is reverse-engineering folklore.
>
> An important note: Dynamic workflows is an official **research preview**, and the internals below may change between versions. These Run IDs should be treated as v2.1.156 snapshots, not permanent guarantees. When your version disagrees with this page, **trust your own measurements.** [Appendix E](#/en/app-e) lists where every number comes from.

---

## G.0 What This Page Is, and How to Read the Evidence

Everything in this appendix carries one of three tags. Read each tag differently.

<div class="callout info">

**[measured on this machine, v2.1.156 + Run ID]**: something we ran ourselves and saw in a real `<task-notification>`. The Run ID lets you look the record up in `assets/transcripts/`. This is the strongest tag.

**[tool contract]**: behavior stated by the Workflow tool's runtime contract (the description the tool injects when Claude writes a script). It is authoritative for the API shape, but it is not a number we measured.

**[third-party lead, not adopted as truth]**: a claim from an outside reverse-engineering effort. The book did **not** treat it as fact. It appears only in [G.6](#g6-further-reading-a-third-party-lead), and only as a pointer for the curious.

</div>

The truth order matches the rest of the book: official docs and type definitions rank with first-hand Run-ID testing, and both sit above any third-party material ([Appendix E](#/en/app-e)). This page never promotes a third-party claim into the running text. If we could reproduce it here, it became a measured fact with a Run ID; if we could not, it stayed in G.6 with the caveat attached.

---

## G.1 The Traces You Can Actually See

The conceptual lifecycle (you write a script, Claude submits it, subagents run, results come back) belongs to [Chapter 1](#/en/p1-01), so this page will not repeat it. What is worth your attention is the part you can put your hands on after a run finishes: the **two artifacts** a workflow leaves behind.

**The script lands on disk.** Every Workflow call writes the script it ran to `…/workflows/scripts/<name>-<runId>.js`. In the session that produced this appendix we watched four of these files appear, one per run **[measured, this machine]**. That on-disk file is what makes a script readable, savable, and re-runnable later. It also explains why the cookbook's scripts are templates you copy, not slash-commands you have already installed: at the time of testing, neither `.claude/workflows/` nor `~/.claude/workflows/` existed in this project, because nobody had pressed `s` to save one **[measured, this machine]**.

**The result comes back as a `<task-notification>`.** When a run finishes, Claude Code injects one notification block back into the session. That block is the single channel your main session receives the outcome through, and it carries the usage and failure numbers [G.5](#g5-what-the-task-notification-carries) breaks down. The recon workflow `wf_f8398424-dcd` is a clean example: 7 agents, and a real notification reporting `agent_count=7 / subagent_tokens=1004658 / tool_uses=120 / duration_ms=1977272` **[measured, this machine]**.

The observable surface of a workflow is small and concrete: a `.js` file you can open and a notification block you can read. Everything below is what we learned by reading those two things across many runs.

---

## G.2 What a Workflow Subagent Looks Like Inside

We sent a probe agent into a real run and had it report its own runtime (Run `wf_b1d45b4c-445`, task `wr3d1ukk9`, 1 agent / 30324 tokens) **[measured, this machine, v2.1.156]**. Here is what a subagent in your workflow actually gets.

**It can call exactly seven tools directly.** `Bash`, `Edit`, `Read`, `Skill`, `ToolSearch`, `Write`, and `StructuredOutput`. That is the whole directly-callable set.

**`Grep` and `Glob` are not there at all.** They are not directly callable, and they are not sitting behind `ToolSearch` either. They are simply absent. If your agent needs to search code, it goes through `Bash` (for example `grep`/`rg` as shell commands) or reads files directly. This is sharper than what the third-party repo reported, which lumped Grep/Glob in with the deferred tools; on this machine they were gone entirely, while `WebFetch` is the one that is deferred.

**Web, Task-family, and every MCP tool are deferred behind `ToolSearch`.** `WebFetch`, `WebSearch`, the `Task*` family (`TaskCreate`/`TaskGet`/`TaskList`/`TaskStop`/`TaskUpdate`), `SendMessage`, and all `mcp__*` tools show up only as names. To call any of them the agent must first run `ToolSearch` to load the schema. A workflow agent cannot reach the web or an MCP server in one step by default; it has to fetch the tool first.

**The working directory is your repo root, not a sandbox.** The probe's cwd was the session's repo root (the project directory during our test). A subagent runs in the same directory you are in, with real access to your files. The only thing that changes this is `isolation:'worktree'`, which gives each agent its own throwaway checkout ([Chapter 19](#/en/p4-19)).

**File edits are auto-approved with no prompt.** The probe wrote a `/tmp/r13_probe_*.txt` file, read it back, and deleted it with `Bash rm`, all three steps with no approval popup **[measured, this machine]**. This is the first-hand confirmation of a guarantee the tool contract makes **[tool contract]**: a workflow subagent always runs in `acceptEdits`, regardless of your session's permission mode, so file writes do not pause to ask. The flip side, also from the contract: tools *not* on the inherited allowlist (some shell commands, web, MCP) can still trigger a mid-run prompt.

**The model is inherited from your session.** The probe reported `claude-opus-4-8[1m]`, the same Opus 4.8 the session was running, on `darwin`. The subagent did not expose a separate effort level. Unless an `agent()` call overrides `model` explicitly, your agents run on whatever model your session uses.

<div class="callout tip">

**Practical implications.** By default, workflow agents can read and write files freely in the repo and run shell commands, but they have no dedicated tool for pattern search, and they cannot access the web or an MCP server without a `ToolSearch` round-trip first. Design prompts accordingly: use `Bash` for search, and if an agent requires the web or an MCP tool, state this in the prompt so it knows to fetch the tool first.

</div>

---

## G.3 Failure Semantics, the Three Cases We Tested

This is the part people get wrong most often, so we tested all three failure shapes by hand (Runs `wf_b1d45b4c-445` and `wf_b7c75d40-c26`) **[measured, this machine, v2.1.156]**. The full teaching lives in [Chapter 8](#/en/p2-08); here is the measured truth, tight.

| What fails | What happens | Notification evidence |
|---|---|---|
| **Async reject** inside a `parallel()` thunk (a `Promise.reject`, or an error from inside `agent()`) | That slot becomes `null`; `parallel()` does **not** reject; `.filter(Boolean)` cleans it up | `shape=["alpha","NULL","gamma"]`; `<failures>parallel[1] failed`; `callRejected:false` |
| A `pipeline()` stage **throws** | That item becomes `null` and skips its remaining stages; sibling items keep flowing | `shape=["s2:s1:keep1","NULL","s2:s1:keep2"]`; `<failures>pipeline[1] failed` |
| **Synchronous throw** inside a `parallel()` thunk | `parallel()` rejects as a **whole**; a `try/catch` around the `await` catches it and the **run survives**; `.filter(Boolean)` cannot help (it never gets an array) | `wf_b7c75d40-c26`: `{runSurvived:true, callRejected:true, caughtByTryCatch:true, error:"SYNC_THROW_PROBE"}` |

The core rule: **an async error becomes a filterable `null`; a synchronous throw rejects the whole `parallel()` call.** The two have different semantics, and this distinction is the common source of confusion.

<div class="callout warn">

**A correction the book carries.** The tool contract states "a thunk that throws resolves to `null`; the call never rejects." This holds only for **async** errors **[tool contract]**. For a **synchronous** throw it does not: testing confirmed `parallel()` rejects as a whole. The statement "the call never rejects" should not be treated as absolute. The safe rule covering every case: place risky logic inside an awaited `agent()`, wrap `await parallel(...)` in a `try/catch`, and `.filter(Boolean)` before using the results. A sync throw still rejects the call, but the `try/catch` keeps the run alive; only an **uncaught** throw aborts it.

</div>

---

## G.4 Resume and Caching, Measured

We ran one script under one Run ID three times in a row to watch the cache behave (Run `wf_4248177d-c90`) **[measured, this machine, v2.1.156]**. The chapter that teaches resume end-to-end is [Chapter 22](#/en/p4-22); here are the three measurements.

| Step | What we did | Result | Usage |
|---|---|---|---|
| First run | A 3-stage chain of agents | `a1/a2/a3 = STAGE-ONE/TWO/THREE-OK` | `agent_count=3`, `subagent_tokens=81765`, `duration=18658ms` |
| Resume, unchanged | Same script + `resumeFromRunId` | Identical results | `agent_count=3`, `subagent_tokens=0`, `tool_uses=0`, `duration=1ms` |
| Resume after editing stage 2 | Changed stage 2's prompt marker from `STAGE-TWO-OK` to `STAGE-TWO-EDITED`, then resumed | `a2` returned the **new** marker `STAGE-TWO-EDITED`; `a1`/`a3` unchanged | `agent_count=3`, `subagent_tokens=54456`, `tool_uses=2`, `duration=9331ms` |

Two things this nails down:

**Same script, same args means a full cache hit.** The unchanged resume came back in 1ms with `subagent_tokens=0` and `tool_uses=0`. Nothing actually ran. (Note `agent_count` still showed 3. It counts logical agents, not agents that re-executed. See [G.5](#g5-what-the-task-notification-carries).)

**Editing one stage re-runs that stage and everything after it. Call it the longest-unchanged-prefix rule.** When we edited stage 2, stage 1 stayed cached (0 tokens), and stage 2 plus its downstream stage 3 both re-ran, even though stage 3's prompt never changed, because it sits after the edit point. The token math backs it up: `81765 -> 54456` is a drop of roughly one agent's worth, exactly "ran 3, then re-ran 2." And `a2` emitting the new marker proves that stage 2 genuinely re-executed rather than replaying a cached answer.

---

## G.5 What the `<task-notification>` Carries

The notification block from [G.1](#g1-the-traces-you-can-actually-see) is where the numbers live. We measured it carrying two blocks **[measured, this machine, v2.1.156]**.

**The `<usage>` block** reports four fields: `agent_count`, `subagent_tokens`, `tool_uses`, and `duration_ms`. The recon run `wf_f8398424-dcd` is a full example (`agent_count=7 / subagent_tokens=1004658 / tool_uses=120 / duration_ms=1977272`).

**The `<failures>` block** lists per-slot failures, one line each, as `parallel[i] failed: …` or `pipeline[i] failed: …`. This is how you tell *which* slot went `null` after the fact, for example the `parallel[1] failed` and `pipeline[1] failed` lines in [G.3](#g3-failure-semantics-the-three-cases-we-tested)'s table.

<div class="callout tip">

**`agent_count` counts logical agents, not re-executed ones.** The full-cache-hit resume in [G.4](#g4-resume-and-caching-measured) still reported `agent_count=3` while burning `subagent_tokens=0`. Do not read `agent_count` as "work that just happened." When you want to know whether agents actually ran, check `subagent_tokens` and `duration_ms` instead.

</div>

---

## G.6 Further Reading: A Third-Party Lead

An outside repository, **`claude-code-workflow-research`**, reverse-engineered a single v2.1.156 run by capturing its traffic through a local proxy. It is an interesting read if you want a packet-level view.

<div class="callout warn">

**Treat it as a lead, not a source of truth.** It is **non-official** and not affiliated with Anthropic, and it rests on a single captured run rather than the runtime contract. This book did **not** adopt its claims as fact. This appendix states only what could be reproduced first-hand on this machine; those reproductions are the Run-ID'd facts throughout. Where its claims differ from this book's findings, the book's findings take precedence, as they were measured on this machine.

</div>

A concrete example of the discipline: that repo reported the resume **cache-key hash format** as if it were settled. The book does **not** state any cache-key hash format as fact, because we did not reproduce it here. What we *did* measure is the cache *behavior*: a full hit on an unchanged resume, and a longest-unchanged-prefix re-run on an edit ([G.4](#g4-resume-and-caching-measured)). The behavior entered the running text with a Run ID; the hash-format claim stays here, unverified. That is the same stance the book takes toward every third-party reading ([Appendix E · E.5](#/en/app-e)): borrow the perspective, not the authority.

---

> This page presents runtime-level measurement details, not design documentation. The design-level content is in the body chapters: failure rules in [Chapter 8](#/en/p2-08), resume rules in [Chapter 22](#/en/p4-22), and every number traces to a Run ID in [Appendix E](#/en/app-e). These internals are a research-preview snapshot of v2.1.156. **If your version disagrees, trust your own run.**
