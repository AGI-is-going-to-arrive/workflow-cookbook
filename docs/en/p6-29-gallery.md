# Chapter 29 · Example Gallery

> In one sentence: **the previous 28 chapters explained every part of Workflow — pipeline, parallel, adversarial verification, loop-until-dry, barriers, schema, resume. This chapter assembles them into three "actually-run" application-level workflows and shows you the complete end-to-end results: Run ID, agent count, tokens, wall-clock — every one of them, all traceable.**
>
> This is a "gallery," not yet another mechanism walkthrough. Three pieces — multi-dimension code review, dead-code scan, feedback clustering — each maps to one core orchestration shape, and each comes with the real numbers and products of its actual run. What you read here is not "how it should go" but "how it actually went."

---

All three example scripts live under `assets/examples/`, and all three were **actually run** in the same session (`CLAUDE_CODE_WORKFLOWS=1`, Claude Code v2.1.150, main loop Opus 4.7 (1M)); the run records are in `assets/transcripts/examples-r5.md`. Each occupies one orchestration shape:

```mermaid
flowchart LR
    subgraph A["§29.1 review-spa<br/>pipeline + adversarial verify"]
      A1["dim 1 review"] --> A2["fan-out verify<br/>(one per finding)"]
      A3["dim 2 review"] --> A4["fan-out verify"]
      A5["dim 3 review"] --> A6["fan-out verify"]
    end
    subgraph B["§29.2 dead-code-scan<br/>loop-until-dry"]
      B1["round 1 finder"] --> B2{"empty round?"}
      B2 -->|2 empty in a row| B3["DRY_STREAK stop"]
      B2 -->|has findings| B1
    end
    subgraph C["§29.3 feedback-themes<br/>parallel barrier"]
      C1["parallel summarize<br/>(one per item)"] --> C2["barrier: wait for all"]
      C2 --> C3["cluster the whole set"]
    end
```

A table to anchor the essential difference among the three shapes:

| Shape | Representative script | When each agent finishes | When the next step proceeds | Use case |
|---|---|---|---|---|
| **pipeline + verify** | review-spa | each dimension finishes independently | this dimension verifies **the moment** its review is done, no wait for the slowest | many independent chains, "whoever's ready first goes first" |
| **loop-until-dry** | dead-code-scan | round by round, serially | stops only after N empty rounds in a row | progressive sweeps where one round may reveal new targets |
| **parallel barrier** | feedback-themes | all finish concurrently | **must wait for all to arrive** before clustering | the next step needs the whole set (cluster, aggregate, rank) |

Each piece is unpacked below. Every section follows the same structure: **pattern → script (orchestration trade-offs) → real run (Run ID + usage table) → result → teaching point.**

---

## 29.1 review-spa: Pipeline Multi-Dimension Review + Adversarial Verify

### Pattern

Review one piece of code across **multiple dimensions** (bugs / security / a11y), each dimension its own chain; the moment a dimension's review is done, **immediately** verify each of its findings, without waiting for the other dimensions. This combines two patterns — "pipeline lets each chain go its own way" and "adversarial verification trusts only findings that survive verification" — covered respectively in Chapter 8 (pipeline) and Chapter 17 (adversarial verification); here we see them combined in practice.

The real target is the book's own `index.html` (a ~600-line vanilla-JS SPA) — dogfooding, reviewing our own frontend.

### Script: Orchestration Trade-offs

The script is `assets/examples/review-spa.js`. Its skeleton is one `pipeline()`, with each of 3 dimensions forming a two-stage chain:

```javascript
  const reviewed = await pipeline(
    DIMENSIONS,
    // Stage 1 — review one dimension.
    d => agent(d.prompt, { label: `review:${d.key}`, phase: 'Review', schema: FINDINGS }),
    // Stage 2 — verify every finding from that dimension, in parallel.
    (review, d) => parallel(
      (review?.findings ?? []).map(f => () =>
        agent(
          `Adversarially verify this finding about ${TARGET}. Read the cited lines and try hard to refute it; ` +
          `if you cannot, it is real.\nTitle: ${f.title}\nEvidence: ${f.evidence}\nSeverity: ${f.severity}`,
          { label: `verify:${d.key}`, phase: 'Verify', model: 'haiku', schema: VERDICT },
        ).then(v => ({ ...f, dimension: d.key, verdict: v })),
      ),
    ),
  )
```

