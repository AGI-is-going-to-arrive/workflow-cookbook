# 第 29 章 · 示例画廊

> 一句话：**前面 28 章讲清了 Workflow 的每个零件——pipeline、parallel、对抗验证、loop-until-dry、屏障、schema、续传。这一章把它们装进三个「真跑过」的应用级工作流，给你看完整的端到端结果：Run ID、agent 数、token、墙钟，一个不少，全部可溯源。**
>
> 这是一座「画廊」，不是又一遍机制讲解。三幅作品——多维代码审查、死代码扫描、反馈聚类——各对应一种核心编排形态，每一幅都附上它真实运行时的数字与产物。读这一章，你看的不是「应该会怎样」，而是「实际就是这样」。

---

三个示例脚本都放在 `assets/examples/` 下，都在同一个会话里**真实跑过**（`CLAUDE_CODE_WORKFLOWS=1`，Claude Code v2.1.150，主循环 Opus 4.7 (1M)），运行记录在 `assets/transcripts/examples-r5.md`。三者各占一种编排形态：

```mermaid
flowchart LR
    subgraph A["§29.1 review-spa<br/>pipeline + 对抗验证"]
      A1["维度 1 审查"] --> A2["扇出验证<br/>(每条发现 1 个)"]
      A3["维度 2 审查"] --> A4["扇出验证"]
      A5["维度 3 审查"] --> A6["扇出验证"]
    end
    subgraph B["§29.2 dead-code-scan<br/>loop-until-dry"]
      B1["第 1 轮 finder"] --> B2{"空轮?"}
      B2 -->|连续 2 空| B3["DRY_STREAK 终止"]
      B2 -->|有发现| B1
    end
    subgraph C["§29.3 feedback-themes<br/>parallel 屏障"]
      C1["并行摘要<br/>(每项 1 个)"] --> C2["屏障：等全部到齐"]
      C2 --> C3["聚类全集"]
    end
```

三种形态的本质区别，用一张表先立住：

| 形态 | 代表脚本 | 何时各 agent 完成 | 何时进入下一步 | 适用场景 |
|---|---|---|---|---|
| **pipeline + 验证** | review-spa | 各维度独立完成 | 本维度一审完**立即**验证，不等最慢维度 | 多条独立链，希望「谁先好谁先走」 |
| **loop-until-dry** | dead-code-scan | 逐轮串行 | 连续 N 空轮才停 | 一轮可能揭示新目标的递进式清扫 |
| **parallel 屏障** | feedback-themes | 全部并发完成 | **必须等全部到齐**才能聚类 | 下一步需要全集（聚类、汇总、排序） |

下面逐幅展开。每一节的结构统一为：**模式 → 脚本（编排取舍）→ 真实运行（Run ID + 用量表）→ 结果 → 教学点**。

---

## 29.1 review-spa：pipeline 多维审查 + 对抗验证

### 模式

对一份代码做**多个维度**的审查（bugs / security / a11y），每个维度独立成链；某维度审完**立即**对它的每条发现做对抗验证，不等其它维度。这是「pipeline 让每条链各走各的」与「对抗验证只信被验证存活的发现」两个模式的合体——分别在第 8 章（pipeline）和第 17 章（对抗验证）讲过，这里看它们组合起来的实战效果。

真实目标是本书自己的 `index.html`（一份约 600 行的 vanilla-JS SPA）——dogfood，审自己的前端。

### 脚本：编排取舍

脚本在 `assets/examples/review-spa.js`。它的骨架是一个 `pipeline()`，3 个维度各一条两阶段链：

```javascript
  const reviewed = await pipeline(
    DIMENSIONS,
    // Stage 1 — 审查一个维度。
    d => agent(d.prompt, { label: `review:${d.key}`, phase: 'Review', schema: FINDINGS }),
    // Stage 2 — 对该维度的每条发现，并行验证。
    (review, d) => parallel(
      (review?.findings ?? []).map(f => () =>
        agent(
          `Adversarially verify this finding about ${TARGET}. Read the cited lines and try hard to refute it; ` +
          `if you cannot, it is real.\nTitle: ${f.title}\nEvidence: ${f.evidence}\nSeverity: ${f.severity}`,
          { label: `verify:${d.key}`, phase: 'Verify', model: 'haiku', schema: VERDICT },
        ).then(v => ({ ...f, dimension: d.key, verdict: v })),
      ),
    ),
  )
```

