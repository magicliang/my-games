(function exposeGameCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.WorkerBeeCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function buildGameCore() {
  "use strict";

  const WIDTH = 512;
  const HEIGHT = 480;
  const BELL_COLORS = ["yellow", "blue", "white", "flashing", "red"];

  // FC manual: https://www.nintendo.co.jp/data/software/manual/WUP-N-FAUJ-JPN.pdf
  // Bell counts: https://hutokoro.jp/games/fc-99/ (play observations, not ROM timing).
  // Shield durability, speed cap and motion timings still need frame-by-frame calibration.
  const FC_RULES = Object.freeze({
    bellColorsAt: Object.freeze({ 4: "blue", 9: "white", 14: "flashing", 19: "red" }),
    bellBeeHits: 31,
    yellowBellScores: Object.freeze([500, 1000, 5000, 10000]),
    initialLives: 3,
    firstExtraLife: 50000,
    extraLifeInterval: 150000,
    extraLifeLimit: 1000000,
    maxSpeedLevel: 5,
    shieldHits: 16,
    scores: Object.freeze({ air: 100, ground: 500, boss: 10000, bee: 15100 }),
    cloneDelay: 12,
  });

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

  function bellColorForHits(hits, player, playerCount = 1) {
    const color = FC_RULES.bellColorsAt[Math.floor(hits)] || "yellow";
    if (color === "white" && (player?.twinShot || player?.threeWay)) return "yellow";
    if (color === "flashing" && (playerCount > 1 || player?.shield > 0)) return "yellow";
    if (color === "red" && player?.mirrors) return "yellow";
    return color;
  }

  function createPlayer(id = 0) {
    return {
      id,
      x: WIDTH / 2,
      y: HEIGHT - 64,
      radius: 12,
      active: true,
      lives: FC_RULES.initialLives,
      score: 0,
      nextExtraLife: FC_RULES.firstExtraLife,
      bellChain: 0,
      speedLevel: 0,
      twinShot: false,
      threeWay: false,
      mirrors: false,
      shield: 0,
      history: [],
      clonePositions: [],
      arms: { left: true, right: true },
      ambulanceUsed: false,
      invulnerable: 0,
      shotCooldown: 0,
      bombCooldown: 0,
    };
  }

  function applyBell(player, color, playerCount = 1) {
    if (color === "yellow" || !BELL_COLORS.includes(color)
      || (color === "flashing" && (playerCount > 1 || player.shield > 0))
      || (color === "red" && player.mirrors)) {
      return { kind: "yellow", color: "yellow", applied: false };
    }
    switch (color) {
      case "blue":
        player.speedLevel = clamp(player.speedLevel + 1, 0, FC_RULES.maxSpeedLevel);
        break;
      case "white":
        player.twinShot = true;
        player.threeWay = false;
        break;
      case "flashing":
        player.mirrors = true;
        player.threeWay = false;
        updateClones(player);
        break;
      case "red":
        player.shield = FC_RULES.shieldHits;
        break;
      default:
        break;
    }
    return { kind: "power", color, applied: true };
  }

  function applyCandy(player, playerCount = 1) {
    if (playerCount > 1 || player.mirrors) return false;
    player.threeWay = true;
    player.twinShot = false;
    return true;
  }

  function hitBell(state, bell, player = state.player) {
    state.bellHits = (state.bellHits || 0) + 1;
    bell.hits = state.bellHits;
    bell.color = bellColorForHits(state.bellHits, player, state.playerCount);
    if (state.bellHits >= FC_RULES.bellBeeHits) {
      bell.dead = true;
      state.bellHits = 0;
      return "bee";
    }
    return "bell";
  }

  function addScore(state, player, points) {
    if (!Number.isFinite(points) || points < 0) throw new RangeError("points must be nonnegative and finite");
    player.score += points;
    state.score += points;
    let extraLives = 0;
    while (player.score >= player.nextExtraLife && player.nextExtraLife <= FC_RULES.extraLifeLimit) {
      player.lives += 1;
      extraLives += 1;
      player.nextExtraLife += FC_RULES.extraLifeInterval;
      if (player.nextExtraLife > FC_RULES.extraLifeLimit) player.nextExtraLife = Infinity;
    }
    state.nextExtraLife = state.player.nextExtraLife;
    return extraLives;
  }

  function collectYellowBell(state, player = state.player) {
    const points = FC_RULES.yellowBellScores[Math.min(player.bellChain, FC_RULES.yellowBellScores.length - 1)];
    player.bellChain += 1;
    state.bellChain = state.player.bellChain;
    state.bellHits = 0;
    addScore(state, player, points);
    return points;
  }

  function missBell(state) {
    state.bellHits = 0;
    state.bellChain = 0;
    state.players.forEach((player) => { player.bellChain = 0; });
  }

  function damagePlayer(player, { collision = false } = {}) {
    if (!player.active || player.invulnerable > 0) return "ignored";
    if (player.shield > 0) {
      player.shield = Math.max(0, player.shield - (collision ? 2 : 1));
      player.invulnerable = 0.12;
      return "shield";
    }
    if (!collision && (player.arms.left || player.arms.right)) {
      player.arms.left = false;
      player.arms.right = false;
      player.invulnerable = 0.75;
      return "arms";
    }
    return "life";
  }

  function restorePlayerAfterDeath(player) {
    const replacement = createPlayer(player.id);
    replacement.x = player.x;
    replacement.y = player.y;
    replacement.score = player.score;
    replacement.nextExtraLife = player.nextExtraLife;
    replacement.lives = Math.max(0, player.lives - 1);
    replacement.active = replacement.lives > 0;
    replacement.invulnerable = 2;
    Object.assign(player, replacement);
    return player;
  }

  function updateClones(player) {
    player.history.push({ x: player.x, y: player.y });
    const limit = FC_RULES.cloneDelay * 2 + 1;
    if (player.history.length > limit) player.history.splice(0, player.history.length - limit);
    player.clonePositions = player.mirrors ? [1, 2].map((index) => {
      const position = player.history[Math.max(0, player.history.length - 1 - index * FC_RULES.cloneDelay)];
      return { x: position.x, y: position.y, radius: player.radius };
    }) : [];
    return player.clonePositions;
  }

  function nextStage(stageIndex, loop = 1) {
    return stageIndex >= LEVELS.length - 1
      ? { stageIndex: 0, loop: loop + 1 }
      : { stageIndex: stageIndex + 1, loop };
  }

  function createGameState(stageIndex = 0, playerCount = 1) {
    playerCount = playerCount === 2 ? 2 : 1;
    const players = Array.from({ length: playerCount }, (_, id) => createPlayer(id));
    if (playerCount === 2) {
      players[0].x -= 48;
      players[1].x += 48;
    }
    return {
      mode: "ready",
      stageIndex: clamp(stageIndex, 0, LEVELS.length - 1),
      loop: 1,
      stageTime: 0,
      score: 0,
      nextExtraLife: FC_RULES.firstExtraLife,
      playerCount,
      player: players[0],
      players,
      bellHits: 0,
      bellChain: 0,
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
    return state.bossSpawned && !state.enemies.some((enemy) => !enemy.dead);
  }

  function powerLabel(player) {
    const powers = [];
    if (player.threeWay) powers.push("三向弹");
    else if (player.twinShot) powers.push("双炮");
    if (player.mirrors) powers.push("分身×2");
    if (player.shield) powers.push(`护盾 ${player.shield}`);
    if (player.speedLevel) powers.push(`速度 ${player.speedLevel}`);
    return powers.length ? powers.join(" / ") : "标准装备";
  }

  return {
    WIDTH,
    HEIGHT,
    BELL_COLORS,
    FC_RULES,
    LEVELS,
    clamp,
    circleHit,
    bellColorForHits,
    createPlayer,
    applyBell,
    applyCandy,
    hitBell,
    addScore,
    collectYellowBell,
    missBell,
    damagePlayer,
    restorePlayerAfterDeath,
    updateClones,
    nextStage,
    createGameState,
    stageIsComplete,
    powerLabel,
  };
});
