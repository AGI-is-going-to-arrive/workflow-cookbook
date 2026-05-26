# 第 12 章 · 生成-批评-修复循环（GCF）

> 一句话：**第一版代码几乎总有盲区，可这些盲区你往往看不见——除非换一个被明确要求「挑刺」的独立 agent 去找。「生成-批评-修复」（Generate → Critique → Fix）让三个 agent 接力：一个写、一个专门挑刺、一个据刺重写。本章用一次真实运行展示它怎么把一个看着挺简单的函数从「能跑」逼到「健壮」。**
>
> 这是实战篇里一个看着朴素、却极有杠杆的配方。它和第 17 章「对抗验证」、第 14 章「评委面板」共享同一条母题——**生成与评估分离**——但落点不同：对抗验证**判真伪**、评委面板**选优**，而 GCF **据评修复**。这三者的边界在哪、怎么组合，是本章的重点之一。

---

## 12.1 配方动机：为什么不能让 agent「自己检查自己」

先说一个所有人都试过、也几乎都栽过跟头的做法。

你让一个 agent「写个 `slugify` 函数」，它写完了；你顺手追一句「检查一下有没有 bug」。它扫一眼，回你「看起来没问题，空格、标点、大小写都处理了」。然后你一上线，第二天就发现 emoji 把锚点搞乱了、全角数字直接被吞掉。

**问题的根子不在模型「不够聪明」，而在「自我评估」这个任务本身就有结构性缺陷。** 同一个 agent 刚写完这段代码，它的上下文里全是「我为什么这么写」的论证；这时再让它审视自己，立场早就被锚定了——它会倾向于**替自己辩护**，而不是**质疑自己**。这是确认偏误（confirmation bias）躲不掉的结果，和第 17 章对抗验证开篇讲的是同一个坑。

GCF 的核心洞察只有一句：**把批评交给一个全新的、独立的 agent，并且明确要求它「挑刺」。**

- 它有**独立的上下文**：没有「这是我写的」这层包袱，眼里只有一段待审的代码。
- 它有**对抗性的立场**：prompt 明确让它当一个「找茬专家」，成功标准就是「找出这段代码站不住脚的地方」。
- 它的产物是**结构化的**：用 schema 把批评钉成一个 `issues` 数组，而不是一句「看起来还行」的客套。

但 GCF 比对抗验证多走了关键一步——**它不止于「找出问题」，而是把问题交给第三个 agent 去『逐条修复』。** 对抗验证的终点是一个判决（这是不是真 bug），GCF 的终点是一份**改好的产物**。就这一步之差，让两者的适用场景完全岔开（见 12.5）。

于是就有了天然的三阶段顺序流水线：

```mermaid
flowchart LR
  G["① Generate<br/>写第一版"] --> C["② Critique<br/>独立对抗式挑刺<br/>产出结构化 issues"] --> F["③ Fix<br/>据每条 issue 重写"]
  style G fill:#e3f2fd
  style C fill:#fff3e0
  style F fill:#e8f5e9
```

阶段之间是**严格的顺序依赖**：Fix 要等 Critique 的产物（`issues` 列表），Critique 又要等 Generate 的产物（第一版代码）。这种「每个阶段都吃上一阶段的输出」的形态，正是第 08 章 `pipeline` 的拿手好戏；只有一个目标时，也可以直接拿 `await` 串起来（见 12.4）。

<div class="callout info">

**GCF 和「自我反思」（self-reflection）有什么不一样。** 社区里流行的「reflexion」「self-refine」是让**同一个模型**生成、反思、再改。GCF 的关键差异在于**换 agent**——每个阶段都是一次独立的 `agent()` 调用，各有各的上下文。据 `_grounding.md`，工作流里的每个 `agent()` 都是一个独立 subagent，这让 GCF 能从架构上绕开自我评估的确认偏误，而不是指望「同一个模型这次能客观一点」。

</div>

---

## 12.2 完整脚本

下面是这次真实运行（12.3 节）用的脚本，完整可跑。它就是一个最精简的三阶段 GCF：

