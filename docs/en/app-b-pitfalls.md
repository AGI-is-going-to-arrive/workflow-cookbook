# Appendix B · Pitfalls & Troubleshooting

> This appendix turns the potholes you're most likely to step in while writing Workflows into a quick-to-look-up, accurate reference. Each entry runs **symptom → cause → fix**: first what you'll see and when it shows up, then the underlying why, and finally a fix you can copy straight in.
>
> The API basis for all claims is in [Appendix A](#/en/app-a); the behavioral basis comes from the real runs listed in [Appendix E](#/en/app-e). Applicable version: Claude Code v2.1.150 (`CLAUDE_CODE_WORKFLOWS=1`).

---

## B.1 Quick Master Table

Scan it first. Each row links to the detailed section below.

| # | Symptom (what you see) | Root cause (one line) | Quick fix |
|---|---|---|---|
| 1 | The tool returns `error` directly, the workflow never ran | `meta` isn't a pure literal / the script's first line isn't `export const meta` | [B.2](#b2-meta-rejected-for-not-being-a-pure-literal) |
| 2 | Returns an `error` field indicating a syntax/parse failure | The script body has a syntax error, caught by the pre-launch static check | [B.3](#b3-a-syntax-error-lands-in-the-error-field) |
| 3 | Concurrency "doesn't take effect," time ≈ serial total, async-failure gathering is lost | Passed `parallel()` an array of Promises rather than functions | [B.4](#b4-parallel-passed-promises-instead-of-thunks) |
| 4 | The runtime throws, indicating a forbidden API | The script used `Date.now()` / `Math.random()` / arg-less `new Date()` | [B.5](#b5-datenow-mathrandom-throw) |
| 5 | The workflow keeps dispatching agents, tokens spike until hitting the cap | A dynamic loop has no `budget.total &&` guard | [B.6](#b6-an-infinite-loop-without-a-budget-guard) |
| 6 | On resume, a step that should be cached re-executed (cost tokens) | The script was changed / cross-session / didn't stop the previous run first | [B.7](#b7-resume-didnt-hit-the-cache) |
| 7 | The runtime throws, indicating the nesting depth is exceeded | A sub-workflow called `workflow()` again (more than one level) | [B.8](#b8-nesting-more-than-one-level-throws) |
| 8 | An agent retries repeatedly, slow to return, or unusually long | The `schema` is over-strict, hard for the model to satisfy at once | [B.9](#b9-an-over-strict-schema-causes-repeated-retries) |
| 9 | An external model/CLI "ran but produced no file," thought it failed | Mistakenly assuming `ctx_execute`/subprocess writes land on disk | [B.10](#b10-the-misconception-that-sandbox-writes-land-on-disk) |
| 10 | `parallel`/`pipeline` results contain `null`, and the subsequent `.map` errors | Didn't `.filter(Boolean)` the results | [B.11](#b11-unfiltered-null-in-the-results) |
| 11 | Agents in the progress tree don't group into the expected phase, or phase labels are scrambled | Relying on the global `phase()` inside `parallel`/`pipeline` | [B.12](#b12-the-phase-race-inside-a-concurrency-block) |
| 12 | `args` is `undefined` in the script | Didn't pass `args` when calling Workflow, or the field name is mistyped | [B.13](#b13-args-not-passed-or-field-misplaced) |
| 13 | Wanted to read the return value but got `taskId`, thought the workflow was synchronous | The Workflow tool is **always async**, the receipt ≠ the result | [B.14](#b14-mistaking-the-async-receipt-for-the-result) |
| 14 | An item in `pipeline` "vanishes" midway, the final count drops | A stage throwing makes that item `null` and skips the rest | [B.15](#b15-a-single-pipeline-item-silently-drops-out) |
| 15 | Wanted the file system/`fetch`/`require`, the runtime errors or it's undefined | The script body has no file system / Node API | [B.16](#b16-wanting-to-use-node-apis-in-the-script-body) |
| 16 | The workflow fails for no clear reason, `0 tokens` instant bailout, agents barely ran | A **synchronous throw in the body** of a `parallel()` thunk (≠ async reject) | [B.17](#b17-a-synchronous-throw-in-a-parallel-thunk-body-crashes) |
| 17 | Unconditional `JSON.parse(args)` throws, or an object gets re-parsed | `args` is **passed through unchanged**: an object stays an object, not a JSON string | [B.18](#b18-the-misconception-of-unconditional-jsonparseargs) |
| 18 | You wrapped `Date.now()` in `try/catch` but it didn't catch — the script never ran, or an aliased form threw at runtime | A literal is rejected statically at **submit** time; an aliased form is trapped at **runtime** | [B.19](#b19-trycatch-cant-catch-datenow) |
| 19 | `isolation` mistyped (e.g. `'worktreee'`) didn't error, yet the agent wasn't isolated | An unknown `isolation` value is **silently ignored**; only `'worktree'`/`'remote'` are special-cased | [B.20](#b20-a-mistyped-isolation-is-silently-ignored) |
| 20 | A mistyped `model` string wasn't rejected at submit time, so you assumed it was valid | `model` has **no submit-time validation** (unlike `agentType`, which does) | [B.21](#b21-a-mistyped-model-isnt-rejected-at-submit-time) |
| 21 | A "loop-until-dry" missing `budget.total &&` runs all the way to the 1000-agent cap | With no target set, `total===null` and `remaining()===Infinity`, so a bare `remaining()` guard never fires | [B.22](#b22-a-budget-guard-missing-the-total-short-circuit) |

---

## B.2 `meta` Rejected for Not Being a Pure Literal

<div class="callout warn">

**Symptom**: you call the Workflow tool and it immediately hands back a `WorkflowOutput` with `error`, dispatching not a single agent. Usually it's because you "casually" spliced a version number, timestamp, or some variable into `meta`.

</div>

**Cause**: the runtime statically reads `meta` **before executing the script** (it needs `name`/`description` to fill the permission confirmation dialog). This step doesn't run your code, just evaluates literals. So `meta` must be a **pure literal** — no variable references, function calls, spread operators, or template interpolation.

```javascript
// ✗ All will be rejected
export const meta = {
  name: `review-${args.target}`,        // template interpolation
  description: buildDesc(),              // function call
  phases: [...basePhases, { title:'X' }],// spread
  model: DEFAULT_MODEL,                  // variable reference
}
```

**Fix**: move the dynamic stuff into the script body — `meta` holds only static text, and you express the mutable info at runtime with `log()` / `phase()`.

```javascript
// ✓ meta is a pure literal; dynamic info goes into the script body
export const meta = {
  name: 'review',
  description: 'Review the target files for issues',
  phases: [{ title: 'Review' }],
}

phase('Review')
log(`reviewing target: ${args.target}`)   // dynamic info goes here
```

> Same-source constraint: the script's **first line must be** `export const meta = {…}`, with no other statement before it.

---

## B.3 A Syntax Error Lands in the `error` Field

**Symptom**: `WorkflowOutput.error` has a value pointing to a parse/syntax issue; the workflow never launched.

**Cause**: before dispatching any subagent, Workflow runs a syntax check on the script. If it fails → it writes the error into the `error` field and returns right away, **consuming no agents/tokens.** That's actually a good thing: it keeps "mis-written scripts" out before you spend any money.

**Fix**:

1. Read the `error` field to pin down the line and cause, fix it, and resend.
2. Once a script gets complex, land it as a `.js` file first and call it with `scriptPath` — that way you can run the basic syntax past an editor/local tools before handing it to Workflow.
3. Remember the script body is an `async` context, so you can `await` directly, but at the top level, besides a bare `return`, **don't** write illegal structures.

<div class="callout tip">

`error` (syntax-check failure) and a runtime throw are two different beasts: the former returns synchronously before launch; the latter happens mid-execution, shows up via the completion notification, and in some scenarios gets turned into `null` by `parallel`/`pipeline` (see [B.11](#b11-unfiltered-null-in-the-results), [B.15](#b15-a-single-pipeline-item-silently-drops-out)).

</div>

---

## B.4 `parallel()` Passed Promises Instead of thunks

<div class="callout warn">

**Symptom**: several agents that should run concurrently behave serially — the total time creeps up toward the sum of the agents rather than "the slowest one"; and `parallel()`'s async-failure gathering (async reject / agent error becoming `null`) is lost.

</div>

**Cause**: `parallel()` takes an **array of functions** (`Array<() => Promise>`, i.e., thunks). If you write `parallel([ agent(...), agent(...) ])`, then `agent(...)` **is called and starts executing immediately at the moment the array is constructed** — `parallel` receives Promises that are already running, so the call doesn't conform to the `parallel(thunks)` API and loses its error-gathering semantics (no way to converge a single reject into `null`). (Note: the concurrency limit is per-workflow regardless, not something `parallel()` itself toggles.)

```javascript
// ✗ Executes immediately; doesn't conform to parallel(thunks), loses async-failure gathering (async reject → null)
const r = await parallel([
  agent('task A', { schema: S }),
  agent('task B', { schema: S }),
])

// ✓ Pass thunks, let parallel control scheduling
const r = await parallel([
  () => agent('task A', { schema: S }),
  () => agent('task B', { schema: S }),
])
```

**Fix**: always wrap it in `() => agent(...)`. Same when you generate them with `.map`:

```javascript
const r = await parallel(items.map(it => () => agent(prompt(it), { schema: S })))
```

> Real confirmation: `parallel-demo` (Run `wf_52957913-6d2`) clocked 3 thunks at 8.4s ≪ 3×5.5s — concurrency genuinely kicked in (data in the [primitives run record](#/en/p2-08)). That's exactly what the thunk form buys you.

---

## B.5 `Date.now()` / `Math.random()` Throw

**Symptom**: the script throws at runtime, with the finger pointed at `Date.now()`, `Math.random()`, or arg-less `new Date()`.

**Cause**: all three break **replayability.** Resume (`resumeFromRunId`) rests on "the same script + the same input → the same execution path," which is how the runtime can tell which `agent()` calls are unchanged and reuse the cache directly. Once a nondeterministic source sneaks into the script, replay can't line up, so the runtime **forbids** these three outright.

**Fix**:

| You want | Use instead |
|---|---|
| A timestamp (naming/stamping) | Pass it in from outside via `args`: `args.runStamp`; or stamp it via the main loop after the workflow returns |
| Randomness/spreading | Vary the prompt using the agent's **index** (e.g., the `i` in `parallel(items.map((it,i)=>...))`), not true randomness |
| A unique ID | Concatenate from stable sources: item content, index, a seed passed in via `args` |

```javascript
// ✗ Throws at runtime
const ts = Date.now()

// ✓ The timestamp passed in from outside (caller: Workflow({ script, args:{ runStamp: '<synchronously stamped>' } }))
const ts = args.runStamp
```

> Standard JS built-ins (`JSON`/`Math`'s other methods/`Array`…) still work fine — only these three nondeterministic sources are forbidden.

---

## B.6 An Infinite Loop Without a `budget` Guard

<div class="callout warn">

**Symptom**: the workflow won't quit, dispatching agents round after round, `budget.spent()` climbing all the way, until it finally hits the "1000-agent total per workflow" fallback cap — or hits `budget.total` and throws, if the user set a target.

</div>

**Cause**: a dynamic loop ("loop-until-dry," "retry until pass," and the like), if it only watches the business condition and ignores the budget, will iterate forever whenever the model keeps failing to converge. `budget` is a **hard cap**: calling `agent()` after `spent()` reaches `total` throws — but you shouldn't lean on it as the fallback; you should guard proactively.

**Fix**: write both the business criterion and the budget criterion into the loop condition. Note `budget.total` may be `null` (the user set no target, in which case `remaining()` is `Infinity`), so use a `budget.total &&` short-circuit guard, to keep from exiting early when "no target is set."

```javascript
let round = 0
const MAX_ROUNDS = 5
let done = false

while (!done && round < MAX_ROUNDS) {
  // Budget guard: only when the user set a target (total non-null) and there's less than one round left, stop early
  if (budget.total && budget.remaining() < 30_000) {
    log(`budget guard: ${budget.remaining()} left, stopping early`)
    break
  }
  const r = await agent(`round ${round} ...`, { schema: S })
  done = r.converged
  round++
}
```

> Two guardrails: ① your own `MAX_ROUNDS` + budget guard (proactive, a graceful exit); ② the runtime's 1000-agent fallback (passive, anti-runaway). Production scripts should close out via ①, not touch ②. See [Chapter 21 · Dynamic Budget & Scaling](#/en/p4-21).

---

## B.7 Resume Didn't Hit the Cache

**Symptom**: resuming with `resumeFromRunId`, you expected the earlier-run steps to come back instantly (zero tokens), but they **re-executed**, costing time and tokens.

**Cause**: the bar for a cache hit is strict; miss any one condition and the corresponding `agent()` re-runs:

| Condition | Description |
|---|---|
| The script is **unchanged letter-for-letter** | Changing the script (even one line of comment) re-executes the calls after it |
| The **same session** | Resume is valid only in the same session; cross-session the cache is unavailable |
| **Stop the previous run** first | Before resuming, `TaskStop` the previous Task, then resend with `resumeFromRunId` |
| The script is **replayable** | Containing `Date.now()` and other nondeterministic sources breaks alignment (see [B.5](#b5-datenow-mathrandom-throw)) |

**Fix**:

- To **reuse** earlier results (changing only the latter part): keep the earlier script letter-for-letter unchanged, and put your changes only after the spot you want to re-run.
- To **force a re-run** of some segment: deliberately change it (the cache is judged by "whether the call changed").

> Real confirmation: an unchanged `hello-workflow` resumed with `resumeFromRunId` measured `total_tokens=0`, `tool_uses=0`, `duration_ms=8`, with a return value identical to the first (Run `wf_dacbd480-d5d` reused, Task `w7pxch4w6`). That's what a "hit" literally looks like — if your resume doesn't look like this, walk the table above item by item. See [Chapter 22 · Resume & Caching](#/en/p4-22).

---

## B.8 Nesting More Than One Level Throws

**Symptom**: inside a sub-workflow that `workflow()` inline-called, you call `workflow()` again, and the runtime throws.

**Cause**: nesting **allows one level only.** Parent → child is fine; child → grandchild throws. It's a deliberate guardrail against runaway recursion (the sub-flow shares the parent's concurrency limit, agent count, abort signal, and token budget; nest infinitely and those shared resources lose their bounds).

**Fix**:

- **Flatten** the "grandchild-level" logic into the sub-workflow itself (write `agent()`/`parallel()`/`pipeline()` directly, instead of another `workflow()`).
- If you genuinely need multi-level orchestration, have the **main loop** chain several one-level nestings, rather than recursing deep inside the script.

```javascript
// ✗ Nesting again inside a sub-workflow → throws
// child.js: const x = await workflow({ scriptPath: './grandchild.js' })

// ✓ Flatten the logic into the sub-workflow
// child.js:
phase('Work')
const x = await agent('do the grandchild logic directly', { schema: S })
```

> Real confirmation: a parent workflow inline-ran a hello sub-flow via `workflow({scriptPath})` and it worked, with the child agent counting toward the parent flow's `agent_count=1`/`total_tokens=26338` (Run `wf_85e22b38-126`) — that's **one** level, normal. See [Chapter 20 · Nested Workflows](#/en/p4-20).

---

## B.9 An Over-Strict `schema` Causes Repeated Retries

**Symptom**: some agent with a `schema` is slow to return, or runs noticeably long; on the progress view it looks "stuck."

**Cause**: a `schema`'s validation happens at the **tool-call layer** — the model must call the `StructuredOutput` tool and output a strict match to the schema, or **retry.** If the schema is over-strict (say an incomplete `enum`, a `required` field the model can't reliably produce, a too-narrow numeric `pattern`/range), the model may need many tries before it happens to land one, which shows up as a slowdown or near-giving-up.

**Fix**: make the schema "pin down the product's shape, but leave the model reasonable room to express itself."

- `enum` should cover every legal value the model might give; if you're unsure, run a round with `string` first to see the real output, then narrow.
- `required` should list only **genuinely necessary** fields; don't force optional info.
- Split complex nested structures into two stages (produce text first, then structure) — steadier than going for it in one shot.
- A validation failure retries, so "the occasional retry" is normal; only **persistent** retries mean the schema needs loosening.

```javascript
// ✗ Over-strict: enum missing items + forcing the model to estimate a field it can't give accurately
schema: { type:'object', properties:{
  severity:{ type:'string', enum:['critical','high'] },   // missing medium/low
  exactLineNumber:{ type:'integer' },                      // the model often can't give accurately
}, required:['severity','exactLineNumber'] }

// ✓ Cover the full enum; force only necessary fields
schema: { type:'object', properties:{
  severity:{ type:'string', enum:['critical','high','medium','low'] },
  location:{ type:'string' },        // use a descriptive string, don't force an exact line number
}, required:['severity'] }
```

> Counter-reference: the `FINDINGS` schema used by `frontend-review` set `severity` as a four-value `enum` and the rest as `string`, and 4 agents cranked out 26 findings smoothly, no stalling (Run `wf_4c5caabb-b73`). See [Chapter 7 · Structured Output & Schema](#/en/p2-07).

---

## B.10 The Misconception That Sandbox Writes Land on Disk

<div class="callout warn">

**Symptom**: you have an agent (or use `ctx_execute` / a Bash subprocess in analysis) "generate a file / write a result," then can't find it on disk later, and misjudge it as "it failed" or "the external model produced nothing."

</div>

**Cause**: **only the native Write/Edit tools land file writes on disk.** `ctx_execute` and Bash subprocesses run in a subprocess that's thrown away after use; their writes to the file system **don't persist** to the host. Same goes for the script body itself — it **has no file-system API**, and its "product" is `agent()`'s **return value** (text or a structured object), not a disk file.

**Fix**:

- To land a file on disk: have the workflow **return content** and let the main loop write it with Write/Edit; or spell it out in the agent's prompt to **call the Write tool** (agents have real tool permissions).
- Don't take "the external model ran in the sandbox but there's no file on disk" as failure — first check whether its product came back as a **return value.**
- Using `ctx_execute` for analysis-type computation is fine (as long as you only `console.log` the conclusion), but don't count on the files it writes still being there.

```javascript
// The workflow hands content back as a return value, the main loop is responsible for landing it on disk
phase('Generate')
const doc = await agent('Write the migration guide as markdown. Return the full text.',
  { schema:{ type:'object', properties:{ markdown:{type:'string'} }, required:['markdown'] } })
return doc            // ← the main loop gets doc.markdown and lands it with Write
```

---

## B.11 Unfiltered `null` in the Results

**Symptom**: the array returned by `parallel()` / `pipeline()` contains `null`, and the very next `.map(r => r.field)` throws `Cannot read properties of null`.

**Cause**: both primitives use `null` to mean "this item has no valid result":

- `parallel`: a thunk's **asynchronous failure** (a returned promise rejecting, or an inner `agent()` erroring) → that position is `null`, and the call itself doesn't reject. Note: a **synchronous `throw` in the thunk body does NOT become `null`** — it rejects the whole call and crashes the workflow (see [B.17](#b17-a-synchronous-throw-in-a-parallel-thunk-body-crashes)).
- `pipeline`: an item **throws** at some stage (synchronously or asynchronously) → that item becomes `null` and skips the rest.
- `agent`: the user **skips** the agent midway → returns `null`.

**Fix**: always `.filter(Boolean)` before you consume the results.

```javascript
const results = (await parallel(thunks)).filter(Boolean)   // ✓ filter out null first
const titles = results.map(r => r.title)                   // now safe
```

> When you merge across stages inside a `pipeline`, defend there too: if the previous stage might give `null`, the next stage's callback should check for null first (or make sure it only continues on the filtered set). See [Chapter 8 · parallel vs pipeline](#/en/p2-08).

---

## B.12 The `phase()` Race Inside a Concurrency Block

**Symptom**: once you use `parallel`/`pipeline`, agents in the progress tree group into the wrong phase, or the phase labels look like they're "fighting" over each other.

**Cause**: the global `phase()` is **stateful** — it switches the "current phase," and the `agent()` calls after it group into that phase. But in `parallel`/`pipeline`, multiple agents run **concurrently**, and if they all lean on that global current phase, they race each other (call order is indeterminate), and the grouping gets scrambled.

**Fix**: inside `parallel`/`pipeline`, **always use `opts.phase` for explicit grouping**, don't rely on the outer `phase()`. The `opts.phase` string must match `meta.phases[].title` exactly.

```javascript
// ✓ Each concurrent agent carries its own phase, not contending for global state
const reviews = await parallel(dims.map(d => () =>
  agent(d.prompt, { label:`review:${d.key}`, phase:'Review', schema:FINDINGS })))
```

> The real scripts of `frontend-review` and `judge-panel` both write `phase:'Review'`/`phase:'Judge'` on each one inside `parallel`, for exactly this reason. See [Chapter 5 · meta & phase](#/en/p2-05).

---

## B.13 `args` Not Passed or Field Misplaced

**Symptom**: reading `args.foo` in the script gives `undefined`, and the logic all takes the empty branch.

**Cause**: `args` is the value of the Workflow input `args`; **not passing it** means `undefined`. Common culprits: forgetting `args` at call time, mistyping the field name, or mixing up the level of `args` with `name`/`script`.

**Fix**:

```javascript
// Caller: args is a top-level field of WorkflowInput
// Workflow({ script: '...', args: { target: 'src/auth', maxRounds: 3 } })

// In the script: provide a default fallback first, don't assume it exists
const target = args?.target ?? 'src'
const maxRounds = args?.maxRounds ?? 5
```

> `args` is a great fit for parameterizing a **named workflow** (`name` + `args`), reusing the same logic across different inputs. See [Appendix A](#/en/app-a).

---

## B.14 Mistaking the Async Receipt for the Result

**Symptom**: you expect the Workflow tool to hand back the workflow's "final result," but get `{ status, taskId, runId, ... }` instead, so you either think it didn't run or try to read the return value straight off.

**Cause**: the Workflow tool is **always async.** It immediately hands back a **receipt** (`status` will only be `"async_launched"` or `"remote_launched"`), and the workflow runs in the background. The **actual return value and usage statistics** (`agent_count`/`tool_uses`/`total_tokens`/`duration_ms`) arrive via the `<task-notification>` on completion.

**Fix**:

- Hang on to the `taskId`/`runId`: the former for tracking/stopping (TaskStop), the latter for resume (`resumeFromRunId`).
- To watch live progress, use the slash command `/workflows`.
- To get the result, **wait for the notification** — don't go hunting for result fields in the receipt.

> Real form: across the first batch, all 10 completion records / 9 unique Run IDs had receipts giving `taskId`+`runId` first, with all usage numbers coming from the completion notification (see [Appendix E](#/en/app-e)).

---

## B.15 A Single pipeline Item Silently Drops Out

**Symptom**: `pipeline(items, ...)` got N items, but in the end `out.filter(Boolean).length < N` — some items "gone," yet no obvious error shown.

**Cause**: `pipeline`'s fault-tolerance granularity is **per item** — an item throwing at any stage immediately makes **that item** `null` and skips **all its remaining stages**, while the other items carry on unaffected. This is a virtue (one bad item doesn't drag down the whole batch), but if you only eyeball the final count you'll think "data lost."

**Fix**:

- Accept it as designed behavior: read `null` as "this item failed at some stage and got safely skipped."
- To find out **why** it dropped: carry status in a structured return inside the stage, or have that stage's `agent` schema carry an `ok`/`reason` field, then tally afterward.
- If dropping items isn't allowed on the critical path, `try` within each stage and return a "degraded result" instead of throwing, so that item keeps flowing onward.

```javascript
const out = await pipeline(items,
  (it) => agent(`stage1 ${it}`, { phase:'S1', schema:A }),
  (r, it) => agent(`stage2 ${it}`, { phase:'S2', schema:B }),
)
const ok = out.filter(Boolean)
log(`pipeline kept ${ok.length}/${items.length} items`)   // explicitly record dropouts
```

> Real confirmation: `pipeline-demo` 3 items × 2 stages all survived, `agent_count=6`, returning 3 (Run `wf_bf086b98-6ec`) — no dropouts, because no stage threw. See [Chapter 8 · parallel vs pipeline](#/en/p2-08).

---

## B.16 Wanting to Use Node APIs in the Script Body

**Symptom**: you write `require(...)`, `fs.readFile`, `fetch(...)`, `process.env` in the script, and the runtime reports undefined or throws.

**Cause**: the script body is a **restricted `async` sandbox**: standard JS built-ins (`JSON`/`Math`/`Array`/`Object`/`Promise`…) are available, but there's **no** file system, network, `require`, or Node-global capability. A workflow's "side effects" all run through the subagents `agent()` dispatches — they (not the script body) hold real tool permissions.

**Fix**:

| You want to | In the script body | Correct approach |
|---|---|---|
| Read a file | ✗ `fs.readFile` | Have the agent read: `agent('Read src/x.ts and summarize ...')` |
| Network/fetch | ✗ `fetch` | Have the agent fetch with its tools, or pass the data in via `args` beforehand |
| Write a file | ✗ `fs.writeFile` | The agent calls the Write tool, or return content for the main loop to land (see [B.10](#b10-the-misconception-that-sandbox-writes-land-on-disk)) |
| Import a third-party library | ✗ `require('lodash')` | Implement with standard JS built-ins, or hand the computation to an agent |
| Read environment variables | ✗ `process.env` | Pass the needed values in explicitly via `args` |

```javascript
// ✗ The script body has no Node API
const src = require('fs').readFileSync('src/auth.ts', 'utf8')

// ✓ Have the subagent read, the script body only orchestrates
const review = await agent('Read src/auth.ts and list security issues.',
  { schema: FINDINGS })
```

---

## B.17 A Synchronous Throw in a `parallel` Thunk Body Crashes

<div class="callout warn">

**Symptom**: a `parallel()` call that should be "best-effort" instead **fails the whole workflow for no clear reason** — the receipt/notification shows status `failed`, `total_tokens=0`, a `duration_ms` of only tens of milliseconds, and almost no agent actually ran (a "`0 tokens` instant bailout"). You assumed "a thunk that throws just becomes `null`," yet the whole batch crashed together.

</div>

**Cause**: this is the **sibling pitfall** of [B.4](#b4-parallel-passed-promises-instead-of-thunks) — B.4 is "passing the wrong type (Promises instead of thunks)," while this one is "passing thunks correctly, but throwing **synchronously inside the thunk body.**" `parallel()` **calls** the thunks one by one: if a thunk body has a synchronous `throw` (a bare `throw`, a failed `JSON.parse`, an assertion, an index out-of-bounds), the exception propagates upward **before** `parallel()` has gotten hold of the promise, so it gets **no chance to collect that slot into `null`**, and the whole `parallel()` call **rejects**; without an outer `try/catch`, the **workflow fails.** Note: the tool's line "a thunk that throws resolves to null" holds only for a **returned promise's async reject**, not for a **synchronous throw.**

```javascript
// ✗ Synchronous throw in the thunk body → the whole parallel() rejects → workflow fails (0-token instant bailout)
await parallel([
  () => agent('ok-1'),
  () => { throw new Error('boom') },                 // sync throw, pierces parallel
  () => agent('ok-2'),
])

// ✓ Move the risky logic inside the awaited agent() call (only the async path is collected into null)
await parallel([
  () => agent('ok-1'),
  () => agent('do the risky thing'),                  // risk on the async path → an error becomes null
  () => agent('ok-2'),
])

// ✓ Or try/catch it yourself, degrading a synchronous failure into a filterable null
await parallel([
  () => agent('ok-1'),
  async () => { try { return riskySync() } catch { return null } },
  () => agent('ok-2'),
])
```

**Fix**:

- **Move the risky synchronous logic into the async path of `agent()`** — `parallel()` only does the "→ `null`" gathering for an async reject.
- If you must run a synchronous computation in the thunk body, **`try/catch` it yourself** and return `null` (or a degraded value); don't let it throw bare.
- Always `.filter(Boolean)` before you consume results (see [B.11](#b11-unfiltered-null-in-the-results)) — but remember: `.filter(Boolean)` only removes the `null` produced by an **async reject**; it **cannot stop a synchronous throw** (by then the workflow has already crashed and never reaches the filter).

> Real confirmation: a script of just `parallel([ok, () => { throw ... }, ok])` measured workflow status **failed**, `agent_count=1`, `total_tokens=0`, `duration_ms=26` (Run `wf_ed5e87f3-435`). The difference between a synchronous throw and an async reject got confirmed from the other side in Run `wf_74ebe5ac-2db` (async reject → that slot `null`, the rest survive, workflow completes). For the full contrast and the mechanism, see [Chapter 8 · §8.8 Error Semantics](#/en/p2-08).

---

## B.18 The Misconception of Unconditional `JSON.parse(args)`

<div class="callout warn">

**Symptom**: you write `const cfg = JSON.parse(args)` in the script, and it either throws `Unexpected token o in JSON` (because `args` is already an object, gets `String()`-ed into `"[object Object]"`, then fails to parse) or "parses wrong" an already-nested object. You assumed `args` is a chunk of JSON text, when it's actually an **already-deserialized object.**

</div>

**Cause**: `args` is the **verbatim** value of the Workflow input `args` — **an object stays an object, an array stays an array**; the runtime does **not** stringify it. Passing in `{ hello:'world', n:5, nested:{ deep:true } }`, the script saw `typeof args === 'object'`, the fields came through unchanged, and `Array.isArray(args) === false` (Run `wf_59bf3654-183`, see [Appendix E · R4 sandbox record](#/en/app-e)). Calling `JSON.parse` on a value that's already an object means an implicit `String(object)` to `"[object Object]"` first, then a parse — which inevitably fails.

**Fix**: **normalize first, then read fields.** Only `JSON.parse` (with `try/catch`) when `typeof args === 'string'`; otherwise use it as an object directly. Never `JSON.parse(args)` unconditionally.

```javascript
// ✗ Unconditional parse: throws outright when args is an object
const cfg = JSON.parse(args)

// ✓ The normalization idiom: parse only a string, treat the rest as an object as-is
function readArgs(a) {
  if (a == null) return {}
  if (typeof a === 'string') {
    try { return JSON.parse(a) } catch { return {} }   // tolerant: empty object on parse failure
  }
  return a                                              // already object/array: return as-is
}

const cfg = readArgs(args)
const target = cfg.target ?? 'src'
```

> Companion: when `args` isn't passed it's `undefined`, and a misplaced field reads `undefined` too, see [B.13](#b13-args-not-passed-or-field-misplaced); the emphasis here is on **type** — it's an object, not a string.

---

## B.19 try/catch Can't Catch `Date.now()`

<div class="callout warn">

**Symptom**: "to be safe" you wrap `const ts = Date.now()` in a `try/catch`, expecting the fallback branch on failure — and instead **the whole workflow never launches** (the receipt is just an `error` field), and your `catch` never runs. A different form (`const D = Date; D.now()`) does run, but throws at runtime.

</div>

**Cause**: the determinism ban is **two layers**, neither of which your `try/catch` can intercept:

1. **A literal is rejected statically at submit time**: the **literal forms** of `Date.now()` / `Math.random()` / arg-less `new Date()` get caught by a **source static scan** *before* the script is parsed/run — the script doesn't execute at all, and the tool returns an error directly (verbatim: `Workflow scripts must be deterministic: Date.now()/Math.random()/new Date() are unavailable (breaks resume)…`, see `sandbox-r4.md`). The script never ran, so there's nothing for `try/catch` to do.
2. **An aliased form is a runtime trap**: "hiding" the call (`const D = Date; D.now()`) fools the static scan and gets through submission, but the runtime-injected trap **throws** — `Date.now() / new Date() are unavailable in workflow scripts (breaks resume)…`; the `Math.random()` one even suggests the fix: `…For N independent samples, include the index in the agent label or prompt.` (both layers tested, Run `wf_59bf3654-183`).

**Fix**: don't try to "bypass" or "catch" it — sidestep it at the root per [B.5](#b5-datenow-mathrandom-throw): pass timestamps via `args` or stamp afterward, and vary the prompt by agent index for randomness.

```javascript
// ✗ Literal: rejected statically at submit, the script doesn't run, the catch is a no-op
try { const ts = Date.now() } catch { /* never reaches here */ }

// ✗ Aliased: fools the static scan, but throws at runtime
const D = Date; const ts = D.now()      // throws at runtime

// ✓ Avoid at the source (see B.5)
const ts = args.runStamp                // passed in from outside, replayable
```

> Why so strict? Because resume needs "same script + same input → same execution path," and any nondeterministic source breaks that alignment. The two-layer ban exists precisely to make it **impossible** to smuggle nondeterminism into a replayable script.

---

## B.20 A Mistyped `isolation` Is Silently Ignored

<div class="callout warn">

**Symptom**: you want an agent that edits files to run in an isolated git worktree, and write `isolation: 'worktreee'` (one extra e). **No error of any kind**, the agent returns normally — but it was actually **not isolated**, sharing the same working directory as the other agents, and collides on parallel file edits just the same. It's an insidious pothole: the mistake hides behind the look of "success."

</div>

**Cause**: the runtime special-cases only **two values** of `isolation` — `'worktree'` (execution isolation) and `'remote'` (disabled in this build, throws `agent({isolation:'remote'}) is not available in this build`); **any other unknown value is silently ignored**, and the agent runs normally on the default (no isolation). Tested, `isolation: 'totally-bogus'` **did not throw and returned OK**; only `'remote'` threw (Run `wf_dace2fc6-966`, see [Appendix E · R4 opts-validation record](#/en/app-e)). So a mistyped `'worktreee'` is equivalent to "no isolation written."

**Fix**: when you write `isolation`, **verify letter-for-letter** that it's exactly `'worktree'`; don't count on a runtime error to catch the typo. For when isolation is warranted, see [Chapter 19](#/en/p4-19) (use it only when parallel file edits would collide; it's expensive).

```javascript
// ✗ Mistyped, silently ignored: the agent isn't isolated, parallel edits still collide, and no error
await agent('refactor src/auth.ts', { isolation: 'worktreee' })

// ✓ Spelled letter-for-letter
await agent('refactor src/auth.ts', { isolation: 'worktree' })
```

> Contrast: a mistyped `agentType` **throws immediately** (see the end of [B.21](#b21-a-mistyped-model-isnt-rejected-at-submit-time)), yet a mistyped `isolation` gets swallowed — both are opts fields, but their validation strictness differs, so keep straight which ones "error vs stay silent."

---

## B.21 A Mistyped `model` Isn't Rejected at Submit Time

<div class="callout warn">

**Symptom**: you mistype `model: 'opus'` as `model: 'oputs'`, expecting it to be blocked at submission — instead the script submits fine, the agent runs normally, and you wrongly assume this model name is valid.

</div>

**Cause**: a `model` string has **no submit/parse-time validation.** Tested, an obviously nonexistent `model: 'totally-not-a-real-model-xyz'` was neither rejected at submit nor kept the agent from returning OK (Run `wf_dace2fc6-966`).

<div class="callout info">

**The honest limit of the test**: in this session `CLAUDE_CODE_SUBAGENT_MODEL` overrode every per-call `model` (everything ran Opus), so that bogus string was **never actually sent to an API** — the step "a typo fails at the API call" **could not be observed** in this session (a community third-party source claims this; this book did not independently verify it). All we can confirm is one thing: **no error at submit time.**

</div>

**Contrast `agentType` (which is validated)**: an unknown `agentType` throws *before any model is spawned* (0 tokens / 4 ms) and lists every available agent — verbatim `agent({agentType}): agent type '…' not found. Available agents: claude, claude-code-guide, codex:codex-rescue, Explore, general-purpose, …` (Run `wf_a222f20f-0f5`). This asymmetry — "`agentType` strictly validated, `model` not" — is a real, teachable difference.

```javascript
// ✗ Mistyped model: no error at submit, you get no early feedback
await agent('do x', { model: 'oputs' })          // passes silently

// ✗ Mistyped agentType: throws immediately and lists available agents (0 tokens)
await agent('do x', { agentType: 'code-reviewr' })   // throws

// ✓ Verify both letter-for-letter; model especially has no "typo safety net"
await agent('do x', { model: 'opus', agentType: 'Explore' })
```

> Practical implication: a mistyped `model`'s cost is **deferred** (worst case it surfaces only at the API layer), so lean on code review / the validator (see [Appendix E · validator-r4](#/en/app-e)) to catch it before submission; don't count on the runtime to cover for you.

---

## B.22 A `budget` Guard Missing the `total` Short-Circuit

<div class="callout warn">

**Symptom**: a "loop-until-dry / retry-until-pass" dynamic loop that's meant to stop early via a budget guard, but written as `if (budget.remaining() < 30000) break`. When the **user set no token target**, this guard **never fires**, and the loop runs all the way to the runtime's **1000-agent official fallback cap** before it's forced to stop, burning a heap of tokens.

</div>

**Cause**: with no target set, `budget.total === null` and `budget.remaining()` returns **`Infinity`** (tested `total===null` in Run `wf_59bf3654-183`; the budget probe `wf_fd09a6ed-38a` measured a return of `{ totalIsNull:true, remainingBefore/After:"Infinity", guardRounds:0 }`, see `r3-reverification.md`). So `Infinity < 30000` is always `false`, and the guard is as good as absent; and if you treat the guard as the **sole** loop exit, the loop is left with only the business condition as a backstop — once the business doesn't converge, it runs straight into the 1000 cap.

This is in fact the **precise version** of [B.6](#b6-an-infinite-loop-without-a-budget-guard): B.6 says "have a budget guard," while this entry says the guard **must** use a `budget.total &&` short-circuit, or it simply doesn't work in the most common case of "no target set."

**Fix**: **always** write the guard as `budget.total && budget.remaining() < threshold` — let it take effect only when the user genuinely set a target (`total` non-null); and **always** pair it with an independent `MAX_ROUNDS` hard cap as the backstop for "no target set."

```javascript
// ✗ Missing the total short-circuit: with no target, remaining()===Infinity, the guard never fires, runs to the 1000 cap
while (!done) {
  if (budget.remaining() < 30_000) break      // Infinity < 30000 → always false
  const r = await agent(`round ${round++} ...`, { schema: S })
  done = r.converged
}

// ✓ The total short-circuit + an independent round hard cap (neither gate depends on the other)
let round = 0
const MAX_ROUNDS = 5
while (!done && round < MAX_ROUNDS) {          // ① the backstop when no target is set
  if (budget.total && budget.remaining() < 30_000) {   // ② effective only when a target is set
    log(`budget guard: ${budget.remaining()} left, stopping`)
    break
  }
  const r = await agent(`round ${round} ...`, { schema: S })
  done = r.converged
  round++
}
```

> How the two guardrails split the work: `MAX_ROUNDS` (proactive, effective even with "no target set") + the `budget.total &&` guard (a precise close-out for "a target is set") + the runtime's 1000-agent fallback (passive, anti-runaway). Production scripts should close out via the first two, and **never** treat 1000 as a normal exit point. See [Chapter 21 · Dynamic Budget & Scaling](#/en/p4-21).

---

## B.23 Troubleshooting Mantra (Closing)

Boil the potholes above down to three transferable judgments:

1. **Did the failure happen "before launch" or "during execution"?** Before launch → check the `error` field (`meta`/syntax, [B.2](#b2-meta-rejected-for-not-being-a-pure-literal)/[B.3](#b3-a-syntax-error-lands-in-the-error-field)), costs nothing; during execution → check the completion notification and `null` ([B.5](#b5-datenow-mathrandom-throw)/[B.11](#b11-unfiltered-null-in-the-results)/[B.15](#b15-a-single-pipeline-item-silently-drops-out)).
2. **Did you mistake the "sandbox" for the "host"?** The script body has no Node API, and `ctx_execute`/subprocess writes don't land on disk — side effects and file operations all go through agents' real tools ([B.10](#b10-the-misconception-that-sandbox-writes-land-on-disk)/[B.16](#b16-wanting-to-use-node-apis-in-the-script-body)).
3. **Are you fighting "replayability/determinism"?** Forbid nondeterministic sources, and resume hits strictly by "the script unchanged letter-for-letter + same session" — what this set of constraints buys you is a deterministic skeleton and zero-cost caching ([B.5](#b5-datenow-mathrandom-throw)/[B.7](#b7-resume-didnt-hit-the-cache)).

> Companion reading: the checkable positive checklist is in [Appendix C · Best Practices](#/en/app-c); for unclear terms see [Appendix D · Glossary](#/en/app-d); for field semantics see [Appendix A · Full API Reference](#/en/app-a).

---

## B.24 Cross-Platform Corner Cases (Windows / macOS / Linux)

> Premise (running through this section): all of this book's hands-on tests ran on a **single macOS machine (Darwin 25.5.0)**, with **no Windows / Linux test data whatsoever**. So every entry here is strictly graded into two evidence classes — **[platform-independent · verified]** (the behavior happens at the JS-runtime layer, OS-independent; the mechanism is "the same JS engine runs the same script," so even though we only ran it on macOS, the conclusion holds for all three platforms) and **[inferred · untested]** (the behavior **really may differ by platform**, things like paths, case sensitivity, shell, git; these **can only be inferred from the mechanism + general knowledge**, are explicitly labeled "not tested on Windows / Linux," and are **never written as verified, settled conclusions**).

### What This Section Wants to Tell Workflow Authors

The workflow script you write will eventually be distributed to run on other people's machines — maybe a colleague's Windows laptop, maybe a Linux container in CI, maybe a case-sensitive deployment environment like GitHub Pages. **A script that runs fine on your Mac may go off the rails on another machine.** Which parts will break and which are rock-solid — you need to tell them apart first.

The single most important intuition: **the workflow script body runs inside a JS sandbox, and this sandbox is the same on all three platforms.** So script-logic-level behavior (the determinism guard, how `args` gets passed, the absence of `require/process/fetch`, the 30000ms synchronous timeout, how errors propagate upward) — **has nothing whatsoever to do with whether you're on Windows or Linux.** What truly varies by platform all happens **outside the sandbox**: either you had a subagent touch the file system/shell inside an `agent()` leaf (that's where the real OS gets touched), or external facilities like git worktree and the deployment environment.

Let's break the two classes apart below.

### B.24.1 The Platform-Independent Half (Verified, Consistent Across Three Platforms)

These behaviors all happen at the JS-runtime layer. The mechanism is simple: **the workflow's script sandbox is the same JS-engine implementation; all three platforms run the same code down the same decision logic.** So this book's macOS-verified conclusions extrapolate directly to Windows / Linux — this isn't "guessing they're the same," it's "they were the same layer to begin with."

**① The determinism guard is a source-string-level scan — it rejects even a token inside a string.** Evidence class: **[platform-independent · verified]** (verified on macOS, the mechanism dictates consistency across three platforms). Workflow forbids `Date.now()` / `Math.random()` / arg-less `new Date()` (rationale: they break replayability, and resume falls apart). This static scan **does not distinguish "a real call" from "merely mentioned in a string"** — even if these three tokens sit wrapped in a string literal and **never execute** from start to finish, the whole workflow gets rejected at **submit** time, verbatim error:

```
Workflow scripts must be deterministic: Date.now()/Math.random()/new Date() are unavailable (breaks resume). Stamp results after the workflow returns, or pass timestamps via args.
```

Why this is platform-independent: the scan happens **before** Claude Code receives the script and submits it to the Workflow runtime; it's pure source-text matching — submit the same script containing such a string on Windows, macOS, or Linux and it's **rejected the same way on all of them.** The real corner case is this: if your agent prompt text **wants to mention these three APIs** (say you're writing a "teach the agent not to use nondeterministic APIs" workflow, where the prompt naturally writes "don't use `Date.now()`"), **the whole workflow gets caught by this scan as collateral damage and rejected outright.**

```javascript
// Scenario: the prompt genuinely needs to mention these API names
// Workaround A: split and concatenate the token so the static scan can't match the full string
const apiName = 'Date' + '.now()';        // the scanner sees two fragments, not a full token
const warn = 'Do not call ' + 'Math' + '.random() in the script';

// Workaround B: reword so the full token never appears
const warn2 = 'Do not use time/random APIs that break replayability (e.g., the current millisecond count, pseudo-random numbers)';
```

<div class="callout warn">

**Collateral-damage pitfall**: the guard scans source text, not real calls. Writing `Date.now()` in a string for documentation/prompt purposes will also make the whole script fail to submit. Either split-and-concatenate (`'Date'+'.now()'`) or reword it. This is platform-independent — all three platforms reject it alike.

</div>

**② `args` is passed through unchanged; you must normalize before reading fields.** Evidence class: **[platform-independent · verified]** (`wf_59bf3654-183`). You pass in `{hello, n, nested:{deep}}`, and in the script `args` is just an object: `typeof args === 'object'`, `Array.isArray(args) === false`, and it **won't be stringified**; don't pass it and `args` is `undefined`. This behavior is set by the JS-runtime injection, **consistent across three platforms.** Practical reminder (also a platform-independent pitfall): **don't `JSON.parse(args)` unconditionally** — only parse (with try/catch) when `typeof args === 'string'`, otherwise an object will make your parse throw.

**③ Host APIs absent: `require` / `process` / `fetch` are all `undefined`.** Evidence class: **[platform-independent · verified]** (`wf_59bf3654-183`). The script sandbox **has none** of the Node set: `require`, `process`, `fetch` are all `undefined`, no file system, no network. This is the sandbox design, **so on all three platforms** — there's no such thing as "you can `require` on Windows but not on Mac." This directly yields an **architectural iron rule** (crucial for cross-platform): **anything that touches files, shell, or network can only go inside an `agent()` leaf** (only subagents have Read/Write/Bash). Put differently — **the script body is always platform-independent; all platform differences are squeezed into the `agent()` leaf layer.** If you want to know "will my workflow have a problem on Windows," all you need to watch is what the `agent()` leaves do (see B.24.2).

**④ The 30000ms synchronous timeout and error-propagation semantics.** Evidence class: **[platform-independent · verified]** (`wf_e3b2b123-5f4`, measured aborted at 30222ms). A long synchronous loop (`for(i=0;i<1e12;i++)`) gets aborted by the runtime at 30000ms, the workflow marked failed, with the error `Error: Script execution timed out after 30000ms`. This cap constrains only **synchronous** execution (catching dead loops); async workflows aren't bound by it. It's the runtime's watchdog, **platform-independent** — it won't turn into a different number because of Windows's clock precision or Linux's scheduling policy. Error propagation likewise lives at the JS-runtime layer and is consistent across three platforms, but you must **distinguish three cases — don't conflate them** (matching the comparison table in [Chapter 8 / p2-08](#/en/p2-08)): an **asynchronous** error — a thunk/stage's returned Promise rejecting, or `agent()` itself failing — turns only **that one** slot/item into `null`, while the rest run to completion and the workflow is still judged success (`wf_bbeb54c0-750`: `parallel` got `['P0', null, 'P2']`, `pipeline` got `['S2-A', null]`); **a `pipeline` stage's synchronous `throw` is also isolated to `null`** (`wf_76a9b42b-86f`: `['S2-A<-S1-A', null, 'S2-C<-S1-C']` — that item skips its remaining stages, the other items run on, the workflow succeeds); **the only thing that crashes the whole workflow is a synchronous `throw` in a `parallel` thunk body** — it escapes the "collect into `null`" logic before `parallel` ever gets a promise, and marks the run failed (`wf_6cc89add-680`, terminating at 0 tokens; see also [B.17](#b17-a-synchronous-throw-in-a-parallel-thunk-body-crashes)). In one line: of the four combinations, only "`parallel` thunk + synchronous throw" crashes the workflow; the other three are all isolated to `null`. This is OS-independent — it comes down to how the JS engine tells a synchronous exception apart from a Promise rejection, consistent across three platforms.

**⑤ `meta` must be a pure literal, plus various validations.** Evidence class: **[platform-independent · verified]**. `meta` must be a pure literal (reserved keys like `constructor` are rejected), an unknown `agentType` value throws before any model is spawned and lists the available agents, `isolation:'remote'` is rejected while `isolation:'totally-bogus'` is silently ignored — these validations all run at runtime/submit time, **OS-independent, consistent across three platforms.** Same mechanism as ①: it scans the script's structure and values, not OS behavior.

<div class="callout info">

**Remember the first part in one line**: the script sandbox is the same JS engine, so everything at the script-logic level (the guard, args, the absent host APIs, the timeout, error propagation, the various validations) is **identical across three platforms.** This book only verified on macOS, but this layer's conclusions can be confidently extrapolated — it was OS-independent to begin with.

</div>

### B.24.2 The Half That Truly May Differ by Platform (Inferred · Untested, Labeled by Mechanism)

The following **really do behave differently across platforms.** This book has **no Windows / Linux test data**, so every entry is "mechanism inference + general knowledge" — **please treat these as reminders that "you need to verify on the target platform yourself," not as confirmed conclusions.**

**① Path separators & filename case sensitivity (the most common cross-platform pothole).** Evidence class: **[inferred · untested]** — this is **general cross-platform knowledge**, **not a verified conclusion of this feature.** This book did not test the `agent()` leaf's file read/write behavior on Windows / Linux. Recall B.24.1 ③: file operations can only happen inside an `agent()` leaf (subagents use Read/Write/Bash). The moment you touch files, you step onto the real OS's turf — and that's exactly the classic cross-platform minefield:

- **Path separators**: Unix-likes (macOS / Linux) use `/`, Windows natively uses `\` (though most APIs also accept `/`). If you hardcode a path like `dir/sub/file.txt` in the prompt for a subagent to read/write, **whether it's safe on Windows depends on how the tool/shell the subagent actually uses parses it** — this book didn't test it; by general knowledge we infer there's risk here. Recommendation: have the subagent use relative paths, or spell it out in the prompt to "use the native path notation of your platform," rather than splicing absolute paths for it.

- **Case sensitivity** (this one is especially deadly):
  - macOS's default file system (APFS) is **case-insensitive** — `README.md` and `readme.md` are treated as the same file.
  - Linux (ext4, etc.) is **case-sensitive** — these two are different files.
  - **The GitHub Pages deployment environment is Linux, case-sensitive.**

  Implication: you write a workflow on Mac, have one `agent()` produce `Foo.md`, and a downstream `agent()` read `foo.md` — **it happens to read on your Mac (case-insensitive), but on Linux / GitHub Pages it can't be read, and the link 404s.** This is **a pothole that this book's own deployment has to watch out for** (this cookbook's English mirror goes through GitHub Pages), but **it's general cross-platform knowledge, not verified Workflow-feature behavior.**

<div class="callout warn">

**Case-sensitivity pitfall (inferred · untested)**: Mac is case-insensitive by default, Linux / GitHub Pages is case-sensitive. When you have an `agent()` write a file and a downstream `agent()` read it, **the filename case must match exactly**, or it runs on Mac and 404s on Linux. This book did not test this phenomenon on Linux; it's just a reminder based on the general file-system mechanism.

</div>

**② Worktree isolation needs a git repo — behavior in a non-git directory.** Evidence class: **[inferred · untested]**. The mechanism of `opts.isolation:'worktree'` is "run this agent in a **separate git worktree**" (expensive, ~200–500ms startup + disk/agent, used only when parallel file edits would collide). `git worktree` is a git feature, **predicated on the current directory being inside a git repo.** From this we **infer** (untested): if you use `isolation:'worktree'` in a **non-git directory** (or a project without git initialized), since the underlying `git worktree add` has no repo to attach to, it **probably fails or degrades.** But whether it specifically throws or silently degrades to "not isolated" (by analogy with the bogus-isolation-ignored behavior in B.24.1 ⑤) — **this book did not test it, and we draw no conclusion.** This one has little to do with the OS and more to do with "whether there's a git repo," but it really is a corner case that will derail a workflow in certain environments. Safe practice: for a workflow that uses `isolation:'worktree'`, state in the docs that it "must run from the git repo root."

> Addendum (inferred): worktree also implies "the target platform has a usable `git`, with the worktree subcommand available." Cases of git missing or too old in CI images do exist — likewise untested, merely a reminder.

**③ Shell differences inside the `agent()` leaf.** Evidence class: **[inferred · untested]**. The subagent inside an `agent()` leaf can run Bash. All of this book's Bash tests ran on macOS (zsh/bash). We **infer** (untested): if you have a subagent run **Unix-like shell commands** in the prompt (`ls`, `grep`, `rm -rf`, pipes, `&&`), they should behave consistently on macOS / Linux; **on Windows**, native `cmd` / PowerShell differ in syntax, command names, and path notation — whether this command runs **depends on what actually provides the subagent's Bash on that Windows machine** (e.g., Git Bash / WSL / nothing). This book has **not verified this on Windows at all**, so it **cannot guarantee** that the shell commands you hardcode are cross-platform portable. Safe practice (an inference-level recommendation): when you have a subagent run shell, **prefer cross-platform-safe forms**, or describe "the goal to achieve" in the prompt and let the subagent pick the platform-appropriate command, rather than nailing a long string of Unix-only commands into the prompt.

<div class="callout warn">

**Shell portability (inferred · untested)**: an `agent()` leaf can run Bash, but this book only verified on macOS. Whether Unix-only commands (`rm -rf`, pipes, `&&`) nailed into the prompt run on Windows is **untested**. Describing the goal and letting the subagent choose the command is steadier than hardcoding the command.

</div>

**④ Line endings and file encoding (a minor pothole, inferred).** Evidence class: **[inferred · untested]** — general knowledge, not verified for this feature. Files written out by `agent()`: Windows favors `CRLF`, Unix favors `LF`; now and then there's a BOM difference in encoding. If a downstream agent or external tool is sensitive to line endings/encoding (some diffs, some parsers), it **may** behave differently across platforms. This is general file-IO knowledge, **untested in this book**, just a one-line reminder, not elaborated.

### B.24.3 A One-Page Cheat Sheet for Workflow Authors

| Corner case | Evidence class | Consistent across three platforms? | Key point |
|---|---|---|---|
| Determinism guard scans the token inside a string | **platform-independent · verified** | ✅ Consistent | Even `Date.now()` inside a string is rejected; to mention it in a prompt, split-write or reword |
| `args` passed through unchanged + normalize | **platform-independent · verified** | ✅ Consistent | Parse only when `typeof==='string'`, don't `JSON.parse` unconditionally |
| `require/process/fetch` absent | **platform-independent · verified** | ✅ Consistent | Files/shell/network can only go inside an `agent()` leaf |
| 30000ms synchronous timeout / error propagation | **platform-independent · verified** | ✅ Consistent | The watchdog only governs synchronous loops; only a `parallel` thunk's synchronous throw crashes the workflow — everything else (pipeline's synchronous throw, any async reject) → single-slot `null` |
| meta/agentType/isolation validation | **platform-independent · verified** | ✅ Consistent | Submit/runtime validation, OS-independent |
| Path separators | **inferred · untested** | ⚠️ May differ | Don't hardcode absolute paths; have the subagent use native notation |
| Filename case sensitivity | **inferred · untested** | ⚠️ **Will differ** | Mac case-insensitive / Linux+GitHub Pages case-sensitive; keep read/write filename case consistent |
| Worktree needs a git repo | **inferred · untested** | ⚠️ Depends on git | Non-git-directory behavior untested; document "run from the git repo root" |
| The `agent()` leaf's shell | **inferred · untested** | ⚠️ May differ | Windows shell untested; describe the goal > nail Unix commands |
| Line endings/encoding | **inferred · untested** | ⚠️ May differ | CRLF/LF, BOM; watch out when downstream is sensitive |

**Running insight**: Workflow naturally converges "platform differences" onto a single boundary — **the script body (the JS sandbox) is always platform-independent; all platform potholes are at the moment the `agent()` leaf touches the real OS.** So when you do a cross-platform review, you can rest easy about the script logic and **focus on the file paths, case, and shell commands inside the leaves.** This book can confirm the former on a single macOS machine; the latter it can only remind you of by mechanism — **verify it yourself on the target platform.**

---

> Continue reading: [Appendix C · Best Practices](#/en/app-c)
