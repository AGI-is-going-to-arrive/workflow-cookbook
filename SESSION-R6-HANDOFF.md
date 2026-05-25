# Session R6 交接文档 · workflow-cookbook

> 写给下一轮（R7）接手者，也作为本仓库「每一轮真实所做之事」的可追溯账本。承 [`SESSION-R5-HANDOFF.md`](SESSION-R5-HANDOFF.md)。
> **真值原则**：每条都能追溯到 ① 真实 git 提交（附短哈希）② `assets/transcripts/` 真实运行/审查记录 ③ `assets/_grounding.md` 规范源。凡无依据者不写。末尾给自验命令。

---

## 0. 一句话状态

R6 是一轮**全方位核实 + 打磨**：前端 9 项 dogfood 修复（含 SRI/HIGH）、亲自重跑 3 个应用级工作流（≈152 万 token）、全量 36 章普查（6 并行 agent，仅 5 处保守修复）、R5/R6 真跑并入规范源（唯一 Run ID 20→23）。事实层经 codex 深度 read-only 审查 + 主窗口独立交叉核验；前端经 Claude fallback 审查（agy 未认证）。`anchor-audit` **0 问题**、zh/en **36↔36**、SRI 浏览器验证 **6/6**。**全书规划范围保持完成态**，本轮主线是「让一切更经得起核」。

---

## 1. R6 提交账本（逐条可追溯 · `git log 665df2c..HEAD`）

> `665df2c` 是 R5 最后一个提交。其后为 R6 提交，均 2026-05-25、已 push `origin/main`。

| 提交 | 主题 | 真实改动 | 配套信源 |
|------|------|----------|----------|
| `e38578a` | fix: Phase A 前端打磨 | `index.html`（`scroll-padding-top` 64/80px、`refreshFades()`+resize、`.code-lang` 截断守卫、`doCopy` 焦点还原、`.code-lang` title）、`frontend-review-r6.md`(新) | `assets/transcripts/frontend-review-r6.md` |
| `81d4af6` | feat: Phase B 重跑 3 工作流 + 修 review-spa dogfood 发现 | `index.html`（9 项修复见下）、`examples-r6.md`(新) | `assets/transcripts/examples-r6.md` |
| `6fe4382` | fix: Phase C 全量 36 章普查 + 并入 R5/R6 真跑 | 5 处保守修复（`p1-02`/`p2-09`/`app-e` en、`p4-21`/`p4-22` zh+en）、`_grounding.md §C2`、`p6-29` zh+en R6 复跑说明 | 6 个普查 agent 报告 + `_grounding.md` |
| （本提交）| chore: Phase D 收尾 | `README.md`/`README.en.md`（真跑数 20→23 + 软化绝对化表述）、`index.html`（首页 stat 10+→20+）、`SESSION-R6-HANDOFF.md`(新)、`.gitignore` | 本文件 / `_grounding.md §C2` |

---

## 2. R6 真实产出（按 Phase）

### 2.1 Phase A — 前端打磨（`e38578a`）
- 审计先行：4 个只读 agent + Playwright 真浏览器验证。**纠偏**：审计 agent 曾报「tab/copy 不一致 P0」，但实测 `grep tab` 全仓库 **0 个 tab 字符**（全空格缩进）→ 该问题**不存在**，未做伪修复。
- 真实修复 3 项：`scroll-padding-top`（锚点跳转不被 sticky topbar 遮挡）、`refreshFades()`+独立 resize rAF 守卫、`.code-lang` 省略号截断守卫。
- **GitHub Pages 子路径 corner case**：用 `localhost:8769/workflow-cookbook/` 子路径模拟项目站点，Playwright 实测相对 `fetch(manifest.json)`/`docs/*.md` 全部 200、SPA 完整启动 → 子路径下不 404（这是 R1–R5 未专门验证的点）。
- **审查门（agy 不可用 → Claude fallback）**：`agy --print` 实测**未认证**（Google OAuth、headless 30s 超时、exit 0 假成功）。按用户指令 fallback Claude agent 审查：确认 3 处改动 clean，再采纳 2 项（`doCopy` 焦点还原、`.code-lang` title）、驳回 2 项（焦点陷阱入口=有意设计、mermaid 静默=已有 `.catch` 回退）。证据 `frontend-review-r6.md`。

