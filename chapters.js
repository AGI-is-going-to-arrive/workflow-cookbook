// ═══ Chapter Content — Auto-loaded by index.html ═══
// Must load BEFORE main script. Creates global CONTENT object.
var CONTENT = {};

// ═══ Ch01: What is Workflow ═══
CONTENT['ch01'] = {
zh: `
Workflow 是 Claude Code 内置的一个 **确定性编排引擎**。它允许你用 JavaScript 脚本来定义多 Agent 的编排逻辑——包括谁先跑、谁并行跑、谁等谁、输出如何约束、数据如何传递。

## 它不是什么

在理解 Workflow 是什么之前，先明确它**不是什么**：

| 它不是 | 为什么不是 |
|--------|-----------|
| **MCP** | MCP 是工具协议，Workflow 是编排引擎 |
| **Skills** | Skills 是行为注入，Workflow 是控制流 |
| **Subagents** | Subagents 是临时派人做事，Workflow 是流水线 |
| **Agent Teams** | Agent Teams 是多角色协作，Workflow 是确定性脚本 |

<div class="pullquote">
Workflow 的本质：<strong>用 JavaScript 控制流替代模型驱动的决策</strong>。循环、条件、扇出——这些由你的脚本决定，不由模型即兴发挥。
</div>

## 为什么需要确定性

当你让模型自己决定"接下来做什么"，结果是不确定的。同一个 prompt，跑 10 次可能有 7 种不同的执行路径。这在探索性任务中是优势，但在工程流水线中是灾难。

Workflow 解决的核心问题：**把编排逻辑从模型的概率空间中剥离出来，交给确定性的 JavaScript 控制流。**

\`\`\`
传统方式：用户 → 模型决定做什么 → 执行（不确定）
Workflow：用户 → JavaScript 脚本决定做什么 → 模型执行（确定性编排 + AI 执行）
\`\`\`

## 如何启用

Workflow 是 Claude Code 的**隐藏/实验性功能**，需要通过环境变量 \`CLAUDE_CODE_WORKFLOWS=1\` 显式开启（自 v2.1.148 起支持）。

**方式 1：在 settings.json 中配置**（推荐，永久生效）

在 \`~/.claude/settings.json\` 的 \`env\` 部分添加：

\`\`\`json
{
  "env": {
    "CLAUDE_CODE_WORKFLOWS": "1"
  }
}
\`\`\`

**方式 2：启动时设置环境变量**

\`\`\`bash
CLAUDE_CODE_WORKFLOWS=1 claude
\`\`\`

或：

\`\`\`bash
export CLAUDE_CODE_WORKFLOWS=1
claude
\`\`\`

开启后，在对话中输入 \`ultrawork\` 关键词即可触发 Workflow 工具。

<div class="callout warning">
<div class="callout-title">版本要求</div>
Workflow 功能需要 Claude Code <strong>v2.1.148 或更高版本</strong>（2026年5月发布）。如果你的版本较低，请先更新：<code>claude update</code>。
</div>

## 一个最小的 Workflow 长什么样

\`\`\`javascript
export const meta = {
  name: 'hello-workflow',
  description: 'My first workflow',
  phases: [
    { title: 'Greet', detail: 'Spawn one agent' },
  ],
}

phase('Greet')
const result = await agent('Say hello and confirm workflow is working.')
log('Agent said: ' + result)
return result
\`\`\`

这就是一个完整的 Workflow 脚本。它有三个核心要素：

1. **\`meta\`** — 声明 workflow 的名称、描述和阶段
2. **\`phase()\`** — 标记当前阶段（用于进度显示）
3. **\`agent()\`** — 派遣一个子 agent 执行任务

## 本章小结

- Workflow 是确定性编排引擎，不是 MCP/Skills/Subagents/Agent Teams
- 核心价值：把编排逻辑从模型的概率空间剥离到 JavaScript 控制流
- 每个 Workflow 脚本必须以 \`export const meta = {...}\` 开头
- \`agent()\`、\`phase()\`、\`log()\` 是最基本的三个 API
`,
en: `
Workflow is a **deterministic orchestration engine** built into Claude Code. It lets you define multi-agent orchestration logic using JavaScript scripts — including execution order, parallelism, dependencies, output constraints, and data passing.

## What It Is Not

Before understanding what Workflow is, let's clarify what it **is not**:

| It is not | Why not |
|-----------|---------|
| **MCP** | MCP is a tool protocol; Workflow is an orchestration engine |
| **Skills** | Skills inject behavior; Workflow controls flow |
| **Subagents** | Subagents are ad-hoc delegation; Workflow is a pipeline |
| **Agent Teams** | Agent Teams are multi-role collaboration; Workflow is deterministic scripting |

<div class="pullquote">
The essence of Workflow: <strong>replacing model-driven decisions with JavaScript control flow</strong>. Loops, conditionals, fan-out — these are determined by your script, not improvised by the model.
</div>

## Why Determinism Matters

When you let the model decide "what to do next," the result is non-deterministic. The same prompt run 10 times might produce 7 different execution paths. This is an advantage for exploratory tasks but a disaster for engineering pipelines.

The core problem Workflow solves: **separating orchestration logic from the model's probabilistic space and handing it to deterministic JavaScript control flow.**

\`\`\`
Traditional: User → Model decides what to do → Execute (non-deterministic)
Workflow:    User → JS script decides what to do → Model executes (deterministic orchestration + AI execution)
\`\`\`

## How to Enable

Workflow is a **hidden/experimental feature** that requires the \`CLAUDE_CODE_WORKFLOWS=1\` environment variable (since v2.1.148, May 2026).

**Method 1: settings.json** (recommended) — add \`"CLAUDE_CODE_WORKFLOWS": "1"\` to the \`env\` section in \`~/.claude/settings.json\`.

**Method 2: Launch command** — \`CLAUDE_CODE_WORKFLOWS=1 claude\`

Once enabled, type \`ultrawork\` in conversation to trigger the Workflow tool.

<div class="callout warning">
<div class="callout-title">Version Requirement</div>
Requires Claude Code <strong>v2.1.148+</strong> (May 2026). Update with: <code>claude update</code>.
</div>

## What a Minimal Workflow Looks Like

\`\`\`javascript
export const meta = {
  name: 'hello-workflow',
  description: 'My first workflow',
  phases: [
    { title: 'Greet', detail: 'Spawn one agent' },
  ],
}

phase('Greet')
const result = await agent('Say hello and confirm workflow is working.')
log('Agent said: ' + result)
return result
\`\`\`

This is a complete Workflow script. It has three core elements:

1. **\`meta\`** — Declares the workflow's name, description, and phases
2. **\`phase()\`** — Marks the current phase (for progress display)
3. **\`agent()\`** — Dispatches a subagent to execute a task

## Chapter Summary

- Workflow is a deterministic orchestration engine, not MCP/Skills/Subagents/Agent Teams
- Core value: separating orchestration logic from model probability space into JavaScript control flow
- Every Workflow script must start with \`export const meta = {...}\`
- \`agent()\`, \`phase()\`, \`log()\` are the three most basic APIs
`
};

// ═══ Ch02: Core Concepts ═══
CONTENT['ch02'] = {
zh: `
Claude Code 的 Workflow 引擎由 **7 个核心原语**组成。理解它们之间的关系，是编写高质量 Workflow 脚本的基础。

## 概念全景图

\`\`\`
Workflow Script
├── export const meta = { name, description, phases }
│
├── phase('Phase Name')      ← 进度分组
│   ├── log('message')       ← 进度消息
│   │
│   ├── agent(prompt, opts)  ← 核心：派遣子 agent
│   │   ├── schema           ← 约束输出为 JSON
│   │   ├── model            ← 模型覆盖
│   │   ├── label            ← 显示标签
│   │   ├── isolation        ← worktree 隔离
│   │   └── agentType        ← 自定义 agent 类型
│   │
│   ├── parallel([...])      ← 屏障：等所有完成
│   │
│   ├── pipeline(items, s1, s2, ...)  ← 流水线：不等待
│   │
│   └── workflow(name/ref)   ← 嵌套子 workflow
│
├── budget.total / spent() / remaining()  ← 预算控制
│
└── return value             ← workflow 返回值
\`\`\`

## meta：身份声明

每个 Workflow 脚本**必须**以 \`export const meta = {...}\` 开头。这是一个纯字面量对象，不允许包含变量、函数调用或模板插值。

\`\`\`javascript
export const meta = {
  name: 'code-review',        // 必填：kebab-case 标识符
  description: 'Review code', // 必填：一行描述（显示在权限对话框中）
  phases: [                   // 可选：阶段列表
    { title: 'Scan', detail: 'Find issues' },
    { title: 'Verify', detail: 'Adversarial check' },
  ],
}
\`\`\`

<div class="callout info">
<div class="callout-title">关键约束</div>
meta 必须是<strong>纯字面量</strong> — 不允许变量引用、展开运算符、模板字符串或函数调用。这是因为运行时在解析脚本前需要静态提取 meta 信息。
</div>

## phase()：进度分组

\`phase('Title')\` 将后续的 \`agent()\` 调用归入一个视觉分组。在 \`/workflows\` 命令中，用户可以看到每个 phase 下正在运行的 agent。

- phase 标题应与 \`meta.phases\` 中的 \`title\` 匹配
- 一个 \`phase()\` 调用后到下一个 \`phase()\` 之前的所有 agent 都属于同一组
- 在 \`pipeline()\` 或 \`parallel()\` 内部，使用 \`agent()\` 的 \`phase\` 选项代替全局 \`phase()\`

## agent()：核心原语

\`agent(prompt, opts)\` 是 Workflow 最重要的函数。它派遣一个子 agent 执行任务并返回结果。

\`\`\`javascript
// 最简用法 — 返回文本字符串
const text = await agent('Summarize this file')

// 结构化输出 — 返回验证后的 JSON 对象
const result = await agent('Find bugs', {
  schema: { type: 'object', properties: { bugs: { type: 'array' } } },
  label: 'bug-finder',
  model: 'haiku',
})
\`\`\`

## parallel()：屏障同步

\`parallel(thunks)\` 接收一个函数数组，并发运行它们，**等待全部完成**后返回结果数组。

\`\`\`javascript
const [a, b, c] = await parallel([
  () => agent('Review security'),
  () => agent('Review performance'),
  () => agent('Review architecture'),
])
// 只有三个都完成后，代码才继续
\`\`\`

<div class="callout warning">
<div class="callout-title">何时不该用 parallel()</div>
如果 stage N 不需要 stage N-1 的<strong>全部</strong>结果，就不该用 parallel() 作为阶段间的屏障。大多数场景应该用 pipeline()。
</div>

## pipeline()：流水线

\`pipeline(items, stage1, stage2, ...)\` 让每个 item 独立地流经所有 stage，**不在 stage 之间设置屏障**。Item A 可以已经在 stage 3 时，Item B 还在 stage 1。

\`\`\`javascript
const results = await pipeline(
  ['file1.ts', 'file2.ts', 'file3.ts'],
  (file) => agent('Review ' + file, { schema: REVIEW_SCHEMA }),
  (review) => agent('Verify: ' + review.finding, { schema: VERDICT_SCHEMA }),
)
\`\`\`

## schema：结构化约束

传入 \`schema\` 选项后，agent 被强制调用 \`StructuredOutput\` 工具返回符合 JSON Schema 的对象。验证在工具层发生——模型在不匹配时会自动重试。

## budget：预算控制

\`budget\` 对象让你根据用户的 "+500k" 指令动态控制 workflow 深度。

\`\`\`javascript
// 循环到预算耗尽
while (budget.total && budget.remaining() > 50_000) {
  const result = await agent('Find more bugs')
  bugs.push(...result.bugs)
}
\`\`\`

## 本章小结

| 原语 | 用途 | 返回值 |
|------|------|--------|
| \`meta\` | 声明身份和阶段 | — |
| \`phase()\` | 进度分组 | void |
| \`agent()\` | 派遣子 agent | string 或 object |
| \`parallel()\` | 并发 + 屏障 | any[] |
| \`pipeline()\` | 并发 + 流水线 | any[] |
| \`schema\` | 约束输出 | validated object |
| \`budget\` | 预算控制 | {total, spent(), remaining()} |
`,
en: `
Claude Code's Workflow engine consists of **7 core primitives**. Understanding their relationships is the foundation for writing high-quality Workflow scripts.

## Concept Overview

\`\`\`
Workflow Script
├── export const meta = { name, description, phases }
│
├── phase('Phase Name')      ← progress grouping
│   ├── log('message')       ← progress message
│   │
│   ├── agent(prompt, opts)  ← core: dispatch subagent
│   │   ├── schema           ← constrain output to JSON
│   │   ├── model            ← model override
│   │   ├── label            ← display label
│   │   ├── isolation        ← worktree isolation
│   │   └── agentType        ← custom agent type
│   │
│   ├── parallel([...])      ← barrier: wait for all
│   │
│   ├── pipeline(items, s1, s2, ...)  ← streaming: no wait
│   │
│   └── workflow(name/ref)   ← nested sub-workflow
│
├── budget.total / spent() / remaining()  ← budget control
│
└── return value             ← workflow return value
\`\`\`

## meta: Identity Declaration

Every Workflow script **must** start with \`export const meta = {...}\`. This must be a pure literal object — no variables, function calls, or template interpolation allowed.

\`\`\`javascript
export const meta = {
  name: 'code-review',        // required: kebab-case identifier
  description: 'Review code', // required: one-line (shown in permission dialog)
  phases: [                   // optional: phase list
    { title: 'Scan', detail: 'Find issues' },
    { title: 'Verify', detail: 'Adversarial check' },
  ],
}
\`\`\`

<div class="callout info">
<div class="callout-title">Key Constraint</div>
meta must be a <strong>pure literal</strong> — no variable references, spread operators, template strings, or function calls. This is because the runtime needs to statically extract meta information before parsing the script.
</div>

## phase(): Progress Grouping

\`phase('Title')\` groups subsequent \`agent()\` calls into a visual group. In the \`/workflows\` command, users can see which agents are running under each phase.

## agent(): The Core Primitive

\`agent(prompt, opts)\` is Workflow's most important function. It dispatches a subagent to execute a task and returns the result.

\`\`\`javascript
// Simplest usage — returns text string
const text = await agent('Summarize this file')

// Structured output — returns validated JSON object
const result = await agent('Find bugs', {
  schema: { type: 'object', properties: { bugs: { type: 'array' } } },
  label: 'bug-finder',
  model: 'haiku',
})
\`\`\`

## parallel(): Barrier Synchronization

\`parallel(thunks)\` takes an array of functions, runs them concurrently, and **waits for all to complete** before returning the results array.

\`\`\`javascript
const [a, b, c] = await parallel([
  () => agent('Review security'),
  () => agent('Review performance'),
  () => agent('Review architecture'),
])
// Code continues only after all three are done
\`\`\`

<div class="callout warning">
<div class="callout-title">When NOT to Use parallel()</div>
If stage N doesn't need <strong>all</strong> results from stage N-1, don't use parallel() as a barrier between stages. Most scenarios should use pipeline().
</div>

## pipeline(): Streaming Pipeline

\`pipeline(items, stage1, stage2, ...)\` lets each item flow through all stages independently, with **no barrier between stages**. Item A can be in stage 3 while Item B is still in stage 1.

\`\`\`javascript
const results = await pipeline(
  ['file1.ts', 'file2.ts', 'file3.ts'],
  (file) => agent('Review ' + file, { schema: REVIEW_SCHEMA }),
  (review) => agent('Verify: ' + review.finding, { schema: VERDICT_SCHEMA }),
)
\`\`\`

## schema: Structured Constraints

When a \`schema\` option is passed, the agent is forced to call the \`StructuredOutput\` tool to return an object conforming to the JSON Schema. Validation happens at the tool layer — the model automatically retries on mismatch.

## budget: Budget Control

The \`budget\` object lets you dynamically control workflow depth based on the user's "+500k" directive.

\`\`\`javascript
while (budget.total && budget.remaining() > 50_000) {
  const result = await agent('Find more bugs')
  bugs.push(...result.bugs)
}
\`\`\`

## Chapter Summary

| Primitive | Purpose | Returns |
|-----------|---------|---------|
| \`meta\` | Declare identity and phases | — |
| \`phase()\` | Progress grouping | void |
| \`agent()\` | Dispatch subagent | string or object |
| \`parallel()\` | Concurrent + barrier | any[] |
| \`pipeline()\` | Concurrent + streaming | any[] |
| \`schema\` | Constrain output | validated object |
| \`budget\` | Budget control | {total, spent(), remaining()} |
`
};

