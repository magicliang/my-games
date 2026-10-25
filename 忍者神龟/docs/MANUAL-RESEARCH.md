# 原版说明书核验记录

核验日期：2026-10-25。基准选择 **NES 北美版 TMNT III: The Manhattan Project，NES-T3-USA，©1992 Konami**。日版 FC 作品通常以 TMNT II: The Manhattan Project 标示；本实现不把两地区的命数、分数阈值和双人选项默认为相同。不是《Turtles in Time》、街机版或 DOS《Manhattan Missions》。

## 实际读取的材料

- **M1 原版扫描**：[Digital Press，10个双页扫描页 PDF](https://www.digitpress.com/library/manuals/nes/Teenage%20Mutant%20Ninja%20Turtles%20III%20-%20The%20Manhattan%20Project.pdf)。下载到临时目录并用 `pdftoppm` 渲染，实际目视 PDF 第1、3–9页；覆盖封面/背面、印刷页4–17。未在游戏目录分发扫描图。
- **M2 转录交叉检查**：[World of Nintendo 手册转录](https://world-of-nintendo.com/manuals/nes/teenage_m_ninja_turtles_3.shtml)。关键规则均回到 M1 图像核对，未仅依赖搜索摘要。
- **P1 参数测量报告**：[MetHy Character Guide，2021-02-11](https://gamefaqs.gamespot.com/nes/563469-teenage-mutant-ninja-turtles-iii-the-manhattan-project/faqs/79064)。作者明确记录使用 FCEUX debugger 与实测。属于可追溯第三方测量，**本项目没有取得 ROM 或独立复测这些内部数值**。

## M1 明确支持的规则

| 印刷页 / PDF页 | 核实事实 |
| --- | --- |
| 封面 / 1 | `NES-T3-USA`；背封 ©1992 |
| 5 / 3 | 双人A允许友伤，双人B关闭友伤；有剩余命时2P可按A加入 |
| 6 / 4 | 两人不能同龟；总计4命（双人各4）；每25,000分加命；披萨恢复能量；过关有剩余时间奖励 |
| 7 / 4 | 丢命可重新选龟且保留分数；耗尽可借同伴命；最多续关3次，从当前关开头重来 |
| 9 / 5 | B攻击，A跳，空中B飞踢，↓+B戳击并投掷；被咬/抱住时连按挣脱；Start暂停 |
| 10 / 6 | A+B发动独有必杀，消耗1能量单位；仅剩1单位时不扣除 |
| 10 / 6 | Leo旋剑、Mikey袋鼠踢、Don翻滚、Raph钻头冲刺 |
| 11–13 / 6–7 | 八关依次海滩、冲浪/战舰、桥、街区/地铁、下水道、Technodrome、升降平台/屋顶、Krang飞船 |
| 14–16 / 8–9 | 列出各Boss及Foot Soldier、Mouser、Stone Warrior，不提供精确AI帧表 |

## P1 参数候选：有出处，但未独立校准

内部像素/帧并非渲染画布的放大像素。实现若放大坐标，应等比换算。

| 角色 | 普攻前伸 px | 周期 frame | 命中 tick | 必杀伤害 |
| --- | ---: | ---: | ---: | ---: |
| Leonardo | 28 | 19 | 3 | 8 |
| Raphael | 24 | 16 | 3 | 7 |
| Michelangelo | 24 | 21 | 5 | 11 |
| Donatello | 32 | 20 | 3 | 9 |

P1还报告：普攻/投掷基础伤害3，飞踢2；投掷前伸24、周期23；Leo必杀可能二次命中。不能据此给四人任意添加不同步行速度或“第三段连击加倍”。手册没有三段连击说明，连续普攻应先作为攻击周期重复，而非杜撰组合招。

P1 Boss HP 候选：Rocksteady 64；Groundchuck 128；Slash 64；Bebop 160；Dirtbag 160；蓝Mother Mouser 80；Leatherhead 192；Rahzar 192；Shredder 256；Tokka 208；红Mother Mouser 112；Krang总336；Super Shredder 448。Groundchuck低于96拿管，Leatherhead低于64切换冲刺抓取。以上保持“第三方报告”标签，不能说成项目自行验证的事实。

## 冲突和未确定项

部分网络攻略把A/B友伤模式写反、把奖励命阈值写作50,000。扫描原手册确实写A有友伤、B无友伤及25,000；这不是转录错误。这里优先按指定美版手册实现，同时保留“需以同版本实机对照解决”的标记，不能把说明书描述自动当作程序实际行为。

手册没有说明：完整HP内部表示、移动速度、纵深容差、垂直攻击区间、普通攻击精确有效帧、击退距离、硬直/无敌帧、敌人刷新坐标与全部AI周期、每种道具的精确恢复量。项目使用的暂定值必须集中标明为调校参数。P1提供的数值也不替代同版本录像/逐帧对照。本地自动测试只能证明自己的实现符合自己的规则。
