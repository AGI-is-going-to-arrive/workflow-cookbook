# R8 Phase 0 — 真值锚定与实测证据

> 2026-05-26。本轮（R8）开工前的地基核实，**除 §6（zenn 文章核实，经子代理 grok-search 抓取，属第三方侦察）外，§1–§5、§7 均为主窗口亲跑 Workflow 工具/本机环境的实测**，非第三方说法。结论可回溯到 ① 实测会话环境变量 ② 探针 Run ID（`wf_72e98fa5-019`、`wf_28a5d455-300`、`wf_4ffde230-535` 及其两次 resume、被拒的 guard-scan 探针）。承 [`examples-r7.md`](examples-r7.md)。

**准确定位本轮贡献**（对照 `_grounding.md` 后自我修正，避免夸大）：真正的 §5 **实测转正只有 1 条**——resume 缓存键的 `label`/`prompt` 边界（grounding line 38/56 此前明确标「未逐一验证各字段是否入键」）。其余多为**对已 grounding 事实在本会话（v2.1.150）的再确认**：budget(null/Infinity/序列化坑)、agentType+schema 组合、`model:'inherit'` 被接受（R4 line 34 已观测其能跑）、运行时内置 workflow 清单（R4 `wf_2b04881f-6a9` 已记）。另有 1 条**粒度锐化**：确定性守卫的静态扫描连字符串里的 token 都拒（R4 已记「字面量提交即拒」，本轮补「字符串内提及也被拒」）。

---

## 1. 会话环境变量（直接 `env`，与 R7 一致）

```
AI_AGENT=claude-code_2-1-150_agent
CLAUDE_CODE_WORKFLOWS=1
CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
CLAUDE_CODE_SUBAGENT_MODEL=claude-opus-4-7[1m]
ANTHROPIC_DEFAULT_HAIKU_MODEL=claude-opus-4-7[1m]
ANTHROPIC_DEFAULT_SONNET_MODEL=claude-opus-4-7[1m]
ANTHROPIC_DEFAULT_OPUS_MODEL=claude-opus-4-6[1m]
```

- `CLAUDE_CODE_WORKFLOWS=1` 再次实证（门控开关）。
- **两层模型覆盖**再确认（R7 已记）：`CLAUDE_CODE_SUBAGENT_MODEL` + 三个 `ANTHROPIC_DEFAULT_*_MODEL` 别名重映射。注意 `OPUS` 别名指向 `opus-4-6`、其余指向 `opus-4-7`——这是**本机会话配置**，非 feature 事实，文档不写死具体版本号，只讲「两层覆盖」机制。

---

## 2. 运行时探针 `wf_72e98fa5-019`（1 agent / 23,986 token / 13,335ms）

脚本体直接读 `budget`/`args`，并派 1 个 `agentType:'Explore'` 且带 `schema` 的 agent。原始返回：

```json
{
  "facts": {
    "budget_total": null,
    "budget_total_type": "object",
    "budget_remaining_String": "Infinity",
    "budget_remaining_serialized_in_object": "{\"r\":null}",
    "budget_spent_start": 68287,
    "argsValue": "undefined",
    "budget_spent_end": 69101
  },
  "agentTypeExploreWithSchema": {
    "ok": true,
    "got": {
      "subagentModelEnv": "CLAUDE_CODE_SUBAGENT_MODEL=claude-opus-4-7[1m]\nANTHROPIC_DEFAULT_HAIKU_MODEL=claude-opus-4-7[1m]\nANTHROPIC_DEFAULT_SONNET_MODEL=claude-opus-4-7[1m]\nANTHROPIC_DEFAULT_OPUS_MODEL=claude-opus-4-6[1m]",
      "observedCwd": "/Users/yangjunjie/Desktop/workflow-cookbook"
    }
  }
}
```

逐项结论：
- **budget（未给 `+Nk`）**：`total===null`（`typeof null` 即 `"object"`）；`remaining()` 字符串化是 `"Infinity"`，但**放进对象 `JSON.stringify` 后变 `null`**（`{"r":null}`）——R7 发现的**序列化陷阱本轮重新实证**。展示 remaining 必须 `String(budget.remaining())`。
- **`budget.spent()` 是真实递增的共享计数器**：探针开头 68,287 → 结尾 69,101（一个 Explore agent 约 +814）。佐证「spent() 跨主循环与所有 workflow 共享」。
- **`args` 未传 = `undefined`**。
- **`agentType:'Explore'` 与 `schema` 可组合**（实测）：Explore agent 跑了 `env`/`pwd` 两条 shell 命令，并返回**符合 schema 的结构化对象**（`subagentModelEnv`/`observedCwd` 两字段齐全、类型正确）。坐实「自定义 agentType 会被追加 StructuredOutput 指令、二者叠加生效」。

