# 工蜂 3D

一个可直接在浏览器运行的五关纵向射击游戏。玩法和关卡顺序参考《3D Classics TwinBee / 兵蜂》，世界使用原生 WebGL2 三角网格、透视相机、动态光照和深度缓冲渲染；画面与声音全部由程序原创生成，不包含原版素材。

## 开始游戏

1. 直接双击 `index.html`。
2. 点击“开始游戏”。

需要支持 WebGL2 的现代浏览器。游戏操作保持原版式俯视战斗平面，但画面是由 GPU 渲染的真实 3D 场景，不是 2D Canvas 阴影模拟。

如果浏览器限制本地文件，可在本目录运行：

```bash
python3 -m http.server 4173
```

然后打开 `http://127.0.0.1:4173`。

## 操作

| 动作 | 键盘 | 触屏 / 鼠标 |
|---|---|---|
| 移动 | WASD 或方向键 | 方向按钮，或在画面上拖动 |
| 空中射击 | J、Z 或空格 | A 射击 |
| 地面炸弹 | K、X 或 C | B 炸弹 |
| 暂停 | P 或 Esc | 顶部“暂停” |

## 核心玩法

- 射击云朵会掉出铃铛，继续射击铃铛可依次变为黄、蓝、白、绿、红。
- 蓝铃加速，白铃开启双炮，绿铃产生分身，红铃产生护盾；黄色铃铛加分。
- 炸弹攻击地面炮台。机体左右手臂可分别受损，两臂都丢失后救护机会出现一次。
- 五关依次迎战洋葱头、平行飞碟、虎鲨舰、巨钳装置和香料王。

## 关卡复刻范围

实现保留了原版五关主题、敌群出场顺序、Boss 顺序、云朵铃铛、空中射击、地面炸弹、手臂受损和救护机等关键结构。为适合网页单局游玩，敌群节奏经过压缩；视觉改为原创低多边形 3D，像素画、商标和音轨没有复制。

参考资料：

- [Nintendo 3D Classics TwinBee](https://www.nintendo.com/jp/titles/50010000007144.html)
- [Nintendo Virtual Console TwinBee](https://www.nintendo.co.jp/wii/vc/vc_twb/vc_twb_01.html)
- [TwinBee 五关攻略](https://gamefaqs.gamespot.com/nes/578272-twinbee/faqs/19125)
- [TwinBee 玩法机制](https://shmups.wiki/library/TwinBee)

## 自检

```bash
npm run check
```

项目没有第三方运行依赖，也不需要安装步骤。
