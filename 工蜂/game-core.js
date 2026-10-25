(function exposeGameCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.WorkerBeeCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function buildGameCore() {
  "use strict";

  const WIDTH = 480;
  const HEIGHT = 720;
  const BELL_COLORS = ["yellow", "blue", "white", "green", "red"];

  const wave = (at, kind, count, formation, extra = {}) => ({
    at,
    kind,
    count,
    formation,
    ...extra,
  });

  const LEVELS = [
    {
      name: "海岛蔬果",
      boss: "Onion Head",
      bossName: "洋葱头",
      bossKind: "onion-head",
      duration: 51,
      palette: { sky: "#64c9f4", land: "#63ba62", accent: "#ffd447", haze: "#dff8ff" },
      waves: [
        wave(2, "strawberry", 5, "vee"), wave(5, "strawberry", 5, "vee"),
        wave(8, "strawberry", 5, "vee"), wave(11, "onion", 3, "column"),
        wave(14, "onion", 3, "column"), wave(17, "purple-plane", 4, "sine"),
        wave(20, "purple-plane", 4, "sine"), wave(23, "green-ship", 4, "cross"),
        wave(26, "green-ship", 4, "cross"), wave(29, "green-arrow", 6, "line", { shoots: true }),
        wave(32, "strawberry", 5, "vee"), wave(35, "purple-plane", 4, "sine"),
        wave(38, "green-ship", 4, "cross"), wave(41, "onion", 3, "column"),
        wave(44, "strawberry", 5, "vee", { fast: true }), wave(47, "onion", 4, "column", { fast: true }),
      ],
    },
    {
      name: "餐具大陆",
      boss: "Parallel Dish",
      bossName: "平行飞碟",
      bossKind: "parallel-dish",
      duration: 55,
      palette: { sky: "#76d4ef", land: "#8bcf58", accent: "#ffdf55", haze: "#f5fbca" },
      waves: [
        wave(2, "dish", 5, "arc", { shoots: true }), wave(5, "dish", 5, "arc", { shoots: true }),
        wave(8, "knife", 6, "dive", { shoots: true }), wave(11, "knife", 6, "dive", { shoots: true }),
        wave(14, "fork", 4, "line", { shoots: true }), wave(17, "fork", 4, "line", { shoots: true }),
        wave(20, "blue-bowl", 4, "sine", { shoots: true }), wave(23, "yellow-bowl", 3, "sine", { shoots: true }),
        wave(26, "purple-pot", 4, "chase", { shoots: true }), wave(29, "purple-pot", 4, "chase", { shoots: true }),
        wave(32, "dish", 5, "arc", { shoots: true, fast: true }), wave(35, "knife", 8, "dive", { shoots: true }),
        wave(38, "fork", 4, "line", { shoots: true }), wave(41, "blue-bowl", 4, "sine", { shoots: true }),
        wave(44, "purple-pot", 5, "chase", { shoots: true }), wave(47, "dish", 5, "arc", { shoots: true, fast: true }),
        wave(50, "knife", 8, "dive", { shoots: true, fast: true }),
      ],
    },
    {
      name: "奇兽暮野",
      boss: "Tiger Shark",
      bossName: "虎鲨舰",
      bossKind: "tiger-shark",
      duration: 55,
      palette: { sky: "#5579c8", land: "#8a6ab8", accent: "#ffcb57", haze: "#e7dbff" },
      waves: [
        wave(2, "yellow-ship", 6, "orbit", { shoots: true }), wave(5, "yellow-ship", 6, "orbit", { shoots: true }),
        wave(8, "crawly-bug", 6, "zigzag", { shoots: true }), wave(11, "crawly-bug", 6, "zigzag", { shoots: true }),
        wave(14, "lobster", 6, "sides", { shoots: true }), wave(17, "lobster", 6, "sides", { shoots: true }),
        wave(20, "shrimp", 6, "cross", { shoots: true }), wave(23, "killer-squid", 6, "sides", { shoots: true }),
        wave(26, "elephant", 8, "line", { fast: true }), wave(29, "elephant", 8, "line", { fast: true }),
        wave(32, "yellow-ship", 6, "orbit", { shoots: true, fast: true }), wave(35, "crawly-bug", 6, "zigzag", { shoots: true }),
        wave(38, "shrimp", 6, "cross", { shoots: true }), wave(41, "killer-squid", 6, "sides", { shoots: true }),
        wave(44, "yellow-ship", 6, "orbit", { shoots: true }), wave(47, "crawly-bug", 6, "zigzag", { shoots: true }),
        wave(50, "lobster", 6, "sides", { shoots: true, fast: true }),
      ],
    },
    {
      name: "磁力回廊",
      boss: "Claw Device",
      bossName: "巨钳装置",
      bossKind: "claw-device",
      duration: 55,
      palette: { sky: "#5fc6e9", land: "#54a76d", accent: "#f6d64b", haze: "#d6fff0" },
      waves: [
        wave(2, "purple-pot", 6, "chase", { shoots: true, fast: true }), wave(5, "purple-pot", 6, "chase", { shoots: true }),
        wave(8, "blue-onion", 6, "sides", { shoots: true }), wave(11, "blue-onion", 6, "sides", { shoots: true }),
        wave(14, "neon-dish", 5, "arc", { shoots: true, fast: true }), wave(17, "crab", 6, "chase", { shoots: true }),
        wave(20, "crab", 6, "chase", { shoots: true }), wave(23, "octopus", 5, "hang", { shoots: true }),
        wave(26, "double-knife", 6, "dive", { shoots: true }), wave(29, "purple-pot", 8, "chase", { shoots: true }),
        wave(32, "blue-onion", 6, "sides", { shoots: true }), wave(35, "neon-dish", 5, "arc", { shoots: true }),
        wave(38, "double-knife", 6, "dive", { shoots: true }), wave(41, "crab", 6, "chase", { shoots: true }),
        wave(44, "purple-pot", 8, "chase", { shoots: true, fast: true }), wave(47, "neon-dish", 5, "arc", { shoots: true }),
        wave(50, "double-knife", 8, "dive", { shoots: true, fast: true }),
      ],
    },
    {
      name: "香料王城",
      boss: "King Spice",
      bossName: "香料王",
      bossKind: "king-spice",
      duration: 59,
      palette: { sky: "#374a91", land: "#6a5aa8", accent: "#ffcf55", haze: "#ffc6ef" },
      waves: [
        wave(2, "light-purple", 8, "sides"), wave(5, "light-purple", 8, "sides"),
        wave(8, "pink-bowl", 6, "sine", { shoots: true }), wave(11, "pink-bowl", 6, "sine", { shoots: true }),
        wave(14, "grabber", 5, "orbit", { shoots: true, fast: true }), wave(17, "grabber", 5, "orbit", { shoots: true }),
        wave(20, "glitch", 8, "chase", { shoots: true }), wave(23, "purple-plane", 8, "chase", { shoots: true }),
        wave(26, "blue-beetle", 6, "zigzag", { shoots: true }), wave(29, "white-dish", 5, "arc", { shoots: true }),
        wave(32, "blue-beetle", 6, "zigzag", { shoots: true }), wave(35, "blue-fighter", 5, "orbit", { shoots: true }),
        wave(38, "flashing-prawn", 6, "cross", { shoots: true, fast: true }), wave(41, "pink-bowl", 6, "sine", { shoots: true }),
        wave(44, "purple-plane", 8, "chase", { shoots: true }), wave(47, "glitch", 8, "chase", { shoots: true }),
        wave(50, "light-purple", 8, "sides", { fast: true }), wave(53, "pink-bowl", 6, "sine", { shoots: true }),
        wave(56, "purple-plane", 8, "chase", { shoots: true, fast: true }),
      ],
    },
  ];

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function circleHit(a, b, padding = 0) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const r = (a.radius || 0) + (b.radius || 0) + padding;
    return dx * dx + dy * dy <= r * r;
  }

  function bellColorForHits(hits) {
    return BELL_COLORS[clamp(Math.floor(hits / 5), 0, BELL_COLORS.length - 1)];
  }

  function createPlayer() {
    return {
      x: WIDTH / 2,
      y: HEIGHT - 112,
      radius: 18,
      lives: 3,
      speedLevel: 0,
      twinShot: false,
      mirrors: false,
      shield: 0,
      arms: { left: true, right: true },
      ambulanceUsed: false,
      invulnerable: 0,
      shotCooldown: 0,
      bombCooldown: 0,
    };
  }

  function applyBell(player, color) {
    switch (color) {
      case "blue":
        player.speedLevel = clamp(player.speedLevel + 1, 0, 5);
        break;
      case "white":
        player.twinShot = true;
        break;
      case "green":
        player.mirrors = true;
        player.shield = 0;
        break;
      case "red":
        player.shield = 4;
        player.mirrors = false;
        break;
      default:
        break;
    }
    return player;
  }

  function createGameState(stageIndex = 0) {
    return {
      mode: "ready",
      stageIndex: clamp(stageIndex, 0, LEVELS.length - 1),
      stageTime: 0,
      score: 0,
      nextExtraLife: 30000,
      player: createPlayer(),
      spawnedWaves: new Set(),
      bossSpawned: false,
      enemies: [],
      playerShots: [],
      enemyShots: [],
      bombs: [],
      groundTargets: [],
      clouds: [],
      pickups: [],
      particles: [],
      message: "准备起飞",
    };
  }

  function stageIsComplete(state) {
    return state.bossSpawned && state.enemies.length === 0;
  }

  function powerLabel(player) {
    const powers = [];
    if (player.twinShot) powers.push("双炮");
    if (player.mirrors) powers.push("分身");
    if (player.shield) powers.push(`护盾 ${player.shield}`);
    if (player.speedLevel) powers.push(`速度 ${player.speedLevel}`);
    return powers.length ? powers.join(" / ") : "标准装备";
  }

  return {
    WIDTH,
    HEIGHT,
    BELL_COLORS,
    LEVELS,
    clamp,
    circleHit,
    bellColorForHits,
    createPlayer,
    applyBell,
    createGameState,
    stageIsComplete,
    powerLabel,
  };
});
