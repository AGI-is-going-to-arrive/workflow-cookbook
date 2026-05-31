# 第 23 章 · 四大系统横评

> 原生 Workflow 出现之前，社区已经用各种方式「编排」多 Agent。这一章分析四个有代表性的开源系统（`ccg-workflow`、`superpowers`、`oh-my-claudecode`、`oh-my-openagent`）的**真实编排机制**，并提取其中能被原生 Workflow 复用的精华。
>
> 本章所有机制描述，都基于对各仓库源码的真实阅读（文件路径都标了出来），目的是「取其精华」，不是褒贬高下。

---

## 23.1 一个贯穿全章的洞察

先给出结论，再逐一展示证据：

> **这四个系统，全都诞生在原生 Workflow 之前；它们都在用「提示词 + 生命周期钩子 + 磁盘状态文件」来_模拟_一个确定性编排引擎。** 因为有很长一段时间，Claude Code（以及类似的 harness）压根没有「用代码编排 Agent」的原生能力。

它们各自设计的补丁都很有价值：用磁盘状态对抗上下文压缩，用 Hook 注入「面包屑」防止偏离，靠 `Stop` 钩子阻止过早结束，在工具层加 `throw` 护栏。而原生 Workflow 用 `pipeline`/`parallel`/`phase` 加 JSON Schema，直接提供了它们努力维系的**确定性骨架**。

所以这一章（连同第 24 章）的主线是：**原生 Workflow 给了骨架，这四个系统的精华是长在骨架之上的「韧性层」。** 两样合起来，才算可上线的编排。

<div class="callout info">

**贯穿全章的洞察（记住这一句，全章都在论证它）**：这四个系统**全部诞生在原生 Workflow 之前**，所以它们只能用「提示词 + 生命周期 Hook + 磁盘状态文件」去**模拟**一个确定性编排引擎。ccg 靠每轮注入 `<ccg-state>` 面包屑，OMC 靠 `Stop` 钩子拦截停止，OmO 靠工具层 `throw` 拦截写文件，superpowers 靠 `SessionStart` 注入「行为宪法」。这些都是在**没有原生控制流**的约束下设计出来的精巧补丁。原生 Workflow 一次性补齐了它们最缺的两项能力：`pipeline`/`parallel`/`phase` 提供的**确定性骨架**，以及 JSON Schema 提供的**工具层硬约束**。阅读后续各节时，可以对照「它用什么 Hook 或状态文件来模拟」与「原生 Workflow 用哪个原语直接提供」。

</div>

```mermaid
flowchart LR
  subgraph SIM["社区系统：模拟编排"]
    P["提示词铁律"] -.弱保证.-> FLOW["控制流"]
    H["生命周期 Hook"] -.注入.-> FLOW
    ST["磁盘状态文件"] -.续命.-> FLOW
  end
  subgraph NAT["原生 Workflow：确定性骨架"]
    JS["JS 脚本<br/>pipeline/parallel/phase"] ==强保证==> FLOW2["控制流"]
    SC["JSON Schema"] ==约束==> OUT["结构化产物"]
  end
  SIM -.精华迁移.-> NAT
```

---

## 23.2 ccg-workflow：ccg 多模型并行 + 磁盘状态续命

**它是什么**：CCG（Claude + Codex + Gemini）是装在 Claude Code 之上的多模型协作工作流引擎。一条 `/ccg:go` 自然语言入口，自动判定任务类型/复杂度/风险，从 10 种策略里挑一种，执行过程中再拉外部模型来做交叉验证。它专治三个痛点：单 agent 跑长任务会跑偏、上下文压缩后会丢进度、单模型有盲区。

**真实编排机制**（四层叠加）：

- **Slash command 当角色注入用**：`templates/commands/go.md` 把 Claude 变成「CCG Engine」，走 Phase 0–3 决策矩阵。
- **策略文件＝提示词状态机**：比如 `templates/engine/strategies/full-collaborate.md`，用 `[phase-state:N]` 标阶段、`Gate`、`HARD STOP` 检查点，一个 phase 一个 phase 地更新 `task.json`。
- **JS Hook 引擎（真实代码，零依赖）**：`templates/hooks/` 注入 `~/.claude/settings.json`。其中 `workflow-state.js` 每轮 `UserPromptSubmit` 都读 `task.json` 并注入 `<ccg-state>` 面包屑，**这是对抗上下文压缩的关键**；`task-utils.js` 里的 `detectLoop` 维护一个 10 轮的滚动缓冲，连续 3 轮卡在同一个 phase 就触发死循环告警。
- **执行层双轨**：要么用 Agent Teams（官方）做并行，要么外部模型走 `~/.claude/bin/codeagent-wrapper`（真实 Go 二进制，信号量并发 + DAG 依赖调度）。

