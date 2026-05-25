# Appendix D · Glossary

> This appendix collects the book's core terms, **side by side in Chinese and English**, each with a one-sentence definition + chapter locator, for lookup as you read. Field semantics defer to [Appendix A · Full API Reference](#/en/app-a) as authoritative; behavioral basis is in [Appendix E · Sources](#/en/app-e).
>
> Arrangement: grouped by topic first (to build a system), roughly in order of appearance within a group; an [D.9 Alphabetical Index](#d9-alphabetical-index) at the end eases quick jumps.

---

## D.1 Top-Level Concepts

| Term (EN / 中) | Definition | Locator |
|---|---|---|
| **Workflow / 工作流** | Claude Code's multi-agent orchestration primitive: use a JS script to deterministically dispatch and chain multiple subagents. Feature nickname **ultrawork**. | [Ch. 1](#/en/p1-01) |
| **ultrawork** | One of Workflow's nicknames/trigger keywords; a message containing this word can trigger a workflow. | [Appendix A · A.10](#/en/app-a) |
| **deterministic orchestration / 确定性编排** | An orchestration style where code (not the model freestyling) decides "how many agents, in what order, how they rendezvous," distinct from pure prompt-driven. | [Ch. 2](#/en/p1-02) |
| **subagent / 子智能体** | An independent execution unit dispatched by `agent()`, with its own context and real tool permissions; its "final text is the return value." | [Ch. 1](#/en/p1-01) |
| **main loop / 主循环** | The Claude session you're conversing with; it initiates the Workflow tool call and **shares the token budget pool** with all workflows. | [Ch. 9](#/en/p2-09) |
| **CLAUDE_CODE_WORKFLOWS** | The gating environment variable; set to `1` to enable the Workflow feature. | [Appendix A · A.10](#/en/app-a) |
| **CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS** | The related experimental flag (Agent Teams); in the same experimental capability family as Workflow. | [Grounding facts table](#/en/p1-01) |
| **CLAUDE_CODE_SUBAGENT_MODEL** | A user/CI-level environment variable; once set, it **overrides every per-call `model`** (the script's `opts.model`/`phases[].model` are silently ignored). Tested set to `claude-opus-4-7[1m]` this session, 5 agents with different model options all ran Opus (Run `wf_9c94951d-58c`). | [Appendix E · R4 model-resolution record](#/en/app-e) |
| **ANTHROPIC_DEFAULT_HAIKU_MODEL / SONNET / OPUS** | User/CI-level environment variables; remap the corresponding **model alias** wholesale to a given model. Stacked with `CLAUDE_CODE_SUBAGENT_MODEL` they form a "two-layer model override" — both pointed to Opus this session, so a script's `model: 'haiku'` ran as Opus (Run `wf_e8cb23ff-829`). | [Appendix A · A.4](#/en/app-a) |

---

## D.2 Input and Output (WorkflowInput / WorkflowOutput)

| Term (EN / 中) | Definition | Locator |
|---|---|---|
| **WorkflowInput** | The input interface for calling the Workflow tool, containing `script`/`name`/`args`/`scriptPath`/`resumeFromRunId`. | [Appendix A · A.1](#/en/app-a) |
| **WorkflowOutput** | The Workflow tool's return interface (a **receipt**, not the result), containing `status`/`taskId`/`runId`, etc. | [Appendix A · A.2](#/en/app-a) |
| **script** | A self-contained script string; **must** begin with the pure literal `export const meta = {…}`. | [Appendix A · A.1](#/en/app-a) |
| **name / named workflow** | A predefined workflow name (built-in or `.claude/workflows/`), resolved into a script; often parameterized with `args`. | [Appendix A · A.1](#/en/app-a) |
| **scriptPath** | An on-disk script path; **highest priority**, landed on every call, easing Write/Edit then re-run. | [Appendix A · A.1](#/en/app-a) |
| **status** | Receipt status, **only** `"async_launched"` or `"remote_launched"`. | [Appendix A · A.2](#/en/app-a) |
| **async_launched / remote_launched** | The former is local async launch; the latter remote (CCR) launch, with no `runId`, using `sessionUrl` as the resume handle. | [Appendix A · A.2](#/en/app-a) |
| **taskId / task handle** | The background task identifier; used for tracking and stopping (TaskStop). | [Appendix A · A.2](#/en/app-a) |
| **runId / run identifier** | The local run identifier (like `wf_…`); used by `resumeFromRunId` when resuming; `remote_launched` has none. | [Appendix A · A.2](#/en/app-a) |
| **resumeFromRunId / resume** | Resume from a run: unchanged `agent()` calls return cached results (zero cost); **same session only.** | [Ch. 22](#/en/p4-22) |
| **transcriptDir** | The subagent execution-record directory (a receipt field). | [Appendix A · A.2](#/en/app-a) |
| **sessionUrl** | The CCR session URL when `remote_launched`. | [Appendix A · A.2](#/en/app-a) |
| **warning / error** | A non-blocking notice / syntax-check failure info in the receipt; `error` returns synchronously before launch, costing no tokens. | [Appendix A · A.2](#/en/app-a) |
| **&lt;task-notification&gt; / completion notification** | The message delivered when a workflow completes, containing the **actual return value** and usage statistics. | [Appendix A · A.2](#/en/app-a) |

---

## D.3 Script Metadata and Phases

| Term (EN / 中) | Definition | Locator |
|---|---|---|
| **meta** | The metadata constant the script exports, **must be a pure literal**; required `name`/`description`, optional `whenToUse`/`phases`. | [Ch. 5](#/en/p2-05) |
| **pure literal / 纯字面量** | A literal value free of variable references, function calls, spread operators, template interpolation; `meta`'s hard requirement (statically read before execution). | [Ch. 5](#/en/p2-05) |
| **phase / 阶段** | A progress group. The global `phase(title)` opens a new phase, subsequent `agent()` groups under it; the title matches `meta.phases[].title` exactly. | [Ch. 5](#/en/p2-05) |
| **phases (meta field)** | `{ title, detail?, model? }[]`, declaratively listing the workflow's phases. | [Appendix A · A.4](#/en/app-a) |
| **whenToUse** | An optional `meta` field, describing the use case, shown in the workflow list. | [Appendix A · A.4](#/en/app-a) |
| **log / progress narration** | `log(message)` outputs a line of progress narration to the user (above the progress tree). | [Ch. 9](#/en/p2-09) |
| **/workflows** | The slash command to watch a workflow's live progress. | [Appendix A · A.10](#/en/app-a) |

---

## D.4 Core Primitives: agent / parallel / pipeline

| Term (EN / 中) | Definition | Locator |
|---|---|---|
| **agent() / 派发智能体** | `agent(prompt, opts?) → Promise`: dispatch a subagent. No `schema` returns text; has `schema` returns a validated object; user skips returns `null`. | [Ch. 6](#/en/p2-06) |
| **parallel() / 并发屏障** | `parallel(thunks) → Promise<any[]>`: run **thunks** concurrently, a **barrier** waiting for all; result order = input order; async failures become `null`, while a synchronous thunk-body `throw` rejects the call. | [Ch. 8](#/en/p2-08) |
| **pipeline() / 流水线** | `pipeline(items, stage1, …) → Promise<any[]>`: each item flows **independently** through all stages, **no barrier between stages**; a stage throwing makes that item `null` and skips the rest. **Use it by default for multi-stage.** | [Ch. 8](#/en/p2-08) |
| **barrier / 屏障** | A synchronization point: must wait for a batch of tasks to **all complete** before continuing. `parallel` is a barrier; `pipeline` has **no** barrier between stages. | [Ch. 8](#/en/p2-08) |
| **pipeline (concept) / 流水线（概念）** | An execution model letting items flow **overlapping** across stages; wall clock ≈ the slowest single chain, not the sum of each stage's slowest. | [Ch. 8](#/en/p2-08) |
| **thunk** | A zero-arg function `() => Promise`, a deferred "to-do." `parallel` **must** take an array of thunks; passing Promises executes immediately, so it doesn't conform to the `parallel(thunks)` API and loses async-failure gathering semantics (async reject / agent error → `null`). | [Ch. 8](#/en/p2-08) / [Appendix B · B.4](#/en/app-b) |
| **stage / 阶段 (pipeline)** | A processing step of `pipeline`; callback signature `(prevResult, originalItem, index)`, first stage `prevResult === item`. | [Ch. 8](#/en/p2-08) |
| **prevResult / originalItem** | Stage callback parameters: the previous stage's return value / this item's original input. The latter lets later stages reference the original input without threading. | [Ch. 8](#/en/p2-08) |

---

## D.5 agent Options (opts)

| Term (EN / 中) | Definition | Locator |
|---|---|---|
| **schema / 模式** | A JSON Schema, passed as `opts.schema` to `agent()`; it forces the subagent down the structured-output channel and validates at the **tool-call layer**, returning a validated object; retries the model if it doesn't match. | [Ch. 7](#/en/p2-07) |
| **StructuredOutput tool** | A **built-in tool** on the subagent side: with a `schema`, the subagent is forced to call it to submit output, and the runtime validates against the schema at that tool-call layer, retrying on a mismatch. So `agent()` receives a **validated object** — no `JSON.parse` needed. | [Ch. 7](#/en/p2-07) |
| **structured output / 结构化输出** | A return object constrained by `schema`, its shape validated (distinct from free text). | [Ch. 7](#/en/p2-07) |
| **label / 标签** | `opts.label`, overrides the display name in `/workflows` and the transcript; a descriptive label aids locating and search. | [Ch. 6](#/en/p2-06) |
| **opts.phase** | Explicitly group this agent into a progress group; **mandatory inside parallel/pipeline** (to avoid racing the global `phase()`). | [Ch. 6](#/en/p2-06) / [Appendix B · B.12](#/en/app-b) |
| **model (opts)** | Overrides this agent's model; omitted, inherits the main loop model; simple tasks can use `'haiku'`. | [Ch. 6](#/en/p2-06) |
| **isolation: 'worktree'** | Runs this agent in an independent git worktree; **expensive**, use only when parallel file edits would collide; auto-cleaned if no changes. | [Ch. 19](#/en/p4-19) |
| **agentType** | Use a custom subagent type (e.g., `'Explore'`, `'code-reviewer'`), resolved from the same registry as the Agent tool; combinable with `schema`. **Validated**: an unknown value throws before any model is spawned (0 tokens) and lists available agents (Run `wf_a222f20f-0f5`) — in contrast to the unvalidated `model`. | [Ch. 6](#/en/p2-06) / [Appendix B · B.21](#/en/app-b) |
| **workflow-subagent** | The **default subagent type** when `agent()` specifies no `agentType`; inherits the session's file/shell/Skill/ToolSearch tools (zero `mcp__` tools by default in a deferred environment, loadable on demand via ToolSearch). Each agent's sidecar `agent-<id>.meta.json` records this type (Run `wf_1d4c6a71-56a`). | [Appendix E · R4 MCP record](#/en/app-e) |

---

## D.6 Budget and Scale

| Term (EN / 中) | Definition | Locator |
|---|---|---|
| **budget / 预算** | This turn's token budget object, containing `total`/`spent()`/`remaining()`; a **hard cap**, the pool shared by the main loop + all workflows. | [Ch. 9](#/en/p2-09) |
| **budget.total** | This turn's token target (from the user's `+500k`-style instruction); `null` means not set (then `remaining()` is `Infinity`). | [Ch. 21](#/en/p4-21) |
| **budget.spent() / remaining()** | Output tokens spent / remaining quota (`max(0, total − spent())`). | [Ch. 21](#/en/p4-21) |
| **budget guard / 预算守卫** | The pattern of proactively exiting early in a dynamic loop with `budget.total && budget.remaining() < threshold`. | [Ch. 21](#/en/p4-21) / [Appendix B · B.6](#/en/app-b) |
| **concurrency limit / 并发上限** | The cap on agents running at once per workflow: `min(16, CPU cores − 2)`, the excess queues. | [Ch. 21](#/en/p4-21) |
| **agent cap / agent 总数上限** | The hard cap on the total agents over a workflow's lifecycle, **1000** (runaway-loop fallback). | [Appendix A · A.9](#/en/app-a) |
| **script size cap / 脚本体积上限** | The per-script cap, **524288 bytes (512KB)** (the tool input-schema's `script.maxLength`). | [Appendix A · A.9](#/en/app-a) |
| **sync timeout / VM 同步超时** | The hard cap on the script's **synchronous** execution, **30000ms** — a long synchronous loop (e.g. `for(;;){}`) is aborted and the workflow `failed` (verbatim `Error: Script execution timed out after 30000ms`, measured at 30222ms, Run `wf_e3b2b123-5f4`). It **bounds only the synchronous portion**: an async workflow with `await agent()` runs for minutes fine. | [Appendix E · R4 sandbox record](#/en/app-e) |
| **WorkflowAgentCapError / WorkflowBudgetExceededError** | The error **class names** for hitting the 1000-agent cap / exhausting the budget. The official definition describes only the behavior and **gives no class names** — the names are a **community third-party claim, not independently verified by this book** (neither cap was triggered). | [Appendix E · reference readings](#/en/app-e) |
| **stallMs / stall retry** | Per a **community third-party claim**: an agent's stall default threshold of 180000ms, retried ≤5 times. **Unverified by this book** (not triggered). | [Appendix E · reference readings](#/en/app-e) |

---

## D.7 Nesting and Isolation

| Term (EN / 中) | Definition | Locator |
|---|---|---|
| **workflow() / 嵌套工作流** | `workflow(nameOrRef, args?) → Promise`: inline-run another workflow; shares the concurrency limit / agent count / abort signal / token budget. | [Ch. 20](#/en/p4-20) |
| **one-level nesting / 嵌套仅一层** | Parent→child is allowed, child→grandchild throws; prevents runaway recursion. | [Ch. 20](#/en/p4-20) |
| **worktree / git 工作树隔离** | An independent git working directory; `isolation:'worktree'` runs the agent in it, avoiding parallel file-edit collisions; the result returns the path and branch. | [Ch. 19](#/en/p4-19) |
| **isolation / 隔离** | An agent's runtime-environment isolation strategy; the current key value is `'worktree'`. | [Ch. 19](#/en/p4-19) |

---

## D.8 Usage, Patterns, and Ecosystem

| Term (EN / 中) | Definition | Locator |
|---|---|---|
| **agent_count** | A usage field in the completion notification: the total agents actually dispatched this run (a nested sub-flow's agents also count toward the parent flow). | [primitives run record](#/en/p2-08) |
| **tool_uses** | A usage field: the number of tool calls this run; 0 on a resume cache hit. | [Ch. 22](#/en/p4-22) |
| **total_tokens / duration_ms** | Usage fields: total tokens / wall-clock milliseconds. Rule of thumb: token ≈ agent count × per-agent context (about 25k–30k). | [primitives run record](#/en/p2-08) |
| **cache hit / 缓存命中** | On resume, an unchanged `agent()` call directly reuses the result (zero tokens, zero tools, about 8ms). Tested, re-running the same script + same args = a 100% hit, 0 tokens (Run `wf_9c94951d-58c` resume). | [Ch. 22](#/en/p4-22) |
| **resume cache key / resume 缓存键** | The basis for whether a given `agent()` call hits the cache. This book **verified by testing** that "same script + same args → 100% hit"; per a **community third-party claim**, the key is composed of the agent's `schema/model/isolation/agentType`, with `label`/`phase` not part of it (changing them doesn't invalidate) — the latter is **not independently verified key-by-key**, taken as a "third-party claim." | [Ch. 22](#/en/p4-22) |
| **replayability / 可重放性** | The property "same script + same input → same execution path"; the prerequisite for resume, hence `Date.now()`/`Math.random()`/arg-less `new Date()` are forbidden. | [Ch. 22](#/en/p4-22) |
| **determinism dual-layer ban / 确定性双层防护** | The two gates banning nondeterministic calls: ① a **literal** is rejected by a source static scan at **submit** time (the script doesn't run); ② an **aliased form** (`const D=Date;D.now()`) fools the scan and is then trapped and thrown at **runtime.** `try/catch` can intercept neither layer (Run `wf_59bf3654-183`). | [Ch. 22](#/en/p4-22) / [Appendix B · B.19](#/en/app-b) |
| **adversarial verification / 对抗验证** | The pattern of using an independent agent to specifically "pick holes" to expose the first version's blind spots (e.g., Generate-Critique-Fix). | [Ch. 17](#/en/p4-17) |
| **judge panel / 评委面板** | The A/B evaluation pattern where multiple independent judges score by a rubric and vote to decide the winner. | [Ch. 14](#/en/p3-14) |
| **loop-until-dry / 循环到干** | The pattern of iterating repeatedly until "no new output can be squeezed out," needing a convergence condition + round/budget guards. | [Ch. 18](#/en/p4-18) |
| **rubric / 评分量规** | Using `schema` to solidify evaluation dimensions (e.g., accuracy/clarity/completeness) into scorable fields. | [Ch. 14](#/en/p3-14) |
| **dogfooding / 吃自己的狗粮** | Using this feature to build/review the book itself (e.g., reviewing the book's frontend with Workflow). | [frontend-review run record](#/en/p3-11) |

---

## D.9 Alphabetical Index

Quick jump by the English term's first letter (Chinese aliases in the tables above):

- **A**: `agent()` ([D.4](#d4-core-primitives-agent-parallel-pipeline)), `agentType` ([D.5](#d5-agent-options-opts)), `agent_count` ([D.8](#d8-usage-patterns-and-ecosystem)), adversarial verification ([D.8](#d8-usage-patterns-and-ecosystem)), `args` ([D.2](#d2-input-and-output-workflowinput-workflowoutput)), `async_launched` ([D.2](#d2-input-and-output-workflowinput-workflowoutput)), `ANTHROPIC_DEFAULT_*_MODEL` ([D.1](#d1-top-level-concepts))
- **B**: barrier / 屏障 ([D.4](#d4-core-primitives-agent-parallel-pipeline)), `budget` ([D.6](#d6-budget-and-scale))
- **C**: cache hit ([D.8](#d8-usage-patterns-and-ecosystem)), concurrency limit ([D.6](#d6-budget-and-scale)), `CLAUDE_CODE_WORKFLOWS` ([D.1](#d1-top-level-concepts)), `CLAUDE_CODE_SUBAGENT_MODEL` ([D.1](#d1-top-level-concepts))
- **D**: deterministic orchestration ([D.1](#d1-top-level-concepts)), determinism dual-layer ban ([D.8](#d8-usage-patterns-and-ecosystem)), dogfooding ([D.8](#d8-usage-patterns-and-ecosystem)), `duration_ms` ([D.8](#d8-usage-patterns-and-ecosystem))
- **E**: `error` ([D.2](#d2-input-and-output-workflowinput-workflowoutput))
- **I**: `isolation` ([D.7](#d7-nesting-and-isolation))
- **J**: judge panel ([D.8](#d8-usage-patterns-and-ecosystem))
- **L**: `label` ([D.5](#d5-agent-options-opts)), `log` ([D.3](#d3-script-metadata-and-phases)), loop-until-dry ([D.8](#d8-usage-patterns-and-ecosystem))
- **M**: `meta` ([D.3](#d3-script-metadata-and-phases)), `model` ([D.5](#d5-agent-options-opts)), main loop ([D.1](#d1-top-level-concepts))
- **N**: `name` ([D.2](#d2-input-and-output-workflowinput-workflowoutput)), nesting ([D.7](#d7-nesting-and-isolation))
- **P**: `parallel()` ([D.4](#d4-core-primitives-agent-parallel-pipeline)), `pipeline()` ([D.4](#d4-core-primitives-agent-parallel-pipeline)), `phase` ([D.3](#d3-script-metadata-and-phases)), `prevResult` ([D.4](#d4-core-primitives-agent-parallel-pipeline)), pure literal ([D.3](#d3-script-metadata-and-phases))
- **R**: `resumeFromRunId` ([D.2](#d2-input-and-output-workflowinput-workflowoutput)), resume cache key ([D.8](#d8-usage-patterns-and-ecosystem)), `runId` ([D.2](#d2-input-and-output-workflowinput-workflowoutput)), replayability ([D.8](#d8-usage-patterns-and-ecosystem)), `remote_launched` ([D.2](#d2-input-and-output-workflowinput-workflowoutput)), rubric ([D.8](#d8-usage-patterns-and-ecosystem))
- **S**: `schema` ([D.5](#d5-agent-options-opts)), StructuredOutput tool ([D.5](#d5-agent-options-opts)), `script` / `scriptPath` ([D.2](#d2-input-and-output-workflowinput-workflowoutput)), script size cap ([D.6](#d6-budget-and-scale)), stage ([D.4](#d4-core-primitives-agent-parallel-pipeline)), `stallMs` ([D.6](#d6-budget-and-scale)), `status` ([D.2](#d2-input-and-output-workflowinput-workflowoutput)), subagent ([D.1](#d1-top-level-concepts)), `sessionUrl` ([D.2](#d2-input-and-output-workflowinput-workflowoutput)), sync timeout ([D.6](#d6-budget-and-scale))
- **T**: `taskId` ([D.2](#d2-input-and-output-workflowinput-workflowoutput)), `<task-notification>` ([D.2](#d2-input-and-output-workflowinput-workflowoutput)), thunk ([D.4](#d4-core-primitives-agent-parallel-pipeline)), `tool_uses` / `total_tokens` ([D.8](#d8-usage-patterns-and-ecosystem)), `transcriptDir` ([D.2](#d2-input-and-output-workflowinput-workflowoutput))
- **U**: ultrawork ([D.1](#d1-top-level-concepts))
- **V**: VM sync timeout ([D.6](#d6-budget-and-scale))
- **W**: Workflow ([D.1](#d1-top-level-concepts)), `workflow()` ([D.7](#d7-nesting-and-isolation)), workflow-subagent ([D.5](#d5-agent-options-opts)), `WorkflowInput` / `WorkflowOutput` ([D.2](#d2-input-and-output-workflowinput-workflowoutput)), `WorkflowAgentCapError` / `WorkflowBudgetExceededError` ([D.6](#d6-budget-and-scale)), `whenToUse` ([D.3](#d3-script-metadata-and-phases)), worktree ([D.7](#d7-nesting-and-isolation)), warning ([D.2](#d2-input-and-output-workflowinput-workflowoutput))

> Companion reading: for field semantics see [Appendix A · Full API Reference](#/en/app-a); for pitfalls and troubleshooting see [Appendix B · Pitfalls & Troubleshooting](#/en/app-b); for the positive checklist see [Appendix C · Best Practices](#/en/app-c).

> Continue reading: [Appendix E · Sources](#/en/app-e)
