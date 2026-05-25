# R5 · codex 跨模型对抗审查存证（Phase 3 文档事实）

> 证据级别：第二路跨模型审查（codex 默认模型，read-only 沙箱）。本文件留存 codex 的逐条 finding 原文 + 主控（Claude）的研判与落实记录，供复核与溯源。

## 运行元信息

- 审查器：`codex exec -s read-only --skip-git-repo-check`（codex-plugin-cc / openai-codex），**默认模型**，read-only 沙箱。
- 范围：R5 在 Phase 3 深化/新增的章节（p3-10/12/13/15/16、p6-27/28/29）的事实性、三级信源标签、代码片段、MCP 表述、zh/en 一致性。
- 用量：`tokens used 214,286`。
- 结论：`VERDICT: NOT SAFE — 10 criticals`（实为 5 个 CRITICAL 主张 + 2 个 WARNING，各含 zh/en 一对 = 14 条目）。
- 重要：**没有任何一条指控 Run ID 造假**——本轮审查针对的是「把推测/夸大当官方」与示例代码健壮性，不涉及 R4 那种「误删真实 Run ID」的风险。

## 逐条 finding（codex 原文）与主控研判

### CRITICAL ① — p3-15 bug-hunter：把 bughunt/bughunt-lite 内部架构当「官方」
> `bughunt` / `bughunt-lite` 的 3 rapid、2 deep、5-vote、pigeonhole、dry-streak 被写成"官方架构描述"，但 `_grounding.md` 只实测到具名工作流列表，未提供这些描述文本或官方出处。

**研判：属实，必须改。** `_grounding.md` 只支持「存在这些具名工作流」，其内部架构无官方出处。落实：把内部架构降级为「本书据名称与通用模式的推测/示例」，删除「官方」断言。zh/en 同步。

### CRITICAL ② — p3-15 bug-hunter：早退「省 token」与 15.6 自相矛盾
> "立刻停掉剩余证伪者、不再烧 token"断言了未证实的 in-flight agent 取消/省 token 行为，且与同章 15.6 后文"已在途 agent 仍会跑完"冲突。

**研判：属实，必须改。** 落实：改为「逻辑上提前判决；已发出的 agent 通常仍会跑完，物理省钱须分批投票」，与 15.6 对齐。zh/en 同步。

### CRITICAL ③ — p3-10 分片审查：「约 10 个 agent 在跑」⚠ codex 判定不准确
> 并发上限先写对公式 `min(16, 核心−2)`，随后又硬写"约 10 个 agent 在跑"；这不是 grounding 事实，且 16 核时公式给 14 — 去掉"约 10"。

**研判：部分正确，已纠偏。** 官方 Workflow 工具描述**原文确有** "only ~10 run at any moment"——所以「约 10」**不是虚构**，codex 这条判定不完全准确（R4 教训的同类：审查器误判真实事实为造假）。真正问题是「公式(16核→14) 紧挨着写约10」的**表观矛盾**。落实：以公式为权威上限 + 超出排队；「约 10」要么删除、要么标注为「官方另给的近似口径，非由公式精确推出」。**不污蔑该数字造假。** zh/en 同步。

### CRITICAL ④ — p3-12 GCF：schema「保证纯代码字符串」夸大语义
> 写成 schema "保证拿到纯代码字符串"，但 Workflow schema（StructuredOutput，经 AJV 校验）只保证字段存在和类型正确。

**研判：属实，必须改。** 落实：改为「schema 保证有 `code` 字段且为 string；是否纯代码仍靠 prompt + 验证」。zh/en 同步。

### CRITICAL ⑤ — p3-13 深度研究：schema.sources「强制每条结论挂出处」夸大语义
> `schema.sources required` 被说成"强制每条结论挂出处"，但 schema 只能要求字段存在。

**研判：属实，必须改。** 落实：改为「schema 要求返回 `sources` 字段（存在性）；逐条 claim 与来源的对应、来源可信度靠 prompt + Verify 核实」。zh/en 同步。

### WARNING ⑥ — p3-15：`verifyWithPigeonhole` 示例可能挂死
> `!v` 直接忽略；agent 返回 `null` 时可能永远凑不齐多数，`decided` 永不 resolve。

**研判：属实。** 落实：示例改为统计已完成票数，全部返回仍无多数时 resolve `uncertain`/fallback。zh/en 同步。

### WARNING ⑦ — p3-10：示例直接访问 `review.findings` 空值不安全
> 上一阶段失败/跳过时 item 可为 `null`，`review.findings` 会抛错并使该 shard 静默变 null。

**研判：属实，且与官方 API（失败 item → null）一致。** 落实：示例改用 `(review?.findings ?? [])` 并记录被跳过的 shard 数。zh/en 同步。

## 落实方式

按章派 3 个写作子代理（sonnet）并行修复，各自独占 zh+en、互不冲突；主控逐条复核「修改前→修改后」的逐字 diff 后提交。最关键的纠偏点是 ③：明确告知子代理「约 10」是官方原文，禁止当造假删除/指控。
