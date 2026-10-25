# 第一关精修与验收记录

日期：2026-10-25。范围只包含本目录的第一关；没有推送、部署或扩展关卡。工作期间其他会话产生的兵蜂/工蜂及忍者神龟内容未被本任务修改。

## 运行与操作

构建预览正在本机 `http://127.0.0.1:5175/` 运行。以后重新启动：

```bash
cd /Users/magicliang/Desktop/Programming/git/my-games/魂斗罗
npm run build
npm run preview -- --port 5175 --strictPort
```

默认经典、3 条命、无敌关闭。`A/D` 或左右移动，`J/Z` 点射，`K/空格/X` 跳跃，`S/↓` 伏地，`Esc` 暂停。M 可以按住连射。设置支持改键和触屏；高血量、无敌、30 命都会持续显示辅助标记。

玩法参数与完整操作见 [说明书](../说明书.md)，原版依据与证据边界见 [FC_REFERENCE.md](FC_REFERENCE.md)。

## 实际改动

| 范围 | 文件 | 完成行为 |
| --- | --- | --- |
| 控制、物理与生命 | `input.ts`、`engine.ts`、`movement.ts`、`terrain.ts`、`game.ts` | X/Y 战斗平面；方向射击、伏地、跳台与穿台、空中水平方向保留、游泳/潜水、落坑与屏内复活；单向镜头；固定步长和可暂停模拟时钟；失焦释放并暂停 |
| 战斗与关卡 | `combat.ts`、`effects.ts`、`stage.ts`、`runtime.ts` | 普通枪/M/F/S/L；R 为弹速强化，S 五发，L 贯穿且重射取消旧束；飞行/固定武器容器；真实坍塌桥；敌兵、旋转炮、堡垒抛射炮；核心可直接击破并清除守军 |
| 人物和场景 | `pixel-character.ts`、`models.ts`、`world.ts`、`types.ts` | 按用户修正换为原创 FC 风格像素人物，移除方块人体；六帧跑步、四帧翻滚、方向持枪、伏地、水中与死亡帧；继续由 Three.js 渲染；人物与地形碰撞共用战斗坐标 |
| 操作界面 | `ui.ts`、`index.html`、`style.css` | Mac 普通键盘、冲突检测和改键保存；触屏多指和取消释放；明确辅助标记、受击原因、暂停继续与重开；敌弹可辨、受击闪光支持减少动态效果 |

移除了鼠标锁敌、纵深绕行、独立 R 枪、强制堡垒护盾和仅有特效的假爆桥。没有增加依赖。人物使用一张有限图集和共享材质，不逐帧创建纹理。

## 验证证据

修改前先读取全部游戏模块、说明书、Git 状态并实际打开游戏。原有 5 个纯规则测试全部通过，但新增运行链路测试证明纵深移动、伏地、散弹、Boss 护盾和复活行为有差距。旧实现失败记录保存在 [baseline-regressions.txt](../tests/evidence/baseline-regressions.txt)，执行顺序见 [REFINEMENT_PLAN.md](REFINEMENT_PLAN.md)。

当前自动测试使用真实 Three.js 场景、角色、弹丸和运行更新链路；只替代 DOM 外壳、输入来源和音频输出。覆盖跳跃与落地/穿台、水中/桥梁、武器命中与槽位、拾取、死亡复活、暂停计时、镜头、Boss、失败及重新开始；输入测试另外覆盖失焦、隐藏、键位别名、改键、触屏取消和短按保留。

像素替换后额外核对了 16 组姿态/方向的可见枪口锚点与发射位置，以及最后一命死亡立即切帧、重新开始恢复站姿。伏地枪口描边越行问题也先写失败回归再修复。当前 `npm test` 为 **54/54 通过**。

像素版浏览器最终记录见 [browser-report.json](../tests/evidence/browser-report.json)：北京时间 22:20:27–22:26:34，Chromium 145.0.7632.6，**14 项检查全部通过，记录的错误为 0**。旧人物版本及未完成长测不计为当前版本通过。

主代理于 22:29 再次完整运行 [最终命令检查](../tests/evidence/final-checks.txt)：`npm test` 54/54、`npm run check` 32 文件、`npm run build`（含 TypeScript 检查）均退出 0。构建 JS 为 574.04kB、gzip 149.07kB，保留 Vite 的单包大于 500kB 提示；该提示不是构建失败。

| 验证 | 实际结果 |
| --- | --- |
| 键盘与实际战斗链路 | 改键冲突/持久化，平台上穿落地与下落，暂停 2.2 秒保护时间不变，blur 释放，敌军接触死亡复活，活守卫情况下击破核心并重开，全部通过 |
| 全部武器 | 浏览器通过真实 J 键发射；普通枪、M、F、S、L 均实际击中场景目标。单项测试使用明确的目标/武器场景准备 |
| 触屏 | Chromium 多点触控模拟中，移动/跳跃/射击三指同时生效，拖出与取消释放，844×390 横屏和 390×844 竖屏暂停/继续均通过 |
| 整关与长测 | 无敌辅助下，从起点到核心击破 35.944 秒；15 段桥破坏，3 条命保持。随后连续真实时间 300.082 秒，8 次重开，累计 9 次通关；未传送、未加速模拟，死亡/救援断言未触发 |
| 正式构建 | `http://127.0.0.1:5175/?test=1` 中 canvas 存在且 `window.__contra`、`#debug-state` 不存在；主代理在内置浏览器另外操作了 D/K/J/Esc 并检查画面 |

