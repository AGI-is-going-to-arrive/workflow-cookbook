# Chapter 18 · Loop-Until-Dry & Completeness

> In one sentence: **take an ordinary JavaScript `while` loop and repeatedly "generate → ask 'any omissions?'" until a completeness agent rules "nothing new can be squeezed out anymore" — that's "loop-until-dry."**
>
> The last chapter solved "is the product **right**" (adversarial verification); this chapter solves "is the product **complete**" (completeness). The two are non-overlapping axes of the quality gate: one checks truth, one checks coverage.

---

## 18.1 The Ceiling of Single-Shot Generation: The Model "Stops Early"

First, a phenomenon that's both real and everywhere.

You ask a subagent to "list all the security hazards in this module," and it hands you 5, then stops. Are there really only 5? Usually not — once the model has produced "a set of answers that look reasonable," it tends to quit, because as far as it's concerned, "list a few" is already "done." It won't go back and ask itself "did I miss anything."

This is the ceiling of a single `agent()` call: **it fires off one batch and that's it, with no 'think again' step.** You can write "please be as thorough as possible, list them all" in the prompt, which nudges the count up a bit, but it's still one-and-done — the model stops at whatever point it figures is "enough," and that point is almost always earlier than "truly exhaustive."

The idea behind "loop-until-dry" is to take "think again" and move it **out of a plea in the prompt and into a loop in code**:

1. Generate a batch of results.
2. Take "the existing results" and ask: **any omissions?**
3. If yes, merge the new findings and go back to step 2.
4. If "no more" — **dry** — exit the loop.

Each round, the model sees "the N already found" and is explicitly told to "find new things **not yet mentioned**." That "existing list" drags it past its own comfortable stopping point, squeezing out what's left round by round, until it's truly dry.

<div class="callout info">

**The community systems have validated this pattern over and over.** Per `_grounding.md` section D: one of superpowers' gems is "a two-stage review loop, each looping until it passes"; oh-my-claudecode's signature is "the `Stop` hook persistent loop — boulder never stops, making 'whether stopping is allowed' programmable." Both lean on Hooks and state files to **simulate** "won't quit until complete." Native Workflow lets you write the same logic as a **deterministic, self-braking** structure with a `while` loop + a schema-shaped "completeness verdict." That's what this chapter is about.

</div>

---

## 18.2 The Core Structure: while Loop + Completeness Gate

At heart, the skeleton of "loop-until-dry" is just a `while` loop driven by "the boolean verdict of a completeness agent." First the minimal form:

```javascript
// (illustrative, not run) — the core skeleton of loop-until-dry
phase('Harvest')
let found = []          // accumulate all discovered entries
let done = false        // completeness gate
let round = 0

while (!done && round < 6) {   // 6 is a hard runaway cap, see 18.3
  round++

  // 1) Generate: find new entries "not yet mentioned"
  const fresh = await agent(
    `Goal: list all security hazards in this module.\n` +
    `Already found (don't repeat):\n${found.map((f) => '- ' + f.title).join('\n') || '(none yet)'}\n` +
    `Please give only **new, unmentioned** hazards.`,
    {
      label: `harvest:round-${round}`, phase: 'Harvest',
      schema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: { title: { type: 'string' }, detail: { type: 'string' } },
              required: ['title', 'detail'],
            },
          },
        },
        required: ['items'],
      },
    }
  )

  found.push(...fresh.items)

  // 2) Completeness critique: any omissions?
  const critique = await agent(
    `List of hazards found:\n${found.map((f) => '- ' + f.title).join('\n')}\n` +
    `You are a completeness reviewer. Judge whether this list has exhausted the module's security hazards.\n` +
    `If you can point out any **still-omitted** direction, then done=false and list them in missing;\n` +
    `if you're sure nothing is omitted, then done=true.`,
    {
      label: `completeness:round-${round}`, phase: 'Harvest',
      schema: {
        type: 'object',
        properties: {
          done: { type: 'boolean' },
          missing: { type: 'array', items: { type: 'string' } },
        },
        required: ['done', 'missing'],
      },
    }
  )

  done = critique.done   // the boolean gate drives the loop
  if (!done) log(`Still omissions after round ${round}: ${critique.missing.join(', ')}`)
}