### 2.2 Phase B — 重跑 3 个应用级工作流（`81d4af6`）
- 我直接调 Workflow 工具真跑（并发），数据并入 `_grounding.md §C2`：

  | 脚本 | Run ID | agent | token | 墙钟(ms) | 结果 |
  |---|---|---|---|---|---|
  | review-spa | `wf_ca7aa11f-6fb` | 18 | 789,482 | 244,897 | 14 条确认 |
  | dead-code-scan | `wf_ccda2a68-fab` | 2 | 118,280 | 111,770 | 2 轮干净，0 死代码 |
  | feedback-themes | `wf_0771c834-a9f` | 20 | 613,112 | 59,250 | 18→6 主题 |

  ⚠ **成本真相**：`CLAUDE_CODE_SUBAGENT_MODEL=claude-opus-4-7[1m]` 覆盖脚本 `model:'haiku'`，三跑实跑 Opus、合计 ≈152.1 万 token。
- **dogfooding**：review-spa 审本书自己的 `index.html`（修复前版本），经对抗验证确认 **14 条发现**。主窗口逐条交叉核对后 **9 修 / 5 驳回或记录**（详见 `examples-r6.md §2`）。9 修中最重的：① `slugify` slug 碰撞（「Setup 1」撞去重 `setup-1`）→ 重写去重逻辑；② `decodeURIComponent` 遇畸形 `%` 抛错致死链 → try/catch；③ **4 个 CDN 脚本无 SRI（HIGH）** → 加 `integrity`（sha384 用 Node `crypto` 实算，因 context-mode 拦截 curl 改用 `ctx_execute`）。
- 修复后 Playwright 复验 **6/6 PASS**（章节渲染/0 console 错误/mermaid 出图/hljs 高亮/锚点 top≈64/重复 id=0/ghLink 合法）。

### 2.3 Phase C — 全量 36 章普查 + 并入真跑（`6fe4382`）
- 6 个并行 agent，按 part 分批、文件归属互斥（zh+en），mandate=**保守核实+只修硬伤**。结果：**全书极干净，仅 5 处保守修复**（4 处 EN 镜像过度声称/缺漏对齐到诚实中文版；1 处事实分级矛盾：`p4-22` 把缓存键「label/phase 不入键」从实测降级为第三方未核实，依 `_grounding.md §35/§53`）。每处主窗口看 diff 交叉核对正确。
- **并入真跑**：R5+R6 六个应用级真跑并入 `_grounding.md §C2`（唯一 Run ID 20→23）；`p6-29` 双语补一句 R6 复跑印证（形态稳定复现、发现数随目标演进波动）。
- **审查门（codex 默认模型）**：`codex exec -s read-only` 跑了深度核查（376KB 轨迹：用 node 实测 slugify 重写碰撞用例、枚举全仓库 32 个 wf_ 对照 transcripts），**全程未抛 CRITICAL、其计划行自陈趋向 SAFE**；进程在最终 verdict 块刷出前**卡死**（4.5 分钟无写），被 `pkill` 停止（exit 144）。所有改动已由主窗口独立交叉核验（sweep diff 逐行、slugify 浏览器 0 重复 id、SRI 6/6、数字三处自洽）。

### 2.4 Phase D — 收尾（本提交）
- README 双语：真跑数 `20 → 23`（+R6 3）；软化 line 38「每个配方都真实跑过」为「已实跑附 Run ID、示意明确标注」（与 line 53 诚实声明统一）。
- `index.html` 首页 stat `10+ → 20+`（中英）。
- `anchor-audit`：72 文档 / 812 链接 / **TOTAL ISSUES: 0**。

---

## 3. 关键操作教训（新，可复现）
- **agy（antigravity）需 Google OAuth、headless 下会认证超时**：`agy --print` 即使重定向 stdin 也会卡在 OAuth（30s 超时、exit 0 假成功）。R6 据用户预案 fallback 到 Claude agent。R7 若要真用 agy，需先交互式 `agy` 登录。
- **codex exec 可能在收尾卡死**：本轮 codex 深度审查完成调查、趋向 SAFE，却在刷最终 verdict 前停滞 4.5 分钟。判据：输出 mtime 长时间不变 + 已出现「SAFE verdict」计划行。处置：`pkill -f "codex exec"`，据独立核验推进。**教训**：codex 审查是第二意见/安全网，主窗口必须独立核验、不可纯等它出结论。
- **context-mode hook 拦截 curl/wget**：算 SRI sha384 改用 `ctx_execute`（Node `fetch`+`crypto`），不要重试 curl。
- **审计 agent 会报伪问题**：「tab/copy 不一致」经 `grep $'\t'` 实测为 0 → 不存在。落实任何「修复」前先验证问题真伪。