**最值得借鉴的一点**：**磁盘状态加每轮 Hook 面包屑注入**。把工作流进度保存到磁盘的 `task.json`，每个回合用一个极小的 `<ccg-state>` 重新喂给模型，用最低的成本解决了长任务、压缩之后「agent 忘了自己在干嘛」这个根本问题。

以下两个具体形态，使上述抽象描述更加清晰。

其一，**「10 种策略」是一张能逐条数出来的表**。`templates/commands/go.md` 的附录正好列了 10 条，每一条对应 `templates/engine/strategies/` 下一个真实的策略文件，`/ccg:go` 在 Phase 0 按任务类型、复杂度、风险从里头挑一个：

```text
direct-fix · quick-implement · guided-develop · full-collaborate · debug-investigate
refactor-safely · deep-research · optimize-measure · review-audit · git-action
```

其二，**多模型路由由配置说了算**。到底哪份配置生效，以 `src/utils/config.ts` 的默认值为准（注意：`model-router.md` 文档示例写的是 gemini，但运行时以 config.ts 为准）：

```javascript
// ccg-workflow · src/utils/config.ts 默认值（信源：_grounding.md D2）
const defaults = {
  frontend: { primary: 'antigravity' },          // 前端任务 → antigravity
  backend:  { primary: 'codex' },                // 后端任务 → codex
  review:   { models: ['codex', 'antigravity'] },// 审查 → 两模型并行交叉验证
}
```

外部模型通过 `~/.claude/bin/codeagent-wrapper`（真实 Go 二进制）落地。其 `executor.go` 用 `topologicalSort`（带 cycle 检测的分层拓扑排序）解析任务 DAG，再用 `executeConcurrentWithContext` 中的 `sem := make(chan struct{}, workerLimit)` 信号量控制并发。这是「确定性调度」的一种朴素实现，也正是原生 Workflow 用 `pipeline`/`parallel` 一行代码就提供的能力。

> 补充说明：本书的多模型审查（codex 审内容、antigravity 审前端），正是通过 CCG 的 `codeagent-wrapper` 加 `/ccg:frontend`、`/ccg:review` 路由执行的。配置为 `review.models=['codex','antigravity']`，两个模型并行交叉验证。

---

## 23.3 superpowers：方法论即插件 + 两段式评审

**它是什么**（obra/superpowers）：一套面向编码 agent 的**完整软件开发方法论**，由一组可组合的 skill 加一段开机引导组成，跨 7 个 harness、零依赖。它要求 agent 先澄清意图、产出 spec、编写计划，再 TDD 实现，解决的是「拿到需求直接写代码」这一常见问题。

**真实编排机制**（没有 JS 编排器，也没有 `commands/`/`agents/` 目录，纯靠四层软约定）：

- **开机引导 hook**：`hooks/hooks.json` 注册 `SessionStart`，将 `using-superpowers/SKILL.md` 整段包裹在 `<EXTREMELY_IMPORTANT>` 中注入上下文。`CLAUDE.md` 明确指出：「没有这个 bootstrap，skills 就是死代码」。
- **强制 skill 自检**：规定**任何回复之前**（哪怕只是回个问题）都必须先查一遍 skill，「只要有 1% 可能相关就必须调用」。
- **skill 串成一条流**：每个 skill 末尾都用 `REQUIRED SUB-SKILL` 明明白白点出下一个，`brainstorming → writing-plans → subagent-driven-development → finishing-a-branch` 串成一条确定性链路。
- **状态文件就是交接**：spec 写到 `docs/superpowers/specs/`，plan 用 `- [ ]` checkbox 来跟踪。

**它的「两段式评审」长什么样**：在 `subagent-driven-development/SKILL.md` 里，每个任务的验收是一条**两段串联、各自循环到过**的链。拿伪码把它的形状勾出来（这是提示词语义，不是可运行脚本）：

```text
# superpowers 两段式评审（伪码 · 还原 SKILL.md 的控制结构）
for each task:
  loop:                               # 第一段：spec 合规
    review_spec(task)                 # 过度实现？遗漏实现？
    if compliant: break
    fix(task); # 再 review
  loop:                               # 第二段：code quality
    review_quality(task)              # 命名/错误处理/边界
    if good: break
    fix(task); # 再 review
  # 两段都过，才进入下一个 task
```

注意它的「保证」全靠提示词请求模型「再评一次」，是**软约定**，不是硬控制流。这正好可以用原生 Workflow 的 `pipeline`（两段串联）加 JSON Schema（`pass: boolean` 门控字段）做成一道**确定性质量闸**（第 24 章会逐行动手，把这条伪码焊成能跑的脚本）。

另外还值得记一笔：superpowers 的 subagent **结构化状态返回**用一组固定的枚举词收口，比如 `DONE` / `BLOCKED` / `NEEDS_REVIEW`，让上游能照着分支走。这其实就是「自由文本变可判定结论」的雏形，而原生 Workflow 的 `schema enum` 把它从一句约定升级成了工具层的强制。

