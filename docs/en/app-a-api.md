# Appendix A · Full API Reference

> This appendix is the book's API quick reference, compiled against the type definitions `sdk-tools.d.ts` (the `WorkflowInput` / `WorkflowOutput` interfaces) in Claude Code's official distribution, the Workflow tool definition, and this machine's real run records (see [Appendix E](#/en/app-e)).
>
> Applicable version: Claude Code v2.1.150 (`CLAUDE_CODE_WORKFLOWS=1`, with this book's test session running main-loop model Opus 4.7 (1M)). The feature is experimental and fields may evolve across versions — your local type definitions are the final authority.

---

## A.0 How to Read This Reference: Three Tiers

The worst thing an API doc can do is state guesses as if they were certain. So this book grades every fact by confidence into three tiers, and marks them with one consistent notation throughout. Learn them first:

| Mark | Meaning | How you may rely on it |
|---|---|---|
| **[Official]** | From the Claude Code official tool definition / `sdk-tools.d.ts` types | Treat as authoritative; stated normally. |
| **[Verified]** | Actually run on this machine, with a Run ID (like `wf_59bf3654-183`) | Treat as authoritative; the run number and data are cited. |
| **[Third-party · unverified]** | From community third-party material (a YouTuber's companion repo `claude-code-workflow-creator`, **not** official), which this book has **not** independently reproduced | **Do not treat as fact.** Mentioned only when there is genuine teaching value, always with this label. |

<div class="callout info">

Why be this strict? Because a big chunk of the "Workflow API details" you can dig up online trace back to one third-party video-companion repo — not an official artifact — and some of its precise numbers (error class names, timeout milliseconds, retry counts) we **cannot reproduce** on this machine. Mix those in with the official and verified stuff, and you're just manufacturing authoritative-looking noise. This appendix would rather say less than pass off the unverified as truth.

</div>

---

## A.1 The Workflow Tool: Input `WorkflowInput` [Official]

This is what you pass in when you call the Workflow tool. The script can come from three places (`script` / `name` / `scriptPath`), plus `args`. **`scriptPath` has the highest priority** (above `script` and `name`); the relative priority of `script` and `name` is not officially specified, so do not assume a three-level `scriptPath` > `script` > `name` ordering.

| Field | Type | Description |
|---|---|---|
| `script` | `string?` | A self-contained script. **Must** begin with the pure literal `export const meta = {…}`, followed by the script body. |
| `name` | `string?` | A predefined/named workflow (built-in or `.claude/workflows/`), resolved into a self-contained script. |
| `args` | `object?` | The global `args` exposed to the script. Used to parameterize a named workflow. |
| `scriptPath` | `string?` | An on-disk script path. Every call lands the script on disk and returns the path in the result; you can edit it with Write/Edit and re-run with this field, no need to resend the whole script. **Highest priority.** |
| `resumeFromRunId` | `string?` | Resume from a run's checkpoint. Unchanged `agent()` calls return cached results; **same session only.** Stop the previous run (TaskStop) before resuming. |

### The Persist-Edit Loop: the Real Power of `scriptPath`

`script` and `scriptPath` look like nothing more than an "inline vs. path" distinction, but the latter actually unlocks a smooth iteration rhythm. [Official] On every call (whether you submit via `script` or `scriptPath`), the Workflow tool **lands the script on disk** and tells you where in the returned `WorkflowOutput.scriptPath`. So the loop holds:

```text
First: submit via script  ──►  returns scriptPath (script landed on disk)
                                  │
                edit that file with Edit ◄──┘
                                  │
Re-run: submit { scriptPath } (no need to resend the whole script) ──►  returns scriptPath again
```

Paired with `resumeFromRunId`, this loop is the basis for "change one spot, re-run only the steps after the change" (see [A.10](#a10-resume-official-verified) and [Appendix B](#/en/app-b)).

---

## A.2 The Workflow Tool: Output `WorkflowOutput` [Official]

The Workflow tool is **always async** — it hands you a receipt right away (not the result of the workflow run).

| Field | Type | Description |
|---|---|---|
| `status` | `"async_launched" \| "remote_launched"` | **Only these two values.** |
| `taskId` | `string` | The background task handle. |
| `runId` | `string?` | The local run identifier (like `wf_…`), used by `resumeFromRunId`; `remote_launched` has none (use the CCR session URL as the resume handle). |
| `summary` | `string?` | A summary. |
| `transcriptDir` | `string?` | The subagent execution-record directory. |
| `scriptPath` | `string?` | The script path landed this run, which can be edited with Write/Edit and re-run as `scriptPath`. |
| `sessionUrl` | `string?` | The CCR session URL when `remote_launched` (the remote resume handle). |
| `warning` | `string?` | A non-blocking notice (e.g., local git state diverges from the remote branch to be cloned). |
| `error` | `string?` | Set when the syntax check / submit-time static scan fails (the workflow never runs in that case). |

<div class="callout tip">

The workflow's **actual result** comes back via the `<task-notification>` when it finishes, carrying the return value and usage statistics (`agent_count` / `tool_uses` / `total_tokens` / `duration_ms`). Think of `taskId`/`runId` as a "tracking number" and the notification as the "package" — don't try to open the tracking number expecting the package.

</div>

---

## A.3 Script Structure and Execution Environment

```javascript
export const meta = { /* pure literal, see A.4 */ }
// ↑ must be the first statement; below is the script body (async context, await directly)
phase('...')
const x = await agent('...', { /* opts */ })
const ys = await parallel([ () => agent('...'), () => agent('...') ])
const zs = await pipeline(items, stage1, stage2)
log('...')
return result
```

- The script body runs in an `async` context; `await` directly. [Official]
- Standard JS built-ins (`JSON` / `Math` / `Array` / …) are available. [Official] [Verified] `Math.max(...)` and `JSON.stringify(...)` worked in `wf_59bf3654-183`.
- **No** file system / Node API: in the script body, `require` / `process` / `fetch` are all `undefined` [Verified, `wf_59bf3654-183`]. File, shell, and network work can only go inside `agent()` leaves — only subagents carry tools like Read/Write/Bash.
- **`Date.now()` / `Math.random()` / arg-less `new Date()` are forbidden** — they break the replayability resume relies on, so two layers catch them (see [A.9](#a9-the-determinism-sandbox-two-layers-verified)). `new Date(specificValue)` works [Verified].

### Globals Injected into the Script Body

The table below lists the globals you can use in the script body without any `import`. Of these, `agent` / `pipeline` / `parallel` / `phase` / `log` / `budget` / `args` / `workflow` are listed by the **official tool definition**; `console` / `setTimeout` / `clearTimeout` are ones this book **verified** are injected too.

| Global | Type/Signature | Tier | See |
|---|---|---|---|
| `agent` | `(prompt, opts?) => Promise<any>` | [Official] | [A.5](#a5-agentprompt-opts-promiseany-official) |
| `pipeline` | `(items, ...stages) => Promise<any[]>` | [Official] | [A.6](#a6-pipelineitems-stage1-stage2-promiseany-official) |
| `parallel` | `(thunks) => Promise<any[]>` | [Official] | [A.7](#a7-parallelthunks-promiseany-official) |
| `phase` | `(title) => void` | [Official] | [A.8](#a8-other-globals-official) |
| `log` | `(message) => void` | [Official] | [A.8](#a8-other-globals-official) |
| `budget` | `{ total, spent(), remaining() }` | [Official] | [A.8](#a8-other-globals-official) |
| `args` | `any` | [Official] | [A.11](#a11-args-passed-through-unchanged-normalization-verified) |
| `workflow` | `(nameOrRef, args?) => Promise<any>` | [Official] | [A.8](#a8-other-globals-official) |
| `console` | `object` (`console.log` callable, output goes to the workflow log) | [Verified, `wf_59bf3654-183`] | below |
| `setTimeout` | `function` | [Verified, `wf_59bf3654-183`] | below |
| `clearTimeout` | `function` | [Verified, `wf_59bf3654-183`] | below |

<div class="callout info">

**About `console` / `setTimeout` / `clearTimeout`**: in `wf_59bf3654-183` (a 0-agent introspection workflow), `typeof console === 'object'`, `typeof setTimeout === 'function'`, `typeof clearTimeout === 'function'`, and a `console.log(...)` call went through (output goes to the workflow log). For day-to-day progress narration, lean on the official `log()`; `console.log` is more of a debug side-channel. That these three globals **exist** is a verified fact [Verified, `wf_59bf3654-183`]. One related verified fact: **the VM imposes a 30000ms timeout on synchronous execution** [Verified, `wf_e3b2b123-5f4`] — a long synchronous loop with no `await` got killed and the workflow **failed** (measured 30,222ms), verbatim error `Error: Script execution timed out after 30000ms`. It bounds **synchronous** work to catch infinite loops; it is **not** a wall-clock cap (async workflows with `await agent(...)` routinely run for minutes). See the verification-upgrade table at the top of [A.14](#a14-third-party-unverified-list-caution).

</div>

---

## A.4 `meta` (exported constant, pure literal) [Official]

```javascript
export const meta = {
  name: 'review-changes',                    // required
  description: 'Review changed files',       // required, shown in the permission confirmation dialog
  whenToUse: 'When a PR touches many files', // optional, shown in the workflow list
  phases: [                                  // optional, each item a progress group
    { title: 'Review' },
    { title: 'Verify', detail: 'sanity pass' },
  ],
}
```

| Field | Required | Tier | Description |
|---|---|---|---|
| `name` | Yes | [Official] | Workflow name. |
| `description` | Yes | [Official] | **One line**, shown in the permission confirmation dialog. |
| `whenToUse` | No | [Official] | Use case, shown in the workflow list. |
| `phases` | No | [Official] | `{ title, detail?, model? }[]`; `title` matches `phase()` / `opts.phase` by exact string. |

**Constraint** [Official]: `meta` must be a pure literal — no variables, function calls, spread operators, or template interpolation (the runtime **statically reads** it before it runs the script). The third-party validator (`validate-workflow.mjs`) this book ran checks this rule-by-rule too (see [Appendix B](#/en/app-b)).

### The Runtime Effect of `phases[].model`: Undetermined, Handle via the "Safe Practice"

Each item in `meta.phases[]` may carry a `model`. **Its runtime semantics this book cannot independently verify**: the official tool description is vaguely worded (something like "add it when a phase overrides with a specific model"), while third-party material claims it is **display-only, not read at runtime** — and this book can assert neither.

The root cause is that this book's test session set the environment variable `CLAUDE_CODE_SUBAGENT_MODEL=claude-opus-4-7[1m]`, which **overrides every per-call model**: in `wf_9c94951d-58c`, five agents marked respectively `haiku` / `inherit` / `opus` / omitted / "inside a phase whose entry said `model:'haiku'`" **all ran as Opus**. So in this session this book **cannot** tease apart the effects of `phases[].model` and `opts.model`.

<div class="callout warn">

**Safe practice**: trust only `agent()`'s `opts.model` to actually decide the model. Want a phase on Haiku? Write `model: 'haiku'` on every `agent()` in that phase; treat `phases[].model` as a "label" in the permission dialog, and don't count on it taking effect by itself. Also, if your environment (or CI) sets `CLAUDE_CODE_SUBAGENT_MODEL`, then **all `model` options in the script are silently ignored** — it's a user/CI knob the script cannot control. Testing reveals a **second layer** of override: `ANTHROPIC_DEFAULT_HAIKU_MODEL` / `SONNET` / `OPUS` remap the **model aliases** wholesale (both pointed to Opus this session, so a script's `model: 'haiku'` ran as Opus too, `wf_e8cb23ff-829`). When you're debugging "why didn't my chosen model run," check both kinds of variable.

</div>

---

## A.5 `agent(prompt, opts?) → Promise<any>` [Official]

Send out a subagent to do the work. This is the only primitive in a workflow that actually spends tokens — pure orchestration (no `agent()` calls) is 0 tokens (`wf_59bf3654-183` and `wf_2b04881f-6a9` were both 0 tokens / single-digit milliseconds).

```javascript
await agent(prompt, {
  label,       // string?  progress display label, auto-numbered by default
  phase,       // string?  explicitly group into a progress group (always use inside pipeline/parallel)
  schema,      // object?  JSON Schema, force structured output
  model,       // string?  override the model (omit = inherit the main loop model; simple tasks can use 'haiku')
  isolation,   // 'worktree'?  run in an independent git worktree (expensive)
  agentType,   // string?  custom subagent type (e.g., 'Explore')
})
```

### Return Semantics [Official] [Verified]

- No `schema` → returns the subagent's final text (`string`).
- Has `schema` → forces the subagent to call the `StructuredOutput` tool, **validates at the tool-call layer**, returns a **validated object**; retries the model if it doesn't match. Every schema-bearing run in this book came back with a validated object (e.g., `wf_dacbd480-d5d` had `sum=4` as a number, not a string). **What you get back is already an object — no `JSON.parse` needed.**
- User skips the agent midway → returns `null` (filter with `.filter(Boolean)`). [Official]

### Option Details

| Option | Tier | Description |
|---|---|---|
| `label` | [Official] [Verified] | Overrides the display label in `/workflows`; a descriptive label aids search and observation. **R8 verified that `label` is not in the resume cache key**: changing one agent's label with everything else unchanged → resume is a 0-token full hit (`wf_4ffde230-535`, see A.10). |
| `phase` | [Official] | Explicit grouping; matches `meta.phases.title` exactly. **Always use it inside pipeline/parallel** to avoid racing the global `phase()`. (Third-party says it is not part of the cache key; not independently verified by this book.) |
| `schema` | [Official] | JSON Schema; validation is at the tool-call layer, so the model auto-retries until conforming. (Third-party says it is part of the resume cache key; not independently verified by this book.) |
| `model` | [Official] | Overrides this agent's model; **omitted, it inherits the main loop model** (recommended, unless the user specifies one or the task is simple enough for `'haiku'`). Note it is overridden by `CLAUDE_CODE_SUBAGENT_MODEL` (see A.4). (Third-party says it is part of the resume cache key; not independently verified by this book.) |
| `isolation: 'worktree'` | [Official] | Runs in a fresh git worktree; **expensive** (~200–500ms startup + disk/agent), use only when parallel agents editing files would collide; auto-cleaned if no changes; **the result returns the path and branch**. (Third-party says it is part of the resume cache key; not independently verified by this book.) |
| `agentType` | [Official] [Verified validated] | Use a custom subagent type instead of the default; **resolved from the same registry as the Agent tool**; combinable with `schema` (the custom agent's system prompt gets the StructuredOutput instruction appended). (Third-party says it is part of the resume cache key; not independently verified by this book.) |

### `agentType` Is Validated, `model` Is Not: a Real Asymmetry [Verified]

This is a key difference this book measured first-hand, worth committing to memory:

- **`agentType` is validated** [Verified, `wf_a222f20f-0f5`]: pass a type that doesn't exist and it throws **before any model is spawned** (0 tokens / 4ms), listing every available agent. Verbatim error:

```text
agent({agentType}): agent type 'definitely-not-a-real-agent-xyz' not found.
Available agents: claude, claude-code-guide, codex:codex-rescue, Explore,
general-purpose, get-current-datetime, init-architect, Plan, planner,
statusline-setup, team-architect, team-qa, team-reviewer, ui-ux-designer
```

> In other words, misspell `agentType` and you get "fail-fast, zero-cost" — very friendly for debugging. (Note: the default subagent's type name is `workflow-subagent`, recorded in each agent's `agent-<id>.meta.json` sidecar.)

- **`opts.model` has no submit/parse-time validation** [Verified, `wf_dace2fc6-966`]: pass a bogus string `'totally-not-a-real-model-xyz'` and it's **not rejected at submit/parse time** — the agent just runs (this session ran Opus because `CLAUDE_CODE_SUBAGENT_MODEL` overrode it). That's the contrast with `agentType`: `agentType` is "fail-fast, zero-cost," whereas `model` does not catch invalid values at parse time.
- But two points this book **could not verify** — the **exact semantics** of the `'inherit'` literal, and the claim that a typo (like `'hauku'`) "passes through and only **fails at the API call**": **(claimed by community third-party material, not independently verified by this book)**. That last one couldn't be observed because this session's `CLAUDE_CODE_SUBAGENT_MODEL` overrode the per-call model, so the bogus string was never actually sent to an API. This book's safe recommendation: treat `model` as accepting only values you've confirmed (like `'haiku'`, or omit), and don't lean on a typo being "tolerated."

---

## A.6 `pipeline(items, stage1, stage2, …) → Promise<any[]>` [Official]

Each item flows **independently** through all stages, with **no barrier between stages.** Wall clock ≈ the slowest single chain, not "the sum of the slowest of each stage." **For multi-stage work, reach for `pipeline()` by default.**

- Each stage callback receives `(prevResult, originalItem, index)`.
- First stage: `prevResult === item`.
- A stage throwing → that item turns into `null` and skips the remaining stages.

```javascript
const out = await pipeline(items,
  (item, _orig, i) => agent(`stage1 for ${item}`, { phase: 'S1', schema: A }),
  (r, item, i)     => agent(`stage2 using ${r.x} (orig ${item})`, { phase: 'S2', schema: B }),
)
```

This book's run (`wf_bf086b98-6ec`, 3 items × 2 stages) nailed down "each item flows through each stage independently" via `agent_count=6`; the stage signature `(prev, orig, i)` matches the table above.

## A.7 `parallel(thunks) → Promise<any[]>` [Official]

Run a set of **thunks** (`() => Promise`) concurrently, with a **barrier**: wait for all to finish. Result order = input order. Reach for it only when you genuinely need all the results together.

- An async reject / inner `agent()` error → that position is `null`; but **a synchronous `throw` in the thunk body rejects the whole call** (`.filter(Boolean)` before use).

```javascript
const results = (await parallel(items.map(it => () => agent(prompt(it), { schema: S })))).filter(Boolean)
```

<div class="callout warn">

What you pass to `parallel()` must be an **array of functions (thunks)** (`() => agent(...)`), not an array of Promises (`agent(...)`). The latter **executes immediately** the moment you build the array, so it doesn't conform to the `parallel(thunks)` API and loses its async-failure gathering semantics (async reject / agent error → `null` at that position). Note: the concurrency limit is **per-workflow** (`min(16, cores − 2)`), not specific to `parallel()` — don't misread this warning as "bypassing runtime throttling."

</div>

## A.8 Other Globals [Official]

| Global | Signature | Description |
|---|---|---|
| `phase(title)` | `(string) => void` | Open a new phase; subsequent `agent()` groups under it. |
| `log(message)` | `(string) => void` | Output a line of progress narration to the user (above the progress tree). |
| `args` | `any` | The value of the Workflow input `args` (`undefined` if not passed). See [A.11](#a11-args-passed-through-unchanged-normalization-verified). |
| `budget` | see below | The token budget object for this turn. |
| `workflow(nameOrRef, args?)` | `(string\|{scriptPath}, any?) => Promise<any>` | Inline-run another workflow; shares the concurrency limit / agent count / abort signal / token budget; **nesting one level only.** |

### `budget` [Official]

```javascript
budget.total        // number | null: this turn's token target; null = no target set
budget.spent()      // number: output tokens spent this turn (pool shared by main loop + all workflows)
budget.remaining()  // number: max(0, total - spent()); Infinity when no target is set
```

- `total` comes from the user's `+500k`-style instruction; it's `null` when not set (verified `budget.total === null` in `wf_59bf3654-183`).
- It is a **hard cap**: once `spent()` hits `total`, calling `agent()` throws. The pool is **shared** by the main loop + all workflows (including nested ones).
- Always guard dynamic loops with `budget.total &&`, or you may keep dispatching agents straight into the cap.

### `workflow(nameOrRef, args?)` [Official] [Verified]

Run another workflow inline (named, or `{ scriptPath }`). It shares the concurrency limit / agent count / abort signal / token budget. This book's run (`wf_2b04881f-6a9`):

- `workflow({ scriptPath }, { n: 21 })` runs the child inline and **passes `args` through** (the child returned `doubled: 42`).
- An unknown name throws and lists the registered named workflows: `bughunt, bughunt-lite, deep-research, plan-hunter, review-branch`.
- **Nesting is one level only**: a child that calls `workflow()` throws, verbatim:

```text
workflow() cannot be called from within a child workflow — nesting is limited
to one level. Inline the inner script or call its agents directly.
```

---

## A.9 The Determinism Sandbox: Two Layers [Verified]

Forbidding `Date.now()` / `Math.random()` / arg-less `new Date()` preserves the replayability resume relies on. The ban is **two-layered**, fully verified by this book in `wf_59bf3654-183`:

**Layer one — rejected at submit time (static scan)**: a **literal** `Date.now()` (or `Math.random()` / arg-less `new Date()`) in the script gets rejected by a static source scan **at submit time**; the script **never runs** (returns `error`, no Run ID). No `try/catch` can save you — it's caught before parsing. Verbatim error:

```text
Workflow scripts must be deterministic: Date.now()/Math.random()/new Date() are
unavailable (breaks resume). Stamp results after the workflow returns, or pass
timestamps via args.
```

**Layer two — trapped at runtime**: **aliasing** the call (e.g., `const D = Date; D.now()`) sneaks past the literal-form scan and gets through submission, but the call **throws at runtime**, caught by the script's own `try/catch`. The two error messages differ:

```text
Date.now() / new Date() are unavailable in workflow scripts (breaks resume).
Stamp results after the workflow returns, or pass timestamps via args.
```

```text
Math.random() is unavailable in workflow scripts (breaks resume).
For N independent samples, include the index in the agent label or prompt.
```

> Notice the `Math.random` runtime error even **hands you the workaround**: for N independent samples, encode the index into the agent's label or prompt (which is exactly the right posture for determinism — the same script + same args must produce the same result every time).

**Still available** [Verified]: `new Date(specificValue)` works (`new Date(0)` → `1970-01-01T00:00:00.000Z`); standard built-ins like `Math.max` and `JSON` work as usual.

**Workarounds**: need a timestamp — pass it via `args`, or stamp it after the workflow returns; need randomness — vary the prompt by agent index.

<div class="callout info">

The third-party repo also ships a pre-submit lint (`validate-workflow.mjs`), whose behavior this book **ran and confirmed** (a valid script gets `ok … passes`; a violating script reports errors one by one). The "rules" it enforces (meta must be the first pure-literal statement, ban on non-deterministic calls, host-API warning, `parallel` must take thunks) defer to the official tool definition + this book's verified runs; the validator just makes those rules runnable. See [Appendix B](#/en/app-b).

</div>

---

## A.10 Resume [Official] [Verified]

**Mechanism** [Official]: when you re-run with the same script + same args, the **longest unchanged prefix of `agent()` calls** hands back cached results in seconds; **the first edited/added call and everything after it** all re-run live. The journal records every `agent()` (landed as `agent-<id>.jsonl`). **Same session only**; stop the previous run with TaskStop before resuming.

**Verified** (`wf_9c94951d-58c`): the first run of 5 agents = **133,691 tokens / 32,959ms**; re-run **unchanged** with `{ scriptPath, resumeFromRunId }` → same Run ID, the same 5 results, **0 new tokens / 3ms**. That is, an unchanged resume is a "100% cache hit" at near-zero cost.

**What the cache key is made of**: the floor is "re-running with the same script + same args = a 100% cache hit / 0 new tokens" (`wf_9c94951d-58c`, above). On top of that, an **R8 controlled test** (baseline `wf_4ffde230-535`, 3 agents / 91,044 tokens) pulled out two fields and isolated them one at a time:

- **`label` is not in the key [Verified]**: change one agent's `label` with everything else untouched → resume is a **0-token full hit.**
- **`prompt` is in the key [Verified]**: change only its `prompt` (label restored) → 91,044 re-runs as **60,702 tokens** (≈2/3 of baseline), with agents before the change point still hit and that agent plus its downstream re-running. This is the positive control to the `label` case, proving resume is **content-sensitive** and doesn't return 0 for just any change.

As for **whether the remaining fields are in the key** — "`schema` / `model` / `isolation` / `agentType` in the key, `phase` not" — **(claimed by community third-party material, not independently verified by this book)**: this book hasn't yet isolated these fields one by one. See [A.14](#a14-third-party-unverified-list-caution).

---

## A.11 `args` Passed Through Unchanged + Normalization [Verified]

[Verified, `wf_59bf3654-183`] Passing `args = { hello: 'world', n: 5, nested: { deep: true } }`, in the script: `typeof args === 'object'`, reflected exactly (`nested.deep` is still `true`), `Array.isArray(args) === false`. **An object stays an object — it is not stringified.**

Because of that, **normalize** before you read `args` fields — **never unconditionally** `JSON.parse(args)` (an object throws outright). The safe idiom:

```javascript
// Only try to parse when args is a string; pass objects/absent through as-is
const input = (typeof args === 'string')
  ? (() => { try { return JSON.parse(args) } catch { return {} } })()
  : (args ?? {})

const n = input.n ?? 1   // now you can safely read fields
```

---

## A.12 Triggering and Gating [Official]

- **Gating**: the environment variable `CLAUDE_CODE_WORKFLOWS=1`.
- **Triggering**: ① a message containing the `ultrawork` keyword; ② calling the Workflow tool directly; ③ a named workflow / a skill or slash command that triggers it.
- **Live progress**: the slash command `/workflows`.

---

## A.13 Concurrency and Scale [Official]

| Limit | Value | Tier |
|---|---|---|
| Agents running at once per workflow | `min(16, CPU cores − 2)`, the rest **queue** (not an error) | [Official] |
| Total `agent()` cap per workflow | **1000** (runaway-loop backstop) | [Official] |
| Script size cap | **524288 bytes (512KB)** (the `script.maxLength` of the input-schema) | [Official] |
| `workflow()` nesting depth | **1 level** (calling `workflow()` again inside a sub-workflow throws) | [Official] [Verified] |

---

## A.14 Third-party · Unverified List (Caution)

The following claims come from the third-party repo `claude-code-workflow-creator` (a YouTuber's video-companion repo, **not** official). This book **cannot trigger / cannot isolate** them on this machine, so it can neither confirm nor refute them. **They're listed here only as a reminder: when you run into them elsewhere, know they have not been verified by this book — do not treat them as authoritative truth.**

> **Update · R4 verification upgrade.** The following 4 claims used to sit in the "unverified" list too, but this book has now **really reproduced** them on this machine and moved them out — they are now **verified facts**, no longer third-party claims:
>
> | Once third-party → now verified | Evidence (Run ID / verbatim error) |
> |---|---|
> | VM **30000 ms sync timeout** | Run `wf_e3b2b123-5f4`: a long synchronous loop with no `await` was terminated at 30,222 ms, error `Error: Script execution timed out after 30000ms`. Bounds **synchronous** execution only, not a wall-clock cap. |
> | `isolation: 'remote'` disabled in this build | Run `wf_dace2fc6-966`: throws `agent({isolation:'remote'}) is not available in this build`. **Refinement**: the runtime special-cases only `'worktree'` (do it) and `'remote'` (reject); any other unknown value is **silently ignored**, not an error. |
> | `meta` reserved keys rejected (submit time) | Static rejection at submit time, e.g. `constructor`, error `reserved key name not allowed in meta: constructor`. (`__proto__` / `prototype` not each tested, but the rejection mechanism is confirmed.) |
> | `opts.model` has **no submit-time validation** | Run `wf_dace2fc6-966`: `model: 'totally-not-a-real-model-xyz'` does not error at submit and the agent runs. ⚠ This session's `CLAUDE_CODE_SUBAGENT_MODEL` overrode the per-call model, so "fails later at the API call" could not be observed. |

| Third-party claim | This book's stance |
|---|---|
| Error class names `WorkflowAgentCapError` / `WorkflowBudgetExceededError` | **Unverified.** The official side only describes the behavior (errors at the 1000 cap / on budget exhaustion), giving no class names. |
| Concurrency **lower bound** `max(2, …)` | **Unverified.** The official side only gives the upper bound `min(16, cores − 2)`. |
| `stallMs` default **180000ms**, stall retries **≤5** | **Unverified.** (That the `setTimeout` global exists is a verified fact, but these ms/counts are not.) |
| On budget exhaustion, in-flight agents finish and results are kept, no new agents started | **Unverified.** |
| schema compiled/validated via **AJV**, "up to two more nudges" when the subagent doesn't call the tool | **Unverified.** This book confirms only "a schema always returns a validated object, retried if it doesn't match" (official + verified); it does **not** assert an exact retry count. |
| `opts.model`'s `'inherit'` literal **exact semantics** | **Exact semantics unverified.** Note: the "`model` has no submit-time validation" part has been verified-upgraded (see the table at the top of this section); contrast `agentType`, verified validated (A.5). |
| whether `schema` / `model` / `isolation` / `agentType` are in the resume cache key, and whether `phase` is not | **Unverified.** What this book verified is "same script + same args = 100% hit" (`wf_9c94951d-58c`), plus **R8's individually-isolated `label` (not in key) / `prompt` (in key)** (`wf_4ffde230-535`, moved out of this list, see A.10); these remaining fields are not yet isolated one by one. |

---

## A.15 Minimal Skeleton Template

```javascript
export const meta = {
  name: 'my-workflow',
  description: 'one-line description shown in the permission dialog',
  phases: [{ title: 'Work' }],
}

phase('Work')
const result = await agent('do the thing', {
  label: 'worker',
  schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
})
log(`done: ${result.ok}`)
return result
```

> If you're ever unsure about a field's semantics, the `WorkflowInput` / `WorkflowOutput` in your local `@anthropic-ai/claude-code/sdk-tools.d.ts` is the final authority; for behavioral details, defer to your own real runs.
