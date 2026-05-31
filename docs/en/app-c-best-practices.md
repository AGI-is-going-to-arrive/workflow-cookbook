# Appendix C · Best Practices

> A **checklist you can tick off.** Each entry tells you what to do, why, and how to land it, with a link to the matching chapter. When you design or review a Workflow, run through it top to bottom. The more boxes you tick, the more deterministic, economical, resume-able, and observable your script gets.
>
> This checklist covers "how to do a shape right and well." To decide **which shape** first (pipeline or parallel, whether to wrap adversarial verification), see [Appendix F · Pattern Catalog & Scenarios](#/en/app-f), pick the shape, then come back and tick the boxes.
>
> The API basis for every claim lives in [Appendix A](#/en/app-a); the behavioral basis lives in [Appendix E](#/en/app-e)'s real runs. The companion reverse checklist (pitfalls and troubleshooting) is in [Appendix B](#/en/app-b).

---

## C.1 How to Use This Checklist

- **Before** you write the script: scan [C.2 Structure & Orchestration](#c2-structure-orchestration) and [C.3 schema & Products](#c3-schema-products), and nail down the skeleton.
- **While** you write it: check against [C.4 Observability](#c4-observability-progress-logs-and-labels) and [C.5 Cost & Scale](#c5-cost-scale), ticking boxes as you go.
- **Before** delivery: run through [C.6 Resilience & Verification](#c6-resilience-verification), [C.7 Iteration & Resume](#c7-iteration-resume), and [C.8 Isolation & Nesting](#c8-isolation-nesting), and make sure nothing slipped through.
- Unsure about an entry → click the link back to the body chapter; a term you don't get → check [Appendix D](#/en/app-d).

> Legend: `[ ]` means to be checked; the "**Why**/**How**" below is what you judge by. Hard constraints (skip them and you error or waste) are marked ⚠️.

---

## C.2 Structure & Orchestration

- [ ] **Use `pipeline()` for multi-stage, not chained `parallel()`.** ⚠️
  - **Why**: `parallel` is a barrier; it waits for a whole batch to finish before the next step. Write multi-stage as "`parallel` then `parallel`" and you burn time waiting for the slowest one at every stage boundary. `pipeline` lets each item flow **independently** through all stages with **no barrier** between them, so wall clock ≈ the slowest single chain rather than the sum of each stage's slowest.
  - **How**: see [Chapter 8 · parallel vs pipeline](#/en/p2-08). Reach for `parallel` only when "all results genuinely need to appear together" (e.g., fan-out then synthesize).

- [ ] **Pass `parallel()` only thunks (`() => agent(...)`), never Promises.** ⚠️
  - **Why**: pass `agent(...)` (a Promise) and it runs the moment the array is built. It doesn't conform to the `parallel(thunks)` API, `parallel()` can't manage it as a thunk, and the "async reject / agent error → `null`" error-gathering semantics are lost. (The concurrency cap is throttled uniformly **per workflow** and can't be bypassed.)
  - **How**: `parallel(items.map(it => () => agent(prompt(it), { schema })))`. See [Appendix B · B.4](#/en/app-b).

- [ ] **Write `meta` as a pure literal, with the first line being `export const meta = {…}`.** ⚠️
  - **Why**: the runtime reads `meta` statically before it runs the script; variables, function calls, spreads, or template interpolation in it get rejected and the workflow doesn't launch.
  - **How**: move dynamic content into the script body and express it with `log()`/`phase()`. See [Chapter 5 · meta & phase](#/en/p2-05).

- [ ] **Declare phases in `meta.phases` first, then reference them in the script with `phase()`/`opts.phase`.**
  - **Why**: declaring phases up front keeps the progress tree's structure clear and predictable; `phase()`'s title matches `meta.phases[].title` by exact string.
  - **How**: see [Chapter 5](#/en/p2-05).

- [ ] **Inside `parallel`/`pipeline`, use `opts.phase` for explicit grouping, not the global `phase()`.** ⚠️
  - **Why**: the global `phase()` is stateful; concurrent agents race over "which phase is current," and the grouping comes out scrambled.
  - **How**: have each concurrent agent carry its own `phase:'Review'`. The real scripts `frontend-review`/`judge-panel` both do this. See [Appendix B · B.12](#/en/app-b).

- [ ] **The script body only orchestrates; side effects go to agents.** ⚠️
  - **Why**: the script body is a restricted `async` sandbox with no file system, no network, no `require`, and no Node global. Reading files, writing files, and hitting the network all go through the subagents dispatched by `agent()` (they hold real tool permissions).
  - **How**: to read a file, `agent('Read x and ...')`; for data, pass it in via `args`. See [Appendix B · B.16](#/en/app-b).

---

## C.3 schema & Products

- [ ] **Constrain the shape of key products with `schema`.** ⚠️
  - **Why**: with a `schema`, validation happens at the **tool-call layer**: the model **auto-retries** until it matches, and you get back a **validated object**. Downstream can just reach for `.field` without parsing free text.
  - **How**: `agent(prompt, { schema: { type:'object', properties:{…}, required:[…] } })`. See [Chapter 7 · Structured Output & Schema](#/en/p2-07). Real confirmation: `hello`'s `sum` is strictly the number `4` (Run `wf_dacbd480-d5d`).

- [ ] **The schema constrains the shape but leaves the model room to express (don't over-strict).**
  - **Why**: a missing `enum` item, or forcing the model to hand over a field it can't produce accurately (like an exact line number), triggers **persistent retries** that slow it down or stall it outright.
  - **How**: have `enum` cover every legal value; have `required` list only the fields you truly need; stash an exact location in a descriptive `string`. If unsure, run a round with `string` first, then narrow. See [Appendix B · B.9](#/en/app-b).

- [ ] **Split complex structures into two stages (produce text first, then structure); don't do it in one shot.**
  - **Why**: a deeply nested schema is hard to satisfy in one go; splitting into "generate → structure" is steadier.
  - **How**: use `pipeline` to split "draft" and "extract" into two stages.

- [ ] **When a cross-stage needs the original input, use the callback signature `(prevResult, originalItem, index)`; don't thread it through the previous stage's return value.**
  - **Why**: each stage of `pipeline` can grab `originalItem` directly, so there's no need to pollute the previous stage's product schema.
  - **How**: `(found, kind) => agent(\`verify ${kind}: ${found.example}\`)`. Real confirmation: `pipeline-demo`'s stage2 signature is `(found, kind)` (Run `wf_bf086b98-6ec`). See [Chapter 8](#/en/p2-08).

---

## C.4 Observability: Progress, Logs, and Labels

- [ ] **Give every agent a descriptive `label`.**
  - **Why**: `label` is the name shown in the `/workflows` progress tree and the transcript; `review:a11y` is easier to spot and search than "agent #3."
  - **How**: `agent(prompt, { label: \`review:${d.key}\` })`. See [Chapter 6 · The agent() Reference](#/en/p2-06).

- [ ] **`log()` at milestones, writing out key counts/decisions.**
  - **Why**: `log()` prints a narration line above the progress tree, your main clue when you go back to see "what happened" (like "barrier released with 3/3 results," "pipeline kept N/M items").
  - **How**: a phase switch, how many items survived a filter, why something exited early all deserve a `log`. Real scripts commonly do this. See [Chapter 9 · Progress, Logs, Resume, Budget](#/en/p2-09).

- [ ] **Explicitly record "dropouts/downgrades."**
  - **Why**: `parallel`'s async rejects and throws inside a `pipeline` stage both mark that item `null`. Looking only at the final count, you'll misread it as data loss. (Note: a **sync** throw inside a `parallel` thunk does *not* become `null`. It throws through the `parallel` call and crashes the whole run; see [C.6](#c6-resilience-verification) and [C.2 "only thunks"](#c2-structure-orchestration).)
  - **How**: `log(\`pipeline kept ${ok.length}/${items.length}\`)`. See [Appendix B · B.15](#/en/app-b).

- [ ] **Keep the `taskId`/`runId`.**
  - **Why**: `taskId` is for tracking and stopping (TaskStop), `runId` is for resume (`resumeFromRunId`). The workflow is **always async**, so the receipt ≠ the result.
  - **How**: wait for the completion notification to get the result; watch live progress with `/workflows`. See [Appendix B · B.14](#/en/app-b).

---

## C.5 Cost & Scale

- [ ] **Estimate cost before dispatching agents: token ≈ agent count × per-agent context (about 25k-30k).**
  - **Why**: each agent is an independent context, so the cost stacks up linearly. Real confirmation: parallel 3 agents ≈ 78,844 ≈ 3x26,338 (Run `wf_52957913-6d2`).
  - **How**: first work out "how many agents this design dispatches," then decide whether it's worth it. The rule of thumb is in the [primitives run record](#/en/p2-08).

- [ ] **Wall clock follows the critical path, not the agent total.**
  - **Why**: concurrency squeezes N agents' time down to "the slowest one." Real confirmation: 3 concurrent at 8.4s ≪ 3x5.5s.
  - **How**: run concurrently whatever can run concurrently; for multi-stage, use `pipeline` so the stages overlap. See [Chapter 8](#/en/p2-08).

- [ ] **Use `model: 'haiku'` for simple/mechanical subtasks.**
  - **Why**: leave out `model` and it inherits the main loop model (usually a strong one); classification, extraction, and formatting do fine on a light model, saving tokens and time.
  - **How**: what actually sets the model is `opts.model` in `agent(prompt, { model: 'haiku' })`; whether `meta.phases[].model` does anything at runtime is not independently verified by this book, so treat it as a display label and don't rely on it alone. See [Chapter 6](#/en/p2-06), [Chapter 21 · Dynamic Budget & Scaling](#/en/p4-21).

- [ ] **Respect the concurrency limit; don't expect infinite parallelism.**
  - **Why**: a single workflow runs `min(16, CPU cores-2)` agents at once and the rest queue up; the agent total per workflow has a hard cap of **1000**.
  - **How**: when a batch is really large, process it in batches or shards instead of fanning out hundreds at once. See [Chapter 21](#/en/p4-21).

---

## C.6 Resilience & Verification

- [ ] **Add a round of adversarial verification (an independent agent "picks holes") to important output.**
  - **Why**: the first version almost always has blind spots; send in another agent with explicit orders to "find errors," and you flush problems out systematically. Real confirmation: GCF had adversarial Critique catch **10 genuine defects** in a seemingly simple `slugify` (Run `wf_7472ceac-daa`).
  - **How**: Generate → Critique → Fix, three stages. See [Chapter 12 · Generate-Critique-Fix](#/en/p3-12), [Chapter 17 · Adversarial Verification](#/en/p4-17).

- [ ] **When you need to reduce single-point bias, use independent judges + a rubric + vote-tallying.**
  - **Why**: several judges that don't communicate converge reliably on candidates whose quality is "clearly a notch apart"; a rubric (a schema that pins dimensions into numbers) plus tallying beats a single agent's gut call. Real confirmation: judge-panel's 3 judges scored independently and converged 3:0 (Run `wf_f5b69668-b18`).
  - **How**: use `parallel` to dispatch several judges that each score on their own, then tally `votesA/votesB`. See [Chapter 14 · Judge Panel](#/en/p3-14).

- [ ] **Always `.filter(Boolean)` `parallel`/`pipeline` results before consuming.** ⚠️
  - **Why**: a position that async-rejected (a thunk returning a rejected promise, or an `async` throw) or that threw inside a `pipeline` stage is `null`; skip the filter and the `.map(r => r.x)` that follows will throw. `.filter(Boolean)` only catches *that* kind of `null`. It **can't** catch a **sync** throw inside a `parallel` thunk: that throws straight through the `parallel` call and crashes the whole run. So don't put logic that might throw synchronously bare inside a thunk (see [C.2 "only thunks"](#c2-structure-orchestration) and [Appendix B · B.4](#/en/app-b)).
  - **How**: `(await parallel(thunks)).filter(Boolean)`. See [Appendix B · B.11](#/en/app-b).

- [ ] **When the critical path can't drop items, `try` within the stage and return a degraded result rather than throwing.**
  - **Why**: when a stage throws in `pipeline`, that item drops out and skips the rest.
  - **How**: after the catch, return `{ ok:false, reason }` to keep that item flowing onward. See [Appendix B · B.15](#/en/app-b).

- [ ] **"Loop-until-dry/retry-until-pass" needs a convergence condition + a round cap.**
  - **Why**: lean purely on a business criterion and it may never converge.
  - **How**: `while (!done && round < MAX_ROUNDS)`. See [Chapter 18 · Loop-Until-Dry & Completeness](#/en/p4-18).

---

## C.7 Iteration & Resume

- [ ] **Land complex scripts as `.js`, call with `scriptPath`.**
  - **Why**: the script is a file, so you can vet it with an editor or tools first; after a Write/Edit, just re-run with the same `scriptPath`, no resending the whole thing.
  - **How**: `Workflow({ scriptPath: '.../my-wf.js' })`. `scriptPath` has the highest priority. See [Appendix A · A.1](#/en/app-a).

- [ ] **To reuse already-run results, resume with `resumeFromRunId`, and keep the earlier script letter-for-letter unchanged.**
  - **Why**: an `agent()` that didn't change hands you the cached result on resume in **zero tokens, zero tools, about 8ms.** Real confirmation: hello resume `total_tokens=0`/`duration_ms=8` (Run `wf_dacbd480-d5d` reused).
  - **How**: put changes only after the position you want to re-run; resume is **same session only**, and you should `TaskStop` the previous run first. See [Chapter 22 · Resume & Caching](#/en/p4-22).

- [ ] **Keep the script replayable: forbid `Date.now()`/`Math.random()`/arg-less `new Date()`.** ⚠️
  - **Why**: nondeterministic sources break the alignment resume depends on (and they are rejected outright (literals at submit, aliases at runtime)).
  - **How**: feed timestamps in via `args` or stamp them after the fact; get randomness by varying the prompt with the agent's index. See [Appendix B · B.5](#/en/app-b).

- [ ] **To force a re-run of some segment, deliberately change it.**
  - **Why**: the cache judges by "did the call change"; change it and it re-runs, leave it and it hits.
  - **How**: see [Chapter 22](#/en/p4-22).

---

## C.8 Isolation & Nesting

- [ ] **Use `isolation: 'worktree'` only when "parallel agents editing the same set of files would collide."** ⚠️
  - **Why**: worktree is expensive (about 200-500ms startup, plus disk and agent overhead); read-only review, pure analysis, and agents each writing their own file all **don't need** it. It auto-cleans when there are no changes.
  - **How**: turn it on only for parallel refactor or parallel patching; the tool-result envelope reports the path and branch. See [Chapter 19 · Worktree Isolation](#/en/p4-19).

- [ ] **Reuse an entire flow with `workflow()` inline, but remember nesting is one level only.** ⚠️
  - **Why**: a sub-workflow shares the parent's concurrency limit, agent count, abort signal, and token budget; call `workflow()` again inside it and it throws.
  - **How**: flatten the "grandchild-level" logic into the sub-workflow; let the main loop chain any multi-level orchestration. Real confirmation: a parent inline-ran a hello sub-flow, and the child agent counted toward the parent's `agent_count` (Run `wf_85e22b38-126`). See [Chapter 20 · Nested Workflows](#/en/p4-20).

- [ ] **Reuse an existing subagent type with `agentType` (combinable with schema).**
  - **Why**: custom types like `'Explore'`, `'code-reviewer'` come with their own specialized system prompt; combine them with `schema` and the StructuredOutput instruction gets appended on top.
  - **How**: `agent(prompt, { agentType: 'Explore', schema })`. See [Chapter 6](#/en/p2-06).

---

## C.9 Budget Guards

- [ ] **Guard dynamic loops with `budget.total && budget.remaining() < threshold` for an early exit.** ⚠️
  - **Why**: `budget` is a hard cap (once `spent()` hits `total`, the next `agent()` call throws); but `total` may be `null` (when no target is set, `remaining()` is `Infinity`), so put a `budget.total &&` short-circuit in front to avoid bailing out wrongly when no target is set.
  - **How**:
    ```javascript
    if (budget.total && budget.remaining() < 30_000) {
      log(`budget guard: ${budget.remaining()} left, stopping`)
      break
    }
    ```
  - See [Chapter 21 · Dynamic Budget & Scaling](#/en/p4-21), [Appendix B · B.6](#/en/app-b).

- [ ] **The budget pool is shared: the main loop + all workflows (incl. nested sub-flows) share one pool.**
  - **Why**: `budget.spent()` counts every output token this turn, and what nested sub-flows spend goes into that count too.
  - **How**: when you estimate a nested workflow's cost, fold the sub-flows in. See [Chapter 20](#/en/p4-20).

---

## C.10 One-Page Overview (Tear Off and Stick on the Wall)

```text
Orchestration
  □ Multi-stage → pipeline (not chained parallel)
  □ parallel takes only thunks
  □ meta a pure literal + first line export
  □ opts.phase explicit grouping inside concurrency blocks
  □ script body only orchestrates, side effects to agents

Products
  □ Constrain key products with schema
  □ schema not over-strict (full enum, lean required)
  □ Split complex structures into two stages
  □ Use (prev, orig, i) for the original input across stages

Observation
  □ Descriptive label
  □ Milestone log + record dropouts
  □ Keep taskId / runId (wait for the notification for the result)

Cost
  □ Estimate tokens first (≈ agent count × 25k-30k)
  □ Wall clock follows the critical path, concurrent what can be concurrent
  □ Simple tasks use haiku
  □ Respect the concurrency limit / 1000 fallback

Resilience
  □ Add adversarial verification to important output
  □ Reduce bias with independent judges + rubric + tallying
  □ .filter(Boolean) the results
  □ Loops have a convergence condition + round cap
  □ budget.total && guard

Iteration
  □ Land as .js, re-run with scriptPath
  □ Resume keeps the earlier part letter-for-letter unchanged (same session, TaskStop first)
  □ Forbid Date.now/Math.random (keep replayable)

Isolation/Nesting
  □ worktree only when parallel file edits collide
  □ workflow() nesting one level only
```

> Companion reading: the reverse checklist (pitfalls and troubleshooting) is in [Appendix B · Pitfalls & Troubleshooting](#/en/app-b); for field semantics see [Appendix A · Full API Reference](#/en/app-a); for terms see [Appendix D · Glossary](#/en/app-d).

> Continue reading: [Appendix D · Glossary](#/en/app-d)
