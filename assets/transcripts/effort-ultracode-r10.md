# Real-evidence: `/effort`, `ultracode` & the workflows gate (R10)

> **Provenance.** All strings below are **verbatim** extractions from the Claude Code
> **2.1.154** single-file binary (`bin/claude.exe`, 214 MB Mach-O arm64, bun-compiled)
> on this machine, 2026-05-29, plus this session's live environment. Binary strings
> are the *source of behavior* — authoritative, second only to runtime observation.
> Method: `fs.readFileSync(path,'latin1')` + `indexOf`-slice; non-printable bytes
> shown as `·`. Reproduction code in §G. This is **static** evidence (string/code
> inspection), explicitly *not* a Workflow Run ID; the runtime fact that the Workflow
> tool is callable in this session is recorded in §0.

## 0. Environment (this session, live)

- `claude --version` → **`2.1.154 (Claude Code)`**
- `CLAUDE_CODE_WORKFLOWS=1` → the **Workflow tool is present and callable** in this
  session's toolset (runtime-verified: it appears in the tool list and prior rounds
  ran real workflows).
- `CLAUDE_CODE_EFFORT_LEVEL=max` → an **env override is active** (see §E).
- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.
- Binary path: `…/@anthropic-ai/claude-code/bin/claude.exe` (also hard-linked at
  `node_modules/@anthropic-ai/claude-code-darwin-arm64/claude`).

## A. `/effort` is a **seven-value** command

Argument validator (verbatim): `Valid options are: low, medium, high, xhigh, max, ultracode, auto`

Per-level descriptions (verbatim, from the `/effort` help text):

| value | verbatim description |
|---|---|
| `low` | Quick, straightforward implementation |
| `medium` | Balanced approach with standard testing |
| `high` | Comprehensive implementation with extensive testing |
| `xhigh` | Extended reasoning with thorough analysis |
| `max` | Maximum capability with deepest reasoning |
| `ultracode` | **xhigh + dynamic workflow orchestration (this session only)** |
| `auto` | Use the default effort level for your model |

The underlying *level enum* (verbatim) is **`"low","medium","high","xhigh","max"`** —
five tiers. `ultracode` is **not** in this enum; it is a preset (see §B). The
help line for `ultracode` is rendered **conditionally**: `…+(vx()?"- ultracode: xhigh
+ dynamic workflow orchestration (this session only) ":"")+…` — i.e. the option only
shows when the gate `vx()` is true (workflows available).

## B. `ultracode` === `xhigh` effort (NOT a deeper 6th tier)

Effort-parse function (verbatim):

```
function c$O(H){let _=H.toLowerCase();if(_==="auto"||_==="unset")return{value:void 0};if(_==="ultracode"&&vx())return{value:"xhigh"};let q=KVH(H);return q?{value:q}:null}
```

Second confirmation (a different code path, verbatim): `…let e_=$67(k==="ultracode"?"xhigh":k,…`

**Finding.** `ultracode`'s reasoning depth **equals `xhigh`**. `max` is deeper than
`ultracode`. ultracode's *extra* is the **standing workflow-orchestration opt-in**
(§D), not deeper reasoning. Common misconception to debunk: "ultracode = the
strongest tier." Wrong — `max` reasons deeper; ultracode trades that one notch for
*default proactive multi-agent orchestration*.

Definitions of ultracode (verbatim, several phrasings):
- `Enable ultracode for the session: xhigh effort plus standing dynamic-workflow orchestration.`
- `ultracode: xhigh + dynamic workflow orchestration (this session only)`
- `Whether ultracode (xhigh effort plus standing dynamic-workflow orchestration) is active for the session.`
- `Current effort level: ultracode (xhigh + dynamic workflow orchestration; this session only)`

## C. Two independent layers: tool-availability vs. use-the-tool

### C1. Tool availability — `CLAUDE_CODE_WORKFLOWS` + server flag + tier (verbatim `FX5`)

```
function FX5(){if(xH(process.env.CLAUDE_CODE_WORKFLOWS)){let _=L_("tengu_workflows_enabled",!0);return{available:_,defaultOn:_}}if(VK(process.env.CLAUDE_CODE_WORKFLOWS))return{available:!1,defaultOn:!1};if(!L_("tengu_workflows_enabled",!0))return{available:!1,defaultOn:!1};return{available:!0,defaultOn:OK()!=="pro"}}
```

Decoded:
- `CLAUDE_CODE_WORKFLOWS` **truthy** (`"1"`) → `available = tengu_workflows_enabled`
  (local default `true`). **Reliable enable.**
