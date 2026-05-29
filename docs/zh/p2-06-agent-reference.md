# 第 06 章 · agent() 完全指南

> **纬者,织之横丝也;穿经而行,成文成章。**
>
> 经线张好了,可真正让一匹布「长出花纹」的,是那根来回穿梭的纬线。在 Workflow 里,这根纬线就是 `agent()`——它派一个 subagent 去干一件具体的活,等它回来,把产物交到你手上。
>
> 上一章我们把 `meta` 和 `phase()` 这套结构骨架拆到了见底。这一章,我们把目光全押在 `agent(prompt, opts)` 上:它到底返回什么(文本?对象?还是 `null`?)、它的每个选项(`label`、`schema`、`phase`、`model`、`isolation`、`agentType`)各自解决什么问题、为什么它派出去的 subagent 能**保护你主循环的上下文**。
>
> 这是全书你用得最多的一个函数。把它吃透,后面所有实战配方都只是它的不同编排。

---

## 6.1 签名与全貌:一句话,两个参数

据 `_grounding.md` B 节对照官方类型定义,`agent()` 的签名是:

```javascript
agent(prompt: string, opts?: object): Promise<any>
```

- 第一个参数 `prompt`:一段字符串,告诉 subagent「要做什么」。
- 第二个参数 `opts`:可选的选项对象,用来调这个 agent 的行为。
- 返回:一个 `Promise`,你 `await` 它,就拿到 subagent 的产物。

`opts` 的全部字段,先列一张总表,本章逐一展开:

| 选项 | 类型 | 一句话作用 | 本章小节 |
|---|---|---|---|
| `label` | string | 进度树里的显示名(不传则自动编号) | 6.3 |
| `schema` | JSON Schema | 强制结构化输出,返回**已验证对象** | 6.4 |
| `phase` | string | 显式归入某进度组(并发场景必备) | 6.5 |
| `model` | string | 覆盖该 agent 的模型(省略则继承主循环) | 6.6 |
| `isolation` | `'worktree'` | 在独立 git worktree 中运行(**昂贵**) | 6.7 |
| `agentType` | string | 用自定义 subagent 类型(如 `'Explore'`) | 6.8 |

一个最小的、什么选项都不带的调用,长这样:

```javascript
const text = await agent('用一句话总结什么是确定性编排')
```

它派一个 subagent,跑完,返回**一段文本**。这是 `agent()` 最朴素的样子。接下来我们先把「它返回什么」这件最要紧的事讲透——因为返回什么,决定了你后面怎么写代码。

---

## 6.2 返回语义:文本、对象,还是 null?

`agent()` 的返回值有**三种**可能,看你怎么调它、用户怎么响应。这三种一搞混,后面的 `.filter()`、解构、`JSON.parse` 全会出错。据 `_grounding.md` B 节,规则如下:

```mermaid
flowchart TD
    A["await agent(prompt, opts)"] --> B{"用户中途<br/>跳过了它?"}
    B -->|是| C["返回 null"]
    B -->|否| D{"opts 里<br/>有 schema?"}
    D -->|无 schema| E["返回 string<br/>(subagent 最终文本)"]
    D -->|有 schema| F["返回已验证对象<br/>(匹配 schema)"]
    style C fill:#e66
    style E fill:#69d
    style F fill:#2d6
```

### 6.2.1 无 schema → 返回文本(string)

不传 `schema`,`agent()` 就返回 subagent 的**最终文本**——一个字符串。

```javascript
const summary = await agent('用一句话概括这个函数的作用:\n' + codeSnippet)
// summary 是一个 string,例如:"该函数对输入数组去重后按字典序排序并返回。"
log(summary)
```

这适合「我只要一段自然语言结果」的场景:总结、解释、起草一段文字。你拿到的,就是 subagent 写的最后一段话。

### 6.2.2 有 schema → 返回已验证对象

传入 `schema`(一个 JSON Schema),`agent()` 就返回一个**已经过校验的对象**,严格匹配你声明的结构。这是第 01 章 `hello-workflow` 的真实例子(Run ID `wf_dacbd480-d5d`):

```javascript
const r = await agent(
  'Return a one-sentence confirmation message, the integer value of 2+2, ' +
  'and a boolean confirming you ran as a workflow subagent.',
  {
    label: 'smoke',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        sum: { type: 'number' },
        runtimeConfirmed: { type: 'boolean' },
      },
      required: ['message', 'sum', 'runtimeConfirmed'],
    },
  }
)
```

**真实返回值**:

```json
{
  "message": "The Claude Code Workflow runtime smoke test executed successfully as a workflow subagent.",
  "sum": 4,
  "runtimeConfirmed": true
}
```