---

## 3. `inherit` + `workflow()` 探针 `wf_28a5d455-300`（1 agent / 30,353 token / 4,558ms）

```json
{
  "inheritTest": { "accepted": true, "reply": "INHERIT_OK" },
  "workflowFnTest": {
    "threw": true,
    "error": "Error: workflow('___nonexistent_child_workflow___'): no workflow with that name. Available: bughunt, bughunt-lite, deep-research, plan-hunter, review-branch"
  }
}
```

逐项结论：
- **`model:'inherit'` 被接受**（本会话再确认；R4 line 34 已观测 `model:'inherit'` 的 agent 正常运行）：`agent('...', { model: 'inherit' })` 正常运行并返回 `INHERIT_OK`，**不抛错**。**但「不抛错」不能证明 `'inherit'` 是被特殊识别的有效取值**：`CLAUDE_CODE_SUBAGENT_MODEL` 覆盖一切 per-call model，连 bogus 串都不被拒、照跑 Opus（见 grounding line 45），故「能跑」只说明它**在当前覆盖环境下不被拒**；其精确语义是否等同「省略 `model`」**无法隔离**（§5 保留）。结论只写「被接受、能跑、语义未隔离」，不写「等同省略」或「有效取值」。
- **`workflow()` 未知名 → 抛错**（错误处理实测），且错误信息**直接列出运行时的内置 workflow 注册表**：`bughunt, bughunt-lite, deep-research, plan-hunter, review-branch`。这是比任何第三方/skill 描述都硬的**运行时自证**——内置具名 workflow 恰好这 5 个。
  - **注意区分两个注册表**：`agentType` 的注册表（R7 `wf_e8cb23ff-829` 列出的是 `claude/Explore/general-purpose/...` 等 **subagent 类型**）与 `workflow()` 的注册表（本次列出的是 **具名 workflow**）是两套东西，勿混。

---

## 4. resume 缓存键实验 `wf_4ffde230-535`（决定性 · §5 转正）

设计：3 个串行 agent（A/B/C，各返回固定串）。先首跑得基线，再对**同一基线**做两次 `{ scriptPath, resumeFromRunId }` resume，每次只改一处、看 `total_tokens`。

| 运行 | 改动（相对基线） | agent 数 | total_tokens | duration_ms | 解读 |
|---|---|---|---|---|---|
| 基线首跑 | —（真跑） | 3 | **91,044** | 9,153 | 三个 agent 真实执行 |
| resume #1 | 只改 `agent-B` 的 **`label`**（`'agent-B'`→`'agent-B-RENAMED'`，prompt 一字不变） | 3（全缓存） | **0** | 3 | `label` **不入缓存键**，100% 命中 |
| resume #2 | 只改 `agent-B` 的 **`prompt`**（`BBB`→`BBB-CHANGED`，label 还原） | 3 | **60,702**（≈基线 2/3） | 5,368 | `prompt` **入键**；A（改动点之前）命中、B+C（改动点及下游）重跑 |

resume #1 返回 `{a:AAA, b:BBB, c:CCC}`、resume #2 返回 `{a:AAA, b:BBB-CHANGED, c:CCC}`。

**结论（实测转正）**：
1. **改 `label` 不让缓存失效**（0 token 全命中）→ `label` 不参与缓存键。证实了「`label`/`phase` 仅作显示、排除在键外」中的 `label` 一项。
2. **改 `prompt` 让该 agent 及其下游失效、改动点之前仍命中**（60,702 ≈ 91,044×2/3，正好对应 B+C 两个 agent）→ `prompt` 入键，且**实证了 ch22「从改动点往后失效、之前秒级命中」的机制**。
3. resume #2 是 resume #1 的**正向对照**：它证明 resume 并非「对任何改动都返回 0」，而是**内容敏感**的——这让 resume #1 的「0 token」结论站得住。
- **未测边界（仍标第三方/未核实）**：`phase`/`schema`/`model`/`isolation`/`agentType` 各自是否入键，本轮只逐一测了 `label`（不入）与 `prompt`（入），其余未单独隔离验证。

---

## 5. 确定性守卫的静态扫描粒度（guard-scan 探针被拒 · 锐化 app-b B.19）