```javascript
export const meta = {
  name: 'gcf-slugify',
  description: 'Generate-Critique-Fix loop producing a robust slugify (CJK + ASCII)',
  phases: [
    { title: 'Generate', detail: 'First draft' },
    { title: 'Critique', detail: 'Independent adversarial critique' },
    { title: 'Fix', detail: 'Rewrite addressing the critique' },
  ],
}

phase('Generate')
const gen = await agent(
  'Write a JavaScript function `slugify(text)` that converts a heading into a URL anchor id. ' +
  'Requirements: keep CJK characters; spaces->hyphens; strip punctuation; collapse consecutive ' +
  'hyphens; lowercase ASCII; no leading/trailing hyphen. Return only the function code.',
  { label: 'generate', schema: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] } }
)

phase('Critique')
const crit = await agent(
  `You are an adversarial code reviewer. Critique this slugify for correctness bugs and edge cases ` +
  `(empty string, all-punctuation, mixed CJK/ASCII, leading numbers, collisions, unicode). ` +
  `Be specific. Code:\n${gen.code}`,
  { label: 'critique', schema: { type: 'object', properties: { issues: { type: 'array', items: { type: 'string' } } }, required: ['issues'] } }
)

phase('Fix')
const fixed = await agent(
  `Rewrite slugify to fix every one of these issues: ${JSON.stringify(crit.issues)}. ` +
  `Original:\n${gen.code}\nReturn the final code and a one-line changelog.`,
  { label: 'fix', schema: { type: 'object', properties: { code: { type: 'string' }, changelog: { type: 'string' } }, required: ['code', 'changelog'] } }
)

log(`GCF: critique raised ${crit.issues.length} issues; fix applied`)
return { issuesFound: crit.issues, finalCode: fixed.code, changelog: fixed.changelog }
```

逐段拆开看这个脚本里**每个设计选择**的用意：

**`meta.phases` 三阶段。** 三个 `phase()` 对应进度树上的三个分组（第 05 章）。GCF 的阶段名天然就是 `Generate`/`Critique`/`Fix`，你在 `/workflows` 实时进度里一眼就能看出「现在跑到哪一步」。

**Generate 用最小 schema。** 第一版只要 `{ code }`——不用结构化太多，因为它的产物马上就要交给 Critique 去拆。schema 在这里的活儿是**保证有 `code` 字段、而且是 string 类型**；至于内容是不是**纯代码**（而不是「这是一个 slugify 函数，它……」这种夹叙夹议的散文），schema 就管不着了，还得靠 prompt 约束 + 后续验证来兜（schema 的强制作用见第 07 章）。

**Critique 用 `issues: array`，不用自由文本。** 这是 GCF 的命脉。Critique 要是返回一段散文，Fix 阶段就只能「凭感觉」去改；而 `issues` 是一个**字符串数组**，每条都是一个独立、能逐条对账的缺陷。schema 逼着 Critique 把「批评」拆成一条条离散、可枚举的条目——这直接决定了 Fix 能不能「逐条修」。

**Critique 的 prompt 直接把「该往哪些方向挑刺」列了出来。** `(empty string, all-punctuation, mixed CJK/ASCII, leading numbers, collisions, unicode)` 这一串不是凑字数——它是递给对抗者的「攻击清单」，引导它系统性地把边界情形都覆盖到，而不是只挑一两个显眼的。这呼应第 17 章「对抗者 prompt 要赋予角色 + 引导举证」。

**Fix 把整个 `crit.issues` 原样传回去，再要一份 changelog。** `Rewrite slugify to fix every one of these issues: ${JSON.stringify(crit.issues)}` 把全部缺陷一次性喂给 Fix，并且要求「fix every one」——这样修复才**有的放矢**。再额外要一行 `changelog`，是为了让修复**可审计**：你能一眼看出它声称改了什么（呼应第 17 章「举证义务」）。

<div class="callout tip">