注意 `sum` 是数字 `4`,**不是字符串 `"4"`**——因为 schema 声明了 `type: 'number'`,校验层把类型给焊死了。你可以直接 `r.sum + 1` 做算术,不必解析、不必容错。这套机制(以及它在工具调用层怎么强制重试)是第 07 章的主题,这里你只需记住:**有 schema → 你拿到的是一个能直接解构、直接计算的干净对象。**

### 6.2.3 用户跳过 → 返回 null

第三种情况最容易被漏掉:**用户在执行中途跳过了这个 agent**(比如在交互里选择略过某一步),这时 `agent()` 返回 `null`。

据 `_grounding.md`:「用户中途跳过该 agent → 返回 `null`(用 `.filter(Boolean)` 过滤)」。

这就是为什么本书所有 `parallel()` / `pipeline()` 的真实示例,在用结果前几乎都跟着一个 `.filter(Boolean)`:

```javascript
const results = await parallel(/* ... */)
return results.filter(Boolean)   // 滤掉被跳过的 null
```

`.filter(Boolean)` 是一个惯用法:拿 `Boolean` 当过滤函数,会把数组里所有「假值」(`null`、`undefined`、`0`、`''`、`false`)都剔掉。在这里它干的事就是**把被跳过的 `null` 项清掉**,只留下真正有结果的项。

<div class="callout warn">

**不 `.filter(Boolean)` 就直接用,会被 `null` 咬到。** 你要是写 `results.map(r => r.findings)`,而其中某个 `r` 是 `null`,就会抛 `Cannot read properties of null`。养成习惯:**凡是 `parallel` / `pipeline` 的结果,用之前先 `.filter(Boolean)`。** 单个 `await agent(...)` 也一样——它要是可能被跳过,用前先判一下 `if (r) { ... }`。

</div>

### 6.2.4 三种返回值速查

| 你怎么调 | 用户响应 | 返回值 | 怎么用 |
|---|---|---|---|
| 无 `schema` | 正常 | `string` | 当文本用,或再喂给下一个 agent |
| 有 `schema` | 正常 | 已验证对象 | 直接解构/计算,无需解析 |
| 任意 | 跳过 | `null` | `.filter(Boolean)` 或 `if (r)` 兜住 |

---

## 6.3 `label`:进度树里的名字

`label` 是最简单的选项:它改的是这个 agent 在 `/workflows` 进度树里的**显示名**。不传,运行时就给它自动编号(如 `agent #3`);传了,树上就显示你给的标签。

```javascript
await agent('审查 auth.ts 的权限校验逻辑', { label: 'review:auth' })
```

它纯粹是**给人看的**,不影响任何执行行为。但在一个扇出几十个 agent 的工作流里,一个好 `label` 就是「看懂进度树」和「对着一堆 `agent #1…#40` 干瞪眼」之间的区别。

看真实运行 `parallel-demo`(Run ID `wf_52957913-6d2`,见 `assets/transcripts/primitives.md`)里 label 怎么用——它把维度名嵌进 label,让三个并发 agent 在树上一目了然:

```javascript
const dims = ['naming', 'error-handling', 'comments']
const results = await parallel(
  dims.map((d, i) => () =>
    agent(`Name one common ${d} code smell in exactly one sentence.`, {
      label: `smell:${d}`,        // ← smell:naming / smell:error-handling / smell:comments
      schema: { /* ... */ },
    })
  )
)
```

<div class="callout tip">

**label 的实用模式:`类型:实例`。** 像 `review:auth.ts`、`smell:naming`、`verify:race-condition` 这样用「前缀 + 冒号 + 具体对象」来命名,进度树会自然按前缀聚成一组组,你扫一眼就知道「哪些是 review、哪些是 verify、各自跑到哪了」。`assets/transcripts/primitives.md` 的三个真实运行(`smoke` / `smell:*` / `find:* / verify:*`)都用了这个模式。

</div>

`label`(显示名)和上一章的 `phase`(归到哪个分组)是两件正交的事:`label` 决定**叶子上写什么字**,`phase` 决定**叶子挂在哪根树枝上**。下一节就讲 `phase`。

---

## 6.4 `schema`:把 agent 变成「结构化数据源」

`schema` 是 `agent()` 最有分量的选项,也是 Workflow 区别于「手动开子任务」的核心能力之一。它的返回效果我们在 6.2.2 已经见过,这里讲清它的**作用机制**和**什么时候该用**。

### 6.4.1 它做了什么:在工具调用层强制校验

据 `_grounding.md` B 节:

> 有 `schema`(JSON Schema)→ 强制 subagent 调 `StructuredOutput` 工具,**在工具调用层校验**,返回**已验证对象**;不匹配则模型重试。

把这句话拆开看:

1. 你传一个 JSON Schema 给 `agent()`。
2. 运行时**强制**这个 subagent 通过一个内部的 `StructuredOutput` 工具来交付结果(而不是写一段自由文本)。
3. subagent 提交的结构,在**工具调用层**被校验是否匹配 schema。
4. **不匹配?模型被要求重试**,直到合规为止。
5. 你 `await` 拿到的,就是一个**保证匹配 schema** 的对象。