Three design trade-offs worth pausing on:

**Trade-off 1: Why `pipeline` instead of "review all first, then verify everything together"?** Because pipeline's promise is "each item flows through all stages independently, with no barrier between stages" (see Chapter 8). When the bugs dimension is done, its 6 findings enter verification **immediately**, without waiting for the slower a11y chain to finish reviewing. If you instead did "`parallel` over three dimensions → then `parallel` over all findings," you'd introduce a redundant barrier: the fastest dimension stuck waiting for the slowest. Pipeline lets review and verification **interleave**, shortening wall-clock.

**Trade-off 2: review uses schema=`FINDINGS`, verify uses schema=`VERDICT`.** Each stage has its own strong-typed contract. The review stage forces the reviewer to return `{findings:[{title, evidence, severity}]}`; the verify stage forces the verifier to return `{isReal:boolean, reason}`. Schema is validated at the tool-call layer and returns a validated object (see Chapters 6, 7), so `review?.findings` and `f.verdict?.isReal` can be used directly as structured data, no `JSON.parse` needed.

**Trade-off 3: the verify agent is told to "try hard to refute."** The prompt reads "try hard to refute it; if you cannot, it is real" — this is the soul of adversarial verification: doubt by default, count it real only if you can't refute it. The script's final `.filter(f => f.verdict?.isReal)` keeps only the survivors.

<div class="callout info">

**About `model: 'haiku'`**: the script tags the verify agents with `model: 'haiku'` (verification is a relatively simple checking task, intended for a cheap model). But **this session set `CLAUDE_CODE_SUBAGENT_MODEL=claude-opus-4-7[1m]`, which overrides any per-call model** (see `_grounding.md` §A2, Run `wf_9c94951d-58c`) — so these "haiku" verifiers all actually ran on Opus. This is one reason this run's token count is on the high side. §29.3 covers this cost trap in detail.

</div>

### Real Run

- **Run ID**: `wf_97b81e86-a0b` (Task `wq64i8tjl`)
- **Target**: `index.html` (~600-line vanilla-JS SPA)

| Metric | Value |
|---|---|
| agent_count | **22** (3 reviewers + 19 verifiers) |
| total_tokens | **991,554** |
| tool_uses | **148** (reviewers/verifiers repeatedly Read the same file) |
| duration_ms | **395,166** (≈6.6 minutes) |
| return | `{ confirmedCount: 18, confirmed: [...] }` |

agent_count=22 breaks down cleanly: 3 reviewers (one per dimension), plus 19 verifiers fanned out over all findings across the three dimensions, totaling 22.

### Result

18 findings survived adversarial verification (`verdict.isReal=true`), distributed by dimension: **bugs 6 / security 4 / a11y 8**. Highlights below (full 18 in `assets/transcripts/examples-r5.md`):

**bugs (6)** — e.g., the most severe one: `slugify` dedup uses a bare `{}` as the `seen` map (L322/521); `seen={}` inherits `Object.prototype`, so the title "constructor" gets id `constructor-NaN` (`++function` evaluates to `NaN`). Fix: `Object.create(null)`. The rest cover anchor resolution, dedup collisions, deep-link overriding language preference, hardcoded Chinese error messages, and scroll/resize sharing a `ticking` flag.

**security (4)** — all **latent / supply-chain** issues with no attacker input surface: mermaid SVG injected via `innerHTML` after sanitize (relying only on `securityLevel:'strict'`), 4 CDN scripts with no SRI, `ghLink.href` with no scheme validation, and inconsistent escaping of manifest fields.

**a11y (8)** — the most concrete one: the whole `#content` carries `aria-live="polite"` (L289/488), so every navigation reads the entire chapter aloud. The rest cover missing `aria-current`, the mobile drawer background not being `inert`, the home page not moving focus on switch, mermaid SVGs with no alt text, code blocks not keyboard-scrollable, and more.

### Teaching Point: Adversarial Verification Corrected the Reviewer's Exaggerations

What you should remember from this section is not "found 18 bugs," but — **the verify stage didn't just judge true/false; it corrected the reviewer's exaggerations.** The precision clarifications in `verdict.reason` are themselves a product:

- **#1/#2 title exaggeration caught**: the reviewer's title listed `constructor / valueOf / toString / ...`, multiple prototype keys all triggering the bug, but the verifier found by testing that **only `constructor` actually triggers** — the rest get flattened by `.toLowerCase()` to `valueof`/`tostring` and miss; and a grep of the whole repo found **no "constructor" title at all**. So this was **downgraded to latent** (potential, not triggering today), and the high severity was judged too high.
- **#2 a false sub-claim refuted**: the reviewer claimed ordinary dedup anchors like `#overview-1` were also unreachable — the verifier found by testing that **ordinary dedup (`-1`/`-2`) main lookups hit perfectly and are reachable**, and only the one `constructor-NaN` special case breaks. This false sub-claim was caught outright.
- **#3 wording error corrected**: the reviewer said "the 2nd `Setup`" when it should be "the 3rd `Setup`" (the underlying mechanism still holds, just the description was off).

```mermaid
flowchart TD
    R["reviewer raises finding<br/>title: constructor/valueOf/toString all hit<br/>severity: high"]
    R --> V["verifier tries hard to refute<br/>reads cited lines, greps whole repo"]
    V --> F1["tested: only constructor triggers<br/>rest flattened by toLowerCase"]
    V --> F2["tested: no 'constructor' title in repo"]
    F1 --> D["verdict.isReal=true<br/>but reason notes: actually latent,<br/>severity too high"]
    F2 --> D
    D --> OUT["product = finding + calibrated precision"]
```

<div class="callout tip">

**A finding surviving ≠ taking it wholesale.** A finding being `isReal=true` only means "it wasn't fabricated"; whether its severity is accurate, its wording precise, or whether it "triggers today" versus is "latent" — that's in `verdict.reason`. This run accordingly split the 18 into three tiers: "triggers today, not latent" high-priority items (e.g., removing `#content`'s `aria-live`), "real but low-impact" ordinary items, and "latent / supply-chain / transient" optional defensive items. **Adversarial verification's value is not just filtering false findings, but assigning each real finding a trustworthy priority** — that's the practical meaning of Chapter 17's adversarial verification.

</div>

---

## 29.2 dead-code-scan: Loop-Until-Dry Dead-Code Scan

### Pattern

Scan a target round by round for symbols that are "defined but never referenced anywhere in the file," **stopping only after several empty rounds in a row.** This is the loop-until-dry shape (Chapter 16): use a `while` loop to repeatedly dispatch an agent until it's "dry" (consecutive empty rounds) — because confirming one symbol dead may make another symbol obviously removable too, so you can't stop after just one round.

