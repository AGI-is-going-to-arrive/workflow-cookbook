# Chapter 04 · Your First Workflow

> Theory's done; time to get your hands dirty. This chapter goes from "confirm the environment" to "get your first Workflow running and understood," walking the whole loop of launch, async, progress, and iteration. Every step is checked against **real-run** output.

---

## 4.1 Prerequisite: Confirm It's Available

Chapter 01 §1.5 split this into two layers: **available** vs. **will use.** Before you start, confirm the **available** layer — and the most reliable way is to set `CLAUDE_CODE_WORKFLOWS=1` explicitly.

```bash
# Enable temporarily at launch (effective for the current session) — macOS / Linux syntax
CLAUDE_CODE_WORKFLOWS=1 claude
# Windows CMD: run set CLAUDE_CODE_WORKFLOWS=1 first, then claude on its own line
# Windows PowerShell: $env:CLAUDE_CODE_WORKFLOWS="1"; claude
```

Or write it into `~/.claude/settings.json` to keep it on for good (this JSON form works on all three platforms):

```json
{ "env": { "CLAUDE_CODE_WORKFLOWS": "1" } }
```

The most direct way to check it's in effect is to look at the environment variable. In this book's writing session it **does exist, and equals `1`**:

```text
CLAUDE_CODE_WORKFLOWS = 1
```

<div class="callout tip">

**Two 0-cost confirmation methods:** ① Just say it in the conversation — "run a minimal workflow to confirm the runtime." The sentence carries the word `workflow`, so Claude reaches for the Workflow tool: if it's on, it runs; if not, it tells you the tool is unavailable. ② Type `/effort` and check whether the picker has an `ultracode` slot — if it does, workflows are already **available** (the reasoning is in §1.6).

</div>

As for **will use** — if you want Claude to **orchestrate proactively by default**, you can set `/effort ultracode` once and it stays on for the whole session (details in Chapter 01 §1.6). The scripts in this chapter all call the Workflow tool directly, and don't depend on that standing setting.

---

## 4.2 Hello, Workflow

Below is this book's first real-run script. It does exactly one thing: send out a subagent and ask it to return a structured "run confirmation."

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

Line by line (echoing Chapter 01's "warp and weft"):

| Line | Role |
|---|---|
| `export const meta = {…}` | **Warp**: a pure literal that declares name, description, phases. The runtime reads it statically before anything runs. |
| `phase('Greet')` | Switch to the "Greet" phase; the agents you send out after this all group under it in the progress tree. |
| `agent(prompt, { schema })` | **Weft**: send out a subagent; `schema` forces it to return a validated structured object. |
| `log(...)` | Print a line of progress to you. |
| `return r` | The workflow's final return value, the one that shows up in the completion notification. |

<div class="callout warn">

**This is a Workflow script, not a Node script — a beginner's first pothole.** `meta`/`phase`/`agent`/`log`/`budget`/`args` are all globals **injected by the Workflow runtime** (`_grounding.md` section B: "injected at runtime, no import needed"). Save this as `hello.js`, run `node hello.js` on its own, and Node — which has none of these globals — throws `ReferenceError: phase is not defined` right away. **This is identical on Windows, macOS, and Linux** (it has nothing to do with the OS; it's that Node simply has no Workflow runtime layer). It only runs inside a Claude Code session with `CLAUDE_CODE_WORKFLOWS=1` enabled, executed by Claude through the built-in Workflow tool (see 4.1: just include the word `workflow` in your message). This book's testing ran it exactly that way: runtime confirmed, schema forced `sum=4` as a **number**, ~26k tokens / ~5.5 seconds (see the real receipt and usage in 4.3 and 4.4).

</div>

---

## 4.3 Launch: You Immediately Get a Receipt

The moment you hand the script to the Workflow tool, it **does not wait to finish** — it hands you back a receipt right away. This is real output:

```text
Workflow launched in background. Task ID: wi7ye81mb
Summary: Smoke test: one subagent returns schema-constrained structured output
Transcript dir: ...\subagents\workflows\wf_dacbd480-d5d
Script file: ...\workflows\scripts\hello-workflow-wf_dacbd480-d5d.js
Run ID: wf_dacbd480-d5d
You will be notified when it completes. Use /workflows to watch live progress.
```

This receipt maps exactly onto the real fields of `WorkflowOutput` in `_grounding.md` section B. Line them up in a table:

| What you see in the receipt | `WorkflowOutput` field | Meaning / use |
|---|---|---|
| `Task ID: wi7ye81mb` | `taskId: string` | The background task handle (pair it with TaskStop to stop it). |
| `Run ID: wf_dacbd480-d5d` | `runId?: string` | This run's identifier, **the thing resume needs** (Chapter 22); absent when `remote_launched`. |
| `Script file: ...js` | `scriptPath?` | Your script was **written to disk** — the key to iteration (see 4.5). |
| `Transcript dir: ...` | `transcriptDir?` | The directory holding the subagent's full execution record. |
| `Summary: Smoke test...` | `summary?` | The echoed one-line summary (i.e. `meta.description`). |

<div class="callout info">

**The receipt's `status` has only two possible values.** Per `_grounding.md` section B, `WorkflowOutput.status` is `"async_launched" | "remote_launched"` — **there is no third**, and in particular **no** synchronous "completed" status. Running locally gives you `async_launched` (your case here); running on the CCR remote gives you `remote_launched` (no `runId` then — the resume handle becomes the returned session URL). When the syntax check fails, the return carries an `error` field instead (see 4.7). **Get this into your head and you'll never again expect "call Workflow and get the result directly."**

</div>

<div class="callout info">

**Why is it async?** Because a workflow may fan out dozens of subagents and run for minutes or longer. Making it async lets you go off and do other things after launching, and get notified when it finishes. So — **the Workflow tool's return value is not the result, it's a "launched" receipt.** The real result is in the completion notification.

</div>

---

## 4.4 Progress and Completion