```mermaid
sequenceDiagram
    participant S as 脚本
    participant A as subagent
    participant V as StructuredOutput<br/>校验层
    S->>A: agent(prompt, { schema })
    A->>V: 提交结构化结果
    V->>V: 对照 schema 校验
    alt 不匹配
        V-->>A: 拒绝,要求重试
        A->>V: 重新提交
    end
    V-->>S: 已验证对象
```

这意味着:**你不写任何解析代码、不写任何容错分支,就能从一个语言模型那里拿到类型安全的结构化数据。** 在没有 schema 的世界里,你得让模型「输出 JSON」,然后自己 `JSON.parse`、自己 `try/catch`、自己收拾「模型多说了一句废话、把 JSON 解析弄崩了」的烂摊子——schema 把这一切都收进了运行时。

### 6.4.2 最小示例

```javascript
const result = await agent('分析这段代码的圈复杂度,给出数值和一句话评价:\n' + code, {
  label: 'complexity',
  schema: {
    type: 'object',
    properties: {
      score: { type: 'number' },                    // 圈复杂度数值
      verdict: { type: 'string' },                   // 一句话评价
      tooComplex: { type: 'boolean' },               // 是否超阈值
    },
    required: ['score', 'verdict', 'tooComplex'],
  },
})

// 直接当对象用,类型有保证:
if (result.tooComplex) {
  log(`⚠️ 复杂度 ${result.score} 偏高:${result.verdict}`)
}
```

### 6.4.3 数组、嵌套:schema 能描述任意结构

schema 不止能描述扁平对象。(注:`pipeline-demo`,Run ID `wf_bf086b98-6ec`,的第一阶段其实是个**单字段对象** `{ example: string }`,并**没有**用数组——数组只是它能描述的更复杂结构之一。)这里给一个嵌套 + 数组的示例(示意,未实跑):

```javascript
const review = await agent('审查这个文件,列出所有问题,每条含严重度和行号', {
  label: 'review:detailed',
  schema: {
    type: 'object',
    properties: {
      file: { type: 'string' },
      issues: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            severity: { type: 'string', enum: ['critical', 'warning', 'info'] },
            line: { type: 'number' },
            message: { type: 'string' },
          },
          required: ['severity', 'line', 'message'],
        },
      },
    },
    required: ['file', 'issues'],
  },
})

// review.issues 是一个对象数组,每项保证有 severity/line/message
const criticals = review.issues.filter(i => i.severity === 'critical')
log(`发现 ${criticals.length} 个 critical 问题`)
```

<div class="callout tip">

**什么时候该传 schema?判据就一句:你打算用代码「消费」这个产物吗?** 如果产物要被后续代码读字段、做条件分支、喂给下一个 agent 的 prompt——传 schema,拿干净对象。如果你只要一段给人看的自然语言(最终报告的散文、一段解释)——不传,拿文本就行。一个实战工作流里,中间环节几乎全程带 schema(因为要程序化串联),只有最后「写给人看」的那一步可能返回纯文本。

</div>

`schema` 还能跟 `agentType`(6.8)**组合**——让一个自定义类型的 subagent 也返回结构化数据。这点 6.8 节细说。schema 的完整威力(`enum`、嵌套校验、重试机制的边界)是第 07 章的专题。

---

## 6.5 `phase`:并发场景下的显式归组

`phase` 选项我们在第 05 章 5.5.1 节已经深入讲过,这里从 `agent()` 的视角再钉一遍——因为它是**写并发工作流时最容易漏、一漏进度树就乱**的选项。

据 `_grounding.md`:`opts.phase`「显式归入某进度组(在 pipeline/parallel 内部尤其重要,避免竞争全局 `phase()`)」。

**核心规则,一句话:**

- **顺序代码**里,用全局 `phase('X')` 切一下当前阶段就行,后续 agent 自动归进去。
- **`parallel` / `pipeline`** 里,多个 agent 并发飞着,全局游标会被抢,所以必须给每个 `agent()` 传 `opts.phase: 'X'`,把归组信息**钉在 agent 自己身上**。

这正是真实运行 `pipeline-demo` 的写法(Run ID `wf_bf086b98-6ec`):

```javascript
const out = await pipeline(
  items,
  (kind) =>
    agent(`Give a one-line code example of a ${kind} bug.`, {
      label: `find:${kind}`,
      phase: 'Find',                 // ← 钉在 Find,不靠全局游标
      schema: { /* ... */ },
    }),
  (found, kind) =>
    agent(`Is this genuinely a ${kind} bug? ...`, {
      label: `verify:${kind}`,
      phase: 'Verify',               // ← 钉在 Verify
      schema: { /* ... */ },
    }).then((v) => ({ kind, ...found, ...v }))
)
```

