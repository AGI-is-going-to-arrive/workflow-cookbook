# R11 真实运行记录 · 在 Claude Code v2.1.156 上的真值复核

> 真值底座：**本机实测 Run ID > 官方文档（`code.claude.com/docs/en/workflows`）> 第三方资料**。
> 本文件每条结论都能用其 Run ID 在 `/workflows` 或 transcript dir 复核。
> 环境：Claude Code **v2.1.156**（`claude --version` 实测；≥ 官方要求的 v2.1.154）、node v22.22.0、主模型 Opus 4.8、`CLAUDE_CODE_WORKFLOWS` 在本会话工具箱可用。

---

## R11-P1 · 运行时不变量探针（0 agent / 0 token / 19ms）

- **Run ID**：`wf_03e38250-1bb` ｜ Task ID：`w20ng0m4z`
- **脚本**：5 段纯 JS 探测，不调用任何 `agent()`（故 0 agent、0 subagent token）。
- **原始返回**：

```json
{
  "probeOn": "v2.1.156",
  "pipelineFirstStageIdentity": { "prevIsOrig": true, "idxSeen": 0, "prevType": "object" },
  "pipelineThrowSurvivors": [null, "kept-b"],
  "budgetSnapshot": { "total": null, "remaining": null, "spent": 41065 },
  "parallelAsyncThrow": { "result": [null, "ok"], "callRejected": false },
  "registryError": "workflow('definitely-no-such-workflow-xyz-r11'): no workflow with that name. Available: deep-research"
}
```

- **`<failures>` 块**（运行时回报，但**未**导致整个 run 失败）：
  - `pipeline[0] failed: Error: drop-a`（我故意在 pipeline 阶段抛的）
  - `parallel[0] failed: Error: boom`（我故意在 parallel thunk 里 async reject 的）

### 逐条结论

1. **pipeline 首阶段 `prevResult === originalItem` = `true`**（`prevType==="object"`，就是原 item 本身）。与 R9（`wf_63b7a365-fdc`，v2.1.150）一致，v2.1.156 仍成立。
2. **pipeline 某阶段 sync throw → 该 item 落 `null`、其余存活**（`[null,"kept-b"]`），整个 run 不崩。失败在 `<failures>` 块可见。与 R9 一致。
3. **`budget.total === null`（本回合未给 `+Nk` 预算指令时）**。与工具契约 + R9 一致。
4. **parallel thunk async reject → 该位 `null`、`parallel()` 调用本身不 reject**（`callRejected:false`）。与 R9 一致。
   - ⚠️ 注意区分：**parallel thunk 同步 throw** 会让整个 workflow `status=failed`（R9 `wf_e188356f-b10` 已证）；这里测的是 **async reject**（安全路径）。
5. ⚠️ **重大漂移 — 具名工作流注册表只剩 `deep-research`**。错误信息 `Available: deep-research`。
   - 旧版 v2.1.150 实测（R9 引用 `wf_2b04881f-6a9`）为五件套：`bughunt, bughunt-lite, deep-research, plan-hunter, review-branch`。
   - **v2.1.156 上只剩 `deep-research`**，与官方文档"Claude Code includes `/deep-research` as a built-in workflow"完全吻合（官方只把 `/deep-research` 列为 bundled）。
   - **影响面**：p3-15（bug-hunter，整章以 `bughunt`/`bughunt-lite` 为自带工作流）、p4-20（嵌套，错误信息示例）、p5-24（抽取）、app-a 的"五件套"声明**全部需改**。
6. **`budget.spent()` 是会话级、跨 workflow 共享**：本 run 用 0 agent token，但 `spent=41065`——反映同回合主循环 + 并发的 smoke workflow 已花的输出 token。与工具契约"the pool is shared, not per-workflow"一致。

### 一个序列化陷阱（已知、需定死）

`budgetSnapshot.remaining` 回来是 `null`，但 **`JSON.stringify(Infinity) === "null"`**——经 notification 的 JSON 序列化，`Infinity` 和 `null` 不可区分。所以本探针**无法**判定"无预算时 `remaining()` 到底是 `Infinity` 还是 `null`"。见下方 R11-P3 序列化无关微探针定论。

---

## R11-P2 · 1-agent 端到端 smoke

- **Run ID**：`wf_614e6e6b-c6f` ｜ Task ID：`wp7lhv0o6`
- **用量**：1 agent / **29,034** subagent token / 2 tool_uses / 13,609ms
- **原始返回**：

```json
{
  "message": "Confirmed: I ran as a Claude Code workflow subagent, spawned by the orchestration script, and executed this smoke test using the available tools.",
  "sum": 4,
  "ok": true,
  "modelGuess": "claude-opus-4-8[1m] (Opus 4.8, 1M context)"
}
```

### 结论

