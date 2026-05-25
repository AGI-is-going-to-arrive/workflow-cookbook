# Real-run: testing the third-party repo's api-reference claims (R4)

> The user asked us to **comprehensively real-test** `claude-code-workflow-creator`
> rather than trust it. This file records probes that turn several of its
> *third-party claims* into either **verified facts** or **refuted/refined** ones.
> Run on this machine 2026-05-25, `CLAUDE_CODE_WORKFLOWS=1`, main loop Opus 4.7 (1M).
> The repo is a YouTuber's companion to video `c0gVowvMR-g` — **not** official.

## X1 — meta reserved keys → rejected at submit ✅ (claim verified)

Submitted `export const meta = { name, description, constructor: 'evil' }`. The
`Workflow` tool **rejected it at submission** (no run). Verbatim:

```
Script must begin with `export const meta = { name, description, phases }` (pure literal).
meta must be a pure literal: reserved key name not allowed in meta: constructor
```

→ The claim "reserved keys `__proto__`/`constructor`/`prototype` are rejected" is
**confirmed** (tested with `constructor`).

## X2 — `isolation` values ✅ (claim verified AND refined)

- **Run ID:** `wf_dace2fc6-966` · 3 agents · 52,014 tokens · 5,253 ms.

```json
{
  "isoRemote": { "threw": true, "err": "agent({isolation:'remote'}) is not available in this build" },
  "isoBogus":  { "threw": false, "result": "OK" },
  "badModel":  { "threw": false, "result": "OK" }
}
```

- `isolation:'remote'` → **throws** `agent({isolation:'remote'}) is not available in this build`. Confirms "'remote' exists but is disabled in this build."
- `isolation:'totally-bogus'` → **does NOT throw**; the agent ran normally. **Refines the repo's claim**: the runtime special-cases only `'worktree'` (do isolation) and `'remote'` (reject); **any other value is silently ignored**, not rejected. So "'worktree' is the only *accepted* value" is imprecise — unknown values are ignored, not errors.

## X4 — bogus `model` string → no submit-time validation ✅ (partial)

(Same run `wf_dace2fc6-966`.) `model: 'totally-not-a-real-model-xyz'` → the agent
**ran fine and returned "OK"**. So a bad model string is **not** rejected at
submit/parse time — consistent with "model is not validated." Caveat: because
`CLAUDE_CODE_SUBAGENT_MODEL` was overriding every per-call model (see
`sandbox-r4.md`), the bogus string was never sent to an API, so the repo's "fails
later at the API call" step could **not** be observed here.

## X3 — VM synchronous timeout = 30000 ms ✅ (claim verified)

A long synchronous loop `for (i=0;i<1e12;i++){}` (no awaits) was run.

- **Run ID:** `wf_e3b2b123-5f4` · **status: failed** · 0 agents · 30,222 ms.
- Verbatim failure: `Error: Script execution timed out after 30000ms`.

→ Confirms the **30000 ms synchronous-execution timeout** (it bounds *synchronous*
work to catch infinite loops; it is **not** a wall-clock cap — async workflows with
`await agent(...)` routinely run for minutes).

## Net effect on the grounding tiers

Promoted from "third-party, unverified" → **实测 (verified here)**: reserved-key
rejection, `isolation:'remote'` disabled (+ unknown-isolation-ignored refinement),
no submit-time model validation, the 30000 ms sync timeout.

Still **third-party, unverified** (not triggerable cheaply this session): the error
*class names* `WorkflowAgentCapError`/`WorkflowBudgetExceededError`, `stallMs`
default/retry counts, the budget-exceeded in-flight-kept behavior, AJV + "nudges up
to twice more", the exact resume cache-key composition, and the `'inherit'`
literal's exact semantics.