Once you've launched, the slash command **`/workflows`** shows you a **live progress tree**: which phase you're in (from `meta.phases` and `phase()`), which agents are running, which are done (leaf-node names come from each `agent()`'s `label`). It's your window onto the stretch "after launch, before notification" — a progress panel that keeps refreshing. How `phase`/`log`/`/workflows` work together is the subject of Chapter 09.

When the workflow actually finishes, you get a **completion notification.** The heart of `hello-workflow`'s real completion notification is this return value:

```json
{
  "message": "The Claude Code Workflow runtime smoke test executed successfully as a workflow subagent.",
  "sum": 4,
  "runtimeConfirmed": true
}
```

plus a real usage report:

```text
agent_count = 1   tool_uses = 1   total_tokens = 26338   duration_ms = 5506
```

How to read it:

- `sum` is the number `4`, **not** the string `"4"` — because the schema declared `type: 'number'`, the validation layer locked the type in (this is the power of structured output; see Chapter 07).
- The simplest agent round-trip ≈ **5.5 seconds / 26k tokens.** Take that as your baseline unit and you can estimate what a bigger workflow will cost.

```mermaid
sequenceDiagram
    participant You as You
    participant WF as Workflow runtime
    participant A as subagent "smoke"
    You->>WF: Workflow({ script })
    WF-->>You: taskId wi7ye81mb · runId wf_… (immediately)
    Note over You: watch progress with /workflows
    WF->>A: agent(prompt, { schema })
    A->>A: call StructuredOutput, validation passes
    A-->>WF: {message, sum:4, runtimeConfirmed:true}
    WF-->>You: completion notification: return value + usage
```

---

## 4.5 The Iteration Loop: The Script Is a File

Because the script already landed on disk (the receipt's `Script file` / `WorkflowOutput.scriptPath`), iterating a workflow doesn't mean resending the whole code every time. That gives you an **"edit the on-disk file → re-run with `scriptPath`" iteration loop**:

```mermaid
flowchart LR
    A["First launch<br/>Workflow({ script })"] --> B["receipt gives<br/>scriptPath + runId"]
    B --> C["Write/Edit<br/>change that .js directly"]
    C --> D["Workflow({ scriptPath })<br/>re-run (optionally + resumeFromRunId)"]
    D --> C
    style A fill:#69d
    style D fill:#2d6
```

Once you've got the `Script file` path from the receipt, each iteration is just two steps:

1. Use `Write`/`Edit` to change that `.js` file directly;
2. Call Workflow again with `{ scriptPath: "<that path>" }` (`scriptPath` has priority over `script`/`name`).

If you also want to reuse the **expensive intermediate results** from last time, add `resumeFromRunId`:

```javascript
// After editing the script, re-run with resume: unchanged agent() calls return cached results in seconds
Workflow({ scriptPath: ".../hello-workflow-wf_dacbd480-d5d.js", resumeFromRunId: "wf_dacbd480-d5d" })
```

"The same script + the same args → 100% cache hit." That's exactly why `Date.now()` / `Math.random()` are forbidden in scripts — they break replayability. Resume details are in Chapter 22.

---

## 4.6 Make It a Little Bigger: Two Agents

Grow hello into "two concurrent agents + a one-line summary" to get a feel for `parallel()`:

```javascript
export const meta = {
  name: 'hello-parallel',
  description: 'Two concurrent agents, then a one-line summary',
  phases: [{ title: 'Ask', detail: 'Two agents in parallel' }],
}

phase('Ask')
const [a, b] = await parallel([
  () => agent('In one sentence: what is a barrier in concurrency?', {
    label: 'q-barrier',
    schema: { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'] },
  }),
  () => agent('In one sentence: what is a pipeline in concurrency?', {
    label: 'q-pipeline',
    schema: { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'] },
  }),
])
log('both answers in')
return { barrier: a?.answer, pipeline: b?.answer }
```

Note that `parallel()` takes an **array of thunks** (`() => …`), not an array of Promises — this trips up beginners first, and Chapter 08 walks through it.

> The `hello-parallel` block above is **illustrative** (not run on its own); the real behavior of the `parallel()` it leans on has been verified by Chapter 08's `parallel-demo` (Run `wf_52957913-6d2`).

---

## 4.7 The Four Most Common Beginner Mistakes

Writing your first Workflow, nearly everyone walks into the pitfalls below. Take them one at a time, with "wrong" and "right":

**① `meta` is not a pure literal (including "computing a value inside `meta`").** `meta` must be a "dead" literal — the runtime reads it during the **static-parsing phase**, so any variable reference, function call, spread, or template interpolation makes it refuse to launch. Beginners especially love to "just compute something" in `meta` (stitch a name together, generate a description from the date) — and that's exactly the trap that catches them most:

```javascript
// ✗ Wrong: variable reference + template interpolation + function call — all "computation"
const NAME = 'x'
export const meta = { name: NAME, description: `run ${NAME} at ${Date.now()}` }
// ✓ Right: a pure literal, written out character by character
export const meta = { name: 'x', description: 'run x' }
```

**② The schema omits the `required` fields.** When you pass a `schema`, don't stop at `properties` — also list the fields that **must appear** in `required`, or the model may legitimately leave one out, and your downstream `r.sum + 1` gets `undefined`:

```javascript
// ✗ Wrong: declares sum but doesn't list it in required — the model may not return it
schema: { type: 'object', properties: { sum: { type: 'number' } } }
// ✓ Right: required nails down "this field must be present"
schema: { type: 'object', properties: { sum: { type: 'number' } }, required: ['sum'] }
```

**③ Treating it as a synchronous call, expecting "the result the moment it's done."** This is the most damaging mental mistake. Workflow is **always async**: the call hands back a receipt immediately (`status` is only ever `async_launched`/`remote_launched`, see 4.3), and the result is in the **completion notification**. Any `const result = Workflow(...)` that then reaches straight for `result.sum` is wrong — at that moment `result` is just the receipt, not the product.

**④ Syntax error.** If the script's syntax check fails, `WorkflowOutput` carries an `error` field telling you what went wrong, and the workflow **won't launch.** Get the script right locally before you submit it.

<div class="callout warn">

**Don't use `Date.now()` / `Math.random()` / arg-less `new Date()` in scripts** — they throw (they break replayability and kill the resume cache, see 4.5). Need a timestamp? Pass it in via `args`. Need randomness? Vary the prompt using the agent's index.

</div>

---

## 4.8 Chapter Summary

- Turn the feature on with `CLAUDE_CODE_WORKFLOWS=1`; if you're not sure, have Claude run a minimal workflow to confirm.
- It is a **Workflow script, not a Node script**: `meta`/`phase`/`agent`/`log` are runtime-injected globals; `node hello.js` throws `phase is not defined` identically across platforms; it only runs via Claude in a `CLAUDE_CODE_WORKFLOWS=1` session.
- Launching a Workflow **hands back a receipt immediately** (`WorkflowOutput`: `taskId`/`runId`/`scriptPath`/`transcriptDir`; `status` is only `async_launched`/`remote_launched`); the result is in the **completion notification**; watch live progress with `/workflows`.
- Real baseline: a single agent ≈ 5.5s / 26k tokens; `schema` guarantees the return type (`sum` is the number 4, not a string).
- Iterate via the "script is a file" loop: edit the on-disk `.js` + re-run with `scriptPath`; add `resumeFromRunId` to reuse the cache.
- Four beginner pitfalls: ① computing values inside `meta` (must be a pure literal); ② omitting `required` in a schema; ③ treating it as synchronous and expecting the result right away; ④ syntax errors land in the `error` field and don't launch.

This far into Foundations, you can already run, read, and iterate a Workflow. The next three chapters (05/06/07) walk through the warp (`meta`/`phase`), the weft's core (`agent()`), and structured output (`schema`) one by one, and Chapter 08 nails down the concurrency model.

> Continue reading: [Chapter 05 · meta & phase: The Warp](#/en/p2-05)
