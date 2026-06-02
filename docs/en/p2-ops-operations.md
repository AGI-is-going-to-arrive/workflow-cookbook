# The Official Control Panel: Driving a Run from the Terminal

> The previous chapters covered *writing* a workflow script. This chapter changes perspective: the script is already running, and **the focus is on terminal operations -- which keys to press and what actions are available.** From triggering, approving, and watching, to pausing, resuming, and stopping, to saving a run as a command, plus the one workflow that ships with Claude Code. All operator-facing surface.
>
> This chapter covers the command-line operating surface of the official Dynamic workflows (source: `code.claude.com/docs/en/workflows`). It's currently a **research preview**. The UX, prompt wording, and key bindings below may evolve across versions, so when you read this, trust what your build of Claude Code actually does.

---

## 1 Triggering: How to Get a Workflow Running

No specific commands need to be memorized. **Describe the intent in the conversation.** The official surface provides the following entry points:

**1. Keyword trigger.** When a message contains the word `ultracode`, Claude Code **highlights it in violet**, indicating it will generate a workflow script. Claude then switches to orchestrating with a script instead of proceeding turn by turn.

For example, you type:

```text
ultracode sweep every TODO in this repo and group them by theme
```

"ultracode" gets highlighted in violet, and Claude proceeds to write the script for you and hand it to the runtime.

<div class="callout tip">

**Triggered it by accident? Press `alt+w`.** Sometimes you're just discussing the word `ultracode` itself (say, explaining how it works), not intending to run one. The keyword gets highlighted and Claude prepares to write a script. Press **`alt+w`** to **dismiss the trigger for this turn**, letting Claude treat it as an ordinary message. This is a "skip this time" shortcut.

</div>