- `CLAUDE_CODE_WORKFLOWS` **falsy** (`"0"`) → `available=false` (explicit off).
- **unset** → look at server flag `tengu_workflows_enabled`; if off → unavailable;
  if on (default) → `available=true`, `defaultOn = (tier !== "pro")` (non-pro on by
  default).

**Caveat (honest):** `tengu_workflows_enabled`'s *server* value is a growthbook/gate
the user can't control; `!0`(=true) is only the **local fallback**. So the only
*user-controllable, version-stable* way to guarantee availability is explicit
`CLAUDE_CODE_WORKFLOWS=1`. (This session: `=1`, tool present.)

### C2. ultracode does NOT touch workflow availability (measured)

- Proximity scan: of **37** `ultracode` occurrences, **0** have `CLAUDE_CODE_WORKFLOWS`
  within ±400 chars. They live in different code regions entirely.
- Effort-apply function (verbatim, tail truncated as captured):
  `function v6q(H,_=!1){if(!Pz())return null;if(!Qy())return" (applied locally — this remote transport can't change server effort)";return Pz()?.sendControlRequest({subtype:"apply_flag_settings",settings:{effortLevel:H??null,ult…`
  → it sends `{effortLevel, ultracode…}` to the server; **no `CLAUDE_CODE_WORKFLOWS`
  is set or read.**

**Finding.** "Tool available?" (FX5: env + server flag + tier) and "model proactively
orchestrates?" (effort=ultracode) are **independent layers**. `/effort ultracode`
selects `effortLevel=xhigh` + an `ultracode` session flag; it never flips the tool
on. The `vx()` gate in §A/§B means: *ultracode is only offered/valid when workflows
are already available* — it depends on availability, it does not provide it.
(`vx()`'s body was not isolated line-by-line, but two independent sites — the `c$O`
gate and the conditional help rendering — plus the 0/37 proximity result, pin the
behavior: ultracode rides on top of an already-available tool.)

## D. Official trigger keywords — `workflow`/`workflows`, NOT `ultrawork`

Injected system-prompt lines (verbatim):
- `user included the keyword "workflow" or "workflows", which means you should use the Workflow tool to fulfill their request.`
- `user included the keyword "ultrathink", requesting deeper reasoning on this turn. Reason as thoroughly as the task warrants.`

Full opt-in list the model is given (verbatim):

```
Explicit opt-in means one of:
- The user included the "workflow" or "workflows" keyword (you'll see a system-reminder confirming it).
- Ultracode is on (a system-reminder confirms it) — see **Ultracode** below.
- The user directly asked you to run a workflow or use multi-agent orchestration in their own words ("run a workflow", "fan out agents", "orchestrate this with subagents"). The ask must be in the user's words …
- The user invoked a skill or slash command whose i[nstructions …]
```

Standing instruction when ultracode is on (verbatim):
`Ultracode is on: optimize for the most exhaustive, correct answer — not the fastest or cheapest. Use the Workflow tool on every substantive task; token cost is not a constraint.`

### `ultrawork` — deprecated as a trigger (measured)

`ultrawork` occurs **exactly 3 times**, **all** as the internal attachment type name
`ultrawork_request` (verbatim): `…"pen_mode_enter","pen_mode_exit","ultrawork_request"].includes(H.type)…`
inside `normalizeAttachmentForAPI`. **It is not a user-typable trigger keyword.**
`"ulw"` = 0 occurrences. So: typing `ultrawork` in the prompt does **not** trigger
anything in the official 2.1.154 client; the third-party `oh-my-openagent` regex
`/\b(ultrawork|ulw)\b/i` is a *separate, non-official* system.

## E. Env override, defaults, silent downgrade

- Override resolver (verbatim):
  `function OVH(){let H=process.env.CLAUDE_CODE_EFFORT_LEVEL;return H?.toLowerCase()==="unset"||H?.toLowerCase()==="auto"?null:hx(H)}`
  → `CLAUDE_CODE_EFFORT_LEVEL` of `unset`/`auto` ⇒ no override; any other value ⇒
  forces that level for the session, overriding `/effort`.
- UI messages (verbatim): `CLAUDE_CODE_EFFORT_LEVEL=… overrides effort this session — clear it and ultracode takes over`;
  `Cleared effort from settings, but CLAUDE_CODE_EFFORT_LEVEL=… still controls this session`.
- **Persistence:** ultracode is repeatedly tagged `(this session only)` / `Session-scoped`;
  the plain levels (low…max) are written to settings (msg: `Cleared effort from settings…`).
- **Silent downgrade** (verbatim): `…"low","medium","high","xhigh","max"), after any silent downgrade` —
  a level a given model can't honor is **silently downgraded** (so picking `max` on a
  model that tops out lower yields a lower effective tier, no error).
- Startup banner (verbatim): `Opus 4.8 is here!` / `Now defaults to high effort · /effort xhigh for your hardest tasks`.

