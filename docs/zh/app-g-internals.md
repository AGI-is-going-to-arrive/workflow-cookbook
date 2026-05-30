# 附录 G · 原理揭秘：一个 workflow 在你机器上到底怎么跑（本机实测）

> 这是一篇**给好奇心的附录**。全书正文教你怎么写脚本，这一页给你看脚本跑起来之后你能真正*观察到*的东西。这里的每一条，要么是我们在本机（Claude Code **v2.1.156**）亲手测出来、能溯源到某个 Run ID，要么出自 Workflow 工具的运行时契约并会明确标注。没有一条来自逆向猜测。
>
> 先把话说在前面：Dynamic workflows 是官方的 **research preview（研究预览）**，下面这些内部细节可能随版本变化。请把这些 Run ID 当成 v2.1.156 的快照，而不是永恒真理。你自己的版本要是跟这页对不上，**以你实测的为准**。每个数字的出处见 [附录 E](#/zh/app-e)。

---

## G.0 这一页是什么，证据怎么读

本附录里的每条信息都带三种标签之一，你对每种标签的读法应该不一样。

<div class="callout info">

**[本机实测，v2.1.156 + Run ID]**：我们亲手跑出来、在真实 `<task-notification>` 里看到的东西。这个 Run ID 让你能在 `assets/transcripts/` 里把记录查出来。这是最强的一档。

**[工具契约]**：来自 Workflow 工具运行时契约的行为说明（Claude 写脚本时该工具注入的描述）。它对 API 形态有权威性，但它不是我们实测出来的数字。

**[第三方线索，未采信为真值]**：来自外部逆向工作的一条声称。本书**没有**把它当事实。它只出现在 [G.6](#g6-延伸阅读一条第三方线索)，而且只作为给好奇者的一个指针。

</div>

真值顺序和全书一致：官方文档与类型定义和本机 Run ID 实测同列，两者都在任何第三方资料之上（[附录 E](#/zh/app-e)）。这一页从不把第三方声称提升到正文里。能在这里复现的，就变成带 Run ID 的实测事实；不能复现的，就留在 G.6 并附上免责说明。

---

## G.1 你能真正看到的痕迹

概念上的生命周期（你写脚本、Claude 提交、子代理跑、结果回来）是 [第 1 章](#/zh/p1-01) 的活，这一页不重复。值得你上手摸的是另一头：一次 run 跑完之后，工作流留下的**两个产物**。

**脚本会落到磁盘上。**每次 Workflow 调用都会把它跑的那段脚本写到 `…/workflows/scripts/<name>-<runId>.js`。在产出这篇附录的会话里，我们看着这种文件出现了四个，一次 run 一个 **[本机实测]**。这个落盘文件就是脚本能被读、能被存、能事后重跑的根据。它也解释了为什么 cookbook 里的脚本是你复制的模板、而不是你已经装好的 `/命令`：测试时，这个项目里 `.claude/workflows/` 和 `~/.claude/workflows/` 都还不存在，因为没人按过 `s` 去保存 **[本机实测]**。

**结果会以 `<task-notification>` 回来。**一次 run 跑完，Claude Code 会往会话里注入一个通知块。你的主会话就是通过这一个通道拿到结果的，里面带着 [G.5](#g5-task-notification-里带了什么) 要拆开讲的用量和失败数字。侦察工作流 `wf_f8398424-dcd` 是个干净的例子：7 个 agent，一个真实通知报出 `agent_count=7 / subagent_tokens=1004658 / tool_uses=120 / duration_ms=1977272` **[本机实测]**。

所以一个工作流能被观察到的表面很小、很具体：一个你能打开的 `.js` 文件，加一个你能读的通知块。下面所有内容，都是我们跨多次 run 读这两样东西读出来的。

---

## G.2 一个工作流子代理内部长什么样

我们往一次真实 run 里塞了个探针 agent，让它自报运行时（Run `wf_b1d45b4c-445`，task `wr3d1ukk9`，1 个 agent / 30324 token）**[本机实测，v2.1.156]**。你的工作流里一个子代理实际拿到的东西是这样的。

**它能直接调的工具恰好七个。**`Bash`、`Edit`、`Read`、`Skill`、`ToolSearch`、`Write`、`StructuredOutput`。直接可调的就这一整套。

**`Grep` 和 `Glob` 完全不在。**它们既不能直接调，也不在 `ToolSearch` 后面待命，就是单纯没有。你的 agent 要搜代码，就走 `Bash`（比如把 `grep`/`rg` 当 shell 命令跑）或者直接读文件。这点比第三方仓库报的更精确：那边把 Grep/Glob 跟 deferred 工具混为一谈，而本机上它们是彻底缺席，真正 deferred 的是 `WebFetch`。

**Web、Task 族、所有 MCP 工具都 deferred 在 `ToolSearch` 后面。**`WebFetch`、`WebSearch`、`Task*` 族（`TaskCreate`/`TaskGet`/`TaskList`/`TaskStop`/`TaskUpdate`）、`SendMessage`，以及全部 `mcp__*` 工具，都只露出名字。agent 要调它们里的任何一个，得先跑 `ToolSearch` 把 schema 加载进来。所以一个工作流 agent 没法「开箱即用」一步够到 web 或 MCP 服务器，它得先把工具取过来。

**工作目录是你的仓库根，不是沙箱。**探针的 `cwd` 是 `/Users/yangjunjie/Desktop/workflow-cookbook`，也就是会话的仓库根。一个子代理跑在你所在的同一个目录里，对你的文件有真实读写权限。唯一能改变这点的是 `isolation:'worktree'`，它给每个 agent 一份用完即弃的独立检出（[第 19 章](#/zh/p4-19)）。

**文件编辑自动批准，不弹窗。**探针写了个 `/tmp/r13_probe_*.txt` 文件、回读、再用 `Bash rm` 删掉，三步全程没有审批弹窗 **[本机实测]**。这是对工具契约一条保证的第一手印证 **[工具契约]**：工作流子代理永远跑在 `acceptEdits` 下，跟你会话的权限模式无关，所以文件写入不会停下来问。反过来也来自契约：**不在**继承白名单上的工具（部分 shell 命令、web、MCP）仍可能在 run 中途弹窗。

**模型继承自你的会话。**探针报出 `claude-opus-4-8[1m]`，跟会话在跑的 Opus 4.8 一致，平台 `darwin`。子代理没暴露单独的 effort 等级。所以除非某个 `agent()` 调用显式覆盖了 `model`，你的 agent 就跑在你会话所用的那个模型上。

<div class="callout tip">

**这对你意味着什么。**开箱即用时，你工作流里的 agent 能在你的仓库里自由读写文件、能跑 shell 命令，但它没有专门的工具做模式搜索，也没法不先经过一次 `ToolSearch` 就够到 web 或 MCP 服务器。提示词照此设计：搜索就靠 `Bash`；如果一个 agent 确实需要 web 或某个 MCP 工具，就在提示词里写明，好让它知道要去取。

</div>

---

## G.3 失败语义，我们测过的三种情形

这是大家最容易搞错的一块，所以我们把三种失败形状都亲手测了（Run `wf_b1d45b4c-445` 和 `wf_b7c75d40-c26`）**[本机实测，v2.1.156]**。完整讲解在 [第 8 章](#/zh/p2-08)，这里给收紧后的实测真相。

| 什么出错 | 实测结果 | 通知佐证 |
|---|---|---|
| `parallel()` thunk 里的**异步 reject**（`Promise.reject`，或 `agent()` 内部出错） | 该槽位变 `null`；`parallel()` **不** reject；`.filter(Boolean)` 接得住 | `shape=["alpha","NULL","gamma"]`；`<failures>parallel[1] failed`；`callRejected:false` |
| 某个 `pipeline()` 阶段 **throw** | 该 item 变 `null`、跳过它剩下的阶段；兄弟项照常往下流 | `shape=["s2:s1:keep1","NULL","s2:s1:keep2"]`；`<failures>pipeline[1] failed` |
| `parallel()` thunk 里的**同步 throw** | `parallel()` **整体** reject；在 `await` 外套 `try/catch` 能接住、**run 存活**；`.filter(Boolean)` 帮不上（它根本拿不到数组） | `wf_b7c75d40-c26`：`{runSurvived:true, callRejected:true, caughtByTryCatch:true, error:"SYNC_THROW_PROBE"}` |

要记住的一句话：**异步错误会变成一个你能过滤掉的 `null`，同步 throw 会掀掉整个 `parallel()` 调用。**两者不是一回事，绊倒人的正是这个区别。

<div class="callout warn">

**本书携带的一条订正。**工具契约的措辞「抛错的 thunk 会 resolve 成 `null`，调用从不 reject」，只对**异步**错误成立 **[工具契约]**。对**同步** throw 不成立：我们实测到 `parallel()` 会整体 reject。所以别把「调用从不 reject」当绝对。覆盖所有情形的安全规则是：把有风险的逻辑塞进被 `await` 的 `agent()` 里，给 `await parallel(...)` 套一层 `try/catch`，用结果之前先 `.filter(Boolean)`。同步 throw 照样会 reject 那个调用，但 `try/catch` 让 run 活着；只有**没被接住**的 throw 才会中止它。

</div>

---

## G.4 断点续传与缓存，实测

我们把同一段脚本在同一个 Run ID 下连跑了三次，看缓存怎么动作（Run `wf_4248177d-c90`）**[本机实测，v2.1.156]**。从头到尾讲续传的是 [第 22 章](#/zh/p4-22)，这里给三次测量。

| 步骤 | 我们做了什么 | 结果 | 用量 |
|---|---|---|---|
| 初跑 | 3 段链式 agent | `a1/a2/a3 = STAGE-ONE/TWO/THREE-OK` | `agent_count=3`、`subagent_tokens=81765`、`duration=18658ms` |
| 原样 resume | 同脚本 + `resumeFromRunId` | 结果完全一致 | `agent_count=3`、`subagent_tokens=0`、`tool_uses=0`、`duration=1ms` |
| 改了 stage 2 再 resume | 把 stage 2 的提示标记从 `STAGE-TWO-OK` 改成 `STAGE-TWO-EDITED`，然后 resume | `a2` 返回**新**标记 `STAGE-TWO-EDITED`；`a1`/`a3` 不变 | `agent_count=3`、`subagent_tokens=54456`、`tool_uses=2`、`duration=9331ms` |

这坐实了两件事：

**同脚本、同 args，就是整链缓存命中。**原样 resume 在 1ms 内返回，`subagent_tokens=0`、`tool_uses=0`，什么都没真跑。（注意 `agent_count` 仍显示 3：它数的是逻辑 agent，不是重新执行了的 agent。见 [G.5](#g5-task-notification-里带了什么)。）

**改一个阶段，会重跑那个阶段和它之后的全部，这就是「最长未变前缀」规则。**我们改了 stage 2 之后，stage 1 保持命中缓存（0 token），stage 2 连同它下游的 stage 3 一起重跑了，哪怕 stage 3 的提示从没变过，只因为它排在改动点之后。token 的账也对得上：`81765 → 54456` 少了大约一个 agent 的量，正好是「跑了 3 个，再重跑 2 个」。而 `a2` 吐出新标记，是 stage 2 确实重新执行、而非回放缓存答案的直接证据。

---

## G.5 `<task-notification>` 里带了什么

[G.1](#g1-你能真正看到的痕迹) 提到的那个通知块，就是数字所在的地方。我们实测它带两个块 **[本机实测，v2.1.156]**。

**`<usage>` 块**报四个字段：`agent_count`、`subagent_tokens`、`tool_uses`、`duration_ms`。侦察 run `wf_f8398424-dcd` 是个完整例子（`agent_count=7 / subagent_tokens=1004658 / tool_uses=120 / duration_ms=1977272`）。

**`<failures>` 块**逐条列出按槽位的失败，一行一条，写作 `parallel[i] failed: …` 或 `pipeline[i] failed: …`。事后你就靠它分辨*哪个*槽位变成了 `null`，比如 [G.3](#g3-失败语义我们测过的三种情形) 表里那两行 `parallel[1] failed` 和 `pipeline[1] failed`。

<div class="callout tip">

**`agent_count` 数的是逻辑 agent，不是重新执行的 agent。**[G.4](#g4-断点续传与缓存实测) 里那次整链缓存命中的 resume，照样报 `agent_count=3`，可 `subagent_tokens=0`。所以别把 `agent_count` 读成「刚刚发生的工作量」。你想知道 agent 到底有没有真跑，去看 `subagent_tokens` 和 `duration_ms`。

</div>

---

## G.6 延伸阅读：一条第三方线索

有个外部仓库 **`claude-code-workflow-research`**，它通过本地代理抓取一次 v2.1.156 run 的流量、对其做了逆向。如果你想要一个数据包层面的视角，它值得一读。

<div class="callout warn">

**把它当线索读，不当真值来源。**它**非官方**、不隶属 Anthropic，且建立在一次抓到的 run 之上，而非运行时契约。本书**没有**采信它的声称为事实。我们只陈述能在本机第一手复现的内容，这些复现就是本附录里那些带 Run ID 的事实。凡它的声称和我们的不一致，以我们的为准，因为我们的是在这里实测的。

</div>

举个体现纪律的具体例子：那个仓库把 resume 的**缓存键哈希格式**报得像是已成定论。本书**不**把任何缓存键哈希格式当事实陈述，因为我们没在这里复现它。我们*确实*测了的是缓存*行为*：原样 resume 整链命中、改动后按最长未变前缀重跑（[G.4](#g4-断点续传与缓存实测)）。行为带着 Run ID 进了正文；哈希格式那条声称留在这里，标为未核实。这跟本书对待每一份第三方解读的态度一样（[附录 E · E.5](#/zh/app-e)）：借视角，不借权威。

---

> 这一页带你看的是机房，不是图纸。图纸是全书正文：这里的失败规则是 [第 8 章](#/zh/p2-08) 的，续传规则是 [第 22 章](#/zh/p4-22) 的，每个数字都溯源到 [附录 E](#/zh/app-e) 里的某个 Run ID。这些内部细节是 v2.1.156 的研究预览快照，**你的版本要是对不上，以你自己的 run 为准。**