The real target is again `index.html` (the SPA's inline vanilla JS).

### Script: Orchestration Trade-offs

The script is `assets/examples/dead-code-scan.js`; the core is a `while` with dual termination conditions:

```javascript
  const DRY_STREAK = 2 // stop after this many empty rounds in a row
  const MAX_ROUNDS = 5 // hard cap so the loop always terminates

  const found = []
  let emptyRounds = 0
  let round = 0

  while (emptyRounds < DRY_STREAK && round < MAX_ROUNDS) {
    round++
    phase('Find')
    const { items } = await agent(
      `Round ${round}. Read ${TARGET} and search the same file for references. List vanilla-JS symbols ` +
      `(functions, const/let bindings, event handlers) that are DEFINED but never REFERENCED anywhere in the file. ` +
      `Report only — do NOT edit any file. Ignore anything already reported: ` +
      `${found.map(r => r.symbol).join(', ') || 'nothing yet'}.`,
      { label: `find:round-${round}`, phase: 'Find', schema: DEAD },
    )

    if (items.length === 0) {
      emptyRounds++
      log(`Round ${round}: clean (${emptyRounds}/${DRY_STREAK} empty rounds)`)
      continue
    }

    emptyRounds = 0
    found.push(...items)
  }
```

Two design trade-offs:

**Trade-off 1: dual termination conditions (`DRY_STREAK` + `MAX_ROUNDS`).** `emptyRounds < DRY_STREAK` is the normal exit for "stop once dry"; `round < MAX_ROUNDS` is the hard cap of "run at most 5 rounds no matter what." The latter is a safety net — should the agent report something new every round (even noise), the loop won't run forever. This echoes the runaway-loop backstop idea in `_grounding.md` ("lifetime `agent()` total cap 1000"): loop-style workflows **must** carry their own hard cap.

**Trade-off 2: report-only, never edits files.** The prompt spells out `Report only — do NOT edit any file`. This is the safe posture for a scanning "sweep" — report first, human reviews, then decide whether to change, rather than letting the agent delete code automatically. Deleting dead code wrongly can introduce subtle bugs, so non-destructive by default (cf. Chapters 16, 18).

**Trade-off 3: feed already-reported symbols back into the prompt (`Ignore anything already reported: ...`).** This prevents later rounds from re-reporting the same symbol, keeping the "empty round" judgment clean.

### Real Run

- **Run ID**: `wf_2283ab37-710` (Task `w4ii328zm`)
- **Target**: `index.html`

| Metric | Value |
|---|---|
| agent_count | **2** (2 rounds × 1 finder) |
| total_tokens | **116,344** |
| tool_uses | **14** (finder repeatedly Read/grep the same file) |
| duration_ms | **246,496** (≈4.1 minutes) |
| return | `{ rounds: 2, candidateCount: 0, candidates: [] }` |

### Result

**Both rounds were 0 candidates.** Round 1 was clean (`emptyRounds=1`), round 2 was still clean (`emptyRounds=2`), two empty rounds in a row reached `DRY_STREAK`, and the loop exited normally — it did **not** run out the 5-round cap. agent_count=2 exactly confirms "2 rounds × 1 finder."

Final product: `index.html` has **no symbols that are defined yet never referenced** — a clean bill of health.

### Teaching Point: Zero Findings Also Terminates Correctly

```mermaid
stateDiagram-v2
    [*] --> Round1
    Round1 --> Check1: 0 candidates
    Check1 --> Round2: emptyRounds=1 < 2
    Round2 --> Check2: 0 candidates
    Check2 --> Done: emptyRounds=2 == DRY_STREAK
    Done --> [*]: return rounds=2, candidateCount=0
    note right of Done
      did NOT run out MAX_ROUNDS=5
      converges at 2 empty rounds
    end note
```

The counterintuitive point of this section: **a workflow that "found nothing" is also a successful run.** Many people writing loop-style workflows instinctively worry "if it finds nothing, will it loop forever / run out the cap?" — this run gives a clear answer: loop-until-dry's termination condition is "N empty rounds in a row," so **even with zero findings on the first round, two empty rounds in a row still make it converge cleanly**, never running out `MAX_ROUNDS`.

<div class="callout tip">

**Two transferable engineering disciplines.** ① **A loop must have a hard cap**: `DRY_STREAK` decides "when it normally stops," `MAX_ROUNDS` backstops "at worst how many rounds" — you need both — with only the former, persistent noise runs away; with only the latter, it cuts off a scan that could have converged too early. ② **Scans default to report-only**: destructive operations (deleting code, editing files) should first produce a "candidate list" for human review, rather than the agent executing automatically. This run's 0 candidates happens to showcase the safest form of a non-destructive scan — it just looked, and touched nothing.

</div>

---

## 29.3 feedback-themes: Parallel-Barrier Clustering

### Pattern

**Summarize a batch of feedback in parallel**, then cluster the **whole set** into ranked themes. The key: the cluster step **must wait for every summary to arrive** before it can run — you can't cluster a single piece of feedback on its own. This is exactly the right scenario for `parallel()` as a **barrier** (rather than a pipeline) (Chapter 8 contrasted the two).

The input is a clearly-labeled **synthetic sample** `assets/samples/feedback-sample.csv` (18 rows, columns `id,text`); but **the run itself is real** — Run ID, tokens, and clustered output are all traceable.

### Script: Orchestration Trade-offs

The script is `assets/examples/feedback-themes.js`, in three segments: single agent loads → `parallel` barrier summarizes → single agent clusters:

```javascript
  phase('Load')
  const { items } = await agent(
    `Read ${SOURCE} (a CSV with columns id,text). Return every row as an item with its id and text.`,
    { label: 'load', phase: 'Load', schema: ITEMS },
  )

  // Barrier on purpose: the next step clusters across the WHOLE set, so it needs
  // all summaries together before it can run.
  const summaries = await parallel(items.map(it => () =>
    agent(
      `Summarize this feedback in one sentence and name the single issue it is about.\nID ${it.id}: ${it.text}`,
      { label: `summarize:${it.id}`, phase: 'Summarize', model: 'haiku' },
    ).then(summary => ({ id: it.id, summary })),
  ))

  const labelled = summaries.filter(Boolean)

  phase('Cluster')
  const { themes } = await agent(
    `Here are ${labelled.length} summarized feedback items. Cluster them into themes, count the items ` +
    `under each, pick one representative quote per theme, and rank the themes by count (descending).\n\n` +
    labelled.map(l => `- [${l.id}] ${l.summary}`).join('\n'),
    { label: 'cluster', phase: 'Cluster', schema: THEMES },
  )
```

Design trade-offs:

**Trade-off 1: Why is this a `parallel` barrier, while §29.1 is a `pipeline`?** The difference is "does the next step need the whole set." §29.1's verification needs only **this dimension's** findings, so pipeline lets the dimensions interleave without waiting on each other. Here, clustering needs **all 18 summaries together** to group, count, and rank — one fewer, and the cluster result might change. So a barrier is mandatory: `parallel()` waits for all summaries to return before entering clustering. **"Does the next step depend on the whole set" is the deciding line between pipeline and barrier.**

**Trade-off 2: `.filter(Boolean)`.** `parallel()`'s semantics are "an agent erroring → that slot is `null`, the call itself doesn't reject" (see Chapter 8). So after getting `summaries`, first `.filter(Boolean)` to drop failed slots, then feed clustering — this is the standard defensive pattern when using `parallel`.

### Real Run

- **Run ID**: `wf_b3febb70-ad9` (Task `wh31drag1`)
- **Input**: `assets/samples/feedback-sample.csv` (18 rows)

| Metric | Value |
|---|---|
| agent_count | **20** (1 load + 18 summarize + 1 cluster) |
| total_tokens | **607,307** |
| tool_uses | **3** |
| duration_ms | **122,391** (≈2.0 minutes) |
| return | `{ itemCount: 18, themeCount: 8, themes: [...] }` |

agent_count=20 exactly matches "1 load + 18 summarize (one per row) + 1 cluster," consistent with the 18-row input.

### Result

18 feedback items clustered into **8 themes** (descending by count, quoting the real cluster output):

| Rank | Theme | count | Representative quote (excerpt) |
|---|---|---|---|
| 1 | Onboarding friction (unclear steps, missing prerequisites, slow value realization) | 4 | "the first-run experience requires reading three documentation pages before the app delivers any value." |
| 2 | Performance & load speed (dashboard / analytics / chart rendering) | 3 | "the dashboard takes nearly 8 seconds to load, making the app feel sluggish" |
| 3 | Billing accuracy & clarity (pricing definitions, double charges, recipient config) | 3 | "Customer was charged twice this month and waited four days for a support response" |
| 4 | Error-handling quality (unhelpful messages, crashes) | 2 | "error messages are too generic and unhelpful" |
| 5 | Feature requests (export, power-user navigation) | 2 | "add an export-to-CSV button on the reports screen" |
| 6 | Accessibility & UI defects (contrast, Esc-to-close modal) | 2 | "Modal dialogs cannot be closed with the Escape key" |
| 7 | Documentation gaps (failure/recovery scenarios) | 1 | "the lack of guidance on recovering from a failed migration." |
| 8 | Search internationalization (non-Latin / Unicode support) | 1 | "the search box fails to return any results for queries containing non-Latin characters (e.g., Japanese)" |

The counts sum to 4+3+3+2+2+2+1+1 = 18, self-consistent with the input item count.

### Teaching Point 1: The Right Scenario for a Barrier

```mermaid
flowchart TD
    L["load: read 18-row CSV"] --> P["parallel barrier"]
    P --> S1["summary #1"]
    P --> S2["summary #2"]
    P --> Sd["… (18 total, concurrent)"]
    P --> S18["summary #18"]
    S1 --> BAR{"barrier: wait for all 18"}
    S2 --> BAR
    Sd --> BAR
    S18 --> BAR
    BAR --> C["cluster: group + count + rank across whole set"]
    C --> OUT["8 themes"]
```

Clustering is a "whole-set function" — its input is the **entire batch** of summaries, and one fewer could change the result. This kind of "the next step must consume all upstream results" dependency is exactly why a barrier exists. Conversely, if a step depends only on a **single** upstream result (like §29.1's verification, which only looks at this dimension's single finding), use a pipeline to let them interleave instead of waiting needlessly. **Rule of thumb: next step depends on the whole set → barrier (parallel); next step depends only on a single item → pipeline.**

### Teaching Point 2: Cost in Practice — the haiku Tag Silently Overridden by Opus

This is the cost trap most worth watching in this chapter. The script tags all 18 summarize agents with `model: 'haiku'` (summarizing is a simple task, intended to save money). But this session set the environment variable `CLAUDE_CODE_SUBAGENT_MODEL=claude-opus-4-7[1m]` — **which overrides any per-call model** (see `_grounding.md` §A2, Run `wf_9c94951d-58c`). Result: the 18 agents tagged "haiku" **actually all ran on Opus 1M**, burning **607,307 tokens** in a single run.

<div class="callout warn">

**`CLAUDE_CODE_SUBAGENT_MODEL` is a user/CI knob; the script cannot control it.** Once this environment variable is set, the `model: 'haiku'` (or any per-call model) written in the workflow script is **silently ignored** — the agent doesn't error, it just quietly runs as the model the environment variable specifies. This run's 607k tokens is the direct consequence of 18 "haiku" agents actually running Opus, confirming the tested conclusion in `_grounding.md` §A2 (Run `wf_9c94951d-58c`: 5 agents with different `model` options all ran Opus).

**Implication**: in a session with this variable set, `model: 'haiku'` **saves no money.** To actually save money, the user or CI must adjust `CLAUDE_CODE_SUBAGENT_MODEL`; the script author has no say. So the assumption "I tagged the summaries haiku, it should be cheap" **may not hold at all** in a controlled CI/session environment — always go by the actual token usage.

</div>

Putting the "nominal model" and "actual model" of the three runs side by side, the trap is obvious:

| Script | model tagged in script | model actually run | Reason |
|---|---|---|---|
| review-spa | verifier tagged `haiku` | Opus 1M | env var override |
| feedback-themes | 18 summarize tagged `haiku` | Opus 1M | env var override |
| (control) `wf_9c94951d-58c` | 5 agents tagged haiku/opus/inherit/omitted | all Opus 1M | env var override |

---

## 29.4 How to Read These Numbers

With all three pieces seen, let's distill the "reading method" running through them into four transferable intuitions. These aren't new mechanisms but **estimation heuristics** drawn from real runs — next time you write a workflow and see `usage` in the completion notification, you can immediately judge "is this number reasonable."

**Heuristic 1: tokens ≈ agent count × per-agent context (~30k).** This is the most useful rough estimate. Verify against the three runs:

| Script | agent count | total_tokens | per-agent average |
|---|---|---|---|
| review-spa | 22 | 991,554 | ≈45,071 |
| dead-code-scan | 2 | 116,344 | ≈58,172 |
| feedback-themes | 20 | 607,307 | ≈30,365 |

`feedback-themes` is closest to "~30k per agent" (summarize agents have short context); `review-spa` and `dead-code-scan` run higher, because the reviewer/finder repeatedly Read the same 600-line file, with heavier context (look at `tool_uses`: review-spa as high as 148, dead-code-scan 14). So the formula gives a **lower-bound order of magnitude**; re-reading files, long prompts, and adversarial verification all push it up. The point: **tokens are mainly driven by agent count** — to save tokens, first ask "can I dispatch fewer agents."

**Heuristic 2: wall-clock depends on the critical path; concurrency compresses N into "the slowest one."** Comparing tokens and wall-clock reveals they're **not proportional**:

| Script | agent count | total_tokens | duration_ms | shape |
|---|---|---|---|---|
| review-spa | 22 | 991,554 | 395,166 | pipeline + fan-out |
| feedback-themes | 20 | 607,307 | **122,391** | parallel barrier |

`feedback-themes` used 20 agents and 600k tokens, yet wall-clock was only **2 minutes** — because the 18 summarize agents ran **concurrently**, compressing wall-clock to the critical path of "the slowest single summary + load + cluster," not 18 in series. By contrast `review-spa`'s 6.6 minutes is because each chain in the pipeline is two serial stages ("review→verify"), with many fanned-out verify agents. **Concurrency saves wall-clock (not tokens)**: the tokens still get spent, but with N agents running at once, you only wait for the slowest one.

**Heuristic 3: adversarial verification / fan-out is the token heavyweight.** Of `review-spa`'s 22 agents, 19 are verifiers — adversarial verification's fan-out of "one verify agent per finding" is the main reason it approaches a million tokens. This is a **worthwhile cost**: the extra tokens bought the calibration value of "downgrading #1/#2 to latent, catching #2's false sub-claim" (see §29.1's teaching point). But be aware — **giving every finding its own verify agent makes tokens grow linearly with finding count.** When there are many findings, consider adversarially verifying only the high-severity ones, and set a token boundary (with Chapter 21's `budget`).

**Heuristic 4: scripts are re-runnable, numbers are traceable.** All three scripts can be re-run with `Workflow({ scriptPath: 'assets/examples/<script>.js' })` (returns asynchronously; on completion `<task-notification>` reports back `usage`/`result`). Every Run ID, agent count, tokens, and wall-clock in this chapter is recorded in `assets/transcripts/examples-r5.md`, checkable item by item. This book later **re-ran these three scripts as-is once** (`wf_ca7aa11f-6fb` / `wf_ccda2a68-fab` / `wf_0771c834-a9f`, recorded in `assets/transcripts/examples-r6.md`) — and the result confirms Heuristic 4 exactly: **agent count and orchestration shape reproduce stably** (dead-code was still 2 agents / 2 clean rounds; feedback still 20 agents), while **finding/theme counts drift slightly with the target's evolution and clustering granularity** (review-spa 18→14, because `index.html` had been polished per the first run's findings; feedback 8→6 themes, a clustering-granularity difference). For digit-for-digit reproduction, use resume (Chapter 22).