这里有三个值得停下来想的设计取舍：

**取舍一：为什么用 `pipeline` 而不是「先全审完、再统一验证」？** 因为 pipeline 的承诺是「每个 item 独立流过全部 stage，阶段间无屏障」（见第 8 章）。bugs 维度审完，它的 6 条发现**立刻**进入验证，不必等 a11y 那条更慢的链审完。如果改用「先 `parallel` 审三维 → 再 `parallel` 验所有发现」，就引入了一道多余的屏障：最快的维度被最慢的拖着等。pipeline 让审查与验证**交错流动**，墙钟更短。

**取舍二：审查用 schema=`FINDINGS`，验证用 schema=`VERDICT`。** 两个阶段各有强类型契约。审查阶段强制 reviewer 返回 `{findings:[{title, evidence, severity}]}`；验证阶段强制 verifier 返回 `{isReal:boolean, reason}`。schema 在工具调用层校验、返回已验证对象（见第 6、7 章），所以 `review?.findings` 和 `f.verdict?.isReal` 可以直接当结构化数据用，无需 `JSON.parse`。

**取舍三：验证 agent 被要求「尽力 refute」。** prompt 写的是「try hard to refute it; if you cannot, it is real」——这是对抗验证的灵魂：默认怀疑，refute 不掉才算真。脚本最后 `.filter(f => f.verdict?.isReal)` 只留存活的。

<div class="callout info">

**关于 `model: 'haiku'`**：脚本给验证 agent 标了 `model: 'haiku'`（验证是相对简单的核对任务，本想用便宜模型）。但**本会话设了 `CLAUDE_CODE_SUBAGENT_MODEL=claude-opus-4-7[1m]`，它覆盖一切 per-call model**（见 `_grounding.md` §A2、Run `wf_9c94951d-58c`）——所以这些「haiku」verifier 实际全跑 Opus。这是为什么这次运行 token 偏高的原因之一。§29.3 会专门讲这个成本陷阱。

</div>

### 真实运行

- **Run ID**：`wf_97b81e86-a0b`（Task `wq64i8tjl`）
- **目标**：`index.html`（~600 行 vanilla-JS SPA）

| 指标 | 值 |
|---|---|
| agent_count | **22**（3 reviewer + 19 verifier） |
| total_tokens | **991,554** |
| tool_uses | **148**（reviewer/verifier 反复 Read 同一文件） |
| duration_ms | **395,166**（≈6.6 分钟） |
| 返回 | `{ confirmedCount: 18, confirmed: [...] }` |

agent_count=22 拆得开：3 个 reviewer（每维度 1 个），加上对三维度全部发现扇出的 19 个 verifier，合计 22。

### 结果

18 条发现经对抗验证存活（`verdict.isReal=true`），按维度分布：**bugs 6 条 / security 4 条 / a11y 8 条**。下面各取要点（完整 18 条见 `assets/transcripts/examples-r5.md`）：

**bugs（6）**——例如最严重的一条：`slugify` 去重用了裸 `{}` 做 `seen` map（L322/521），`seen={}` 继承 `Object.prototype`，于是标题 "constructor" 会得到 id `constructor-NaN`（`++function` 求值为 `NaN`）。修法：`Object.create(null)`。其余涵盖锚点解析、dedup 撞车、深链覆盖语言偏好、硬编码中文报错、scroll/resize 共享 `ticking` 标志。

**security（4）**——均为**潜在 / 供应链类**，无攻击者输入面：mermaid SVG 在 sanitize 之后经 `innerHTML` 注入（仅靠 `securityLevel:'strict'` 兜底）、4 个 CDN 脚本无 SRI、`ghLink.href` 无 scheme 校验、manifest 字段转义不一致。

**a11y（8）**——最实在的一条：整个 `#content` 带了 `aria-live="polite"`（L289/488），导致每次导航都把整章朗读一遍。其余涵盖缺 `aria-current`、移动抽屉背景未 `inert`、首页切换不移焦点、mermaid SVG 无替代文本、代码块不可键盘滚动等。

### 教学点：对抗验证纠正了 reviewer 的夸大

这一节最该记住的不是「找到 18 个 bug」，而是——**验证阶段不只判真伪，还纠正了 reviewer 的夸大**。`verdict.reason` 里的精度澄清本身就是产物：

