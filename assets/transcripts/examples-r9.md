# R9 Phase 0 验证探针（dogfood 实测记录）

> 本文件记录 R9 第 0 阶段为「解决审计揪出的漂移点」所跑的 Workflow 真实探针。全部由主窗口直接调 Workflow 工具实测（dogfood）。真值优先级：本机实测 > 官方工具定义 > 第三方。均属**验证用**运行，不并入头条 curated 计数（curated 维持 23）。
> 复核方式：每个 run 的 journal 在会话目录 `…/workflows/wf_<runId>.json`（**0-agent 探针只有这个文件、没有 `subagents/` 子目录**；派了 agent 的运行才另有 `…/subagents/workflows/<runId>/`）。或见下方 Run ID。本机环境：Claude Code v2.1.150，`CLAUDE_CODE_WORKFLOWS=1`。

## 探针 1 — 0-agent 编排型多检（`wf_63b7a365-fdc`）

- agent_count=0 ｜ total_tokens=0 ｜ duration_ms=6
- 脚本要点：pipeline 两 item × 两 stage（纯函数 stage，不调 agent）、budget 快照、pipeline 同步 throw、parallel async throw。
- 结果：
  - pipeline **首阶段 `prevResult === originalItem` = true**（两 item 均 `s1_prevEqualsOrig:true`）；第二阶段 `prevResult` = 第一阶段返回对象、`originalItem` 仍是原 item。→ 坐实 app-a §A.6「第一阶段 prevResult === item」与 `(prevResult, originalItem, index)` 签名。
  - `budget` = `{total:null, totalIsNull:true, remaining:"Infinity"}`（无 +Nk 指令时）。
  - pipeline 某 stage 同步 throw → 该 item `null`、其余存活：`[null,"kept-Y"]`；`<failures>` 记 `pipeline[0] failed`。
  - parallel thunk async throw → 该位 `null`、调用不 reject：`["P0-ok",null,"P2-ok"]`；`<failures>` 记 `parallel[1] failed`。

## 探针 2 — parallel 同步 throw 崩库（`wf_e188356f-b10`）

- agent_count=0 ｜ total_tokens=0 ｜ duration_ms=5 ｜ **status=failed**
- 脚本要点：`parallel([() => 'P0', () => { throw ... }, () => 'P2'])`。
- 结果：workflow **failed**，错误 `Error: SYNC-THROW-IN-PARALLEL-THUNK`；**未**返回 `{didNotCrash:true}`。→ 再确认「parallel thunk 体内同步 throw 会崩掉整个 workflow」在当前 build v2.1.150 仍成立（与 R8 `wf_6cc89add-680`、正文 p2-08 §8.8 一致）。官方工具短描述「the call itself never rejects」是**简化**——它只覆盖 async reject / agent 出错路径，不覆盖「同步 throw 在被收集成 null 之前就逃逸」这一路径。

## 探针 3 — worktree agent() 返回形状（`wf_17307da4-707`）

- agent_count=1 ｜ total_tokens=31,679 ｜ duration_ms=9,239
- 脚本要点：`agent('…在当前工作目录建 R9_WORKTREE_PROBE.txt 并回报…', {isolation:'worktree'})`。
- 结果：`{returnType:"string", isString:true, keysIfObject:null, raw:"created R9_WORKTREE_PROBE.txt"}`。
  - → 脚本里 `agent({isolation:'worktree'})` 的返回值 = agent 常规输出（无 schema 即文本 `string`），**不是 `{path,branch}` 对象**。所以「返回 path/branch」是 Agent 工具定义在**工具结果信封层**的说法，不经脚本 `agent()` 返回值暴露。
  - 隔离实证（下列 path/branch/locked/清理状态来自 `git worktree list --porcelain` + `git status` 的当场观测，**不在 run JSON 里**）：主工作树零泄漏（`git status` 只剩未跟踪 `PROMOTION.md`）；worktree 落 `.claude/worktrees/wf_17307da4-707-1`、分支 `worktree-wf_17307da4-707-1`、初始 `locked`。探针后已 `git worktree remove --force` + `branch -D` + `prune` 清理干净。

## 探针 4 — 「验证运行时」最小食谱（`wf_580909ca-b32`，R9 Phase B）

- agent_count=0 ｜ total_tokens=0 ｜ tool_uses=0 ｜ duration_ms=4
- 脚本要点：最小 `check-runtime`——只有 `meta`（含 `phases:[{title:'Check'}]`）+ `phase('Check')` + `log(...)` + 顶层 `return {...}`，不调任何 `agent()`。
- 结果：返回 `{ok:true, budgetTotal:null, budgetTotalIsNull:true, remaining:"Infinity", argsIsUndefined:true}`。
  - → 坐实「0-agent 工作流真能跑、真 0 token（4ms）」「`budget.total=null`、`budget.remaining()=Infinity`（无 +Nk 指令时）」「未传 args 时 `typeof args==='undefined'`」「顶层 `return` 与 `log()` 均正常」。
  - → 作为 p1-01 §1.5「一眼确认到底能不能用」食谱的实测背书：读者跑通它即说明运行时齐活；工具若不在环境里（版本太老/没开标志）则根本发不出这一步。

## 落点（R9 Phase A 已据此改文档）

- **#1**：`app-a-api.md` 的 `isolation:'worktree'` 行（zh/en）—— 区分「信封层 path/branch」vs「脚本里 agent() 返回值」+ 实测 worktree 命名规律。
- **#3**：`p2-05` §「phase() 未声明 title」（zh/en）—— 从「(待核实)」转正为「自动获得自己的进度组」（官方工具描述）。
- **#4**：`app-a-api.md` §A.6（zh/en）—— 「第一阶段 prevResult===item」加 Run ID 背书。
- **#2**：本文件 + `_grounding.md` 记当前 build 再确认；正文 p2-08 §8.8 本就正确，不改（避免 churn）。
- **#5**：`p4-20` §20.1（zh/en）—— 补「子工作流在 `/workflows` 显示为 `▸ name` 分组」（官方工具描述）。

**Phase B 落点（探针 4）**：`p1-01` §1.5（zh/en）—— 触发门控成节强化：补「版本前提」（实测 v2.1.150；社区报告约 2.1.148+，确切起始版本未独立核实）+「0-token 验证运行时」食谱（`wf_580909ca-b32` 背书）。