**为什么 Fix 要同时拿到「原始代码」和「issues 列表」，而不只给 issues？** 因为 Fix 干的是「在原版基础上修」，不是「从零重写」。把 `gen.code` 一起传进去，Fix 才能留住第一版里**对的部分**，只动有问题的地方——这既省 token，也免得「修好了 A，却把本来对的 B 改坏」这种回归。

</div>

---

## 12.3 真实运行结果：一个 30 行函数被揪出 10 个缺陷

> **真实运行**：Run ID `wf_7472ceac-daa`，Task ID `wchxy8dbm`。原始记录见 `assets/transcripts/gcf-slugify.md`。
> 真实用量：`agent_count=3` ｜ `tool_uses=10` ｜ `total_tokens=96468` ｜ `duration_ms=180724`（约 3 分钟）。

这是一次 **dogfooding**——产物正好拿来改本书前端 `index.html` 的 heading-ID 生成。Generate 阶段写出了一个约三十行、「看起来很正经」的 `slugify`：空格、标点、连字符折叠、大小写它都处理了，注释里还煞有介事地标了「保留 CJK 范围」。要是让它自己检查，它大概率会说「没问题」。

但 Critique 阶段——一个被明确要求「adversarial」的独立 agent——从里头揪出了 **10 个真实缺陷**，按严重度排：

| 严重度 | 缺陷（真实，节选） |
|---|---|
| CRITICAL | 正则缺 `/u` flag，按 UTF-16 **code unit** 而非 code point 匹配；`豈-﫿` 实际是 U+8C48..U+FAFF，**覆盖了代理对区 0xD800–0xDFFF** → emoji/astral 字符全泄漏。实测 `slugify('I love 🍕 pizza') -> 'i-love-🍕-pizza'` |
| CRITICAL | CJK 范围写错/不全：注释声称全角范围 `＀-￯` 实则只含半角片假名 `ｦ-ﾟ` → `slugify('ＨＥＬＬＯ') -> ''`、`slugify('２０２４') -> ''` |
| HIGH | 未 NFKD 规范化 → 预组合 `café` 与分解 `café` 产生**不同** slug；`Straße -> strae`（丢 ß） |
| HIGH | 非 CJK/非拉丁脚本全被清空 → `slugify('Привет мир') -> ''`、阿拉伯语 → `''` |
| HIGH | 碰撞：`C++`/`C`/`C#` 全部 → `c-programming`（不同输入撞同一 slug） |
| MEDIUM×3 | 非字符串输入泄漏（`undefined -> 'undefined'`、`{} -> 'object-object'`、`[1,2,3] -> '123'`）；下划线不与连字符归一（`'foo _ bar' -> 'foo-_-bar'`）；零宽字符（U+200B/200D/FEFF）静默融合单词（`'a​b' -> 'ab'`） |
| LOW×2 | `toLowerCase()` 区域不敏感（土耳其 İ）；未处理「数字开头」（用作 HTML id 非法） |

修复版照着这份清单**系统性**重写：改用 **`/u` flag** + `\p{Script=Han}` 这类 Unicode 脚本转义（一举解决 code unit/code point 和范围写错两个 CRITICAL）+ **NFKC**（把全角折叠成 ASCII）+ **NFKD + 剥掉 `\p{M}` 组合记号**（统一重音形态）+ 零宽/下划线统一折叠成 `-` + 非字符串输入返回 `fallback` + 可选的 `transliterateSymbols`（`C++` → `c-plus-plus`，解决碰撞）。

<div class="callout tip">

**这正是 GCF 的价值，也是它和「自我检查」的分水岭。** 这 10 个缺陷里，没有一个是「语法错误」那种一眼能看穿的低级毛病——它们全是**得主动构造边界输入才会暴露**的隐蔽缺陷（emoji、全角、组合字符、跨脚本、碰撞）。一个替自己产物辩护的 agent 不会去构造这些反例；可一个**被要求挑刺、prompt 里又揣着攻击清单**的独立 agent，会系统性地把它们逼出来。本书前端 `index.html` 的 heading-ID 生成，吸取的正是这次运行的「去重 + `/u` + 空值兜底」教训。

