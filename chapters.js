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

Workflow 功能通过 \`Workflow\` 工具暴露。在 Claude Code 中，你可以通过 \`ultrawork\` 关键词或直接调用 Workflow 工具来使用它。

<div class="callout tip">
<div class="callout-title">实测发现</div>
在当前版本的 Claude Code 中，Workflow 功能已经默认可用，无需设置环境变量。输入 "ultrawork" 关键词即可触发。
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

The Workflow feature is exposed through the \`Workflow\` tool. In Claude Code, you can use it via the \`ultrawork\` keyword or by directly calling the Workflow tool.

<div class="callout tip">
<div class="callout-title">Real Test Finding</div>
In the current version of Claude Code, the Workflow feature is available by default — no environment variable needed. Type the "ultrawork" keyword to trigger it.
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
在当前版本（2025年5月）中，Workflow 功能默认可用。你可以在对话中输入 "ultrawork" 关键词触发，或让 Claude 直接使用 Workflow 工具。
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

- Workflow 默认可用，无需特殊配置
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
In the current version (May 2025), the Workflow feature is available by default. You can trigger it by typing "ultrawork" in conversation, or have Claude directly use the Workflow tool.
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

- Workflow is available by default, no special configuration needed
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

We tested a complex Schema with nested objects, enum constraints, and arrays — it passed validation on the first try with no retries needed.

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
\`\`\`
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
| \`opts.schema\` | object | — | JSON Schema for structured output |
| \`opts.model\` | string | inherited | 'sonnet' / 'opus' / 'haiku' |
| \`opts.isolation\` | 'worktree' | — | git worktree isolation |
| \`opts.agentType\` | string | — | custom agent type |

## parallel(thunks) / pipeline(items, ...stages)

See chapters 06 for detailed usage and decision tree.

## budget

| Property | Type | Description |
|----------|------|-------------|
| \`budget.total\` | number \\| null | User-set token target |
| \`budget.spent()\` | number | Output tokens consumed |
| \`budget.remaining()\` | number | Remaining (Infinity if no target) |

## Concurrency Limits

- Max concurrent: \`min(16, CPU cores - 2)\`
- Max lifetime agents: 1000

## Script Restrictions

- \`Date.now()\` / \`Math.random()\` / no-arg \`new Date()\` unavailable (breaks resume)
- No filesystem or Node.js API access
- Standard JS built-ins (JSON, Math, Array, etc.) available
`
};