- **#1/#2 标题夸大被揪出**：reviewer 的标题列举了 `constructor / valueOf / toString / ...` 多个原型键都会中招，但 verifier 实测**只有 `constructor` 能触发**——其余键被 `.toLowerCase()` 打平成 `valueof`/`tostring` 而 miss；且 grep 全仓库**根本没有 "constructor" 这个标题**。于是这条被**降级为 latent**（潜在、当前不触发），high severity 被认定偏高。
- **#2 一处假子主张被证伪**：reviewer 称 `#overview-1` 这类普通 dedup 锚点也不可达——verifier 实测**正常 dedup（`-1`/`-2`）的主查找完全命中、可达**，只有 `constructor-NaN` 这一个特例坏。这个假子主张被直接揪出。
- **#3 措辞误差被指正**：reviewer 把「第 3 个 `Setup`」说成「第 2 个」（底层机制仍成立，只是描述错位）。

```mermaid
flowchart TD
    R["reviewer 提出发现<br/>标题：constructor/valueOf/toString 全中招<br/>severity: high"]
    R --> V["verifier 尽力 refute<br/>读引用行、grep 全仓库"]
    V --> F1["实测：只有 constructor 触发<br/>其余被 toLowerCase 打平"]
    V --> F2["实测：仓库无 'constructor' 标题"]
    F1 --> D["verdict.isReal=true<br/>但 reason 标注：实为 latent，<br/>severity 偏高"]
    F2 --> D
    D --> OUT["产物 = 发现 + 校准后的精度"]
```

<div class="callout tip">

**发现存活 ≠ 全盘照收。** 一条发现 `isReal=true`，只是说「它不是凭空捏造」；它的 severity 是否准确、措辞是否精确、是否「今天就触发」还是「潜在」，要看 `verdict.reason`。本次运行据此把 18 条分成了三档：「今天就触发、非 latent」的高优先项（如删除 `#content` 的 `aria-live`）、「真实但影响小」的普通项、「latent / 供应链 / 瞬态」的可选防御项。**对抗验证的价值不止于过滤假发现，更在于给每条真发现标定可信的优先级**——这正是第 17 章对抗验证的实战意义。

</div>

---

## 29.2 dead-code-scan：loop-until-dry 死代码扫描

### 模式

逐轮扫描一个目标找「定义了但全文未被引用」的符号，**连续若干空轮才停**。这是 loop-until-dry 形态（第 16 章）：用 `while` 循环反复派 agent，直到「干」了（连续空轮）为止——因为确认一个符号死，可能让另一个符号也变得明显可删，所以不能扫一轮就收。

真实目标同样是 `index.html`（SPA 的内联 vanilla JS）。

### 脚本：编排取舍

脚本在 `assets/examples/dead-code-scan.js`，核心是一个带双终止条件的 `while`：

```javascript
  const DRY_STREAK = 2 // 连续这么多空轮就停
  const MAX_ROUNDS = 5 // 硬上限，保证循环必然终止

  const found = []
  let emptyRounds = 0
  let round = 0

  while (emptyRounds < DRY_STREAK && round < MAX_ROUNDS) {
    round++
    phase('Find')
    const { items } = await agent(
      `Round ${round}. Read ${TARGET} and search the same file for references. List vanilla-JS symbols ` +
      `(functions, const/let bindings, event handlers) that are DEFINED but never REFERENCED anywhere in the file. ` +
      `Report only — do NOT edit any file. Ignore anything already reported: ` +
      `${found.map(r => r.symbol).join(', ') || 'nothing yet'}.`,
      { label: `find:round-${round}`, phase: 'Find', schema: DEAD },
    )

    if (items.length === 0) {
      emptyRounds++
      log(`Round ${round}: clean (${emptyRounds}/${DRY_STREAK} empty rounds)`)
      continue
    }

    emptyRounds = 0
    found.push(...items)
  }
```

两个设计取舍：

**取舍一：双终止条件（`DRY_STREAK` + `MAX_ROUNDS`）。** `emptyRounds < DRY_STREAK` 是「干了就停」的正常出口；`round < MAX_ROUNDS` 是「无论如何最多跑 5 轮」的硬上限。后者是安全网——万一 agent 每轮都报一点新东西（哪怕是噪声），循环也不会无限跑。这呼应 `_grounding.md` 里「生命周期 `agent()` 总数上限 1000」的 runaway-loop backstop 思想：循环类工作流**必须**自带硬上限。