log(`Loop-until-dry: ${round} rounds, ${found.length} entries total`)
return found
```

This skeleton has three key roles, matching the three things Advanced Patterns will fully explain:

**Role 1: the generator (Harvest agent).** Each round it takes in "the list already found" and is asked to produce only **new** entries. Its schema is an array (`items`), each item structured — Chapter 07's "array pattern" applied exactly.

**Role 2: the completeness critic (Completeness agent).** It does **not** generate new content; it does one thing — judge "is it enough." The core of its schema is the **gate field** `done: boolean` — `while (!done)` reads it directly to decide whether to keep going.

**Role 3: the loop itself (JS while).** This is what makes Workflow tick — **control flow is real JavaScript.** `while`, the `round` counter, `found.push(...)` are all ordinary code. The model handles "judgment," the code handles "orchestration," each minding its own job.

```mermaid
stateDiagram-v2
    [*] --> Harvest
    Harvest --> Critique: generate new entries<br/>merge into found
    Critique --> CheckDone: completeness agent<br/>returns { done, missing }
    CheckDone --> Harvest: done=false<br/>and round<cap
    CheckDone --> Dry: done=true
    CheckDone --> Capped: round hits cap
    Dry --> [*]: normal close-out
    Capped --> [*]: cap-fallback close-out
```

<div class="callout tip">

**Why split "generate" and "judge completeness" into two agents?** Have one agent both generate and self-assess "is it enough" and you fall right back into the self-assessment trap from Chapter 17 — having just generated, it leans toward saying "enough." Split out an independent completeness critic (independent context, the explicit "find omissions" duty) and the verdict becomes trustworthy. **It's the same idea as adversarial verification: keep the assessor separate from the assessed.**

</div>

---

## 18.3 The Brake: A Loop Must Be Bounded — This Is Discipline, Not Optional

In the previous section's skeleton, the `while` condition is `!done && round < 6` — that `round < 6` isn't decoration, it's the **seatbelt.**

The biggest risk of "loop-until-dry" is an **infinite loop**: if the completeness agent forever rules `done=false` (it can always "make up" a direction that looks omitted), the loop never exits. And every round of Workflow really does burn tokens and wall clock; a runaway loop drains the budget fast.

Preventing runaway must be **multi-layered defense**:

**Layer 1: a hard round cap.** `round < N` (say, 6). No matter what the completeness agent says, it stops at the cap. This is the simplest and most reliable brake.

**Layer 2: budget fallback.** Per `_grounding.md`, `budget` is a **hard cap** — call `agent()` after `spent()` hits `total` and it **throws** (`WorkflowBudgetExceededError`). So even if you forget to set a round cap, running out of budget forcibly aborts. But be clear: this is a **throw-and-abort**, not a graceful close-out — it crashes the whole run at that moment rather than cleanly returning what you've found so far. So it can only serve as a fallback; the loop should still exit normally via explicit round conditions (echoing 18.6's "treating budget as the only brake = bad UX"). The more proactive approach is to watch `budget.remaining()` inside the loop:

```javascript
// (illustrative, not run) — actively brake with budget.remaining()
while (!done && round < 6) {
  // estimate per-round cost at about 50k tokens (generate+critique, two agents); if short, stop early
  if (budget.total !== null && budget.remaining() < 50_000) {
    log(`Not enough budget for another round (remaining ${budget.remaining()}), closing out early`)
    break
  }
  round++
  // ... generate + critique
}
```

**Layer 3: diminishing-returns detection.** If two consecutive rounds add 0 entries (or near 0), then even if the completeness agent stubbornly claims there are still omissions, you can bail out on your own — because the generator has nothing left to squeeze out:

```javascript
// (illustrative, not run) — diminishing returns: stop on consecutive empty rounds
let emptyStreak = 0
while (!done && round < 6) {
  round++
  const fresh = await agent(/* ... */)
  if (fresh.items.length === 0) {
    emptyStreak++
    if (emptyStreak >= 2) { log('Two consecutive rounds with no additions, judged dry'); break }
  } else {
    emptyStreak = 0
    found.push(...fresh.items)
  }
  // ... completeness critique
}
```

<div class="callout warn">

**Never write an unbounded loop that exits only on the model's verdict.** The model's "done" is a probabilistic judgment, and it may hold back done because it "wants to look thorough." `_grounding.md` also gives a global fallback: the total agent count per workflow lifecycle is capped at **1000** — that's the last safety net, but you should **never** lean on it to terminate a business loop. The right discipline: **every loop spells out its exit conditions (round cap + diminishing returns), treating budget as the last line of defense, not the only one.**

</div>

---

## 18.4 Two Forms of Completeness Critique: Divergent vs. Convergent

"Completeness" means different things in different tasks, which gives you two loop forms.

### Form 1: divergent — "can we find more?"

This is the form from 18.2: the goal is to **exhaust an open set** (all bugs, all hazards, all edge cases). The completeness agent's job is to "point out which **directions** aren't covered yet." The exit condition is "can't find any new directions."

Typical scenarios: Bug Hunter (Chapter 15), security-hazard scanning, test-case enumeration. Tasks like these have **no full set known up front**, and can only inch toward completeness by probing over and over.

### Form 2: convergent — "has this list all been checked?"

Another kind of "complete" is **checking off a known list item by item**: e.g., "for every requirement in this spec, has the code implemented it?" Here the full set is known (the spec items), and the completeness agent's job is to **tick each off** and find the unmet ones.

```javascript
// (illustrative, not run) — convergent: check off a known list item by item
const checklist = args.requirements   // the known requirements list
const review = await agent(
  `Check item by item whether the following requirements are met in the implementation:\n${checklist.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n` +
  `For each, give a satisfied boolean and evidence.`,
  {
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              requirement: { type: 'string' },
              satisfied: { type: 'boolean' },
              evidence: { type: 'string' },
            },
            required: ['requirement', 'satisfied', 'evidence'],
          },
        },
      },
      required: ['items'],
    },
  }
)
const unmet = review.items.filter((i) => !i.satisfied)
// unmet non-empty → enter the fix loop; empty → dry
```

The convergent form usually doesn't need a `while` to squeeze over and over; instead it's a "check → fix unmet items → re-check" loop, until `unmet` is empty. **This is exactly the structure of superpowers' "spec compliance loop"** (`_grounding.md` section D).

| | Divergent | Convergent |
|---|---|---|
| Full set | Unknown, open | Known (spec/list) |
| Completeness agent's duty | Point out omitted **directions** | **Tick** each off to find unmet |
| Exit condition | Can't find new directions (dry) | Unmet items cleared |
| Typical scenario | Bug Hunter, hazard enumeration | Spec compliance, migration check |

<div class="callout tip">

**The two forms can be chained.** A real quality gate often goes: first **divergently** find every problem dry (loop-until-dry), then **adversarially verify** each problem (Chapter 17) for truth, and finally **convergently** check "have all confirmed problems been fixed." Put the three together and you get a pipeline that can both self-correct and self-prove completeness.

</div>

---

## 18.5 The Production Skeleton: Harvest → Dedup → Verify → Close Out

Combine divergent harvesting with dedup and verification, and you get a complete, production-usable skeleton. Note that loop-until-dry throws off **duplicate or near-duplicate** entries (generators in different rounds may hit the same problem from different angles), so you need to dedup before close-out.

```javascript
// (illustrative, not run) — complete production skeleton
export const meta = {
  name: 'loop-until-dry-review',
  description: 'Repeatedly squeeze out problems until the completeness agent rules dry, dedup, then verify item by item, close out',
  phases: [{ title: 'Harvest', detail: 'loop until dry' }, { title: 'Verify', detail: 'check item by item' }],
}

