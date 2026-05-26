# Chapter 19 · Worktree Isolation

> In one sentence: **when multiple agents must modify the same code at once, give each its own independent git worktree — `opts.isolation: 'worktree'` — so they don't trample each other in physically isolated workspaces.**
>
> This is one of the few chapters in Advanced Patterns that touches "side effects" head-on. The earlier agents mostly "read and think" (review, research, judge); the moment agents start **writing files in parallel**, races show up. Worktree isolation is Workflow's answer.

---

## 19.1 The Problem: The Race of Writing Files in Parallel

First, recall a fact: per `_grounding.md`, `parallel()` and `pipeline()` can make multiple agents genuinely run at once (real confirmation: 3 agents concurrent in about 8.4 seconds, `wf_52957913-6d2`). As long as these agents just "read code and produce structured findings," concurrency is no problem at all — they don't get in each other's way, each just returns data.

But picture a different task: **have 5 agents each refactor a module in parallel.** Each agent has to edit files with Write/Edit. Now the problem shows up:

- Agent A is editing line 10 of `utils.js` while agent B edits line 50 of `utils.js` at the same time — they see the same version of the same file, each edits its own copy, and **the later write overwrites the earlier**, or you end up with a mixed state nobody expected.
- Even if they edit different files, git's staging area and index are **shared** — concurrent git operations step on each other.
- A half-finished mess left by an agent that died midway pollutes the workspace the other agents see.

This is the **race** of parallel writing: multiple execution bodies share the same mutable state (workspace files + git index), and without isolation they wreck each other.

Before Workflow, community systems found their own ways around this pothole. Per `_grounding.md` section D, ccg-workflow goes with "file ownership + Layer-based parallelism" — i.e., **by convention** each agent touches only the files of its own layer, dodging conflicts through discipline. This works, but it's fragile: the moment the convention breaks, the race is back.

Worktree isolation gives you **physical** isolation, not **conventional** isolation.

---

## 19.2 What git worktree Is: One Tree, Multiple Workspaces

To get `isolation: 'worktree'`, you first have to get the mechanism underneath it, git worktree.

When you use git normally, one repository maps to one working directory (working tree) — whichever branch you check out, the working directory holds that branch's content. `git worktree` lets **the same repository** have **multiple** working directories at once, each mounted at a different path and able to check out a different branch or commit:

```bash
# The native usage of git worktree (for background only)
git worktree add ../feature-x feature-x   # mount an independent workspace at ../feature-x
```

The key: these workspaces **share the same `.git` repository underneath** (objects, commit history), but **each has its own independent working-directory files and index.** So you can edit and commit away in `../feature-x` without touching the main working directory at all.

Apply this mechanism to Workflow: when an `agent()` carries `isolation: 'worktree'`, the runtime **opens a separate git worktree** for it, and all of that agent's file changes land in that isolated workspace. Multiple such agents running in parallel are multiple isolated workspaces in parallel — **physically impossible to overwrite each other.**

```mermaid
flowchart TD
    R["shared .git repository<br/>(objects / history)"]
    R --- W0["main workspace<br/>(where the main loop is)"]
    R --- W1["worktree A<br/>agent A edits files exclusively"]
    R --- W2["worktree B<br/>agent B edits files exclusively"]
    R --- W3["worktree C<br/>agent C edits files exclusively"]
    W1 -.->|"auto-cleaned if no changes"| X1["cleanup"]
```

<div class="callout info">

**Official semantics (per `_grounding.md` section B, agent opts)**: `opts.isolation: 'worktree'` makes the agent "run in an independent git worktree," and spells out two properties — **expensive** (use only when parallel file edits would collide), and **auto-cleaned if no changes** (if the agent ends up making no file changes, the corresponding worktree is automatically reclaimed). The finer runtime mechanics in this chapter — "how to merge worktree changes," "the worktree path" — aren't given by the sources, so they're marked "(to be verified)," not guessed at.

</div>

<div class="callout warn">

**The value check on `isolation` only special-cases two values in testing — don't assume "only `'worktree'` is accepted, everything else errors."** This book ran a dedicated probe to see how `isolation` actually treats different values (Run `wf_dace2fc6-966`, 3 agents / 52,014 tokens / 5,253 ms):