**取舍二：report-only，绝不改文件。** prompt 里明写 `Report only — do NOT edit any file`。这是扫描类「大扫除」的安全姿态——先报告、人审、再决定改不改，而不是让 agent 自动删代码。死代码删错了可能引入隐蔽 bug，所以默认非破坏性（对照第 16、18 章）。

**取舍三：每轮把已报符号传回 prompt（`Ignore anything already reported: ...`）。** 避免后续轮次重复报同一个符号，让「空轮」的判定干净。

### 真实运行

- **Run ID**：`wf_2283ab37-710`（Task `w4ii328zm`）
- **目标**：`index.html`

| 指标 | 值 |
|---|---|
| agent_count | **2**（2 轮 × 1 finder） |
| total_tokens | **116,344** |
| tool_uses | **14**（finder 多次 Read/grep 同一文件） |
| duration_ms | **246,496**（≈4.1 分钟） |
| 返回 | `{ rounds: 2, candidateCount: 0, candidates: [] }` |

### 结果

**两轮都是 0 候选。** 第 1 轮干净（`emptyRounds=1`），第 2 轮还是干净（`emptyRounds=2`），连续 2 个空轮达到 `DRY_STREAK`，循环正常退出——**没有**跑满 5 轮上限。agent_count=2 恰好印证「2 轮 × 1 finder」。

最终产物：`index.html` 里**没有定义了却从未被引用的符号**，这是一份干净的体检报告。

### 教学点：零发现也能正确终止

```mermaid
stateDiagram-v2
    [*] --> Round1
    Round1 --> Check1: 0 候选
    Check1 --> Round2: emptyRounds=1 < 2
    Round2 --> Check2: 0 候选
    Check2 --> Done: emptyRounds=2 == DRY_STREAK
    Done --> [*]: 返回 rounds=2, candidateCount=0
    note right of Done
      没跑满 MAX_ROUNDS=5
      连续 2 空轮即收敛
    end note
```

这一节的反直觉点：**一个「什么都没找到」的工作流，也是一次成功的运行。** 很多人写循环类工作流时下意识担心「找不到东西会不会死循环 / 跑满上限」——这次运行给了明确答案：loop-until-dry 的终止条件是「连续 N 个空轮」，所以**即使第一轮就零发现，连续两个空轮照样让它干净收敛**，不会跑满 `MAX_ROUNDS`。

<div class="callout tip">

**两个可迁移的工程纪律。** ①**循环必须有硬上限**：`DRY_STREAK` 决定「正常什么时候停」，`MAX_ROUNDS` 兜底「最坏跑几轮」，二者缺一不可——只有前者，遇到持续噪声会失控；只有后者，会过早砍掉本可收敛的扫描。②**扫描默认 report-only**：破坏性操作（删代码、改文件）应当先产出一份「候选清单」交人审，而不是 agent 自动执行。这次 0 候选恰好展示了非破坏性扫描最安全的形态——它只是看了看，什么都没动。

</div>

---

## 29.3 feedback-themes：parallel 屏障聚类

### 模式

把一批反馈**并行摘要**，然后把**全集**聚类成排序主题。关键在于：聚类这一步**必须等所有摘要到齐**才能跑——你没法单独聚类一条反馈。这正是 `parallel()` 作为**屏障**（而非 pipeline）的正确场景（第 8 章对比过两者）。

输入是一份明确标注的**合成样本** `assets/samples/feedback-sample.csv`（18 行，列 `id,text`）；但**运行本身是真的**——Run ID、token、聚类输出都可溯源。

### 脚本：编排取舍

脚本在 `assets/examples/feedback-themes.js`，三段式：单 agent 加载 → `parallel` 屏障摘要 → 单 agent 聚类：

```javascript
  phase('Load')
  const { items } = await agent(
    `Read ${SOURCE} (a CSV with columns id,text). Return every row as an item with its id and text.`,
    { label: 'load', phase: 'Load', schema: ITEMS },
  )

  // 故意用屏障：下一步跨全集聚类，必须先拿到所有摘要。
  const summaries = await parallel(items.map(it => () =>
    agent(
      `Summarize this feedback in one sentence and name the single issue it is about.\nID ${it.id}: ${it.text}`,
      { label: `summarize:${it.id}`, phase: 'Summarize', model: 'haiku' },
    ).then(summary => ({ id: it.id, summary })),
  ))

  const labelled = summaries.filter(Boolean)

  phase('Cluster')
  const { themes } = await agent(
    `Here are ${labelled.length} summarized feedback items. Cluster them into themes, count the items ` +
    `under each, pick one representative quote per theme, and rank the themes by count (descending).\n\n` +
    labelled.map(l => `- [${l.id}] ${l.summary}`).join('\n'),
    { label: 'cluster', phase: 'Cluster', schema: THEMES },
  )
```

