# Chapter 14 · Judge Panel: A/B Evaluation

> Given two (or N) candidate answers, how to objectively pick the better one? The worst approach is to hand it to one agent and ask it to "see which is better." A single judge brings both its own preferences and its own blind spots. This chapter introduces the real-world judge panel into Workflow: take N candidates, have multiple mutually independent judges score them against the same rubric, then tally and aggregate to decide the winner. The entire recipe is built on one real run: two candidate answers, 3 independent judges, a **3:0** verdict for the winner. Those judges also completed something unexpected and valuable.

---

## 14.1 Recipe Motivation

LLM-as-judge itself is not new; the challenge is judging reliably. A single judge has three structural flaws:

- **Preference bias.** A single agent has its own tendency toward "verbose but thorough" versus "concise but shallow," and that tendency bleeds into its verdict. There is no way to distinguish "B really is better" from "this judge happens to like B's style."
- **Instability.** The same judge, the same pair of candidates, a slight change of wording might flip the result, with no way to assess stability.
- **Not tally-able.** One judge gives only one conclusion; there is no confidence information like "what proportion thinks B is better."

The judge panel tackles all three with multiple non-communicating independent judges:

```mermaid
flowchart TB
  q["the same question q"]
  q --> A["draft:A<br/>perspective A (e.g., beginner-friendly)"]
  q --> B["draft:B<br/>perspective B (e.g., performance engineering)"]
  A & B --> BR{{"barrier: both candidates ready"}}
  BR --> J1["judge:1<br/>independently scores against the rubric"]
  BR --> J2["judge:2<br/>independently scores against the rubric"]
  BR --> J3["judge:3<br/>independently scores against the rubric"]
  J1 & J2 & J3 --> T["Tally<br/>votesA vs votesB"]
  T --> W["winner"]
```

The chapter is organized around three key designs:

1. **Judges must be independent.** Use `parallel` to let each judge score on its own, blind to the others' conclusions. Otherwise they follow the crowd and the panel collapses into a single judge.
2. **Scoring needs a rubric.** Use `schema` to pin the scoring dimensions (accuracy / clarity / completeness) down to numbers, forcing judges to think structurally instead of producing a single "I think B is better."
3. **Aggregate by tally.** The final verdict comes from counting votes, not from handing it to another agent to "synthesize everyone's opinions." The latter would compress the multi-judge independence back down to a single point.

---

## 14.2 The Full Script