</div>

### 从用量数字读懂 GCF 的成本结构

`agent_count=3` 正好对上脚本的三阶段——Generate / Critique / Fix 各一个 agent，没有并发。这也印证了第 08 章「token ≈ agent 数 × 每 agent 上下文」的经验法则：`96468 / 3 ≈ 32K/agent`，和本书其它单 agent 运行（hello `wf_dacbd480-d5d` 是 26,338）同一量级；Critique 和 Fix 略高，是因为它们要把「上一阶段的全文」带进上下文。

`duration_ms=180724`（约 3 分钟）又点出 GCF 的另一个特性：**三阶段严格串行，墙钟就是三段之和**。这和并发模式（第 08 章 parallel 把 N 个压到「最慢的那一个」）完全是两回事——GCF 谈不上并发，因为每一步都必须等上一步的产物。这是「拿质量换时间」的明确取舍：你花 3 倍于单次生成的时间，换来一份经过对抗审查、逐条修复的产物。

---

## 12.4 编排：单目标用 await，多目标用 pipeline

GCF 的三阶段有两种编排法，看你是要 GCF **一个**目标还是**多个**。

### 单目标：直接 await 串联

像 12.2 那样，三个 `agent()` 拿 `await` 顺着串起来就行。控制流就是普通 JavaScript——`gen` → `crit` → `fixed`，每一步都攥着上一步的结果。这是单个 slugify 这种「就一个目标」场景里最自然的写法，也是真实运行 `wf_7472ceac-daa` 用的形态。

### 多目标：pipeline 让每条 GCF 链独立流动

如果你要同时对**多个**目标开工（比如一次给五个工具函数都跑 GCF），就把它们塞进 `pipeline(targets, gen, crit, fix)`——每个目标各自流过三阶段，**阶段间无屏障**（第 08 章）。

```javascript
// （示意，未实跑）—— 对多个目标并行跑 GCF
export const meta = {
  name: 'gcf-batch',
  description: 'Run Generate-Critique-Fix on multiple targets in parallel via pipeline',
  phases: [
    { title: 'Generate', detail: 'First draft per target' },
    { title: 'Critique', detail: 'Independent adversarial critique' },
    { title: 'Fix', detail: 'Rewrite addressing the critique' },
  ],
}

const CODE = { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] }
const ISSUES = { type: 'object', properties: { issues: { type: 'array', items: { type: 'string' } } }, required: ['issues'] }
const FIXED = {
  type: 'object',
  properties: { code: { type: 'string' }, changelog: { type: 'string' } },
  required: ['code', 'changelog'],
}

const targets = args.targets // 例如 ['slugify', 'debounce', 'parseQuery', ...]

const results = await pipeline(
  targets,
  // 阶段一 Generate：每个目标产第一版
  (spec) =>
    agent(`Write a JavaScript function for: ${spec}. Return only the function code.`,
      { label: `gen:${spec}`, phase: 'Generate', schema: CODE }),
  // 阶段二 Critique：独立对抗式挑刺
  (gen, spec) =>
    agent(
      `You are an adversarial code reviewer. Critique this implementation of "${spec}" for ` +
      `correctness bugs and edge cases. Be specific.\nCode:\n${gen.code}`,
      { label: `crit:${spec}`, phase: 'Critique', schema: ISSUES }
    ).then((crit) => ({ spec, code: gen.code, issues: crit.issues })),
  // 阶段三 Fix：逐条修复
  (prev) =>
    agent(
      `Rewrite to fix every one of these issues: ${JSON.stringify(prev.issues)}. ` +
      `Original:\n${prev.code}\nReturn final code and a one-line changelog.`,
      { label: `fix:${prev.spec}`, phase: 'Fix', schema: FIXED }
    ).then((fixed) => ({ spec: prev.spec, issuesFound: prev.issues, ...fixed }))
)

return results.filter(Boolean)
```

这里有几处工程细节，呼应了基础篇的硬约束：