- `isolation: 'remote'` → **throws**, verbatim `agent({isolation:'remote'}) is not available in this build` — confirming the value `'remote'` exists but is disabled in the current build.
- `isolation: 'totally-bogus'` (a value that doesn't exist at all) → **does not throw**; the agent runs to completion and returns `"OK"`.

In other words, the runtime special-cases only two values: `'worktree'` (do isolation) and `'remote'` (reject); **any other unknown value is silently ignored** (treated as "no isolation"), not errored. Some third-party material claims "`isolation` only accepts `'worktree'`, everything else errors" — this book's testing finds that **untrue**, and sets it straight here. Practical implication: a misspelled `isolation` (e.g., `'worktre'`) gets **no** warning whatsoever; the agent quietly runs in the shared workspace — so spell this field right yourself, the runtime won't cover for you.

</div>

---

## 19.3 When to Use It, When Not To

`isolation: 'worktree'` is officially marked **expensive**, so it isn't a default option but **a specific tool for a specific problem.** There's just one test:

> **Will multiple agents concurrently modify the same working tree?** Yes → use worktree isolation; No → don't.

Spread it out into a decision table:

| Scenario | Agent behavior | Need worktree? | Reason |
|---|---|---|---|
| Parallel code review | Read-only, produce structured findings | **No** | No writes, no race |
| Parallel research / multi-dimension analysis | Read-only, return data | **No** | No writes, no race |
| Adversarial verification / judge panel | Read-only + judgment | **No** | No writes, no race |
| Multiple agents refactoring different modules in parallel | Each Write/Edit | **Yes** | Concurrent writes, must isolate |
| Multiple agents each trying a different solution to the same problem | Each edits the same set of files | **Yes** | Edit the same tree, must collide |
| A serial single agent editing files | One write at a time | **No** | No concurrency, no race |

<div class="callout warn">

**The vast majority of Workflows don't need worktree isolation.** All the earlier real runs in this book (hello / parallel / pipeline) have agents that "read + produce structured data," and **not one** needs isolation. That's because Workflow's most common, most cost-effective usage is "fan out a crowd of agents to read and think in parallel, then pull the structured results back together" — these tasks are side-effect-free by nature. Only when you genuinely need multiple agents to **edit files concurrently** do you pay the worktree cost. Treat it as "the heavy weapon you reach for last," not "fire it up the moment you go parallel."

</div>

---

## 19.4 The Typical Pattern: Parallel Refactor + Isolation

Look at worktree isolation's most typical use: have a group of agents each refactor a module in an isolated workspace, without stepping on each other.

```javascript
// (illustrative, not run) — parallel refactor, one isolated worktree per agent
export const meta = {
  name: 'parallel-refactor',
  description: 'Multiple modules refactored in parallel, each agent editing files in an independent git worktree without conflict',
  phases: [{ title: 'Refactor', detail: 'parallel refactor within isolated workspaces' }],
}

phase('Refactor')
const modules = args.modules   // e.g. ['src/auth', 'src/billing', 'src/notify']

const results = await parallel(
  modules.map((mod) => () =>
    agent(
      `Refactor module ${mod}: eliminate duplication, improve naming, complete error handling. Modify files directly with the Edit tool.\n` +
      `When done, return the list of files you changed and a one-sentence summary.`,
      {
        label: `refactor:${mod}`,
        isolation: 'worktree',   // ← key: an independent workspace per agent
        schema: {
          type: 'object',
          properties: {
            changedFiles: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' },
          },
          required: ['changedFiles', 'summary'],
        },
      }
    )
  )
)

return results.filter(Boolean)
```

A few things worth noting:

**`isolation: 'worktree'` goes on each agent that writes files.** It's an option of `agent()`, sitting alongside `schema`, `label`, `phase`, and so on (per `_grounding.md`, "combinable with schema"). So you get to both isolate and collect a structured "which files were changed" receipt.

**What comes back is a lightweight receipt like a "change summary," not the file content itself.** This echoes control plane / data plane separation (Chapters 07, 17) — the orchestration script needs to know "who changed what" so it can merge/review afterward, while the file bodies stay put in their respective worktrees. Exactly how worktree changes flow back to the main branch isn't specified by the sources; it's "(to be verified)," and in practice you should confirm it by watching the runtime behavior via `/workflows`.

**`parallel`, not `pipeline`.** Because what you want here is "all refactors done, all receipts in hand before the next step (e.g., unified review/merge)" — exactly where `parallel`'s barrier semantics shine.

```mermaid
flowchart LR
    M["modules[]"] --> P["parallel (barrier)"]
    P --> A1["agent: refactor auth<br/>worktree A"]
    P --> A2["agent: refactor billing<br/>worktree B"]
    P --> A3["agent: refactor notify<br/>worktree C"]
    A1 --> B["barrier: wait for all"]
    A2 --> B
    A3 --> B
    B --> N["consolidate receipts → subsequent merge/review"]
```

---

## 19.5 The Cost and Trade-off of Isolation

The official docs keep stressing that worktree is "expensive"; pin down where it's expensive and you can make the right trade-off.

Worktree's overhead comes mainly from **creating an independent workspace for each isolated agent** — that means file-system-level work (checking out the working-tree files, and so on), much heavier than "sharing one working directory." The more agents and the bigger the repository, the more the overhead stands out. It's a cost in a **different dimension** from token cost: token measures model reasoning, worktree measures file-system isolation.

The core of the trade-off:

| Dimension | No isolation (shared workspace) | Worktree isolation |
|---|---|---|
| Concurrent file writes | Race, overwrite each other | Safe, physically isolated |
| Overhead | Low | **High** (one workspace per agent) |
| Suits | Read-only / serial writes | **Concurrent writes to the same tree** |
| When no changes | —— | Auto-cleaned, leaves no garbage |

<div class="callout tip">

**"Auto-cleaned if no changes" is a thoughtful safety valve.** Per `_grounding.md`, if an agent with `isolation: 'worktree'` ends up making no file changes, its worktree is automatically reclaimed. So you don't have to worry that "I turned on isolation but the agent didn't actually change anything" leaves a pile of empty workspaces behind — the runtime has your back. But it doesn't change one fact: the cost of "creating the workspace" has already been spent. So **don't add `isolation` to read-only agents**: they won't collide anyway, and adding it just pays the isolation cost for nothing (even if it gets cleaned up in the end).

</div>

<div class="callout warn">

**Worktree isolation requires the project to be a git repository.** Worktree is a git mechanism, so this option carries the hidden premise that the current working directory is a git repository. This book's writing environment is itself a git repository (see the repo field in `manifest.json`). What `isolation: 'worktree'` does in a non-git project isn't covered by the sources; it's "(to be verified)."

</div>

---

## 19.6 Its Relationship to Other Parallel Strategies

Worktree isolation doesn't stand alone; it forms a spectrum with the concurrency primitives you learned earlier and the community's "file ownership" idea. Lining them up side by side helps you pick the right tool:

| Strategy | Isolation method | Strength | Source |
|---|---|---|---|
| File-ownership convention (one writer/file) | Disciplined convention | Weak (relies on diligence) | ccg-workflow (`_grounding.md` section D) |
| Layer-based parallelism | Divide files by layer, serial between layers | Medium | ccg-workflow |
| `isolation: 'worktree'` | git worktree physical isolation | **Strong (physical)** | Native Workflow |

The three aren't mutually exclusive but **step up in strength**:

- If you can guarantee each parallel agent edits a **completely disjoint** set of files, the "file-ownership convention" is enough, with zero extra overhead.
- If files overlap, or you can't draw the boundaries in advance, reach for `isolation: 'worktree'` and let git guarantee it physically.

<div class="callout info">

**An often-overlooked call**: many tasks that look like they "need parallel file edits" can actually be **reshaped into "parallel read + serial write"** — have multiple agents **produce patches / change suggestions** in parallel (read-only, returning structured diff descriptions), then let the main loop or a serial closing agent **apply** those changes one by one. This gets you the parallel speed while sidestepping the concurrent-write race entirely, and doesn't even need a worktree. So before you reach for a worktree, ask yourself: **can this task be split into "think in parallel, write serially"?** If it can, that's often simpler and cheaper than a worktree.

</div>

---

## 19.7 Chapter Summary

- Writing files in parallel kicks off a race: multiple agents share the same working tree and git index, and overwrite each other. `isolation: 'worktree'` gives each agent an independent git worktree, providing **physical isolation.**
- git worktree = the same repository, multiple independent working directories, sharing the `.git` underneath but each with its own workspace files — this is the mechanism isolation is built on.
- **When to use**: only when multiple agents will **modify the same working tree concurrently.** Read-only tasks (review, research, verification, judging) **never need it** — they're Workflow's most common and most cost-effective usage.
- The official docs make it clear: worktree is **expensive** (the file-system overhead of one workspace per agent, orthogonal to token cost) and **auto-cleaned if no changes.** Don't add `isolation` to read-only agents.
- The isolation-strength spectrum: file-ownership convention (weak) < Layer-based (medium) < worktree (strong/physical). When the task can be split into "think in parallel, write serially," that's often simpler than a worktree.
- Details the sources don't cover (how worktree changes flow back to the main branch, behavior in non-git projects) are marked "(to be verified)"; in practice, confirm by watching the runtime behavior via `/workflows`.

In the next chapter we switch to another composition dimension: when a workflow itself wants to reuse another workflow — `workflow()` inline calls and the "nesting one level only" constraint.

> Continue reading: [Chapter 20 · Nested Workflows](#/en/p4-20)