---

## 23.4 oh-my-claudecode：Stop 钩子持久循环

**它是什么**：一个面向 Claude Code 的大型编排插件，将「多 agent 协作 + 持久化执行 + 质量门禁」打包成开箱即用的工作流，解决的是「复杂任务被静默地半途宣布完成」的问题。

**真实编排机制**（hooks + 状态文件 + skills + 20 角色 subagent）：

- **钩子驱动**（`hooks/hooks.json`）：`UserPromptSubmit→keyword-detector` 一检测到魔法词就注入对应的 SKILL；`SubagentStop→verify-deliverables`；**`Stop→persistent-mode`** 是核心所在，它检查 `.omc/state/` 里有没有活跃的 mode，有就**阻断停止**，再回注一句「The boulder never stops」把循环顶起来。
- **状态文件就是控制平面**：`.omc/state/sessions/{id}/` 存 mode/phase/iteration，控制面跟数据面（`.omc/plans/`、`prd.json`）分开放，crash 之后还能 resume。
- **PRD 驱动 + 独立 reviewer 签核**：`ralph` 要求 `prd.json` 每条 story 都 `passes:true`，而且得经过一个独立 critic 验证，才算完。

**`Stop` 钩子的核心逻辑长什么样**：它把「让不让停下」做成一段在 `Stop` 生命周期点执行的判断。拿伪码勾出来（还原 `persistent-mode` 的控制结构，不是可运行脚本）：

```javascript
// OMC · Stop 钩子伪码 ——「the boulder never stops」
// 触发点：Claude 准备结束本轮时
function onStop() {
  const mode = readActiveMode('.omc/state/')        // 磁盘状态：有没有在跑的 mode？
  if (!mode) return { allow: true }                 // 没有活跃 mode → 放行，正常停
  if (mode.allStoriesPass) return { allow: true }   // PRD 每条 story 都 passes:true → 放行
  return {                                          // 否则：阻断停止 + 回注续推提示
    allow: false,
    inject: 'The boulder never stops. 继续推进未完成的 story。',
  }
}
```

这就是「执行完毕 ≠ 验收通过」的物理实现：通过**拦截停止动作**来维持循环。注意它将判据（`allStoriesPass`）和状态（mode/phase/iteration）都持久化到 `.omc/state/` 磁盘上，因为提示词驱动的循环没有内存。

**最值得借鉴的一点**：**用 `Stop` 钩子加状态文件构建「完成判据循环」**。原生 Workflow 是脚本执行完即结束，而 OMC 将「是否允许停止」变成一道可编程的门。将这个思路引入 Workflow，配合 JSON Schema 校验产物，就能把「流水线执行完毕」升级成「满足验收标准才算完成」（第 18 章「循环到干」正是其在 Workflow 中的对应形式）。将上面的 `Stop` 钩子与第 24 章的 `while (!accepted)` 循环对比：钩子拦截加磁盘状态，最终简化为一个 `while` 加几个局部变量。

---

## 23.5 oh-my-openagent：工具层护栏 + 不可信验证

**它是什么**（OmO，建在 **opencode** 上，不是 Claude Code）：一个发布成 npm 包的插件型 Agent OS，把单个 agent 撑成一支「开发团队」。它注册了 **10 个内置角色**，比如 Atlas 指挥、Sisyphus 执行、Metis 等；规划由 **Prometheus 人格**担纲（它在 prompt 里出现，但不在注册的 builtin agent 联合内）。多模型可以混着用，入口是 `ultrawork`/`ulw`。

**真实编排机制**（运行时 harness：插件 hooks + 自定义 tools + 状态文件）：

- **slash command + hook 切角色**：`/start-work` 被 `start-work-hook.ts` 拦下来，读 `boulder.json` 判断是 resume 还是 init，再切到 Atlas。
- **程序化 subagent 派发**：`task()`/`call_omo_agent` 工具是真的去调 opencode API 开一个子会话，然后轮询。
- **system-reminder 注入驱动循环**：Atlas 的 hook 族每轮注入 `BOULDER_CONTINUATION_PROMPT` 和 `VERIFICATION_REMINDER`（「子 agent 说自己做完了，它在撒谎，去验证」），等 Atlas 越界去改代码时，再注入一个 `DELEGATION_REQUIRED` 把它拉回来。
- **工具层护栏**：`prometheus-md-only/hook.ts` 在工具调用之前硬拦一道，规划者的 `Write/Edit` 只允许写 `.omo/*.md`，违规就直接 `throw`。**规划者物理上无法写代码。**

以下是几个具体的实现形态。