## F. Summary (each line traceable to a verbatim string above)

| Claim | Evidence (§) |
|---|---|
| `/effort` accepts `low\|medium\|high\|xhigh\|max\|ultracode\|auto` | A |
| Level enum is 5 tiers (`low…max`); `ultracode` is a preset | A |
| `ultracode` reasoning depth == `xhigh` (max is deeper) | B |
| `ultracode` = xhigh + standing workflow orchestration, **session-only** | B, E |
| Tool availability = `CLAUDE_CODE_WORKFLOWS` + server flag + tier (`FX5`) | C1 |
| Reliable enable = explicit `CLAUDE_CODE_WORKFLOWS=1`; server flag uncontrollable | C1 |
| `/effort ultracode` does **not** set/flip `CLAUDE_CODE_WORKFLOWS` (0/37 proximity) | C2 |
| ultracode only *offered/valid* when workflows already available (`vx()` gate) | A, B, C2 |
| Official trigger keyword = `workflow`/`workflows` (injects "use the Workflow tool") | D |
| `ultrawork` is only internal `ultrawork_request`; **deprecated as trigger** | D |
| Bonus keyword `ultrathink` = deeper reasoning this turn | D |
| `CLAUDE_CODE_EFFORT_LEVEL` env overrides `/effort` (unset/auto = no override) | E |
| Opus 4.8 defaults to `high`; `xhigh` recommended for hardest tasks | E |
| Effort silently downgrades on models that can't honor a tier | E |

## G. Reproduction (exact extraction code)

```javascript
const fs=require('fs');
const p='…/@anthropic-ai/claude-code/bin/claude.exe';   // 2.1.154, 214MB Mach-O arm64
const buf=fs.readFileSync(p,'latin1');
const count=kw=>{let n=0,i=0;while((i=buf.indexOf(kw,i))!==-1){n++;i+=kw.length}return n};
function ctx(kw,b,a,max){const o=new Set();let i=0;while((i=buf.indexOf(kw,i))!==-1&&o.size<max){
  o.add(buf.slice(Math.max(0,i-b),i+kw.length+a).replace(/[^\x20-\x7E]+/g,'·').trim());i+=kw.length}return[...o]}
// e.g.:
console.log(count('ultracode'));            // 37
console.log(count('xhigh'));                // 71
console.log(ctx('==="ultracode"&&',20,90,3));
console.log(ctx('Effort levels:',5,820,1));
console.log(ctx('Explicit opt-in means one of',0,520,1));
// proximity test:
let i=0,near=0;while((i=buf.indexOf('ultracode',i))!==-1){if(buf.slice(i-400,i+400).includes('CLAUDE_CODE_WORKFLOWS'))near++;i+=9}
console.log(near,'/ 37');                    // 0 / 37
```

## H. Cross-checking third-party claims against the official binary (R10 Sprint 2.1)

The third-party repo `claude-code-workflow-creator` made several claims the book had
filed as "claimed, unverified." Grepping the 2.1.154 binary **confirms** most of them:

| Third-party claim | Binary evidence (verbatim) | Verdict |
|---|---|---|
| Error class `WorkflowAgentCapError` | `class a7K extends Error{constructor(){super(KG3);this.name="WorkflowAgentCapError"}}` | ✅ exists |
| Error class `WorkflowBudgetExceededError` | `…this.name="WorkflowBudgetExceededError"` (msg `Workflow token budget exceeded`) | ✅ exists |
| 1000-agent cap message | `Workflow agent() call cap reached (…). This usually means a loop using budget.remaining()… or pass a token budget.` | ✅ exists |
| `stallMs` default 180000 | `AG3=180000`, used as `r?.stallMs!=null?Number(r.stallMs):AG3` | ✅ default = 180000 |
| stall retries ≤ 5 | `AG3=180000,i7K=5` (the `i7K=5` constant is adjacent; very likely the stall-retry cap — use-site not traced line-by-line) | ✅ likely 5 |
| concurrency lower bound `max(2, …)` | `Math.max(2,H-2)` together with `HG3(cpus().length)` | ✅ `max(2, cores−2)` |
| schema validated via AJV | `ajv` present (55×) + `StructuredOutput schema mismatch:` | ✅ AJV present |
| schema retry "up to twice" | **no such string in the binary** | ❌ unconfirmed |

**Evidence-tier note.** These are **binary-string / constant confirmations** — stronger
than a third-party claim, but **not runtime-observed** (the book did not actually trip
the 1000-agent cap, budget-exceeded, or a stall in a live run). Cite them as "confirmed
in the 2.1.154 binary," a tier distinct from "runtime-measured (Run ID)."