- **每个 `agent()` 显式传 `phase`。** 在 pipeline 内部别写 `phase('Generate')` 这种全局调用，而是给每个 `agent()` 传 `phase: 'Generate'`——否则多个目标的 agent 会**抢同一个全局 `phase()`**，进度树就乱了（`_grounding.md` 明确建议）。
- **用 `.then()` 把上一阶段的产物「带下去」。** pipeline 的每个 stage 回调拿到的是 `(prevResult, originalItem, index)`，可我们常常得把「原始 spec + 上一阶段代码 + 本阶段产物」一起递给下一阶段。用 `.then()` 攒一个合并对象，是 pipeline 链里传递富上下文的标准手法（第 08 章、第 17 章都这么干）。
- **`.filter(Boolean)` 不可省。** 某个目标在任一阶段抛错（或被用户跳过），这个 item 就会变成 `null`；收口前必须先把它滤掉（`_grounding.md`）。

<div class="callout warn">

**pipeline 的墙钟 ≈ 最慢的那条 GCF 链，而不是「所有 Generate 之和 + 所有 Critique 之和 + 所有 Fix 之和」。** 这正是 pipeline「阶段间无屏障」带来的关键优势（第 08 章）：目标 A 还在 Fix 的时候，目标 B 可能已经跑到 Critique 了。但要留意并发上限是 `min(16, CPU 核心数 − 2)`（官方），超出的 agent 会**排队**——目标数远超核心数时，排队会把墙钟拖长。

</div>

---

## 12.5 何时停止迭代：收敛、预算、轮次的三重判据

12.2 的脚本只跑了**一轮** Critique→Fix。可 Fix 之后的产物，真就「干净」了吗？也许 Fix 在修 10 个老问题时，又埋下了 1 个新问题；也许有些缺陷第一轮压根没被 Critique 逮到。于是自然就冒出一个念头：**把 Critique→Fix 放进循环，反复迭代，直到「再也挑不出问题」为止。**

这就引出 GCF 最吃工程纪律的部分——**什么时候停**。一个只靠「Critique 说没问题了」就退出的循环很危险：Critique 是概率性的，它可能总能「编」出一个看似存在的问题，让循环永不停止；而每跑一轮，都在实打实地烧 token 和墙钟。**停止判据必须多重设防**，这和第 18 章「循环到干」的刹车纪律同源：

```mermaid
stateDiagram-v2
    [*] --> Generate
    Generate --> Critique: 第一版
    Critique --> CheckStop: issues 列表
    CheckStop --> Fix: issues 非空<br/>且未触顶/未超预算
    Fix --> Critique: 重新挑刺（带上修复版）
    CheckStop --> Converged: issues 为空（收敛）
    CheckStop --> Capped: round 达上限
    CheckStop --> Budget: 预算告急
    Converged --> [*]: 正常收口
    Capped --> [*]: 触顶兜底
    Budget --> [*]: 预算兜底
```

三条停止判据各管一摊：

**判据一 · 收敛（converged）——最理想的退出。** 当某一轮 Critique 返回 `issues.length === 0`，说明对抗者再也挑不出新问题，产物收敛了。这是最干净的退出。但**绝不能只靠它**——因为它可能永远不来。

**判据二 · 轮次上限（round cap）——最可靠的刹车。** `while (round < MAX_ROUNDS)`，不管 Critique 怎么说，到顶就停。这是最简单、最可靠的安全带。经验上，**3 轮**就够覆盖绝大多数情况：第一轮揪出主要缺陷（像本例的 10 个），第二轮逮住 Fix 引入的回归或漏网之鱼，第三轮通常就收敛了。

**判据三 · 预算兜底（budget guard）——最后一道防线。** 据 `_grounding.md`，`budget` 是**硬上限**——`spent()` 一旦摸到 `total`，再调 `agent()` 就会抛错。更主动的做法是每轮开头先查一下 `budget.remaining()`，不够跑完整一轮就提前收口（第 21 章）。