人物截图：[游戏画面](../tests/evidence/pixel-gameplay-preview.png)、[姿态对照](../tests/evidence/browser-character-pose-board.png)、[实际伏地](../tests/evidence/browser-character-prone.png)。角色截图中的无敌和清除敌人只用于稳定观察造型，不作为无辅助通关证据。

## 浏览器与性能

浏览器测试代码为 [browser-smoke.mjs](../tests/browser-smoke.mjs)，使用已有 Playwright 运行时，不向游戏添加依赖。开发服务器需要 `?test=1`，正式构建不开放测试控制对象。

```bash
npm run dev -- --port 5173 --strictPort
```

另一个终端执行：

```bash
SOAK_SECONDS=300 node tests/browser-smoke.mjs
```

若环境未在当前项目安装 Playwright，可设置 `PLAYWRIGHT_MODULE` 为已有安装的 `playwright/index.js` 绝对路径，`CHROMIUM_EXECUTABLE` 为该环境已有 Chromium 可执行文件。`BASE_URL` 可覆盖测试地址，`REPORT_NAME` 可保留不同批次报告。默认不指定 `SOAK_SECONDS` 时只跑 30 秒，不能当作本次要求的 5 分钟验证。

本机本次使用的复现命令：

```bash
PLAYWRIGHT_MODULE=/Users/magicliang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.js \
CHROMIUM_EXECUTABLE=/Users/magicliang/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell \
SOAK_SECONDS=300 node tests/browser-smoke.mjs
```

测试场景显式区分：单项跳台、武器、死亡和低血量 Boss 使用可重复的场景准备，再通过浏览器键盘操作；整关从起点开始，不传送、不调用模拟加速，只读取状态并发送键盘/按钮输入，界面明确开启无敌辅助。触屏为 Chromium CDP 多点触控模拟，不是实体手机实测。失焦自动化为浏览器中派发 blur 事件，不冒称 OS 层切窗。

保留 [第一次长测失败记录](../tests/evidence/browser-soak-attempt1.json)：最后有效采样为 231 秒，其后落坑断言失败；精确失败结束时刻未记录。驱动在 X=120.91、距边缘只有 0.09 单位时才发跳跃指令，同时仍按住右移。修正为先停稳再键盘起跳，保留“不能死亡/救援”的断言。没有借此扩大游戏跳跃距离、加宽地面或添加容错跳跃。后续被用户人物造型修改打断的验证，也不计为通过。

性能指标记录的是最近 600 个有效帧窗口；帧间隔统计排除了 ≥200ms 的帧，`renderMsMean` 是 CPU 提交渲染耗时，不是 GPU 时间。`renderer.info` 只反映 Three.js 跟踪的资源；不能由此宣称稳定 60 FPS 或不存在 JavaScript 堆泄漏。像素图集共 214 个有限姿态几何帧和一张 768×672 纹理，几何数量会随第一次显示新动作惰性增加，需要与反复重开持续创建资源区分。

300 秒长测的采样窗口：P50 帧间隔 16.6–40.8ms、P95 25.1–109ms，CPU 提交均值 0.250–0.475ms，绘制调用 40–71。确有帧间隔波动，没有把此结果描述成稳定 60 FPS。8 次重开时几何数为 89、90、92、92、92、92、92、92，纹理数为 3、4、4、4、4、4、4、4：本轮观察到有限资源预热后趋稳。

独立同配置 Chromium 进程的 [环境与 rAF 对照报告](../tests/evidence/browser-performance-environment.json) 确认 WebGL 使用 **ANGLE/Vulkan SwiftShader 软件渲染**，不是 Mac 硬件 GPU。各采样 10 秒且保留全部原始帧间隔：空白页 P50/P95/最大值为 8.3/9.2/10.4ms；实际按 D 移动的游戏页为 16.7/25.5/100.8ms。这个对照支持“软件渲染环境有额外开销和帧波动”，不能归因于单一游戏函数，也不能推断实体手机或 Mac 硬件 GPU 的帧率。本轮没有据此加入未经硬件测量的画质降级。

## 仍需原版校准的差距

| 项目 | 本次界限 |
| --- | --- |
| 原版时序 | 跑速、跳跃曲线、无敌帧、弹速/冷却/屏上限额、F 旋转参数、L 分段与伤害仍是项目调校值，不是已证明的 FC ROM 常量 |
| 第一关编排 | 地形比例、敌群坐标与生成、炮台开闭时序、补给出现位置和 B 时长需进一步逐帧比对；当前可完整游玩的第一关仍是本项目编排 |
| 原版证据 | 已查看 FC 说明书扫描与原游戏录像；录像没有证明使用原厂实体 FC。已找到的兼容硬件录像在本环境无法播放，不作为已观看证据 |
| 运行范围 | 完成范围以实际报告为准；无实体手机、Safari 硬件或经典无辅助整关通关证明。构建仍有大于 500kB 的单包提示，未通过隐藏告警来伪装通过 |

人物为新绘制的像素图集，场景与音效为项目实现，没有拷入原版 ROM、角色贴图、原音乐或反汇编代码。
