# Chapter 25 · Building Your Own Workflow Library

> Writing your own workflow from scratch? Read [Chapter 27 · The Authoring Workflow](#/en/p6-27) first, then come back here to settle it into a library.
>
> Chapter 24 taught you to **extract** good ideas into a validated Workflow script. But a `.js` file sitting in a session directory, used once and tossed, has only delivered half its value. This chapter is about how to **settle those scripts into a library**: callable by name, reusable with parameters, version-controlled, regression-tested, and shareable with your team.
>
> The technical bedrock under all of this is the plain fact Chapter 01 spelled out: **every time you call, the Workflow script lands on disk as a file.** Since it's a file, it can be named, version-controlled, diffed, and reused. This chapter cashes that fact in as a set of engineering practices you can copy straight over.

---

## 25.1 Two Roads to a Library: Official Surface First, On-disk Scripts Second

"Build your own workflow library" sounds like a big project, but the entry the official docs left for ordinary users is as light as it gets: **finish a run you're happy with, press one key, and it's in the library.** Lay out the two roads first, and you'll know which one you're on.

**Road one · the official surface (where most people start).** You had Claude run a workflow, you liked the result, and you want one-key reuse. In the `/workflows` view, press **`s`**, and the script behind this run is **saved as a `/` command**: it shows up in the **autocomplete** list when you type `/`, **alongside** the bundled `/deep-research`, and next time you just type `/<the name you gave it>` to run it again (official wording: your saved workflows become `/` commands and appear in autocomplete). This road **doesn't make you touch any file or configure any directory**; the terminal-side mechanics of pressing `s` have a hands-on walkthrough in [The Official Control Panel §6](#/en/p2-ops). For most people, a "library" is just a stack of these, accreted one `s` at a time.

> **Keystroke recap**: in `/workflows`, select this run, press `s`, use `Tab` to switch project-level / personal, press `Enter`.
> For the full terminal-side mechanics (every key, every destination in detail), still see [The Official Control Panel §6](#/en/p2-ops).

**Road two · on-disk scripts (power-user / advanced).** Once you've accreted enough and want to manage them properly (version, parameterize, write regression tests, share with the team), you file validated scripts as **files** into `.claude/workflows/` and reuse them like named commands with `{ name: 'my-workflow' }` (this is exactly that sentence from Chapter 01 §1.7). This road cashes the plain fact "a script is a file" into a full set of engineering practices, and everything from 25.2 onward is about it.

**How do the two roads relate?** They're the "light" and "heavy" ends of the same thing. The official surface (press `s`) lets you **turn a single run into a reusable command with zero friction**, good for ad-hoc settling; on-disk scripts (`.claude/workflows/` plus `{ name }`) let you **manage those commands as code**, good for running a library systematically. Beginners start on road one and transition naturally to road two when they need versioning, parameters, tests, or sharing.

> The rest of this chapter is mostly about **road two**, because the substantive questions ("how to organize, name, parameterize, test, share") all live on the on-disk side. The surface-side `s`-to-save is already simple enough; The Official Control Panel covers it and that's that.

---

### The three calling entries: `script` / `name` / `scriptPath`

On road two, first sort out the difference between the three calling forms. They map to the three mutually exclusive entry fields of `WorkflowInput`, and `scriptPath` wins (source: `assets/_grounding.md` section B):

| Entry field | Meaning | Applicable stage |
|---|---|---|
| `script` | A self-contained script string, must begin with the pure literal `export const meta` | **Exploration**: writing it for the first time, iterating fast |
| `name` | A predefined/named workflow (built-in or in `.claude/workflows/`) | **After settling**: reusing a validated workflow |
| `scriptPath` | An on-disk script path, with priority **higher than** `script`/`name` | **Iteration/testing**: re-running an edited disk file, resuming |

<div class="callout info">

**`scriptPath` has the highest priority** (per section B). What that means: while you're iterating a script, saving it to disk and re-running it over and over with `{ scriptPath }` is the smoothest path; once it's stable, moving it into `.claude/workflows/` and calling it with `{ name }` turns it into a named tool in the library. **`name` is for the people who use it, `scriptPath` is for the person who writes it.**

</div>

A script growing from "one-off" into a "library member" runs roughly through this lifecycle:

```mermaid
flowchart LR
  A["explore<br/>{ script: '...' }"] --> B["land and iterate<br/>{ scriptPath }"]
  B --> C["regression test<br/>{ scriptPath, resumeFromRunId }"]
  C --> D["settle<br/>move into .claude/workflows/"]
  D --> E["reuse<br/>{ name: 'my-wf', args }"]
  E -.find something to change.-> B
```

The rest of this chapter follows that lifecycle, handing you engineering practices station by station.

---

## 25.2 Directory Structure: Organizing `.claude/workflows/`

Named workflows live under the project's (or the user's home) `.claude/workflows/`. While the library is small, flat is fine; once it grows, you need some structure. Below is a **suggested** scaffold (the runtime doesn't enforce it, it's just an organizational convention):

```text
.claude/
└── workflows/
    ├── README.md                  # library index: one line per workflow, name + one-liner + args
    ├── review/                    # grouped by domain: review category
    │   ├── two-stage-review.js
    │   ├── pr-multidim.js
    │   └── sharded-review.js
    ├── research/                  # research category
    │   └── deep-research.js
    ├── loop/                      # loop category
    │   ├── acceptance-loop.js
    │   └── loop-until-dry.js
    ├── _lib/                      # "quasi-library": unstable drafts, debugged via scriptPath
    │   └── draft-*.js
    └── _fixtures/                 # fixed inputs for regression tests (see 25.6)
        ├── pr-sample.json
        └── stories-sample.json
```

A few organizing principles:

1. **Group by "recipe type," not by project module.** What makes a workflow worth reusing is its **pattern** (review, research, loop, fan-out), not whichever module it happens to handle today. The `two-stage-review.js` under `review/` can review something else tomorrow.
2. **`_`-prefixed directories are the "informal zone."** `_lib/` holds drafts still being debugged with `scriptPath`, not yet stable; `_fixtures/` holds test inputs. The underscore prefix tells you this isn't a finished product to call directly with `{ name }`.
3. **One file, one workflow, filename = `meta.name`.** That way `{ name: 'two-stage-review' }` and the file `two-stage-review.js` map one-to-one: find the file and you've found the workflow.
4. **`README.md` is the library's table of contents.** What it is to the library, this book's `manifest.json` is to the whole book: an index.

<div class="callout tip">

**User-level vs project-level.** Workflows you put in the project's `.claude/workflows/` travel with the project (you can commit them to that project's repo and the team shares them); ones you put in the user's home `~/.claude/workflows/` travel with you as a person (every project can use them). How to decide: anything tied to a specific project (say, "review this repo's PR template") goes project-level; general methodologies (say, "judge panel," "deep research") go user-level.