下面是把单轮 GCF 升级成「多轮 GCF」的可运行骨架，三条判据全部就位：

```javascript
// （示意，未实跑）—— 多轮 GCF：收敛 / 轮次 / 预算 三重停止判据
export const meta = {
  name: 'gcf-iterative',
  description: 'Iterative Generate-Critique-Fix that loops until critique converges or caps',
  phases: [
    { title: 'Generate', detail: 'First draft' },
    { title: 'Refine', detail: 'Critique→Fix until clean or capped' },
  ],
}

const MAX_ROUNDS = 3                       // 判据二：轮次硬上限
const ROUND_COST = 60_000                  // 单轮（critique+fix 两个 agent）的粗略 token 估算

phase('Generate')
let current = (await agent(
  `Write a JavaScript function for: ${args.spec}. Return only the function code.`,
  { label: 'generate', schema: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] } }
)).code

phase('Refine')
let round = 0
const history = []                         // 记录每轮的 issues 数，用于审计收敛轨迹

while (round < MAX_ROUNDS) {
  // 判据三：预算不足以再跑一轮，提前收口
  if (budget.total !== null && budget.remaining() < ROUND_COST) {
    log(`预算告急（剩余 ${budget.remaining()}），在第 ${round} 轮后收口`)
    break
  }
  round++

  // Critique：独立对抗式挑刺（带上当前版本）
  const crit = await agent(
    `You are an adversarial code reviewer. Critique this implementation of "${args.spec}" ` +
    `for correctness bugs and edge cases. Be specific. List only genuine issues.\nCode:\n${current}`,
    {
      label: `critique:r${round}`, phase: 'Refine',
      schema: { type: 'object', properties: { issues: { type: 'array', items: { type: 'string' } } }, required: ['issues'] },
    }
  )
  history.push(crit.issues.length)

  // 判据一：收敛——挑不出问题就退出
  if (crit.issues.length === 0) {
    log(`第 ${round} 轮收敛：critique 无新问题`)
    break
  }

  // Fix：逐条修复（带上当前版本 + issues）
  const fixed = await agent(
    `Rewrite to fix every one of these issues: ${JSON.stringify(crit.issues)}. ` +
    `Original:\n${current}\nReturn the final code only.`,
    {
      label: `fix:r${round}`, phase: 'Refine',
      schema: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] },
    }
  )
  current = fixed.code   // 下一轮在修复版上继续挑刺
}

log(`GCF 迭代结束：${round} 轮，每轮 issues 数 = [${history.join(', ')}]`)
return { rounds: round, issuesPerRound: history, finalCode: current }
```

<div class="callout warn">

**永远不要写一个只靠 Critique 判决退出的无界循环。** `while (crit.issues.length > 0)` 不带轮次上限，是 GCF 最危险的反模式——Critique 几乎总能「再挑出一条」，循环可能永不收敛，把预算烧光。`_grounding.md` 给的全局兜底（单工作流 `agent()` 总数上限 **1000**）是最后的安全网，但你**绝不该**靠它来终止业务循环。正确的纪律是：**轮次上限是主刹车、收敛是理想退出、budget 是最后防线——三者缺一不可。**

</div>

<div class="callout tip">

**收益递减本身也是个有用的退出信号。** 如果你记了 `issuesPerRound`（就是上面的 `history`），会发现它通常衰减得很快：`[10, 2, 0]` 就是典型轨迹。要是出现 `[10, 8, 9]` 这种**不衰减**的情况，往往说明 Critique 在「换着花样挑同一类问题」，或者 Fix 根本没真改——这时候与其继续烧轮次，不如停下来让人介入。把「连续两轮 issues 数不降」也设成一个退出条件，就能避开无效迭代（呼应第 18 章「收益递减检测」）。

</div>

---

## 12.6 设计要点

把前面的细节拧成五条能搬走就用的纪律：