// ═══ Ch03: Positioning Matrix ═══
CONTENT['ch03'] = {
zh: `
Claude Code 提供了四种不同的多 Agent 编排机制。它们各有定位，而非相互替代。

## 四种编排方式一览

| 维度 | Subagents | Agent Teams | Skills | Workflow |
|------|-----------|-------------|--------|----------|
| **定义方式** | 自然语言指令 | 团队配置 | Markdown 文件 | JavaScript 脚本 |
| **控制流** | 模型驱动 | 半确定 | 模型驱动 | **确定性** |
| **可复用** | 不可 | 有限 | 可 | **完全可复用** |
| **结构化输出** | 不支持 | 不支持 | 不支持 | **Schema 约束** |
| **并发控制** | 手动 | 有限 | 不支持 | **精确 (parallel/pipeline)** |
| **断点续传** | 不支持 | 不支持 | 不支持 | **resumeFromRunId** |
| **预算控制** | 不支持 | 不支持 | 不支持 | **budget 对象** |
| **适用场景** | 临时任务 | 多角色协作 | 行为注入 | **工程流水线** |

## Subagents：临时派人做事

Subagents 是最简单的多 Agent 方式——你在对话中告诉 Claude"启动一个子 agent 去做 X"。

**优点**：零配置，随用随走
**缺点**：不可复用，输出不可约束，无法精确控制并发

\`\`\`
用户："帮我审查一下 src/ 目录的代码质量"
Claude：[派遣子 agent] → [返回文本结果]
\`\`\`

## Agent Teams：多角色协作工作台

Agent Teams 让你定义多个有名称的 agent，通过消息传递协作。

**优点**：角色分工明确，可持久化
**缺点**：控制流仍由模型驱动，难以保证执行路径一致

## Skills：把能力封装给模型

Skills 是 Markdown 文件，通过钩子注入到模型的上下文中，指导模型的行为。

**优点**：可复用、可共享、可组合
**缺点**：本质是 prompt 注入，执行路径不确定

## Workflow：确定性编排引擎

Workflow 用 JavaScript 脚本定义编排逻辑。循环、条件、扇出、数据传递——全由脚本控制。

**优点**：完全确定性、可复用、可测试、结构化输出
**缺点**：需要编写 JavaScript、是较新的特性

<div class="pullquote">
选择指南：<strong>如果你的任务是一次性的</strong>，用 Subagent。<strong>如果需要角色协作</strong>，用 Agent Teams。<strong>如果需要行为指导</strong>，用 Skills。<strong>如果需要可复用的工程流水线</strong>，用 Workflow。
<span class="attribution">——基于四大 Workflow 系统的实际使用经验总结</span>
</div>

## 四大系统的实际选择

我们分析了 4 个优秀的 Workflow 系统后发现，它们在定位上的选择印证了上述矩阵：

- **ccg-workflow** — 选择了 Skills + 外部模型调用的组合，但核心策略引擎实际上是确定性状态机
- **oh-my-claudecode** — 选择了 Skills 为主体，但通过 hook 注入实现了准确定性控制
- **oh-my-openagent** — 选择了 Agent 角色 + hook 策略引擎的组合
- **superpowers** — 选择了纯 Skills 方案，但通过反理性化工程保证了执行一致性

这说明：**即使不使用原生 Workflow 工具，成熟的系统都在追求确定性**。原生 Workflow 只是提供了最直接的实现路径。

## 本章小结

- 四种编排方式各有定位，不是替代关系
- Workflow 的独特优势：确定性 + 结构化输出 + 可复用 + 断点续传 + 预算控制
- 成熟系统即使不用原生 Workflow，也在追求确定性编排
`,
en: `
Claude Code provides four different multi-agent orchestration mechanisms. They each have their own positioning — they are not replacements for each other.

## Four Orchestration Approaches at a Glance

| Dimension | Subagents | Agent Teams | Skills | Workflow |
|-----------|-----------|-------------|--------|----------|
| **Definition** | Natural language | Team config | Markdown files | JavaScript scripts |
| **Control flow** | Model-driven | Semi-deterministic | Model-driven | **Deterministic** |
| **Reusable** | No | Limited | Yes | **Fully reusable** |
| **Structured output** | No | No | No | **Schema-constrained** |
| **Concurrency** | Manual | Limited | No | **Precise (parallel/pipeline)** |
| **Resume** | No | No | No | **resumeFromRunId** |
| **Budget** | No | No | No | **budget object** |
| **Best for** | Ad-hoc tasks | Multi-role collab | Behavior injection | **Engineering pipelines** |

## Subagents: Ad-hoc Delegation

Subagents are the simplest multi-agent approach — you tell Claude in conversation to "spawn a subagent to do X."

**Pros**: Zero configuration, use-and-go
**Cons**: Not reusable, output unconstrained, no precise concurrency control

## Agent Teams: Multi-Role Collaboration

Agent Teams let you define multiple named agents that collaborate through message passing.

**Pros**: Clear role division, persistent
**Cons**: Control flow still model-driven, hard to guarantee consistent execution paths

## Skills: Behavior Injection

Skills are Markdown files injected into the model's context through hooks, guiding the model's behavior.

**Pros**: Reusable, shareable, composable
**Cons**: Essentially prompt injection, execution path non-deterministic

## Workflow: Deterministic Orchestration Engine

Workflow uses JavaScript scripts to define orchestration logic. Loops, conditionals, fan-out, data passing — all controlled by the script.

**Pros**: Fully deterministic, reusable, testable, structured output
**Cons**: Requires writing JavaScript, relatively new feature

<div class="pullquote">
Selection guide: <strong>One-off task?</strong> Use Subagent. <strong>Need role collaboration?</strong> Use Agent Teams. <strong>Need behavior guidance?</strong> Use Skills. <strong>Need reusable engineering pipelines?</strong> Use Workflow.
<span class="attribution">— Summarized from real-world usage across four major workflow systems</span>
</div>

## How Four Real Systems Choose

After analyzing 4 excellent workflow systems, we found their positioning choices confirm the matrix above:

- **ccg-workflow** — Chose Skills + external model calls, but core strategy engine is actually a deterministic state machine
- **oh-my-claudecode** — Chose Skills as primary, but achieved quasi-deterministic control through hook injection
- **oh-my-openagent** — Chose Agent roles + hook-based strategy engine
- **superpowers** — Chose pure Skills approach, but ensured execution consistency through anti-rationalization engineering

This tells us: **even without the native Workflow tool, mature systems are all pursuing determinism**. Native Workflow simply provides the most direct path.

## Chapter Summary

- Four orchestration approaches each have their own positioning — not replacements
- Workflow's unique advantages: determinism + structured output + reusability + resume + budget control
- Mature systems pursue deterministic orchestration even without native Workflow
`
};

// ═══ Ch04: Hello Workflow ═══
CONTENT['ch04'] = {
zh: `
本章带你从零开始：配置环境、编写并运行你的第一个 Workflow 脚本，附带真实运行结果。

## 前置条件

- Claude Code CLI（已安装并登录）
- 一个项目目录（任意目录均可）

<div class="callout tip">
<div class="callout-title">实测发现</div>
Workflow 功能需要显式开启（自 Claude Code v2.1.148 起支持）。开启方式有两种：
</div>

## 第一个 Workflow：Smoke Test

这是一个最小化的 Workflow，用于验证整个系统是否正常工作：

\`\`\`javascript
export const meta = {
  name: 'smoke-test',
  description: 'Minimal workflow: one agent returns structured output',
  phases: [
    { title: 'Test', detail: 'Spawn one subagent and validate structured output' },
  ],
}

const RESULT_SCHEMA = {
  type: 'object',
  properties: {
    message: { type: 'string', description: 'A confirmation message' },
    success: { type: 'boolean', description: 'Whether the test passed' },
    capabilities: {
      type: 'array',
      items: { type: 'string' },
      description: 'List of capabilities the agent can confirm'
    }
  },
  required: ['message', 'success', 'capabilities'],
}

phase('Test')
log('Starting smoke test — spawning one subagent with schema constraint')

const result = await agent(
  'You are a test agent. Return a JSON confirming: 1) The workflow executed successfully, 2) List your capabilities. Set success to true.',
  { schema: RESULT_SCHEMA, label: 'smoke-tester' }
)

log('Smoke test completed: ' + (result ? 'success' : 'failed'))
return { testName: 'smoke-test', result }
\`\`\`

## 真实运行结果

以下是我们在 Claude Code 中实际运行此 Workflow 的结果：

<div class="test-result">
<div class="test-header">
<span class="status pass">PASS</span>
<span class="test-name">smoke-test</span>
</div>
<div class="test-output">
{
  "testName": "smoke-test",
  "result": {
    "message": "Workflow smoke test executed successfully.",
    "success": true,
    "capabilities": [
      "reading files",
      "writing files",
      "running commands",
      "searching code"
    ]
  }
}

Agent count: 1
Total tokens: 26,382
Duration: 6.7s
</div>
</div>

**关键观察：**

1. **Schema 验证生效** — agent 返回了符合 RESULT_SCHEMA 的 JSON 对象
2. **结构化输出可用** — \`capabilities\` 数组正确填充
3. **性能合理** — 单 agent workflow 耗时约 6.7 秒，消耗约 26K tokens
4. **label 正常工作** — 在 \`/workflows\` 命令中可以看到 "smoke-tester" 标签

## 逐行解析

| 行 | 代码 | 作用 |
|----|------|------|
| 1 | \`export const meta = {...}\` | 声明 workflow 身份，必须是纯字面量 |
| 2 | \`name: 'smoke-test'\` | workflow 标识符 |
| 3 | \`phases: [{title: 'Test'}]\` | 声明一个阶段 |
| 4 | \`const RESULT_SCHEMA = {...}\` | 定义输出 JSON Schema |
| 5 | \`phase('Test')\` | 开始 "Test" 阶段 |
| 6 | \`log('...')\` | 向用户发送进度消息 |
| 7 | \`await agent(prompt, {schema})\` | 派遣 agent 并等待结构化输出 |
| 8 | \`return result\` | 返回 workflow 结果 |

## 运行方式

有两种方式运行 Workflow：

**方式 1：内联脚本**
在 Claude Code 对话中，让 Claude 直接使用 Workflow 工具并传入 \`script\` 参数。

**方式 2：脚本文件**
将脚本保存为 \`.js\` 文件，通过 \`scriptPath\` 参数引用：
\`\`\`javascript
Workflow({ scriptPath: '/path/to/smoke-test.js' })
\`\`\`

<div class="callout info">
<div class="callout-title">推荐方式</div>
对于需要反复运行的 Workflow，推荐使用 scriptPath 方式。脚本文件便于版本管理、迭代修改和团队共享。
</div>

## 本章小结

- Workflow 需通过 \`CLAUDE_CODE_WORKFLOWS=1\` 显式启用（v2.1.148+）
- 最小 Workflow 只需 meta + phase + agent
- Schema 约束确保 agent 输出结构化 JSON
- 单 agent workflow 约 6.7 秒 / 26K tokens
- 推荐使用 scriptPath 方式运行可复用的 Workflow
`,
en: `
This chapter walks you through from zero: configure your environment, write and run your first Workflow script, with real execution results.

## Prerequisites

- Claude Code CLI (installed and logged in)
- A project directory (any directory works)

<div class="callout tip">
<div class="callout-title">Real Test Finding</div>
Workflow requires explicit activation since Claude Code v2.1.148 (May 2026). Set <code>"CLAUDE_CODE_WORKFLOWS": "1"</code> in <code>~/.claude/settings.json</code> under <code>env</code>, or launch with <code>CLAUDE_CODE_WORKFLOWS=1 claude</code>.
</div>

## First Workflow: Smoke Test

This is a minimal Workflow to verify the entire system works:

\`\`\`javascript
export const meta = {
  name: 'smoke-test',
  description: 'Minimal workflow: one agent returns structured output',
  phases: [
    { title: 'Test', detail: 'Spawn one subagent and validate structured output' },
  ],
}

const RESULT_SCHEMA = {
  type: 'object',
  properties: {
    message: { type: 'string', description: 'A confirmation message' },
    success: { type: 'boolean', description: 'Whether the test passed' },
    capabilities: {
      type: 'array',
      items: { type: 'string' },
      description: 'List of capabilities the agent can confirm'
    }
  },
  required: ['message', 'success', 'capabilities'],
}

phase('Test')
log('Starting smoke test — spawning one subagent with schema constraint')

const result = await agent(
  'You are a test agent. Return a JSON confirming: 1) The workflow executed successfully, 2) List your capabilities. Set success to true.',
  { schema: RESULT_SCHEMA, label: 'smoke-tester' }
)

log('Smoke test completed: ' + (result ? 'success' : 'failed'))
return { testName: 'smoke-test', result }
\`\`\`

## Real Execution Results

Here are the actual results from running this Workflow in Claude Code:

<div class="test-result">
<div class="test-header">
<span class="status pass">PASS</span>
<span class="test-name">smoke-test</span>
</div>
<div class="test-output">
{
  "testName": "smoke-test",
  "result": {
    "message": "Workflow smoke test executed successfully.",
    "success": true,
    "capabilities": [
      "reading files",
      "writing files",
      "running commands",
      "searching code"
    ]
  }
}

Agent count: 1
Total tokens: 26,382
Duration: 6.7s
</div>
</div>

**Key Observations:**

1. **Schema validation works** — the agent returned a JSON object conforming to RESULT_SCHEMA
2. **Structured output available** — the \`capabilities\` array was correctly populated
3. **Reasonable performance** — single-agent workflow took ~6.7 seconds, consuming ~26K tokens
4. **Label works** — "smoke-tester" label visible in \`/workflows\` command

## Line-by-Line Analysis

| Line | Code | Purpose |
|------|------|---------|
| 1 | \`export const meta = {...}\` | Declare workflow identity, must be pure literal |
| 2 | \`name: 'smoke-test'\` | Workflow identifier |
| 3 | \`phases: [{title: 'Test'}]\` | Declare one phase |
| 4 | \`const RESULT_SCHEMA = {...}\` | Define output JSON Schema |
| 5 | \`phase('Test')\` | Start the "Test" phase |
| 6 | \`log('...')\` | Send progress message to user |
| 7 | \`await agent(prompt, {schema})\` | Dispatch agent and await structured output |
| 8 | \`return result\` | Return workflow result |

## How to Run

Two ways to run a Workflow:

**Method 1: Inline script**
In a Claude Code conversation, have Claude use the Workflow tool with the \`script\` parameter.

**Method 2: Script file**
Save the script as a \`.js\` file and reference via \`scriptPath\`:
\`\`\`javascript
Workflow({ scriptPath: '/path/to/smoke-test.js' })
\`\`\`

<div class="callout info">
<div class="callout-title">Recommended Approach</div>
For workflows that need to be run repeatedly, use the scriptPath approach. Script files are easier to version, iterate, and share with teams.
</div>

## Chapter Summary

- Workflow requires \`CLAUDE_CODE_WORKFLOWS=1\` to enable (v2.1.148+)
- Minimal Workflow only needs meta + phase + agent
- Schema constraints ensure agent outputs structured JSON
- Single-agent workflow: ~6.7 seconds / ~26K tokens
- Recommend scriptPath for reusable Workflows
`
};

