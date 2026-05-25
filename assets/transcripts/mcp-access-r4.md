# Real-run: Can a Workflow subagent use MCP tools? (R4)

> Provenance for the cookbook's claim about MCP access inside `agent()` subagents.
> Two probe workflows, run on this machine 2026-05-25, Claude Code with
> `CLAUDE_CODE_WORKFLOWS=1`, main-loop model Opus 4.7 (1M). Both scripts are the
> exact inline scripts launched via the `Workflow` tool; results are the verbatim
> structured-output objects returned.

## Why this matters

A third-party example (`triage-sentry.js` from `claude-code-workflow-creator`, a
YouTuber's companion repo — **not** official) calls `agent('Use the Sentry MCP to
list unresolved issues…')` with no special setup — it *assumes* a workflow
subagent can reach an MCP tool. Rather than trust that assumption, we verified it
for real. The answer is nuanced and depends on how MCP tools are surfaced in the
session.

## Probe 1 — what tools does a default workflow subagent have?

- **Run ID:** `wf_1d4c6a71-56a`  ·  workflow `mcp-access-probe`  ·  1 agent, 27,533 tokens, 18,494 ms.
- One `agent()` call asked the subagent to introspect its own tool list (schema-forced output).

**Returned (verbatim fields):**

```json
{
  "mcpToolCount": 0,
  "mcpToolNames": [],
  "sawContext7": false,
  "sawPlaywright": false,
  "sawGitHub": false,
  "sawExa": false,
  "toolFamiliesSummary": "My actually-callable tools right now are non-MCP only: file tools (Read, Write, Edit, Glob, Grep), shell tools (Bash, PowerShell), Skill, ToolSearch, and StructuredOutput. Zero mcp__-prefixed tools are loaded/callable — the ~80 mcp__ names (Playwright, context7, exa, grok-search, deepwiki, context-mode, etc.) appear only as DEFERRED tools whose schemas are not loaded; per the system reminder, calling them directly fails with InputValidationError until fetched via ToolSearch."
}
```

**Finding:** the default `workflow-subagent` inherits the session's **file + shell
+ Skill + ToolSearch** tools, but **no `mcp__` tool is loaded by default** in a
deferred-tool session. The MCP names exist only as deferred entries.

## Probe 2 — can it load and actually call an MCP tool?

- **Run ID:** `wf_d8aa0772-ced`  ·  workflow `mcp-e2e-probe`  ·  1 agent, 29,431 tokens, 3 tool-uses, 25,127 ms.
- One `agent()` call was told to ToolSearch-load `mcp__context7__resolve-library-id`, then actually invoke it for "react", and report literally.

**Returned (verbatim fields):**

```json
{
  "toolSearchWorked": true,
  "mcpCallAttempted": true,
  "mcpCallSucceeded": true,
  "whichMcpTool": "mcp__context7__resolve-library-id",
  "resultOrError": "ToolSearch with query \"select:mcp__context7__resolve-library-id\" returned a usable JSONSchema for the tool. Note: the schema marks BOTH \"query\" and \"libraryName\" as required, so I called it with {libraryName: \"react\", query: \"react\"}. The call succeeded and returned real Context7 data: matching React libraries with IDs, descriptions, snippet counts, reputation, benchmark scores. Top matches: /reactjs/react.dev (3032 snippets, benchmark 85.1); /facebook/react (3414 snippets, benchmark 67.8); /websites/react_dev (2881 snippets, 76.9). No errors; did not need the exa fallback."
}
```

**Finding:** a workflow subagent **can** use an MCP tool end-to-end — it
ToolSearch-loads the schema on demand and then calls it, exactly as the main loop
does. The subagent even surfaced a real-world detail (the context7 tool requires
both `query` and `libraryName`).

## Conclusion (the teachable fact)

Whether `agent('… use the X MCP …')` works depends on how MCP tools are exposed:

- **Eager-tool session** (MCP tools loaded up front): the subagent has them
  directly — `triage-sentry.js`'s assumption holds as written.
- **Deferred-tool session** (this machine): the subagent starts with **zero**
  `mcp__` tools but has `ToolSearch`, so it loads the one it needs on demand and
  calls it. Still works; just one extra hop. A robust prompt can name the tool
  ("use the context7 MCP `resolve-library-id`") to steer the load.

Either way, **MCP integration inside a workflow is real and verified** — not an
assumption inherited from the example.

## Environment note (for the GitHub-integration recipe)

`gh` CLI **v2.88.1** is installed and authenticated (account
`AGI-is-going-to-arrive`). Since subagents have Bash, a workflow can shell out to
`gh issue list` / `gh pr view` against any real public repo with no MCP install —
the basis for the authoritative GitHub-triage recipe.
