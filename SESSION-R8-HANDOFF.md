# Session R8 交接文档 · workflow-cookbook

> 给 R9（或任何接手者）。本文件只写**可追溯**的事实：每条都能用 `git`、`node scripts/anchor-audit.mjs` 或 `assets/transcripts/` 的 Run ID 复核。**真值底座不变：只有「Claude Code 官方工具定义」+「本机实测 Run ID」是权威真值；第三方资料（aivi.fyi / zenn / claude-code-workflow-creator）一律「参考/未核实」，引用须显式标注。**

---

## 0. 一句话状态

R8 = **「以最苛刻姿态全量复核 + 4 项扩充 + 全书 36 章激进『说人话』重写 + 前端打磨」**，共 **6 个 phase / 11 个提交**（`4caf4d4` → `877868d`）。核心结论：**全书事实层经多 agent + 跨模型（codex）双闸独立复核后被确认零事实漂移**；散文层在「事实保全双闸」保护下完成最激进的一轮口语化重写；前端做了 a11y/打磨级修复（agy 不可用→claude fallback，Playwright 实测）；终审阶段还顺手修了 1 处预存坏链。**全书 36 章 + 6 附录规划范围维持完成态。**

---

## 1. R8 提交账本（逐条可追溯 · `git log ebb67d3..HEAD`）

| commit | phase | 内容 |
|---|---|---|
| `4caf4d4` | 0 | 真值锚定：live-probe 实测 + §5 resume cache-key 转正 |
| `01a3dac` | A | 全量复核 + codex P0 修复 + cache-key 转正 |
| `a20e779` | A | codex 审残留；统一 subagent 模型值为 `[1m]` |
| `46c13c3` | B | 4 扩充：内置 workflow 解剖 + 跨平台 corner case + zenn 折叠 |
| `a7b757c` | C | 说人话样本：p1-01 + p3-15（先样本后铺全书） |
| `dbc7946` | C | 批次 1：9 章（00 + p1-02/03 + p2-04..09） |
| `bebafe3` | C | 批次 2：9 章（p3-10..14/16 + p4-17/18/19） |
| `a682991` | C | 批次 3：9 章（p4-20/21/22 + p5-23..26 + p6-27/28） |
| `de0723d` | C | 批次 4 收官：6 章（p6-29 + app-a/b/c/d/f）；**Phase C 完成 36/36** |
| `6273136` | D | 前端打磨（claude fallback 审 + Playwright 验证） |
| `877868d` | E | 修 p5-24 预存 10 处坏链（全名 id→短 id） |

R8 基线 = `ebb67d3`（R7 收官提交）。

---

## 2. R8 真实产出（按 Phase）

### 2.1 Phase 0 / A / B（`4caf4d4` / `01a3dac` / `a20e779` / `46c13c3`，本会话之前完成并已过 codex 审）
- Phase 0：实跑探针锚定真值；§5（resume / cache-key）从「待核实」转正为实测事实。
- Phase A：36 章 × zh/en 对照 `assets/_grounding.md` 全量复核去幻觉；案例真跑；统一 subagent 模型口径为 `claude-opus-4-7[1m]`。codex P0 已修。
- Phase B：4 项扩充（内置 workflow 解剖 / 跨平台 corner case / §5 实测转正 / 多维 demo）+ zenn 第三方解读「折叠为参考、不当真值」。

### 2.2 Phase C — 全书 36 章激进「说人话」重写（5 提交，**双闸全程零事实漂移**）
- **方法**：先样本（p1-01/p3-15）经用户确认力度，再分 4 批并行（每批 6-9 章，每章 1 个 rewrite agent 改 zh+en、做 gate-1 自检）。规范见 `.ccg/tasks/r8-fullverify-expand-polish/phaseC-rewrite-spec.md`。
- **事实保全双闸**：①**gate-1**＝rewrite agent 自检 + 我（主窗口）独立机械硬验（逐章对 HEAD 比对：行数、代码块字节、Run ID 多重集、数字多重集、编号标题）；②**gate-2**＝codex 只读对抗审（语义层：强度词软化、新增声称、中英口径、单复数/比较级漂移）。
- **强度词双向锁**（本轮关键方法）：硬规则（必须/绝不/唯一/默认证伪/refute by default/must/never/only）不得写软；对冲/分级（可能/推测/未实测/示意/未核实/inferred/illustrative）不得写硬或删。
- **codex gate-2 逐批结果**：批次1 PASS；批次2 FAIL→1 LOW（p3-14「数一遍」漏改→「计票」）已修；批次3 FAIL→2 处（p5-24「派一个验证者」单数化、p4-22「碾压」比较级硬化）已修；批次4 FAIL→2 处（app-c「by a wide margin / 要靠谱得多」比较级硬化、app-d「派一个独立 agent」单数化）已修。**共 5 处语义漂移全部由 codex 逮到、按其处方修复——机械闸抓不到，正是双闸价值。**
- **app-e-sources 刻意 no-op**：信源/权威分级密集，改任何字都有软化分级/hedge 的风险，rewrite agent 明智地零改动（字节同 HEAD）。

