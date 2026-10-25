# 输入与操作界面修复

## 修改前

`input.ts` 只监听 keyup，不响应 blur / visibilitychange；触屏不捕获 pointer、不区分触点；鼠标左键全局触发射击；没有键位配置。`ui.ts` 重新开始通过页面 reload，暂停无触屏恢复入口。

## 回归与实现顺序

1. 用原生 EventTarget 构造轻量 DOM 测试环境，直接派发键盘/指针/失焦事件到实际 Input 实例。先运行并保留旧实现失败结论。
2. 为每个物理键与触点独立登记来源；失焦/隐藏统一释放；弹窗与表单事件隔离；增加无冲突自定义键位、恢复默认和本地持久化容错。
3. 界面接入 classic/high-health 与独立 invincible 默认关闭，HUD持久标识；显示绑定、说明、触屏暂停/继续和回调式重新开始。
4. 跑输入单测与指定文件静态检查；全工程与浏览器验收由主代理集成进行。

## 测试证据

- 2026-10-25 21:35（Asia/Shanghai）：旧实现运行 `npm test -- tests/input.test.ts`，12/12 失败；包含 hidden 后 held=1（预期0）、鼠标误射、触点无capture等行为失败，以及新增生命周期/改键接口缺失。
- 21:40：同一测试 12/12 通过；`npx biome check src/game/input.ts src/game/ui.ts src/style.css index.html tests/input.test.ts` 通过，`git diff --check` 通过。
- 无新增依赖。输入回归派发真实 EventTarget 事件，但该轻量 DOM 不是浏览器 WebGL 验收；真实键盘/触屏及整关链路由主代理另外执行。

## 接口约定

- `new Input()`；`Control.up/down/left/right/jump/fire/pause`。
- `setBindings(partial)` 接收动作到键码数组，例如 `{fire: ['KeyF']}`；冲突先验证，失败不改变现有设置；`getBindings()` 返回拷贝。
- 每个键与pointer独立计数；blur/hidden清空所有held、pressed及触点并调用 `onDeactivate`；重复keydown不会重启已释放动作。
- `createUi().bindInput(input)` 接入改键；`onStart/onRestart/onPause/onResume` 回调不reload；`readOptions()` 读取本次行动选项。
- 21:42 追加触点取消回归，先复现 `pointercancel` 后仍有一次幽灵跳跃（12通过/1失败），修正取消/丢失capture时丢弃该触点的待处理按下事件；随后 13/13 通过。普通 pointerup 仍保留短按事件，避免漏掉点按。
- 标题页所有方向/射击/跳跃键说明随自定义绑定更新，不保留错误的固定 WASD 提示。