**2. `/effort ultracode`: let Claude orchestrate proactively by default.** To have Claude **autonomously decide** when to use a workflow, type `/effort ultracode` once. This is a one-time setting that persists for the entire session, after which Claude can launch multiple workflows within a single request (understand, then change, then verify). This mode consumes more tokens; return to normal with `/effort high`. The full story of triggering and enablement is in Chapter 01 SS1.5 / SS1.6 (see [p1-01](#/en/p1-01)).

The three entry points compared:

| Entry point | What you do | Good for |
|---|---|---|
| Keyword `ultracode` | Naturally include the word in your message | Explicitly running a workflow this once |
| `alt+w` | Press it when triggered by accident | Only mentioned it, no intent to run now |
| `/effort ultracode` | Type it once, stays on all session | Wanting Claude to orchestrate proactively by default |

> The full flow of getting your first workflow running (from confirming the environment to reading the receipt) is walked through step by step in [p2-04](#/en/p2-04). This chapter assumes you can already get one running and focuses on driving it once it's live.

---

## 2 Pre-Run Approval: The Script Comes In, You Get Asked First

Right **before** Claude's finished script actually starts, Claude Code pops a **pre-run approval** prompt and puts the decision in your hands. The prompt typically offers these 4 options (the exact wording shifts with your permission mode):

| Option | Meaning |
|---|---|
| **Yes, run it** | Run it just this once. |
| **Yes, and don't ask again for `<name>` in `<path>`** | Run it, and trust it: **stop asking about this workflow in this project (`<path>`) going forward**. |
| **View raw script** | Don't run yet. **Pull up the raw script and read it first**, then decide. |
| **No** | Cancel; don't run. |

Two key bindings live on this prompt. **`Tab` cycles through the options**, so you can pick without arrow keys. **`Ctrl+G` opens the raw script in your editor**: the same thing `View raw script` shows, but in your `$EDITOR`, where you can scroll and search comfortably instead of reading it inline.

<div class="callout tip">

**Recommended habit: when in doubt, select `View raw script` first.** A workflow script fans out dozens or hundreds of subagents, specifying who gets dispatched, what operations they perform, and which files they modify. The first time a given script runs, or when it involves important files, select **View raw script** and read through it. Confirm the orchestration logic matches expectations, then go back and choose Yes. This step costs almost nothing but prevents "unexpected operations" surprises.

</div>

<div class="callout info">

**"Don't ask again" remembers "this workflow, in this project."** After you pick the second option, the no-approval scope is the `<name>` + `<path>` pair: **this named workflow, in the current project**. Switch projects or switch workflows and it asks again. It means "I trust this flow in this project," and it won't widen into "never ask me about any workflow again."

</div>

---

## 3 Permission Modes: When the Prompt Appears, and What Subagents Are Allowed to Do

Whether the approval prompt from Section 2 appears, and how often, is governed by the session's **permission mode**. Two separate questions are involved, and conflating them is a common mistake: (1) does the *workflow run itself* require approval, and (2) what are the *subagents the workflow spawns* allowed to do once running. They follow different rules.

**The run-level prompt, by permission mode.** When the pre-run approval appears:

| Permission mode | Pre-run approval behavior |
|---|---|
| **Default** / **acceptEdits** | Prompted **every run**. The exception: you previously picked "don't ask again for `<name>` in `<path>`", and then that specific workflow runs without asking in that project. |
| **Auto** | Prompted only on the **first launch**; any **Yes** records your consent in user settings, so subsequent runs go straight through. Under **`/effort ultracode`**, the prompt is **skipped entirely** (ultracode is the proactive-orchestration mode, so it doesn't stop to ask). |
| **Bypass** / `claude -p` (print mode) / **Agent SDK** | **Never prompted.** These are non-interactive or trust-the-caller contexts, so the run starts without an approval gate. |

<div class="callout warn">

**Subagents always run in `acceptEdits`, regardless of session mode.** This is the most commonly misunderstood point. Regardless of the current mode, **the subagents a workflow spawns always run in `acceptEdits` mode and inherit the tool allowlist.** Concretely: their **file edits are auto-approved** (a subagent writing/reading/deleting a file does not prompt for confirmation), but **non-allowlisted shell commands, web access, or MCP calls can still prompt mid-run**.

This book confirmed the file-edit half first-hand: in Run `wf_b1d45b4c-445`, a subagent created a file with Write, read it back with Read, then deleted it with Bash `rm`. The file write went through with **no approval prompt**, matching the official "subagents run acceptEdits, file edits auto-approved" contract.

The two prompts therefore control different things: the run-level prompt (Section 2) controls *whether to launch the workflow*, while the allowlist-plus-acceptEdits behavior controls *what the dispatched agents may do without further confirmation.* To prevent a subagent's shell/web/MCP actions from interrupting the run, add those tools to the allowlist before launching.

</div>

**In the Desktop app, the prompt is a card, not a key menu.** If you run a workflow from the Claude Desktop app rather than the terminal, the pre-run approval shows up as an **approval card** listing the **workflow name** and its **phase list**, with a **caution about token usage** (a reminder that a workflow can fan out to many agents). The card's buttons are **Once / Always / Deny** (the Desktop equivalents of "run this once / don't ask again / cancel"). Once it's running, you watch progress in the **Background tasks** side pane, the Desktop counterpart to the terminal's `/workflows` view.

---

## 4 Watching a Run: `/workflows` and the Task Panel

Once a run is live, two observation windows are available.

**Entry one: the slash command `/workflows`.** Type `/workflows`, use the arrow keys to select the target run, and press `Enter` to enter the **progress view**. This view is organized by **phase**, and each phase shows: the number of agents dispatched, total tokens spent, and elapsed time. Further **drill-in** is available: into a phase, then into a specific agent, to see its prompt, recent tool calls, and returned result.

**Entry two: the task panel below the input box.** No command needed. Below the input box is a task panel showing current progress on a **single line**. For more detail, press `down-arrow` to move focus there, then `Enter` to expand. This serves as a glanceable progress bar.

The key bindings inside the `/workflows` view (per the official docs):

| Key | What it does |
|---|---|
| `up` / `down` | Move up/down through the phase list, or the agent list within a phase. |
| `Enter` or `right` | Drill in for more detail: into a phase, then into an agent, to see its prompt, recent tool calls, and result. |
| `Esc` | Go back up one level. |
| `j` / `k` | When an agent's detail is too long to fit on one screen, scroll with these two. |
| `p` | **Pause / resume** the run (see Section 5). |
| `x` | **Stop** the selected agent; if focus is on the run as a whole, stop the **entire workflow**. |
| `r` | **Restart** the selected **running** agent. |
| `s` | **Save** this run's script as a command (see Section 6). |

<div class="callout info">

**What `x` stops depends on the focus level.** This is easy to misfire: pressing `x` with focus on **an agent** stops that one agent; pressing `x` with focus on **the whole run** (the top level) stops the **entire workflow**. Verify which level is highlighted before pressing.

</div>

The progress/logging machinery (the script side writing narration lines to the progress tree via `log()`, how phases organize progress) is explained from the script's perspective in [p2-09](#/en/p2-09). This chapter only covers the **watching** and **operating** side you do from the terminal.

---

## 5 Pause, Resume, Stop, Restart

If a pause, adjustment, or termination is needed mid-run, the following actions are all available as single-key operations inside the `/workflows` view.

- **Pause / resume: `p`.** Select a run and press `p` to pause; press it again (or have Claude restart with the same script) to resume. The payoff of resuming: **agents that already finished return their cached results** (no re-spending tokens), and only the rest actually run.
- **Stop an agent / the whole workflow: `x`.** See the previous section: focus on an agent stops that one, focus on the run stops the whole thing.
- **Restart an agent: `r`.** Select a **running** agent and press `r` to restart it.

<div class="callout warn">

**Resume only works within "the same session" -- this is the most commonly hit boundary.** Stopping a run and resuming later in the **same Claude Code session** preserves the cache: finished agents return instantly. But **once Claude Code is exited, the next launch creates a new session, and that new session runs this workflow from scratch** (official wording: "the next session starts the workflow fresh"). The resume cache **does not persist across sessions.** If a run is half-done and the intent is to continue later, closing and reopening does not resume progress; it starts from the beginning.

</div>

<div class="callout info">

**The terminal's `p` resume and the script side's `resumeFromRunId` are two entries to the same mechanism.** Pressing `p` to resume in `/workflows` is the **interactive** entry; the script side provides a programmatic one: pass `resumeFromRunId: "wf_..."` when calling the Workflow tool, and unchanged `agent()` calls return cached results in the same way. This book verified that resuming with the same script + same args produces a **100% cache hit, 0 new tokens** (Run `wf_9c94951d-58c`). Both paths lead to the same caching mechanism; detailed explanation in [p4-22](#/en/p4-22).

</div>

```mermaid
flowchart LR
    T["1. Trigger<br/>keyword / ultracode"] --> AP{"2. Pre-run approval"}
    AP -->|View raw script| AP
    AP -->|Yes, run it| OBS["3. Watch<br/>/workflows + task panel"]
    AP -->|No| X1["cancel"]
    OBS --> P["4. p pause / resume<br/>x stop, r restart"]
    P -->|same session: cache hit| OBS
    P -->|reopen later: fresh re-run| T
    OBS --> S["5. s save as command<br/>into / autocomplete"]
    style T fill:#69d
    style S fill:#2d6
    style X1 fill:#e88
```

---

## 6 Save a Run You Like as a Command

When a run finishes with a satisfactory result and the flow should be **directly reusable later**, press **`s`** inside the `/workflows` view to **save the script behind this run as a command**.

Once saved, three things happen:

1. This workflow becomes a **named command**.
2. It shows up in the **autocomplete** list when you type `/`.
3. It sits **alongside** the commands that ship with Claude Code, with no difference in use. Next time, just `/<the-name-you-gave-it>` to run it again.

<div class="callout tip">

**This is the lightest way to build a workflow library.** No need to create files or configure directories first: get a satisfactory run, press `s` to save it, and it enters the command list. Once several have accumulated and proper management is needed (versions, parameters, team sharing), see [p5-25](#/en/p5-25) for building a workflow library systematically; the authoring flow is in [p6-27](#/en/p6-27).

</div>

---

## 7 The Only Bundled Workflow: `/deep-research`

Claude Code ships with exactly one named workflow: **`/deep-research <your question>`**. This book verified on v2.1.156 that it is the only entry in the bundled named-workflow registry; the few built-ins from earlier versions have been removed and should not be relied on.

It executes a standard research pipeline:

1. **Fan out the search from multiple angles**: query from different angles at once.
2. **Fetch and cross-check**: pull the sources back and cross-reference them against each other.
3. **Vote on each claim**: multiple agents vote on each conclusion.
4. **Produce a cited report**: the report lands back in your session, with source citations, and **claims that didn't survive cross-checking have been filtered out.**

Usage example:

```text
/deep-research What's the real concurrency cap for Dynamic workflows -- what do the official docs vs. real runs say?
```

<div class="callout warn">

**`/deep-research` needs the WebSearch tool available.** Its whole pipeline rests on actually going out and searching the web, so your environment must have the WebSearch tool. Without it, this flow can't run.

</div>

The `/deep-research` walkthrough and what a real run looks like (including the real run `wf_6090decc-8a5`) is broken down in [p3-13](#/en/p3-13).

---

## 8 Boundaries and Cross-Platform Corner Cases

This section lists boundaries that arise in practice. Knowing them in advance reduces troubleshooting time.

**Research preview.** All of Dynamic workflows is still a research preview, so the UX, prompt wording, fields, and key bindings above **may evolve across versions**. Treat this chapter as "the operating map for the v2.1.154+ generation," and where it differs, trust what your build actually does.

**Where it's available.** Dynamic workflows is **available on all paid plans** (Pro, Max, Team, Enterprise), plus the **Anthropic API**, **Amazon Bedrock**, **Google Cloud Vertex AI**, and **Microsoft Foundry**, so the operations in this chapter apply across all of those, not just the first-party CLI. On **Pro** you turn them on from the **Dynamic workflows** row in `/config`; the official docs don't state a default for the other plans, so if a workflow won't trigger, check that same toggle in your own `/config`. (The enablement story, including the two-layer model and the zero-cost probe, is in Chapter 01 SS1.5; see [p1-01](#/en/p1-01).)

**No input injection mid-run.** Once a run is live, it is **not possible** to add a message partway through to change its course. The only thing that **automatically** interrupts it is a **permission prompt raised by an agent** (the "do you want to allow it to do X" confirmation). Active control remains available: press `p` in `/workflows` to pause/resume, or `x` to stop an agent or the whole run (the key table in Section 4). For a human checkpoint pattern ("run one stage, review, then run the next"), the correct approach is to **split each stage into its own workflow**, review the output after each completes, and manually launch the next.

**The script itself has no file system / shell.** A workflow script only **orchestrates**; it cannot read files or run commands on its own. All actual IO (reading/writing files, running a shell) is performed by the **agents** it dispatches. This is why `fs`, `require`, and `process` do not appear in scripts (details in [p2-04](#/en/p2-04)'s explanation of "Workflow script vs. Node script").

**Concurrency and total caps.** A single workflow runs at most **16 concurrent agents** (fewer if your machine has few CPU cores); anything beyond that **queues** rather than erroring. A **single run dispatches at most 1000 agents**, a runaway-loop backstop.

**Usage and quotas.** Tokens consumed by workflows count toward your plan usage and rate limits. A workflow that fans out many agents can eat through a significant share of your quota in minutes, so factor this in when planning your scripts.

<div class="callout info">

**Turning the whole feature off, and what changes.** If Dynamic workflows are not needed, four switches are available (any one works):

- **Per-machine**: toggle it off on the **Dynamic workflows** row in `/config`; or add `"disableWorkflows": true` to your `settings.json`; or set the environment variable `CLAUDE_CODE_DISABLE_WORKFLOWS=1` (read at startup; the per-OS form matches the enable side: macOS/Linux run `CLAUDE_CODE_DISABLE_WORKFLOWS=1 claude`, Windows CMD `set CLAUDE_CODE_DISABLE_WORKFLOWS=1` then run `claude`, PowerShell `$env:CLAUDE_CODE_DISABLE_WORKFLOWS="1"; claude`; for a persistent cross-platform setting put it in the `env` block of `settings.json`).
- **Org-wide**: set `"disableWorkflows": true` in your organization's **managed settings**, or use the toggle on the Claude Code **admin settings page**.

Once disabled, three things change that you'll notice immediately: the **bundled commands are gone** (e.g. `/deep-research` no longer exists), the **`ultracode` trigger keyword goes inert** (typing it no longer highlights or switches Claude into orchestration), and the **`ultracode` tier is removed from the `/effort` menu**. If `/deep-research` vanished or the keyword stopped triggering, a disable switch is the first thing to check.

</div>

**TUI key bindings are consistent across platforms.** The `up/down`, `Enter`, `Esc`, `j`/`k`, and `p`/`x`/`r`/`s` in the table above are standard terminal keys, **behaving the same** on macOS, Linux, and Windows. No need to learn two sets for different systems.

<div class="callout warn">

**The one to watch on macOS is `alt+w` and other Alt-bearing keys.** On macOS, **Alt is the Option key.** Some terminals (such as macOS's built-in Terminal.app) don't treat Option as the Meta key by default, so `alt+w` may do nothing when pressed. The fix is to turn on "**Use Option as Meta key**" in your terminal settings (Terminal.app: Settings > Profiles > Keyboard; iTerm2: Profiles > Keys).

This is **general terminal knowledge**, not an official guarantee specific to Dynamic workflows, but it genuinely affects whether `alt+w` works for you, so it's flagged here honestly.

</div>

---

## Chapter Summary

- **Trigger**: include `ultracode` in your message (it gets highlighted in violet); dismiss an accidental trigger with `alt+w`; to have Claude orchestrate proactively by default, use `/effort ultracode`.
- **Approval**: before launch, 4 options: `Yes, run it` / `Yes, and don't ask again for <name> in <path>` (no more asking within this project) / `View raw script` (read first, recommended) / `No`; on the prompt, `Tab` cycles options and `Ctrl+G` opens the script in your editor.
- **Permission modes**: Default/acceptEdits prompt every run (unless don't-ask-again); Auto prompts only first launch (skipped entirely under `ultracode`); Bypass / `claude -p` / Agent SDK never prompt. **Subagents always run `acceptEdits` and inherit your allowlist** regardless of session mode: file edits auto-approved (first-hand confirmed, Run `wf_b1d45b4c-445`), but non-allowlisted shell/web/MCP can still prompt mid-run. In the Desktop app it's an approval card (name + phases + token caution; Once/Always/Deny) with progress in the Background tasks pane.
- **Watch**: `/workflows` opens the progress view (per phase: agent count / tokens / elapsed, drill-in supported), and the task panel below the input box shows a one-line progress; the keys `up/down Enter/right Esc j/k p x r s` are all in the Section 4 table.
- **Pause/resume/stop**: `p` pauses/resumes (finished agents come from cache), `x` stops an agent or the whole run, `r` restarts an agent; **resume is same-session only**, so exiting Claude Code and reopening makes it **run fresh**; the terminal's `p` and the script side's `resumeFromRunId` are two faces of the same cache.
- **Save as command**: happy with it, press `s`, and the workflow joins `/` autocomplete alongside the bundled commands.
- **Bundled workflow**: only `/deep-research <question>` (multi-angle search, cross-check, vote, cited and filtered report), needs WebSearch available.
- **Availability**: all paid plans (Pro/Max/Team/Enterprise) + Anthropic API + Bedrock + Vertex AI + Microsoft Foundry; Pro enables via the `/config` row, no documented default for the others.
- **Disable**: `/config` toggle / `"disableWorkflows": true` in settings.json / `CLAUDE_CODE_DISABLE_WORKFLOWS=1` / managed settings or admin page (org-wide). When off: bundled commands gone, `ultracode` trigger keyword inert, the `ultracode` tier removed from `/effort`.
- **Usage**: tokens consumed by workflows count toward your plan usage and rate limits.
- **Boundaries**: research preview (UX may change); no input injection mid-run; the script has no fs/shell; at most 16 concurrent / 1000 agents per run; TUI keys are cross-platform consistent, except `alt+w` may need Option set as Meta in some macOS terminals.

> Continue reading: [Chapter 09 · Progress, Logs, Resume, Budget](#/en/p2-09)