### 2.3 Phase D — 前端打磨（`6273136`，claude fallback + Playwright 实测）
- **agy（antigravity v1.0.2）本轮不可用**：`agy --print` 非交互命中 OAuth 卡死（`Error: authentication timed out`，后台无法交互登录；与 R7「恰好已登录可用」不同）。**按既定规则 fallback claude** 做只读对抗审查。
- **4 处修复**（每处对真实 `index.html` + Playwright 桌面/移动独立核实，**0 console 错误**）：
  1. **[a11y]** `.table-wrap` 改为**按实际溢出**才加 `role=region`/`tabindex`/「可横向滚动」aria-label（新增 `gateTableRegions()` + resize 重新 gate）。实测：app-d 8 张术语表桌面=无 region、移动 resize 后=有 region，invariant 0 违例。修掉了「每张表都被宣告可横向滚动」的假可达性。
  2. **[打磨]** `.code-card pre:focus-visible` 圆角 4px→10px（焦点环对齐 10px 卡片）。
  3. **[健壮]** `onScroll` 用 `window.scrollY||doc.scrollTop`（去掉标准模式恒 0 的 `document.body.scrollTop` 死分支）。
  4. **[响应式]** `.main` 标题加 `overflow-wrap:break-word`（防窄屏长标题横向溢出；实测 390px body 横向溢出=0）。
- **跳过**审查的「锚点移出 tab 序」建议：当前已 a11y 合规，改动反而降低键盘可达 = 非明确改进。
- 风格未动；R7 既有 5 项前端修复确认仍在。

### 2.4 Phase E — 跨模型终审 + 坏链修复（`877868d` + 本提交）
- **anchor-audit 逮到预存 bug**：`node scripts/anchor-audit.mjs` 报 p5-24:930（zh+en）用**全名 id**（`#/zh/p3-10-sharded-review` 等）而非 manifest 短 id（`#/zh/p3-10`），5 链接 × 双语 = 10 处运行时坏链（点击会 404 回 home）。**经核实是 HEAD 预存 bug（line 930 在 HEAD 与现稿字节一致——Phase C 重写正确地没碰交叉引用）**，已修为短 id；audit 复跑 **0 issues**（834 链接 / 72 文档全解析）。
- **codex 跨模型终审**：见 §下方「跨模型门」。

---

## 3. 跨模型门（codex read-only）

- **Phase A/B**：本会话前已过 codex 审（P0 修复见 `01a3dac`/`a20e779`）。
- **Phase C**：4 批每批一道 codex gate-2，5 处语义漂移全修（见 §2.2）。
- **Phase E 终审**：codex 只读终审 `bmineul6m` = **VERDICT = PASS（0 问题）**：①Phase D `index.html` 改动正确——表格 region 仅在实际溢出时启用、aria 文案静态无注入、rAF/resize 无重复绑定或泄漏、未破坏 code-card fade/键盘导航/mermaid；②短 id 修复正确、`anchor-audit` 0 issues；③抽查 5 章中英 diff 无明显事实漂移、关键术语与第三方未核实标注一致。**R8 跨模型门全过（Phase A/B + C 四批 + E 终审）。**

---

## 4. 关键操作教训（新，可复现）