// ═══ Ch20: Ecosystem Review ═══
CONTENT['ch20'] = {
zh: `
我们深度分析了 4 个优秀的 Claude Code Workflow/编排系统。每个系统都有独特的设计哲学和创新模式。

## 横评矩阵

| 维度 | ccg-workflow | oh-my-claudecode | oh-my-openagent | superpowers |
|------|-------------|-----------------|----------------|-------------|
| **版本** | v3.1.1 | v4.14.1 | v4.4.0 | v5.1.0 |
| **核心理念** | 多模型交叉验证 | 技能可嵌套组合 | 类别 > 模型名 | 方法论即插件 |
| **技能数** | 100+ (含域知识) | 40 | 10 (项目级) | 14 |
| **Agent 角色** | 26 专家提示 | 19 | 11 | 14 (含子模板) |
| **Hook 点** | 4 | 10 | 54+ | 1 (SessionStart) |
| **支持平台** | Claude Code | Claude Code | 多 Harness | 7 平台 |
| **外部模型** | Codex + Gemini + Antigravity | Codex + Gemini (tmux) | 多模型路由 | 无（跨平台） |
| **依赖** | Go 二进制 + Node | TypeScript 编译 | TypeScript + Bun | 零依赖 |

## 1. ccg-workflow：多模型交叉验证

**GitHub**: [fengshao1227/ccg-workflow](https://github.com/fengshao1227/ccg-workflow)

**设计哲学**：单一命令 \`/ccg:go\` 路由到 10 种不同的工作流策略。铁律——M 级以上任务必须调用两个外部模型并行分析，因为"单模型 = 盲点"。

**架构特色**：
- **10 策略状态机**：direct-fix / quick-implement / guided-develop / full-collaborate / debug-investigate / refactor-safely / deep-research / optimize-measure / review-audit / git-action
- **Hook 注入的状态面包屑**：每轮 UserPromptSubmit 都注入 \`<ccg-state>\` XML，保证上下文压缩后不丢失任务状态
- **循环检测**：当同一个 phase + nextAction 重复 3 次，自动触发 LOOP DETECTED 警告
- **Spec 演进协议**：任务完成后，引擎主动提议向 \`.ccg/spec/\` 添加新知识

**可提取的精华模式**：
1. Hook 注入状态面包屑（对抗上下文压缩）
2. 循环检测（3 次重复自动预警）
3. 策略路由矩阵（一个入口，多种执行路径）

## 2. oh-my-claudecode：技能可嵌套组合

**GitHub**: [Yeachan-Heo/oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode)

**设计哲学**：\`autopilot ⊃ ralph ⊃ ultrawork\` — 技能之间存在真正的子集关系，而非营销话术。

**架构特色**：
- **数学模糊度门控**（deep-interview）：受 Ouroboros 项目启发，一次问一个问题，对每个答案计算加权模糊度分数，低于阈值才能进入下一阶段
- **三模型顾问**（CCG skill）：将用户请求拆成 Codex prompt（架构/后端）+ Gemini prompt（UX/设计），并行执行后综合，显式标出分歧
- **PRD 驱动持久化**（Ralph）：自动生成 \`prd.json\`，逐 story 迭代直到所有 story \`passes: true\`
- **提交尾行协议**：\`Constraint:\` / \`Rejected:\` / \`Confidence:\` 等 git trailer，保留决策上下文

**可提取的精华模式**：
1. 模糊度门控（数学化的需求收集质量保证）
2. Skill 嵌套组合（可组合的编排层级）
3. 提交尾行保留决策历史

## 3. oh-my-openagent：类别 > 模型名

**GitHub**: [code-yeongyu/oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent)

**设计哲学**："人类干预是失败信号"——代码应与高级工程师写的无法区分，零人工清理。

**架构特色**：
- **Hashline LINE#ID 编辑工具**：每次 Read 在每行附带内容哈希（如 \`11#VK| function hello()\`），编辑时哈希不匹配则拒绝。据称将 Grok Code Fast 1 的成功率从 6.7% 提升到 68.3%
- **IntentGate 关键词检测**：扫描用户消息的第一句，注入模式特定提示（ultrawork / search / analyze / team / hyperplan）
- **对抗规划（Hyperplan）**：5 个敌对 agent（怀疑者/验证者/研究者/架构师/创意者）互相攻击发现，只有幸存者进入计划
- **16 agent 发布门控**：10 个 ultrabrain 审查 + 5 个 review-work + 1 个 oracle 综合

**可提取的精华模式**：
1. 类别路由（按意图分类，不按模型名）
2. 对抗规划（多角色互相攻击，幸存者才进入下一步）
3. 智慧积累笔记本（\`.omo/notepads/\` 跨 agent 前向传播）

## 4. superpowers：方法论即插件

**GitHub**: [obra/superpowers](https://github.com/obra/superpowers)

**设计哲学**：完整的软件开发方法论，以零依赖跨平台插件形式分发。没有引擎、没有编排器、没有 DSL——"workflow"完全运行在 agent 自身的上下文中。

**架构特色**：
- **Skills 即 TDD 测试**：每个行为规则都要通过 RED-GREEN-REFACTOR 验证——写压力场景测试（RED），编写最小技能使 agent 遵守（GREEN），然后关闭理性化漏洞（REFACTOR）
- **反理性化工程**：每个规则附带"红旗"表，列出 agent 可能发明的每一种借口及其反驳
- **CSO（Claude Search Optimization）**：技能描述只包含触发条件，不包含流程摘要——因为实测发现，当描述包含摘要时，Claude 会按摘要执行而非阅读完整技能
- **7 平台支持**：Claude Code / Codex CLI / Codex App / Cursor / Gemini CLI / OpenCode / GitHub Copilot CLI
- **跨平台多语言 Hook**：\`run-hook.cmd\` 利用 CMD 标签和 bash 注释的语法差异，一个文件同时兼容 Windows CMD 和 Unix bash

**可提取的精华模式**：
1. 反理性化表格（预防 agent 的自我辩解）
2. 技能 TDD 测试方法论
3. CSO 描述优化（只写触发条件，不写流程）
4. 跨平台 polyglot hook

## 综合对比：四大哲学

| 系统 | 一句话哲学 | 控制策略 | 复用单元 |
|------|-----------|---------|---------|
| ccg-workflow | "一个入口，十种策略" | 状态机 + 铁律 | 策略文件 |
| oh-my-claudecode | "技能嵌套组合" | Hook 注入 + 魔法关键词 | Skill 文件 |
| oh-my-openagent | "人类干预即失败" | IntentGate + 纪律执行 | 类别化 agent |
| superpowers | "方法论即插件" | SessionStart 注入 + 反理性化 | 跨平台 Skill |

<div class="pullquote">
四个系统走了完全不同的路径，但殊途同归：<strong>它们都在追求确定性编排</strong>——无论是通过状态机、Hook 注入、纪律执行还是反理性化工程。原生 Workflow 工具是实现这一目标的最直接路径。
</div>

## 本章小结

- 每个系统都有独特的设计哲学和值得学习的创新模式
- ccg：状态机 + 循环检测 + Spec 演进
- OMC：模糊度门控 + 技能嵌套 + 三模型顾问
- OmO：类别路由 + 对抗规划 + Hashline
- Superpowers：反理性化 + TDD 技能 + CSO + 7 平台
- 所有系统都在追求确定性——原生 Workflow 是最直接的路径
`,
en: `
We deeply analyzed 4 excellent Claude Code workflow/orchestration systems. Each has unique design philosophies and innovative patterns.

## Comparison Matrix

| Dimension | ccg-workflow | oh-my-claudecode | oh-my-openagent | superpowers |
|-----------|-------------|-----------------|----------------|-------------|
| **Version** | v3.1.1 | v4.14.1 | v4.4.0 | v5.1.0 |
| **Core philosophy** | Multi-model cross-validation | Nestable skill composition | Category > model name | Methodology as plugin |
| **Skills count** | 100+ (incl. domains) | 40 | 10 (project-level) | 14 |
| **Agent roles** | 26 expert prompts | 19 | 11 | 14 (incl. sub-templates) |
| **Hook points** | 4 | 10 | 54+ | 1 (SessionStart) |
| **Platforms** | Claude Code | Claude Code | Multi-harness | 7 platforms |
| **External models** | Codex + Gemini + Antigravity | Codex + Gemini (tmux) | Multi-model routing | None (cross-platform) |
| **Dependencies** | Go binary + Node | TypeScript compiled | TypeScript + Bun | Zero dependencies |

## 1. ccg-workflow: Multi-Model Cross-Validation

**GitHub**: [fengshao1227/ccg-workflow](https://github.com/fengshao1227/ccg-workflow)

**Design philosophy**: A single command \`/ccg:go\` routes to 10 different workflow strategies. Iron rule — M+ tasks must call two external models in parallel, because "single model = blind spots."

**Architecture highlights**:
- **10 strategy state machines**: direct-fix / quick-implement / guided-develop / full-collaborate / debug-investigate / refactor-safely / deep-research / optimize-measure / review-audit / git-action
- **Hook-injected state breadcrumbs**: Every UserPromptSubmit injects \`<ccg-state>\` XML, ensuring task state survives context compaction
- **Loop detection**: When the same phase + nextAction repeats 3 times, auto-triggers LOOP DETECTED warning
- **Spec Evolution protocol**: After task completion, the engine proactively proposes additions to \`.ccg/spec/\`

**Extractable patterns**:
1. Hook-injected state breadcrumbs (surviving context compaction)
2. Loop detection (3-repeat auto-warning)
3. Strategy routing matrix (one entry, multiple execution paths)

## 2. oh-my-claudecode: Nestable Skill Composition

**GitHub**: [Yeachan-Heo/oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode)

**Design philosophy**: \`autopilot ⊃ ralph ⊃ ultrawork\` — skills have real subset relationships, not marketing talk.

**Architecture highlights**:
- **Mathematical ambiguity gating** (deep-interview): Inspired by Ouroboros, asks one question at a time, computes weighted ambiguity scores, refuses to proceed below threshold
- **Tri-model advisor** (CCG skill): Splits user request into Codex prompt (architecture/backend) + Gemini prompt (UX/design), runs in parallel, explicitly flags disagreements
- **PRD-driven persistence** (Ralph): Auto-generates \`prd.json\`, iterates story-by-story until all stories \`passes: true\`

**Extractable patterns**:
1. Ambiguity gating (mathematical quality assurance for requirements)
2. Skill nesting composition (composable orchestration layers)
3. Commit trailers preserving decision history

## 3. oh-my-openagent: Category > Model Name

**GitHub**: [code-yeongyu/oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent)

**Design philosophy**: "Human intervention is a failure signal" — code should be indistinguishable from a senior engineer's, zero human cleanup needed.

**Architecture highlights**:
- **Hashline LINE#ID edit tool**: Each Read tags lines with content hashes. Edits reject on hash mismatch. Reportedly boosted Grok Code Fast 1 from 6.7% to 68.3% success rate
- **IntentGate keyword detection**: Scans first message for mode keywords, injects mode-specific prompts
- **Adversarial planning (Hyperplan)**: 5 hostile agents attack each other's findings; only survivors enter the plan
- **16-agent release gate**: 10 ultrabrains + 5 review-work + 1 oracle synthesizer

**Extractable patterns**:
1. Category routing (classify by intent, not model name)
2. Adversarial planning (multi-role mutual attack, survivors proceed)
3. Wisdom accumulation notepads (cross-agent forward propagation)

## 4. superpowers: Methodology as Plugin

**GitHub**: [obra/superpowers](https://github.com/obra/superpowers)

**Design philosophy**: A complete software development methodology distributed as a zero-dependency cross-platform plugin. No engine, no orchestrator, no DSL — the "workflow" runs entirely in the agent's own context.

**Architecture highlights**:
- **Skills as TDD tests**: Every behavior rule is verified through RED-GREEN-REFACTOR
- **Anti-rationalization engineering**: Every rule includes a "red flags" table listing every excuse the agent might invent
- **CSO (Claude Search Optimization)**: Skill descriptions contain ONLY trigger conditions, never process summaries
- **7 platform support**: Claude Code / Codex CLI / Codex App / Cursor / Gemini CLI / OpenCode / GitHub Copilot CLI
- **Polyglot hooks**: \`run-hook.cmd\` works as both Windows CMD and Unix bash

**Extractable patterns**:
1. Anti-rationalization tables (preventing agent self-justification)
2. Skill TDD testing methodology
3. CSO description optimization (triggers only, no process)
4. Cross-platform polyglot hooks

## Cross-System Comparison

| System | One-line philosophy | Control strategy | Reuse unit |
|--------|-------------------|-----------------|------------|
| ccg-workflow | "One entry, ten strategies" | State machines + iron rules | Strategy files |
| oh-my-claudecode | "Nestable skill composition" | Hook injection + magic keywords | Skill files |
| oh-my-openagent | "Human intervention = failure" | IntentGate + discipline enforcement | Categorized agents |
| superpowers | "Methodology as plugin" | SessionStart injection + anti-rationalization | Cross-platform skills |

<div class="pullquote">
Four systems took completely different paths but converged: <strong>they all pursue deterministic orchestration</strong> — whether through state machines, hook injection, discipline enforcement, or anti-rationalization engineering. Native Workflow is the most direct path to this goal.
</div>

## Chapter Summary

- Each system has unique design philosophies and innovative patterns worth learning
- ccg: State machines + loop detection + Spec Evolution
- OMC: Ambiguity gating + skill nesting + tri-model advisor
- OmO: Category routing + adversarial planning + Hashline
- Superpowers: Anti-rationalization + TDD skills + CSO + 7 platforms
- All systems pursue determinism — native Workflow is the most direct path
`
};

// ═══ Ch05: agent() Complete Guide ═══
CONTENT['ch05'] = {
zh: `
\`agent()\` 是 Workflow 的核心原语——每一个子 agent 的派遣都通过它完成。本章详解它的每一个参数。

## 函数签名

\`\`\`typescript
agent(prompt: string, opts?: {
  label?: string,        // 显示标签
  phase?: string,        // 归属阶段
  schema?: object,       // JSON Schema 约束输出
  model?: string,        // 模型覆盖
  isolation?: 'worktree',// git worktree 隔离
  agentType?: string,    // 自定义 agent 类型
}): Promise<any>
\`\`\`

## prompt：任务指令

prompt 是你给子 agent 的任务描述。关键原则：

- **子 agent 没有上下文** — 它不知道父对话的内容，必须自包含
- **返回值就是结果** — 子 agent 的最终文本就是返回值（除非使用 schema）
- **要像简报同事** — 解释目标、背景、期望格式

\`\`\`javascript
// 差的 prompt — 假设子 agent 知道上下文
const result = await agent('修复那个 bug')

// 好的 prompt — 自包含、明确
const result = await agent(
  '检查 src/auth/login.ts 文件中的 validateToken 函数。' +
  '查找可能导致 token 过期后仍被接受的 bug。' +
  '报告发现的问题和建议的修复。'
)
\`\`\`

## label：显示标签

\`label\` 覆盖在 \`/workflows\` 进度树中显示的名称。默认会截取 prompt 的前几个词。

\`\`\`javascript
await agent('...long prompt...', { label: 'security-scan' })
// /workflows 中显示：▸ security-scan (running)
\`\`\`

## schema：结构化输出

传入 \`schema\` 后，子 agent 被强制调用 StructuredOutput 工具，返回符合 JSON Schema 的对象。验证失败时模型自动重试。

\`\`\`javascript
const BUG_SCHEMA = {
  type: 'object',
  properties: {
    bugs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          line: { type: 'number' },
          description: { type: 'string' },
          severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        },
        required: ['file', 'description', 'severity'],
      },
    },
    totalCount: { type: 'number' },
  },
  required: ['bugs', 'totalCount'],
}

const result = await agent('Find bugs in src/', { schema: BUG_SCHEMA })
// result.bugs 是一个数组，result.totalCount 是数字
// 类型由 schema 保证，无需手动解析
\`\`\`

<div class="callout tip">
<div class="callout-title">Schema 设计最佳实践</div>
<ul>
<li>使用 <code>description</code> 字段引导模型理解每个属性的含义</li>
<li>使用 <code>enum</code> 约束分类值（如 severity）</li>
<li>只要求 <code>required</code> 必要的字段，给模型空间</li>
<li>数组用 <code>items</code> 定义元素结构</li>
</ul>
</div>

## model：模型覆盖

覆盖子 agent 使用的模型。不指定则继承父模型。

\`\`\`javascript
// 轻量任务用 haiku（快且便宜）
const summary = await agent('Summarize this file', { model: 'haiku' })

// 复杂推理用 opus
const analysis = await agent('Analyze architecture', { model: 'opus' })
\`\`\`

<div class="callout warning">
<div class="callout-title">成本控制</div>
合理使用 model 覆盖可以大幅降低 token 消耗。探索/摘要任务用 haiku，复杂推理/审查用 opus，一般执行用默认模型。
</div>

## isolation：Worktree 隔离

设置 \`isolation: 'worktree'\` 让子 agent 在独立的 git worktree 中工作。适用于多个 agent 需要并行修改文件的场景。

\`\`\`javascript
const results = await parallel([
  () => agent('Refactor auth module', { isolation: 'worktree', label: 'auth-refactor' }),
  () => agent('Refactor db module', { isolation: 'worktree', label: 'db-refactor' }),
])
// 两个 agent 在独立的 worktree 中并行修改，互不冲突
\`\`\`

<div class="callout warning">
<div class="callout-title">开销提醒</div>
worktree 创建有约 200-500ms 的开销加上磁盘使用。仅在 agent 需要并行写文件时使用。如果 agent 未做更改，worktree 自动清理。
</div>

## agentType：自定义类型

使用注册的自定义 agent 类型（如 \`Explore\`、\`code-reviewer\`）替代默认 workflow 子 agent。

\`\`\`javascript
// 使用 Explore agent 进行快速搜索
const found = await agent('Find all usages of validateToken', {
  agentType: 'Explore',
  label: 'token-search',
})
\`\`\`

## phase 选项 vs 全局 phase()

在 \`pipeline()\` 或 \`parallel()\` 内部，使用 agent 的 \`phase\` 选项而非全局 \`phase()\`，避免竞态条件：

\`\`\`javascript
// 在 pipeline 内部使用 phase 选项
await pipeline(files,
  (f) => agent('Review ' + f, { phase: 'Review', label: 'review:' + f }),
  (r) => agent('Verify ' + r.finding, { phase: 'Verify', label: 'verify:' + r.file }),
)
\`\`\`

## 返回值规则

- **无 schema** → 返回 agent 的最终文本（string）
- **有 schema** → 返回验证后的 JSON 对象
- **agent 被用户跳过** → 返回 \`null\`（用 \`.filter(Boolean)\` 过滤）
- **agent 出错** → 在 parallel/pipeline 中解析为 \`null\`

## 并发限制

并发 agent 数量上限为 \`min(16, CPU 核心数 - 2)\`。超出的调用排队等候。单个 workflow 生命周期内 agent 总数上限为 1000。

## 本章小结

- \`agent()\` 是 Workflow 的核心，每次派遣都通过它
- prompt 必须自包含——子 agent 没有父对话上下文
- \`schema\` 约束输出为类型安全的 JSON 对象
- \`model\` 覆盖实现成本控制（haiku/sonnet/opus 分层）
- \`isolation: 'worktree'\` 用于并行文件修改场景
- 并发上限 min(16, CPU-2)，总 agent 上限 1000
`,
en: `
\`agent()\` is Workflow's core primitive — every subagent dispatch goes through it. This chapter details every parameter.

## Function Signature

\`\`\`typescript
agent(prompt: string, opts?: {
  label?: string,        // display label
  phase?: string,        // phase grouping
  schema?: object,       // JSON Schema to constrain output
  model?: string,        // model override
  isolation?: 'worktree',// git worktree isolation
  agentType?: string,    // custom agent type
}): Promise<any>
\`\`\`

## prompt: Task Instruction

The prompt is your task description for the subagent. Key principles:

- **Subagents have no context** — they don't know the parent conversation, must be self-contained
- **Return value IS the result** — the subagent's final text is the return value (unless using schema)
- **Brief like a colleague** — explain the goal, background, expected format

\`\`\`javascript
// Bad prompt — assumes subagent knows context
const result = await agent('Fix that bug')

// Good prompt — self-contained, explicit
const result = await agent(
  'Check the validateToken function in src/auth/login.ts. ' +
  'Look for bugs that might allow expired tokens to be accepted. ' +
  'Report findings and suggested fixes.'
)
\`\`\`

## label: Display Label

\`label\` overrides the name shown in the \`/workflows\` progress tree.

## schema: Structured Output

When \`schema\` is passed, the subagent is forced to call the StructuredOutput tool, returning an object conforming to the JSON Schema. The model auto-retries on validation failure.

\`\`\`javascript
const BUG_SCHEMA = {
  type: 'object',
  properties: {
    bugs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          line: { type: 'number' },
          description: { type: 'string' },
          severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        },
        required: ['file', 'description', 'severity'],
      },
    },
    totalCount: { type: 'number' },
  },
  required: ['bugs', 'totalCount'],
}

const result = await agent('Find bugs in src/', { schema: BUG_SCHEMA })
// result.bugs is an array, result.totalCount is a number
// Types guaranteed by schema — no manual parsing needed
\`\`\`

## model: Model Override

Override the model used by the subagent. Defaults to inheriting the parent model.

\`\`\`javascript
// Lightweight tasks use haiku (fast and cheap)
const summary = await agent('Summarize this file', { model: 'haiku' })

// Complex reasoning uses opus
const analysis = await agent('Analyze architecture', { model: 'opus' })
\`\`\`

## isolation: Worktree Isolation

Setting \`isolation: 'worktree'\` makes the subagent work in an isolated git worktree. Use when multiple agents need to modify files in parallel.

## agentType: Custom Types

Use registered custom agent types (e.g., \`Explore\`, \`code-reviewer\`) instead of the default workflow subagent.

## Concurrency Limits

Concurrent agent cap: \`min(16, CPU cores - 2)\`. Excess calls queue up. Total agent count per workflow lifetime: 1000.

## Chapter Summary

- \`agent()\` is Workflow's core — every dispatch goes through it
- Prompts must be self-contained — subagents have no parent context
- \`schema\` constrains output to type-safe JSON objects
- \`model\` override enables cost control (haiku/sonnet/opus tiering)
- \`isolation: 'worktree'\` for parallel file modification scenarios
- Concurrency cap: min(16, CPU-2), total agent cap: 1000
`
};

