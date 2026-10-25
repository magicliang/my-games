/**
 * Source facts and reconstruction choices are deliberately separate.
 * M: NES-T3-USA manual pp. 5–10; C: MetHy (2021), Character Guide:
 * https://gamefaqs.gamespot.com/nes/563469-teenage-mutant-ninja-turtles-iii-the-manhattan-project/faqs/79064
 * C is an independently published debugger report, NOT a measurement made here.
 * Positions use a 3x display mapping; speeds, AI timers, encounter layouts,
 * depth/height boxes and animation poses remain reconstruction parameters.
 */
export const RULES = Object.freeze({
  fps: 60, width: 960, height: 540, groundTop: 290, groundBottom: 465,
  pixelScale: 3, maxHp: 8, highHp: 32, initialLives: 4, continues: 3,
  extraLifeScore: 25000, specialCost: 1,
  moveX: 3.15, moveY: 2.35, gravity: 0.55, jumpSpeed: 10.4,
  playerInvuln: 88, respawnInvuln: 150, playerStun: 22,
  enemyInvuln: 22, bossInvuln: 13, stageTime: 600,
  attackDamage: 3, kickDamage: 2, tossDamage: 3, tossFrames: 23,
  source: { manual: 'NES-T3-USA pp.5–10', combat: 'MetHy Character Guide (2021)',
    reconstructed: 'Space mapping, maximum energy, movement/jump, stun/iframes, AI, layouts and timers; see docs/RULES.md.' }
});

export const CHARACTER_IDS = ['leo', 'raph', 'mike', 'don'];
export const CHARACTERS = Object.freeze({
  leo: { id: 'leo', name: 'LEONARDO', label: '达芬奇', short: 'LEO', color: '#4e9eff', weapon: '双刀', reach: 28 * 3, attackFrames: 19, hitFrame: 3, special: '旋风双刀', specialDamage: 8, specialFrames: 38, description: '中距离 · 原地双刀旋转' },
  raph: { id: 'raph', name: 'RAPHAEL', label: '拉斐尔', short: 'RAPH', color: '#ff6267', weapon: '双叉', reach: 24 * 3, attackFrames: 16, hitFrame: 3, special: '强力钻击', specialDamage: 7, specialFrames: 32, description: '出手最快 · 水平钻击' },
  mike: { id: 'mike', name: 'MICHELANGELO', label: '米开朗基罗', short: 'MIKE', color: '#ffac48', weapon: '双节棍', reach: 24 * 3, attackFrames: 21, hitFrame: 5, special: '袋鼠踢', specialDamage: 11, specialFrames: 38, description: '短距离 · 高伤害翻身踢' },
  don: { id: 'don', name: 'DONATELLO', label: '多纳泰罗', short: 'DON', color: '#bc8dff', weapon: '长棍', reach: 32 * 3, attackFrames: 20, hitFrame: 3, special: '翻滚打击', specialDamage: 9, specialFrames: 42, description: '最长攻击距离 · 前空翻棍击' }
});

export const ENEMY_TYPES = Object.freeze({
  foot: { name: 'Foot Soldier', hp: 6, speed: 1.55, reach: 46, color: '#9678d8', behavior: 'melee', score: 600 },
  sand: { name: 'Sand Soldier', hp: 6, speed: 1.1, reach: 170, color: '#ebad55', behavior: 'sand', score: 600 },
  shuriken: { name: 'Shuriken Soldier', hp: 6, speed: 1.15, reach: 360, color: '#ed6775', behavior: 'ranged', projectile: 'shuriken', score: 600 },
  knife: { name: 'Knife Soldier', hp: 6, speed: 1.3, reach: 330, color: '#65c9c2', behavior: 'knife', score: 600 },
  boomerang: { name: 'Boomerang Soldier', hp: 6, speed: 1.3, reach: 340, color: '#ed9952', behavior: 'boomerang', score: 600 },
  spear: { name: 'Spear Soldier', hp: 9, speed: 1.2, reach: 104, color: '#85bbdd', behavior: 'melee', score: 800 },
  whip: { name: 'Whip Soldier', hp: 9, speed: 1.25, reach: 132, color: '#d6dee2', behavior: 'melee', score: 800 },
  sword: { name: 'Sword Soldier', hp: 9, speed: 1.5, reach: 70, color: '#cad5dd', behavior: 'jumper', score: 800 },
  surfer: { name: 'Surf Soldier', hp: 6, speed: 2.6, reach: 55, color: '#ec6c86', behavior: 'surfer', score: 600 },
  carrier: { name: 'Barrel Carrier', hp: 9, speed: 1.1, reach: 280, color: '#519bd8', behavior: 'carrier', score: 800 },
  electric: { name: 'Electric Foot', hp: 6, speed: 1.65, reach: 65, color: '#efd66b', behavior: 'electric', score: 800 },
  mouser: { name: 'Mouser', hp: 3, speed: 2.5, reach: 35, color: '#d3e1d9', behavior: 'mouser', height: 25, score: 400 },
  stone: { name: 'Stone Warrior', hp: 15, speed: 0.9, reach: 103, color: '#bc9265', behavior: 'heavy', score: 1200 },
  gunner: { name: 'Stone Gunner', hp: 15, speed: 0.8, reach: 360, color: '#bfa47e', behavior: 'ranged', projectile: 'bullet', score: 1200 },
  rocket: { name: 'Stone Rocket', hp: 15, speed: 0.7, reach: 480, color: '#af956e', behavior: 'ranged', projectile: 'rocket', score: 1200 },
  flyer: { name: 'Robot Insect', hp: 2, speed: 2.1, reach: 300, color: '#c3e8e5', behavior: 'flyer', height: 28, score: 500 },
  kamikaze: { name: 'Hoverbot', hp: 3, speed: 2.2, reach: 70, color: '#e6b67b', behavior: 'dive', height: 30, score: 500 },
  robot: { name: 'Robofoot', hp: 18, speed: 1.8, reach: 340, color: '#88a7e1', behavior: 'robot', score: 1500 },
  turret: { name: 'Deck Cannon', hp: 12, speed: 0, reach: 460, color: '#c1ccd1', behavior: 'turret', height: 42, score: 1000 },
  flipper: { name: 'Flipper', hp: 4, speed: 1.9, reach: 300, color: '#e4ce78', behavior: 'ranged', projectile: 'laser', height: 28, score: 500 }
});