</div>

---

## 25.3 Naming Conventions: Make `name` Self-explanatory

The three fields `meta.name`, `meta.description`, `meta.whenToUse` are the library's "public API." Whether someone using it (a human or a caller) can tell at a glance "what this is for, and when to use it" comes down entirely to them. Remember Chapter 01: `meta` shows up in the permission dialog and the workflow list, so these three fields are really **documentation written for humans.**

### name: verb-noun, kebab-case

| Counter-example | Problem | Good example |
|---|---|---|
| `wf1` / `test` / `my-workflow` | No information | —— |
| `review` | Too vague; review what? how? | `two-stage-review` |
| `doStuffWithPRsAndReviewThem` | camelCase + verbose | `pr-multidim-review` |
| `reviewTheCurrentBranchPullRequest` | Contains words like "current/the" that will go stale | `pr-multidim-review` |

The convention: **`<action>-<object>[-<qualifier>]`, all lowercase kebab-case, no demonstratives that'll go stale (current/this/the).** The filename matches it.

### description: one line, stating "what it does + the key constraint"

`description` shows up in the permission dialog; the user leans on it to decide whether to authorize this fan-out. So it should answer "what this workflow will do, and roughly how much commotion." Take a look at this book's real scripts' descriptions (all from real-run transcripts):