**① Critique 必须独立且对抗。** 在 prompt 里把话说死「You are an adversarial code reviewer」「Be specific」，再给一份**攻击清单**（该往哪些边界方向挑刺）。它必须是一次**全新的 `agent()` 调用**——独立上下文，背不上「我刚写了这段代码」那层包袱。这是 GCF 和「自我检查」拉开差距的根本（与第 17 章同源）。

**② 批评必须结构化成能逐条对账的列表。** 用 `schema` 把批评钉成 `issues: array`，别用自由文本。结构化是「逐条修复」能落地的前提——散文式的批评，只能换来散文式的重写。

**③ Fix 要「逐条」对账，还得带上原版。** Fix 的 prompt 把 `crit.issues` 整个传进去，要求「fix every one of these issues」；同时把原始代码也递进去，让 Fix 在原版上改、而不是从零重写（保住对的部分、躲开回归）。再要一行 changelog，让修复可审计。

**④ 顺序依赖用 pipeline 或直接 await。** 单目标直接 `await` 串起来；多目标用 `pipeline(targets, gen, crit, fix)`，每条链各走各的、阶段间无屏障。pipeline 内部务必给每个 `agent()` 显式传 `phase`，免得抢全局进度组。

**⑤ 多轮迭代必须有界。** 收敛（issues 为空）是理想退出，但真正的主刹车是轮次上限（经验 3 轮），budget 是最后防线。绝不写只靠 Critique 判决退出的无界循环。

---

## 12.7 与对抗验证、评委面板的区别与组合

GCF、对抗验证（第 17 章）、评委面板（第 14 章）共享同一条母题——**生成与评估分离**——初学者特别容易搞混。它们的本质区别，在于**「评估完之后干什么」**：

| 配方 | 评估者职责 | 评估的产物 | 评估**之后**做什么 | 典型 Run |
|---|---|---|---|---|
| **对抗验证**（第 17 章） | 证伪一个论断 | `verdict`（confirmed/refuted/uncertain） | **筛选**：保留 confirmed、丢弃 refuted | `wf_bf086b98-6ec` |
| **评委面板**（第 14 章） | 在 N 个候选间评分 | 每个候选的分数 + 投票 | **选优**：计票选出胜者 | `wf_f5b69668-b18`（3:0） |
| **GCF**（本章） | 找出一个产物的全部缺陷 | `issues` 列表 | **修复**：据 issues 重写产物 | `wf_7472ceac-daa`（10 缺陷） |

一句话记牢：**对抗验证「判真伪」、评委面板「选优」、GCF「据评修复」。** 对抗验证的输出是一个布尔/枚举判决，评委面板的输出是「哪个候选赢了」，而 GCF 的输出是**一份改好的产物**——只有 GCF 会真的「动手改」。

```mermaid
flowchart TB
  subgraph V["对抗验证（17 章）"]
    v1["论断"] --> v2["独立证伪"] --> v3["judge: 真/假"] --> v4["筛选保留"]
  end
  subgraph J["评委面板（14 章）"]
    j1["N 个候选"] --> j2["多评委评分"] --> j3["计票"] --> j4["选出胜者"]
  end
  subgraph G["GCF（12 章）"]
    g1["第一版"] --> g2["独立挑刺"] --> g3["issues 列表"] --> g4["据 issues 重写"]
  end
```

它们并不互斥——**真正的生产级质量门，往往把三者组合**起来。下面是几种高价值的组合：

<div class="callout info">

**组合 A · GCF + 评委把关（呼应 superpowers「两段式评审」）**：Fix 之后再加一个**独立**的验证 agent，拿「原始 issues」和「修复版」逐条对照，确认每个 issue 都真被修了（而不是 Fix 嘴上说改了、实际没动）。这一步本质上就是对抗验证（第 17 章）——把「Fix 声称修好了」当成一个待证伪的论断。`_grounding.md` D 节记录的 superpowers 系统，精华正是这套「生成→修复→独立验证修复是否到位」的两段式评审闭环。

