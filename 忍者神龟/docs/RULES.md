# 原版规则 → 实现位置 → 验证方法 → 未确定参数

基准为 **北美 NES-T3-USA，1992《TMNT III: The Manhattan Project》**。这里的“已实现”是本项目中的规则；“有来源”也不等于已经独立测出原版参数。日本 FC 同作编号 II，未承诺日版地区差异一致。

## 依据与证据等级

| 标记 | 资料 | 本次实际取证 |
| --- | --- | --- |
| M | [Konami 原版说明书扫描](https://www.digitpress.com/library/manuals/nes/Teenage%20Mutant%20Ninja%20Turtles%20III%20-%20The%20Manhattan%20Project.pdf) | 目视核对封面/背封、印刷 p4–17；[逐项记录](MANUAL-RESEARCH.md) |
| V | [美版完整路线实机录像，64:26](https://www.bilibili.com/video/BV1Ak4y1G7Vy/) | 八关/主要 Boss/结局关键片段；不是连续全片观看、不是逐帧量测 |
| C | [双人完整 Longplay，Mutch Games](https://www.youtube.com/watch?v=uH4rnL1DW2M) | 作者版本说明与章节时间，播放器连接失败，没有冒称亲见视频 |
| G | [Tarrun 玩家攻略](https://gamefaqs.gamespot.com/nes/563469-teenage-mutant-ninja-turtles-iii-the-manhattan-project/faqs/37924) | 场景与 Boss 行为的文字交叉证据；[录像分层记录](LONGPLAY-RESEARCH.md) |
| P | [MetHy 调试与实测报告，2021](https://gamefaqs.gamespot.com/nes/563469-teenage-mutant-ninja-turtles-iii-the-manhattan-project/faqs/79064) | 可追溯第三方参数，不是本项目自己运行 FCEUX 测量所得 |

测试证据标记：**N** 为 Node 模拟/输入回归，**B** 为真实浏览器集成，**H** 为浏览器直接键盘/鼠标操作。它们都不替代 M/V/P 的原版依据。

## 操作、人物和生存

| 原版规则 / 依据 | 实现位置 | 验证方法 | 未确定参数或明确差距 |
| --- | --- | --- | --- |
| 四龟不同武器、各自必杀（M p10）；普攻范围、周期有差异（P） | `src/content.js: CHARACTERS`，`core.js: updatePlayerAttack` | N 同距离 Don 命中/Raph 不命中；逐角色必杀轨迹和代价 | 武器空间放大×3属于本地映射；未逐帧视频校准 |
| 普攻按 B；连续出招（M p9/P） | `updatePlayer`、`startPlayerAttack` | N 有效帧前后和长按不自动连击；B 键盘攻击造成实际掉血 | 连按末段缓冲 6–7 帧是重建；没有编造三段加伤 |
| A 跳、空中 B 飞踢（M p9） | `jumpPhysics`、`moveDuringAirAttack`、`canHit` | N 高度、纵深、落地；B 起跳后攻击 | 跳跃速度、重力、空中控制和踢击高度尚未测量 |
| ↓+B 挑投（M p9） | `playerStrike`、`updateThrown` | N 抛向后方、身体撞敌、不同高度不误伤 | 抛体速度/高度、不可投敌种和连锁伤害待原版核准 |
| A+B 独有必杀、消耗1能量、最后1不扣（M p10） | `startPlayerAttack`、`updatePlayerAttack` | N 四角色/最后1单位/同时按键；B 独立键 | 特效姿态与时序重建；按键同帧/近帧判定尚未实机测量 |
| 地面位置与腾空图像分离（V） | `canHit`：x 朝向、y 纵深、z 高度三重门槛；`renderer.js` 只读投影 | N 同屏投影重合但不同地面纵深不得命中；不同 z 区间不得命中 | 原作碰撞体、深度容差、背后覆盖范围未量测 |
| 受击/击退/短暂无敌（V/G） | `damagePlayer`、`damageEnemy` | N 单次受击、连续接触、硬直、复活保护 | 22帧硬直、88帧保护、150帧复活保护等均为重建值 |
| 被 Foot 抱住或 Mouser 咬住，连按挣脱（M p9） | `minionAttack`、`updatePlayer`、`damageEnemy` | N 按键挣脱/同伴解围；H 实际进入抓住状态 | 按键次数、抓取概率和咬伤频率重建 |
| 4条总命；每25,000分奖励（M p6） | `makePlayer`、`damagePlayer`、`addScore` | N 死亡扣命、得分奖励、借命守恒 | 部分攻略写50,000，尚未用同版本实机解决矛盾；按手册实现 |
| 死亡后 SELECT，可换龟且保留分数（M p7/V 59:45） | `selectCharacter`、`respawn`、`app.js` 角色卡 | N 改角色再复活；B 跳跃键复活 | 等待70帧为重建；UI为可读性做现代化选择 |
| 双人不能同龟；借命/中途加入（M p5–7） | `join`、`selectCharacter`、`respawn` | N 双人角色唯一性与借命；B 双人实际输入 | 中途加入按网页“2P加入”；未复刻原手柄A键入局流程 |
| 双人A有友伤、B无友伤（M p5） | `state.friendlyFire`、`playerStrike` | N/B 两种模式对同伴攻击 | 网络二手材料与手册相反，按扫描手册实现；待实机核准 |
| 三次 Continue，回本关起点且保留分数（M p7） | `continueGame`、`loadStage` | N 三次限制、关卡位置、分数；B Continue路径 | 当前倒计时是重建值 |
| 披萨回复能量，关末时间奖励（M p6/V） | `updatePickups`、`updateProgress` | N 披萨拾取、道具高度、加分 | 整份披萨按全恢复，掉落位置与数量重建 |
| Pause（M p9） | `setPaused`、`app.js` 固定步长循环 | N 全状态冻结；B/H Esc 暂停/继续 | 失焦清理是浏览器版新增保障 |
| Mac普通键盘、触屏、改键、模式 | `input.js`、`app.js`、`styles.css` | N 14键冲突/多点输入；B 改键保存；H 窄屏触屏按钮 | 新增可用性功能。高血量/无敌不冒称原版模式 |

## 关卡、敌人与 Boss

`content.js: STAGES` 按 M p11–13 的顺序组成八关；出生编队有左右夹击、沙地/闸门/井口/空降/列车等标记。`core.js: spawnWave / updateProgress` 实施清敌锁屏、推进、Boss 与关卡转换。N 流程测试在显式无敌模式下，通过普通输入完成八关和13次 Boss 遭遇；这不证明波次、长度或时间轴与原作相同。

| 原作关卡 / Boss 行为线索 | 实现位置 | 验证 | 仍需核准 |
| --- | --- | --- | --- |
| 海滩/木栈道、沙中敌人/坑洞；Rocksteady枪与冲刺、录像中持枪腾空（M/V/G） | stage0；`updateHazards`；Boss gun/jumpGun/charge | N 四龟经典首关、独立跳跃z/枪口高度/落地；H 首波战斗 | 高跳弧线、空中射击及其触发时序是根据单个腾空检查帧重建；沙地刷新/栈道缺口也未标定 |
| 海面/甲板、水雷/炮台；Groundchuck冲锋后持管（M/V/G/P） | stage1；surfer/turret；Boss charge/pipe | N HP96切阶段、场景危险、冲浪段清敌后自动卷屏和全流程 | 当前清敌间隔卷屏不等于已核实原版持续卷屏；冲浪敌刷新/撞墙时序未逐帧复核 |
| 断桥；Slash跃刺/旋壳；Bebop链锤（V/G） | stage2；jumpSlash/shellSpin/mace/kick | N Boss状态与全部流程 | 卡车时序、断桥地形、链锤轨迹重建 |
| 街道/地铁、井口/滚桶；Dirtbag激光/镐（M/V/G） | stage3；helmetLaser/pickWarn/pickaxe | N 危险物和Boss | 未重现所有街区分段/列车碰撞与原版敌布阵 |
| 下水道；Mother Mouser放小机器/火；Leatherhead枪/尾/抓（V/G/P） | stage4；spawn/fireballs/shotgun/tail/rushGrab | N 母体召唤上限、低HP阶段、抓取 | 水流、窄桥拓扑、弹幕间隔仍为重建 |
| Technodrome；Rahzar冰息；Shredder剑/跳踢/抓（M/V/G） | stage5；iceBreath/leapClaw/sword/jumpKick/grab | N 冰冻后恢复动作、Boss流程 | 原版生产线、障碍完整布局及救April剧情未重做 |
| 升降平台/屋顶；Tokka盾/冲/咬/电牌（M/V/G） | stage6；guard/rushPunch/bite/electricSign | N 盾挡飞踢、抓握→抛体→固定电牌落地受伤、无远程电弹；升降段自动推进 | 16帧抓握/40帧抛投/伤害、盾的完整覆盖规则、电牌触发距离和平台推进时序待核准 |
| 飞船红Mother再战、Krang分阶段、最终Super（G/P，V部分） | stage7；Krang上下体独立移动/共享HP/通电防御；Super teleport/transformBeam/lightning | N 分体命中/共享无敌帧/单次计分、通电无伤、变龟恢复/最终胜利；B 全部渲染 | Krang分体上身锤击尚缺；阶段/血量来自第三方报告，循环/合体时机和瞬移坐标未逐帧核准 |

普通敌人覆盖 Foot 的近战/剑/枪/鞭/投刃/飞镖/回旋镖、滚桶兵、电兵配对、冲浪兵、Mouser、石兵、机械兵、炮台、飞行机器人等；`ENEMY_TYPES` 的20类并不等于原版完整敌谱。其生命、速度、追踪范围、得分和出手间隔多数为重建值。飞行敌需要跳踢、投射物高度也参与碰撞。

## 集中登记的待校准参数

| 参数组 | 当前实现如何定位 | 怎样取得原版一致性证据 |
| --- | --- | --- |
| 最大HP/伤害单位 | `RULES.maxHp=8/highHp=32`；普通伤3/飞踢2/必杀伤害引用P | 固定版本的 HUD 像素与内部单位对照；不能从扫描小格直接推内部HP |
| 速度、重力、命中框、硬直/i-frame | `RULES`、`canHit`、`damagePlayer/Enemy` | 录像逐帧：脚底坐标、离地帧、有效帧、首次可再次受击帧 |
| 敌人与Boss AI | `ENEMY_TYPES`、`chooseBossPattern/updateBoss` | 每Boss完整多轮录像，区分固定循环/距离触发/随机分支与1P/2P差异 |
| 地图与编队 | `STAGES.waves/hazards/props/sections` | 全流程逐波登记触发点、刷敌数量/坐标、卷屏距离、机关窗口 |
| 视觉/音频 | `renderer.js`、`app.js: playTone` | 本项目原创表现，主动不追求原版素材像素/音色一致；改成3D也须沿用同一模拟 |

## 验收边界

已完成的是有证据索引、可从第一关到结局的独立重建实现。尚未完成的是**同版本逐帧标定、全部原版布阵复刻和所有敌人细节**。这些是交付差距，不是被本地测试抵消的项目。浏览器中的高血量/无敌须显式选择；自动测试使用无敌通全关时也应明确注明。