// ═══ Ch06: Concurrency ═══
CONTENT['ch06'] = {
zh: `
\`parallel()\` 和 \`pipeline()\` 是 Workflow 的两种并发模式。选错了，你的 workflow 要么慢得不必要，要么等得毫无意义。

## 核心区别

| 维度 | parallel() | pipeline() |
|------|-----------|------------|
| **语义** | 屏障（barrier） | 流水线（streaming） |
| **行为** | 等所有完成才继续 | 每个 item 独立流过所有 stage |
| **耗时** | 最慢的那个 agent | 最慢的单 item 链 |
| **用例** | 需要全部结果才能继续 | 每个 item 可独立处理 |

## parallel()：屏障模式

\`\`\`javascript
const results = await parallel([
  () => agent('Review security'),
  () => agent('Review performance'),
  () => agent('Review architecture'),
])
// results = [securityResult, perfResult, archResult]
// 三个都完成后才继续
\`\`\`

**何时使用**：
- 下一步需要**所有**前一步的结果（如去重、合并、对比）
- 需要计算总数后决定是否继续（如"0 个 bug → 跳过验证"）
- 下一步的 prompt 需要引用"其他 agent 的发现"

**我们的实测**：parallel test 运行 3 个审查 agent，43.6 秒全部完成，149K tokens。

## pipeline()：流水线模式

\`\`\`javascript
const results = await pipeline(
  ['file1.ts', 'file2.ts', 'file3.ts'],
  (file) => agent('Review ' + file, { schema: REVIEW_SCHEMA }),
  (review) => agent('Verify: ' + review.finding, { schema: VERDICT_SCHEMA }),
)
// file1 可能已在 verify 阶段，而 file3 还在 review 阶段
\`\`\`

**何时使用**（默认选择）：
- 每个 item 的处理是独立的
- stage 之间不需要跨 item 的信息
- 想最大化并行度，减少等待时间

**我们的实测**：pipeline test 运行 2 维度 × 2 阶段（发现+验证），127 秒，6 个 agent，240K tokens。发现 4 个真实问题且全部通过验证。

## 决策树

\`\`\`
你的 stage N 需要 stage N-1 的【全部】结果吗？
│
├─ 是 → parallel()（屏障）
│   例：去重、合并、统计总数、跨 item 对比
│
└─ 否 → pipeline()（默认）
    例：每个文件独立审查→验证
        每个 bug 独立发现→确认
\`\`\`

<div class="callout warning">
<div class="callout-title">常见错误</div>
如果你写了：<code>const a = await parallel(...); const b = transform(a); const c = await parallel(b.map(...))</code>，中间的 transform 只是 flatten/map/filter 而没有跨 item 依赖——那个 parallel 屏障就是浪费。改用 pipeline 把 transform 放在 stage 里。
</div>

## 混合模式

pipeline 的 stage 内部可以嵌套 parallel：

\`\`\`javascript
const results = await pipeline(
  DIMENSIONS,
  // Stage 1: 每个维度独立发现问题
  (d) => agent(d.prompt, { schema: FINDINGS_SCHEMA }),
  // Stage 2: 每个发现独立验证（但同一维度的验证并行）
  (review) => parallel(
    review.findings.map(f => () =>
      agent('Verify: ' + f.title, { schema: VERDICT_SCHEMA })
    )
  ),
)
\`\`\`

## 本章小结

- **默认用 pipeline()**——除非你有明确理由需要屏障
- parallel() 用于需要全部结果才能继续的场景
- pipeline() 的耗时 = 最慢的单 item 链（而非最慢的阶段之和）
- 混合模式：pipeline stage 内嵌 parallel
- 实测数据：3 agent parallel = 43.6s；6 agent pipeline = 127s
`,
en: `
\`parallel()\` and \`pipeline()\` are Workflow's two concurrency modes. Choose wrong, and your workflow is either unnecessarily slow or pointlessly waiting.

## Core Difference

| Dimension | parallel() | pipeline() |
|-----------|-----------|------------|
| **Semantics** | Barrier | Streaming |
| **Behavior** | Wait for ALL to complete | Each item flows through all stages independently |
| **Duration** | Slowest agent | Slowest single-item chain |
| **Use case** | Need all results to continue | Each item can be processed independently |

## parallel(): Barrier Mode

\`\`\`javascript
const results = await parallel([
  () => agent('Review security'),
  () => agent('Review performance'),
  () => agent('Review architecture'),
])
// All three must complete before code continues
\`\`\`

**When to use**:
- Next step needs **all** previous results (dedup, merge, compare)
- Need to count totals before deciding whether to continue
- Next step references "other agents' findings"

**Our test**: parallel test ran 3 review agents, all completed in 43.6s, 149K tokens.

## pipeline(): Streaming Mode

\`\`\`javascript
const results = await pipeline(
  ['file1.ts', 'file2.ts', 'file3.ts'],
  (file) => agent('Review ' + file, { schema: REVIEW_SCHEMA }),
  (review) => agent('Verify: ' + review.finding, { schema: VERDICT_SCHEMA }),
)
// file1 might be in verify stage while file3 is still in review
\`\`\`

**When to use** (DEFAULT choice):
- Each item's processing is independent
- No cross-item information needed between stages
- Want to maximize parallelism and reduce wait time

**Our test**: pipeline test ran 2 dimensions × 2 stages (find+verify), 127s, 6 agents, 240K tokens. Found 4 real issues, all verified.

## Decision Tree

\`\`\`
Does your stage N need ALL results from stage N-1?
│
├─ Yes → parallel() (barrier)
│   e.g., dedup, merge, count totals, cross-item comparison
│
└─ No → pipeline() (default)
    e.g., review each file independently → verify
         find each bug independently → confirm
\`\`\`

## Hybrid Mode

pipeline stages can nest parallel inside:

\`\`\`javascript
const results = await pipeline(
  DIMENSIONS,
  (d) => agent(d.prompt, { schema: FINDINGS_SCHEMA }),
  (review) => parallel(
    review.findings.map(f => () =>
      agent('Verify: ' + f.title, { schema: VERDICT_SCHEMA })
    )
  ),
)
\`\`\`

## Chapter Summary

- **Default to pipeline()** — unless you have a clear reason for a barrier
- parallel() for when you need all results before continuing
- pipeline() duration = slowest single-item chain (not sum of slowest per stage)
- Hybrid: pipeline stage nesting parallel
- Test data: 3 agent parallel = 43.6s; 6 agent pipeline = 127s
`
};

// ═══ Ch09: Sharded Code Review ═══
CONTENT['ch09'] = {
zh: `
这是 Workflow 最经典的用例之一：将大型代码库拆分成多个分片，并行审查，然后对抗验证每个发现。

## 为什么需要分片

当代码库有数百个文件时，单个 agent 的上下文窗口无法容纳全部代码。分片审查的策略是：

1. 将代码库按模块/目录拆分成独立分片
2. 每个分片派遣一个独立的审查 agent
3. 收集所有发现后，用对抗验证过滤误报
4. 综合输出最终报告

## 完整 Workflow 脚本

\`\`\`javascript
export const meta = {
  name: 'sharded-review',
  description: 'Sharded code review with adversarial verification',
  phases: [
    { title: 'Scan', detail: 'Discover code shards' },
    { title: 'Review', detail: 'Review each shard independently' },
    { title: 'Verify', detail: 'Adversarially verify findings' },
    { title: 'Synthesize', detail: 'Produce final report' },
  ],
}

const FINDING_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          title: { type: 'string' },
          severity: { type: 'string', enum: ['low','medium','high','critical'] },
          description: { type: 'string' },
        },
        required: ['file', 'title', 'severity'],
      },
    },
  },
  required: ['findings'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    isReal: { type: 'boolean' },
    explanation: { type: 'string' },
  },
  required: ['isReal', 'explanation'],
}

// Phase 1: Discover shards
phase('Scan')
const shards = await agent(
  'List the top-level directories in this project that contain source code. Return as a JSON array of directory paths.',
  { schema: { type: 'object', properties: { dirs: { type: 'array', items: { type: 'string' } } }, required: ['dirs'] } }
)

// Phase 2: Review each shard — using pipeline for streaming
phase('Review')
log('Reviewing ' + shards.dirs.length + ' shards')

const results = await pipeline(
  shards.dirs,
  // Stage 1: Review
  (dir) => agent(
    'Review all code in ' + dir + ' for bugs, security issues, and code smells. Be thorough.',
    { schema: FINDING_SCHEMA, label: 'review:' + dir, phase: 'Review' }
  ),
  // Stage 2: Verify each finding
  (review, dir) => parallel(
    (review?.findings || []).map(f => () =>
      agent(
        'Adversarially verify this finding. Try to REFUTE it. ' +
        'Default to isReal=true only if you cannot find a counter-argument.\\n' +
        'Finding: ' + f.title + ' in ' + f.file + '\\n' +
        'Description: ' + f.description,
        { schema: VERDICT_SCHEMA, label: 'verify:' + f.title.slice(0,20), phase: 'Verify' }
      ).then(v => ({ ...f, verdict: v }))
    )
  ),
)

// Phase 4: Synthesize
phase('Synthesize')
const confirmed = results.flat().filter(Boolean).filter(f => f.verdict?.isReal)
const report = await agent(
  'Synthesize a final code review report from these confirmed findings:\\n' +
  JSON.stringify(confirmed, null, 2),
  { label: 'synthesizer' }
)

return { totalShards: shards.dirs.length, totalFindings: results.flat().filter(Boolean).length, confirmedFindings: confirmed.length, report }
\`\`\`

## 关键设计决策

### 为什么用 pipeline 而非 parallel？

Stage 1（审查）和 Stage 2（验证）之间不需要跨分片信息。分片 A 的验证可以在分片 B 还在审查时就开始。pipeline 减少了等待时间。

### 为什么对抗验证？

单次审查的误报率很高——agent 容易报告"可能是问题"的模糊发现。对抗验证让一个独立 agent 尝试**反驳**每个发现。如果无法反驳，该发现大概率是真实的。

### Schema 的作用

\`FINDING_SCHEMA\` 确保每个审查 agent 返回结构化的发现列表，而非自由文本。这让后续的验证阶段可以程序化地遍历每个发现。

## 本章小结

- 分片审查 = 分治 + 并行 + 对抗验证
- 使用 pipeline() 让审查和验证流式进行
- 对抗验证：独立 agent 尝试反驳每个发现
- Schema 约束保证跨阶段数据流的结构化
`,
en: `
This is one of Workflow's most classic use cases: splitting a large codebase into shards, reviewing in parallel, then adversarially verifying each finding.

## Why Sharding

When a codebase has hundreds of files, a single agent's context window can't hold all the code. The sharded review strategy:

1. Split the codebase into independent shards by module/directory
2. Dispatch an independent review agent per shard
3. After collecting all findings, use adversarial verification to filter false positives
4. Synthesize the final report

## Complete Workflow Script

\`\`\`javascript
export const meta = {
  name: 'sharded-review',
  description: 'Sharded code review with adversarial verification',
  phases: [
    { title: 'Scan', detail: 'Discover code shards' },
    { title: 'Review', detail: 'Review each shard independently' },
    { title: 'Verify', detail: 'Adversarially verify findings' },
    { title: 'Synthesize', detail: 'Produce final report' },
  ],
}
// ... (full script in the Chinese version above)
\`\`\`

## Key Design Decisions

### Why pipeline instead of parallel?

No cross-shard information needed between Stage 1 (review) and Stage 2 (verify). Shard A's verification can start while Shard B is still being reviewed. Pipeline reduces wait time.

### Why adversarial verification?

Single-pass review has high false-positive rates — agents tend to report vague "might be an issue" findings. Adversarial verification lets an independent agent try to **refute** each finding. If it can't be refuted, the finding is likely real.

### Role of Schema

\`FINDING_SCHEMA\` ensures each review agent returns a structured findings list, not free text. This lets the verification stage programmatically iterate over each finding.

## Chapter Summary

- Sharded review = divide-and-conquer + parallel + adversarial verification
- Use pipeline() for streaming review and verification
- Adversarial verification: independent agent tries to refute each finding
- Schema constraints ensure structured data flow across stages
`
};

// ═══ Ch07: Structured Output ═══
CONTENT['ch07'] = {
zh: `
结构化输出是 Workflow 区别于 Subagents 的核心能力之一。通过 JSON Schema 约束，agent 的输出不再是自由文本，而是类型安全的数据对象。

## 为什么需要结构化输出

自由文本输出有两个致命问题：

1. **解析脆弱**：你需要用正则或字符串操作提取信息，格式稍有变化就会失败
2. **跨阶段传递困难**：下游 agent 需要准确理解上游的输出格式

Schema 解决了这两个问题——输出格式由你的 JSON Schema 定义，验证在工具层自动完成。

## 基本用法

\`\`\`javascript
const SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    score: { type: 'number', minimum: 0, maximum: 100 },
    tags: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'score'],
}

const result = await agent('Analyze this code', { schema: SCHEMA })
// result.summary — 保证是 string
// result.score — 保证是 0-100 的数字
// result.tags — 可选，如果提供则是 string 数组
\`\`\`

## 复杂嵌套 Schema

我们实测了一个包含嵌套对象、枚举约束和数组的复杂 Schema：

\`\`\`javascript
const COMPLEX_SCHEMA = {
  type: 'object',
  properties: {
    analysis: {
      type: 'object',
      properties: {
        projectName: { type: 'string' },
        languages: { type: 'array', items: { type: 'string' } },
        metrics: {
          type: 'object',
          properties: {
            complexity: { type: 'string', enum: ['low', 'medium', 'high'] },
          },
          required: ['complexity'],
        },
      },
      required: ['projectName', 'languages', 'metrics'],
    },
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          priority: { type: 'number', minimum: 1, maximum: 5 },
          action: { type: 'string' },
        },
        required: ['priority', 'action'],
      },
    },
  },
  required: ['analysis', 'recommendations'],
}
\`\`\`

<div class="test-result">
<div class="test-header">
<span class="status pass">PASS</span>
<span class="test-name">schema-validation</span>
</div>
<div class="test-output">
Schema: 3-level nested object + enum + numeric range + array
Validation: passed on first attempt, no retries
Agent count: 1 | Total tokens: 59,412 | Duration: 76.3s
</div>
</div>

<div class="callout tip">
<div class="callout-title">实测结论</div>
复杂嵌套 Schema（3 层嵌套 + enum + 数组 + 数值范围约束）在实测中一次通过验证，无需重试。模型对 JSON Schema 的理解非常可靠。
</div>

## 跨阶段数据流

Schema 的真正威力在于跨阶段的类型安全数据流：

\`\`\`javascript
const FINDING = {
  type: 'object',
  properties: {
    findings: { type: 'array', items: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        severity: { type: 'string', enum: ['low','medium','high'] },
      },
      required: ['title', 'severity'],
    }},
  },
  required: ['findings'],
}

const VERDICT = {
  type: 'object',
  properties: {
    isReal: { type: 'boolean' },
    explanation: { type: 'string' },
  },
  required: ['isReal'],
}

// Stage 1 的输出直接作为 Stage 2 的输入
const results = await pipeline(items,
  (item) => agent('Find issues in ' + item, { schema: FINDING }),
  (review) => parallel(
    review.findings.map(f => () =>
      agent('Verify: ' + f.title, { schema: VERDICT })
    )
  ),
)
\`\`\`

## Schema 设计最佳实践

1. **使用 \`description\`**：帮助模型理解每个字段的含义
2. **使用 \`enum\`**：约束分类值，避免模型自由发挥
3. **最小化 \`required\`**：只要求必要字段
4. **嵌套不超过 3 层**：过深的嵌套增加验证复杂度
5. **数组用 \`items\`**：明确定义数组元素结构

## 本章小结

- Schema 约束让 agent 输出变成类型安全的 JSON 对象
- 验证在工具层自动完成，失败时模型自动重试
- 复杂嵌套 Schema（3 层 + enum + 数值范围）实测可靠
- 跨阶段数据流是 Schema 的核心价值
`,
en: `
Structured output is one of Workflow's core differentiators from Subagents. Through JSON Schema constraints, agent output is no longer free text but type-safe data objects.

## Why Structured Output

Free-text output has two fatal problems:

1. **Fragile parsing**: You need regex or string operations, which break on format changes
2. **Hard to pass across stages**: Downstream agents need to accurately understand upstream output format

Schema solves both — output format defined by your JSON Schema, validation handled automatically at the tool layer.

## Basic Usage

\`\`\`javascript
const SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    score: { type: 'number', minimum: 0, maximum: 100 },
    tags: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'score'],
}

const result = await agent('Analyze this code', { schema: SCHEMA })
// result.summary — guaranteed string
// result.score — guaranteed number 0-100
\`\`\`

## Complex Nested Schema

We tested a complex Schema with nested objects, enum constraints, and arrays:

<div class="test-result">
<div class="test-header">
<span class="status pass">PASS</span>
<span class="test-name">schema-validation</span>
</div>
<div class="test-output">
Schema: 3-level nested object + enum + numeric range + array
Validation: passed on first attempt, no retries
Agent count: 1 | Total tokens: 59,412 | Duration: 76.3s
</div>
</div>

It passed validation on the first try with no retries needed. The model's understanding of JSON Schema is remarkably reliable.

## Cross-Stage Data Flow

Schema's real power is type-safe data flow across stages — Stage 1's structured output feeds directly into Stage 2's input.

## Schema Design Best Practices

1. Use \`description\` to help the model understand each field
2. Use \`enum\` to constrain categorical values
3. Minimize \`required\` — only require necessary fields
4. Keep nesting under 3 levels
5. Define array element structure with \`items\`

## Chapter Summary

- Schema constraints turn agent output into type-safe JSON objects
- Validation is automatic at the tool layer, with auto-retry on failure
- Complex nested schemas (3 levels + enum + numeric ranges) are reliable in testing
- Cross-stage data flow is Schema's core value
`
};