const MAX_ROUNDS = 6
let found = []
let done = false
let round = 0
let emptyStreak = 0

phase('Harvest')
while (!done && round < MAX_ROUNDS) {
  round++
  if (budget.total !== null && budget.remaining() < 60_000) {
    log(`Budget critical, closing out early`); break
  }

  const fresh = await agent(
    `Goal: ${args.goal}\nAlready found (don't repeat):\n` +
    `${found.map((f) => '- ' + f.title).join('\n') || '(none yet)'}\nGive only new entries.`,
    {
      label: `harvest:${round}`, phase: 'Harvest',
      schema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: { title: { type: 'string' }, detail: { type: 'string' } },
              required: ['title', 'detail'],
            },
          },
        },
        required: ['items'],
      },
    }
  )

  if (fresh.items.length === 0) {
    if (++emptyStreak >= 2) { log('Two consecutive rounds with no additions, dry'); break }
  } else {
    emptyStreak = 0
    found.push(...fresh.items)
  }

  const critique = await agent(
    `Already found:\n${found.map((f) => '- ' + f.title).join('\n')}\n` +
    `You are a completeness reviewer; if sure nothing is omitted then done=true, otherwise done=false and list missing.`,
    {
      label: `completeness:${round}`, phase: 'Harvest',
      schema: {
        type: 'object',
        properties: { done: { type: 'boolean' }, missing: { type: 'array', items: { type: 'string' } } },
        required: ['done', 'missing'],
      },
    }
  )
  done = critique.done
}

// Dedup: use a normalized title (lowercase, collapsed spaces) as the key
const seen = new Set()
const unique = found.filter((f) => {
  const key = f.title.toLowerCase().replace(/\s+/g, ' ').trim()
  if (seen.has(key)) return false
  seen.add(key)
  return true
})
log(`Harvest ended: ${round} rounds, ${found.length} raw, ${unique.length} after dedup`)