`phase: 'Find'` / `'Verify'` 里的字符串,同样要和 `meta.phases[].title` **精确匹配**(大小写、空格一字不差)——这是第 05 章 5.5 节反复强调的机制。

<div class="callout warn">

**`opts.phase` 和全局 `phase()` 的关系不是「二选一」,而是「并发里优先用 `opts.phase`」。** 你完全可以在 `pipeline` 之前写一句 `phase('Find')` 兜底,但真正决定每个并发 agent 归组的,是它自己的 `opts.phase`。两者都在场时,**附着在 agent 上的 `opts.phase` 才是靠得住的那一个**,因为它不受并发交错的影响。

</div>

---

## 6.6 `model`:模型继承与单点覆盖

`model` 选项控制**这一个 agent** 用哪个模型。它是第 05 章 5.6 节那套模型选择里**唯一有官方明确语义、值得依赖**的旋钮:省略时继承主循环模型,显式给值则覆盖这个默认。第 05 章已强调:`meta.phases[].model` 的运行时效果未定,真要设模型,就靠这里的 `opts.model`。(顶层 `meta.model` 与各层的自动解析关系事实源未核实,见 5.6;本节只讲已确认的 `opts.model`。)

### 6.6.1 默认:继承主循环模型

据 `_grounding.md`:`opts.model`「省略则继承主循环模型;简单任务可用 `'haiku'`」。这是工具定义里关于 `model` 唯一明确的语义——**省略时继承主循环**。

不写 `model`,这个 agent 就用**主循环当前的模型**。前面这些真实运行所在的早期会话主循环是 Opus 4.7,subagent 模型由 `CLAUDE_CODE_SUBAGENT_MODEL=claude-opus-4-7[1m]` 指定(见 `_grounding.md` A 节)。前面所有真实运行(`hello` / `parallel` / `pipeline`)都**没有**显式传 `model`,所以它们的 subagent 都跑在继承来的 Opus 模型上。(R11 复核会话已换成 Opus 4.8,`CLAUDE_CODE_SUBAGENT_MODEL=claude-opus-4-8[1m]`、printenv 实测——「不写 `model` 则继承主循环」这一结论与型号无关。)

<div class="callout warn">

**`CLAUDE_CODE_SUBAGENT_MODEL` 一旦设置,会覆盖每个 agent 的 `model`。** 这是一个**用户 / CI 级的环境旋钮,脚本管不着**。本书有一次专门探针(Run ID `wf_9c94951d-58c`)派了 5 个 agent,分别带 `'haiku'` / `'inherit'` / `'opus'` / 省略 / 处在 `meta.phases[]` 标了 `model:'haiku'` 的阶段——**5 个全部跑成了 Opus**,因为该会话设置了 `CLAUDE_CODE_SUBAGENT_MODEL=claude-opus-4-7[1m]`(直接观测到的环境事实)。换句话说:你在脚本里写的 `model`,**会被这个环境变量静默盖掉**。这正是为什么第 05 章没法单独隔离 `meta.phases[].model` 的效果——它和 `opts.model` 一起被这个旋钮覆盖了。结论:`opts.model` 是脚本能控制的最细的旋钮,但它**不是最终裁决**——环境变量在它之上。

</div>

### 6.6.2 用 `'haiku'` 给简单任务降本

当一个 agent 的活儿很简单——分类、抽取、格式转换、判个布尔——用强模型就是浪费。把它降到 `'haiku'`:

```javascript
// 一个只需「判断输入是不是一个有效的 URL」的轻量任务
const check = await agent(`这是不是一个合法的 HTTP(S) URL?只回答 true 或 false:${input}`, {
  label: 'url-check',
  model: 'haiku',                 // ← 简单判断,用便宜模型
  schema: {
    type: 'object',
    properties: { valid: { type: 'boolean' } },
    required: ['valid'],
  },
})
```

### 6.6.3 为什么 model 选择直接关系到「钱」

`_grounding.md` C 节给了一条关键经验法则:

> token ≈ agent 数 × 每 agent 上下文(约 2.5–3 万/agent);墙钟取决于关键路径,并发把 N 个压到「最慢的一个」。

这条法则有三个真实运行作证(同一会话,见 `assets/transcripts/primitives.md`):

| Workflow | agent_count | total_tokens | 每 agent 约 |
|---|---|---|---|
| hello(单 agent) | 1 | 26,338 | ~26.3k |
| parallel(3 并发) | 3 | 78,844 | ~26.3k(≈3×) |
| pipeline(3 项×2 阶段) | 6 | 158,982 | ~26.5k(≈6×) |

`78844 ≈ 3 × 26338`、`158982 ≈ 6 × 26500`——**总 token 几乎线性正比于 agent 数**,每个 agent 稳定在约 2.5–3 万 token。背后的原因(每个 agent 是独立上下文)马上在 6.9 节讲。

