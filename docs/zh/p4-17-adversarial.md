# 第 17 章 · 对抗验证

> 一句话：**让一个独立的 subagent 去「找茬」前一个 subagent 的产物——它的任务不是附和，而是尽力证伪。把这个证伪结果用 schema 收敛成一个可信的判决，你就得到了一条能自我纠错的流水线。**
>
> 这是进阶模式篇的第一章，也是后面所有「质量门」模式的老祖宗。基础篇已经教过你 `agent` / `pipeline` / `schema`；这一章把它们拼成一个工程上特别值钱的结构——**生成和验证分开**。

---

## 17.1 为什么需要对抗验证：自我评估的根本缺陷

先讲一个所有人都踩过的坑。

你让一个 subagent「找出这段代码的 bug」，它返回了三个。你顺手又问一句「你确定这些都是真 bug 吗？」——它几乎总是回答「是的，我确认这些都是真实存在的问题」。

**毛病出在这：让同一个模型来评自己的产物，它会有很强的「确认偏误」。** 这些 bug 是它刚生成的，上下文里全是「这是 bug」的论证，这时再让它自查，它的立场早就被钉死了。它只会替自己辩护，不会质疑自己。这不怪模型「不够聪明」，而是**自我评估这件事本身**结构就有问题——评的人和被评的人，共用同一份上下文、站同一个立场。

对抗验证想明白的关键一点是：**把验证者换成一个全新的、独立的 subagent，并且明确告诉它「你的活儿就是证伪」。**

- 它有**独立的上下文**：没有「这是我刚生成的」这层包袱，眼里只有一条待核验的论断。
- 它有**对抗性的立场**：prompt 明确要它当个怀疑论者，去找反例、挑漏洞，而不是附和。
- 它的判决是**结构化的**：用 schema 把「真/假/存疑」钉成枚举，而不是一段含糊的散文。

这三条叠在一起，就把「模型自我感觉良好」换成了「两个独立视角对着干」——而对着干，恰恰是逼近真相最老也最靠得住的办法。

<div class="callout info">

**说白了，这是 Workflow 把社区早就验证过的一套智慧，重写了一遍。** 据 `_grounding.md` D 节，superpowers 系统最值钱的东西之一就是「两段式评审闭环」（spec 合规 → code quality，各自循环到过），oh-my-claudecode 强调「独立 reviewer 签核」，oh-my-openagent 靠「VERIFICATION_REMINDER 注入纠偏」。这些系统都是在用提示词和 Hook **模拟**「生成与验证分离」。而原生 Workflow 让你用 `pipeline` + `schema` 直接把它写成一个**确定性的、能复用的**结构——这正是本章要教的。

</div>

---

## 17.2 从真实运行看最小对抗验证骨架

想搞懂对抗验证，最快的办法是看它**真的跑起来**长什么样。本书基础篇用过的 `pipeline-demo`（Run ID `wf_bf086b98-6ec`，`agent_count=6`）正好就是一个最小的对抗验证：**Find 阶段产出一个候选 bug，Verify 阶段对抗性地核验它是不是真 bug。**

```javascript
const items = ['off-by-one', 'null-dereference', 'race-condition']
const out = await pipeline(
  items,
  // 阶段一 Find：生成一个候选
  (kind) =>
    agent(`Give a one-line code example of a ${kind} bug.`, {
      label: `find:${kind}`, phase: 'Find',
      schema: { type: 'object', properties: { example: { type: 'string' } }, required: ['example'] },
    }),
  // 阶段二 Verify：对抗性核验
  (found, kind) =>
    agent(
      `Is this genuinely a ${kind} bug? Example: "${found.example}". Reply boolean + short reason.`,
      {
        label: `verify:${kind}`, phase: 'Verify',
        schema: {
          type: 'object',
          properties: { real: { type: 'boolean' }, reason: { type: 'string' } },
          required: ['real', 'reason'],
        },
      }
    ).then((v) => ({ kind, ...found, ...v }))
)
return out.filter(Boolean)
```

它**真跑出来的返回值**（来源：`assets/transcripts/primitives.md`，节选）：

