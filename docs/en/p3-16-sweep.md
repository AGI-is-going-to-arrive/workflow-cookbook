# Chapter 16 · Documentation and Migration Sweep

> Apply the same kind of change to dozens of files: rename an API, unify a piece of wording, add a paragraph of explanation to each module, migrate an old idiom to a new one. This kind of **sweep** is Workflow's sweet spot. It shards naturally, runs concurrently, and each shard's output can be structured. This chapter walks through what a sweep looks like, its **two-phase skeleton** (scout the list first, then pipeline each item), and three engineering principles that make a sweep **trustworthy**: **no-silent-caps** (if coverage has a limit, say so), **report-only first** (default to reporting, let a human review before editing), and **idempotent + recoverable** (resumable when interrupted, safe to re-run).

---

## 16.1 A Sweep's Essence Is Just a pipeline

A sweep = **take a batch of files, and run each one through the same processing chain on its own.** This is exactly the definition of `pipeline` (Chapter 08):

```mermaid
flowchart LR
  F["file list"] --> P{{"pipeline: each file flows independently"}}
  P --> a["file A: analyze→rewrite→verify"]
  P --> b["file B: analyze→rewrite→verify"]
  P --> c["file N: analyze→rewrite→verify"]
```

> A sweep has no separate "new API" to learn; it uses `pipeline` + `agent` + `schema`. This book's **bug-hunter** (Chapter 15, Run `wf_53da9a06-915`, real, 11 agents) is a read-only sweep: it verifies each suspected bug in one file on its own. Swap "items within a file" for "files within a directory," and you get a cross-file sweep.

A sweep deserves its own chapter because it pushes pipeline to **scale**: not 3 hard-coded items, but "as many items as there are files in a directory." Once the item count stops being a constant and is instead **discovered at runtime**, three new problems surface: where does the list come from (16.2, the two-phase method), what if the list is too big (16.4, no-silent-caps), and what if it gets interrupted halfway (16.6, idempotency). This chapter answers those three questions.

---

## 16.2 The Two-Phase Method: Scout the List First, Then Pipeline Each Item

The most common mistake is having one agent both discover files and process each one. **Discovering the list** and **processing each item** are two completely different kinds of work: the former is a cheap directory scan (one agent running Glob/Grep suffices), the latter is N concurrent subagents each handling one file. Combining them loses both the opportunity to **review and trim** the list, and the ability to structurally aggregate the processing stage.

The correct approach is the **two-phase method (scout -> pipeline)**:

```mermaid
flowchart TB
  subgraph S1["Phase 1 · Scout (cheap, single agent or inline)"]
    G["agent(agentType:'Explore')<br/>run Glob/Grep to list candidates"] --> L["return a structured list<br/>{files:[…], total:N}"]
  end
  L --> CAP{"List over budget?"}
  CAP -->|"yes: truncate + log what's dropped"| B["selected worklist"]
  CAP -->|"no"| B
  subgraph S2["Phase 2 · Pipeline (expensive, N concurrent)"]
    B --> P{{"pipeline(files, analyze, verify)"}}
    P --> r1["file A → structured suggestion"]
    P --> r2["file B → structured suggestion"]
    P --> rn["file N → structured suggestion"]
  end
  r1 & r2 & rn --> AGG["main loop aggregates / lands"]
```

- **Phase 1, Scout**: use one agent with `agentType: 'Explore'` to run Glob/Grep and return a **structured list** (an array of file paths + a total). This step is very cheap: it does not read full text, only lists names. The agent can also be skipped entirely: if the main loop / orchestrator already knows the list, passing the array into the script saves an agent round-trip.
- **Trim gate**: insert a gate between the two phases to check whether the list exceeds this run's budget (token / agent count / time). If truncation is needed, **truncate and `log` what was dropped** (see 16.4).
- **Phase 2, Pipeline**: run `pipeline` over the **selected** list; each file flows on its own through an "analyze -> verify" chain and returns a structured suggestion.