// ═══ Ch11: GCF Loop ═══
CONTENT['ch11'] = {
zh: `
生成-批评-修复（Generate-Critique-Fix）是一个经典的迭代改进模式。用一个 agent 生成，另一个独立 agent 批评，必要时第三个 agent 修复。

## 模式原理

\`\`\`
Generator → Critic → (通过？完成 : Fixer → Critic → ...)
\`\`\`

关键设计：**Critic 必须独立于 Generator**。如果让同一个 agent 自己批评自己的代码，它会倾向于"确认偏差"——认为自己的代码没问题。

## 完整 Workflow 脚本

\`\`\`javascript
export const meta = {
  name: 'gcf-loop',
  description: 'Generate-Critique-Fix iterative improvement',
  phases: [
    { title: 'Generate', detail: 'Generate initial code' },
    { title: 'Critique', detail: 'Independent critique' },
    { title: 'Fix', detail: 'Fix based on critique' },
  ],
}

const CODE_SCHEMA = {
  type: 'object',
  properties: {
    code: { type: 'string' },
    description: { type: 'string' },
  },
  required: ['code', 'description'],
}

const CRITIQUE_SCHEMA = {
  type: 'object',
  properties: {
    issues: { type: 'array', items: {
      type: 'object',
      properties: {
        issue: { type: 'string' },
        severity: { type: 'string', enum: ['low','medium','high'] },
      },
      required: ['issue', 'severity'],
    }},
    passesReview: { type: 'boolean' },
  },
  required: ['issues', 'passesReview'],
}

phase('Generate')
const generated = await agent(
  'Write a debounce function in JavaScript.',
  { schema: CODE_SCHEMA, label: 'generator' }
)

phase('Critique')
const critique = await agent(
  'Critique this code for bugs and edge cases. Be strict.\\n' + generated.code,
  { schema: CRITIQUE_SCHEMA, label: 'critic' }
)

if (!critique.passesReview) {
  phase('Fix')
  const fixed = await agent(
    'Fix these issues:\\n' + critique.issues.map(i => '- ' + i.issue).join('\\n'),
    { schema: CODE_SCHEMA, label: 'fixer' }
  )
}
\`\`\`

## 真实运行结果

<div class="test-result">
<div class="test-header">
<span class="status pass">PASS</span>
<span class="test-name">gcf-loop-test</span>
</div>
<div class="test-output">
{
  "testName": "gcf-loop",
  "rounds": 1,
  "issuesFound": 5,
  "issues": [
    {"issue": "No cancel/flush method exposed", "severity": "medium"},
    {"issue": "Return value of fn is silently discarded", "severity": "medium"},
    {"issue": "this binding in detached calls", "severity": "low"},
    {"issue": "delay not validated (NaN/negative)", "severity": "low"},
    {"issue": "Last args retained until timer fires", "severity": "low"}
  ]
}

Agent count: 2 (generator + critic)
Total tokens: 54,216
Duration: 32.8s
</div>
</div>

**关键发现**：

1. **Critic 真的很严格** — 发现了 5 个真实问题（2 个 medium、3 个 low）
2. **但 passesReview = true** — Critic 认为这些是改进建议，不是致命缺陷
3. **所以只跑了 1 轮** — 没有触发 Fix 阶段
4. **这说明** — 你的 prompt 需要明确告诉 Critic"有 medium 以上问题就不通过"

<div class="callout info">
<div class="callout-title">改进提示</div>
如果想让 Critic 更严格，在 prompt 中明确：<code>"如果发现任何 medium 或 high severity 的问题，设置 passesReview 为 false"</code>。
</div>

## 多轮循环设计

\`\`\`javascript
let code = generated.code
let round = 0
const MAX_ROUNDS = 3

while (round < MAX_ROUNDS) {
  const critique = await agent('Critique: ' + code, { schema: CRITIQUE_SCHEMA })
  if (critique.passesReview) break

  code = (await agent('Fix: ' + critique.issues.map(i => i.issue).join(', '),
    { schema: CODE_SCHEMA })).code
  round++
}
\`\`\`

## 本章小结

- GCF = 生成 → 独立批评 → 条件修复
- Critic 必须是独立 agent（避免确认偏差）
- prompt 要明确通过/不通过的标准
- 实测：2 agents, 54K tokens, 32.8s, 发现 5 个真实问题
`,
en: `
Generate-Critique-Fix (GCF) is a classic iterative improvement pattern. One agent generates, another independent agent critiques, and a third fixes if needed.

## Pattern

\`\`\`
Generator → Critic → (passes? done : Fixer → Critic → ...)
\`\`\`

Key design: **Critic must be independent from Generator**. If the same agent critiques its own code, it will tend toward confirmation bias.

## Real Execution Results

<div class="test-result">
<div class="test-header">
<span class="status pass">PASS</span>
<span class="test-name">gcf-loop-test</span>
</div>
<div class="test-output">
Rounds: 1 (critic found 5 issues but passesReview=true)
Issues: 2 medium + 3 low severity
Agent count: 2 | Tokens: 54,216 | Duration: 32.8s
</div>
</div>

**Key Finding**: The critic found 5 real issues but still set \`passesReview: true\` — your prompt needs to explicitly define pass/fail criteria.

## Multi-Round Loop Design

Add a \`while\` loop with \`MAX_ROUNDS\` to iterate until the critic passes or the round limit is reached.

## Chapter Summary

- GCF = Generate → Independent Critique → Conditional Fix
- Critic must be an independent agent (avoid confirmation bias)
- Prompt must explicitly define pass/fail criteria
- Test result: 2 agents, 54K tokens, 32.8s, found 5 real issues
`
};

// ═══ Ch15: Budget Control ═══
CONTENT['ch15'] = {
zh: `
\`budget\` 对象让你根据用户的 token 预算动态控制 workflow 的深度。用户通过 "+500k" 指令设定预算，你的 workflow 据此自适应。

## budget 对象

\`\`\`javascript
budget: {
  total: number | null,  // 用户设定的目标（null = 未设置）
  spent(): number,       // 已消耗的 output tokens（共享池）
  remaining(): number,   // max(0, total - spent())，无目标时为 Infinity
}
\`\`\`

## 基本用法：循环到预算耗尽

\`\`\`javascript
const bugs = []

// 只在设置了预算时才循环
while (budget.total && budget.remaining() > 50_000) {
  const result = await agent('Find more bugs', { schema: BUGS_SCHEMA })
  bugs.push(...result.bugs)
  log(bugs.length + ' bugs found, ' +
      Math.round(budget.remaining() / 1000) + 'k remaining')
}
\`\`\`

<div class="callout warning">
<div class="callout-title">必须检查 budget.total</div>
<code>budget.total</code> 为 null 时，<code>remaining()</code> 返回 Infinity。如果不检查 <code>budget.total</code>，你的循环会跑到 1000 agent 的上限。
</div>

## 静态缩放

根据预算计算并行 agent 数量：

\`\`\`javascript
const FLEET_SIZE = budget.total
  ? Math.floor(budget.total / 100_000)  // 每 100k 一个 agent
  : 5  // 默认 5 个

const results = await parallel(
  Array.from({ length: FLEET_SIZE }, (_, i) => () =>
    agent('Search for bugs in area ' + i, { schema: BUGS_SCHEMA })
  )
)
\`\`\`

## 计数循环 vs 预算循环

\`\`\`javascript
// 计数循环 — 固定目标
const bugs = []
while (bugs.length < 10) {
  const result = await agent('Find bugs')
  bugs.push(...result.bugs)
}

// 预算循环 — 自适应深度
while (budget.total && budget.remaining() > 50_000) {
  const result = await agent('Find bugs')
  bugs.push(...result.bugs)
}
\`\`\`

## 预算是硬上限

预算目标是**硬上限**，不是建议值。当 \`spent()\` 达到 \`total\` 时，后续的 \`agent()\` 调用会抛出异常。

## 共享池

预算池在主循环和所有 workflow 之间共享——不是每个 workflow 独立计算。嵌套 workflow 通过 \`workflow()\` 调用时，子 workflow 的 agent 消耗也计入同一个池。

## 本章小结

- \`budget\` 对象包含 total / spent() / remaining()
- 循环前必须检查 \`budget.total\`（null 时 remaining 为 Infinity）
- 预算是硬上限，不是建议值
- 预算池在主循环和所有 workflow 之间共享
- 两种模式：动态循环（loop-until-budget）和静态缩放（按预算算 fleet 大小）
`,
en: `
The \`budget\` object lets you dynamically control workflow depth based on the user's token budget. Users set budgets via "+500k" directives, and your workflow adapts accordingly.

## The budget Object

\`\`\`javascript
budget: {
  total: number | null,  // user-set target (null = not set)
  spent(): number,       // output tokens spent (shared pool)
  remaining(): number,   // max(0, total - spent()), Infinity if no target
}
\`\`\`

## Basic Usage: Loop Until Budget Exhausted

\`\`\`javascript
while (budget.total && budget.remaining() > 50_000) {
  const result = await agent('Find more bugs', { schema: BUGS_SCHEMA })
  bugs.push(...result.bugs)
}
\`\`\`

<div class="callout warning">
<div class="callout-title">Must Check budget.total</div>
When <code>budget.total</code> is null, <code>remaining()</code> returns Infinity. Without checking, your loop runs to the 1000-agent cap.
</div>

## Chapter Summary

- budget includes total / spent() / remaining()
- Always check budget.total before looping (null = Infinity remaining)
- Budget is a hard ceiling, not advisory
- Budget pool is shared across main loop and all workflows
- Two patterns: dynamic loop (loop-until-budget) and static scaling (fleet size from budget)
`
};

// ═══ AppA: API Reference ═══
CONTENT['appA'] = {
zh: `
本附录列出 Workflow 脚本中可用的所有 API。

## meta（必需）

每个脚本**必须**以 \`export const meta = {...}\` 开头。

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| \`name\` | string | 是 | kebab-case 标识符 |
| \`description\` | string | 是 | 一行描述，显示在权限对话框 |
| \`phases\` | Array | 否 | \`{title, detail?, model?}\` |
| \`whenToUse\` | string | 否 | 显示在 workflow 列表中 |

## agent(prompt, opts?)

派遣一个子 agent。

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| \`prompt\` | string | — | 任务描述（必须自包含） |
| \`opts.label\` | string | — | 进度树中的显示标签 |
| \`opts.phase\` | string | — | 显式归属阶段（pipeline/parallel 内使用） |
| \`opts.schema\` | object | — | JSON Schema，强制结构化输出 |
| \`opts.model\` | string | 继承 | 模型覆盖：'sonnet' / 'opus' / 'haiku' |
| \`opts.isolation\` | 'worktree' | — | git worktree 隔离 |
| \`opts.agentType\` | string | — | 自定义 agent 类型 |

**返回值**：无 schema → string；有 schema → validated object；用户跳过 → null

## parallel(thunks)

并发运行所有 thunk，等待全部完成。

| 参数 | 类型 | 说明 |
|------|------|------|
| \`thunks\` | Array<() => Promise> | 函数数组 |

**返回值**：\`any[]\`（抛出异常的 thunk 对应位置为 null）

## pipeline(items, ...stages)

让每个 item 独立流过所有 stage。

| 参数 | 类型 | 说明 |
|------|------|------|
| \`items\` | Array | 输入项数组 |
| \`stage1\` | (prevResult, originalItem, index) => Promise | 第一个 stage |
| \`stage2...\` | (prevResult, originalItem, index) => Promise | 后续 stage |

**返回值**：\`any[]\`（抛出异常的 item 对应位置为 null）

## phase(title)

开始一个新阶段，后续 agent 调用归入此阶段。

## log(message)

向用户发送进度消息。

## budget

| 属性/方法 | 类型 | 说明 |
|----------|------|------|
| \`budget.total\` | number \\| null | 用户设定的 token 目标 |
| \`budget.spent()\` | number | 已消耗的 output tokens |
| \`budget.remaining()\` | number | 剩余（无目标时为 Infinity） |

## workflow(nameOrRef, args?)

运行另一个 workflow。

| 参数 | 类型 | 说明 |
|------|------|------|
| \`nameOrRef\` | string \\| {scriptPath} | 名称或脚本路径 |
| \`args\` | any | 传递给子 workflow 的参数 |

## args

通过 Workflow 工具的 \`args\` 输入传入的值。

## 并发限制

- 最大并发：\`min(16, CPU 核心数 - 2)\`
- 生命周期内最大 agent 数：1000

## 脚本限制

- \`Date.now()\` / \`Math.random()\` / 无参 \`new Date()\` 不可用（会破坏 resume）
- 无文件系统或 Node.js API 访问
- 标准 JS 内置对象（JSON, Math, Array 等）可用
`,
en: `
This appendix lists all APIs available in Workflow scripts.

## meta (Required)

Every script **must** start with \`export const meta = {...}\`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| \`name\` | string | Yes | kebab-case identifier |
| \`description\` | string | Yes | One-line, shown in permission dialog |
| \`phases\` | Array | No | \`{title, detail?, model?}\` |

## agent(prompt, opts?)

Dispatch a subagent.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| \`prompt\` | string | — | Task description (must be self-contained) |
| \`opts.label\` | string | — | Display label in progress tree |
| \`opts.phase\` | string | — | Assign to a progress group (use inside pipeline/parallel) |
| \`opts.schema\` | object | — | JSON Schema for structured output |
| \`opts.model\` | string | inherited | 'sonnet' / 'opus' / 'haiku' |
| \`opts.isolation\` | 'worktree' | — | Run in a fresh git worktree (~200-500ms overhead) |
| \`opts.agentType\` | string | — | Custom agent type (e.g. 'Explore', 'code-reviewer') |

**Return value**: no schema → string; with schema → validated object; user skips → null

## parallel(thunks)

Run all thunks concurrently, wait for all to complete (barrier).

| Param | Type | Description |
|-------|------|-------------|
| \`thunks\` | Array<() => Promise> | Array of functions |

**Return value**: \`any[]\` (thunks that throw resolve to null at their position)

## pipeline(items, ...stages)

Each item flows through all stages independently, NO barrier between stages.

| Param | Type | Description |
|-------|------|-------------|
| \`items\` | Array | Input items array |
| \`stage1\` | (prevResult, originalItem, index) => Promise | First stage |
| \`stage2...\` | (prevResult, originalItem, index) => Promise | Subsequent stages |

**Return value**: \`any[]\` (items that throw resolve to null at their position)

## phase(title)

Start a new phase. Subsequent agent() calls are grouped under this title in the progress display.

## log(message)

Emit a progress message to the user (shown as a narrator line above the progress tree).

## budget

| Property | Type | Description |
|----------|------|-------------|
| \`budget.total\` | number \\| null | User-set token target (null if not set) |
| \`budget.spent()\` | number | Output tokens consumed across main loop + all workflows |
| \`budget.remaining()\` | number | \`max(0, total - spent())\`, or Infinity if no target |

## workflow(nameOrRef, args?)

Run another workflow inline as a sub-step.

| Param | Type | Description |
|-------|------|-------------|
| \`nameOrRef\` | string \\| {scriptPath} | Name or script path |
| \`args\` | any | Arguments passed to child workflow |

Child shares parent's concurrency cap, agent counter, abort signal, and token budget. Nesting is one level only.

## args

The value passed as Workflow tool's \`args\` input. Use to parameterize named workflows.

## Concurrency Limits

- Max concurrent: \`min(16, CPU cores - 2)\`
- Max lifetime agents: 1000

## Script Restrictions

- \`Date.now()\` / \`Math.random()\` / no-arg \`new Date()\` unavailable (breaks resume)
- No filesystem or Node.js API access
- Standard JS built-ins (JSON, Math, Array, etc.) available
`
};

// ═══ Ch08: Monitoring & Debugging ═══
CONTENT['ch08'] = {
zh: `
Workflow 运行时，你需要知道它在做什么、哪里卡住了、为什么失败了。

## phase()：进度分组

\`phase('Title')\` 将后续的 agent 调用归入一个视觉分组。在 \`/workflows\` 命令中显示为树状结构：

\`\`\`
▸ sharded-review (running)
  ▸ Scan ✓
  ▸ Review
    ▸ review:src (running)
    ▸ review:lib (running)
    ▸ review:tests ✓
  ▸ Verify (pending)
\`\`\`

## log()：进度消息

\`log(message)\` 向用户发送一条进度消息，显示在进度树上方。

\`\`\`javascript
log('Found ' + bugs.length + ' bugs so far')
log('Starting verification of ' + findings.length + ' findings')
\`\`\`

## /workflows 命令

在 Claude Code 中输入 \`/workflows\` 可以实时查看所有正在运行的 workflow 的进度。

## 调试失败的 Workflow

当 workflow 失败时，常见原因和排查方法：

| 症状 | 可能原因 | 排查方法 |
|------|---------|---------|
| agent 返回 null | 用户跳过或 agent 出错 | 用 \`.filter(Boolean)\` 过滤 |
| Schema 验证失败 | Schema 过于严格或模型不理解 | 简化 Schema，添加 description |
| 超时 | agent 任务太复杂 | 拆分任务，减少每个 agent 的工作量 |
| 结果不符预期 | prompt 不够自包含 | 在 prompt 中提供更多上下文 |

<div class="callout tip">
<div class="callout-title">调试技巧</div>
在开发 workflow 时，先用单个 agent 测试每个阶段，确认输出格式正确后再组合。用 <code>log(JSON.stringify(result, null, 2))</code> 打印中间结果。
</div>

## 本章小结

- \`phase()\` 提供视觉化的进度分组
- \`log()\` 发送实时进度消息
- \`/workflows\` 实时监控运行状态
- 调试策略：先单阶段测试，再组合
`,
en: `
When a workflow is running, you need to know what it's doing, where it's stuck, and why it failed.

## phase(): Progress Grouping

\`phase('Title')\` groups subsequent agent calls into a visual group, displayed as a tree in \`/workflows\`.

## log(): Progress Messages

\`log(message)\` sends a progress message to the user, shown above the progress tree.

## /workflows Command

Type \`/workflows\` in Claude Code to see real-time progress of all running workflows.

## Debugging Failed Workflows

| Symptom | Possible Cause | Fix |
|---------|---------------|-----|
| agent returns null | User skipped or agent errored | Filter with \`.filter(Boolean)\` |
| Schema validation fails | Schema too strict | Simplify, add descriptions |
| Timeout | Task too complex | Split into smaller tasks |
| Unexpected results | Prompt not self-contained | Add more context to prompt |

## Chapter Summary

- \`phase()\` provides visual progress grouping
- \`log()\` sends real-time progress messages
- \`/workflows\` for live monitoring
- Debug strategy: test each stage individually first, then combine
`
};