<div class="callout info">

**Why might your re-run numbers not exactly match this chapter?** Three reasons: ① **model environment** — this chapter is an Opus 1M main loop + `CLAUDE_CODE_SUBAGENT_MODEL` override (see §29.3); change the model environment and both tokens and wall-clock change. ② **target content changes** — `review-spa`/`dead-code-scan` scan `index.html`, which evolves as the book iterates, so finding counts naturally differ (e.g., after the book's frontend is polished, a11y findings may drop). ③ **models aren't fully deterministic** — for the same script and same target, reviewer wording and finding counts may fluctuate slightly. So this chapter's numbers are a **snapshot of one real run**, not "constants"; their value is to help you build a sense of magnitude, not to chase digit-for-digit reproduction. What does reproduce digit-for-digit is **resume** (same script + same args = 100% cache hit, see Chapter 22) — that's the deterministic guarantee.

</div>

---

## 29.5 Chapter Summary

- Three "actually-run" application-level pieces, each mapping to one core orchestration shape, all numbers traceable to `assets/transcripts/examples-r5.md`:
  - **§29.1 review-spa** (`wf_97b81e86-a0b`, 22 agents / 991,554 tokens / 395,166ms): pipeline multi-dimension review + adversarial verify, 18 confirmed (bugs 6 / sec 4 / a11y 8). Teaching point — **adversarial verification corrected the reviewer's exaggerations** (several downgraded to latent, one false sub-claim caught): a finding surviving ≠ taking it wholesale.
  - **§29.2 dead-code-scan** (`wf_2283ab37-710`, 2 agents / 116,344 tokens / 246,496ms): loop-until-dry, 2 rounds all clean, 0 candidates, `DRY_STREAK` termination. Teaching point — **zero findings also terminates correctly**, report-only non-destructive, a loop must have a hard cap.
  - **§29.3 feedback-themes** (`wf_b3febb70-ad9`, 20 agents / 607,307 tokens / 122,391ms): parallel barrier, 18 items→8 themes. Teaching point — **the right scenario for a barrier** (clustering needs the whole set) + **cost trap**: `CLAUDE_CODE_SUBAGENT_MODEL` overrides the script's `model:'haiku'`, 18 "haiku" agents actually ran Opus → 607k tokens in one run.
- **§29.4 four reading heuristics**: ① tokens ≈ agent count × ~30k per agent (re-reading files pushes it up); ② wall-clock depends on the critical path, concurrency compresses N into the slowest one (saves wall-clock, not tokens); ③ adversarial verification/fan-out is the token heavyweight; ④ scripts are re-runnable via `Workflow({ scriptPath })`, numbers traceable to `examples-r5.md`.

This chapter assembled the book's parts into a running machine. You've now seen them actually run — next, head to the appendix to look up each API's complete signature and boundaries, settling these intuitions into a ready reference.

> Continue reading: [Appendix A · Complete API Reference](#/en/app-a)