```json
[
  {
    "kind": "off-by-one",
    "example": "for i in range(len(arr)): print(arr[i+1])  # off-by-one: ...out of bounds",
    "real": true,
    "reason": "Genuine off-by-one bug... at i=2 it accesses arr[3]=arr[len(arr)], raising IndexError..."
  },
  {
    "kind": "null-dereference",
    "example": "int *p = NULL; *p = 5;",
    "real": true,
    "reason": "...Dereferencing a NULL pointer is undefined behavior and crashes (segfault)..."
  }
]
```

这个骨架已经把对抗验证的要素全凑齐了，我们一条条拆开看：

**第一，验证者是一个全新的 agent。** Verify 阶段的 `agent()` 调用，跟 Find 阶段是**两个完全独立的 subagent**——上下文独立（token 从共享的 run 预算里扣，并非各自独立）（真实数据印证：3 项 × 2 阶段 = `agent_count=6`）。Verify 眼里看到的不是「我生成的 bug」，而是「一条待核验的论断 `found.example`」。

**第二，验证者要做判断，不是复述。** prompt 问的是「Is this genuinely a ... bug?」——一个是非题，逼它表态。

**第三，判决被 schema 收敛。** `real: boolean` 是个**门控字段**：它把「这是不是真 bug」从一段可能含糊的话，钉成一个 `true`/`false`。编排脚本拿到它就能 `filter`——这正是「生成-验证分离」能落成确定性流程的关键。

```mermaid
flowchart LR
    subgraph item["每个候选独立流过两阶段"]
        direction LR
        I["待验证主题<br/>'off-by-one'"] --> S1["Find（生成者）<br/>agent + schema"]
        S1 --> P1["候选产物<br/>{ example }"]
        P1 -->|"found.example<br/>作为'证据'交给验证者"| S2["Verify（对抗验证者）<br/>独立 agent + schema"]
        S2 --> V["判决<br/>{ real, reason }"]
        V --> M["合并记录<br/>{ kind, example, real, reason }"]
    end
```

<div class="callout tip">

**留意 `pipeline` 在这儿的妙用**：据 `_grounding.md`，pipeline 阶段之间**没有屏障**——某个候选还在 Verify，另一个可能还卡在 Find。对抗验证天生就配 pipeline，因为「生成→验证」本来就是一条两阶段的链，而你往往要拿**好几个**候选并行跑这条链。墙钟时间约等于「最慢的那条 Find→Verify 链」，而不是所有 Find 加起来再加上所有 Verify。

</div>

---

## 17.3 把判决升级：从 boolean 到三态枚举

`real: boolean` 应付最简单的场景够用，但生产级的对抗验证往往得有**三态**，因为现实里除了「是」和「否」，还有一大堆「证据不足，判不了」的情况。信息不全还硬逼验证者二选一，就是逼它瞎猜——这恰好跟对抗验证「要严谨」的初衷反着来。

用 `enum` 把判决升级成三态：

```javascript
// （示意，未实跑）—— 三态判决 schema：对抗验证的标准形态
const verdictSchema = {
  type: 'object',
  properties: {
    verdict: {
      type: 'string',
      enum: ['confirmed', 'refuted', 'uncertain'],
      description:
        'confirmed=证据充分，确属真实问题；refuted=确认是误报，给出反例或理由；' +
        'uncertain=现有证据不足以判定，需要更多信息',
    },
    confidence: {
      type: 'number',
      description: '0 到 1 的小数，表示你对该判决的把握程度',
    },
    reasoning: {
      type: 'string',
      description: '一句话给出关键理由或反例；若 refuted，必须指出为何不成立',
    },
  },
  required: ['verdict', 'confidence', 'reasoning'],
}
```

三个字段各管一摊：

| 字段 | 类型 | 作用 |
|---|---|---|
| `verdict` | enum 三态 | 核心判决，取值钉死，下游靠它做状态机分流 |
| `confidence` | number | 把握度，可以用来「给低置信度的结果做二次验证」或加权 |
| `reasoning` | string | 让判决能审计——尤其 `refuted` 时必须给反例，逼验证者真的动脑子想 |

`enum` 在这儿是命脉。回顾 `_grounding.md`：schema 在工具调用层做校验，`enum` 限定的字段一旦不在取值集合里就会触发重试。这意味着你在下游可以**绝对放心**地写：