这条法则有个直接推论:**降本最有效的杠杆,是把「agent 数最多」的那个阶段换成便宜模型。** 一个工作流要是在某个广度阶段扇出 50 个 agent,把它们从 opus 换成 haiku,省下的就是「50 × 单价差」——比你优化任何别处都立竿见影。这正是第 05 章 5.6 节「广度阶段 haiku、深度阶段 opus」模式的经济学依据。

<div class="callout info">

**`model` 写在 `agent()` 上 vs 写在 `meta.phases[]` 上。** 两者语义不同,**可靠性也不同**:`meta.phases[].model` 是**声明性**的(写在经线上,表达「这一阶段计划用某模型」,方便读脚本的人看清成本结构),但它**运行时是否单独生效未定**(见 5.3.3);`agent({ model })` 是**命令性**的(写在纬线上,**真正**决定这一个 agent)。实战里正确的组合是:在 `meta.phases` 上标好阶段意图,**同时**在该阶段的每个 `agent()` 上落实 `model`——一处「说计划」给人看,一处「下命令」让它真生效。**别只标 phases、不写 agent 上的 `model`。**

</div>

---

## 6.7 `isolation: 'worktree'`:昂贵但有时必需的隔离

`isolation: 'worktree'` 让这个 agent 在一个**独立的 git worktree** 里跑。它是 `agent()` 选项里**最重、最该谨慎使用**的一个。

### 6.7.1 它解决什么问题

设想一个工作流:你想让 5 个 agent **并行**地各改各的代码(比如分头修 5 个不同的 bug,每个都要改文件)。这些 agent 要是都在**同一个工作目录**里写文件,就会互相踩踏——A 改了 `utils.js`,B 也在改 `utils.js`,git 状态、文件内容彼此污染,结果没法预测。

`isolation: 'worktree'` 给每个这样的 agent 一个**自己的 git worktree**(同一仓库、独立的工作目录),它在里头改文件,跟别的 agent 互不干扰。据 `_grounding.md`:

> `opts.isolation: 'worktree'` 在独立 git worktree 运行(**昂贵**,仅当并行改文件会冲突时用,无改动自动清理)。

```javascript
// 示意,未实跑:5 个 agent 并行改不同的 bug,各自在独立 worktree 里写文件
const fixes = await parallel(
  bugs.map((bug, i) => () =>
    agent(`修复这个 bug 并直接修改相关文件:${bug.description}`, {
      label: `fix:${bug.id}`,
      isolation: 'worktree',        // ← 各自独立 worktree,并行写文件不冲突
    })
  )
)
```

**它实测落在哪?**(本机实测,Run ID `wf_d9a10c19-b65-2`)一个带 `isolation: 'worktree'` 的 agent,工作目录是 `<repo>/.claude/worktrees/wf_<runId>-<n>/`——这是一个**货真价实的 git worktree**:在它里头 `git rev-parse --show-toplevel` 指向的就是这个隔离目录,`git rev-parse --git-dir` 则落在 `<repo>/.git/worktrees/wf_<runId>-<n>`。换句话说,每个 worktree agent 都在一棵**独立的工作树**里改文件,彼此互不冲突,目录名按 `wf_<runId>-<n>` 编号。(注:**确切的清理时机、分支名、以及合并回主树的机制**,官方与本机实测都未取得确证——见 6.7.3。)

### 6.7.2 为什么说它「昂贵」

「昂贵」不是修辞。创建一个 git worktree,要做真实的磁盘操作,还有 git 开销。结合本书写作上下文给出的量级:**每个 worktree 约 200–500ms 起步,外加每个 agent 的磁盘占用**。你要是给 50 个 agent 都加上 `isolation: 'worktree'`,这笔开销会攒成一笔可观的延迟和磁盘消耗。

所以用不用的判据非常明确——**只有「并行 + 改文件 + 会冲突」三个条件同时成立时才用**:

```mermaid
flowchart TD
    A["这些 agent 要并行跑吗?"] -->|否,串行| N1["不需要 worktree"]
    A -->|是| B["它们会改文件吗?"]
    B -->|否,只读/只分析| N2["不需要 worktree"]
    B -->|是| C["改的文件会互相冲突吗?"]
    C -->|否,各改各的独立文件| N3["通常不需要<br/>(但需谨慎评估)"]
    C -->|是| Y["✓ 用 isolation: 'worktree'"]
    style Y fill:#2d6
    style N1 fill:#ccc
    style N2 fill:#ccc
    style N3 fill:#ccc
```

### 6.7.3 自动清理