设计取舍：

**取舍一：为什么这里是 `parallel` 屏障，而 §29.1 是 `pipeline`？** 区别在「下一步需不需要全集」。§29.1 的验证只需要**本维度**的发现，所以 pipeline 让各维度交错流动、不互相等待。这里的聚类需要**所有 18 条摘要一起**才能分组、计数、排序——少一条，聚类结果就可能变。所以必须用屏障：`parallel()` 等全部摘要返回，才进入聚类。**「下一步是否依赖全集」是选 pipeline 还是屏障的判定线。**

**取舍二：`.filter(Boolean)`。** `parallel()` 的语义是「某个 agent 出错 → 该位置 `null`，调用本身不 reject」（见第 8 章）。所以拿到 `summaries` 后先 `.filter(Boolean)` 滤掉失败位，再喂给聚类——这是用 `parallel` 的标准防御写法。

### 真实运行

- **Run ID**：`wf_b3febb70-ad9`（Task `wh31drag1`）
- **输入**：`assets/samples/feedback-sample.csv`（18 行）

| 指标 | 值 |
|---|---|
| agent_count | **20**（1 load + 18 summarize + 1 cluster） |
| total_tokens | **607,307** |
| tool_uses | **3** |
| duration_ms | **122,391**（≈2.0 分钟） |
| 返回 | `{ itemCount: 18, themeCount: 8, themes: [...] }` |

agent_count=20 恰好对应「1 个加载 + 18 个摘要（每行一个）+ 1 个聚类」，与 18 行输入吻合。

### 结果

18 项反馈聚成 **8 个主题**（按 count 降序，引用真实聚类输出）：

| 排序 | 主题 | count | 代表引用（节选） |
|---|---|---|---|
| 1 | Onboarding 体验摩擦（步骤不清、缺前置、价值兑现慢） | 4 | "the first-run experience requires reading three documentation pages before the app delivers any value." |
| 2 | 性能与加载速度（仪表盘 / 分析 / 图表渲染） | 3 | "the dashboard takes nearly 8 seconds to load, making the app feel sluggish" |
| 3 | 计费准确性与清晰度（定价定义、重复扣费、收件人配置） | 3 | "Customer was charged twice this month and waited four days for a support response" |
| 4 | 错误处理质量（提示无用、崩溃） | 2 | "error messages are too generic and unhelpful" |
| 5 | 功能请求（导出、高级用户导航） | 2 | "add an export-to-CSV button on the reports screen" |
| 6 | 无障碍与 UI 缺陷（对比度、Esc 关闭模态） | 2 | "Modal dialogs cannot be closed with the Escape key" |
| 7 | 文档缺口（失败/恢复场景） | 1 | "the lack of guidance on recovering from a failed migration." |
| 8 | 搜索国际化（非拉丁 / Unicode 支持） | 1 | "the search box fails to return any results for queries containing non-Latin characters (e.g., Japanese)" |

count 加总 = 4+3+3+2+2+2+1+1 = 18，与输入项数自洽。

### 教学点一：屏障的正确场景

```mermaid
flowchart TD
    L["load: 读 18 行 CSV"] --> P["parallel 屏障"]
    P --> S1["摘要 #1"]
    P --> S2["摘要 #2"]
    P --> Sd["……（共 18 个，并发）"]
    P --> S18["摘要 #18"]
    S1 --> BAR{"屏障：等全部 18 个到齐"}
    S2 --> BAR
    Sd --> BAR
    S18 --> BAR
    BAR --> C["cluster: 跨全集分组 + 计数 + 排序"]
    C --> OUT["8 个主题"]
```

聚类是「全集函数」——它的输入是**整批**摘要，少一条结果就可能不同。这种「下一步必须吃下全部上游结果」的依赖，正是屏障存在的理由。反过来，如果某一步只依赖**单条**上游结果（像 §29.1 的验证只看本维度的单条发现），就该用 pipeline 让它们交错流动、别白等。**判定口诀：下一步依赖全集 → 屏障（parallel）；下一步只依赖单条 → 流水（pipeline）。**

### 教学点二：成本实测——haiku 标签被 Opus 静默覆盖