```javascript
// （示意，未实跑）—— 据三态判决分流
const confirmed = results.filter((r) => r.verdict === 'confirmed')
const needsReview = results.filter((r) => r.verdict === 'uncertain')
// refuted 的直接丢弃，不再污染下游
```

你不用操心模型这回会不会返回 `'Confirmed'`、`'真'`、`'I think it is confirmed'`——运行时担保了它只会是那三个值里的一个。**枚举把对抗验证的输出，变成了可靠的状态机迁移。**

---

## 17.4 对抗者 prompt 的写法：如何「逼」出怀疑精神

对抗验证成不成，另一半不在 schema，在**验证者的 prompt**。schema 管的是判决结构对不对，可「验证者到底有没有在对抗」，全看你怎么给它定角色。

一个常见的翻车是 prompt 写得太客气：「请检查这个发现是否正确」——模型会礼貌地点个头。想逼出真正的对抗，prompt 得做三件事：

**其一，给它一个对抗角色。** 明确告诉它「你是个怀疑论者 / 红队 / 找茬专家」，它的成功标准是「找出这条论断站不住脚的地方」。

**其二，要它举证，别让它表态。** 别只问「对不对」，要它「如果觉得是误报，必须给出一个反例或具体理由」。举证这道义务会逼模型真的去推敲，而不是凭感觉投一票。

**其三，给它原始证据，别给它原作者的论证。** 只把「待验证的结论 + 必要的原始材料」交给它，**别**把生成者「我为什么觉得这是 bug」那套论证也喂进去——否则验证者会被原作者的思路带跑，对抗性就荡然无存了。

```javascript
// （示意，未实跑）—— 一个有对抗性的验证者 prompt
const verify = (claim, evidence) =>
  agent(
    '你是一名严格的代码审查红队成员。你的职责不是附和，而是尽力**证伪**下面这条论断。\n' +
    '只有当你无法找到任何反例、且证据确凿时，才判 confirmed。\n' +
    '若你能构造一个反例、或论断依赖未经证实的假设，判 refuted 并说明。\n' +
    '若现有证据不足以判定，判 uncertain，不要猜测。\n\n' +
    `待验证论断：${claim}\n` +
    `相关代码证据：\n${evidence}`,
    { schema: verdictSchema, label: 'adversary' }
  )
```

注意这里**没有**把生成者的推理过程传进去——`claim` 是结论，`evidence` 是原始代码，验证者必须**自己**从头判一遍。

<div class="callout warn">

**对抗不等于抬杠。** 一个常见的矫枉过正，是把验证者调得太多疑，多疑到连真 bug 都判成 refuted（假阴性）。要拿捏好平衡，关键在 `confidence` 和 `reasoning`：要求它判 refuted 时**必须给出具体反例**。要是它给不出反例、只是「感觉不太对」，那它其实该判 `uncertain`。用举证这道义务把对抗的劲儿管住，别从「确认偏误」滑到另一头的「否认偏误」。

</div>

---

## 17.5 完整骨架：生成 → 对抗验证 → 收口

把前面几节拼起来，就得到一条能上生产的对抗验证流水线。它拿一组待审查项，每一项都独立地走「生成候选发现 → 独立验证者证伪 → 按判决收口」。

```javascript
// （示意，未实跑）—— 完整对抗验证流水线
export const meta = {
  name: 'adversarial-review',
  description: '对每个目标生成发现，再由独立验证者对抗性核验，仅保留确认项',
  phases: [
    { title: 'Find', detail: '生成候选发现' },
    { title: 'Verify', detail: '独立验证者证伪' },
  ],
}

const verdictSchema = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['confirmed', 'refuted', 'uncertain'] },
    confidence: { type: 'number' },
    reasoning: { type: 'string' },
  },
  required: ['verdict', 'confidence', 'reasoning'],
}

const targets = args.targets // 由调用方传入的待审查目标列表

const reviewed = await pipeline(
  targets,
  // 阶段一：生成者
  (target) =>
    agent(
      `审查目标「${target}」，找出其中最可疑的一个问题，给出 claim（结论）与 evidence（支撑证据）。`,
      {
        label: `find:${target}`, phase: 'Find',
        schema: {
          type: 'object',
          properties: { claim: { type: 'string' }, evidence: { type: 'string' } },
          required: ['claim', 'evidence'],
        },
      }
    ),
  // 阶段二：独立对抗验证者
  (found, target) =>
    agent(
      '你是严格的红队审查者，职责是证伪以下论断。能给出反例则判 refuted；' +
      '证据确凿无法反驳才判 confirmed；证据不足判 uncertain。\n' +
      `论断：${found.claim}\n证据：${found.evidence}`,
      { label: `verify:${target}`, phase: 'Verify', schema: verdictSchema }
    ).then((v) => ({ target, ...found, ...v }))
)

// 收口：滤掉被跳过的 null，按判决分类
const valid = reviewed.filter(Boolean)
const confirmed = valid.filter((r) => r.verdict === 'confirmed')
const uncertain = valid.filter((r) => r.verdict === 'uncertain')
log(`确认 ${confirmed.length} 项，存疑 ${uncertain.length} 项，已剔除误报 ${valid.length - confirmed.length - uncertain.length} 项`)
return { confirmed, uncertain }
```