一个贴心的细节:工具契约写明「**无改动自动清理**」(`auto-removed if unchanged`)。也就是说,某个加了 `isolation: 'worktree'` 的 agent 跑完后**没有产生任何文件改动**,运行时会自动把那个临时 worktree 清掉,不留垃圾。这把「加了 worktree 却发现没必要」的善后成本降下来了——但它**不能**成为「随手加 worktree」的理由,因为创建本身的开销你已经付出去了。

不过有一道边界要划清:**「无改动则清理」这条工具契约里有,但确切的清理时机、worktree 的分支名、以及改动如何合并回主树,官方与本机实测都未取得确证**——本书把这几点按「未核实」对待,别当成实测确认的事实(完整的模式与权衡见第 19 章)。

<div class="callout warn">

**默认不要加 `isolation: 'worktree'`。** 绝大多数 agent 干的是**只读分析**(审查、研究、总结、判断)——它们根本不写文件,自然没有冲突,加 worktree 纯属浪费。就算写文件,只要各 agent 写的是**互不相干的独立文件**,通常也不用隔离。这个选项是为「并行修改、且会撞车」这一**特定**场景准备的逃生舱,不是默认装备。Worktree 隔离的完整模式和权衡,是第 19 章的专题。

</div>

---

## 6.8 `agentType`:借用自定义 subagent 类型

`agentType` 让这个 agent 不走默认的通用 subagent,而是用一个**具名的自定义类型**。据 `_grounding.md`:

> `opts.agentType` 用自定义 subagent 类型(如 `'Explore'`、`'code-reviewer'`,与 schema 可组合)。

### 6.8.1 它解决什么问题

Claude Code 生态里有一些**预配置的 subagent 类型**——它们各自带着特定的系统提示、工具集或行为取向。比如:

- `'Explore'`:擅长在代码库里做开放式探索/检索。
- `'code-reviewer'`:面向代码审查,带审查取向的系统提示。

当你想让某个 agent **以某种专门角色行事**,而不是从通用 subagent 起步,就用 `agentType` 指定:

```javascript
// 用 Explore 类型做代码库探索
const findings = await agent('在代码库里找出所有处理用户鉴权的入口点', {
  label: 'explore:auth',
  agentType: 'Explore',           // ← 借用 Explore 类型的探索能力
})
```

### 6.8.2 与 `schema` 组合

`agentType` 和 `schema` **可以同时用**——既指定 agent 的「角色类型」,又约束它的「输出结构」:

```javascript
// 示意,未实跑:用 code-reviewer 类型审查,并强制结构化输出
const review = await agent('审查这个 diff,报告问题', {
  label: 'review:typed',
  agentType: 'code-reviewer',     // ← 用审查者类型
  schema: {                       // ← 同时约束输出结构
    type: 'object',
    properties: {
      issues: { type: 'array', items: { type: 'string' } },
      verdict: { type: 'string', enum: ['approve', 'request-changes'] },
    },
    required: ['issues', 'verdict'],
  },
})
// review 既由 code-reviewer 角色产出,又保证匹配 schema
```

这种组合很强:`agentType` 决定「**谁**来做、以什么取向做」,`schema` 决定「产物**长什么样**」。两者正交,可以随便搭。

### 6.8.3 `agentType` 有校验(已实测)——传错会在生成模型之前抛错

这是本书**亲手实测确认**的一条事实(Run ID `wf_a222f20f-0f5`):给 `agentType` 传一个不存在的值,运行时**在派生任何模型之前**(0 token / 4ms)就抛错,并把**全部可用 agent 列出来**。探针用 `try/catch` 把这个错误兜住并返回,错误原文逐字如下:

```text
agent({agentType}): agent type 'definitely-not-a-real-agent-xyz' not found.
Available agents: claude, claude-code-guide, codex:codex-rescue, Explore,
general-purpose, get-current-datetime, init-architect, Plan, planner,
statusline-setup, team-architect, team-qa, team-reviewer, ui-ux-designer
```

两个可以直接利用的事实:其一,**拼错或写了不存在的类型不会被静默吞掉**,而是立刻、明确地报错——所以 `agentType` 出问题很好查;其二,错误信息**自带一份「可用类型清单」**,等于运行时帮你把当前环境注册的所有 agent 都列了出来。

<div class="callout warn">

**`agentType` 已实测有校验,而 `model` 是否校验只是第三方说法。** 这是一个**有据可依的对比**:
- **`agentType`** —— **本书实测确认有校验**(`wf_a222f20f-0f5`):未知值在生成模型前 0 token 抛错并列出可用类型。
- **`model`** —— 官方只明确了「省略则继承主循环」。至于「它**不**做校验、拼错(如 `'hauku'`)不在解析期报错、而是 passthrough 后才失败」——这是**第三方资料的说法,本书未独立实测**,所以不当作已证实的事实。

落到实践上:写 `agentType` 时,拼错会被运行时当场拦下;但写 `model` 时,**别指望运行时帮你抓拼写错误**——把模型名写对,或者固定从一组常量里取值。

