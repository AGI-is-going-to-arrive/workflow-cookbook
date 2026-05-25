# Real-run: agentType validation, resume cache hit, nested workflow (R4)

> Provenance for the cookbook. Run on this machine 2026-05-25, Claude Code with
> `CLAUDE_CODE_WORKFLOWS=1`, main loop Opus 4.7 (1M). Verbatim `Workflow` results.

## A. `agentType` is validated; `model` is not

- **Run ID:** `wf_a222f20f-0f5` · workflow `agenttype-validation-test` · 0 tokens · 4 ms.
- One `agent()` call used `agentType: 'definitely-not-a-real-agent-xyz'`, wrapped in `try/catch`.

**Returned (verbatim):**

```json
{
  "unknownThrew": true,
  "unknownAgentTypeError": "agent({agentType}): agent type 'definitely-not-a-real-agent-xyz' not found. Available agents: claude, claude-code-guide, codex:codex-rescue, Explore, general-purpose, get-current-datetime, init-architect, Plan, planner, statusline-setup, team-architect, team-qa, team-reviewer, ui-ux-designer"
}
```

**Finding:** `agentType` **is validated** — an unknown value throws *before any
model is spawned* (0 tokens, 4 ms) and the error lists every registered agent.
This contrasts with `model`, which the reference says is **not** validated (a typo
is passed through and only fails later at the API call). Validated vs not is a
real, teachable asymmetry.

## B. Resume = 100% cache hit, zero tokens

The model-resolution workflow (`wf_9c94951d-58c`, 5 agents) first ran at
**133,691 tokens / 32,959 ms**. Re-invoked **unchanged** with
`{ scriptPath, resumeFromRunId: 'wf_9c94951d-58c' }`:

- **Same run ID**, identical 5-object result returned,
- **agent_count 5 · total_tokens 0 · duration_ms 3.**

**Finding:** an unchanged resume replays every `agent()` from the journal —
**0 new tokens, 3 ms** vs 133k tokens / 33 s live. The cache key is the agent's
`(prompt, opts)`; `label`/`phase` are cosmetic and not part of it.

## C. Nested `workflow()` — runs a child, passes args, one level only

- **Run ID:** `wf_2b04881f-6a9` · workflow `nested-workflow-test` · 0 agents · 0 tokens · 29 ms.
- The parent called a child by `scriptPath` (passing `{n:21}`), then an unknown
  saved name, then a child that itself calls `workflow()`.

**Returned (verbatim):**

```json
{
  "childA": { "childRan": true, "receivedArgs": { "n": 21 }, "doubled": 42 },
  "unknownNameThrew": true,
  "unknownNameErr": "workflow('definitely-no-such-workflow-xyz'): no workflow with that name. Available: bughunt, bughunt-lite, deep-research, plan-hunter, review-branch",
  "childNester": {
    "nesterRan": true,
    "nestErr": "workflow() cannot be called from within a child workflow — nesting is limited to one level. Inline the inner script or call its agents directly."
  }
}
```

**Findings (all with verbatim error text):**

1. `workflow({ scriptPath }, args)` runs the child **inline** and **passes `args`
   through unchanged** — child saw `{n:21}` and returned `doubled: 42`.
2. An unknown **saved-workflow name throws** and lists the registered named
   workflows: `bughunt, bughunt-lite, deep-research, plan-hunter, review-branch`.
3. **Nesting is one level only** — a child calling `workflow()` throws:
   *"workflow() cannot be called from within a child workflow — nesting is limited
   to one level. Inline the inner script or call its agents directly."*
4. The whole thing — parent + two child orchestrators — spent **0 model tokens**
   (no `agent()` calls anywhere), finishing in 29 ms.

## D. Summary of R4 facts now empirically verified

| Fact | Verified by | Result |
|---|---|---|
| Literal `Date.now/Math.random/new Date()` rejected at **submit** time | (submission error) | static scan, script never runs |
| Aliased banned calls **trapped at runtime** too | `wf_59bf3654-183` | both threw, distinct messages |
| `new Date(value)` works | `wf_59bf3654-183` | `new Date(0)` ok |
| `console`/`setTimeout`/`clearTimeout`/`log`/`budget` injected | `wf_59bf3654-183` | all present; `budget.total=null` |
| `args` passed through unchanged (object stays object) | `wf_59bf3654-183` | exact object reflected |
| no host APIs (`require`/`process`/`fetch`) | `wf_59bf3654-183` | all `undefined` |
| orchestrator-only workflow spends 0 tokens | `wf_59bf3654-183`, `wf_2b04881f-6a9` | 0 tokens |
| `CLAUDE_CODE_SUBAGENT_MODEL` overrides per-call model | `wf_9c94951d-58c` + env | all agents Opus |
| `agentType` validated (unknown throws + lists agents) | `wf_a222f20f-0f5` | throws at 0 tokens |
| resume = 100% cache hit, 0 tokens | `wf_9c94951d-58c` resume | 0 tokens / 3 ms |
| `workflow()` runs child + passes args; 1-level nesting; unknown name throws | `wf_2b04881f-6a9` | all three confirmed |
| MCP usable inside a subagent (via ToolSearch load) | `wf_1d4c6a71-56a`, `wf_d8aa0772-ced` | context7 called end-to-end |

**Not independently reproduced here — the third-party `api-reference.md` (a
YouTuber's repo, NOT official) *claims* these; treat as unverified:**
`meta.phases[].model` display-only and `opts.model` no-validation (both masked by
the `CLAUDE_CODE_SUBAGENT_MODEL` override active this session); the schema-retry
exact count ("up to twice more"); the `WorkflowAgentCapError`/`WorkflowBudgetExceededError`
class names; the 30 s-sync / 180 s-stall numbers. (The **1000-agent** and **512 KB**
caps are in the **official** tool definition; the bundled validator's behaviour we
did verify ourselves — see `validator-r4.md`.)