1. **运行时端到端可用**（v2.1.156）：脚本 → 1 个 subagent → 结构化结果回到编排层，全链路通。
2. **schema 约束生效**：4 个字段全部按 schema 返回，`sum=4`、`ok=true` 类型正确。
3. **subagent 自报模型 = `claude-opus-4-8[1m]`（Opus 4.8, 1M）**：与本会话主循环模型一致，佐证"agent 不写 `model` 则继承主循环模型"，且本书测试环境的主模型应从 **Opus 4.7 刷新为 4.8**。
   - ⚠️ 严谨标注：模型自报自身 ID **不是 100% 权威**（模型可能误报）。但它与环境上下文（系统报告 Opus 4.8）+ 精确串 `claude-opus-4-8[1m]` 互相印证，可信度高；下方 R11-P4 env 实测进一步交叉验证。

---

## R11-P3 · budget.remaining() 类型定论（序列化无关）

- **Run ID**：`wf_71b563fd-37a` ｜ Task ID：`wzoqcqrp7` ｜ 0 agent / 0 token / 2ms
- **原始返回**：

```json
{ "totalIsNull": true, "remainingIsInfinity": true, "remainingIsNull": false, "remainingStr": "Infinity", "remainingTypeof": "number" }
```

- **定论**：本回合未给 `+Nk` 预算指令时，`budget.total === null` 且 **`budget.remaining() === Infinity`**（`typeof` 为 `number`，`String()` 为 `"Infinity"`）。书里"无 target 时 `remaining()` 为 `Infinity`"的说法**正确**；R11-P1 看到的 `null` 纯属 `JSON.stringify(Infinity) → "null"` 的序列化假象，非行为漂移。
- **写作启示**：凡是 workflow 返回值里可能含 `Infinity`/`NaN`/`undefined` 的，经 notification 的 JSON 序列化都会变形（`Infinity`/`NaN`→`null`、`undefined`→丢字段）。要观测这类值，必须在脚本里转成布尔或 `String()` 再返回。

---

## R11-P4 · 本会话环境变量实测（`printenv`，交叉验证 grounding）

实测命令：`printenv | grep -iE '^CLAUDE_CODE_(WORKFLOWS|EFFORT_LEVEL|SUBAGENT_MODEL|MODEL)='`

| 变量 | v2.1.156 本会话实测 | 书里旧值 | 处理 |
|---|---|---|---|
| `CLAUDE_CODE_WORKFLOWS` | `=1` | `=1` | ✅ 不变（"工具箱可用"声明成立） |
| `CLAUDE_CODE_EFFORT_LEVEL` | `=max` | `=max` | ✅ 不变（"会话锁在 max"声明成立） |
| `CLAUDE_CODE_SUBAGENT_MODEL` | `=claude-opus-4-8[1m]` | `=claude-opus-4-7[1m]` | ⚠️ 全书刷新为 4.8 |

- **意义**：`CLAUDE_CODE_SUBAGENT_MODEL=claude-opus-4-8[1m]` **解释并交叉验证**了 R11-P2 smoke 自报 Opus 4.8——subagent 模型由该变量**显式指定**，不是模型臆测。书里所有"本书实测会话主循环/subagent = Opus 4.7"统一刷新为 **Opus 4.8**。
- **保留**：书里"这是本书写作会话的事实，不是 Workflow 通用保证"的 grounding 纪律本身正确（区分"会话事实"vs"通用行为"），继续保留，只改具体型号。

---

## R11 刷新后真值底座（供全书改写引用）

| 维度 | v2.1.156 真值 | 来源 |
|---|---|---|
| Claude Code 版本 | **v2.1.156**（≥ 官方最低 v2.1.154） | `claude --version` |
| 主循环 / subagent 模型 | **Opus 4.8（`claude-opus-4-8[1m]`）** | R11-P2 + R11-P4 |
| 启用（能用） | `CLAUDE_CODE_WORKFLOWS=1` 在本会话实测在场 | R11-P4 |
| effort 锁定 | `CLAUDE_CODE_EFFORT_LEVEL=max` | R11-P4 |
| 具名工作流注册表 | **仅 `deep-research`**（与官方 bundled 一致） | R11-P1 `wf_03e38250-1bb` |
| pipeline 首阶段 | `prevResult === originalItem`（true） | R11-P1 |
| pipeline 阶段 throw | 该 item→null，其余存活，run 不崩 | R11-P1 |
| parallel async reject | 该位→null，调用不 reject | R11-P1 |
| parallel **sync** throw | 整个 run `failed`（危险路径，勿用） | R9 `wf_e188356f-b10`（v2.1.150；本轮未重测，标注版本） |
| budget（无指令） | `total===null`、`remaining()===Infinity`（number） | R11-P1 + R11-P3 |
| budget.spent() | 会话级、跨 workflow 共享 | R11-P1（spent=41065 而本 run 0 token） |
| 失败可观测性 | item 级失败进 `<failures>` 块、不崩 run | R11-P1 |
