# 工蜂 3D 设计系统

## 0. Research Log

- 原版资料: Nintendo 官方页、3D Classics 截图、FC 版五关攻略与 Boss 列表。实现以 FC/3DS 单人版本为准。
- Embedded refs: shortlisted Figma, Airtable, Lovable -> picked `taste-skill` + Figma。采用彩色内容、单色外框、虚线焦点，不复制品牌素材。
- UI database: query `retro cute em up arcade shooter colorful pixel` -> Pixel Art、深色外框、红蓝绿高对比、复古等宽字。
- Lazyweb: skipped。原游戏截图比现代产品界面更接近目标视觉合同。
- Imagen drafts: skipped。目标是复刻既有游戏关卡，不生成可能偏离原作的新概念图。

## 1. Atmosphere & Identity

一台放在书桌上的彩色街机。游戏区域明亮、可爱、节奏快，外框像黑色掌机。标志性视觉是真实低多边形云层、铃铛和飞行器；透视相机、网格法线与深度缓冲共同表达高度。

Design read: 面向怀旧玩家和第一次接触者的单页街机游戏，采用 8-bit 可爱射击语言，使用原生 WebGL2、透明 HUD Canvas、CSS 和系统字体。

- DESIGN_VARIANCE: 5。游戏区居中稳定，说明书在桌面端偏置排列。
- MOTION_INTENSITY: 8。滚屏、敌群、弹道和 Boss 都是玩法反馈。
- VISUAL_DENSITY: 7。HUD 信息完整，但菜单只保留开始、声音和说明。

## 2. Color

| Role | Token | Value | Usage |
|---|---|---|---|
| Shell | `--shell` | `#101827` | 页面与掌机外壳 |
| Shell raised | `--shell-raised` | `#18243a` | 面板和按钮 |
| Screen sky | `--sky` | `#68c7f4` | 主游戏天空/海面 |
| Land | `--land` | `#62b85a` | 岛屿与陆地 |
| Text | `--text` | `#f8fbff` | 主文字 |
| Text dark | `--text-dark` | `#13213a` | 明亮面文字 |
| Player blue | `--player` | `#2f7fe5` | 玩家机体 |
| Accent yellow | `--accent` | `#ffd447` | 铃铛、焦点与主操作 |
| Enemy red | `--danger` | `#e5484d` | 敌机、受伤提示 |
| Success green | `--success` | `#37c978` | 通关与强化 |
| Border | `--border` | `#edf6ff` | 外框和高对比分隔 |

规则:

- 页面外框保持深色，色彩主要出现在游戏内容里。
- 强化效果同时使用形状、文字和颜色，不依赖颜色单独传达。
- Canvas 中的派生色来自上述角色颜色的亮暗变化。

## 3. Typography

| Level | Size | Weight | Line height | Usage |
|---|---:|---:|---:|---|
| Display | `clamp(2rem, 6vw, 4rem)` | 900 | 1 | 游戏标题 |
| H1 | `2rem` | 800 | 1.15 | 说明书标题 |
| H2 | `1.25rem` | 800 | 1.3 | 说明小节 |
| Body | `1rem` | 500 | 1.6 | 默认说明 |
| HUD | `0.875rem` | 800 | 1 | 分数与状态 |
| Caption | `0.75rem` | 700 | 1.35 | 按键提示 |