入口是一个正则关键词。`keyword-detector/constants.ts` 用 `/\b(ultrawork|ulw)\b/i` 去匹配用户消息，匹配上就唤起整套编排。它跟原生 Workflow 的**早期社区昵称** `ultrawork` 同名，并不是巧合（该词在官方 v2.1.154 已不再是触发词，仅存内部事件名 `ultrawork_request`）。

它注册的内置角色正好是 **10 个**（`src/agents/types.ts` 里的 `BuiltinAgentName` 联合）：

```text
sisyphus · hephaestus · oracle · librarian · explore
multimodal-looker · metis · momus · atlas · sisyphus-junior
```

（规划人格 **Prometheus** 出现在 prompt 里，但**不在**这个注册联合内。它是「人格」，是 prompt 扮演的角色，而非一个可派发的 builtin agent。）

而「规划者物理无法写码」这道护栏，本质就是工具调用层的一行 `throw`。拿伪码勾出来（还原 `prometheus-md-only/hook.ts` 的拦截逻辑）：

```javascript
// OmO · 工具层护栏伪码 —— 规划者只能写 .omo/*.md
function beforeToolCall(tool, args) {
  if (tool === 'Write' || tool === 'Edit') {
    if (!args.path.match(/^\.omo\/.*\.md$/)) {
      throw new Error('Planner may only write .omo/*.md')   // 物理拦截，非提示词请求
    }
  }
}
```

这将「规划者不能修改代码」从**提示词层面的约定**变成了**运行时的物理限制**，这正是第 24 章要用原生方式重写为「`schema` 约束的 planner 只能产出计划对象」的出发点。

**最值得借鉴的两点**：一是**用工具层护栏加 system-reminder 注入来强制执行纪律，而不是依赖提示词约定**。二是**按 Category（语义意图）委派，而非按模型名委派**：LLM 看到的是 `category="quick"/"ultrabrain"`，运行时再将其映射到模型 fallback 链，既消除了「模型自我设限」的分布偏置，又使模型可以热插拔。这对 Workflow 的 `agent({model})` 选型有启发意义：应按任务类别决定模型，避免硬编码模型名称。

---

## 23.6 横评一览

| 系统 | 宿主 | 编排机制 | 确定性 | 最强项 | 核心借鉴 |
|---|---|---|---|---|---|
| **ccg-workflow** | Claude Code | 提示词状态机 + JS Hook + Go 桥接多模型 | 弱（提示词约束） | ccg 多模型并行交叉验证 + 抗压缩 | 磁盘状态 + 每轮面包屑注入 |
| **superpowers** | 跨 7 harness | skill 链 + SessionStart 注入「宪法」 | 弱（概率性） | 方法论纪律（TDD/brainstorm） | 两段式评审循环 |
| **oh-my-claudecode** | Claude Code | hooks + 状态文件 + 20 角色 | 中（Stop 钩子兜底） | 韧性（resume/防静默失败） | Stop 钩子＝完成判据循环 |
| **oh-my-openagent** | opencode | hooks + 自定义 tools + 状态文件 | 中（工具层护栏） | 越界护栏 + 类别委派 | 工具层 throw + Category 委派 |
| **原生 Workflow** | Claude Code | **JS 脚本 pipeline/parallel/phase + Schema** | **强（代码）** | 确定性 + 结构化 + 可复用 | —— |

**阅读方式**：前四行是「模拟编排」，最后一行是「原生骨架」。它们不是竞争关系。**推荐做法是以原生 Workflow 为骨架，将这四个系统的精华作为韧性层整合上去。**

<div class="callout warn">

**不要照搬表中「编排机制」这一列。** 这一列描述的是**实现**（某个宿主上的钩子、状态文件、Go 桥接），而非**模式**。真正有价值的是「最强项」和「借鉴」这两列背后的**控制结构**：磁盘面包屑的本质是「将结构化状态显式传递」，`Stop` 钩子的本质是「完成判据可编程」，工具层 `throw` 的本质是「角色边界由系统强制」。将实现直接搬入原生 Workflow 会产生兼容性问题。**如何将模式从实现中提取出来，再用 `phase`/`schema` 重新实现，是下一章的全部主题。**

</div>

---

## 23.7 本章小结

- 四大系统都在原生 Workflow 之前，用**提示词加 Hook 加状态文件**模拟确定性编排。
- 各自的精华：ccg 是磁盘状态面包屑，superpowers 是两段式评审，OMC 是 Stop 钩子完成判据，OmO 是工具层护栏加类别委派。
- 原生 Workflow 把它们缺的那块**确定性骨架加 Schema 约束**补上了，两者互补。

下一章将「如何系统地从其他系统中提炼好的想法，再用 `phase`/`schema` 重写成可复用的 Workflow」整理为一套方法论。

> 继续阅读：[第 24 章 · 精华提取术](#/zh/p5-24)