**组合 B · 评委面板选优 → 对胜者跑 GCF（N 选优后再精修）**：Generate 阶段用 `parallel` 产出 N 个候选（不同视角/不同采样），先用**评委面板**（第 14 章）挑出最好的那个，再只对这个胜者跑 Critique→Fix。这样既吃到了「多候选」的多样性，又把昂贵的 GCF 集中砸在最有希望的那一个上。这正是第 14 章「变体 D」的落点。

**组合 C · 多轮 GCF + 收敛式完整性核对（呼应第 18 章）**：把 12.5 的多轮 GCF 当「找对 + 修对」，最后再用第 18 章的「收敛式完整性核对」逐条核对一份已知需求清单（spec），确认所有需求都满足了。GCF 保证「写得对」、完整性核对保证「需求全」——两条正交的质量轴。

</div>

<div class="callout tip">

**为什么「验证 Fix 是否到位」非得用独立 agent，而不能让 Fix 自己说了算？** 因为这又掉回了自我评估的陷阱——Fix 刚改完，难免倾向于说「都修好了」。组合 A 的验证 agent 必须是**独立**的一次 `agent()` 调用，只接收「原始 issues + 修复后代码」，自己重新判断每条是不是真解决了。这和第 17 章「对抗者只接收结论+原始证据、不接收原作者推理」的纪律完全一致。

</div>

---

## 12.8 变体速查

<div class="callout info">

**变体 A · 多轮 GCF（循环到收敛）**：见 12.5——把 Critique→Fix 放进 `while` 循环，收敛/轮次/预算三重停止。

**变体 B · 评委把关 Fix**：见组合 A——Fix 之后加一个独立验证 agent，逐条确认修复到位。

**变体 C · N 选优后 GCF**：见组合 B——Generate 用 `parallel` 产 N 个候选，评委面板选优，再对胜者跑 GCF。

**变体 D · 分层 Critique**：Critique 阶段用 `parallel` 派出多个不同视角的批评者（一个查正确性、一个查性能、一个查安全），把它们的 issues 合并后再统一 Fix——等于把「一个批评者」升格成「批评面板」，覆盖更全（代价是 token 随批评者数量线性涨）。

**变体 E · 带验证的修复闭环**：Generate → Critique → Fix → **Verify**（独立验证修复）→ 还有没修干净的就回到 Fix——这是组合 A 和多轮 GCF 的融合，适合「修对了才能交付」的高代价场景。

</div>

---

## 12.9 本章小结

- **GCF = Generate → 独立对抗式 Critique → 逐条 Fix**，三阶段顺序流水线。核心就是**把批评交给一个被要求「挑刺」的独立 agent**，绕开自我评估的确认偏误。
- 真实运行（`wf_7472ceac-daa`，3 agent / 96,468 token / 180,724ms）：一个看着挺正经的 30 行 `slugify` 被揪出 **10 个真实缺陷**（含 2 个 CRITICAL），修复版靠 `/u` + Unicode 脚本 + NFKC/NFKD + 非字符串兜底系统性解决。这些缺陷全是得主动构造边界输入才会暴露的隐蔽问题——自我检查根本发现不了。
- 关键纪律：Critique 必须**独立 + 被要求挑刺 + 给攻击清单**；批评必须**结构化成可逐条对账的 issues 列表**；Fix 必须**逐条对账 + 带上原版 + 给 changelog**。
- 编排：单目标用 `await` 串联，多目标用 `pipeline` 让每条 GCF 链各走各的（务必显式传 `phase`、收口前先 `.filter(Boolean)`）。
- 停止判据三重设防：**收敛**（issues 为空，理想退出）、**轮次上限**（经验 3 轮，主刹车）、**budget**（最后防线）；绝不写只靠 Critique 退出的无界循环。
- 和邻章的边界：**对抗验证判真伪、评委面板选优、GCF 据评修复**——只有 GCF 会「动手改」。三者能组合成生产级质量门（GCF + 评委把关、N 选优后 GCF、GCF + 完整性核对）。

下一章进入「深度研究」配方：多源并发检索 + 交叉验证，把一个开放问题查深、查透。

> 继续阅读：[第 13 章 · 深度研究](#/zh/p3-13)
