# 附录 C · 最佳实践清单

> 这份附录是一张**能逐条打勾的清单**。每条都告诉你该怎么做、为什么、怎么落地，并链到对应章节。你设计或评审一个 Workflow 时，从头过一遍。勾上的越多，脚本就越确定、越省钱、越容易续传，也越好观察。
>
> 这张清单管的是「怎么把一个形状做对、做好」。要先决定**用哪个形状**（pipeline 还是 parallel、要不要套对抗验证），先看 [附录 F · 模式目录与场景速查](#/zh/app-f)，挑好形状再回来逐条打勾。
>
> 每条论断的 API 依据在 [附录 A](#/zh/app-a)，行为依据在 [附录 E](#/zh/app-e) 的真实运行里。配套的反向清单（踩坑与排错）在 [附录 B](#/zh/app-b)。

---

## C.1 怎么用这份清单

- 动手**前**：扫一遍 [C.2 结构与编排](#c2-结构与编排)、[C.3 schema 与产物](#c3-schema-与产物)，把骨架定下来。
- 写**的时候**：对照 [C.4 可观测性](#c4-可观测性进度日志与标签)、[C.5 成本与规模](#c5-成本与规模)，边写边勾。
- 交付**前**：把 [C.6 韧性与验证](#c6-韧性与验证)、[C.7 迭代与续传](#c7-迭代与续传)、[C.8 隔离与嵌套](#c8-隔离与嵌套) 过一遍，确认没漏掉什么。
- 某条拿不准 → 点链接回正文章节；术语没看懂 → 查 [附录 D](#/zh/app-d)。

> 图例：`[ ]` 是待勾选；下面的「**为什么**/**落地**」是你拿来判断的依据。强约束（不照做就会出错或浪费）标了 ⚠️。

---

## C.2 结构与编排

- [ ] **多阶段默认用 `pipeline()`，不要用 `parallel()` 串联。** ⚠️
  - **为什么**：`parallel` 是个屏障，它要等一批全部跑完才进下一步。你把多阶段写成「`parallel` 接 `parallel`」，每到一个阶段边界就白白等最慢的那一个。`pipeline` 不一样：它让每个 item **独立**流过全部 stage，阶段之间没有屏障，所以墙钟约等于最慢的那条单链，而不是各阶段最慢的加起来。
  - **落地**：见 [第 8 章 · parallel vs pipeline](#/zh/p2-08)。只有「确实要所有结果一起出现」时才用 `parallel`（比如先 fan-out 再综合）。

- [ ] **`parallel()` 只传 thunk（`() => agent(...)`），绝不传 Promise。** ⚠️
  - **为什么**：你传 `agent(...)`（一个 Promise）进去，它在数组刚构造出来时就立即跑了。这样既不符合 `parallel(thunks)` 的 API，`parallel()` 也没法按 thunk 来管它，还把「async reject / agent 出错就归为 `null`」这套错误归集语义弄丢了。（并发上限的节流是**每工作流**统一施加的，绕不过去。）
  - **落地**：`parallel(items.map(it => () => agent(prompt(it), { schema })))`。详见 [附录 B · B.4](#/zh/app-b)。

- [ ] **`meta` 写成纯字面量，首行就是 `export const meta = {…}`。** ⚠️
  - **为什么**：运行时在跑脚本之前，会先静态读一遍 `meta`；里面只要带了变量、函数调用、展开或模板插值，就会被拒，工作流根本起不来。
  - **落地**：动态内容挪到脚本体里，用 `log()`/`phase()` 来表达。见 [第 5 章 · meta 与 phase](#/zh/p2-05)。

- [ ] **阶段先在 `meta.phases` 里声明，再在脚本里 `phase()`/`opts.phase` 引用。**
  - **为什么**：先声明 phase，进度树的结构就清晰、可预期；`phase()` 的标题跟 `meta.phases[].title` 是按字符串一字不差地对上的。
  - **落地**：见 [第 5 章](#/zh/p2-05)。

- [ ] **`parallel`/`pipeline` 内部用 `opts.phase` 显式归组，不靠全局 `phase()`。** ⚠️
  - **为什么**：全局 `phase()` 是带状态的，并发 agent 会去抢「当前是哪个阶段」，结果归组就乱了。
  - **落地**：让每个并发 agent 自己带上 `phase:'Review'`。真实脚本 `frontend-review`/`judge-panel` 都是这么干的。详见 [附录 B · B.12](#/zh/app-b)。

- [ ] **脚本体只做编排，副作用交给 agent。** ⚠️
  - **为什么**：脚本体是一个受限的 `async` 沙箱，没有文件系统、没有网络、没有 `require`、也没有 Node 全局。读写文件、联网这些事，都得交给 `agent()` 派出去的 subagent（它们才握着真实工具权限）来做。
  - **落地**：要读文件就 `agent('Read x and ...')`；要数据就用 `args` 传进去。详见 [附录 B · B.16](#/zh/app-b)。

---

## C.3 schema 与产物

- [ ] **关键产物用 `schema` 约束形状。** ⚠️
  - **为什么**：带了 `schema`，校验就发生在**工具调用层**：模型给的东西不合规会**自动重试**，直到对上为止，最后返回一个**已验证对象**。下游直接 `.field` 取用就行，用不着再去解析自由文本。
  - **落地**：`agent(prompt, { schema: { type:'object', properties:{…}, required:[…] } })`。见 [第 7 章 · 结构化输出与 Schema](#/zh/p2-07)。真实印证：`hello` 的 `sum` 严格就是数字 `4`（Run `wf_dacbd480-d5d`）。

- [ ] **schema 约束形状，但给模型留表达空间（别过严）。**
  - **为什么**：`enum` 漏了项，或者硬逼模型交出它根本产不准的字段（比如精确行号），都会触发**持续重试**，把它拖慢、甚至卡死。
  - **落地**：`enum` 把所有合法取值都覆盖到；`required` 只列必要的那几个字段；精确位置用描述性的 `string` 来装。拿不准就先用 `string` 跑一轮，再慢慢收窄。详见 [附录 B · B.9](#/zh/app-b)。

- [ ] **复杂结构拆两阶段（先产文本，再结构化），别一步到位。**
  - **为什么**：深层嵌套的 schema 想一次满足很难；拆成「生成 → 结构化」两步更稳。
  - **落地**：用 `pipeline` 把「draft」和「extract」分成两个 stage。

- [ ] **跨 stage 需要原始输入时，用回调签名 `(prevResult, originalItem, index)`，别把它顺着上一阶段返回值一路传下去。**
  - **为什么**：`pipeline` 的每个 stage 都能直接拿到 `originalItem`，犯不着去污染上一阶段的产物 schema。
  - **落地**：`(found, kind) => agent(\`verify ${kind}: ${found.example}\`)`。真实印证：`pipeline-demo` 的 stage2 签名就是 `(found, kind)`（Run `wf_bf086b98-6ec`）。见 [第 8 章](#/zh/p2-08)。

---

## C.4 可观测性：进度、日志与标签

- [ ] **每个 agent 给描述性 `label`。**
  - **为什么**：`label` 就是 `/workflows` 进度树和 transcript 里显示的那个名字；`review:a11y` 比「agent #3」好找、也好搜。
  - **落地**：`agent(prompt, { label: \`review:${d.key}\` })`。见 [第 6 章 · agent() 完全指南](#/zh/p2-06)。

- [ ] **在里程碑处 `log()`，把关键计数/决策写出来。**
  - **为什么**：`log()` 会在进度树上方打出一行叙述，这是你事后回看「到底发生了什么」的主要线索（比如「barrier released with 3/3 results」「pipeline kept N/M items」）。
  - **落地**：阶段一切换、过滤完剩多少条、为啥提前退出，都值得 `log` 一下。真实脚本普遍这么做。见 [第 9 章 · 进度·日志·续传·预算](#/zh/p2-09)。

- [ ] **显式记录「掉队/降级」。**
  - **为什么**：`parallel` 的异步 reject、`pipeline` 阶段里的 throw，都会把那一项标成 `null`。你光看最后剩几条，容易误以为是数据丢了。（注意：`parallel` thunk 里的**同步** throw 不会变 `null`，而是会抛穿 `parallel` 调用、崩掉整个 run，见 [C.6](#c6-韧性与验证) 与 [C.2「只传 thunk」](#c2-结构与编排)。）
  - **落地**：`log(\`pipeline kept ${ok.length}/${items.length}\`)`。详见 [附录 B · B.15](#/zh/app-b)。

- [ ] **把 `taskId`/`runId` 收好。**
  - **为什么**：`taskId` 是拿来追踪和停止的（TaskStop），`runId` 是拿来续传的（`resumeFromRunId`）。工作流**始终异步**，回执不等于结果。
  - **落地**：结果要等完成通知；想看实时进度就看 `/workflows`。详见 [附录 B · B.14](#/zh/app-b)。

---

## C.5 成本与规模

- [ ] **派 agent 前先估成本：token ≈ agent 数 × 每 agent 上下文（约 2.5–3 万）。**
  - **为什么**：每个 agent 都是独立上下文，成本基本是线性往上叠的。真实印证：parallel 3 agent ≈ 78,844 ≈ 3×26,338（Run `wf_52957913-6d2`）。
  - **落地**：先算清楚「这套设计要派几个 agent」，再决定值不值得。经验法则见 [primitives 运行记录](#/zh/p2-08)。

- [ ] **墙钟看关键路径，不看 agent 总数。**
  - **为什么**：并发会把 N 个 agent 的时间压到「最慢那一个」上。真实印证：3 并发 8.4s ≪ 3×5.5s。
  - **落地**：能并发的就并发；多阶段用 `pipeline`，让阶段彼此重叠。见 [第 8 章](#/zh/p2-08)。

- [ ] **简单/机械的子任务用 `model: 'haiku'`。**
  - **为什么**：你不写 `model`，它就继承主循环的模型（通常是个强模型）；可分类、抽取、格式化这类活儿，用轻模型就够了，省 token 也省时间。
  - **落地**：真正说了算的是 `agent(prompt, { model: 'haiku' })` 里的那个 `opts.model`；至于 `meta.phases[].model` 运行时到底生不生效，本书未独立核实，你就当它是个展示标签，别单指望它。见 [第 6 章](#/zh/p2-06)、[第 21 章 · 动态预算与规模化](#/zh/p4-21)。

- [ ] **尊重并发上限，别指望无限并行。**
  - **为什么**：单个工作流同时只跑 `min(16, CPU核心数−2)` 个 agent，多出来的排队等着；单工作流 agent 总数还有个硬上限 **1000**。
  - **落地**：批量特别大的时候分批、分片来处理，别一次 fan-out 几百个。见 [第 21 章](#/zh/p4-21)。

---

## C.6 韧性与验证

- [ ] **重要产出加一道对抗验证（独立 agent「挑刺」）。**
  - **为什么**：第一版几乎总有盲区；换一个 agent，明确叫它「找错」，就能系统性地把问题逼出来。真实印证：GCF 让对抗式 Critique 从一个看着挺简单的 `slugify` 里揪出了 **10 个真实缺陷**（Run `wf_7472ceac-daa`）。
  - **落地**：Generate → Critique → Fix 三阶段。见 [第 12 章 · 生成-批评-修复](#/zh/p3-12)、[第 17 章 · 对抗验证](#/zh/p4-17)。

- [ ] **需要降低单点偏差时，用独立评委 + rubric + 计票。**
  - **为什么**：几个互不通气的评委，对「质量明显分得出高下」的候选能稳定地收敛到一处；rubric（用 schema 把维度固化成数字）加上计票，比「单个 agent 拍脑袋」更可靠。真实印证：judge-panel 的 3 名评委独立打分，3:0 收敛（Run `wf_f5b69668-b18`）。
  - **落地**：用 `parallel` 派出多个评委各打各的分，最后用 `votesA/votesB` 计票。见 [第 14 章 · 评委面板](#/zh/p3-14)。

- [ ] **消费 `parallel`/`pipeline` 结果前一律 `.filter(Boolean)`。** ⚠️
  - **为什么**：异步 reject（thunk 返回 rejected promise 或 `async` 抛错），或者 `pipeline` 阶段里 throw 的那个位置，就是 `null`；你不过滤掉，后面 `.map(r => r.x)` 就会抛错。`.filter(Boolean)` 只兜得住这类 `null`，**接不住** `parallel` thunk 里的**同步** throw：那种会直接抛穿 `parallel` 调用、崩掉整个 run。所以可能同步抛错的逻辑别裸放进 thunk（见 [C.2「只传 thunk」](#c2-结构与编排) 与 [附录 B · B.4](#/zh/app-b)）。
  - **落地**：`(await parallel(thunks)).filter(Boolean)`。详见 [附录 B · B.11](#/zh/app-b)。

- [ ] **关键路径不允许丢项时，在 stage 内 `try` 住并返回降级结果，而非抛错。**
  - **为什么**：`pipeline` 里某个 stage 一抛错，这个 item 就直接掉队，剩下的 stage 全跳过了。
  - **落地**：catch 之后返回 `{ ok:false, reason }`，让这一项接着往下走。详见 [附录 B · B.15](#/zh/app-b)。

- [ ] **「循环到干/重试到通过」要有收敛条件 + 轮次上限。**
  - **为什么**：光靠业务判据来判，可能永远收敛不了。
  - **落地**：`while (!done && round < MAX_ROUNDS)`。见 [第 18 章 · 循环到干与完整性批评](#/zh/p4-18)。

---

## C.7 迭代与续传

- [ ] **复杂脚本落盘成 `.js`，用 `scriptPath` 调用。**
  - **为什么**：脚本就是个文件，你能用编辑器或工具先核查一遍；Write/Edit 改完，用同一个 `scriptPath` 重跑就行，不用把整段脚本再发一遍。
  - **落地**：`Workflow({ scriptPath: '.../my-wf.js' })`。`scriptPath` 优先级最高。见 [附录 A · A.1](#/zh/app-a)。

- [ ] **想复用已跑成果，用 `resumeFromRunId` 续传，并保持前段脚本逐字不变。**
  - **为什么**：没动过的 `agent()` 续传时，**零 token、零工具、约 8ms** 就把缓存结果还给你了。真实印证：hello 续传 `total_tokens=0`/`duration_ms=8`（Run `wf_dacbd480-d5d` 复用）。
  - **落地**：改动只放在你想重跑的位置之后；续传**仅同会话**，而且应先 `TaskStop` 掉上一次运行。见 [第 22 章 · 断点续传与缓存](#/zh/p4-22)。

- [ ] **保证脚本可重放：禁用 `Date.now()`/`Math.random()`/无参 `new Date()`。** ⚠️
  - **为什么**：这些不确定的来源会破坏续传所要的对齐（运行时也会直接给你抛错）。
  - **落地**：时间戳用 `args` 传进来，或者事后再盖；随机性靠 agent 的下标去变提示词。详见 [附录 B · B.5](#/zh/app-b)。

- [ ] **想强制重跑某段，就故意改动它。**
  - **为什么**：缓存是按「这次调用变没变」来判的；改了就重跑，没改就命中。
  - **落地**：见 [第 22 章](#/zh/p4-22)。

---

## C.8 隔离与嵌套

- [ ] **`isolation: 'worktree'` 仅在「并行 agent 改同一批文件会冲突」时用。** ⚠️
  - **为什么**：worktree 很贵（启动约 200–500ms，外加磁盘和 agent 开销）；只读评审、纯分析、各写各的文件，这些都**不需要**它。没有改动时它会自动清理。
  - **落地**：只有并行重构、并行打补丁才开它；工具结果信封层会带上路径和分支。见 [第 19 章 · Worktree 隔离](#/zh/p4-19)。

- [ ] **复用整段流程用 `workflow()` 内联，但记住嵌套仅一层。** ⚠️
  - **为什么**：子工作流跟父用的是同一份并发上限、agent 计数、中止信号和 token 预算；你在子里再调一次 `workflow()` 就会抛错。
  - **落地**：把「孙级」那层逻辑展平，塞进子工作流里；要多级编排就交给主循环去串。真实印证：父内联跑了个 hello 子流程，子 agent 也计进了父的 `agent_count`（Run `wf_85e22b38-126`）。见 [第 20 章 · 嵌套 Workflow](#/zh/p4-20)。

- [ ] **用 `agentType` 复用已有 subagent 类型（可与 schema 组合）。**
  - **为什么**：`'Explore'`、`'code-reviewer'` 这类自定义类型自带专门的系统提示；跟 `schema` 一起用时，会再追加 StructuredOutput 指令。
  - **落地**：`agent(prompt, { agentType: 'Explore', schema })`。见 [第 6 章](#/zh/p2-06)。

---

## C.9 预算守卫

- [ ] **动态循环用 `budget.total && budget.remaining() < 阈值` 守卫提前退出。** ⚠️
  - **为什么**：`budget` 是个硬上限（`spent()` 一到 `total`，再调 `agent()` 就抛错）；而 `total` 可能为 `null`（没设目标时，`remaining()` 是 `Infinity`），所以得用 `budget.total &&` 短路一下，免得没设目标时反倒被误退。
  - **落地**：
    ```javascript
    if (budget.total && budget.remaining() < 30_000) {
      log(`budget guard: ${budget.remaining()} left, stopping`)
      break
    }
    ```
  - 详见 [第 21 章 · 动态预算与规模化](#/zh/p4-21)、[附录 B · B.6](#/zh/app-b)。

- [ ] **预算池是共享的：主循环 + 所有工作流（含嵌套子流程）共用一个池。**
  - **为什么**：`budget.spent()` 统计的是这一回合的全部 output token，嵌套子流程花的也一并算进去。
  - **落地**：估嵌套工作流成本时，记得把子流程也算上。见 [第 20 章](#/zh/p4-20)。

---

## C.10 一页纸总览（撕下来贴墙上）

```text
编排
  □ 多阶段 → pipeline（非 parallel 串联）
  □ parallel 只传 thunk
  □ meta 纯字面量 + 首行 export
  □ 并发块内 opts.phase 显式归组
  □ 脚本体只编排，副作用交给 agent

产物
  □ 关键产物用 schema 约束
  □ schema 不过严（enum 全、required 精）
  □ 复杂结构拆两阶段
  □ 跨 stage 用 (prev, orig, i) 取原始输入

观测
  □ 描述性 label
  □ 里程碑 log + 记录掉队
  □ 收好 taskId / runId（结果等通知）

成本
  □ 先估 token（≈ agent 数 × 2.5–3 万）
  □ 墙钟看关键路径，能并发就并发
  □ 简单任务用 haiku
  □ 尊重并发上限 / 1000 兜底

韧性
  □ 重要产出加对抗验证
  □ 降偏差用独立评委 + rubric + 计票
  □ 结果 .filter(Boolean)
  □ 循环有收敛条件 + 轮次上限
  □ budget.total && 守卫

迭代
  □ 落盘 .js，用 scriptPath 重跑
  □ 续传保持前段逐字不变（同会话、先 TaskStop）
  □ 禁 Date.now/Math.random（保可重放）

隔离/嵌套
  □ worktree 仅并行改文件冲突时用
  □ workflow() 嵌套仅一层
```

> 配套阅读：反向清单（坑与排错）见 [附录 B · 陷阱与排错](#/zh/app-b)；字段语义查 [附录 A · API 完整参考](#/zh/app-a)；术语查 [附录 D · 术语表](#/zh/app-d)。

> 继续阅读：[附录 D · 术语表](#/zh/app-d)