Here is a runnable skeleton of the two-phase method (**illustrative, not executed as-is**). Its behavior of `pipeline` running concurrently across files with structured output has already been validated by Chapter 08's pipeline-demo (Run `wf_bf086b98-6ec`, real, 6 agents / 158,982 tokens / 26.7s) and Chapter 15's bug-hunter (real):

```javascript
export const meta = {
  name: 'docs-footer-sweep',
  description: 'Two-phase sweep: scout lists docs, then audit each for a required footer link',
  phases: [
    { title: 'Scout', detail: 'List candidate files (cheap, single agent)' },
    { title: 'Audit', detail: 'Per-file structured conformance report' },
  ],
}

// —— Phase 1: Scout, list the worklist (cheap; or have the main loop pass args.files to skip this) ——
phase('Scout')
let files
if (Array.isArray(args && args.files)) {
  files = args.files            // main loop already knows the list: use it, save an agent
} else {
  const found = await agent(
    'Glob docs/en/*.md and return the list of file paths. Do NOT read file contents.',
    { label: 'scout', agentType: 'Explore',
      schema: { type: 'object',
        properties: { files: { type: 'array', items: { type: 'string' } } },
        required: ['files'] } })
  files = found.files
}
log(`scout found ${files.length} candidate files`)

// —— Phase 2: Pipeline, analyze each item (expensive, N concurrent) ——
phase('Audit')
const reports = await pipeline(files,
  (f) => agent(
    `Read ${f}. Does it end with a "Continue reading" footer link AND contain a Summary section? ` +
    `Report yes/no plus exactly what is missing.`,
    { label: `audit:${f}`, phase: 'Audit',
      schema: { type: 'object',
        properties: {
          file: { type: 'string' },
          ok: { type: 'boolean' },
          missing: { type: 'string' },
        }, required: ['file', 'ok', 'missing'] } })
)
const problems = reports.filter(Boolean).filter((r) => !r.ok)
log(`audited ${reports.length} files, ${problems.length} need attention`)
return { scanned: reports.length, problems }
```

<div class="callout tip">

**Why scout first rather than placing Glob into pipeline's first stage?** Because the list needs **a human or the main loop to inspect it before proceeding**: it might be too large and need trimming, or it might have swept in files that should not be modified (build artifacts, vendored third-party directories). Extracting "list the worklist" into its own step provides a **seam for trimming and review**. Inside pipeline, the list gets consumed the moment it appears, with no room to intervene.

</div>

---

## 16.3 Two Kinds of Sweep: Read-Only Analysis vs Real Rewrite

What "Phase 2" actually does depends on which kind of sweep you are running.

**Decision one: read-only analysis sweep (recommended first).** The agent reads files and returns **structured change suggestions** without editing directly; the main loop reviews all suggestions together and then decides how to land them. This path is safe, reversible, and the output is auditable. The skeleton in 16.2 above *is* a read-only analysis sweep: it returns only a `{file, ok, missing}` report and changes nothing.