- Display/Mono: `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`。
- Body: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`。
- 不加载网络字体，双击 `index.html` 也能完整运行。

## 4. Spacing & Layout

- Base unit: 4px。
- Tokens: `--s1: 4px`, `--s2: 8px`, `--s3: 12px`, `--s4: 16px`, `--s6: 24px`, `--s8: 32px`。
- 游戏逻辑画布: 480 x 720，CSS 等比缩放。
- 桌面: 游戏区和说明提示双栏；窄屏: 单栏，触控区固定在画布下部。
- Breakpoints: 560px、900px、1200px。

## 5. Components

### Arcade Shell

- Structure: header + HUD + WebGL world canvas + transparent HUD canvas + touch controls + status region。
- States: ready, playing, paused, stage-clear, game-over, victory。
- Accessibility: Canvas 有替代说明，动态状态通过 `aria-live` 播报。
- Motion: 状态面板只用 opacity 和 transform；减少动态时关闭装饰倾斜。

### Arcade Button

- Variants: primary, secondary, round fire, round bomb。
- States: default, hover, active, focus-visible, disabled。
- Focus: 3px 虚线 `--accent`，延续选择框语言。
- Touch target: 最小 48 x 48px。

### HUD Readout

- Structure: score, stage, lives, arms, active power。
- States: normal, warning, flashing damage。
- Accessibility: 每个值有文字标签，不只显示图标。

### Instruction Panel

- Structure: quick start, controls, power-ups, five stages, troubleshooting。
- Layout: stacked sections，桌面端与游戏并排。
- Accessibility: 语义标题、列表和键盘按键标记。

### WebGL World

- Camera: 42° 透视投影，从后上方俯视固定战斗平面；机体移动带来轻微相机追踪。
- Geometry: 海面、岛屿、云、敌机、子弹和 Boss 均由三角网格组成，不使用 2D 阴影伪装体积。
- Lighting: 单向主光 + 环境光；法线着色形成可见明暗面，深度测试处理遮挡。
- Layering: WebGL 世界在下，透明 2D Canvas 只绘制 Boss 血条与关卡标题。

## 6. Motion & Interaction

| Type | Duration | Curve | Usage |
|---|---:|---|---|
| Press | 100ms | ease-out | 按钮按压 |
| Panel | 220ms | ease-in-out | 菜单开合 |
| Stage title | 480ms | `cubic-bezier(.16,1,.3,1)` | 关卡开始 |
| Gameplay | frame loop | fixed-step | 滚屏、敌群与弹道 |

- 主动画由 `requestAnimationFrame` 驱动，同时更新 WebGL 世界与透明 HUD Canvas，不触发 DOM 重排。
- 页面按钮只使用 transform、opacity 和颜色过渡。
- `prefers-reduced-motion` 时关闭相机追踪缓动、外壳倾斜、菜单滑入和装饰闪烁；游戏必要运动保留。
- Canvas 指针拖动控制位置；键盘和触摸按钮是等价输入路径。

## 7. Depth & Surface

Strategy: real 3D world + 2D interface。

- 页面外框使用两级阴影表现掌机厚度。
- WebGL 世界使用透视矩阵、深度缓冲和真实三角网格，不以缩放或阴影冒充 3D。
- 云层、铃铛、飞行器具有不同世界坐标高度；光照由网格法线计算。
- HUD 使用高对比边框，不叠加玻璃模糊。

## 8. Accessibility Constraints & Accepted Debt

### Constraints

- Target: WCAG 2.2 AA for all DOM controls and instructions。
- Keyboard: 可完成开始、移动、射击、投弹、暂停和重开。
- Touch: 关键按钮至少 48px，支持多点触控。
- Motion: 支持 `prefers-reduced-motion`，不使用快速全屏闪白。
- Zoom: 页面支持 200% 缩放，说明文字不被裁剪。

### Accepted Debt

| Item | Location | Why accepted | Exit |
|---|---|---|---|
| Canvas 内敌人与弹幕无法逐个被屏幕阅读器描述 | `game.js` | 高频实时内容逐项播报会阻断游戏；关键状态通过 `aria-live` 提供 | 若未来加入无障碍慢速模式，再提供事件摘要 |
| 原版精确像素、音轨和商标素材未复制 | 全项目 | 避免分发受版权保护素材；使用原创程序绘制和合成音效 | 用户提供有权使用的素材后替换 |
| 需要 WebGL2 浏览器 | `webgl-renderer.js` | 真 3D 必须使用 GPU 深度缓冲和着色器；现代桌面与移动浏览器均已覆盖 | 若需兼容旧设备，再加入明确标注的低保真模式 |
