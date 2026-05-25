# Real-run: the `validate-workflow.mjs` linter (R4)

> The linter ships inside the **third-party** `claude-code-workflow-creator` repo
> (a YouTuber's companion to video `c0gVowvMR-g` — **not** official Claude/Anthropic
> output). We do **not** treat the repo's prose as authoritative, but we DID run
> its linter ourselves to confirm its actual behaviour, since the cookbook's
> "authoring" chapter teaches a validate-before-run step. Run on this machine
> 2026-05-25, Node v22.22.0.

## A. A known-good script → passes, exit 0

Validated the saved model-resolution test script (a real, runnable workflow):

```
$ node scripts/validate-workflow.mjs <…>/model-resolution-test-wf_9c94951d-58c.js
ok — model-resolution-test-wf_9c94951d-58c.js passes (1853 bytes)
(exit=0)
```

## B. A deliberately-broken script → 2 errors + 2 warnings, exit 1

Input (`bad-example.js`), authored to trip several rules at once:

```js
// A deliberately broken workflow, to capture the validator's real output.
const setupBeforeMeta = 5 // code before meta → ERROR: meta must be first

export const meta = {
  name: 'bad-example',
  description: 'demonstrates validator errors',
}

const stamp = Date.now() // banned non-deterministic call → ERROR
const fs = require('node:fs') // host API in orchestrator → warning

const results = await parallel([agent('do x'), agent('do y')]) // bare promises → warning
return { stamp, results }
```

Validator output (verbatim):

```
  warn  `require()` at line 10 — no Node/host APIs in the orchestrator; do file/shell work inside an agent() instead
  warn  parallel([...]) at line 12 looks like it holds bare agent(...) calls — wrap each as a thunk: () => agent(...)
  ERROR `export const meta` must be the FIRST statement (line 4) — code precedes it
  ERROR banned non-deterministic call `Date.now()` at line 9 — it throws inside a workflow (breaks resume)

2 error(s) in bad-example.js — fix before running.
(exit=1)
```

## Verified behaviour (for the authoring chapter)

| Check | Triggered by | Severity |
|---|---|---|
| `meta` must be the first statement | a `const` before `export const meta` | ERROR |
| banned non-deterministic call | literal `Date.now()` | ERROR |
| no host APIs in orchestrator | `require('node:fs')` | warning |
| `parallel()` wants thunks, not bare promises | `parallel([agent(...), agent(...)])` | warning |
| clean script | the model-resolution script | `ok … passes`, exit 0 |

Errors set **exit 1**; warnings alone still pass (exit 0). This is a static
pre-flight lint only — note it complements, but is stricter-surfaced than, the
Workflow tool's own submit-time rejection of literal `Date.now()` (see
`sandbox-r4.md` §A). The *rules* it enforces trace to the official tool definition
(meta-first, determinism ban, no host APIs, thunk shape) plus our own real-run
findings; the linter just makes them runnable.