// ═══ Ch21: Pattern Extraction ═══
CONTENT['ch21'] = {
zh: `
从他人的 Workflow 系统中提取可复用模式，是构建自己的 Workflow 库的最快路径。本章提供一套系统化的提取方法论。

## 提取方法论：五步法

\`\`\`
1. 读 → 理解系统的设计哲学和架构
2. 解构 → 拆解出独立的可复用模式
3. 抽象 → 剥离系统特定的实现细节
4. 适配 → 转化为原生 Workflow API
5. 验证 → 在真实场景中测试
\`\`\`

## 示例 1：从 ccg-workflow 提取"循环检测"

**原始实现**（ccg-workflow）：Hook 写入 \`.turns.json\`，当同一个 phase + nextAction 重复 3 次，注入 LOOP DETECTED 警告。

**抽象为 Workflow 模式**：

\`\`\`javascript
// 通用循环检测模式
function createLoopDetector(maxRepeats = 3) {
  const history = []
  return function detect(state) {
    history.push(JSON.stringify(state))
    if (history.length > maxRepeats) {
      const recent = history.slice(-maxRepeats)
      if (recent.every(s => s === recent[0])) {
        return { loopDetected: true, repeatedState: state }
      }
    }
    return { loopDetected: false }
  }
}

// 在 workflow 中使用
let round = 0
const detector = createLoopDetector(3)
while (round < 10) {
  const result = await agent('Fix the issue', { schema: FIX_SCHEMA })
  const check = detector({ phase: 'fix', action: result.action })
  if (check.loopDetected) {
    log('Loop detected! Changing strategy.')
    break
  }
  round++
}
\`\`\`

## 示例 2：从 superpowers 提取"反理性化表"

**原始实现**（superpowers）：每个 Skill 包含红旗表，列出 agent 可能的借口及反驳。

**抽象为 Workflow prompt 模式**：

\`\`\`javascript
const ANTI_RATIONALIZATION = \`
RED FLAGS — if you find yourself thinking any of these, STOP:
| Rationalization | Why it's wrong |
|----------------|---------------|
| "Just this once" | Rules exist for the edge cases |
| "It's obvious" | What's obvious to you may be wrong |
| "I already checked" | Show the evidence, don't claim it |
| "The spirit, not the letter" | Violating the letter IS violating the spirit |
\`

const result = await agent(
  'Review this code for security issues. ' + ANTI_RATIONALIZATION,
  { schema: REVIEW_SCHEMA }
)
\`\`\`

## 示例 3：从 OMC 提取"模糊度门控"

**原始实现**（oh-my-claudecode）：数学化计算需求模糊度，低于阈值才进入下一阶段。

**抽象为 Workflow 模式**：

\`\`\`javascript
const AMBIGUITY_SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'number', minimum: 0, maximum: 1 },
    unclear: { type: 'array', items: { type: 'string' } },
    question: { type: 'string' },
  },
  required: ['score', 'unclear'],
}

let ambiguity = 1.0
while (ambiguity > 0.2) {
  const assessment = await agent(
    'Assess the ambiguity of this requirement. Score 0-1 (0=crystal clear, 1=completely ambiguous). List unclear points and ask ONE clarifying question.',
    { schema: AMBIGUITY_SCHEMA }
  )
  ambiguity = assessment.score
  if (ambiguity > 0.2) {
    log('Ambiguity: ' + ambiguity + '. Asking: ' + assessment.question)
    // In a real workflow, you'd collect user answers here
  }
}
\`\`\`

## 示例 4：从 OmO 提取"类别路由"

**原始实现**（oh-my-openagent）：按任务类别（ultrabrain/deep/quick）路由到最优模型。

**抽象为 Workflow 模式**：

\`\`\`javascript
const MODEL_MAP = {
  explore: 'haiku',     // 快速搜索
  implement: 'sonnet',  // 标准执行
  review: 'opus',       // 深度审查
  summarize: 'haiku',   // 摘要
}

function routedAgent(prompt, category, opts = {}) {
  return agent(prompt, {
    ...opts,
    model: MODEL_MAP[category] || 'sonnet',
    label: opts.label || category,
  })
}

// 使用
const summary = await routedAgent('Summarize this file', 'summarize')
const review = await routedAgent('Review for bugs', 'review')
\`\`\`

## 提取清单

从任何 Workflow 系统中，你可以提取以下类别的模式：

| 类别 | 示例 | 来源 |
|------|------|------|
| **控制流** | 循环检测、状态面包屑 | ccg-workflow |
| **质量保证** | 反理性化表、模糊度门控 | superpowers, OMC |
| **路由策略** | 类别路由、tier 分层 | OmO, OMC |
| **数据管理** | 智慧笔记本、Spec 演进 | OmO, ccg-workflow |
| **防御机制** | 确认偏差防护、CSO 描述 | superpowers |

## 本章小结

- 五步提取法：读 → 解构 → 抽象 → 适配 → 验证
- 每个系统都有值得提取的独特模式
- 提取的关键是剥离系统特定实现，保留通用逻辑
- 转化为原生 Workflow API 后在真实场景验证
`,
en: `
Extracting reusable patterns from others' workflow systems is the fastest path to building your own library.

## Extraction Methodology: Five Steps

\`\`\`
1. Read → Understand the system's design philosophy
2. Deconstruct → Break down into independent reusable patterns
3. Abstract → Strip system-specific implementation details
4. Adapt → Convert to native Workflow API
5. Verify → Test in real scenarios
\`\`\`

## Example 1: Loop Detection from ccg-workflow

Abstracted as a generic loop detector function that tracks state history and alerts after N repeats.

## Example 2: Anti-Rationalization Tables from superpowers

Abstracted as a prompt injection pattern that lists common rationalizations and their rebuttals.

## Example 3: Ambiguity Gating from OMC

Abstracted as a while-loop that repeatedly assesses requirement ambiguity until below threshold.

## Example 4: Category Routing from OmO

Abstracted as a model routing map that selects optimal model per task category.

## Extraction Checklist

| Category | Examples | Source |
|----------|----------|--------|
| **Control flow** | Loop detection, state breadcrumbs | ccg-workflow |
| **Quality** | Anti-rationalization, ambiguity gating | superpowers, OMC |
| **Routing** | Category routing, tier layering | OmO, OMC |
| **Data** | Wisdom notebooks, Spec Evolution | OmO, ccg-workflow |
| **Defense** | Confirmation bias prevention, CSO | superpowers |

## Chapter Summary

- Five-step extraction: Read → Deconstruct → Abstract → Adapt → Verify
- Every system has unique extractable patterns
- Key is stripping system-specific implementation, keeping universal logic
- Verify adapted patterns in real scenarios with native Workflow API
`
};

// ═══ Ch22: Build Your Workflow Library ═══
CONTENT['ch22'] = {
zh: `
最后一章：从零构建属于你自己的可复用 Workflow 库。

## 目录结构

\`\`\`
~/.claude/workflows/           # Named workflows（推荐位置）
├── code-review/
│   ├── sharded-review.js      # 分片审查
│   └── pr-review.js           # PR 多角色审查
├── quality/
│   ├── gcf-loop.js            # 生成-批评-修复
│   └── bug-hunter.js          # Bug 猎手
├── research/
│   ├── deep-research.js       # 深度研究
│   └── eval.js                # Prompt/Agent 评估
└── utils/
    ├── schemas.js             # 共享 Schema 定义
    └── patterns.js            # 共享模式（循环检测等）
\`\`\`

<div class="callout info">
<div class="callout-title">Named Workflows</div>
放在 <code>.claude/workflows/</code> 目录下的 workflow 文件可以通过 <code>Workflow({ name: 'sharded-review' })</code> 直接调用，无需指定完整路径。
</div>

## 命名规范

| 规范 | 示例 | 说明 |
|------|------|------|
| 文件名 | \`kebab-case.js\` | 与 meta.name 一致 |
| meta.name | \`sharded-review\` | kebab-case，全小写 |
| meta.description | 一行描述 | 显示在权限对话框 |
| phase titles | 动词开头 | Scan / Review / Verify |
| labels | \`类别:具体\` | \`review:src\` / \`verify:auth\` |

## 从 Skill 到 Named Workflow 的演进

\`\`\`
阶段 1: 内联脚本
  → 在对话中直接用 Workflow({ script: '...' })
  → 适合：实验、一次性任务

阶段 2: 脚本文件
  → 保存为文件，用 Workflow({ scriptPath: '/path/to/script.js' })
  → 适合：迭代开发、反复运行

阶段 3: Named Workflow
  → 放入 .claude/workflows/，用 Workflow({ name: 'xxx' })
  → 适合：团队共享、长期维护

阶段 4: 参数化
  → 通过 args 传参，Workflow({ name: 'xxx', args: { target: 'src/' } })
  → 适合：通用化、多场景复用
\`\`\`

## 参数化示例

\`\`\`javascript
export const meta = {
  name: 'review-dir',
  description: 'Review a directory for issues',
  phases: [{ title: 'Review' }, { title: 'Verify' }],
}

// args 来自 Workflow({ args: { dir: 'src/', depth: 'thorough' } })
const targetDir = args?.dir || 'src/'
const depth = args?.depth || 'normal'

phase('Review')
const result = await agent(
  'Review all code in ' + targetDir + '. Depth: ' + depth,
  { schema: REVIEW_SCHEMA }
)
// ...
\`\`\`

## 版本管理

- 用 git 管理你的 workflow 库
- 每个 workflow 的 meta.description 包含版本信息
- 重大变更时更新 meta.name（如 \`sharded-review-v2\`）
- 用 resumeFromRunId 测试修改是否破坏了缓存兼容性

## 共享 Schema 库

\`\`\`javascript
// utils/schemas.js — 可在多个 workflow 中复用
export const FINDING_SCHEMA = {
  type: 'object',
  properties: {
    findings: { type: 'array', items: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        severity: { type: 'string', enum: ['low','medium','high','critical'] },
        file: { type: 'string' },
      },
      required: ['title', 'severity'],
    }},
  },
  required: ['findings'],
}

export const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    isReal: { type: 'boolean' },
    explanation: { type: 'string' },
  },
  required: ['isReal'],
}
\`\`\`

## 实操：构建一个 3-Workflow 库

跟随本书的 Recipe 章节，你已经有了足够的模式来构建一个基础库：

1. **sharded-review.js** — Ch09 的分片审查
2. **gcf-loop.js** — Ch11 的生成-批评-修复
3. **adversarial-verify.js** — Ch19 的对抗验证

这三个 workflow 覆盖了代码审查、迭代改进和质量保证三个核心场景。

## 本章小结

- 推荐目录：\`~/.claude/workflows/\` 按用途分子目录
- 命名规范：kebab-case，与 meta.name 一致
- 演进路径：内联 → 文件 → Named → 参数化
- 共享 Schema 库减少重复定义
- 从 3 个核心 workflow 起步，逐步扩展
`,
en: `
Final chapter: build your own reusable Workflow library from scratch.

## Directory Structure

\`\`\`
~/.claude/workflows/
├── code-review/
│   ├── sharded-review.js
│   └── pr-review.js
├── quality/
│   ├── gcf-loop.js
│   └── bug-hunter.js
├── research/
│   └── deep-research.js
└── utils/
    ├── schemas.js
    └── patterns.js
\`\`\`

## Naming Conventions

- File names: \`kebab-case.js\`, matching meta.name
- Phase titles: start with verbs (Scan / Review / Verify)
- Labels: \`category:specific\` format

## Evolution Path

\`\`\`
Stage 1: Inline scripts → experiments
Stage 2: Script files → iterative development
Stage 3: Named workflows → team sharing
Stage 4: Parameterized → multi-scenario reuse
\`\`\`

## Shared Schema Library

Create reusable schemas in a utils/ directory to reduce duplication across workflows.

## Hands-on: Build a 3-Workflow Library

Following this book's Recipe chapters, build a starter library:
1. **sharded-review.js** — Sharded code review (Ch09)
2. **gcf-loop.js** — Generate-Critique-Fix (Ch11)
3. **adversarial-verify.js** — Adversarial verification (Ch19)

## Chapter Summary

- Recommended directory: \`~/.claude/workflows/\` with subdirectories by purpose
- Naming: kebab-case, matching meta.name
- Evolution: inline → file → named → parameterized
- Shared Schema libraries reduce duplication
- Start with 3 core workflows, expand gradually
`
};

// ═══ Ch10: Multi-Role PR Review ═══
CONTENT['ch10'] = {
zh: `
为每个 PR 部署多维度专家审查员，各司其职，最后综合出全面的审查报告。

## 设计思路

传统 PR 审查由一个人（或一个 agent）完成，视角单一。多角色审查让不同专家从不同维度并行审查：

\`\`\`
PR → ┌─ 安全专家 ──→ 安全发现
     ├─ 性能专家 ──→ 性能发现    → 综合报告
     └─ 架构专家 ──→ 架构发现
\`\`\`

## 完整 Workflow 脚本

\`\`\`javascript
export const meta = {
  name: 'multi-role-review',
  description: 'Multi-role PR review: security + performance + architecture',
  phases: [
    { title: 'Review', detail: 'Three specialist reviews in parallel' },
    { title: 'Synthesize', detail: 'Merge into unified report' },
  ],
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    role: { type: 'string' },
    findings: { type: 'array', items: {
      type: 'object',
      properties: {
        issue: { type: 'string' },
        severity: { type: 'string', enum: ['info','low','medium','high','critical'] },
        suggestion: { type: 'string' },
      },
      required: ['issue', 'severity'],
    }},
    overallScore: { type: 'number', minimum: 1, maximum: 10 },
  },
  required: ['role', 'findings', 'overallScore'],
}

phase('Review')
const reviews = await parallel([
  () => agent('You are a SECURITY specialist. Review the codebase for security issues.', { schema: REVIEW_SCHEMA, label: 'security' }),
  () => agent('You are a PERFORMANCE specialist. Review for performance issues.', { schema: REVIEW_SCHEMA, label: 'performance' }),
  () => agent('You are an ARCHITECTURE specialist. Review for architectural issues.', { schema: REVIEW_SCHEMA, label: 'architecture' }),
])

phase('Synthesize')
const valid = reviews.filter(Boolean)
const avgScore = valid.reduce((s, r) => s + r.overallScore, 0) / valid.length
return { reviewers: valid.map(r => ({ role: r.role, score: r.overallScore })), avgScore }
\`\`\`

## 真实运行结果

<div class="test-result">
<div class="test-header">
<span class="status pass">PASS</span>
<span class="test-name">multi-role-review</span>
</div>
<div class="test-output">
Reviewers: security (6/10), performance (5/10), architecture (6/10)
Average score: 5.67/10
Total findings: 21 (4 critical/high)
Agent count: 3 | Total tokens: 159,601 | Duration: 74.4s
</div>
</div>

**关键发现**：安全专家找到 6 个问题（含 SRI 缺失），性能专家找到 8 个问题（含 render-blocking 脚本），架构专家找到 7 个问题（含数据源冗余）。三个维度互不重叠，证明了多角色审查的价值。

## 本章小结

- 多角色审查 = 不同专家从不同维度并行审查
- 使用 parallel() 让三个专家同时工作
- Schema 约束统一输出格式（role + findings + score）
- 实测：3 agents, 160K tokens, 74.4s, 21 个发现
`,
en: `
Deploy multi-dimensional specialist reviewers for each PR, each covering their domain, then synthesize a comprehensive report.

## Design Approach

Traditional PR review is done by one person (or agent) with a single perspective. Multi-role review has different experts review from different dimensions in parallel:

\`\`\`
PR → ┌─ Security specialist  ──→ Security findings
     ├─ Performance specialist ─→ Performance findings  → Unified report
     └─ Architecture specialist ─→ Architecture findings
\`\`\`

## Complete Workflow Script

\`\`\`javascript
export const meta = {
  name: 'multi-role-review',
  description: 'Multi-role PR review: security + performance + architecture',
  phases: [
    { title: 'Review', detail: 'Three specialist reviews in parallel' },
    { title: 'Synthesize', detail: 'Merge into unified report' },
  ],
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    role: { type: 'string' },
    findings: { type: 'array', items: {
      type: 'object',
      properties: {
        issue: { type: 'string' },
        severity: { type: 'string', enum: ['info','low','medium','high','critical'] },
        suggestion: { type: 'string' },
      },
      required: ['issue', 'severity'],
    }},
    overallScore: { type: 'number', minimum: 1, maximum: 10 },
  },
  required: ['role', 'findings', 'overallScore'],
}

phase('Review')
const reviews = await parallel([
  () => agent('You are a SECURITY specialist. Review the codebase for security issues.', { schema: REVIEW_SCHEMA, label: 'security' }),
  () => agent('You are a PERFORMANCE specialist. Review for performance issues.', { schema: REVIEW_SCHEMA, label: 'performance' }),
  () => agent('You are an ARCHITECTURE specialist. Review for architectural issues.', { schema: REVIEW_SCHEMA, label: 'architecture' }),
])

phase('Synthesize')
const valid = reviews.filter(Boolean)
const avgScore = valid.reduce((s, r) => s + r.overallScore, 0) / valid.length
return { reviewers: valid.map(r => ({ role: r.role, score: r.overallScore })), avgScore }
\`\`\`

## Real Execution Results

<div class="test-result">
<div class="test-header">
<span class="status pass">PASS</span>
<span class="test-name">multi-role-review</span>
</div>
<div class="test-output">
Reviewers: security (6/10), performance (5/10), architecture (6/10)
Average score: 5.67/10
Total findings: 21 (4 critical/high)
Agent count: 3 | Total tokens: 159,601 | Duration: 74.4s
</div>
</div>

**Key finding**: The security specialist found 6 issues (including missing SRI), the performance specialist found 8 issues (including render-blocking scripts), and the architecture specialist found 7 issues (including data source redundancy). The three dimensions did not overlap, proving the value of multi-role review.

## Chapter Summary

- Multi-role review = different experts reviewing from different dimensions in parallel
- Use parallel() for concurrent specialist work
- Schema constrains uniform output format (role + findings + score)
- Test result: 3 agents, 160K tokens, 74.4s, 21 findings
`
};