export const BOSS_DEFS = Object.freeze({
  rocksteady: { name: 'ROCKSTEADY', label: '犀牛人', hp: 64, color: '#9ba8b6', reach: 80, score: 10000 },
  groundchuck: { name: 'GROUNDCHUCK', label: '猛牛', hp: 128, color: '#de6757', reach: 100, score: 15000 },
  slash: { name: 'SLASH', label: '邪恶龟', hp: 64, color: '#76a078', reach: 95, score: 10000 },
  bebop: { name: 'BEBOP', label: '野猪人', hp: 160, color: '#bb7e64', reach: 190, score: 20000 },
  dirtbag: { name: 'DIRTBAG', label: '鼹鼠矿工', hp: 160, color: '#c8a568', reach: 104, score: 25000 },
  mother: { name: 'MOTHER MOUSER', label: '捕鼠机母体', hp: 80, color: '#78abca', reach: 380, score: 12000 },
  leatherhead: { name: 'LEATHERHEAD', label: '鳄鱼头', hp: 192, color: '#76a77b', reach: 124, score: 30000 },
  rahzar: { name: 'RAHZAR', label: '狼人', hp: 192, color: '#b2b1bb', reach: 94, score: 30000 },
  shredder: { name: 'SHREDDER', label: '施莱德', hp: 256, color: '#b2a0d7', reach: 104, score: 35000 },
  tokka: { name: 'TOKKA', label: '变异鳄龟', hp: 208, color: '#b6b47c', reach: 105, score: 35000 },
  redmother: { name: 'RED MOTHER MOUSER', label: '红色捕鼠机母体', hp: 112, color: '#d17d7b', reach: 380, score: 16000 },
  krang: { name: 'KRANG', label: '克朗', hp: 336, color: '#e1b7a5', reach: 115, score: 40000 },
  super: { name: 'SUPER SHREDDER', label: '超级施莱德', hp: 448, color: '#9e83cf', reach: 115, score: 50000 }
});

const wave = (at, types, formation = 'pincer', extras = {}) => ({ at, types, formation, ...extras });
const boss = (at, type, extras = {}) => wave(at, [type], 'boss', { boss: true, ...extras });
const hazard = (type, x, y, w = 90, h = 45, extra = {}) => ({ type, x, y, w, h, ...extra });

