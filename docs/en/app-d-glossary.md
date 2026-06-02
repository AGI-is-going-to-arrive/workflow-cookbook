# Appendix D · Glossary

> This appendix gathers the book's core terms, **side by side in Chinese and English**, each with a one-sentence definition + chapter locator, so you can look them up as you read. Field semantics defer to [Appendix A · Full API Reference](#/en/app-a) as authoritative; the behavioral basis is in [Appendix E · Sources](#/en/app-e).
>
> How it's arranged: grouped by topic first (to build up a system), roughly in order of appearance within a group; an [D.9 Alphabetical Index](#d9-alphabetical-index) at the end makes quick jumps easy.

---

## D.1 Top-Level Concepts

| Term (EN / 中) | Definition | Locator |
|---|---|---|
| **Workflow / 工作流** | Claude Code's multi-agent orchestration primitive: use a JS script to deterministically dispatch and chain multiple subagents. | [Ch. 1](#/en/p1-01) |
| **`ultracode` (trigger keyword)** | Drop this word into a message and Claude gets a system reminder that "you should use the Workflow tool"; it's the official trigger keyword as of 2.1.160 (previously `workflow`/`workflows`, which no longer triggers). | [Ch. 1 · §1.5](#/en/p1-01) |
| **ultrawork (deprecated as a trigger)** | An early community nickname; in the official 2.1.154 binary it exists **only as the internal event name** `ultrawork_request`, and typing it as a user **no longer triggers** anything. To trigger, use `ultracode` instead. (The third-party oh-my-openagent still uses it as an entry word, unrelated to official Claude Code.) | [Appendix A · A.12](#/en/app-a) |
| **`/effort`** | A slash command that sets how hard Claude tries for the current session: seven settings `low/medium/high/xhigh/max/ultracode/auto`. Opus 4.8 defaults to `high`. | [Ch. 1 · §1.6](#/en/p1-01) |
| **ultracode** | One `/effort` setting = **xhigh reasoning + proactive workflow orchestration by default (this session only)**. Shallower than `max` on reasoning depth, but it wins on "orchestrating with more agents by default." It only appears in `/effort` when workflows are available. | [Ch. 1 · §1.6](#/en/p1-01) |
| **ultrathink** | A keyword with the same mechanism as `ultracode`: drop it into a message to make Claude "reason more deeply this turn," with no bearing on workflow orchestration. | [Ch. 1 · §1.6](#/en/p1-01) |
| **CLAUDE_CODE_EFFORT_LEVEL** | An environment variable that **force-overrides** `/effort`'s session choice (no override when the value is `unset`/`auto`). | [Ch. 1 · §1.6](#/en/p1-01) |
| **deterministic orchestration / 确定性编排** | An orchestration style where code (not the model freestyling) decides "how many agents, in what order, how they rendezvous," distinct from pure prompt-driven. | [Ch. 2](#/en/p1-02) |
| **subagent / 子智能体** | An independent unit of work that `agent()` sends out, with its own context and real tool permissions; its "final chunk of text is the return value." | [Ch. 1](#/en/p1-01) |
| **main loop / 主循环** | The Claude session you're talking to; it's the one that fires off the Workflow tool call, and it **shares one token budget pool** with all the workflows. | [Ch. 9](#/en/p2-09) |
| **CLAUDE_CODE_WORKFLOWS** | The **underlying** environment variable for the **available** layer. The official user-facing way to enable it is the "Dynamic workflows" row in `/config` (mandatory for Pro); this flag is a power-user's explicit switch: `1` makes it available (still subject to the server-side flag, default true), `0` forces off, unset follows the server-side flag `tengu_workflows_enabled` (defaults on unless Anthropic gates it off). It does not replace `/config`, so check the toggle in your own `/config` for whether your plan defaults on. | [Appendix A · A.12](#/en/app-a) |
| **CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS** | The related experimental flag (Agent Teams); in the same experimental capability family as Workflow. | [Grounding facts table](#/en/p1-01) |
| **CLAUDE_CODE_SUBAGENT_MODEL** | A user/CI-level environment variable; the moment it's set, it **overrides every per-call `model`** (the script's `opts.model`/`phases[].model` get silently ignored). In the early session that ran this probe (Run `wf_9c94951d-58c`) it was set to `claude-opus-4-7[1m]`, and 5 agents with different model options all ran Opus; the R11 re-verification session has it as `claude-opus-4-8[1m]` (the override conclusion is model-independent). | [Appendix E · R4 model-resolution record](#/en/app-e) |
| **ANTHROPIC_DEFAULT_HAIKU_MODEL / SONNET / OPUS** | User/CI-level environment variables; they remap the corresponding **model alias** wholesale to a model you pick. Stack them with `CLAUDE_CODE_SUBAGENT_MODEL` and you get a "two-layer model override": both pointed to Opus this session, so a script's `model: 'haiku'` ran as Opus (Run `wf_e8cb23ff-829`). | [Appendix A · A.4](#/en/app-a) |

---

## D.2 Input and Output (WorkflowInput / WorkflowOutput)

| Term (EN / 中) | Definition | Locator |
|---|---|---|
| **WorkflowInput** | The input interface you pass in when calling the Workflow tool, containing `script`/`name`/`args`/`scriptPath`/`resumeFromRunId`. | [Appendix A · A.1](#/en/app-a) |
| **WorkflowOutput** | The interface the Workflow tool hands back (a **receipt**, not the result), containing `status`/`taskId`/`runId`, etc. | [Appendix A · A.2](#/en/app-a) |
| **script** | A self-contained script string; it **must** begin with the pure literal `export const meta = {…}`. | [Appendix A · A.1](#/en/app-a) |
| **name / named workflow** | A predefined workflow name (built-in, or under `.claude/workflows/`), resolved into a script; often parameterized with `args`. | [Appendix A · A.1](#/en/app-a) |
| **scriptPath** | An on-disk script path; **highest priority**, landed on every call, so you can Write/Edit it and re-run. | [Appendix A · A.1](#/en/app-a) |
| **status** | The receipt's status, **only** `"async_launched"` or `"remote_launched"`. | [Appendix A · A.2](#/en/app-a) |
| **async_launched / remote_launched** | The former is a local async launch; the latter a remote (CCR) launch, with no `runId`, using `sessionUrl` as the resume handle. | [Appendix A · A.2](#/en/app-a) |
| **taskId / task handle** | The background task's identifier; you use it to track and stop the task (TaskStop). | [Appendix A · A.2](#/en/app-a) |
| **runId / run identifier** | The local run's identifier (looks like `wf_…`); `resumeFromRunId` needs it when resuming; `remote_launched` has none. | [Appendix A · A.2](#/en/app-a) |
| **resumeFromRunId / resume** | Pick up from a run: unchanged `agent()` calls just hand back cached results (zero cost); **same session only.** | [Ch. 22](#/en/p4-22) |
| **transcriptDir** | The directory holding the subagent's execution records (a receipt field). | [Appendix A · A.2](#/en/app-a) |
| **sessionUrl** | The CCR session URL you get when `remote_launched`. | [Appendix A · A.2](#/en/app-a) |
| **warning / error** | A non-blocking notice / syntax-check failure info in the receipt; `error` comes back synchronously before launch, costing no tokens. | [Appendix A · A.2](#/en/app-a) |
| **&lt;task-notification&gt; / completion notification** | The message that arrives when a workflow finishes, carrying the **actual return value** and usage statistics. | [Appendix A · A.2](#/en/app-a) |

---

## D.3 Script Metadata and Phases

| Term (EN / 中) | Definition | Locator |
|---|---|---|
| **meta** | The metadata constant the script exports, which **must be a pure literal**; `name`/`description` required, `whenToUse`/`phases` optional. | [Ch. 5](#/en/p2-05) |
| **pure literal / 静态字面量** | A literal value with no variable references, function calls, spread operators, or template interpolation; it's `meta`'s hard requirement (since it gets read statically before execution). | [Ch. 5](#/en/p2-05) |
| **phase / 阶段** | A progress group. The global `phase(title)` opens a new phase, and the `agent()` calls after it all group under it; the title has to match `meta.phases[].title` exactly. | [Ch. 5](#/en/p2-05) |
| **phases (meta field)** | `{ title, detail?, model? }[]`, which lists the workflow's phases declaratively. | [Appendix A · A.4](#/en/app-a) |
| **whenToUse** | An optional `meta` field that spells out when to use it, shown in the workflow list. | [Appendix A · A.4](#/en/app-a) |
| **log / progress narration** | `log(message)` prints a line of progress narration to the user (above the progress tree). | [Ch. 9](#/en/p2-09) |
| **/workflows** | The slash command for watching a workflow's live progress. | [Appendix A · A.12](#/en/app-a) |

---

## D.4 Core Primitives: agent / parallel / pipeline

| Term (EN / 中) | Definition | Locator |
|---|---|---|
| **agent() / 派发智能体** | `agent(prompt, opts?) → Promise`: send out a subagent. No `schema` and it returns text; with a `schema` it returns a validated object; if the user skips it returns `null`. | [Ch. 6](#/en/p2-06) |
| **parallel() / 并发屏障** | `parallel(thunks) → Promise<any[]>`: run **thunks** concurrently. It's a **barrier**, waiting for them all; result order = input order; async failures turn into `null`, while a synchronous thunk-body `throw` rejects the call. | [Ch. 8](#/en/p2-08) |
| **pipeline() / 流水线** | `pipeline(items, stage1, …) → Promise<any[]>`: each item flows **independently** through all stages, with **no barrier between stages**; a stage throwing turns that item into `null` and skips the rest. **Use it by default for multi-stage.** | [Ch. 8](#/en/p2-08) |
| **barrier / 屏障** | A synchronization point: it must wait for a batch of tasks to **all complete** before moving on. `parallel` is a barrier; `pipeline` has **no** barrier between stages. | [Ch. 8](#/en/p2-08) |
| **pipeline (concept) / 流水线（概念）** | An execution model that lets items flow **overlapping** across stages; wall clock ≈ the slowest single chain, not the sum of each stage's slowest. | [Ch. 8](#/en/p2-08) |
| **thunk** | A zero-arg function `() => Promise`, basically a deferred "to-do." `parallel` **must** take an array of thunks; if you pass Promises they execute immediately, so it doesn't conform to the `parallel(thunks)` API and loses async-failure gathering semantics (async reject / agent error → `null`). | [Ch. 8](#/en/p2-08) / [Appendix B · B.4](#/en/app-b) |
| **stage / 阶段 (pipeline)** | A single processing step of `pipeline`; callback signature `(prevResult, originalItem, index)`, and in the first stage `prevResult === item`. | [Ch. 8](#/en/p2-08) |
| **prevResult / originalItem** | The stage callback's parameters: the previous stage's return value / this item's original input. The latter lets later stages reach the original input without threading it through. | [Ch. 8](#/en/p2-08) |

---

## D.5 agent Options (opts)

| Term (EN / 中) | Definition | Locator |
|---|---|---|
| **schema / 模式** | A JSON Schema, passed as `opts.schema` to `agent()`; it forces the subagent down the structured-output channel and validates at the **tool-call layer**, returning a validated object; if it doesn't match, the model retries. | [Ch. 7](#/en/p2-07) |
| **StructuredOutput tool** | A **built-in tool** on the subagent side: with a `schema`, the subagent is forced to call it to hand in output, and the runtime validates against the schema right at that tool-call layer, retrying on a mismatch. So what `agent()` gets back is a **validated object**, with no `JSON.parse` needed. | [Ch. 7](#/en/p2-07) |
| **structured output / 结构化输出** | A return object that `schema` constrains, with its shape validated (not the same thing as free text). | [Ch. 7](#/en/p2-07) |
| **label / 标签** | `opts.label`, which overrides the display name in `/workflows` and the transcript; a descriptive label makes it easier to locate and search. | [Ch. 6](#/en/p2-06) |
| **opts.phase** | Explicitly put this agent into a progress group; **mandatory inside parallel/pipeline** (otherwise it races the global `phase()`). | [Ch. 6](#/en/p2-06) / [Appendix B · B.12](#/en/app-b) |
| **model (opts)** | Overrides the model this agent uses; leave it off and it inherits the main loop's model; simple tasks can use `'haiku'`. | [Ch. 6](#/en/p2-06) |
| **isolation: 'worktree'** | Runs this agent in its own git worktree; **expensive**, so use it only when parallel file edits would collide. The tool contract says it's auto-cleaned when there are no changes, though this book hasn't verified the exact cleanup timing. | [Ch. 19](#/en/p4-19) |
| **agentType** | Use a custom subagent type (e.g., `'Explore'`, `'code-reviewer'`), resolved from the same registry as the Agent tool; you can combine it with `schema`. **Validated**: feed it an unknown value and it throws before any model is spawned (0 tokens), listing the available agents (Run `wf_a222f20f-0f5`), quite the contrast with the unvalidated `model`. | [Ch. 6](#/en/p2-06) / [Appendix B · B.21](#/en/app-b) |
| **workflow-subagent** | The **default subagent type** when `agent()` specifies no `agentType`; it inherits the session's file/shell/Skill/ToolSearch tools (zero `mcp__` tools by default in a deferred environment, loadable on demand via ToolSearch). Each agent's sidecar `agent-<id>.meta.json` records this type (Run `wf_1d4c6a71-56a`). | [Appendix E · R4 MCP record](#/en/app-e) |

---

## D.6 Budget and Scale

| Term (EN / 中) | Definition | Locator |
|---|---|---|
| **budget / 预算** | This turn's token budget object, containing `total`/`spent()`/`remaining()`; it's a **hard cap**, and the pool is shared by the main loop + all workflows. | [Ch. 9](#/en/p2-09) |
| **budget.total** | This turn's token target (from the user's `+500k`-style instruction); `null` means it's not set (and then `remaining()` is `Infinity`). | [Ch. 21](#/en/p4-21) |
| **budget.spent() / remaining()** | Output tokens already spent / the quota left (`max(0, total − spent())`). | [Ch. 21](#/en/p4-21) |
| **budget guard / 预算守卫** | The pattern of bailing out early on purpose inside a dynamic loop with `budget.total && budget.remaining() < threshold`. | [Ch. 21](#/en/p4-21) / [Appendix B · B.6](#/en/app-b) |
| **concurrency limit / 并发上限** | The cap on how many agents run at once per workflow: `min(16, CPU cores − 2)`, and the excess queues up. | [Ch. 21](#/en/p4-21) |
| **agent cap / agent 总数上限** | The hard cap on the total agents over a workflow's whole lifecycle, **1000** (a runaway-loop fallback). | [Appendix A · A.9](#/en/app-a) |
| **script size cap / 脚本体积上限** | The per-script cap, **524288 bytes (512KB)** (the tool input-schema's `script.maxLength`). | [Appendix A · A.9](#/en/app-a) |
| **sync timeout / VM 同步超时** | The hard cap on the script's **synchronous** execution, **30000ms**: a long synchronous loop (e.g. `for(;;){}`) gets aborted and the workflow `failed` (verbatim `Error: Script execution timed out after 30000ms`, measured at 30222ms, Run `wf_e3b2b123-5f4`). It **bounds only the synchronous portion**, so an async workflow with `await agent()` runs for minutes just fine. | [Appendix E · R4 sandbox record](#/en/app-e) |
| **WorkflowAgentCapError / WorkflowBudgetExceededError** | The error **class names** thrown on hitting the 1000-agent cap / exhausting the budget. The official definition only describes the behavior and **gives no class names**, but this book has **confirmed both names via R10 binary inspection** (`effort-ultracode-r10.md §H`); what stays unverified is only the in-flight-agent disposition at the moment it throws. | [Appendix E · reference readings](#/en/app-e) |
| **stallMs / stall retry** | Per a **community third-party claim**: an agent's stall default threshold is 180000ms, retried ≤5 times. **Unverified by this book** (not triggered). | [Appendix E · reference readings](#/en/app-e) |

---

## D.7 Nesting and Isolation

| Term (EN / 中) | Definition | Locator |
|---|---|---|
| **workflow() / 嵌套工作流** | `workflow(nameOrRef, args?) → Promise`: run another workflow inline; the concurrency limit / agent count / abort signal / token budget are all shared. | [Ch. 20](#/en/p4-20) |
| **one-level nesting / 嵌套仅一层** | Parent→child is allowed, child→grandchild throws; this prevents runaway recursion. | [Ch. 20](#/en/p4-20) |
| **worktree / git 工作树隔离** | An independent git working directory; `isolation:'worktree'` runs the agent in it, keeping parallel file edits from colliding; the tool-result envelope reports the path and branch (the script-side `agent()` return is the agent's normal output, not a `{path, branch}` object; see A.5). | [Ch. 19](#/en/p4-19) |
| **isolation / 隔离** | An agent's runtime-environment isolation strategy; right now the key value is `'worktree'`. | [Ch. 19](#/en/p4-19) |

---

## D.8 Usage, Patterns, and Ecosystem

| Term (EN / 中) | Definition | Locator |
|---|---|---|
| **agent_count** | A usage field in the completion notification: the total agents actually sent out this run (a nested sub-flow's agents count toward the parent flow too). | [primitives run record](#/en/p2-08) |
| **tool_uses** | A usage field: how many tool calls this run made; 0 on a resume cache hit. | [Ch. 22](#/en/p4-22) |
| **total_tokens / duration_ms** | Usage fields: total tokens / wall-clock milliseconds. Rule of thumb: token ≈ agent count × per-agent context (about 25k–30k). | [primitives run record](#/en/p2-08) |
| **cache hit / 缓存命中** | On resume, an unchanged `agent()` call just reuses the result outright (zero tokens, zero tools, about 8ms). Tested: re-running the same script + same args = a 100% hit, 0 tokens (Run `wf_9c94951d-58c` resume). | [Ch. 22](#/en/p4-22) |
| **resume cache key / resume 缓存键** | What decides whether a given `agent()` call hits the cache. This book **verified by testing**: "same script + same args → 100% hit" (`wf_9c94951d-58c`); and R8 isolated **`label` not in the key, `prompt` in the key** (`wf_4ffde230-535`: changing label → 0-token full hit, changing prompt → 91,044 re-runs as 60,702 ≈ 2/3). Whether `schema/model/isolation/agentType` are in the key, and whether `phase` is not, is per a **community third-party claim**, **not independently verified key-by-key by this book.** | [Ch. 22](#/en/p4-22) |
| **replayability / 可重放性** | The property "same script + same input → same execution path"; it's the prerequisite for resume, which is why `Date.now()`/`Math.random()`/arg-less `new Date()` are forbidden. | [Ch. 22](#/en/p4-22) |
| **determinism dual-layer ban / 确定性双层防护** | The two gates that block nondeterministic calls: ① a **literal** gets rejected by a source static scan at **submit** time (the script doesn't run); ② an **aliased form** (`const D=Date;D.now()`) fools the scan, then gets trapped and thrown at **runtime.** `try/catch` can't intercept layer ① (rejected at submit, the script never runs); layer ②, the runtime trap, **is** catchable, but don't rely on it (Run `wf_59bf3654-183`). | [Ch. 22](#/en/p4-22) / [Appendix B · B.19](#/en/app-b) |
| **adversarial verification / 对抗验证** | The pattern of sending in an independent agent just to "pick holes" and expose the first version's blind spots (e.g., Generate-Critique-Fix). | [Ch. 17](#/en/p4-17) |
| **judge panel / 评委面板** | The A/B evaluation pattern where several independent judges score by a rubric and vote to decide the winner. | [Ch. 14](#/en/p3-14) |
| **loop-until-dry / 循环到干** | The pattern of iterating over and over until "no new output can be squeezed out," which needs a convergence condition + round/budget guards. | [Ch. 18](#/en/p4-18) |
| **rubric / 评分量规** | Using `schema` to lock evaluation dimensions (e.g., accuracy/clarity/completeness) into scorable fields. | [Ch. 14](#/en/p3-14) |
| **dogfooding / 吃自己的狗粮** | Using this feature to build/review the book itself (e.g., reviewing the book's frontend with Workflow). | [frontend-review run record](#/en/p3-11) |

---

## D.9 Alphabetical Index

Jump quickly by the English term's first letter (Chinese aliases are in the tables above):

- **A**: `agent()` ([D.4](#d4-core-primitives-agent-parallel-pipeline)), `agentType` ([D.5](#d5-agent-options-opts)), `agent_count` ([D.8](#d8-usage-patterns-and-ecosystem)), adversarial verification ([D.8](#d8-usage-patterns-and-ecosystem)), `args` ([D.2](#d2-input-and-output-workflowinput-workflowoutput)), `async_launched` ([D.2](#d2-input-and-output-workflowinput-workflowoutput)), `ANTHROPIC_DEFAULT_*_MODEL` ([D.1](#d1-top-level-concepts))
- **B**: barrier / 屏障 ([D.4](#d4-core-primitives-agent-parallel-pipeline)), `budget` ([D.6](#d6-budget-and-scale))
- **C**: cache hit ([D.8](#d8-usage-patterns-and-ecosystem)), concurrency limit ([D.6](#d6-budget-and-scale)), `CLAUDE_CODE_WORKFLOWS` ([D.1](#d1-top-level-concepts)), `CLAUDE_CODE_SUBAGENT_MODEL` ([D.1](#d1-top-level-concepts)), `CLAUDE_CODE_EFFORT_LEVEL` ([D.1](#d1-top-level-concepts))
- **D**: deterministic orchestration ([D.1](#d1-top-level-concepts)), determinism dual-layer ban ([D.8](#d8-usage-patterns-and-ecosystem)), dogfooding ([D.8](#d8-usage-patterns-and-ecosystem)), `duration_ms` ([D.8](#d8-usage-patterns-and-ecosystem))
- **E**: `error` ([D.2](#d2-input-and-output-workflowinput-workflowoutput)), `/effort` ([D.1](#d1-top-level-concepts)), effort levels ([D.1](#d1-top-level-concepts))
- **I**: `isolation` ([D.7](#d7-nesting-and-isolation))
- **J**: judge panel ([D.8](#d8-usage-patterns-and-ecosystem))
- **L**: `label` ([D.5](#d5-agent-options-opts)), `log` ([D.3](#d3-script-metadata-and-phases)), loop-until-dry ([D.8](#d8-usage-patterns-and-ecosystem))
- **M**: `meta` ([D.3](#d3-script-metadata-and-phases)), `model` ([D.5](#d5-agent-options-opts)), main loop ([D.1](#d1-top-level-concepts))
- **N**: `name` ([D.2](#d2-input-and-output-workflowinput-workflowoutput)), nesting ([D.7](#d7-nesting-and-isolation))
- **P**: `parallel()` ([D.4](#d4-core-primitives-agent-parallel-pipeline)), `pipeline()` ([D.4](#d4-core-primitives-agent-parallel-pipeline)), `phase` ([D.3](#d3-script-metadata-and-phases)), `prevResult` ([D.4](#d4-core-primitives-agent-parallel-pipeline)), pure literal ([D.3](#d3-script-metadata-and-phases))
- **R**: `resumeFromRunId` ([D.2](#d2-input-and-output-workflowinput-workflowoutput)), resume cache key ([D.8](#d8-usage-patterns-and-ecosystem)), `runId` ([D.2](#d2-input-and-output-workflowinput-workflowoutput)), replayability ([D.8](#d8-usage-patterns-and-ecosystem)), `remote_launched` ([D.2](#d2-input-and-output-workflowinput-workflowoutput)), rubric ([D.8](#d8-usage-patterns-and-ecosystem))
- **S**: `schema` ([D.5](#d5-agent-options-opts)), StructuredOutput tool ([D.5](#d5-agent-options-opts)), `script` / `scriptPath` ([D.2](#d2-input-and-output-workflowinput-workflowoutput)), script size cap ([D.6](#d6-budget-and-scale)), stage ([D.4](#d4-core-primitives-agent-parallel-pipeline)), `stallMs` ([D.6](#d6-budget-and-scale)), `status` ([D.2](#d2-input-and-output-workflowinput-workflowoutput)), subagent ([D.1](#d1-top-level-concepts)), `sessionUrl` ([D.2](#d2-input-and-output-workflowinput-workflowoutput)), sync timeout ([D.6](#d6-budget-and-scale))
- **T**: `taskId` ([D.2](#d2-input-and-output-workflowinput-workflowoutput)), `<task-notification>` ([D.2](#d2-input-and-output-workflowinput-workflowoutput)), thunk ([D.4](#d4-core-primitives-agent-parallel-pipeline)), `tool_uses` / `total_tokens` ([D.8](#d8-usage-patterns-and-ecosystem)), `transcriptDir` ([D.2](#d2-input-and-output-workflowinput-workflowoutput))
- **U**: ultracode ([D.1](#d1-top-level-concepts)), ultrathink ([D.1](#d1-top-level-concepts)), ultrawork (deprecated as a trigger, [D.1](#d1-top-level-concepts))
- **V**: VM sync timeout ([D.6](#d6-budget-and-scale))
- **W**: Workflow ([D.1](#d1-top-level-concepts)), `workflow` (old trigger keyword, renamed to `ultracode` in 2.1.160, [D.1](#d1-top-level-concepts)), `workflow()` ([D.7](#d7-nesting-and-isolation)), workflow-subagent ([D.5](#d5-agent-options-opts)), `WorkflowInput` / `WorkflowOutput` ([D.2](#d2-input-and-output-workflowinput-workflowoutput)), `WorkflowAgentCapError` / `WorkflowBudgetExceededError` ([D.6](#d6-budget-and-scale)), `whenToUse` ([D.3](#d3-script-metadata-and-phases)), worktree ([D.7](#d7-nesting-and-isolation)), warning ([D.2](#d2-input-and-output-workflowinput-workflowoutput))

> Companion reading: for field semantics see [Appendix A · Full API Reference](#/en/app-a); for pitfalls and troubleshooting see [Appendix B · Pitfalls & Troubleshooting](#/en/app-b); for the recommended-practices checklist see [Appendix C · Recommended Practices](#/en/app-c).

> Continue reading: [Appendix E · Sources](#/en/app-e)