```javascript
// meta.description from real runs (traceable)
{ name: 'judge-panel',
  description: 'A/B evaluation: two candidates scored by 3 independent judges, then tallied' }
// → at a glance: 2 candidates + 3 judges + tally. Scale is predictable.

{ name: 'gcf-slugify',
  description: 'Generate-Critique-Fix loop producing a robust slugify (CJK + ASCII)' }
// → at a glance: three stages (generate-critique-fix), produces a slugify (covering CJK + ASCII)
```

### whenToUse: optional, but extremely valuable for a library

`whenToUse` (optional, shown in the workflow list) answers "**when** should I be chosen." Once the library grows, someone facing a row of workflows leans on `whenToUse` to pick:

```javascript
export const meta = {
  name: 'two-stage-review',
  description: 'Spec-compliance gate then code-quality gate, each deterministic',
  whenToUse: 'When you have a batch of implemented tasks (with spec + diff) and need to first ensure ' +
             '"precise implementation" then "quality." For plain bug-finding use bug-hunter; for only style opinions use pr-multidim-review.',
}
```

<div class="callout warn">

**`meta` must be a pure literal** (section B hard constraint). So `description`/`whenToUse` **cannot** be stitched together with template interpolation (e.g., `` `Review ${args.target}` ``), because the runtime reads `meta` statically, before execution, and at that point `args` doesn't exist yet. Want the description to vary with arguments? Push the varying part into `log()` (runtime output) and keep `meta` static. This is an anti-pattern Chapter 26 digs into.

</div>

---

## 25.4 Parameterization: Use `args` to Turn a Script into a "Reusable Tool"

A script with a hard-coded target isn't a library member; it's a one-off script. **The watershed between "one-off" and "reusable" is parameterization.** The tool for the job is `args` (section B: "the global `args` exposed to the script"; Chapter 01: "the arguments object passed in by the caller").

### From hard-coded to parameterized

Put two versions of the same "multi-dimension review" workflow side by side:

```javascript
// ✗ Hard-coded version — can only review index.html, change the target and you must edit the source
phase('Review')
const reviews = await parallel([
  () => agent('Review index.html from the a11y dimension ...', { schema: REVIEW_SCHEMA }),
  () => agent('Review index.html from the performance dimension ...', { schema: REVIEW_SCHEMA }),
])
```

```javascript
// ✓ Parameterized version — what to review and which dimensions are decided by the caller
export const meta = {
  name: 'multidim-review',
  description: 'Review a target from N independent dimensions, then synthesize',
}

// The argument contract (written into README and whenToUse):
//   args.target      string   the object under review (path or content)
//   args.dimensions  string[] the dimension list, defaults to a11y/perf/correctness
const target = args.target
const dimensions = args.dimensions || ['accessibility', 'performance', 'correctness']

phase('Review')
const reviews = await parallel(
  dimensions.map((dim) => () =>
    agent(`Review the following object from the "${dim}" dimension, listing issues and severity.\nObject: ${target}`,
      { label: `review:${dim}`, phase: 'Review', schema: REVIEW_SCHEMA })
  )
)
```

The parameterized version uses `args.dimensions.map(...)` to make **even the number of dimensions configurable**: 3 dimensions or 5, the caller decides and the script doesn't budge. To call it:

```javascript
// How a consumer uses it
Workflow({
  name: 'multidim-review',
  args: { target: 'src/api/handler.ts', dimensions: ['security', 'performance'] },
})
```

### The discipline of parameterization

<div class="callout warn">

**`args` is the only legitimate way around "the ban on `Date.now()`/`Math.random()`."** Both Chapter 01 and section B drive it home: the script bans `Date.now()` / `Math.random()` / arg-less `new Date()`, because they break replayability and break resume. **Need a timestamp? Pass it in via `args.runDate`; need a random seed? Use `args.seed`.** That way the script stays replayable for "the same args," and regression testing (25.6) holds up.