---

## 4. 可验证事实清单（R7 用前先复核）
- **唯一 Run ID = 23**：R4 基线主表 17（`_grounding.md §C`）+ R5 应用级 3 + R6 应用级 3（`§C2`）。注：仓库内 `wf_` 字符串实际有 32 个（含 R3 复验组与子运行），「23」是 curated 计数。
- **结构 = 6 部 29 章 + 附录 A–F**：`manifest.json`。
- **zh/en 完全对照**：`ls docs/{zh,en}/*.md | wc -l` = 各 36。
- **链接/锚点/跨平台/i18n 审计 0 问题**：`node scripts/anchor-audit.mjs`（72 文档 / 812 链接 / TOTAL ISSUES: 0）。
- **前端 SRI 不破坏加载**：4 个 CDN 脚本（marked/dompurify/highlight/mermaid）加 sha384 SRI，Playwright 子路径实测 0 console 错误、4 全局对象全加载。
- **中文正文约 14.5 万汉字**：`cat docs/zh/*.md | grep -oE '[一-鿿]' | wc -l`。

---

## 5. 仍为「第三方未核实」（引用须显式标注，未变；信源 `_grounding.md §A2/§B3`）
错误类名 `WorkflowAgentCapError`/`WorkflowBudgetExceededError`、`stallMs`/重试次数、预算耗尽时在途 agent 处置、resume **缓存键精确组成**（含 `label`/`phase` 是否入键，R6 已把 `p4-22` 此处从实测降级回未核实）、`'inherit'` 精确语义、schema 重试**确切次数**、并发下限 `max(2,…)`。

---

## 6. 待办 / 接力点（R7）
- 全书规划范围**已完成、已上线、事实层经多轮跨模型 + 独立核验**。**无强制待办。**
- 可选增强：① 已记录的 a11y 缺口（`p6-29 §29.1` 列、`examples-r6.md` finding #13）——mermaid figure `role=img` + 通用 aria-label，图内文字对 SR 不可见；正确修法需**逐图人工撰写描述**，留待按图补。② 若要真·antigravity 前端审查，先交互式登录 `agy`。③ 若 codex 审查再卡死，直接 `pkill` + 独立核验。
- 阻塞（用户侧，未变）：GitHub Actions 被计费封禁——只影响 Actions，**分支部署不受影响，切勿改回 Actions Pages**（push `main` 即部署）。

---

## 7. 协作铁律（贯穿，勿忘）
绝不虚构、信源三级权威分级；能实测就真跑（含 Playwright 真浏览器）；每大阶段后交跨模型（codex / agy，经 ccg；不可用则 fallback Claude）对抗审查再改，**落实前交叉核对——审查器会误判真实事实、也可能卡死**；主窗口编排、繁重读写派子代理；跨平台正确（Pages=Linux 大小写敏感）；zh/en 完全对照；每完成一个 phase 即 commit+push（标准授权，push=部署）；开发侧 junk 入 `.gitignore`、handoff 白名单单列；**切勿改回 Actions Pages**。

---

## 附：如何自行复核本文件的真值（R7 可直接跑）
```bash
# 1. R6 全部提交与改动文件
git log 665df2c..HEAD --name-only --format='### %h | %ad | %s' --date=short

# 2. 任一提交的 diff
git show 81d4af6      # Phase B：9 项 dogfood 修复 + examples-r6.md
git show 6fe4382      # Phase C：36 章普查 5 修 + grounding §C2

# 3. R6 三个真跑 Run ID 与用量
grep -nE 'wf_(ca7aa11f|ccda2a68|0771c834)' assets/transcripts/examples-r6.md assets/_grounding.md

# 4. 结构与审计
node scripts/anchor-audit.mjs                 # 期望 TOTAL ISSUES: 0
ls docs/zh/*.md docs/en/*.md | wc -l          # 期望 72（各 36）

# 5. SRI 已加（4 个脚本）
grep -c 'integrity="sha384-' index.html       # 期望 ≥3（head 3 个；mermaid 在 loadScript 动态加）
```