提交一个脚本，其中 `Date.now()` **只出现在一个字符串字面量里、从不被调用**（`"...contains the text Date.now() but the call expression is never executed"`）。结果：**整个 workflow 在提交时被拒**，错误同 app-b B.19 记录：

```
Workflow scripts must be deterministic: Date.now()/Math.random()/new Date() are unavailable (breaks resume). Stamp results after the workflow returns, or pass timestamps via args.
```

**结论**：app-b B.19 已记录「字面量在提交时被静态拒绝」；本轮进一步实证这层**静态扫描是「源码字符串级」的、不区分「真调用」与「字符串里的提及」**——即便 token 包在字符串里、永不执行，也会让整个脚本启动失败。**新踩坑/corner case**：若 agent 的 prompt 字符串里要提到这三个 API（如告诉 agent「别用 `Date.now()`」），会误伤整个 workflow；绕法是拆开写（`'Date'+'.now()'`）或换措辞。可入 B2（跨平台/corner cases）+ 锐化 app-b B.19。

---

## 6. zenn `lumichy` 文章核实（子代理 grok-search 抓取 · 辩证对待）

- **真实存在**：作者 lumichy（Zenn），约 2500–3000 字含 7 图，正文提「公式ドキュメント：未掲載（2025年5月現在）」、评论补「v2.1.150 还要 `export DISABLE_GROWTHBOOK=1`」。标题原文：「MCPとSkillsに続く第3の革命：Claude Code Workflowがultraworkで Agentをコードに焼き付ける」。
- **核心论点**：把 Workflow 定位为「继 MCP、Skills 之后的第 3 次革命」，本质是「把 AI 团队协作固化成 JS 脚本」。
- **⚠ API 形态与我方实测冲突（最大风险点）**：文章用 `export default { name, description, stages:[{name, run:async(ctx)=>ctx.runAgent({prompt})}], output }` + `stages` 内 `parallel:true/agents:[]`；**与我们实测的 `export const meta` + `agent()`/`pipeline()`/`parallel()`/`phase()` 完全不同**，且全文未提 `schema`/`budget`/`+Nk`/barrier/isolation/worktree/named workflow。**结论：拒用其 API 形态**（疑为推测或旧版逆向，非当前 shipped 形态——我们 examples-r4..r8 的真跑全部是 `export const meta`+`agent()`）。
- **可入的「新角度」（均属未证实声称，须 Claude 实测后才写）**：脚本默认保存 3 天、`ultrawork` 输入后彩色渐变、`Ctrl+O` 展开脚本、`DISABLE_GROWTHBOOK=1`、Routing/振分形态。→ Phase B5 逐条实测，过了才折叠；不过的仅作「第三方声称」登记或不收。

---

## 7. 内置 workflow 源码不可读（CLI bundle）→ B1 方法论

`~/.claude` 下无内置 workflow 的 `.js`；CLI 安装在 `…/@anthropic-ai/claude-code/`（bundle），grep 其签名串（`self-respawning`/`pigeonhole`/`MVP-first`）0 命中。**故 B1「解剖内置 workflow」不能逐行读源码**，改用三重有据来源：① 运行时确证的 5 个名（见 §3）② 官方 skill 描述里的架构摘要（如 bughunt = 自繁殖 finder 池 + 5 票对抗验证 + pigeonhole 早退 + 综合）③ 真实调用观察行为。明确标注「基于官方描述与行为观察，非源码」。

---

## 8. 对 R8 文档的影响（落点）

- **§5 实测转正（仅 1 条真正新结论）**：ch22 §22.4 缓存键 callout → 升级为实测表（§4，`label` 不入键 / `prompt` 入键 + 正向对照），把原「第三方声称、未核实」改为「R8 实测」；grounding line 38/56 同步更新。
- **再确认 / 锐化（非新结论，仅把信源更到本会话 v2.1.150）**：① app-a/app-d 的 `model:'inherit'` → 注「R8 再确认被接受；精确语义仍未隔离」（§3）；② app-b B.19 → 补一句「静态扫描连字符串里的 token 也被拒」（§5）；③ B1 内置清单 5 个（§3，R4 已记、本轮再证）+ 解剖方法论（§7）。
- **B5 zenn**：拒其 API 形态、待测 UX 声称清单（§6）。
- **再确认（无需改）**：budget null/Infinity/序列化、agentType+schema 组合、两层模型覆盖——本轮重证，印证全书事实层之扎实。
