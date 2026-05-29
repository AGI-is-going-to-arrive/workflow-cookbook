# Chapter 15 · Bug Hunter

> Getting an agent to "find bugs" isn't hard; what's hard is **trusting** the bugs it finds. LLMs are very good at making up "looks-like-a-bug" false positives. This chapter's Bug Hunter recipe solves that trust problem with **adversarial verification**: hunt first, then send in an independent "devil's advocate" agent to **refute by default** — only what survives refutation counts.
>
> This chapter is based on a real run (Run `wf_53da9a06-915`, 11 agents / 311,134 tokens / 61,660ms, 5/5 confirmed); it also demonstrates the most striking facet of adversarial verification: **the verifier corrected the hunter in turn.** On top of that, we build a **production-grade bug-hunter workflow** from scratch — **finder pool → adversarial refutation → synthesis** — and how it uses **pigeonhole early-exit** and a **K-consecutive-round dry-streak** to be both cheap and miss-proof.
>
> <div class="callout warn">
>
> **One version note about "the built-in bughunt" (read this first).** Early v2.1.150's built-in registry did carry two named workflows, `bughunt` / `bughunt-lite` (Run `wf_2b04881f-6a9` listed them), and earlier editions of this book were premised on "just call the built-in `bughunt`." But **as of v2.1.156, the built-in named-workflow registry holds only `deep-research`** (Run `wf_03e38250-1bb`, verbatim `Available: deep-research`), exactly matching the official docs' "Claude Code includes `/deep-research` as a built-in workflow" (the only bundled one). `bughunt` / `bughunt-lite` are **no longer in the registry and can no longer be relied on** (see [Appendix A.13.1](#/en/app-a)). So this chapter no longer teaches you to "call the built-in"; it walks you through **writing your own bug-hunter workflow** — which lands squarely on the book's "build your own workflow" through-line. Wherever `bughunt` / `bughunt-lite` come up below, read them as a **design reference to the early built-ins** (their old orchestration skeleton is still worth borrowing), not as a command you can invoke today.
>
> </div>

---

## 15.1 Recipe Motivation: a "Unknown-Scale + Untrustworthy" Double Problem

"Finding bugs" is a classic **unknown-scale discovery task** — you don't know up front how many bugs there are, so you can't write it as a fixed-quota loop like "find these 5." Worse, it lands you in the two nastiest traps of discovery tasks at once:

1. **False positives**: the model loves to "report something." You say "find bugs," and even when it finds zero real ones, it makes up a few plausible-looking "bugs" to hand in — because to it, turning in a blank feels like not finishing the job.
2. **Wrong argumentation**: even when the bug is real, the "why it's wrong" the model gives may be wrong. It can nail the symptom but botch the mechanism.

Stack the two traps together and you get this: **looking at a single hunter agent's output tells you neither whether it found them all nor whether it got them right.** This chapter's recipe presses both uncertainties down with a three-stage orchestration:

```mermaid
flowchart LR
  H["① Hunt<br/>finder pool surfaces suspected bugs"] --> V["② Verify<br/>each bug gets N independent skeptics refuting by default"]
  V --> S["③ Synthesize<br/>tally, dedup, prioritize"]
  S --> O["a trustworthy confirmed list"]
```

- **① Hunt** — handles "find them all": use one finder agent, or a finder **pool**, to list suspected bugs. When the scale is unknown, let the pool self-respawn and loop until dry (15.5, 15.7).
- **② Verify** — handles "get them right": for **each** suspected bug, dispatch N **independent** verifiers, and explicitly tell them to "refute by default." That puts the burden of proof on the "this is a real bug" side. This is a direct application of Chapter 17's adversarial verification.
- **③ Synthesize** — closes out: use **code** to tally, dedup, and prioritize, producing the final confirmed list.

<div class="callout info">

**Why "refute" rather than "confirm"?** Because confirmation bias only points one way: ask an agent "is this a bug?" and it tends to nod. Order it to "try your best to **refute** this; judge refuted if you're not sure," and it has to go hunt for counterexamples. Setting the default to refuted flips the burden of proof: instead of "prove it's not a bug" (which tires out the defense), it becomes "prove it is a bug" (which tires out the offense). So **the model's silence and hesitation both fall to "doesn't count,"** and false positives get filtered out on their own. This principle runs through Chapter 17; this chapter is where it lands on "hunting bugs."

</div>

---

## 15.2 The Full Script

Below is the script used in this chapter's real run — the minimal trustworthy shape of one finder (Hunt) + two refuters per bug (Verify):

```javascript
export const meta = {
  name: 'bug-hunter',
  description: 'Hunt bugs in a target file, then adversarially verify each finding',
  phases: [{ title: 'Hunt' }, { title: 'Verify' }],
}
const FILE = '.../assets/samples/buggy-cart.js'

phase('Hunt')
const hunt = await agent(
  `Read the file ${FILE} and find genuine bugs. For each: function name, one-line bug, why it's wrong.`,
  { label: 'hunt', schema: { type: 'object', properties: {
    bugs: { type: 'array', items: { type: 'object',
      properties: { fn: { type: 'string' }, bug: { type: 'string' }, why: { type: 'string' } },
      required: ['fn','bug','why'] } } }, required: ['bugs'] } }
)

const verified = await pipeline(
  hunt.bugs,
  (b) => parallel([1,2].map(i => () =>
    agent(`You are a skeptic. Try to REFUTE this claimed bug in ${FILE}. Default to refuted=true if not certain. ` +
          `Claim — in \`${b.fn}\`: ${b.bug} (${b.why}). Read the file to check.`,
      { label: `refute:${b.fn}:${i}`, phase: 'Verify',
        schema: { type: 'object', properties: { refuted: { type: 'boolean' }, reason: { type: 'string' } }, required: ['refuted','reason'] } })
  )).then(votes => {
    const v = votes.filter(Boolean)
    const confirms = v.filter(x => !x.refuted).length
    return { ...b, confirmVotes: confirms, refuteVotes: v.length - confirms, confirmed: confirms >= 1 }
  })
)
const confirmed = verified.filter(Boolean).filter(b => b.confirmed)
return { hunted: hunt.bugs.length, confirmedCount: confirmed.length, confirmed }
```

Note the structure here: **Hunt is a single agent** (it produces the suspected list), and **Verify uses `pipeline`** — each bug flows independently through the stage of "2 refuters concurrent + tally." This is the typical pattern of `parallel` nested inside `pipeline` (Chapter 08). Pipeline stages have no barrier, so while bug A is still being refuted, bug B may already be in synthesis; meanwhile, inside each bug, the two refuters use the `parallel` barrier to finish together so they can be tallied.

<div class="callout tip">

**This minimal shape is enough to build intuition, but it deliberately omits three "production-grade" things**, which the rest of this chapter adds one by one: ① Hunt has only one finder (it will miss bugs once the scale grows) → the finder pool in 15.5; ② each bug runs all refuters before tallying (no early stop even when a majority has already vetoed) → pigeonhole in 15.6; ③ a single round of Hunt (missed tail bugs can never be recovered) → loop-until-dry in 15.7. Master the minimal shape first, then add these three layers.

</div>

---

## 15.3 Real Run Results

> **Real run**: Run ID `wf_53da9a06-915`, Task ID `wsj4ypt3x`. See `assets/transcripts/bug-hunter.md` for the raw record.
> Real usage: `agent_count=11` (1 hunter + 5×2 refuters) ｜ `tool_uses=25` ｜ `total_tokens=311134` ｜ `duration_ms=61660`.

The target file is `assets/samples/buggy-cart.js` (a synthetic sample with 5 deliberately planted bugs). The hunter **found all of them, all passing verification 2:0**:

| Function | bug | Votes |
|---|---|---|
| `applyDiscount` | percent has no bounds check (>100 gives a negative price; a negative percent inflates the price) | 2:0 |
| `cartTotal` | off-by-one: `i < items.length-1` skips the last item | 2:0 |
| `checkout` | missing `await`, `gateway.charge()` returns a Promise that is always truthy, the cart is cleared before payment | 2:0 |
| `findItem` | `==` instead of `===`, type coercion mismatch | 2:0 |
| `mergeCarts` | mutates the argument in place via `a.push()` (aliasing bug) | 2:0 |

How the 11-agent count adds up: `1 finder + 5 bugs × 2 refuters = 11`. ~310K tokens, ~62 seconds wall clock. Note the wall clock is far less than running all 11 agents back to back, because the refutation of the 5 bugs **overlaps** in the pipeline — wall clock depends on the critical path, not the sum of every agent's time (Chapter 08).

<div class="callout info">

**Why use a synthetic sample as the "hunting target"?** Because to check "how accurate the hunter actually is," you first need a **known answer key**. Every bug in `buggy-cart.js` carries a seed comment, so "found 5/5" is a hard metric you can verify line by line, not a vague feeling of "looks like it found quite a few." Real projects have no such annotations — which is exactly why ② Verify exists: to **approximate** ground truth via adversarial refutation.

</div>

---

## 15.4 The Striking Part: the Verifier Corrected the Hunter

The refuter for `applyDiscount`, while **confirming the bug is real**, corrected a piece of wrong argumentation from the hunter (and the seed comment). The seed comment and the hunter both claimed "percent as a string would concatenate," and the refuter pointed out:

> "the source comment's 'percent as string concatenates' claim is false — `*` and `/` coerce strings to numbers, so `applyDiscount(100,'10')` correctly returns 90; concatenation would require `+`."

It's right: `*`/`/` coerce strings into numbers; only `+` concatenates. So `applyDiscount(100,'10')` actually returns `90` (correct), and the bug's true mechanism is "no bounds check" (`percent>100` gives a negative price), not "string concatenation."

<div class="callout tip">

**This is where adversarial verification earns its keep**: it doesn't just filter false positives, it can also **fix the faulty reasoning inside a true positive.** A "checker" that only echoes would never catch this; only a verifier told to "refute by default, judge refuted if uncertain" bothers to get pedantic — not even letting a flaw buried in the premise slip by. In other words, the refuter hands back not just a "true/false" ballot but **an auditable line of reasoning**, and that reasoning itself can correct upstream. This is also why `reason` is a required field in the refutation schema in 15.2.

</div>

---

## 15.5 The Finder Pool: Fixed vs Self-Respawning

The minimal shape in 15.2 has only **one** finder. That's fine for a small target, but the moment it grows from a 40-line synthetic file to dozens of files across an entire branch, a single finder can't keep up — its attention gets spread thin and it's bound to miss things. That's when you reach for a **finder pool**: multiple hunters scanning concurrently, **streaming** their findings into the same refutation pipeline.

Early v2.1.150's built-in registry held two named workflows of the same lineage as the bug hunter, `bughunt` and `bughunt-lite` (Run `wf_2b04881f-6a9` real run: calling an unknown named workflow throws and lists the then-current set `bughunt, bughunt-lite, deep-research, plan-hunter, review-branch`). **Note: as of v2.1.156 these two are no longer in the registry** (only `deep-research` remains; see the version note at the top of this chapter and [Appendix A.13.1](#/en/app-a)), so what follows isn't teaching you to call them — it takes their old orchestration skeleton as a **blueprint** and **writes the same structure yourself**. The table below dissects that skeleton into the two pool shapes "fixed" and "self-respawning":

| Workflow | Finder pool | Verification | Close-out |
|---|---|---|---|
| `bughunt-lite` | **Fixed**: 3 rapid + 2 deep, stop when done | 5-vote adversarial refutation (pigeonhole early-exit) | synthesis |
| `bughunt` | **Self-respawning**: 3 rapid + deep hunters keep getting dispatched until **dry-streak** | 5-vote adversarial refutation (pigeonhole early-exit) | synthesis |

<div class="callout warn">

**This "pool structure" layer was never an official/verified truth — read it as conjecture, and all the more so after the version drift.** The "3 rapid / 2 deep / 5 votes / pigeonhole / dry-streak" wording above comes from the **one-line registered blurb** `bughunt` / `bughunt-lite` carried back in v2.1.150's skills listing (`bughunt`: "Self-respawning finder pool (3 rapid + deep-until-dry-streak) streams into 5-vote adversarial verification with pigeonhole early-exit, then synthesis"; `bughunt-lite`: "fixed 3-rapid+2-deep finders stream into 5-vote adversarial verification (pigeonhole early-exit), then synthesis. Simpler than bughunt: no self-respawning, no dry-streak"). Per this book's grounding tiers (`_grounding.md` A2), for these two workflows **the only thing a real run verified is that they once existed in the registry** (v2.1.150, Run `wf_2b04881f-6a9`); their **internal architecture never had an official tool definition and was never reproduced by a real run here**, and **as of v2.1.156 even the "they exist" layer is gone** (only `deep-research` is in the registry, Run `wf_03e38250-1bb`). So the pool breakdown and the skeleton code below — derived from that blurb plus common patterns — are **purely this book's conjectural, illustrative implementation, never the official architecture**: use them to build intuition and as a blueprint for your own workflow, but don't treat the numbers and flow as verified facts, and don't expect to invoke `bughunt` today.

</div>

The two pools differ on exactly one axis: **whether the finder count is fixed.**

- **Fixed pool**: dispatch `N` hunters, collect `N` sets of findings — orchestration is predictable and cost has an upper bound. Good when you "roughly know the target scale" or "want a deterministic budget." `bughunt-lite`'s "3 rapid + 2 deep" is a fixed 5 finders.
- **Self-respawning pool**: the finder pool keeps **topping up with new hunters** until a stopping condition is met (dry-streak, see 15.7). Good when the "target scale is completely unknown and you'd rather overspend than miss." The cost: the upper bound is uncertain — so it needs a dry-streak + budget double brake (Chapter 18).

The "rapid + deep" split that shows up in both pools is another, orthogonal design — one fast, one slow:

- **rapid finder**: fast, shallow, wide net — scoops up the "obvious at a glance" suspects first (can use `model:'haiku'` to cut cost).
- **deep finder**: slow, deep, detail-oriented — digs out the subtle bugs the rapid pass missed, the ones that need cross-function reasoning.

The phrase "the pool streams into the pipeline" (finders **stream into** verification) is the key part: finders don't all have to finish before refutation begins. This is exactly where the **no-barrier** nature of `pipeline` stages pays off (Chapter 08) — the moment one finder hands back a finding, the refutation pipeline can start on it while the other finders are still running.

Below is a skeleton of a **fixed pool + stream-dedup + flow-into-refutation** (echoing `bughunt-lite`):

```javascript
// (illustrative, not executed) — fixed finder pool: rapid wide net + deep dig, dedup the stream, then flow into refutation
const BUG = { type: 'object', properties: {
  bugs: { type: 'array', items: { type: 'object',
    properties: { fn: { type: 'string' }, bug: { type: 'string' }, why: { type: 'string' } },
    required: ['fn','bug','why'] } } }, required: ['bugs'] }

phase('Hunt')
// 3 rapid (shallow, haiku to cut cost) + 2 deep (deep, default model), concurrent wide net
const finders = await parallel([
  ...[0,1,2].map(i => () => agent(
    `RAPID pass #${i}: skim ${FILE} and surface obvious-looking bugs fast. ` +
    `Cover a different region than other passes (use index ${i} to vary focus).`,
    { label: `find:rapid:${i}`, phase: 'Hunt', model: 'haiku', schema: BUG })),
  ...[0,1].map(i => () => agent(
    `DEEP pass #${i}: read ${FILE} carefully, reason across functions, find subtle bugs ` +
    `(aliasing, async, coercion) that a quick skim would miss.`,
    { label: `find:deep:${i}`, phase: 'Hunt', schema: BUG })),
])

// Stream: flatten findings from every finder in the pool, dedup by normalized (fn+bug) key (deterministic, code's job)
const pooled = finders.filter(Boolean).flatMap(f => f.bugs || [])
const seen = new Set()
const candidates = pooled.filter(b => {
  const key = (b.fn + '|' + b.bug).toLowerCase().replace(/\s+/g, ' ').trim()
  return seen.has(key) ? false : (seen.add(key), true)
})
log(`finder pool merged ${pooled.length} findings, ${candidates.length} after dedup go to refutation`)
// candidates then flow into the refutation pipeline of 15.6
```

<div class="callout warn">

**A finder pool must always go through "stream-dedup" before refutation, and dedup must use code, not an agent.** Multiple finders (especially rapid vs deep) are bound to report duplicate bugs; without deduping first, the same bug gets refuted by N sets of refuters, wasting tokens several times over. Dedup is a **deterministic operation** (same input, same output), done at zero cost with a `Set` + a normalized key — consistent with Chapter 18's "hand deterministic operations to code, leave judgment to agents." Asking an agent to "dedup for me" is both expensive and introduces non-determinism.

</div>

---

## 15.6 Pigeonhole Early-Exit: Once a Majority Has Vetoed, Stop Voting

The refutation in 15.2 is "run all N refuters for each bug, then tally." When N is large (`bughunt` uses **5 votes**), there's an obvious waste: **once a bug has been vetoed by a majority of refuters, the remaining votes can't flip the outcome** — the conclusion is already locked.

This is **pigeonhole early-exit**: treat "majority" as a threshold you can hit early, and the moment one side's vote count locks in the win, decide **logically** ahead of time instead of waiting on the rest. But keep one thing in mind — **the agents already dispatched usually still finish, their results just ignored** (for the mechanism, see the callout below in this section, `_grounding.md`, and Chapter 18); to **physically** dispatch fewer agents, you have to **vote in batches**: send the majority-line votes first, and only add the rest when it's a tie or close.

Take 5 votes with "keep only if a majority confirms" (≥3 confirm) as an example. The pigeonhole principle gives two early-exit points:

- **Early veto**: once **3 refute votes** accumulate, no matter how the remaining 2 vote, confirm can't reach ≥3 → this bug is doomed to be vetoed → stop the remaining refuters.
- **Early confirm**: once **3 confirm votes** accumulate, the majority is reached → this bug is destined to be kept → stop the remaining refuters.

```mermaid
flowchart TB
  A["start 5 refuters on one bug"] --> B{"tally vote by vote"}
  B -->|"refute votes == 3"| R["doomed to veto<br/>stop remaining 2 votes"]
  B -->|"confirm votes == 3"| C["destined to confirm<br/>stop remaining 2 votes"]
  B -->|"both sides < 3"| B
  R --> D["close out: refuted"]
  C --> E["close out: confirmed"]
```

How much does early exit save? Under "5-vote majority," the soonest it can settle is at the 3rd vote, saving 2 refuters — **nearly 40% of verification cost** — and the more "one-sided" the bug (a real bug all-confirm, a false positive all-refute), the more it saves.

There's a catch in the implementation: `parallel` is a **barrier** (it waits for all thunks) and has no built-in way to "stop midway." To get pigeonhole early-exit, you need a structure that can "settle early" — a race. Below is an **illustrative** skeleton built from a `Promise` race plus a tally closure; note it already goes beyond `parallel`'s standard usage and is here only to show the idea:

```javascript
// (illustrative, not executed) — the idea skeleton of pigeonhole early-exit
// Note: parallel is a barrier and doesn't support stopping midway; this uses a Promise race to demonstrate the "settle once a majority locks in" logic.
async function verifyWithPigeonhole(bug, voters = 5) {
  const majority = Math.floor(voters / 2) + 1   // 5 votes → 3
  let confirms = 0, refutes = 0, done = 0, settled = false
  let resolve
  const decided = new Promise(r => { resolve = r })

  for (let i = 0; i < voters; i++) {
    agent(
      `You are skeptic #${i}. Try to REFUTE this claimed bug in \`${bug.fn}\`: ${bug.bug}. ` +
      `Default refuted=true if not certain. Read the file to check.`,
      { label: `refute:${bug.fn}:${i}`, phase: 'Verify',
        schema: { type: 'object', properties: { refuted: { type: 'boolean' }, reason: { type: 'string' } }, required: ['refuted','reason'] } }
    ).then(v => {
      if (settled) return
      done++                       // count votes that have RETURNED (including a skipped null)
      if (v) (v.refuted ? refutes++ : confirms++)   // a skipped/failed null vote counts toward neither side
      // Pigeonhole: either side hits the majority, the outcome is decided, settle immediately
      if (confirms >= majority) { settled = true; resolve({ ...bug, confirmed: true,  confirmVotes: confirms, refuteVotes: refutes }) }
      else if (refutes >= majority) { settled = true; resolve({ ...bug, confirmed: false, confirmVotes: confirms, refuteVotes: refutes }) }
      // Fallback: all voters have returned but still no majority (too many skipped nulls) → settle as uncertain so the promise never hangs
      else if (done >= voters) { settled = true; resolve({ ...bug, confirmed: false, uncertain: true, confirmVotes: confirms, refuteVotes: refutes }) }
    })
  }
  return decided   // returns the moment a majority locks in; if all return with no majority it falls back to uncertain. Remaining votes' results are ignored (in-flight agents still finish)
}
```

<div class="callout warn">

**"Early exit" saves "waiting and deciding," not necessarily "in-flight agents."** Per `_grounding.md`, once `parallel` starts all N thunks, they run concurrently. The race skeleton above lets you **grab the conclusion the instant a majority locks in, without blocking**, but the agent calls already dispatched will usually run to completion, their results just ignored. To actually "physically dispatch fewer agents," you have to **vote in batches**: send 3 votes first (the majority line), and only add the 4th and 5th when it's a tie or close. That's the step that upgrades pigeonhole from "logical early stop" to "physical savings." Either way, the core idea is the same: **don't pay full price for a verdict that's already settled.**

</div>

---

## 15.7 Loop-Until-Dry and "K Consecutive Rounds with No New Findings": Stop Missing the Tail

A single round of Hunt, even with a finder pool, can still miss tail-end bugs — especially the subtle ones you only think of once earlier rounds hand you a "clue." For discovery tasks where "you don't know how many," the ultimate weapon is **loop-until-dry** (Chapter 18): keep dispatching new hunters until **K consecutive rounds add no new** confirmed bugs.

The key here is how you write the **stopping condition**. Two ways, and they differ a lot:

- **Naive version**: "stop if this round found no new bug" (K=1). Trouble is, discovery tasks often hit "empty rounds" — one round happens to scoop up nothing new, but the next round, from a different angle, digs more out. K=1 **quits too early** and misses the tail.
- **dry-streak version**: "stop only after **K consecutive rounds** (say K=2 or 3) with no new findings." This gives hunters a chance to "try a few more times," and the odds of missing the tail drop sharply. This is exactly what **deep-until-dry-streak** means in `bughunt`'s registered description — deep hunters keep getting dispatched until several rounds in a row squeeze out nothing new.

```mermaid
stateDiagram-v2
    [*] --> Hunt
    Hunt --> Verify: finder pool surfaces suspects
    Verify --> Tally: adversarial refute + tally
    Tally --> CountFresh: count newly confirmed this round
    CountFresh --> Hunt: had new ones<br/>(streak resets)
    CountFresh --> CheckStreak: none new<br/>(streak+1)
    CheckStreak --> Hunt: streak < K
    CheckStreak --> Dry: streak >= K<br/>K rounds with no new ones
    CheckStreak --> Capped: hit budget/round cap
    Dry --> [*]: normal close-out
    Capped --> [*]: fallback close-out
```

Below twists the finder pool + adversarial refutation + dry-streak into a complete loop skeleton:

```javascript
// (illustrative, not executed) — loop-until-dry: stop only after K consecutive rounds with no newly confirmed bug
const K = 2                 // dry-streak threshold: judge dry only after 2 consecutive rounds with no new ones
const MAX_ROUNDS = 5        // hard cap (runaway guard, Chapter 18)
const confirmed = []        // accumulate confirmed bugs
const seen = new Set()      // cross-round dedup key
let dryStreak = 0, round = 0

phase('Hunt')
while (dryStreak < K && round < MAX_ROUNDS) {
  // budget backstop: a round costs tens of thousands of tokens; close out early if not enough (budget is a hard cap, Chapter 09)
  if (budget.total !== null && budget.remaining() < 80_000) {
    log(`budget low (remaining ${budget.remaining()}), closing out early`); break
  }
  round++

  // 1) Hunt: finder pool (simplified to 1 here; use the pool from 15.5 in production), tell it "already confirmed, don't repeat"
  const known = confirmed.map(b => `- ${b.fn}: ${b.bug}`).join('\n') || '(none yet)'
  const hunt = await agent(
    `Read ${FILE} and find genuine bugs NOT already listed below.\nAlready confirmed (don't repeat):\n${known}`,
    { label: `hunt:round-${round}`, phase: 'Hunt', schema: BUG })

  // 2) dedup + adversarial refute (reuse the refutation pipeline of 15.2 / 15.6)
  const fresh = (hunt.bugs || []).filter(b => {
    const key = (b.fn + '|' + b.bug).toLowerCase().replace(/\s+/g, ' ').trim()
    return seen.has(key) ? false : (seen.add(key), true)
  })
  const verified = await pipeline(fresh, b => verifyWithPigeonhole(b))   // see 15.6
  const newlyConfirmed = verified.filter(Boolean).filter(b => b.confirmed)

  // 3) dry-streak counting: no new confirmed this round → streak+1; had new ones → reset
  if (newlyConfirmed.length === 0) {
    dryStreak++
    log(`round ${round} added no confirmed; ${dryStreak}/${K} consecutive empty rounds`)
  } else {
    dryStreak = 0
    confirmed.push(...newlyConfirmed)
    log(`round ${round} added ${newlyConfirmed.length} confirmed`)
  }
}
return { rounds: round, confirmedCount: confirmed.length, confirmed }
```

Keep the three roles straight: **the finder pool** does the "finding" (each round feeds in the "already confirmed list" and asks for new ones only); **the adversarial refutation pipeline** does the "screening" (each new suspect still has to pass refutation); **the `while` + `dryStreak` counter** decides "when to stop." That last piece is real JavaScript control flow — the model only judges, the code does the orchestrating.

<div class="callout warn">

**dry-streak guards against missing the tail, but never drop the hard cap.** The `round < MAX_ROUNDS` in the `while` condition and the `budget.remaining()` check are **seatbelts**, not decoration. Run into a hunter that can always "make up" a new suspect and it will keep resetting the dry-streak, so the loop never exits. Per `_grounding.md`, `budget` is a hard cap (calling `agent()` after reaching `total` throws), and the per-workflow lifetime cap of 1000 total agents is the last global safety net — but you should **never** lean on them to terminate a business loop. The right discipline: **dry-streak decides "when to stop normally," the round cap + budget decide "when to force-stop in the worst case," and all three are indispensable** (see Chapter 18 §18.3).

</div>

---

## 15.8 Design Points

**① Verifiers must each be independent.** Use `parallel` (or a race) to let each refuter judge **on its own**, unable to see the others — that way their errors don't correlate, and a majority vote actually means something. The moment they can see each other's votes, it degenerates into "following the crowd" and the vote is worthless.

**② Refute by default (refute-by-default).** Hard-code "Default to refuted=true if not certain" in the prompt, pushing the burden of proof onto the "this is a real bug" side. Better to under-report than to let a false positive slip through.

**③ Use a tally, don't let one agent call it.** Letting a single agent "judge true or false holistically" drags its own bias in; multiple independent refuters plus a tally is far steadier. Tallying, deduping, and filtering are all **deterministic operations** — hand them to JS code (`filter`/`Set`/`reduce`), not to an agent.

**④ The threshold is tunable, and it drives cost directly.** This chapter's real run uses 2 votes and "keep unless outvoted by a majority" (`confirms >= 1`, fairly lenient, suited to "rather over-report than miss"); `bughunt` uses a 5-vote majority. Want it stricter? Bump to 3–5 votes and switch to "keep only if a majority **confirms**" (see Chapter 17 §17.6). More votes are more trustworthy and more expensive — let the **cost of being wrong** set the vote count.

**⑤ Match the finder pool size to the target scale.** A small target (one file) needs just one finder; an entire branch wants a fixed pool (the `bughunt-lite` 3+2 shape, 5 finders); only when the scale is completely unknown and the cost of missing is high should you reach for the self-respawning pool + dry-streak (the `bughunt` shape).

| Decision axis | Lenient (cheap) | Strict (robust) |
|---|---|---|
| Finder pool | single finder / small fixed pool | self-respawning pool + dry-streak |
| Refutation votes | 2 votes | 5 votes |
| Keep criterion | `confirms >= 1` (not outvoted) | majority confirms (≥3/5) |
| Early exit | tally after running all | pigeonhole early-exit |
| Loop | single round | loop-until-dry (K≥2) |

---

## 15.9 The Boundary with "Code Review" and "Adversarial Verification"

Bug Hunter is easy to mix up with the review of Chapters 10/11 and the adversarial verification of Chapter 17. They run on the same underlying primitives (`agent`/`pipeline`/`parallel`/`schema`), but they're chasing different goals. Get the boundary clear and you'll know which recipe to pick:

| | Leans toward | How it splits | Core question | Real run |
|---|---|---|---|---|
| **Ch 10** Sharded review | **coverage** (miss no file) | by **file/module** | "did I review every shard?" | frontend-review `wf_4c5caabb-b73` |
| **Ch 11** Multi-dimension review | **coverage** (miss no dimension) | by **dimension** (a11y/perf/correctness…) | "did I check every dimension?" | `wf_4c5caabb-b73` (26→16) |
| **Ch 17** Adversarial verification | **truth** (the mother pattern) | generation ↔ verification split | "is this claim true?" | pipeline-demo `wf_bf086b98-6ec` |
| **Ch 15** Bug Hunter (this chapter) | **discovery + refutation** | finder pool → refute → synthesize | "which are real bugs, and can I trust them?" | `wf_53da9a06-915` (5/5) |

In one line:

- **Review (10/11) leans toward "coverage across dimensions"** — it assumes the target boundary is already known (these files, these dimensions), and the job is to review every block and miss nothing. The hard parts are **how to split** and **how to synthesize and dedup**; adversarial verification is just one Verify step inside it (a link in Chapter 10's skeleton).
- **Adversarial verification (17) is the mother pattern of "judging truth"** — it doesn't care about "finding them all," only about "refuting or confirming a claim that's already been generated." It's a **reusable sub-structure** that Bug Hunter, the Judge Panel (Chapter 14), and sharded review (Chapter 10) all borrow.
- **Bug Hunter (15) leans toward "discovery + refutation"** — its target scale is **unknown** (you have no idea how many bugs there are), so the two main acts are ① how to **find them all** (finder pool, loop-until-dry, dry-streak) and ② how to **trust them** (adversarial refutation, pigeonhole). Put simply, it's "unknown-scale discovery" plus "adversarial verification," fused.

<div class="callout tip">

**How to choose?** Look at which side your "uncertainty" mainly sits on:
- Unsure "**did I review it**" (boundary known, afraid of missing a block) → use **review** (Chapters 10/11).
- Unsure "**is it actually true**" (you have a claim, afraid of false positives) → use **adversarial verification** (Chapter 17).
- Unsure "**how many there are, and which are real**" (scale unknown + afraid of false positives) → use **Bug Hunter** (this chapter) — it presses down both uncertainties at once.

</div>

---

## 15.10 Chapter Summary

- Bug Hunter = **Hunt (finder pool surfaces suspects) → Verify (each bug gets N independent verifiers that refute by default + a tally) → Synthesize (code dedups and prioritizes to close out)**. It is built for the double problem of "unknown scale + untrustworthy."
- Real run `wf_53da9a06-915` (11 agents / 311,134 tokens / 61,660ms): all 5 seeded bugs found and confirmed 2:0; the verifier also **corrected the hunter's wrong argumentation** (the string-concatenation claim).
- The **finder pool** has two shapes: a fixed pool (`bughunt-lite`: 3 rapid + 2 deep) and a self-respawning pool (`bughunt`: deep-until-dry-streak); rapid casts a wide net, deep digs in; finders **stream into** the refutation pipeline (pipeline has no barrier).
- **Pigeonhole early-exit**: once a majority of votes locks in the outcome, stop voting — a logical early stop (race-settle) saves "waiting," batched voting saves "physical agents."
- **Loop-until-dry + dry-streak**: use "K consecutive rounds (K≥2) with no new ones" rather than "stop if one round finds nothing" to guard against missing the tail; the hard cap + budget are seatbelts you cannot remove.
- The boundary with review (leans toward **coverage** across dimensions) and adversarial verification (leans toward the **truth** mother pattern): Bug Hunter = **discovery + refutation** fused.

The next chapter is this part's last recipe: the "documentation/migration sweep" that finishes off the same kind of change scattered across a large number of files in one pass.

> Continue reading: [Chapter 16 · Documentation and Migration Sweep](#/en/p3-16)