1. **codex API 会 mid-stream 停滞**：批次2 codex 首跑（`br2sdcxly`）在 event#46 后 `--json` 流 ~10 分钟零字节、父子进程双 `S`/0% CPU——是 API 流停滞而非本地推理。**判据**：读 wrapper 日志看 mtime + `ps` 看 CPU；停滞则 `TaskStop` + 重跑（只读审查重跑零损失）。重跑（`b8dwlr8pb`）自愈通过。
2. **agy（antigravity）headless 靠 OAuth，可能不可用**：`agy --print` 需已登录态；后台跑会卡 `authentication timed out`。**规则**：不可用即 fallback claude（本轮如此）；若要真 antigravity，需先交互 `agy` 登录。
3. **机械闸 + 语义闸缺一不可**：我的 grep 硬验（行数/代码/ID/数字/标题）抓不到「单数化、比较级硬化、术语漂移」这类语义问题——这 5 处全靠 codex gate-2。反之 codex 也信任机械闸的字节级结论。
4. **审查器/agent 的建议落地前必独立核实**：Phase D 对 claude 审的每条建议都对真实 `index.html` + Playwright 实测后才落，并主动跳过 1 条「非明确改进」的建议。
5. **anchor-audit 是 push 前的硬门**：它逮到了人眼/逐章 diff 都漏掉的预存坏链。**push 前必跑 `node scripts/anchor-audit.mjs` 要 0 issues。**

---

## 5. 可验证事实清单（R9 用前先复核 · 信源 `_grounding.md`）

- 功能名 = Workflow 工具（昵称 ultrawork）；门控 `CLAUDE_CODE_WORKFLOWS=1`；版本 v2.1.150；subagent 模型 `claude-opus-4-7[1m]`；返回**始终异步**（taskId/runId + `<task-notification>`）；实时进度 `/workflows`。
- 续传：同会话 + script/args 不变 → **100% 缓存命中**（实测 `wf_dacbd480-d5d`：0 token / 8ms）；`Date.now()`/`Math.random()`/无参 `new Date()` 在脚本内不可用。
- 错误传播 4 格：`parallel` thunk + 同步 throw → 整个 workflow 崩；`pipeline` stage + 同步 throw → 隔离为 null；异步 reject → null。
- 这些都在正文有 Run ID 背书；**改动前先 `grep` 对 `_grounding.md` 复核，勿凭记忆**。

---

## 6. 仍为「第三方未核实」（引用须显式标注，未变）

- `claude-code-workflow-creator`（YouTube `c0gVowvMR-g` 配套，**非官方**）、aivi.fyi、zenn `claude-code-workflow-ultrawork-2026`——思路可参考，**声称未经本机实测复现不得当真值**；正文引用处均已标注「第三方/未核实」。信源分级见 `_grounding.md §A2/§B3` 与附录 E。

---

## 7. 待办 / 接力点（R9）

- **push**：R8 全部提交在 `main`、**尚未 push**（push 是公开 GitHub Pages 部署，留给用户确认后执行）。`git push` 前复跑 anchor-audit。
- 若要补「真 antigravity 前端审查」：先交互 `agy` 登录，再跑 `agy --print` 那遍（本轮用 claude fallback 顶上）。
- 内容层无已知缺口；如继续，建议方向是**真跑更多 demo 提升 curated 真跑数**（而非改写）。

---

## 8. 协作铁律（贯穿，勿忘）

- 真值 = Claude 实测 + 官方工具定义二者；第三方一律标注未核实。
- 每个大 phase 后调 codex（经 codeagent-wrapper）对抗审；前端交 antigravity（经 agy，不可用 fallback claude）；codex/agy 审查**只读**，建议落地前必独立核实。
- 主窗口负责编排，重活交 agent（避免上下文爆炸 + 准确率下降）；所有 CLAUDE_CODE_WORKFLOWS 相关由 Claude 直接实测。
- 说人话、去 AI 味、中英口径一致；事实/数字/代码/Run ID/强度词零漂移。
- `.ccg/` 已 gitignore；`PROMOTION.md` 是未跟踪的外部文件，**勿暂存/提交**；暂存按文件名显式 add，不用 `git add -A`。

---

## 附：如何自行复核本文件的真值（R9 可直接跑）

```bash
# 1. R8 全部提交与改动文件
git log --oneline ebb67d3..HEAD
git diff --stat ebb67d3..HEAD

# 2. 任一提交的 diff（如 Phase D 前端）
git show 6273136 -- index.html

# 3. 锚点/交叉引用完整性（push 前硬门，须 0 issues）
node scripts/anchor-audit.mjs

# 4. R8 探针 / 引用的真跑 Run ID（在 transcripts / 正文）
grep -rhoE 'wf_[a-z0-9]+-[a-z0-9]+' docs/ | sort -u | head

# 5. Phase C 任一章 vs 重写前（确认事实保全）
git diff a7b757c^ de0723d -- docs/zh/p4-22-resume-caching.md
```