</div>

<div class="callout info">

**`agentType` 能用哪些值,取决于你的环境。** 上面那份清单(`claude` / `Explore` / `planner` / `code` 相关类型……)是**本书实测会话**(`wf_a222f20f-0f5`)的注册表快照;你实际能用哪些类型,取决于 Claude Code 内置的、以及你在项目里(如 `.claude/agents/`)定义的自定义 subagent,**因环境而异**。不传 `agentType` 时,用的就是默认通用 subagent(它内部的类型名叫 `workflow-subagent`)——本章其余真实运行示例都属于这种默认情况。想知道你自己环境里有哪些类型,最快的办法就是故意传一个不存在的值,读它报错列出来的清单。

</div>

---

## 6.9 上下文隔离:agent() 为什么能「保护主循环」

讲完所有选项,回到一个贯穿全书的核心问题:**为什么用 `agent()` 扇出工作,能保护你主循环的上下文?**

答案藏在 `_grounding.md` 的一句事实里:

> subagent 被告知「最终文本即返回值」(不是给人看的话),故返回原始数据。

再加上那条经验法则给出的**强烈暗示**:既然真实数据一直呈现 `total_tokens ≈ agent_count × 每 agent 上下文`(C 节经验法则),**最自然的解释就是「每个 agent 跑在各自独立的上下文里」**——本节就据此推论展开。(注:这是从 token 经验法则反推出的合理解释,而非已核实的 API 内部机制;工具定义层面只确认了 subagent「最终文本即返回值」、以及各自的产出计入总 token。)

### 6.9.1 独立上下文意味着什么

拿它和主循环对比着看:

- 你的**主循环**有一个会随对话不断变长的上下文窗口。每读一个大文件、每跑一条产出长输出的命令,这些字节都**永久驻留**在主循环上下文里,挤占后面的推理空间。
- 而每个 `agent()` 派出去的 subagent,跑在**自己独立的上下文**里。它读了 10 万行代码、生成了一大段分析——这些字节全留在**它自己的**上下文里。它跑完后,**只有它的返回值**(那个文本或已验证对象)回到你的主循环。

```mermaid
flowchart LR
    subgraph Main["主循环上下文(宝贵)"]
        M["你的对话<br/>+ 只收到精炼的返回值"]
    end
    subgraph Sub1["subagent A 独立上下文"]
        A["读海量代码<br/>生成长分析<br/>(字节留在这里)"]
    end
    subgraph Sub2["subagent B 独立上下文"]
        B["读另一批文件<br/>(字节留在这里)"]
    end
    A -->|只回传返回值| M
    B -->|只回传返回值| M
    style Main fill:#2d6
```

这就是 `agent()` 「上下文保护」的本质:**把会污染主循环的「过程字节」(读到的原始资料、中间推理)隔离在 subagent 的一次性上下文里,只让「结果字节」(精炼的返回值)回流。** 一个要读 20 个文件才能回答的问题,你不必把这 20 个文件读进主循环——派一个 agent 去读、去想,它只把答案带回来。

### 6.9.2 「最终文本即返回值」的设计

普通的子任务会返回一段**写给人看**的话(「好的,我已经帮你看完了,这个文件主要做……」)。但 Workflow 的 subagent 被明确告知:**你的最终输出就是程序的返回值,不是给人看的寒暄。** 据 `_grounding.md`:

> subagent 被告知「最终文本即返回值」(不是给人看的话),故返回原始数据。
> 结构化输出在工具调用层校验,模型不合规会重试。

所以:

- **不带 schema** 时,subagent 把「原始数据」当最终文本返回(而不是客套话)——你拿到的字符串就是可用的结果本身。
- **带 schema** 时,它走 `StructuredOutput` 工具,返回严格匹配的对象。

这个设计让 `agent()` 的返回值**适合被程序消费**,而不是给人读——这正是它能当「确定性编排的积木」的前提。

<div class="callout tip">

**实践推论:把「重读、重想」的脏活交给 agent。** 凡是「得吞掉大量上下文才能得出一个小结论」的任务——通读一个大模块、扫一批日志、研究一份长文档——都适合丢给 `agent()`。它在独立上下文里消化原料,只把结论带回主循环。这正是 `parallel` / `pipeline` 大规模扇出时,主循环上下文却几乎不涨的原因——也是 Workflow 相比「在主循环里硬读」的根本优势。

</div>

---

## 6.10 选项组合:把它们用在一起

现实中的 `agent()` 调用往往**同时**用上多个选项。下面这个示例(示意,未实跑)把本章选项尽量凑到一起,并标出每个的意图:

```javascript
const review = await agent(
  `审查这个分片的代码质量,列出问题:${shard}`,
  {
    label: `review:${shard}`,        // 6.3 进度树显示名
    phase: 'Review',                 // 6.5 并发里显式归组(精确匹配 meta.phases)
    model: 'opus',                   // 6.6 这步要质量,用强模型(单次调用覆盖)
    agentType: 'code-reviewer',      // 6.8 用审查者类型
    schema: {                        // 6.4 强制结构化输出,返回已验证对象
      type: 'object',
      properties: {
        issues: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              severity: { type: 'string', enum: ['critical', 'warning', 'info'] },
              message: { type: 'string' },
            },
            required: ['severity', 'message'],
          },
        },
      },
      required: ['issues'],
    },
    // 注意:这里【没有】isolation——审查是只读分析,不写文件,无需 worktree(6.7)
  }
)

// 因为有 schema,review 是已验证对象,可直接消费:
const blockers = (review?.issues ?? []).filter(i => i.severity === 'critical')
```

逐项回看这次组合的决策:

| 选项 | 这里的值 | 为什么 |
|---|---|---|
| `label` | `review:${shard}` | 用「类型:实例」模式,进度树可读(6.3) |
| `phase` | `'Review'` | 这是并发审查,必须显式归组(6.5) |
| `model` | `'opus'` | 审查要质量,用强模型(6.6) |
| `agentType` | `'code-reviewer'` | 借用审查取向的类型(6.8) |
| `schema` | 嵌套对象+enum | 产物要被代码筛选 critical,需结构化(6.4) |
| `isolation` | **不设** | 只读分析,不写文件,无冲突风险(6.7) |

这张表本身就是一份「怎么选 agent 选项」的决策示范:**每个选项都该有一个明确的「为什么用 / 为什么不用」,而不是凭感觉堆上去。** 尤其 `isolation`——它的「不设」和别的选项「设了」一样,都是一个有意识的决定。

---

## 6.11 本章小结

- **`agent(prompt, opts)`** 派发一个 subagent 执行 `prompt`,`await` 返回其产物;它是全书使用频率最高的函数(6.1)。
- **三种返回语义**:无 `schema` → 文本 `string`;有 `schema` → **已验证对象**(可直接解构/计算);用户跳过 → `null`(故 `parallel`/`pipeline` 结果消费前要 `.filter(Boolean)`)(6.2)。
- **`label`** 是进度树显示名,用「类型:实例」模式(如 `review:auth`)最易读;不影响执行(6.3)。
- **`schema`** 强制 subagent 走 `StructuredOutput` 工具、在工具调用层校验、不匹配则重试,让你**零解析、零容错**拿到结构化数据;判据是「产物要被代码消费吗」(6.4)。
- **`phase`** 显式归入进度组;顺序代码用全局 `phase()`,**并发(`parallel`/`pipeline`)里必须用 `opts.phase`** 避免竞争全局游标;字符串须与 `meta.phases[].title` 精确匹配(6.5)。
- **`model`** 省略则继承主循环(本章示例的早期会话为 Opus 4.7,R11 复核会话为 Opus 4.8——结论与型号无关);简单任务用 `'haiku'` 降本。**它是脚本能控制的最细旋钮,但不是最终裁决**——`CLAUDE_CODE_SUBAGENT_MODEL` 一旦设置会覆盖每个 agent 的 `model`(`wf_9c94951d-58c`:5 个 agent 全 Opus);`meta.phases[].model` 单独是否生效未定、顶层 `meta.model` 语义待核实(见 5.3.3、5.6)。由真实数据印证 **token ≈ agent 数 × 每 agent 上下文(~2.5–3 万)**,故把扇出最多的阶段换便宜模型是最有效的降本杠杆(6.6)。
- **`isolation: 'worktree'`** 给 agent 独立 git worktree,**昂贵**(每个约 200–500ms + 磁盘),**仅当「并行 + 改文件 + 会冲突」三条件同时成立**才用,无改动自动清理(6.7)。
- **`agentType`** 借用自定义 subagent 类型(如 `'Explore'`、`'code-reviewer'`),决定 agent 的角色取向,**可与 `schema` 组合**;**已实测有校验**(`wf_a222f20f-0f5`):未知值在生成模型前 0 token 抛错并列出可用类型——与 `model` 是否校验仅属第三方说法形成对比(6.8)。
- **上下文隔离**是 `agent()` 的灵魂:每个 subagent 独立上下文,只把**返回值**回流主循环,把「过程字节」隔离在一次性上下文里——这正是它**保护主循环上下文**、能大规模扇出的根本原因(6.9)。

纬线的这根单丝——`agent()`——我们已经看到了头。但一根丝织不成花纹。下一章,我们钻进它最有分量的那个选项 `schema`,看「结构化输出」怎么把一群各说各话的 subagent,拧成一条能被代码可靠消费的数据流水线。

> 继续阅读:[第 07 章 · 结构化输出与 Schema](#/zh/p2-07)