// Adversarially verify item by item (reusing Chapter 17's verdictSchema idea)
phase('Verify')
const verified = await pipeline(
  unique,
  (item) =>
    agent(
      `Falsify the following claim; if you can give a counterexample rule refuted, if evidence is conclusive rule confirmed, if insufficient rule uncertain.\n` +
      `Claim: ${item.title}\nDetail: ${item.detail}`,
      {
        label: `verify:${item.title.slice(0, 20)}`, phase: 'Verify',
        schema: {
          type: 'object',
          properties: {
            verdict: { type: 'string', enum: ['confirmed', 'refuted', 'uncertain'] },
            reasoning: { type: 'string' },
          },
          required: ['verdict', 'reasoning'],
        },
      }
    ).then((v) => ({ ...item, ...v }))
)

const confirmed = verified.filter(Boolean).filter((v) => v.verdict === 'confirmed')
return { rounds: round, total: unique.length, confirmed }
```

This skeleton twists the first two chapters of Advanced Patterns into one rope: **loop-until-dry** (this chapter) guarantees "find all," **adversarial verification** (Chapter 17) guarantees "find right," with a bit of ordinary JS for **dedup** in between. Each minds its own job.

<div class="callout warn">

**Why must dedup be done with code, not another agent?** Because dedup is a **deterministic** operation — the same input necessarily yields the same output. A `Set` + a normalized key is zero-cost, replayable, and unambiguous. Spin up another agent to "dedup for me," on the other hand, and you not only burn extra tokens but drag in nondeterminism (the model may miss duplicates, or flag things that aren't). **Anything doable with deterministic code (dedup, count, filter, sort, aggregate) should not be handed to an agent** — this is the core discipline of Workflow's "code orchestrates, model judges" division.

</div>

---

## 18.6 Anti-Patterns and Best Practices, Quick Reference

| Anti-pattern | Consequence | Correct approach |
|---|---|---|
| Unbounded `while` (exit only on model done) | Infinite loop, burns the budget | Always add a round cap + diminishing returns + budget fallback |
| Generator doesn't know "what's already found" | Repeatedly produces duplicate entries | Inject the existing list into the prompt each round, ask for only new ones |
| Same agent both generates and judges completeness | Confirmation bias, premature done | The completeness critic must be an independent agent |
| Using an agent for dedup/count | Wastes tokens + nondeterministic | Use JS (Set/filter/reduce) for deterministic operations |
| Completeness verdict in free text | Can't drive the while | `done: boolean` gate field + `required` |
| Treating budget as the only brake | Exit timing uncontrollable, bad UX | Budget is the last line; business exit relies on explicit conditions |
| Regenerating everything in full each round | Tokens grow quadratically with rounds | Produce only the **increment** each round, accumulate in a JS array |

<div class="callout info">

**Cost intuition**: loop-until-dry's token cost is roughly "rounds × per round (generate + critique, two agents)." Going by real numbers — a single agent ≈ 26k tokens (hello `wf_dacbd480-d5d`) — one round runs about 50k, and 4 rounds about 200k tokens. Note that this "200k" is an order-of-magnitude figure **extrapolated from a per-round estimate**, not a measured value; the `158982` it's compared against is the **measured pipeline-demo** total — the two are not from the same source, so don't treat them as data from one and the same run. But they land in the same ballpark, which is enough for cost intuition. So the round cap is not only a runaway guard but also a **cost gate**: set it at the round count where "marginal returns have already dropped off" (empirically, 3–6 rounds cover the vast majority of divergent tasks).

</div>

---

## 18.7 Chapter Summary

- **Loop-until-dry = use a JS `while` to repeatedly "generate increment → completeness critique," until it's ruled dry.** It punches past the "stops early" ceiling of a single `agent()`, turning "think again" from a prompt plea into a code loop.
- The three-role division: the **generator** (produces new entries each round, array schema), the **completeness critic** (independent agent, `done: boolean` gate), and the **loop itself** (real JS while + counter).
- **The brake is discipline**: must be multi-layered — a hard round cap, diminishing returns (consecutive empty rounds), `budget.remaining()` fallback. Never write an unbounded loop that exits only on the model's verdict (the global 1000-agent cap is a safety net, not a business-exit mechanism).
- Two forms: **divergent** (exhaust an unknown open set, find omitted directions) and **convergent** (check off a known list item by item, find unmet items — the spec-compliance loop); they can be chained.
- The production skeleton twists three chapters into one rope: **loop-until-dry** guarantees finding all, **adversarial verification** guarantees finding right, **JS dedup** guarantees no duplicates — deterministic work goes to code, judgment goes to agents.

In the next chapter, we take on a problem you can't dodge when writing files in parallel: when multiple agents must modify code at once, how to keep them from trampling each other — `isolation: 'worktree'`.

> Continue reading: [Chapter 19 · Worktree Isolation](#/en/p4-19)