这是本章最该警惕的成本陷阱。脚本给 18 个摘要 agent 都标了 `model: 'haiku'`（摘要是简单任务，本意省钱）。但本会话设了环境变量 `CLAUDE_CODE_SUBAGENT_MODEL=claude-opus-4-7[1m]`——**它覆盖一切 per-call model**（见 `_grounding.md` §A2、Run `wf_9c94951d-58c`）。结果：18 个标着「haiku」的 agent **实际全跑 Opus 1M**，单次运行烧掉 **607,307 token**。

<div class="callout warn">

**`CLAUDE_CODE_SUBAGENT_MODEL` 是用户/CI 旋钮，脚本无法控制。** 一旦这个环境变量被设置，工作流脚本里写的 `model: 'haiku'`（或任何 per-call model）**被静默忽略**——agent 不会报错，只是默默跑成了环境变量指定的模型。这次 607k token 就是 18 个「haiku」agent 实跑 Opus 的直接后果，印证了 `_grounding.md` §A2 的实测结论（Run `wf_9c94951d-58c`：5 个带不同 `model` 选项的 agent 全部跑 Opus）。

**含义**：在设了该变量的会话里，`model: 'haiku'` **省不了钱**。要真省钱，得由用户或 CI 去调 `CLAUDE_CODE_SUBAGENT_MODEL`，脚本作者管不了。所以「我给摘要标了 haiku，应该很便宜」这个假设，在受控的 CI/会话环境里**可能完全不成立**——务必以实际 token 用量为准。

</div>

把三次运行的「标称模型」与「实跑模型」并排，陷阱一目了然：

| 脚本 | 脚本里标的 model | 实际跑的模型 | 原因 |
|---|---|---|---|
| review-spa | verifier 标 `haiku` | Opus 1M | 环境变量覆盖 |
| feedback-themes | 18 个 summarize 标 `haiku` | Opus 1M | 环境变量覆盖 |
| （对照）`wf_9c94951d-58c` | 5 个 agent 标 haiku/opus/inherit/省略 | 全 Opus 1M | 环境变量覆盖 |

---

## 29.4 如何读这些数字

三幅作品看完，回头把贯穿它们的「读数方法」总结成四条可迁移的直觉。这些不是新机制，而是从真实运行里提炼的**估算心法**——下次你写工作流、看到完成通知里的 `usage`，就能立刻判断「这个数字合不合理」。

**心法一：token ≈ agent 数 × 每 agent 上下文（约 3 万）。** 这是最有用的粗估公式。验证一下三次运行：

| 脚本 | agent 数 | total_tokens | 每 agent 均摊 |
|---|---|---|---|
| review-spa | 22 | 991,554 | ≈45,071 |
| dead-code-scan | 2 | 116,344 | ≈58,172 |
| feedback-themes | 20 | 607,307 | ≈30,365 |

`feedback-themes` 最贴近「每 agent ~3 万」（摘要 agent 上下文短）；`review-spa` 和 `dead-code-scan` 偏高，因为 reviewer/finder 反复 Read 同一个 600 行文件、上下文更重（看 `tool_uses`：review-spa 高达 148、dead-code-scan 14）。所以公式给的是**下界量级**，重读文件、长 prompt、对抗验证都会把它往上推。要点是：**token 主要由 agent 数量驱动**，想省 token 先想「能不能少派 agent」。

**心法二：墙钟取决于关键路径，并发把 N 个压到「最慢的一个」。** 对比 token 和墙钟的关系会发现它们**不成正比**：

| 脚本 | agent 数 | total_tokens | duration_ms | 形态 |
|---|---|---|---|---|
| review-spa | 22 | 991,554 | 395,166 | pipeline + 扇出 |
| feedback-themes | 20 | 607,307 | **122,391** | parallel 屏障 |

`feedback-themes` 用了 20 个 agent、60 万 token，墙钟却只有 **2 分钟**——因为 18 个摘要 agent **并发**跑，墙钟被压到「最慢那一个摘要 + 加载 + 聚类」的关键路径，而不是 18 个串行相加。反观 `review-spa` 6.6 分钟，是因为 pipeline 里每条链是「审查→验证」两阶段串行，且扇出的验证 agent 多。**并发省的是墙钟（不是 token）**：token 该花还是花，但 N 个 agent 同时跑，你只等最慢的一个。

