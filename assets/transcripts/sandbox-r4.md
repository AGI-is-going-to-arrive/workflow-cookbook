# Real-run: the determinism sandbox, injected globals, args passthrough (R4)

> Provenance for the cookbook's claims about the workflow sandbox. Run on this
> machine 2026-05-25, Claude Code with `CLAUDE_CODE_WORKFLOWS=1`, main-loop model
> Opus 4.7 (1M). Results are verbatim from the `Workflow` tool.

## A. Banned calls are rejected at SUBMIT time (static scan)

A first script contained a literal `Date.now()`. The `Workflow` tool **rejected
it at submission** — it never ran. Verbatim tool error:

```
Workflow scripts must be deterministic: Date.now()/Math.random()/new Date() are
unavailable (breaks resume). Stamp results after the workflow returns, or pass
timestamps via args.
```

So a literal `Date.now()` / `Math.random()` / argless `new Date()` is caught by a
**static source scan before the script is parsed/run** — you cannot `try/catch`
your way past it; the script simply does not launch.

## B. Banned calls are ALSO trapped at runtime (aliased forms)

To see whether the ban is static-only, a second script aliased the calls
(`const D = Date; D.now()`) to evade the literal-form scan. Submission **passed**
— but the calls **threw at runtime**, caught by the script's own `try/catch`.

- **Run ID:** `wf_59bf3654-183` · workflow `sandbox-introspection-test` · **0 agents, 0 tokens, 4 ms**.
- **`args` passed in:** `{"hello":"world","n":5,"nested":{"deep":true}}`

**Returned object (verbatim):**

```json
{
  "aliasedDateNowError": "Date.now() / new Date() are unavailable in workflow scripts (breaks resume). Stamp results after the workflow returns, or pass timestamps via args.",
  "aliasedMathRandomError": "Math.random() is unavailable in workflow scripts (breaks resume). For N independent samples, include the index in the agent label or prompt.",
  "newDateFixed": "1970-01-01T00:00:00.000Z",
  "mathMaxWorks": 3,
  "jsonWorks": "{\"a\":1}",
  "typeofConsole": "object",
  "typeofSetTimeout": "function",
  "typeofClearTimeout": "function",
  "typeofLog": "function",
  "typeofBudget": "object",
  "budgetTotal": null,
  "consoleLogWorks": true,
  "argsTypeof": "object",
  "argsSeen": { "hello": "world", "n": 5, "nested": { "deep": true } },
  "argsIsArray": false,
  "typeofRequire": "undefined",
  "typeofProcess": "undefined",
  "typeofFetch": "undefined"
}
```

### Verified facts from this run

| Claim | Result |
|---|---|
| Determinism ban has TWO layers (static submit-scan **and** runtime trap) | ✅ aliased `D.now()` / `M.random()` threw at runtime with distinct messages |
| Runtime `Math.random` error even suggests the index workaround | ✅ "…include the index in the agent label or prompt." |
| `new Date(specificValue)` still works | ✅ `new Date(0)` → `1970-01-01T00:00:00.000Z` |
| Standard built-ins (`Math.max`, `JSON`) work | ✅ |
| `console` injected (object), `console.log` callable | ✅ |
| `setTimeout` / `clearTimeout` injected (functions) | ✅ |
| `log` injected (function), `budget` injected (object) | ✅ `budget.total === null` with no target set |
| `args` passed through **unchanged** — object stays an object | ✅ exact object reflected, `Array.isArray` false |
| No host APIs in the orchestrator | ✅ `require` / `process` / `fetch` all `undefined` |
| An orchestrator-only workflow (no `agent()`) spends **zero** model tokens | ✅ 0 agents · 0 tokens · 4 ms |

## C. `CLAUDE_CODE_SUBAGENT_MODEL` overrides per-call model — and was active here

A model-resolution probe (`wf_9c94951d-58c`, 5 agents, 133,691 tokens) ran five
agents with different `model` options (`haiku`, `inherit`, `opus`, omitted, plus
one in a phase whose `meta.phases[]` entry said `model:'haiku'`). **All five
reported `claude-opus-4-7[1m]`.**

The cause is environmental, verified directly:

```
CLAUDE_CODE_SUBAGENT_MODEL=claude-opus-4-7[1m]   (set in this session)
```

A third-party repo (`claude-code-workflow-creator`, a YouTuber's companion to the
video — **not** official) claims `CLAUDE_CODE_SUBAGENT_MODEL`, when set, overrides
every per-call `model`. Consistent with that, every agent here ran as Opus
regardless of its `model` opt (the env var being set is the directly observed fact).

**Honest limitation:** because this override was active, this session **cannot**
independently isolate `meta.phases[].model` from `opts.model`. The third-party
`api-reference.md` *claims* `meta.phases[].model` is display-only — **unverified
here**; we do not assert we reproduced it, and the safe practice is to set the
model on each `agent()` call regardless. (Note also: the
subagents' *self-reported* model is unreliable — each one echoed the parent
session's environment line "You are powered by … claude-opus-4-7[1m]", so
self-report cannot be used to detect the real per-agent model.)

Per-agent journal sidecar `agent-<id>.meta.json` records only
`{"agentType":"workflow-subagent"}` (the default agent type) — not the model.