</div>

A handful of design rules for parameterization:

1. **Give defaults.** Write `args.dimensions || [...]` so it runs even when the caller passes nothing, which lowers the barrier to use.
2. **Write the argument contract into the docs.** Spell out each parameter's type and meaning in three places: a comment at the top of the script, in `whenToUse`, and in `README.md`. `args` has no schema enforcement (it's an arbitrary object), so the docs are the contract.
3. **Put argument validation right up front.** If a required argument is missing, `log` and throw as early as you can; don't let it run halfway and then crash on `undefined`:

```javascript
// Argument validation: fail early if a required item is missing, with a clear message
if (!args || typeof args.target !== 'string') {
  throw new Error('multidim-review requires args.target (string); optional args.dimensions (string[])')
}
```

---

## 25.5 Version Management: A Script Is a File, So Use Git

The biggest payoff of "a script is a file" is that your Workflow library **gets the entire Git toolchain for free**: diff, blame, PR, tag, rollback, all of it. This is where native Workflow is a generation ahead of prompts scattered through a conversation.

### Put `.claude/workflows/` under version control

Project-level libraries go straight into the project repo; for user-level ones, it's worth spinning up a separate `dotfiles`-style repo to manage `~/.claude/workflows/`. Either way, the core practice is the same:

```bash
# Routine version management of the library (standard Git, nothing special)
git add .claude/workflows/review/two-stage-review.js
git commit -m "feat(wf): two-stage-review adds spec/quality dual gates"

# Changed a workflow, see what changed
git diff .claude/workflows/loop/acceptance-loop.js

# Want to know why a line is written this way
git blame .claude/workflows/research/deep-research.js
```

<div class="callout tip">

**Workflow scripts are "deterministic + replayable," and that's what makes their diffs unusually meaningful.** Change a word in an ordinary prompt and the effect is anyone's guess; change one `agent()` in a Workflow script and you can know precisely, via resume (25.6), that "only this agent and its downstream re-ran." **Once orchestration is written as code, "a change to the orchestration logic" becomes a reviewable diff for the first time.** Treat workflow changes as code reviews, which is exactly how they deserve to be treated.

</div>

### Embed lightweight version info in `meta` (optional)