// ═══ Ch12: Deep Research ═══
CONTENT['ch12'] = {
zh: `
多 agent 从不同角度并行搜索，交叉验证每个声明，最后综合为可信报告。

## 模式原理

\`\`\`
Topic → ┌─ Searcher A (角度 1) ─→ Claims
        └─ Searcher B (角度 2) ─→ Claims
                                    ↓
                         Merge + Dedup Claims
                                    ↓
                    ┌─ Verifier 1 ─→ Verified?
                    ├─ Verifier 2 ─→ Verified?
                    └─ Verifier N ─→ Verified?
                                    ↓
                             Final Report
\`\`\`

## 关键设计

1. **多角度搜索**：同一主题从不同角度搜索，避免单一视角的盲区
2. **交叉验证**：独立 agent 验证每个声明，过滤错误信息
3. **结构化声明**：每个声明带有 confidence 分数

## 真实运行结果

<div class="test-result">
<div class="test-header">
<span class="status pass">PASS</span>
<span class="test-name">deep-research</span>
</div>
<div class="test-output">
Topic: JavaScript event loop phases
Searchers: 2 (event-loop-phases + micro-vs-macro)
Total claims: 6, Confirmed: 3
Agent count: 6 | Total tokens: 225,821 | Duration: 220.7s
</div>
</div>

**验证通过的声明示例**：
- setImmediate() 在 check 阶段执行，在 poll 阶段之后
- 微任务在每个宏任务之后完全清空
- process.nextTick() 优先级高于 Promise 微任务

## 本章小结

- 深度研究 = 多角度搜索 + 交叉验证 + 综合报告
- 使用 parallel() 并行搜索，pipeline() 流式验证
- confidence 分数帮助过滤低质量声明
- 实测：6 agents, 226K tokens, 220.7s, 3/6 声明通过验证
`,
en: `
Multiple agents search from different angles in parallel, cross-verify each claim, then synthesize into a trustworthy report.

## How the Pattern Works

\`\`\`
Topic → ┌─ Searcher A (angle 1) ─→ Claims
        └─ Searcher B (angle 2) ─→ Claims
                                    ↓
                         Merge + Dedup Claims
                                    ↓
                    ┌─ Verifier 1 ─→ Verified?
                    ├─ Verifier 2 ─→ Verified?
                    └─ Verifier N ─→ Verified?
                                    ↓
                             Final Report
\`\`\`

## Key Design

1. **Multi-angle search**: search the same topic from different angles to avoid blind spots of a single perspective
2. **Cross-verification**: independent agents verify each claim, filtering out incorrect information
3. **Structured claims**: each claim carries a confidence score

## Real Execution Results

<div class="test-result">
<div class="test-header">
<span class="status pass">PASS</span>
<span class="test-name">deep-research</span>
</div>
<div class="test-output">
Topic: JavaScript event loop phases
Searchers: 2 (event-loop-phases + micro-vs-macro)
Total claims: 6, Confirmed: 3
Agent count: 6 | Total tokens: 225,821 | Duration: 220.7s
</div>
</div>

**Examples of verified claims**:
- setImmediate() runs in the check phase, after the poll phase
- Microtasks are fully drained after each macrotask
- process.nextTick() has higher priority than Promise microtasks

## Chapter Summary

- Deep research = multi-angle search + cross-verification + synthesis
- Use parallel() for concurrent search, pipeline() for streaming verification
- Confidence scores help filter low-quality claims
- Test result: 6 agents, 226K tokens, 220.7s, 3/6 claims verified
`
};

// ═══ Ch13: Prompt/Agent Evaluation ═══
CONTENT['ch13'] = {
zh: `
用 Workflow 编排 A/B 测试——生成多个独立方案，用评委面板打分，选出最优。

## 评委面板模式

\`\`\`javascript
// 3 个独立生成者从不同角度生成方案
const solutions = await parallel(
  ANGLES.map(angle => () =>
    agent('Implement from ' + angle + ' perspective', { schema: SOLUTION_SCHEMA })
  )
)

// 每个方案由 3 个独立评委打分
const scored = await pipeline(solutions.filter(Boolean),
  (sol) => parallel(
    Array.from({ length: 3 }, () => () =>
      agent('Score this: ' + sol.approach, { schema: SCORE_SCHEMA })
    )
  ).then(judges => ({
    ...sol,
    avgScore: judges.filter(Boolean).reduce((s, j) => s + j.score, 0) / judges.filter(Boolean).length
  }))
)

// 选出最高分
const winner = scored.reduce((best, cur) => cur.avgScore > best.avgScore ? cur : best)
\`\`\`

## 真实运行结果

<div class="test-result">
<div class="test-header">
<span class="status pass">PASS</span>
<span class="test-name">judge-panel</span>
</div>
<div class="test-output">
Task: Rate limiter implementation
Approaches: MVP-first (7.67), Performance-first (7.00), Safety-first (6.33)
Winner: MVP-first with avg score 7.67/10
Agent count: 12 (3 generators + 9 judges)
Total tokens: 358,936 | Duration: 139.7s
</div>
</div>

**关键发现**：MVP-first（最简可用方案）以 7.67 分胜出，Performance-first 7.00 分，Safety-first 6.33 分。评委倾向于简洁清晰的实现。

## 适用场景

- 评估不同 prompt 的输出质量
- 比较不同 agent 配置的效果
- A/B 测试不同的解决方案
- 在多种设计方案中选择最优

## 本章小结

- 评委面板 = 多方案生成 + 多评委打分 + 选最优
- pipeline() 让每个方案独立进入评委环节
- 12 agents（3 生成 + 9 评委），359K tokens，140s
- MVP-first 方案以简洁清晰赢得评委青睐
`,
en: `
Orchestrate A/B testing with Workflow — generate multiple independent solutions, score with a judge panel, pick the best.

## Judge Panel Pattern

\`\`\`javascript
// 3 independent generators produce solutions from different angles
const solutions = await parallel(
  ANGLES.map(angle => () =>
    agent('Implement from ' + angle + ' perspective', { schema: SOLUTION_SCHEMA })
  )
)

// Each solution is scored by 3 independent judges
const scored = await pipeline(solutions.filter(Boolean),
  (sol) => parallel(
    Array.from({ length: 3 }, () => () =>
      agent('Score this: ' + sol.approach, { schema: SCORE_SCHEMA })
    )
  ).then(judges => ({
    ...sol,
    avgScore: judges.filter(Boolean).reduce((s, j) => s + j.score, 0) / judges.filter(Boolean).length
  }))
)

// Pick the highest score
const winner = scored.reduce((best, cur) => cur.avgScore > best.avgScore ? cur : best)
\`\`\`

## Real Execution Results

<div class="test-result">
<div class="test-header">
<span class="status pass">PASS</span>
<span class="test-name">judge-panel</span>
</div>
<div class="test-output">
Task: Rate limiter implementation
Approaches: MVP-first (7.67), Performance-first (7.00), Safety-first (6.33)
Winner: MVP-first with avg score 7.67/10
Agent count: 12 (3 generators + 9 judges)
Total tokens: 358,936 | Duration: 139.7s
</div>
</div>

**Key finding**: MVP-first (the simplest viable solution) won at 7.67, with Performance-first at 7.00 and Safety-first at 6.33. Judges favored the clean, clear implementation.

## When to Use

- Evaluate the output quality of different prompts
- Compare the effectiveness of different agent configurations
- A/B test different solutions
- Select the best among multiple design options

## Chapter Summary

- Judge panel = multi-solution generation + multi-judge scoring + pick best
- pipeline() lets each solution independently enter the judging phase
- 12 agents (3 generators + 9 judges), 359K tokens, 140s
- MVP-first won with clear, simple implementation
`
};

// ═══ Ch14: Bug Hunter ═══
CONTENT['ch14'] = {
zh: `
持续发现 bug 直到枯竭，然后对抗验证过滤误报——bughunt workflow 的核心模式。

## 模式原理

\`\`\`
Round 1: Finder → [bugs]
Round 2: Finder → [more bugs]
Round 3: Finder → [0 new bugs] ← dry streak
         ↓
All bugs → Adversarial Verify (5 votes each)
         ↓
Confirmed bugs only
\`\`\`

## 关键设计

### Loop-Until-Dry 模式

\`\`\`javascript
const bugs = []
let dryStreak = 0
const MAX_DRY = 2

while (dryStreak < MAX_DRY) {
  const result = await agent(
    'Find bugs NOT already in this list: ' + bugs.map(b => b.title).join(', '),
    { schema: BUGS_SCHEMA }
  )
  if (!result || result.bugs.length === 0) {
    dryStreak++
    log('Dry streak: ' + dryStreak + '/' + MAX_DRY)
  } else {
    dryStreak = 0
    bugs.push(...result.bugs)
    log('Found ' + result.bugs.length + ' new bugs (total: ' + bugs.length + ')')
  }
}
\`\`\`

### 5 票对抗验证

\`\`\`javascript
const verified = await pipeline(bugs,
  (bug) => parallel(
    Array.from({ length: 5 }, () => () =>
      agent('Try to REFUTE: ' + bug.title, { schema: VERDICT_SCHEMA })
    )
  ).then(votes => {
    const refuted = votes.filter(Boolean).filter(v => v.refuted).length
    return { ...bug, confirmed: refuted < 3 }
  })
)
const confirmedBugs = verified.filter(Boolean).filter(b => b.confirmed)
\`\`\`

## 真实对抗验证结果

我们的 adversarial-verify 测试验证了这个模式：

<div class="test-result">
<div class="test-header">
<span class="status pass">PASS</span>
<span class="test-name">adversarial-verify</span>
</div>
<div class="test-output">
Claim: "setTimeout(0) guarantees running before I/O callbacks"
Votes: 3/3 REFUTED (confidence: 0.97-0.98)
Verdict: REJECTED (correctly — the claim is false)
Agent count: 3 | Total tokens: 100,357 | Duration: 70.1s
</div>
</div>

**关键发现**：3 个独立 skeptic 全部正确反驳了错误声明，confidence 高达 0.97-0.98。对抗验证在过滤错误信息方面非常有效。

## 本章小结

- Bug 猎手 = loop-until-dry 发现 + 对抗验证过滤
- 连续 N 轮找不到新 bug 时停止（dry streak）
- 5 票对抗验证：多数票决定是否保留
- 实测：3 agents 正确反驳错误声明，confidence 0.97+
`,
en: `
Continuously find bugs until dry, then adversarially verify to filter false positives — the core pattern of the bughunt workflow.

## How the Pattern Works

\`\`\`
Round 1: Finder → [bugs]
Round 2: Finder → [more bugs]
Round 3: Finder → [0 new bugs] ← dry streak
         ↓
All bugs → Adversarial Verify (5 votes each)
         ↓
Confirmed bugs only
\`\`\`

## Key Design

### Loop-Until-Dry Pattern

\`\`\`javascript
const bugs = []
let dryStreak = 0
const MAX_DRY = 2

while (dryStreak < MAX_DRY) {
  const result = await agent(
    'Find bugs NOT already in this list: ' + bugs.map(b => b.title).join(', '),
    { schema: BUGS_SCHEMA }
  )
  if (!result || result.bugs.length === 0) {
    dryStreak++
    log('Dry streak: ' + dryStreak + '/' + MAX_DRY)
  } else {
    dryStreak = 0
    bugs.push(...result.bugs)
    log('Found ' + result.bugs.length + ' new bugs (total: ' + bugs.length + ')')
  }
}
\`\`\`

### 5-Vote Adversarial Verify

\`\`\`javascript
const verified = await pipeline(bugs,
  (bug) => parallel(
    Array.from({ length: 5 }, () => () =>
      agent('Try to REFUTE: ' + bug.title, { schema: VERDICT_SCHEMA })
    )
  ).then(votes => {
    const refuted = votes.filter(Boolean).filter(v => v.refuted).length
    return { ...bug, confirmed: refuted < 3 }
  })
)
const confirmedBugs = verified.filter(Boolean).filter(b => b.confirmed)
\`\`\`

## Real Adversarial Verification Results

Our adversarial-verify test validates this pattern:

<div class="test-result">
<div class="test-header">
<span class="status pass">PASS</span>
<span class="test-name">adversarial-verify</span>
</div>
<div class="test-output">
Claim: "setTimeout(0) guarantees running before I/O callbacks"
Votes: 3/3 REFUTED (confidence: 0.97-0.98)
Verdict: REJECTED (correctly — the claim is false)
Agent count: 3 | Total tokens: 100,357 | Duration: 70.1s
</div>
</div>

**Key finding**: All 3 independent skeptics correctly refuted the false claim, with confidence as high as 0.97-0.98. Adversarial verification is highly effective at filtering out incorrect information.

## Chapter Summary

- Bug hunter = loop-until-dry discovery + adversarial verification filtering
- Stop after N consecutive dry rounds
- 5-vote adversarial: majority vote decides retention
- Test result: 3 agents correctly refuted false claim, confidence 0.97+
`
};

// ═══ Ch16: Resume from Checkpoint ═══
CONTENT['ch16'] = {
zh: `
\`resumeFromRunId\` 让你在 workflow 中断后恢复执行——已完成的 agent 直接返回缓存结果。

## 工作原理

\`\`\`
首次运行：
  agent A → 完成 (缓存)
  agent B → 完成 (缓存)
  agent C → 中断！

恢复运行（resumeFromRunId）：
  agent A → 缓存命中 ✓ (瞬间返回)
  agent B → 缓存命中 ✓ (瞬间返回)
  agent C → 重新执行 (从中断处继续)
  agent D → 正常执行
\`\`\`

## 使用方法

\`\`\`javascript
// 首次运行返回 runId
Workflow({ script: '...', /* or scriptPath */ })
// 返回: { runId: 'wf_abc123-456' }

// 中断后恢复
Workflow({
  scriptPath: '/path/to/script.js',
  resumeFromRunId: 'wf_abc123-456'
})
\`\`\`

## 缓存命中条件

缓存命中要求 **prompt 和 opts 都完全相同**：

- 相同的脚本 + 相同的 args → 100% 缓存命中
- 修改了某个 agent 的 prompt → 该 agent 及之后的全部重新执行
- 在中间插入新 agent → 插入点之后全部重新执行

<div class="callout warning">
<div class="callout-title">限制</div>
<code>Date.now()</code>、<code>Math.random()</code> 和无参 <code>new Date()</code> 在脚本中不可用——它们会破坏 resume 的确定性。如需时间戳，通过 <code>args</code> 传入。
</div>

## 本章小结

- \`resumeFromRunId\` 恢复中断的 workflow
- 已完成的 agent 瞬间返回缓存结果
- 缓存命中条件：prompt + opts 完全相同
- Date.now/Math.random 不可用（会破坏确定性）
`,
en: `
\`resumeFromRunId\` lets you resume execution after a workflow interruption — completed agents return cached results instantly.

## How It Works

\`\`\`
First run:
  agent A → done (cached)
  agent B → done (cached)
  agent C → interrupted!

Resume run (resumeFromRunId):
  agent A → cache hit ✓ (instant return)
  agent B → cache hit ✓ (instant return)
  agent C → re-execute (continue from interruption)
  agent D → execute normally
\`\`\`

## Usage

\`\`\`javascript
// First run returns a runId
Workflow({ script: '...', /* or scriptPath */ })
// Returns: { runId: 'wf_abc123-456' }

// Resume after interruption
Workflow({
  scriptPath: '/path/to/script.js',
  resumeFromRunId: 'wf_abc123-456'
})
\`\`\`

## Cache Hit Conditions

A cache hit requires **both the prompt and opts to be exactly identical**:

- Same script + same args → 100% cache hit
- Modified agent prompt → that agent and all after re-execute
- Inserted new agent → insertion point and after re-execute

<div class="callout warning">
<div class="callout-title">Limitation</div>
<code>Date.now()</code>, <code>Math.random()</code>, and a no-arg <code>new Date()</code> are unavailable in scripts — they break resume determinism. If you need a timestamp, pass it in via <code>args</code>.
</div>

## Chapter Summary

- \`resumeFromRunId\` resumes interrupted workflows
- Completed agents return cached results instantly
- Cache hit requires identical prompt + opts
- Date.now/Math.random unavailable (breaks determinism)
`
};