**心法三：对抗验证 / 扇出是 token 大头。** `review-spa` 的 22 个 agent 里有 19 个是 verifier——对抗验证「每条发现派一个验证 agent」的扇出，是它逼近百万 token 的主因。这是个**值得的代价**：多花的 token 换来了「降级 #1/#2 为 latent、揪出 #2 假子主张」这种校准价值（见 §29.1 教学点）。但你要心里有数——**给每条发现都配一个验证 agent，token 会随发现数线性增长**。发现多时，可以考虑只对 high severity 的发现做对抗验证，给 token 设个边界（配合第 21 章的 `budget`）。

**心法四：脚本可复跑，数字可溯源。** 这三个脚本都可以用 `Workflow({ scriptPath: 'assets/examples/<脚本>.js' })` 重新跑（异步返回，完成时由 `<task-notification>` 回传 `usage`/`result`）。本章每一个 Run ID、agent 数、token、墙钟，都记录在 `assets/transcripts/examples-r5.md`，可逐条核对。本书后续确实把这三个脚本**原样复跑了一次**（`wf_ca7aa11f-6fb` / `wf_ccda2a68-fab` / `wf_0771c834-a9f`，记录在 `assets/transcripts/examples-r6.md`）——结果恰好印证心法四：**agent 数与编排形态稳定复现**（dead-code 仍是 2 agent / 2 轮干净、feedback 仍是 20 agent），而**发现数/主题数随目标演进与聚类粒度小幅波动**（review-spa 18→14 条，因 `index.html` 已按首次发现打磨过；feedback 8→6 主题，聚类粒度差异）。要逐位复现请用续传（第 22 章）。

<div class="callout info">

**为什么你的复跑数字可能和本章不完全一样？** 三点原因：①**模型环境**——本章是 Opus 1M 主循环 + `CLAUDE_CODE_SUBAGENT_MODEL` 覆盖（见 §29.3），换个模型环境，token 和墙钟都会变。②**目标内容会变**——`review-spa`/`dead-code-scan` 扫的是 `index.html`，这个文件随本书迭代而变，发现数自然不同（比如本书前端打磨后，a11y 发现可能减少）。③**模型非完全确定**——同一脚本同一目标，reviewer 措辞、发现条数也可能小幅波动。所以本章数字是**某一次真实运行的快照**，不是「常量」；它们的价值在于让你建立量级直觉，而非追求逐位复现。要逐位复现的是**续传**（同脚本+同 args=100% 缓存命中，见第 22 章），那才是确定性保证。

</div>

---

## 29.5 本章小结

- 三幅「真跑过」的应用级作品，各对应一种核心编排形态，全部数字可溯源 `assets/transcripts/examples-r5.md`：
  - **§29.1 review-spa**（`wf_97b81e86-a0b`，22 agent / 991,554 token / 395,166ms）：pipeline 多维审查 + 对抗验证，18 条确认（bugs 6 / sec 4 / a11y 8）。教学点——**对抗验证纠正了 reviewer 的夸大**（多条降级为 latent、一处假子主张被揪出）：发现存活 ≠ 全盘照收。
  - **§29.2 dead-code-scan**（`wf_2283ab37-710`，2 agent / 116,344 token / 246,496ms）：loop-until-dry，2 轮全干净、0 候选、`DRY_STREAK` 终止。教学点——**零发现也能正确终止**，report-only 非破坏性，循环必须有硬上限。
  - **§29.3 feedback-themes**（`wf_b3febb70-ad9`，20 agent / 607,307 token / 122,391ms）：parallel 屏障，18 项→8 主题。教学点——**屏障的正确场景**（聚类需全集）+ **成本陷阱**：`CLAUDE_CODE_SUBAGENT_MODEL` 覆盖脚本里的 `model:'haiku'`，18 个「haiku」agent 实跑 Opus → 单次 607k token。
- **§29.4 读数四心法**：①token ≈ agent 数 × 每 agent ~3 万（重读文件会上推）；②墙钟取决于关键路径，并发把 N 个压到最慢一个（省墙钟不省 token）；③对抗验证/扇出是 token 大头；④脚本可 `Workflow({ scriptPath })` 复跑，数字溯源 `examples-r5.md`。

这一章把全书的零件装成了可运行的整机。你已经看过它们真实跑起来的样子——下一步，去附录里查每个 API 的完整签名与边界，把这些直觉沉淀成随手可查的参考。

> 继续阅读：[附录 A · API 完整参考](#/zh/app-a)