/** Enemy composition and landmarks are source-informed; exact wave counts/coordinates are reconstructed. */
export const STAGES = [
  {
    id: 'beach', name: '海滩突围', originalName: 'Ft. Slaughterdale Beach', subtitle: 'FLORIDA · THE FIRST STRIKE', color: '#edd5a6', sky: '#80bfc2',
    intro: '假期结束。穿过海滩与木栈桥，击退犀牛人。',
    sections: [{ at: 0, type: 'beach', name: '阳光海滩' }, { at: 1700, type: 'pier', name: '海边木栈桥' }],
    waves: [wave(0, ['foot','foot','foot'], 'right'), wave(380, ['foot','foot','foot'], 'pincer'), wave(740, ['sand','sand','foot'], 'sand'), wave(1080, ['foot','foot','shuriken'], 'pole'), wave(1450, ['shuriken','shuriken','foot'], 'pincer'), wave(1830, ['sand','foot','foot'], 'ambush'), wave(2210, ['foot','shuriken','foot','foot'], 'pincer', { pizza: true }), boss(2650, 'rocksteady')],
    hazards: [hazard('pit', 1890, 427, 104, 38), hazard('pit', 2380, 295, 100, 46), hazard('sign', 2110, 345, 65, 22)],
    props: [{ x: 1000, y: 335, type: 'barrel', hp: 6, drop: 'pizza' }]
  },
  {
    id: 'ocean', name: '破浪登舰', originalName: 'The Typhoon Tidal Pool', subtitle: 'ATLANTIC · THE BATTLE BARGE', color: '#4aaeb9', sky: '#a4dce0',
    intro: '驾驶冲浪板避开水雷，登上战舰。猛牛正在甲板上等你。',
    sections: [{ at: 0, type: 'surf', name: '动力冲浪' }, { at: 1500, type: 'ship', name: '战舰甲板' }],
    waves: [wave(0, ['surfer','surfer','surfer'], 'pincer'), wave(430, ['surfer','surfer','flyer'], 'right'), wave(870, ['surfer','surfer','shuriken'], 'pincer'), wave(1320, ['surfer','flyer','flyer'], 'right'), wave(1740, ['turret','foot','foot'], 'right'), wave(2140, ['turret','shuriken','stone'], 'pincer', { pizza: true }), boss(2600, 'groundchuck')],
    hazards: [hazard('mine', 550, 330, 38, 38), hazard('mine', 1020, 415, 38, 38), hazard('flame', 1900, 455, 150, 26, { period: 200 })],
    props: [{ x: 2320, y: 310, type: 'crate', hp: 6, drop: 'pizza' }]
  },
  {
    id: 'bridge', name: '断桥追击', originalName: 'Brooklyn Bridge Is Falling Down', subtitle: 'BROOKLYN · NO WAY BACK', color: '#9296a5', sky: '#d8a89e',
    intro: '沿断桥上层绕行。小心卡车投弹与邪恶龟的旋转攻击。',
    sections: [{ at: 0, type: 'bridge', name: '破损桥面' }, { at: 2000, type: 'bridge', name: '追上卡车' }],
    waves: [wave(0, ['foot','foot','carrier'], 'left'), wave(430, ['gunner','spear','spear'], 'right'), wave(870, ['stone','sword','carrier'], 'pincer'), boss(1270, 'slash', { pizza: true }), wave(1710, ['shuriken','boomerang','boomerang'], 'pincer'), wave(2170, ['stone','stone','carrier'], 'right', { pizza: true }), boss(2650, 'bebop')],
    hazards: [hazard('pit', 630, 402, 165, 63), hazard('pit', 1980, 290, 150, 66), hazard('truck', 940, 410, 160, 40, { period: 240 })],
    props: [{ x: 2240, y: 315, type: 'barrel', hp: 6, drop: 'pizza' }]
  },
  {
    id: 'city', name: '重返纽约', originalName: 'Welcome to the Jungle', subtitle: 'MANHATTAN · INTO THE UNDERGROUND', color: '#7e888b', sky: '#e0b46e',
    intro: '穿过街道、车库和地铁。击开井盖，跳过滚动的木桶。',
    sections: [{ at: 0, type: 'city', name: '纽约街道' }, { at: 1700, type: 'subway', name: '地下铁站' }],
    waves: [wave(0, ['foot','spear','foot'], 'right'), wave(410, ['boomerang','knife','foot'], 'manhole'), wave(800, ['rocket','rocket','carrier'], 'right'), wave(1210, ['whip','sword','foot','foot'], 'pole'), wave(1660, ['carrier','carrier','boomerang'], 'pincer'), wave(2060, ['electric','electric','knife','foot'], 'train', { pizza: true }), boss(2520, 'dirtbag')],
    hazards: [hazard('barrel', 940, 400, 50, 50, { period: 160 }), hazard('manhole', 620, 365, 58, 35), hazard('barrel', 1570, 325, 50, 50, { period: 180 })],
    props: [{ x: 1940, y: 320, type: 'crate', hp: 6, drop: 'pizza' }]
  },
  {
    id: 'sewer', name: '下水道噩梦', originalName: 'The Sewer Pipe Nightmare', subtitle: 'UNDERCITY · SOMETHING IS MOVING', color: '#54746b', sky: '#203c3d',
    intro: '捕鼠机已经苏醒。先救出被咬住的同伴，再包抄母体。',
    sections: [{ at: 0, type: 'sewer', name: '排水管道' }, { at: 1800, type: 'sewer', name: '污水处理区' }],
    waves: [wave(0, ['foot','shuriken','foot'], 'gate'), wave(420, ['electric','electric','spear'], 'right'), wave(850, ['knife','mouser','mouser','mouser'], 'gate'), wave(1240, ['kamikaze','foot','whip','mouser'], 'pincer'), boss(1660, 'mother', { pizza: true }), wave(2080, ['foot','spear','shuriken','mouser'], 'gate'), wave(2480, ['whip','knife','foot'], 'pincer', { pizza: true }), boss(2910, 'leatherhead')],
    hazards: [hazard('water', 610, 370, 220, 60), hazard('water', 2170, 390, 220, 55)],
    props: [{ x: 2580, y: 315, type: 'barrel', hp: 6, drop: 'pizza' }]
  },
  {
    id: 'technodrome', name: '突入恐怖堡', originalName: 'The Technodrome', subtitle: 'DIMENSION X · SHREDDER AWAITS', color: '#78789b', sky: '#27283c',
    intro: '传送带、激光与机械军团。狼人之后，还有施莱德。',
    sections: [{ at: 0, type: 'tech', name: '机械要塞' }, { at: 2000, type: 'reactor', name: '反应炉大厅' }],
    waves: [wave(0, ['flyer','flyer','foot'], 'right'), wave(420, ['flipper','flipper','spear'], 'gate'), wave(850, ['robot','gunner','foot'], 'pincer'), wave(1290, ['flyer','flyer','stone'], 'right'), wave(1730, ['robot','robot','knife'], 'gate', { pizza: true }), boss(2160, 'rahzar', { pizza: true }), boss(2650, 'shredder')],
    hazards: [hazard('conveyor', 700, 345, 450, 90, { direction: -1 }), hazard('laser', 1570, 355, 250, 24, { period: 180 })],
    props: [{ x: 1940, y: 320, type: 'crate', hp: 9, drop: 'pizza' }]
  },
  {
    id: 'tower', name: '眩晕高塔', originalName: 'Vertigo Point Tower', subtitle: 'ABOVE THE CITY · KEEP CLIMBING', color: '#857f9c', sky: '#392d56',
    intro: '乘露天升降台登上楼顶。观察落物阴影，绕开托卡的盾牌。',
    sections: [{ at: 0, type: 'lift', name: '露天升降台' }, { at: 1600, type: 'roof', name: '高楼屋顶' }],
    waves: [wave(0, ['foot','carrier','foot'], 'drop'), wave(400, ['sword','knife','carrier'], 'drop'), wave(800, ['robot','flyer','flyer'], 'drop'), wave(1210, ['stone','stone','whip'], 'drop'), wave(1650, ['foot','sword','spear'], 'pincer'), wave(2070, ['robot','knife','carrier'], 'right', { pizza: true }), boss(2510, 'tokka')],
    hazards: [hazard('falling', 500, 365, 80, 80, { period: 170 }), hazard('falling', 1100, 420, 80, 80, { period: 195 }), hazard('pit', 1840, 435, 140, 30), hazard('neon', 3350, 320, 62, 105)],
    props: [{ x: 2200, y: 315, type: 'crate', hp: 6, drop: 'pizza' }]
  },
  {
    id: 'spaceship', name: '决战克朗飞船', originalName: "Krang's Spaceship", subtitle: 'FINAL ASSAULT · BRING MANHATTAN HOME', color: '#757b92', sky: '#151c33',
    intro: '最后的突击。摧毁机械体，阻止超级施莱德。',
    sections: [{ at: 0, type: 'space', name: '异次元飞船' }, { at: 2300, type: 'reactor', name: '重力控制室' }, { at: 3300, type: 'arena', name: '最终决战' }],
    waves: [wave(0, ['robot','robot','flyer'], 'gate'), wave(440, ['flipper','flipper','rocket'], 'right'), wave(880, ['stone','robot','knife'], 'pincer'), boss(1320, 'redmother', { pizza: true }), wave(1770, ['robot','robot','flyer','flyer'], 'gate'), wave(2210, ['gunner','stone','robot'], 'pincer', { pizza: true }), boss(2700, 'krang', { pizza: true }), boss(3370, 'super')],
    hazards: [hazard('laser', 650, 385, 190, 24, { period: 160 }), hazard('conveyor', 1900, 350, 360, 90, { direction: 1 }), hazard('laser', 2430, 305, 120, 24, { period: 195 })],
    props: [{ x: 2380, y: 450, type: 'crate', hp: 9, drop: 'pizza' }]
  }
].map((stage, index) => ({ ...stage, index, length: stage.waves.at(-1).at + 960 }));

export function getSection(stageIndex, x) {
  return STAGES[stageIndex].sections.filter(section => x >= section.at).at(-1) || STAGES[stageIndex].sections[0];
}