有几处工程细节值得拎出来说：

- **`.filter(Boolean)` 省不得。** 据 `_grounding.md`，用户中途跳过某个 agent，这次调用就会返回 `null`；pipeline 某个阶段抛错，也会把那个 item 变成 `null`。用之前必须先把它们滤掉。
- **`phase` 要显式标注。** 在 pipeline 里头，给每个 `agent()` 都传上 `phase: 'Find'` / `'Verify'`，省得它们去抢全局的 `phase()`，进度树也能分得清清楚楚。这是 `_grounding.md` 明确建议的做法。
- **三态收口。** `confirmed` 直接采纳，`refuted` 丢掉，`uncertain` 单独留出来——交给人复核，或者送进二次验证（见下一节）。

```mermaid
flowchart TD
    T["targets[]"] --> P{"pipeline 每项独立"}
    P --> F["Find: 生成者<br/>{ claim, evidence }"]
    F --> V["Verify: 独立验证者<br/>{ verdict, confidence, reasoning }"]
    V --> D{"verdict?"}
    D -->|confirmed| C["采纳"]
    D -->|uncertain| U["留待复核 / 二次验证"]
    D -->|refuted| X["剔除（误报）"]
    C --> R["收口：{ confirmed, uncertain }"]
    U --> R
```

---

## 17.6 进阶：多验证者投票与置信度加权

单个验证者已经远比自我评估强了，但它毕竟只是**一个**视角。等到判决的代价很高（比如要决定是不是拦下一次发布），就可以让**多个独立验证者**各投各的票，再用代码聚合——这就从「对抗」升格成了「陪审团」。

机制很简单：对同一个 claim，用 `parallel` 扇出 N 个验证者，各自独立判决，最后多数表决。

```javascript
// （示意，未实跑）—— 多验证者投票
const jurors = await parallel(
  [0, 1, 2].map((i) => () =>
    agent(
      // 用下标 i 微调视角，避免完全同质（呼应「禁用 Math.random，用 index 制造差异」）
      `你是第 ${i + 1} 位独立审查者，从${['可利用性', '影响面', '复现难度'][i]}角度证伪以下论断。\n` +
      `论断：${claim}\n证据：${evidence}`,
      { label: `juror:${i}`, schema: verdictSchema }
    )
  )
)

const votes = jurors.filter(Boolean)
const confirmedVotes = votes.filter((v) => v.verdict === 'confirmed').length
// 多数确认才算确认；置信度可取均值
const finalVerdict = confirmedVotes > votes.length / 2 ? 'confirmed' : 'refuted'
const avgConfidence = votes.reduce((s, v) => s + v.confidence, 0) / votes.length
```

<div class="callout tip">

**推荐一条可复用的默认规则：默认判 `refuted`，除非「多数」独立验证者（如 3 票里至少 2 票）投 `confirmed`。** 换句话说，一条论断**只有在多数验证者主动确认时才得以存活**；平票或「证据不足」一律默认证伪。上面那行 `confirmedVotes > votes.length / 2` 就是这条规则的代码版——3 票需 ≥2、5 票需 ≥3 才算 `confirmed`，否则收口为 `refuted`。把它当成对抗验证默认的收口姿势：**举证责任在「确认」一方，沉默与分歧都倒向证伪。** 这跟本章 17.3 节「`uncertain` 不当 `confirmed` 采纳」是一个口径——存疑不等于通过。