**(An illustrative script fleshed out from the transcript skeleton, not run verbatim; the actual run's Run ID and usage are in 14.3.)** Below is the script of this real run, with a structure that matches `assets/transcripts/judge-panel.md`. The transcript elides the two schemas `answer` and `SCORE` with `{...}`; here they're **filled out into a runnable form** and tagged inline as "(illustrative completion)." The parts that genuinely exist in the transcript (`meta`, `q`, the `parallel` drafting, the 3-judge `parallel` scoring, the Tally count and `return`) are left exactly as-is.

```javascript
export const meta = {
  name: 'judge-panel',
  description: 'A/B evaluation: two candidates scored by 3 independent judges, then tallied',
  phases: [{ title: 'Draft' }, { title: 'Judge' }, { title: 'Tally' }],
}

const q = 'When should you use parallel() vs pipeline() in a Claude Code Workflow?'

// The candidate answer schema (illustrative completion: elided with {...answer} in the transcript)
const ANSWER = {
  type: 'object',
  properties: { answer: { type: 'string' } },
  required: ['answer'],
}

phase('Draft')
// Two candidates produced concurrently, deliberately from different perspectives, to create a real quality difference
const [a, b] = await parallel([
  () => agent(`${q} Write a thorough answer from a beginner-friendly angle.`,
    { label: 'draft:A', phase: 'Draft', schema: ANSWER }),
  () => agent(`${q} Write a thorough answer from a performance-engineering angle.`,
    { label: 'draft:B', phase: 'Draft', schema: ANSWER }),
])

phase('Judge')
// The rubric fixed into a schema: three scoring dimensions + winner enum + reason (illustrative completion of SCORE)
const SCORE = {
  type: 'object',
  properties: {
    scoreA: {
      type: 'object',
      properties: {
        accuracy: { type: 'number' },
        clarity: { type: 'number' },
        completeness: { type: 'number' },
      },
      required: ['accuracy', 'clarity', 'completeness'],
    },
    scoreB: {
      type: 'object',
      properties: {
        accuracy: { type: 'number' },
        clarity: { type: 'number' },
        completeness: { type: 'number' },
      },
      required: ['accuracy', 'clarity', 'completeness'],
    },
    winner: { type: 'string', enum: ['A', 'B'] },
    reason: { type: 'string' },
  },
  required: ['scoreA', 'scoreB', 'winner', 'reason'],
}

// 3 judges each score independently: parallel barrier, none can see another's verdict
const judges = await parallel(
  [1, 2, 3].map((i) => () =>
    agent(
      `Independently score answers A and B on accuracy, clarity, completeness (0-10 each), ` +
        `then pick the better overall.\nA: ${a.answer}\nB: ${b.answer}`,
      { label: `judge:${i}`, phase: 'Judge', schema: SCORE }
    )
  )
)

phase('Tally')
// Tally aggregation: count votes, don't let an agent "synthesize everyone's opinions"
const valid = judges.filter(Boolean)
const votesA = valid.filter((j) => j.winner === 'A').length
const votesB = valid.filter((j) => j.winner === 'B').length
return {
  votesA,
  votesB,
  winner: votesA > votesB ? 'A' : 'B',
  judgeReasons: valid.map((j) => j.reason),
}
```

This structure looks similar to Chapter 11's Multi-dimension PR Review but differs in essence. Both use the `parallel` barrier to run concurrently, but they divide the work in opposite ways:

- Chapter 11: each agent looks at a **different** dimension (division of labor), then **synthesizes** outputs.
- This chapter: each judge looks at the **same pair** of candidates (repeated judgment), then **tallies** votes.

Synthesize after division of labor uses an agent. Tally after repetition uses code. The core of the judge panel lies here: it demotes aggregation from "call another agent to make the call" down to a piece of deterministic vote-counting code, which is how each judge's independence stays intact.

---

## 14.3 Real Run Results

> **Real run**: Run ID `wf_f5b69668-b18`, Task ID `w7rykwriv`. See `assets/transcripts/judge-panel.md` for the raw record.
> Real usage: `agent_count=5` (2 drafts + 3 judges) ｜ `tool_uses=26` ｜ `total_tokens=201852` ｜ `duration_ms=79462`.

### Tally Result: 3:0 for B

The value the script actually returned:

```json
{
  "votesA": 0,
  "votesB": 3,
  "winner": "B",
  "judgeReasons": [ "...three detailed reasons..." ]
}
```

**The 3 judges unanimously (3:0) ruled B the winner.** The reasons converged strongly. B (performance-engineering perspective) pulled clearly ahead on **completeness**: it included **real measurement data** and identified the anti-pattern of "back-to-back parallel barrier waste" (the topic of Chapter 08). A (beginner perspective) edged ahead on **clarity** but lacked depth. Across the three dimensions, the gap on completeness outweighed clarity's small advantage.

<div class="callout tip">

**How `agent_count=5` maps to the script structure.** 2 drafts plus 3 judges is 5 agents, matching the real usage exactly, which confirms Chapter 08's rule of thumb "tokens ≈ agent count x per-agent context" (`201852 / 5 ≈ 40K/agent`). `tool_uses=26` runs high; the next section explains why: the judges did something extra.

</div>

### Two Unexpected Yet Valuable Observations

The most valuable finding from this run is not that "B won," but **how** the judges reached that conclusion:

<div class="callout info">

**Observation 1 · Judges proactively verify.** All 3 judges stated it in their reasons: they **actually read `docs/en/p2-08-parallel-vs-pipeline.md` and `assets/_grounding.md` to cross-check**, comparing the numbers in the candidate answers one by one: `8.4s / 78844 token`, `26.7s / 158982 token`, the `3x5.5≈16.5s` baseline, the `min(16, cores−2)` concurrency cap, the `1000` agent fallback. All three judges independently concluded "zero factual errors, every number matches precisely."

This is why `tool_uses=26` runs high: the judges did not score from impression; they **actually read the source of facts.** An additional benefit: the run **verified in passing that all of this book's Chapter p2-08 real data is accurate.** A single judge-panel run came with a free fact-check.

**Observation 2 · Independent judges converge.** Three **non-communicating** judges each landed independently on exactly the same conclusion (3:0). This is the judge panel's value realized: when candidates clearly differ in quality, multiple independent perspectives **converge steadily**. If their quality were close, the result would be 2:1 or even split scores -- which is itself a signal that "these two are about the same."

</div>

These two observations together illustrate one point: **a structured rubric (schema) pushes judges toward serious verification rather than vague assessment.** Once the schema asks for a concrete number on `accuracy`, a judge naturally goes and checks the facts. That is the additional benefit schema constraints deliver.

---

## 14.4 Design Points

**① Judge independence is a non-negotiable red line.** Use `parallel` to let judges score concurrently, blind to each other's verdicts. The moment you write "judge 2 scores after seeing judge 1's score," the panel collapses into one judge plus a few echoers, and the value of multi-perspective bias reduction drops to zero.

<div class="callout warn">

**Counter-example**: don't feed conclusions serially like this:

```javascript
// ✗ Wrong: judges 2/3 can see the prior verdicts → follow the crowd, independence lost
let prev = null
for (const i of [1, 2, 3]) {
  prev = await agent(`Previous judge said: ${JSON.stringify(prev)}. Now you score...`, { schema: SCORE })
}
```

The right way is the `parallel([1,2,3].map(...))` in the script: three judges run at the same time, and none of them sees another.

</div>

**② The rubric must be fixed into numbers with a schema.** Having judges give a `number` each for `accuracy / clarity / completeness` is far more effective than having them write a paragraph of "overall feel." Numbers are comparable, explainable (it is clear "B won on completeness"), and weightable (Variant B). The schema gets validated at the tool-call layer (Chapter 07), and a non-conforming judge gets sent back to re-score, turning scoring from a soft suggestion into a hard structure.

**③ Aggregate by tally, not with a "synthesize agent."** The final `Tally` stage is **pure JavaScript**: `filter` plus counting votes. Do not insert an agent here to synthesize the three judges' opinions into a final conclusion. That compresses the three independent signals back into a single-point judgment, discarding the independence carefully preserved earlier. Tallying is deterministic, reproducible, and costs zero extra tokens, exactly the work the Workflow "deterministic skeleton" is meant to carry (echoing Chapter 02).

**④ Candidates should have a real difference.** This example deliberately sends A on the beginner perspective and B on the performance-engineering perspective, producing a quality gap that can be distinguished. If the two candidates are nearly identical, the judges can only force a pick out of the noise, and the result provides no useful information. Candidates can come from different prompts, different models, different temperatures, or multiple samples of the same prompt.

**⑤ Use an odd number of judges.** An odd count (3, 5, 7) avoids ties. Here 3 is enough to converge when quality clearly differs; if the candidates are evenly matched or the stakes are high, bumping to 5 further damps single-judge noise. Token cost grows linearly, but the wall clock is still bounded by the barrier and doesn't grow linearly with the number of judges.

---

## 14.5 Variants

<div class="callout info">

**Variant A · N-candidate tournament**: when there are more than two candidates, expand the schema's `winner` from `enum:['A','B']` to `enum:['A','B','C',...]` and let the judge pick the best; or have each judge **rank** all candidates (returning a ranking array), and let the Tally stage decide the winner with a rank-aggregation method like Borda count.

**Variant B · Weighted rubric**: give the dimensions weights (e.g., `accuracy×3 + completeness×2 + clarity×1`), and in the Tally stage take a weighted sum of each judge's `scoreA/scoreB` before comparing. That upgrades voting into weighted scoring, which fits cases where the dimensions don't matter equally.

**Variant C · Judge + disqualify**: add a `disqualify: boolean` field to the schema (e.g., "contains a factual error," "out of scope"). At Tally, any judge's disqualification knocks that candidate out on the spot, splitting scoring apart from a red-line check, echoing Chapter 17's adversarial verification.

**Variant D · After GCF / generation (best-of-N)**: this is exactly where Chapter 12 GCF's "Variant C" lands. In the Generate stage use `parallel` to produce N candidates, **use this chapter's judge panel to pick the best**, then run Critique→Fix on the winner. For any "diverge first, then converge" pipeline, the judge panel is the **convergence gate**.

**Variant E · Graft-style synthesis (preserve the runners-up's strengths)**: a stronger convergence does more than pick the winner. It **builds on the winning candidate as the trunk and grafts in the strengths unique to the losing candidates.** Losing does not mean entirely without merit: a candidate that came second overall might still excel on some specific dimension, such as an edge case the winner missed or a more precise phrasing. After tallying to pick the winner, **add one synthesis agent**, feed it the winner's full text, the runners-up, and the strengths the judges noted in each, and have it produce a final draft that uses the winner as the skeleton and selectively absorbs the runners-up's strengths.

```javascript
// (illustrative, not run) — after tallying to pick the winner, graft-style synthesis
const winnerDraft = votesA > votesB ? a.answer : b.answer
const final = await agent(
  // Synthesize from the winner as the trunk, grafting in strengths unique to the losing candidate
  `Rewrite a final answer using the following as the trunk:\n${winnerDraft}\n\n` +
    `From the losing candidate below, absorb only its unique strengths the winner lacks (e.g., a missed edge case, a more precise phrasing):\n${votesA > votesB ? b.answer : a.answer}`,
  { label: 'synthesize', phase: 'Tally', schema: ANSWER }
)
```

This synthesis agent comes **after the tally** and does not replace it. The verdict is still decided by §14.4's "③ Aggregate by tally" deterministic code, and synthesis happens only once the trunk is fixed, so it does not break judge independence. It differs fundamentally from the red line of "letting one agent synthesize everyone's opinions to decide the winner": the former uses an agent to assemble text, the latter uses an agent to make the verdict call.

</div>

---

## 14.6 Chapter Summary

- Judge panel = N candidates, multiple independent judges scoring against the same rubric, then tally and aggregate. It leans on multiple perspectives to damp a single judge's preference bias and instability. The three red lines (independent judges, rubric fixed into numbers, aggregation by vote-counting code) are in §14.4.
- Similar in form but different in essence from Chapter 11: PR review is "synthesize after division of labor" (use an agent), the judge panel is "tally after repetition" (use code).
- Real run: `agent_count=5`, `total_tokens=201852`, `duration_ms=79462`; 2 candidates, 3 judges, **3:0 for B**.
- Two empirical observations: judges **proactively read `docs/en/p2-08` and `_grounding.md` to cross-check** (where `tool_uses=26` comes from, verifying in passing that this book's p2-08 data is all correct); three non-communicating judges **landed independently on the same conclusion**.
- Variants: N-candidate tournament, weighted rubric, disqualify, best-of-N after generation/GCF, and **graft-style synthesis** (use the winner as the trunk and absorb the runners-up's unique strengths, preserving valuable content from losing drafts).

The next chapter steps into the "Bug Hunter" recipe: a self-respawning finder pool flowing into adversarial verification, digging out a branch's latent defects.

> Continue reading: [Chapter 15 · Bug Hunter](#/en/p3-15)