// ═══ Ch17: Worktree Isolation ═══
CONTENT['ch17'] = {
zh: `
\`isolation: 'worktree'\` 让多个 agent 在独立的 git worktree 中并行修改文件，互不冲突。

## 为什么需要隔离

默认情况下，所有 agent 共享同一个工作目录。如果两个 agent 同时修改同一个文件，会产生冲突。Worktree 隔离为每个 agent 创建独立的文件系统副本。

## 使用方法

\`\`\`javascript
const results = await parallel([
  () => agent('Refactor the auth module', {
    isolation: 'worktree',
    label: 'auth-refactor',
  }),
  () => agent('Refactor the database module', {
    isolation: 'worktree',
    label: 'db-refactor',
  }),
])
// 两个 agent 在独立 worktree 中工作，互不干扰
\`\`\`

## 开销与清理

- 创建 worktree 有 ~200-500ms 开销 + 磁盘使用
- 如果 agent 未做任何更改，worktree 自动清理
- 如果有更改，返回结果中包含 worktree 路径和分支名

<div class="callout warning">
<div class="callout-title">仅在必要时使用</div>
Worktree 隔离开销不小。只在多个 agent 需要<strong>并行写入文件</strong>时使用。如果 agent 只读取文件或只返回分析结果，不需要隔离。
</div>

## 本章小结

- \`isolation: 'worktree'\` 为每个 agent 创建独立的 git worktree
- 适用于多 agent 并行修改文件的场景
- 有 200-500ms 创建开销，未修改时自动清理
- 只在需要并行写入文件时使用
`,
en: `
\`isolation: 'worktree'\` lets multiple agents modify files in parallel by creating isolated git worktrees, avoiding working directory conflicts.

## Why Isolation Is Needed

By default, all agents share the same working directory. If two agents modify the same file at the same time, conflicts arise. Worktree isolation creates an independent filesystem copy for each agent.

## Usage

\`\`\`javascript
const results = await parallel([
  () => agent('Refactor the auth module', {
    isolation: 'worktree',
    label: 'auth-refactor',
  }),
  () => agent('Refactor the database module', {
    isolation: 'worktree',
    label: 'db-refactor',
  }),
])
// The two agents work in independent worktrees without interfering
\`\`\`

## Overhead and Cleanup

- Creating a worktree has ~200-500ms overhead + disk usage
- If an agent makes no changes, the worktree is cleaned up automatically
- If there are changes, the returned result includes the worktree path and branch name

<div class="callout warning">
<div class="callout-title">Use only when necessary</div>
Worktree isolation has non-trivial overhead. Use it only when multiple agents need to <strong>write files in parallel</strong>. If agents only read files or only return analysis results, isolation is not needed.
</div>

## Chapter Summary

- \`isolation: 'worktree'\` creates independent git worktrees per agent
- For parallel file modification scenarios
- ~200-500ms creation overhead, auto-cleanup if no changes
- Only use when parallel file writes are needed
`
};

// ═══ Ch18: Nested Workflows ═══
CONTENT['ch18'] = {
zh: `
\`workflow()\` 让你在一个 workflow 内部调用另一个 workflow，实现模块化编排。

## 使用方法

\`\`\`javascript
// 调用 named workflow
const result = await workflow('sharded-review', { target: 'src/' })

// 调用脚本文件
const result = await workflow({ scriptPath: '/path/to/review.js' }, { depth: 'thorough' })
\`\`\`

## 共享资源

子 workflow 与父 workflow 共享：
- **并发上限** — 同一个 min(16, CPU-2) 池
- **Agent 计数器** — 计入同一个 1000 上限
- **Token 预算** — budget.spent() 是共享池
- **终止信号** — 父 workflow 终止时子 workflow 也终止

## 限制

- 嵌套只能一层——workflow() 内部再调 workflow() 会抛异常
- 子 workflow 的 agent 在 /workflows 中显示为缩进子组

<div class="callout info">
<div class="callout-title">args 传递</div>
<code>workflow()</code> 的第二个参数成为子 workflow 中的 <code>args</code> 全局变量。用它来参数化复用的 workflow。
</div>

## 本章小结

- \`workflow()\` 实现模块化编排
- 子 workflow 共享并发上限、agent 计数器、token 预算
- 嵌套限制为一层
- 通过 args 参数化子 workflow
`,
en: `
\`workflow()\` lets you call another workflow inside a workflow for modular orchestration.

## Usage

\`\`\`javascript
// Call a named workflow
const result = await workflow('sharded-review', { target: 'src/' })

// Call a script file
const result = await workflow({ scriptPath: '/path/to/review.js' }, { depth: 'thorough' })
\`\`\`

## Shared Resources

Child workflows share with the parent:
- **Concurrency cap** — the same min(16, CPU-2) pool
- **Agent counter** — counts toward the same 1000 limit
- **Token budget** — budget.spent() is a shared pool
- **Abort signal** — when the parent workflow aborts, child workflows abort too

## Limitations

- Nesting is one level only — workflow() inside a child throws
- Child agents appear as indented subgroups in /workflows

<div class="callout info">
<div class="callout-title">Passing args</div>
The second argument of <code>workflow()</code> becomes the <code>args</code> global variable inside the child workflow. Use it to parameterize reusable workflows.
</div>

## Chapter Summary

- \`workflow()\` enables modular orchestration
- Child shares concurrency, agent count, budget with parent
- One-level nesting limit
- Parameterize child workflows via args
`
};

// ═══ Ch19: Quality Patterns ═══
CONTENT['ch19'] = {
zh: `
五种经过验证的质量模式——按需组合，提升 workflow 输出的可靠性。

## 1. 对抗验证 (Adversarial Verify)

派 N 个独立 skeptic 尝试**反驳**每个发现。无法反驳的才保留。

\`\`\`javascript
const votes = await parallel(
  Array.from({ length: 3 }, () => () =>
    agent('Try to REFUTE: ' + claim, { schema: VERDICT_SCHEMA })
  )
)
const survives = votes.filter(Boolean).filter(v => !v.refuted).length >= 2
\`\`\`

**实测验证**：我们的 adversarial-verify 测试中，3 个 skeptic 以 0.97+ confidence 正确反驳了错误声明。

## 2. 评委面板 (Judge Panel)

生成 N 个独立方案，用并行评委打分，选最优。

**实测验证**：judge-panel 测试中，12 agents（3 生成 + 9 评委）在 140s 内完成，MVP 方案以 7.67 分胜出。

## 3. 循环到干 (Loop Until Dry)

持续发现直到连续 K 轮没有新结果。

\`\`\`javascript
let dryStreak = 0
while (dryStreak < K) {
  const found = await agent('Find more issues not in: ' + existing, {
    schema: { type: 'object', properties: { issues: { type: 'array', items: { type: 'string' } } }, required: ['issues'] }
  })
  if (!found || found.issues.length === 0) dryStreak++
  else { dryStreak = 0; results.push(...found.issues) }
}
\`\`\`

## 4. 多模态扫描 (Multi-Modal Sweep)

多个 agent 各自用不同搜索策略，覆盖不同盲区。

\`\`\`javascript
const results = await parallel([
  () => agent('Search by file structure'),    // 按文件结构
  () => agent('Search by data flow'),         // 按数据流
  () => agent('Search by error patterns'),    // 按错误模式
])
\`\`\`

## 5. 完整性批评 (Completeness Critic)

最后一个 agent 问"还缺什么？"——未覆盖的维度、未验证的声明、未读的源。

\`\`\`javascript
const critic = await agent(
  'What is MISSING from this analysis? What modality was not run, ' +
  'what claim is unverified, what source was not read?',
  { schema: GAPS_SCHEMA }
)
// critic.gaps 成为下一轮工作的输入
\`\`\`

## 组合使用

这些模式可以自由组合：

\`\`\`
发现阶段：Multi-Modal Sweep + Loop Until Dry
验证阶段：Adversarial Verify (3-5 votes)
选择阶段：Judge Panel
收尾阶段：Completeness Critic
\`\`\`

## 本章小结

| 模式 | 用途 | 何时使用 |
|------|------|---------|
| 对抗验证 | 过滤误报 | 发现阶段后 |
| 评委面板 | 选最优方案 | 多方案比较 |
| 循环到干 | 发现全部 | 未知数量的发现 |
| 多模态扫描 | 覆盖盲区 | 单一搜索不够时 |
| 完整性批评 | 查缺补漏 | 收尾阶段 |
`,
en: `
Five proven quality patterns — combine as needed to improve workflow output reliability.

## 1. Adversarial Verify
Spawn N independent skeptics to try to **REFUTE** each finding. Only those that cannot be refuted are kept.

\`\`\`javascript
const votes = await parallel(
  Array.from({ length: 3 }, () => () =>
    agent('Try to REFUTE: ' + claim, { schema: VERDICT_SCHEMA })
  )
)
const survives = votes.filter(Boolean).filter(v => !v.refuted).length >= 2
\`\`\`

**Tested**: in our adversarial-verify test, 3 skeptics correctly refuted a false claim with 0.97+ confidence.

## 2. Judge Panel
Generate N independent solutions, score with parallel judges, pick the best.

**Tested**: in the judge-panel test, 12 agents (3 generators + 9 judges) finished in 140s, with the MVP solution winning at 7.67.

## 3. Loop Until Dry
Keep finding until K consecutive rounds return nothing new.

\`\`\`javascript
let dryStreak = 0
while (dryStreak < K) {
  const found = await agent('Find more issues not in: ' + existing, {
    schema: { type: 'object', properties: { issues: { type: 'array', items: { type: 'string' } } }, required: ['issues'] }
  })
  if (!found || found.issues.length === 0) dryStreak++
  else { dryStreak = 0; results.push(...found.issues) }
}
\`\`\`

## 4. Multi-Modal Sweep
Multiple agents each use different search strategies to cover different blind spots.

\`\`\`javascript
const results = await parallel([
  () => agent('Search by file structure'),    // by file structure
  () => agent('Search by data flow'),         // by data flow
  () => agent('Search by error patterns'),    // by error patterns
])
\`\`\`

## 5. Completeness Critic
A final agent asks "what's missing?" — uncovered dimensions, unverified claims, unread sources.

\`\`\`javascript
const critic = await agent(
  'What is MISSING from this analysis? What modality was not run, ' +
  'what claim is unverified, what source was not read?',
  { schema: GAPS_SCHEMA }
)
// critic.gaps becomes the input for the next round of work
\`\`\`

## Combining Patterns

These patterns can be combined freely:

\`\`\`
Discovery phase:    Multi-Modal Sweep + Loop Until Dry
Verification phase: Adversarial Verify (3-5 votes)
Selection phase:    Judge Panel
Wrap-up phase:      Completeness Critic
\`\`\`

## Chapter Summary

| Pattern | Purpose | When to Use |
|---------|---------|-------------|
| Adversarial Verify | Filter false positives | After discovery phase |
| Judge Panel | Pick best solution | Multi-solution comparison |
| Loop Until Dry | Find everything | Unknown discovery count |
| Multi-Modal Sweep | Cover blind spots | Single search insufficient |
| Completeness Critic | Find gaps | Final phase |
`
};

// ═══ AppB: FAQ ═══
CONTENT['appB'] = {
zh: `
常见问题和使用陷阱。

## 启用相关

**Q: 为什么 Workflow 工具不可用？**
A: 需要设置 \`CLAUDE_CODE_WORKFLOWS=1\` 环境变量。在 \`~/.claude/settings.json\` 的 \`env\` 中添加，或启动时 \`CLAUDE_CODE_WORKFLOWS=1 claude\`。需要 v2.1.148+。

**Q: 如何确认我的 Claude Code 版本？**
A: 运行 \`claude --version\`。

## 编写相关

**Q: 为什么 agent 返回 null？**
A: 两种可能：(1) 用户跳过了该 agent，(2) agent 在 parallel/pipeline 中抛出异常。用 \`.filter(Boolean)\` 过滤。

**Q: 为什么 Schema 验证失败？**
A: Schema 过于复杂或字段描述不清晰。添加 \`description\` 字段帮助模型理解。保持嵌套不超过 3 层。

**Q: 为什么 Date.now() 不能用？**
A: 为了保证 \`resumeFromRunId\` 的确定性——时间戳变化会导致缓存不命中。通过 \`args\` 传入时间戳。

**Q: 最多能跑多少个 agent？**
A: 并发上限 \`min(16, CPU 核心数 - 2)\`，生命周期总数上限 1000。

## 性能相关

**Q: 如何减少 token 消耗？**
A: (1) 用 \`model: 'haiku'\` 给简单任务，(2) 减少 prompt 中的冗余上下文，(3) 用 Schema 约束输出长度。

**Q: parallel 和 pipeline 哪个更快？**
A: pipeline 通常更快——因为不需要等最慢的 agent。只在需要全部结果时用 parallel。
`,
en: `
Common questions and usage pitfalls.

## Activation

**Q: Why is the Workflow tool unavailable?**
A: Set \`CLAUDE_CODE_WORKFLOWS=1\` in \`~/.claude/settings.json\` env section. Requires v2.1.148+.

## Writing

**Q: Why does agent return null?**
A: User skipped, or agent threw in parallel/pipeline. Filter with \`.filter(Boolean)\`.

**Q: Why does Schema validation fail?**
A: Schema too complex or descriptions unclear. Add \`description\` fields. Keep nesting under 3 levels.

**Q: Why can't I use Date.now()?**
A: Breaks \`resumeFromRunId\` determinism. Pass timestamps via \`args\`.

## Performance

**Q: How to reduce token consumption?**
A: (1) Use \`model: 'haiku'\` for simple tasks, (2) reduce prompt redundancy, (3) use Schema to constrain output length.
`
};

// ═══ AppC: Best Practices Checklist ═══
CONTENT['appC'] = {
zh: `
生产级 Workflow 的检查清单。

## meta

- [ ] \`name\` 使用 kebab-case
- [ ] \`description\` 一行，清晰描述用途
- [ ] \`phases\` 与脚本中的 \`phase()\` 调用一致

## agent()

- [ ] prompt 自包含——不依赖父对话上下文
- [ ] 使用 \`label\` 便于在 /workflows 中辨识
- [ ] 需要结构化数据时使用 \`schema\`
- [ ] Schema 包含 \`description\` 字段
- [ ] 简单任务使用 \`model: 'haiku'\`
- [ ] 只在并行写文件时使用 \`isolation: 'worktree'\`

## 并发

- [ ] 默认使用 \`pipeline()\`，除非需要屏障
- [ ] parallel() 内使用 agent 的 \`phase\` 选项（非全局 phase）
- [ ] 处理 null 返回值：\`.filter(Boolean)\`

## 预算

- [ ] 循环前检查 \`budget.total\`（null 时 remaining 为 Infinity）
- [ ] 预留足够余量（\`remaining() > 50_000\`）

## 质量

- [ ] 关键发现使用对抗验证
- [ ] GCF 循环设置最大轮数
- [ ] Critic 明确通过/不通过标准

## 复用

- [ ] 脚本放入 \`.claude/workflows/\`
- [ ] 通过 \`args\` 参数化
- [ ] Schema 定义抽取到共享模块
`,
en: `
Checklist for production-ready Workflows.

## meta
- [ ] \`name\` in kebab-case
- [ ] \`description\` one line, clear purpose
- [ ] \`phases\` match \`phase()\` calls in script

## agent()
- [ ] Prompts are self-contained
- [ ] Use \`label\` for /workflows identification
- [ ] Use \`schema\` for structured data
- [ ] Use \`model: 'haiku'\` for simple tasks
- [ ] Only \`isolation: 'worktree'\` when parallel file writes needed

## Concurrency
- [ ] Default to \`pipeline()\` unless barrier needed
- [ ] Use agent \`phase\` option inside parallel (not global)
- [ ] Handle null returns: \`.filter(Boolean)\`

## Budget
- [ ] Check \`budget.total\` before loops (remaining is Infinity when null)
- [ ] Reserve enough headroom (\`remaining() > 50_000\`)

## Quality
- [ ] Adversarial verify for critical findings
- [ ] GCF loops have max round limits
- [ ] Critics have explicit pass/fail criteria

## Reuse
- [ ] Put scripts in \`.claude/workflows/\`
- [ ] Parameterize via \`args\`
- [ ] Extract Schema definitions into shared modules
`
};

// ═══ AppD: Glossary ═══
CONTENT['appD'] = {
zh: `
Workflow 相关术语速查表。

| 术语 | 英文 | 含义 |
|------|------|------|
| 确定性编排 | Deterministic Orchestration | 由脚本而非模型控制执行路径 |
| 子 agent | Subagent | workflow 中 agent() 派遣的独立执行单元 |
| 屏障 | Barrier | parallel() 的语义——等所有完成才继续 |
| 流水线 | Pipeline | pipeline() 的语义——每个 item 独立流过所有 stage |
| 结构化输出 | Structured Output | 通过 JSON Schema 约束 agent 返回值 |
| 对抗验证 | Adversarial Verification | 独立 agent 尝试反驳发现，过滤误报 |
| 评委面板 | Judge Panel | 多评委打分选最优方案 |
| 循环到干 | Loop Until Dry | 连续 K 轮无新发现时停止 |
| 预算 | Budget | 通过 "+500k" 指令设定的 token 消耗上限 |
| 断点续传 | Resume | 用 resumeFromRunId 恢复中断的 workflow |
| Worktree 隔离 | Worktree Isolation | 在独立 git worktree 中运行 agent |
| 嵌套 Workflow | Nested Workflow | 在 workflow 内调用另一个 workflow |
| GCF | Generate-Critique-Fix | 生成→批评→修复的迭代改进模式 |
| CSO | Claude Search Optimization | Superpowers 的 Skill 描述优化策略 |
| 铁律 | Iron Rule | ccg-workflow 中不可违反的规则 |
`,
en: `
Quick reference for Workflow-related terminology.

| Term | Chinese | Meaning |
|------|---------|---------|
| Deterministic Orchestration | 确定性编排 | Execution path controlled by script, not model |
| Subagent | 子 agent | Independent execution unit dispatched by agent() |
| Barrier | 屏障 | parallel() semantics — wait for all to complete |
| Pipeline | 流水线 | pipeline() semantics — items flow independently |
| Structured Output | 结构化输出 | Constraining agent returns via JSON Schema |
| Adversarial Verification | 对抗验证 | Independent agents try to refute findings |
| Judge Panel | 评委面板 | Multiple judges score solutions |
| Loop Until Dry | 循环到干 | Stop after K consecutive empty rounds |
| Budget | 预算 | Token consumption cap via "+500k" directive |
| Resume | 断点续传 | Restore interrupted workflow via resumeFromRunId |
| GCF | 生成-批评-修复 | Generate-Critique-Fix iterative pattern |
`
};