</div>

这里有两个细节，呼应了全书的硬约束：

**用 `index` 制造视角差异，别用随机。** 据 `_grounding.md`，脚本禁用 `Math.random()`（它会破坏可重放性 → 续传失效）。想让多个验证者别长一个样，正确做法是**拿下标 `i` 去变 prompt**——比如让第 0 位盯可利用性、第 1 位盯影响面。这样既有了多样性，又保住了确定性。

**`parallel` 是屏障，等所有票到齐再聚合。** 这正是投票场景要的——你得拿到全部选票才能计票。代价是 token 会随陪审团规模线性涨：参考真实数据，3 个并发 agent 约 `78844` token（`wf_52957913-6d2`），约为单 agent 的 3 倍。验证者越多越可靠，可也越贵——用判决的代价去定陪审团的规模。

<div class="callout tip">

**这就是第 14 章「评委面板」跟本章接得上的地方。** 评委面板把「多个独立评估者 + 投票聚合」这套模式用在 A/B 方案评估上；本章把它用在真伪判定上。两者底层是同一个结构：**独立视角 + 结构化判决 + 代码聚合**。你把对抗验证摸透了，评委面板不过是换个评估对象而已。

</div>

---

## 17.7 反模式：对抗验证用错的几种姿势

最后，列几个会让对抗验证「学了个形、丢了个神」的常见错误：

| 反模式 | 问题 | 正确做法 |
|---|---|---|
| 验证者和生成者共享上下文 | 退化成自我评估，确认偏误 | 验证者必须是独立的 `agent()` 调用，只给结论+原始证据 |
| 把生成者的推理喂给验证者 | 验证者被带跑，丢了独立性 | 只传 claim + evidence，让验证者自己重新判 |
| 验证者 prompt 太客气 | 模型礼貌点头，不真对抗 | 给它红队角色 + 举证义务（refuted 须给反例） |
| 判决用自由文本 | 没法可靠分流，又掉回解析地狱 | 用 `enum` 三态 + `required` 把判决钉死 |
| 每个小产物都跑一遍陪审团 | token 爆炸，划不来 | 单验证者作默认；只有高代价判决才上多投票 |
| 忘了 `.filter(Boolean)` | 跳过/出错的 `null` 把收口搞崩 | 用判决之前一律先滤掉 null |

<div class="callout warn">

**对抗验证不是白来的——它至少把 agent 数翻一倍。** 一条「生成 + 验证」流水线，agent 数是纯生成的 2 倍（真实印证：pipeline-demo 3 项两阶段 = 6 个 agent，`158982` token）。再叠个陪审团就是好几倍。所以对抗验证要花在**判错代价高**的地方：决定要不要合并、要不要发布、要不要上报安全漏洞。至于那些「拿来随便参考一下」的低风险产物，跑一次生成可能就够了。验证使多大劲，得跟判错的代价对上。

</div>

---

## 17.8 本章小结

- **对抗验证 = 生成与验证分离。** 派一个**独立**的 subagent 去证伪上一阶段的产物，绕开「同一个模型自我评估」的确认偏误。
- 最小骨架就是真实跑过的 `pipeline-demo`（Run `wf_bf086b98-6ec`）：Find 阶段生成候选、Verify 阶段用独立 agent 对抗核验、`real: boolean` 门控收口。
- 生产级判决用 **`enum` 三态**（`confirmed` / `refuted` / `uncertain`）+ `confidence` + `reasoning`，把判决变成可靠的状态机迁移；`refuted` 必须给反例。
- 对抗者 prompt 三要素：**给红队角色、要它举证、只给结论+原始证据**（不给原作者的推理）。
- 高代价判决可以升格成**多验证者投票**（`parallel` 屏障聚合），用**下标 `index`**（而不是 `Math.random`）制造视角差异，好保住可重放性。
- 时刻记着代价：对抗验证至少把 agent 数翻一倍（token 跟着翻倍），验证使多大劲，得跟判错的代价对上。

下一章，我们把「验证」从「判真伪」往「判完整」推一步——怎么用一个循环，让流水线**反复地生成-批评**，直到一个完整性 agent 判定「再也榨不出新东西了」为止。

> 继续阅读：[第 18 章 · 循环到干与完整性批评](#/zh/p4-18)