`meta` is a pure literal, but it allows arbitrary **literal** fields. If you want to leave a version trace inside the workflow, you can add a **literal** version number (note: it can't be generated with `Date.now()`):

```javascript
export const meta = {
  name: 'two-stage-review',
  description: 'Spec gate then quality gate',
  // A custom literal field: purely static, doesn't break meta's literal constraint
  // (the real version authority is still git tag/log; this is just a runtime-visible trace)
}
```

A more reliable approach is to **let the Git tag be the version authority** and not keep a redundant version number in `meta`, so you avoid a "code version" vs "meta-written version" clash.

### Breaking changes: change the name or change the implementation?

When a workflow needs an argument change that isn't backward-compatible, you've got two strategies:

| Strategy | Approach | Applies when |
|---|---|---|
| **Evolve in place** | Change the implementation, mark the version with a Git tag, old callers upgrade | The library is used only by you/a small team, who can upgrade in sync |
| **New name coexists** | Ship `two-stage-review-v2`, mark the old one deprecated and keep it for a while | The library is depended on by multiple parties who can't be forced to upgrade in sync |

This is the same story as a software library's semantic-versioning governance. For a small library, lean on "evolve in place + Git tag," and don't reach for the complexity of a version suffix too early (that itself is an anti-pattern too, see Chapter 26's "designing for requirements that don't exist").

---

## 25.6 Testing: Use `resumeFromRunId` for Regression

For a library to be dependable, it has to be **testable.** Workflow's testability rests on that measured result from Chapter 22: **an unchanged `agent()` comes back on resume in zero tokens, zero tools, a few milliseconds** (the single-agent `hello-workflow`, Run ID `wf_dacbd480-d5d`, first run 26,338 tokens, resume 0 tokens / 8 ms, identical return value; for the full data and a larger 5-agent confirmation, see [Chapter 22 · Resume & Caching](#/en/p4-22)).

That property, "the same script + the same args → 100% cache hit, sub-second, zero cost," is exactly the engine behind regression testing.

### Three forms of regression testing

**Form one: resume consistency (the cheapest smoke test).** After you change a workflow, resume **some previous Run** of it with `resumeFromRunId`. The `agent()`s you touched and their downstream will re-run, while the untouched ones hit the cache in seconds. This lets you check whether the change broke other stages while **paying only for the part you changed**:

```javascript
// Regression smoke: after changing some agent in acceptance-loop, resume an old Run
// The unchanged stages hit the cache (0 token/8ms), only the change and its downstream really run — precise, cheap
Workflow({
  scriptPath: '.claude/workflows/loop/acceptance-loop.js',
  resumeFromRunId: 'wf_<the runId of this workflow last time>',
  args: { /* exactly the same args as last time, otherwise the cache misses */ },
})
```

<div class="callout warn">

**The precondition for a resume cache hit is "the same script + the same args"** (section B + Chapter 22). So in a regression test the `args` must be **byte-for-byte identical** to the original run. This is exactly the payoff of 25.4's insistence on "ban `Date.now()`, pass time via `args`": if the script sneakily uses `Date.now()`, the args quietly differ each time, the cache never hits, and the regression test degenerates into "a full re-run every time," slow and expensive. **Testability is the reward you get for a purely functional script.**

</div>

**Form two: fixed input + structural assertions (fixture-driven).** Stash representative inputs in `_fixtures/`, run the workflow against them, then assert the **structure** of the return value. Because the output of `agent({ schema })` has already passed schema validation at the tool layer, your assertions only need to check business-level invariants:

```javascript
// (illustrative, not executed) —— fixture-driven structural assertions (run as a "test workflow")
export const meta = {
  name: 'test-two-stage-review',
  description: 'Regression: run two-stage-review on a fixed fixture and assert invariants',
}

// Run the workflow under test with a nested call (nesting only one layer, see Chapter 20)
const out = await workflow(
  { scriptPath: '.claude/workflows/review/two-stage-review.js' },
  { tasks: args.fixtureTasks }     // the fixture is passed in via args
)

// Assert business invariants (the schema already guarantees field existence and types, here check semantics)
const assertions = []
for (const r of out.filter(Boolean)) {
  // Invariant 1: when spec hasn't passed, it should never enter the quality stage
  if (r.specResult && !r.specResult.pass && r.qualityResult !== null) {
    assertions.push(`Violation: ${r.stage}'s spec didn't pass but quality ran`)
  }
  // Invariant 2: accepted if and only if both gates pass
  const bothPass = r.specResult?.pass && r.qualityResult?.pass
  if (Boolean(r.accepted) !== Boolean(bothPass)) {
    assertions.push(`Violation: accepted is inconsistent with the dual-gate result`)
  }
}
log(assertions.length ? `FAIL:\n${assertions.join('\n')}` : 'PASS: all invariants hold')
return { pass: assertions.length === 0, violations: assertions }
```

**Form three: golden-value comparison (golden testing).** For **strongly deterministic** workflows (whose output is stable on its own, e.g., pure computation or formatting), save one "manually confirmed correct" return value as the golden value and compare against it on regression. Note: for workflows that involve natural-language generation, the output naturally wobbles and doesn't suit a byte-for-byte golden value; for those, form two's **structural/invariant** assertions hold up better.

### Test organization suggestion

```text
.claude/workflows/
├── review/two-stage-review.js
├── _fixtures/
│   └── pr-sample.json            # representative input
└── _tests/
    └── test-two-stage-review.js  # test workflow (nested-calls the workflow under test + asserts)
```

Treat "test workflows" as library members too (with a `test-`-prefixed `name`). They use Chapter 20's `workflow()` to nested-call the workflow under test, and **remember nesting is only one layer** (section B), so the test workflow itself must not get nested by a third layer.

---

## 25.7 Sharing: A Script Is a File, So Sharing = Shipping a File

The ultimate payoff of "a script is a file": **sharing a Workflow is sharing a `.js` file.** No packaging, no runtime installer, a sharp contrast to the systems in Chapter 23: ccg needs to install hooks into `settings.json` plus a Go binary, OMC needs to lay out a `.omc/` directory structure, OmO is an npm package. Native Workflow's unit of sharing is as plain as a single text file.

### Three levels of sharing

**Level one: in-repo sharing (team).** Commit `.claude/workflows/` into the project repo. Any colleague who clones the repo can call `{ name: 'two-stage-review' }` right away, zero install. This is the default way a team settles workflows.

**Level two: cross-project sharing (personal).** Manage user-level `~/.claude/workflows/` with a dotfiles repo; clone it once on a new machine and every project shares it.

**Level three: public sharing (community).** Publish a validated workflow to a public repo, and attach:
- The script itself (self-contained, no external dependencies, something Workflow scripts come with naturally, because they have **no filesystem/Node API**, using only standard JS built-ins plus the injected global hooks, see section B hard constraints);
- A "real run record" proving it runs (follow this book's `assets/transcripts/` approach: paste the Run ID, usage, and real output);
- The argument contract.

<div class="callout note">

**The official surface (press `s`) saves into these same two levels.** Levels one and two are exactly the two destinations the official save dialog offers you. The flow: `/workflows` → select that run → press **`s`** to open the save dialog → use **`Tab`** to toggle between the two locations (project-level `.claude/workflows/` (team-shared) ⇄ personal `~/.claude/workflows/`), and press **`Enter`** to save. So "press `s` to save a command" and "file the `.js` into a directory" are saving the same files: one via the dialog, the other by copying the file directly.

**Who wins on a name clash: the project one.** If a project-level workflow and a personal one share the **same name**, the one that runs is the **project-level** one. That cuts the way you'd want: keep general methodologies personal as your baseline, and **override** one in a given project with a same-named project-level workflow when you need to.

</div>

<div class="callout tip">

**Self-containment is what makes sharing nearly frictionless.** Because a Workflow script has **no** `import`, **doesn't touch** the filesystem, and **doesn't depend on** the Node API (section B hard constraint: "no filesystem/Node API," "standard JS built-ins available"), a single `.js` file is complete, portable, and auditable on its own. Get someone else's workflow script and you can read at a glance how many agents it dispatches, what schemas it uses, whether it has an unbounded loop; **all of its behavior sits in that one file.** That makes it ideal material for Chapter 24's "deconstruction" before you file it into your own library.

</div>

### The "finished-product checklist" of a shareable workflow

By this book's standard, a workflow that's ready to share should have:

| Requirement | Description | This book's corresponding approach |
|---|---|---|
| Self-explanatory `meta` | The name/description/whenToUse trio | 25.3 |
| Argument contract | Each `args` field's type and default | 25.4 |
| Argument validation | Fail early and clearly if a required item is missing | 25.4 |
| Boundedness guarantee | Every `while` has an upper bound + budget fallback | Chapter 18 / Chapter 26 |
| Real-run evidence | Run ID + usage + output excerpt | `assets/transcripts/` |
| Regression test | A fixture + invariant-assertion workflow | 25.6 |

```mermaid
flowchart TD
  subgraph LIB["your Workflow library (.claude/workflows/)"]
    M["self-explanatory meta"] --- P["parameterized args + validation"]
    P --- B["bounded loop + budget fallback"]
    B --- T["regression test (fixture + invariants)"]
    T --- E["real-run evidence"]
  end
  LIB -->|"git commit"| TEAM["team (in-repo { name })"]
  LIB -->|"dotfiles"| SELF["personal (~/.claude across projects)"]
  LIB -->|"public repo + transcript"| COMMUNITY["community (self-contained .js)"]
```

---

## 25.8 A Minimal Usable Library Scaffold

Let's pull all of this chapter's practices into a starting scaffold you can **copy straight over.** When you spin up a new project, lay this structure into `.claude/workflows/`:

```text
.claude/workflows/
├── README.md          # see template below
├── _fixtures/         # test inputs
├── _tests/            # test-* test workflows
├── _lib/              # drafts in iteration (debugged with { scriptPath })
├── review/            # review-category finished products
├── research/          # research-category finished products
└── loop/              # loop-category finished products
```

`README.md` template (the library index, in the same spirit as `manifest.json`):

```markdown
# Workflow Library Index

> Call: `Workflow({ name: '<name>', args: {...} })`
> Drafts in iteration are in `_lib/`, debugged with `{ scriptPath }`.

## review/ review category
- **two-stage-review** — spec-compliance gate → code-quality gate (each bounded-retry).
  args: `{ tasks: [{ id, spec, diff }] }`
- **multidim-review** — review a target from N dimensions concurrently then synthesize.
  args: `{ target: string, dimensions?: string[] }`

## loop/ loop category
- **acceptance-loop** — repeatedly advance until independent acceptance fully passes (bounded + budget fallback).
  args: `{ stories: [{ id, requirement }], initialDraft?: string }`

## research/ research category
- **deep-research** — fan-out retrieval → extraction → synthesis.
  args: `{ question: string }`

---
Conventions: name = filename; every while has an upper bound; args use a documented contract; changes go through git diff review.
```

Start from this scaffold and your library has, from day one, clear grouping, a self-explanatory index, a parameterized contract, a test slot, and a draft isolation zone. It grows organically with each new pattern you extract (Chapter 24), instead of piling up into loose parts named `wf1.js`, `test2.js`.

---

## 25.9 Chapter Summary

- **Two roads to a library**. Road one · the official surface: press `s` on a run you like to save it as a `/` command, into autocomplete, alongside `/deep-research` (zero files, zero config; where most people start). Road two · on-disk scripts: file validated scripts into `.claude/workflows/` and reuse with `{ name }` (power-user; versioning, parameters, tests, sharing all live here). Beginners transition from road one to road two.
- **The library's foundation is "a script is a file"**: explore with `{ script }`, land and iterate with `{ scriptPath }` (highest priority), reuse with `{ name }` after settling. `name` is for the people who use it, `scriptPath` is for the people who write it.
- **Directory structure**: under `.claude/workflows/` group by "recipe type" (review/loop/research), put drafts and fixtures under `_`-prefixed directories, one file per workflow with `filename = meta.name`, and `README.md` as the index. Project-level travels with the repo, user-level across projects.
- **Naming conventions**: `name` uses `action-object` kebab-case with no stale words; `description` states "what it does, how big" in one line (shown in the permission dialog); `whenToUse` helps you pick. `meta` must be a pure literal, and the description can't interpolate.
- **Parameterization**: use `args` to turn a hard-coded script into a tool, giving defaults, writing the doc contract, and putting argument validation up front. To get around "the ban on `Date.now()`," `args` is the only legitimate way.
- **Version management**: a script is a file, so use Git directly (diff/blame/tag/PR). Once orchestration is code, "an orchestration change" becomes a reviewable diff for the first time. For breaking changes prefer "evolve in place plus tag"; only reach for a version suffix once multiple parties depend on it.
- **Testing**: use `resumeFromRunId` resume (real evidence: an unchanged agent hits 0 token / 8ms) for precise regression, on the precondition that `args` are byte-for-byte identical; a fixture plus invariant assertions (the schema already guarantees structure, the assertions only check business invariants); the test workflow uses `workflow()` to nested-call the workflow under test (only one layer).
- **Sharing = shipping a self-contained `.js` file** (no import, no filesystem, no Node API): in-repo sharing (team, zero install), dotfiles (personal across projects), a public repo plus transcript (community).

The next chapter is this book's "complete guide to avoiding pitfalls": it flips all the preceding hard constraints around and walks through real anti-patterns, each one as "wrong way → consequence → right way."

> Continue reading: [Chapter 26 · Anti-patterns and Pitfalls](#/en/p5-26)