**Decision two: real rewrite sweep.** The agent edits files directly. **The key trap** is that multiple agents editing files concurrently will **trample each other.** The solution is `isolation: 'worktree'`: each agent edits in its own git worktree, without conflict (see [Chapter 19 · Worktree Isolation](#/en/p4-19)).

<div class="callout warn">

**A heavy reminder**: `isolation: 'worktree'` is **expensive** (about 200-500ms startup each + disk overhead + an agent). **Use it only when multiple agents really will concurrently edit the same set of files and would otherwise conflict.** Read-only analysis, or editing files that don't overlap, has no need for it.

</div>

This leads to the most important safety trade-off in a sweep: **report-only vs apply.**

| Dimension | report-only (default) | apply (real edits) |
|---|---|---|
| What Phase-2 agents do | read-only + return structured suggestions | call Write/Edit to really edit files |
| Isolation cost | none (no writes, no conflict) | needs `worktree` to avoid trampling, expensive |
| Auditability | high: a human can review each suggestion before greenlighting | low: you see it after editing; rollback via git |
| Reversibility | inherent (nothing was changed) | via git revert / discarding the worktree |
| When to use | first pass, blast radius unclear, want human review | suggestions reviewed, change pattern settled, batch execution |

The standard engineering practice is **two passes**: a first report-only pass to map the whole picture and let a human review the suggestions; once the suggestions are confirmed, a second pass to apply them (or hand the reviewed suggestions to the main loop to land with native Write/Edit, skipping worktrees entirely). **Default to reporting first**, because once a sweep's "same change across dozens of files" goes wrong, dozens of files go wrong together. Report-only places that risk in front of human review.

---

## 16.4 no-silent-caps: If Coverage Has a Limit, Say So

A sweep's most dangerous failure is not an error -- errors are at least visible. The most dangerous failure is **silent truncation**: the script quietly caps coverage (takes only the top-N, samples a subset, skips on failure without retry) yet makes the result **look like full coverage**. The conclusion "the whole directory was scanned and is conformant" is drawn, when in fact half of it was never touched. This silent misrepresentation is far more dangerous than an explicit error.

The principle is **no-silent-caps**: **any reduction of coverage, whether a cap, sampling, skipping, deduping, or early exit, must be `log()`-ed, spelling out "what was dropped, why, and how much is left unprocessed."** Workflow's `log()` exists for exactly this: it prints a narration line above the progress tree (see S-B) and is the script's only channel to come clean to the human.

Why would there be a cap? Because a sweep naturally bumps into the hard limits in grounding:

- **Concurrency cap** = `min(16, CPU cores - 2)` (tool contract / tested): going past it **queues**, it doesn't error. N=500 files won't blow up, but it'll be slow, and you may want to deliberately take only one batch.
- **Lifetime `agent()` total cap of 1000** (official, a runaway-loop backstop): if a sweep's files x stages approaches 1000, you must cap deliberately.
- **Token budget** (`budget.total`, a hard ceiling; tool contract): once `spent()` reaches `total`, the next `agent()` throws. A big list must either be batched or deliberately truncated.

When these limits are encountered, **deliberate truncation + log** is far preferable to "letting it hit the 1000 cap and throw" or "letting the budget run dry and crash mid-way." Here is what incorporating no-silent-caps into a script looks like (**illustrative, not executed**):

```javascript
export const meta = {
  name: 'capped-sweep',
  description: 'Sweep with an explicit per-run cap that LOGS what it drops (no silent truncation)',
  phases: [{ title: 'Scout' }, { title: 'Process' }],
}

phase('Scout')
const all = (await agent('Glob src/**/*.ts and return paths only.',
  { label: 'scout', agentType: 'Explore',
    schema: { type: 'object', properties: { files: { type: 'array', items: { type: 'string' } } }, required: ['files'] } })).files

// —— Explicit cap: not "200 files so run 200," but a number this run can afford ——
const CAP = 50
const selected = all.slice(0, CAP)
const dropped = all.length - selected.length

// —— The heart of no-silent-caps: state what was dropped ——
if (dropped > 0) {
  log(`⚠ COVERAGE CAP: scouted ${all.length} files, processing first ${selected.length}, ` +
      `DROPPED ${dropped}. This run is NOT full coverage — re-run on the remainder ` +
      `(e.g. args.files = the next batch) to continue.`)
}

phase('Process')
const reports = await pipeline(selected,
  (f) => agent(`Audit ${f} for the migration checklist; report findings.`,
    { label: `proc:${f}`, phase: 'Process',
      schema: { type: 'object',
        properties: { file: { type: 'string' }, findings: { type: 'array', items: { type: 'string' } } },
        required: ['file', 'findings'] } }))

// —— Carry the coverage facts in the return value too, so the caller can't misread it ——
return {
  coverage: { total: all.length, processed: selected.length, dropped },
  complete: dropped === 0,
  reports: reports.filter(Boolean),
}
```

<div class="callout warn">

**Silent truncation is a sweep's primary incident source.** Three of its most covert forms: (1) `array.slice(0, N)` without a log, making the result appear as though everything ran; (2) a `pipeline` item throws, gets silently set to `null`, and `filter(Boolean)` filters it out, so "the failed file vanishes"; (3) deduping with a `Set` folds together same-named files that should each be processed. **Countermeasure**: any operation that changes "how many were processed" must either be `log`-ed or written into the return value's `coverage` field. Coverage should be treated as a **first-class citizen**, not a footnote.

</div>

A special note on `pipeline`'s "failure-is-null" semantics (see S-B): when a stage throws, that item becomes `null`, and it skips the rest of its stages. `reports.filter(Boolean)` is clean, but it **silently eats failures.** The safer form counts first, then filters:

```javascript
const failed = reports.filter((r) => r === null).length
if (failed > 0) log(`⚠ ${failed}/${reports.length} files failed mid-pipeline (returned null) and were skipped`)
const ok = reports.filter(Boolean)
```

---

## 16.5 Recommended Workflow: Let Analysis Be Concurrent, Let Writing Converge to One Place

Combining the preceding sections, the most failure-tolerant sweep pattern hands "analysis" to subagents and leaves "writing" to the main loop:

1. **Scout the list** (16.2), trim it to a scale this run can afford, and `log` what was dropped (16.4).
2. **A read-only sweep** lets N agents analyze concurrently, each returning structured change suggestions (16.3, decision one).
3. **The main loop** (the orchestrator) reviews, dedups, and decides in one place once it has all suggestions.
4. **The main loop lands them with native Write/Edit.** The Workflow **script body** itself, and the writes of `ctx_execute`/Bash subprocesses, **do not persist** (see grounding); but a subagent that calls Write/Edit **can** produce real file side-effects ([Chapter 19 · Worktree Isolation](#/en/p4-19) is precisely about letting parallel agents each edit files via Edit). The sweep **recommends** having subagents return only structured suggestions for the main loop to land. This is an engineering choice for "safety, auditability, convergence," not because subagents cannot write.

This also echoes the guardrail idea of Chapter 23's oh-my-openagent, "external models do zero writes, the orchestrator lands them": **let analysis be concurrent, let writing converge to one place**, both fast and controllable. The two-phase method splits "fast" (pipeline fanning out N analyses) and "controllable" (writes converging to one serial landing in the main loop) across two phases, so they never fight.

---

## 16.6 Idempotent and Recoverable: What If the Big List Dies Halfway

A sweep is a long task: dozens to hundreds of files, one subagent round-trip each, with a wall-clock of possibly minutes. Long tasks inevitably face two questions: **what if it gets interrupted mid-way? Will a re-run redo what is already done?**

Workflow provides two mechanisms.

**Mechanism one: resume (`resumeFromRunId`).** Same script + same args re-run is a **100% cache hit**: unchanged `agent()` calls reuse their cached results directly, at **0 tokens, 0 tool calls.** This is measured data, not an estimate. When this book resumed `hello-workflow` (Run `wf_dacbd480-d5d`), that agent returned the **exact same** result as the first run at **0 tokens / 8ms** (see `assets/transcripts/advanced.md`). For a sweep, that means: a run that scanned 100 files and died at file 80, on resume, gets the first 79 as second-level cache hits burning almost no tokens, and only live-re-runs the unfinished tail. The full resume mechanism (the runId anchor, how the cache key is computed) is in [Chapter 22 · Resume and Caching](#/en/p4-22).

```mermaid
sequenceDiagram
  participant U as main loop
  participant W as Workflow
  U->>W: first run, sweep (100 files)
  Note over W: interrupted / failed at file 80
  U->>W: TaskStop the previous run
  U->>W: resumeFromRunId re-run (same script, same args)
  Note over W: first 79 agent() calls<br/>100% cache hit (0 tokens)
  W-->>U: only live-re-runs the unfinished tail
```

Resume has two iron rules (see S-A2 / S-B2) that are exactly a sweep's design constraints:

- **TaskStop the previous run before resuming** (tool / tested), so two runs don't fight over the same journal.
- **Same session only**: the resume handle lives in this session, and cross-session is not guaranteed. True "cross-session recoverability" leans on weapon two below.

<div class="callout warn">

**Resume does not mean the script may use timestamps/random numbers.** Resume's entire premise is that the script is **replayable**: `Date.now()` / `Math.random()` / argument-less `new Date()` are banned (grounding, measured: literals are statically rejected at submit time, aliased forms throw at runtime). The reason is resume itself: if the script's results drift from run to run, the cache key is invalidated and resume degrades into a full re-run (the full rationale for this ban is in [Chapter 22](#/en/p4-22)). Timestamps should be passed via `args`. Randomness should be introduced by varying the prompt by agent index.

</div>

**Mechanism two: the report itself is a checkpoint (a bonus of report-only).** A report-only sweep changes no files, so it is **inherently idempotent**: re-running it, at worst, regenerates an identical report, and it will never break a file twice. Persist each batch's report (including the `coverage` field from 16.4), and the next batch picks up from "the remaining list where `complete:false` in the previous batch's report." This is **cross-session** recoverability: the state lives outside in report files, not in Workflow's in-session journal. This "iterate until there is nothing new left to process" form is exactly the theme of [Chapter 18 · Loop Until Dry](#/en/p4-18); a sweep's "batch and re-scan until the remaining list is empty" is one instance of loop-until-dry.

| Recovery mechanism | Scope | Cost | Use for |
|---|---|---|---|
| `resumeFromRunId` resume | **same session only** | 0 tokens (cache hit) | picking one run back up after an interruption within the same session |
| report-only + externalized list | **cross-session** | re-run the remaining list | sweeps big enough to need multiple batches, across sessions |

---

## 16.7 Design Points

- **Two-phase method**: scout the list first (cheap, single agent or passed by the main loop), then pipeline each item (expensive, N concurrent). Do not combine discovery and processing into one agent.
- **Slice shards**: use an agent with `agentType: 'Explore'` to run Glob/Grep and discover files, or just pass the list directly.
- **Structured output per shard**: use `schema` to pin down "filename + conformance + what's missing / change diff," so aggregation and landing are straightforward.
- **Report-only first**: if suggestions can be produced first, do not let the agent edit directly; suggestions are reviewable, reversible, and inherently idempotent.
- **no-silent-caps**: any reduction of coverage (cap/sampling/skipping/dedupe/failure-to-null) must be `log`-ed and written into the return value's `coverage`, preventing silent truncation from being misread as "everything was scanned."
- **If concurrent rewrites are genuinely necessary**: use `worktree` isolation (Chapter 19) to prevent trampling, and evaluate the cost.
- **Recoverable**: within a session use `resumeFromRunId` (0-token cache hit); across sessions rely on report-only + an externalized list, batched and re-scanned.
- **Stay replayable**: the script bans timestamps/random numbers, or resume degrades into a full re-run.

---

## 16.8 Chapter Summary

- A sweep = `pipeline` applying the same processing chain across files; no new API, but pushed to **scale**, which surfaces three questions: the list, the cap, and recovery. The chapter's design-points checklist is in S-16.7.
- **Two-phase method** answers "the list": scout (cheaply list the worklist) -> pipeline (expensively process each item), with a trim gate in between. Two forms: read-only analysis (report-only, safe, recommended, idempotent) and real rewrite (apply, needs `worktree` isolation to prevent trampling, expensive). The standard practice is two passes: "report first, human review, then edit."
- **no-silent-caps** answers "the cap": any coverage limit must be `log`-ed + written into `coverage`; watch out especially for `pipeline` failures-to-null getting silently eaten by `filter(Boolean)`.
- **Idempotent and recoverable** answers "recovery": within a session `resumeFromRunId` gives a 100% cache hit (measured: resuming `wf_dacbd480-d5d` at 0 tokens / 8ms); across sessions rely on report-only + an externalized list, batched and re-scanned.
- Real confirmation: pipeline-demo (`wf_bf086b98-6ec`, 6 agents) / bug-hunter (`wf_53da9a06-915`, 11 agents) have validated cross-item concurrency + structured output.

**The Practical Recipes part is now complete.** Part IV turns to the advanced patterns that make these recipes **trustworthy**: adversarial verification, loop until dry, the judge panel, completeness critique.

> Continue reading: [Chapter 17 · Adversarial Verification](#/en/p4-17)
