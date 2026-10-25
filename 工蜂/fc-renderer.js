(function exposeFCRenderer(root) {
  "use strict";

  const INK = "#172542";
  const WHITE = "#fff9e7";
  const BELL = { yellow: "#ffdb4b", blue: "#438bff", white: WHITE, red: "#ff5c69" };

  function createRenderer(canvas, width, height) {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("浏览器未提供 Canvas 2D 画布");
    let draws = 0;
    let ratio = 1;
    const rect = (x, y, w, h, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x), Math.round(y), Math.ceil(w), Math.ceil(h));
      draws += 1;
    };
    const box = (x, y, w, h, color, edge = INK) => {
      rect(x - 2, y - 2, w + 4, h + 4, edge);
      rect(x, y, w, h, color);
    };
    function oval(x, y, rx, ry, color) {
      for (let dy = -ry; dy < ry; dy += 2) {
        const span = Math.max(2, Math.round(Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2)) * rx / 2) * 2);
        rect(x - span, y + dy, span * 2, 2, color);
      }
    }
    function eyes(x, y, spacing = 5, scale = 1) {
      [-1, 1].forEach((side) => {
        rect(x + side * spacing - 2 * scale, y, 4 * scale, 7 * scale, WHITE);
        rect(x + side * spacing, y + 3 * scale, 2 * scale, 4 * scale, INK);
      });
    }
    function star(x, y, radius, color) {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const angle = i * Math.PI / 5 - Math.PI / 2;
        const r = i % 2 ? radius * 0.46 : radius;
        const px = Math.round((x + Math.cos(angle) * r) / 2) * 2;
        const py = Math.round((y + Math.sin(angle) * r) / 2) * 2;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      draws += 1;
    }

    function terrain(state, level) {
      const stage = state.stageIndex || 0;
      const scroll = Math.round(state.scroll || 0);
      const water = ["#3288c5", "#3a94c1", "#48598a", "#377ca4", "#4b497c"][stage % 5];
      rect(0, 0, width, height, water);
      for (let row = -1; row < height / 32 + 1; row += 1) {
        const y = (row * 32 + scroll % 32);
        for (let col = 0; col < width / 48; col += 1) {
          const x = col * 48 + (row % 2 ? 18 : 0);
          rect(x, y, 12, 2, "#ffffff16");
          rect(x + 6, y + 2, 10, 2, "#ffffff0c");
        }
      }
      const land = ["#68b754", "#8bb85b", "#7c7aa1", "#5b9f64", "#8a6c91"][stage % 5];
      for (let i = -1; i < 5; i += 1) {
        const absoluteRow = Math.floor(scroll / 168) - i;
        const y = i * 168 + scroll % 168 - 60;
        const x = 55 + ((Math.abs(absoluteRow * 137 + stage * 73) % 340) / 340) * (width - 140);
        const rx = 64 + Math.abs(absoluteRow * 11 % 22);
        oval(x, y + 3, rx + 7, 71, "#174d60");
        oval(x, y, rx + 3, 68, "#dfd991");
        oval(x, y, rx, 64, land);
        for (let j = 0; j < 4; j += 1) {
          const tx = x - 36 + j * 22;
          const ty = y - 26 + Math.abs(absoluteRow + j * 3) % 4 * 14;
          if (stage === 0 || stage === 3) {
            rect(tx - 2, ty, 4, 14, "#746044");
            oval(tx, ty - 4, 11, 9, "#2b7747");
            rect(tx - 5, ty - 8, 8, 3, "#92d060");
          } else if (stage === 1) {
            oval(tx, ty, 12, 6, "#e3e1b2");
            oval(tx, ty, 7, 3, "#c7c18e");
          } else if (stage === 2) {
            box(tx - 7, ty - 5, 14, 10, "#b6a39f", "#685c7c");
            rect(tx - 4, ty - 5, 4, 8, "#d6c5ae");
          } else {
            box(tx - 8, ty - 8, 16, 18, "#5c4474", "#b89a7e");
            rect(tx - 3, ty - 2, 6, 12, "#302f54");
          }
        }
      }
    }

    function craft(player, time, clone = false) {
      const x = Math.round(player.x / 2) * 2;
      const y = Math.round(player.y / 2) * 2;
      const pink = player.id === 1 || player.index === 1 || player.color === "pink";
      const body = pink ? "#f37b9f" : "#559bff";
      const shade = pink ? "#bd3867" : "#275cae";
      const arms = player.arms || { left: true, right: true };
      ctx.save();
      if (clone) ctx.globalAlpha = 0.65;
      if (player.shield > 0) {
        const shieldRadius = 28 + Math.min(player.shield, 20) * 0.15;
        ctx.strokeStyle = Math.floor(time * 4) % 2 ? "#ffb9bb" : "#ff788c";
        ctx.lineWidth = 3;
        ctx.strokeRect(x - shieldRadius, y - shieldRadius, shieldRadius * 2, shieldRadius * 2);
      }
      if (arms.left) {
        box(x - 22, y + 3, 10, 8, WHITE);
        box(x - 27, y + 4, 7, 12, body);
      }
      if (arms.right) {
        box(x + 12, y + 3, 10, 8, WHITE);
        box(x + 20, y + 4, 7, 12, body);
      }
      rect(x - 8, y + 14, 6, 9, shade);
      rect(x + 2, y + 14, 6, 9, shade);
      rect(x - 5, y + 22, 3, Math.floor(time * 12) % 2 ? 7 : 3, "#ffd457");
      rect(x + 2, y + 22, 3, Math.floor(time * 12) % 2 ? 3 : 7, "#ffd457");
      oval(x, y, 16, 19, INK);
      oval(x, y - 2, 14, 16, body);
      oval(x - 3, y - 7, 8, 7, pink ? "#ffb8cb" : "#95d6ff");
      box(x - 5, y - 23, 10, 8, WHITE);
      rect(x - 2, y - 25, 4, 5, shade);
      eyes(x, y - 2, 5, 1);
      rect(x - 4, y + 10, 8, 3, WHITE);
      ctx.restore();
    }

    function enemy(entity, time) {
      const { x, y } = entity;
      const kind = entity.kind || "enemy";
      const r = Math.max(8, entity.radius || 12);
      const move = Math.floor(time * 8 + (entity.phase || 0)) % 2;
      if (kind === "frogger") {
        const leg = 3 + move * 3;
        [-1, 1].forEach((side) => {
          box(x + side * (r + leg) - 4, y - 2, 8, 7, "#94c86b");
          box(x + side * (r + 1) - 4, y + 9, 8, 6, "#94c86b");
        });
        oval(x, y, r + 1, r, INK);
        oval(x, y - 1, r - 1, r - 2, "#94c86b");
        oval(x - 7, y - 10, 5, 5, "#bbdf85");
        oval(x + 7, y - 10, 5, 5, "#bbdf85");
        eyes(x, y - 11, 7);
        rect(x - 6, y + 6, 12, 2, INK);
      } else if (kind === "orbiter") {
        oval(x, y, r, r, INK);
        oval(x, y - 1, r - 2, r - 2, "#8c84dd");
        for (let i = 0; i < 3; i += 1) {
          const angle = time * 2 + i * Math.PI * 2 / 3;
          box(x + Math.cos(angle) * (r + 5) - 3, y + Math.sin(angle) * (r + 5) - 3, 6, 6, "#edb95f");
        }
        eyes(x, y - 4, 4);
      } else if (kind === "sunflower") {
        for (let i = 0; i < 8; i += 1) {
          const angle = i * Math.PI / 4;
          const distance = entity.open ? r + 3 : r - 3;
          oval(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance, 6, 6, "#f3cf5b");
        }
        oval(x, y, r - 3, r - 3, INK);
        oval(x, y - 1, r - 5, r - 5, entity.open ? "#df7783" : "#b18456");
        if (entity.open) eyes(x, y - 4, 4);
        else rect(x - 6, y - 1, 12, 3, INK);
      } else if (kind === "bee") {
        oval(x - 12, y - 5, 9, 7, WHITE);
        oval(x + 12, y - 5, 9, 7, WHITE);
        oval(x, y, 11, 14, INK);
        rect(x - 8, y - 8, 16, 6, "#ffda46");
        rect(x - 8, y + 3, 16, 5, "#ffda46");
        eyes(x, y - 10, 4);
      } else if (kind.includes("strawberry")) {
        oval(x, y - 2, r + 2, r, INK);
        oval(x, y - 3, r, r - 1, "#ed5471");
        rect(x - 5, y - r - 5, 10, 8, "#8cdb6b");
        [[-7, -4], [4, -7], [-2, 2], [6, 3]].forEach(([dx, dy]) => rect(x + dx, y + dy, 2, 3, "#ffe17d"));
        eyes(x, y - 2, 4);
      } else if (kind.includes("onion")) {
        oval(x, y, r + 2, r + 2, INK);
        oval(x, y - 1, r, r, kind.includes("blue") ? "#72b3ef" : "#eee6b7");
        rect(x - 2, y - r - 8, 4, 9, "#73bd5e");
        rect(x - 7, y - r - 5, 4, 6, "#73bd5e");
        eyes(x, y - 2, 5);
      } else if (kind.includes("knife") || kind === "fork") {
        const count = kind === "double-knife" ? 2 : 1;
        for (let i = 0; i < count; i += 1) {
          const dx = count === 2 ? (i * 2 - 1) * 7 : 0;
          box(x + dx - 3, y, 6, 17, "#d68a57");
          box(x + dx - 5, y - 18, 10, 19, "#d9f2fa");
          if (kind === "fork") {
            rect(x - 3, y - 19, 2, 8, INK);
            rect(x + 2, y - 19, 2, 8, INK);
          } else rect(x + dx + 2, y - 16, 3, 13, "#82b2ce");
        }
      } else if (kind.includes("dish") || kind.includes("bowl") || kind.includes("pot")) {
        const color = kind.includes("pink") ? "#f081af" : kind.includes("yellow") ? "#e7bd55" : "#9c8be8";
        oval(x, y, r + 3, r, INK);
        oval(x, y - 2, r + 1, r - 2, color);
        oval(x, y - 5, r - 3, 5, WHITE);
        oval(x, y - 5, r - 7, 2, color);
        if (kind.includes("pot")) {
          box(x - r - 7, y - 2, 7, 7, color);
          box(x + r, y - 2, 7, 7, color);
        }
        eyes(x, y + 2, 5);
      } else if (/squid|octopus|lobster|shrimp|prawn|crab|crawly/.test(kind)) {
        const color = /squid|octopus/.test(kind) ? "#ad83e5" : "#ff8f73";
        for (const side of [-1, 1]) {
          for (let leg = 0; leg < 3; leg += 1) {
            box(x + side * (r - 3 + move * 2) - 3, y + leg * 5, 6, 3, color);
          }
          if (/crab|lobster/.test(kind)) box(x + side * (r + 3) - 4, y - 12, 8, 9, color);
        }
        oval(x, y - 3, r - 3, r, INK);
        oval(x, y - 4, r - 5, r - 2, color);
        eyes(x, y - 6, 4);
      } else if (kind.includes("elephant")) {
        oval(x - 11, y - 2, 9, 12, "#6b87cb");
        oval(x + 11, y - 2, 9, 12, "#6b87cb");
        oval(x, y, 12, 14, INK);
        oval(x, y - 2, 10, 12, "#a7b8e9");
        eyes(x, y - 6, 5);
        box(x - 3, y + 3, 6, 18, "#a7b8e9");
      } else if (/glitch|grabber|light-purple|beetle/.test(kind)) {
        box(x - 12, y - 10, 24, 20, "#8a80d8");
        rect(x - 9, y - 7, 18, 5, "#ffc65b");
        [-1, 1].forEach((side) => {
          box(x + side * 18 - 4, y - 14 + move * 3, 8, 23, "#d9e5ef");
          rect(x + side * 18 - 4, y + 5 + move * 3, 8, 6, "#e66d87");
        });
        eyes(x, y - 1, 5);
      } else {
        const color = kind.includes("purple") ? "#b989e5" : kind.includes("green") ? "#76cb70" : "#e9c565";
        box(x - 7, y - 13, 14, 27, color);
        box(x - 21, y - 4, 42, 7, color);
        rect(x - 5, y - 10, 10, 8, "#e4f7ff");
        rect(x - 17, y + 4, 5, 8, INK);
        rect(x + 12, y + 4, 5, 8, INK);
        rect(x - 4, y + 14, 8, 5 + move * 3, "#f18d59");
      }
    }

    function boss(entity, time) {
      const { x, y, kind } = entity;
      if (kind === "onion-head") {
        oval(x, y, 43, 37, INK);
        oval(x, y - 2, 39, 33, "#e7ddb7");
        oval(x - 12, y - 11, 14, 14, "#fff0c9");
        rect(x - 4, y - 49, 8, 17, "#66ae59");
        rect(x - 16, y - 43, 9, 15, "#86ca5d");
        eyes(x, y - 9, 13, 2);
        box(x - 14, y + 15, 28, 9, "#a55d5d");
        if (entity.shield > 0) {
          ctx.strokeStyle = "#96e4f1";
          ctx.lineWidth = 4;
          ctx.strokeRect(x - 48, y - 39, 96, 80);
        }
      } else if (kind === "parallel-dish") {
        oval(x, y + 8, 59, 23, INK);
        oval(x, y + 5, 55, 21, "#9f77d5");
        oval(x, y - 9, 34, 24, INK);
        oval(x, y - 12, 30, 21, "#b7ecf2");
        for (let i = -2; i <= 2; i += 1) box(x + i * 18 - 4, y + 12, 8, 5, i % 2 ? "#ffe687" : "#e76d91");
        eyes(x, y - 14, 10, 2);
      } else if (kind === "tiger-shark") {
        box(x - 36, y - 27, 72, 58, "#e3b959");
        box(x - 62, y - 5, 29, 20, "#bd8f45");
        box(x + 33, y - 5, 29, 20, "#bd8f45");
        [-1, 1].forEach((side) => {
          for (let i = 0; i < 3; i += 1) rect(x + side * 25 - 3, y - 20 + i * 16, 10, 5, "#694e3c");
          box(x + side * 45 - 5, y + 12, 10, 20, "#ece9d1");
        });
        eyes(x, y - 18, 12, 2);
        box(x - 20, y + 13, 40, 13, "#a4474f");
        for (let i = -2; i <= 2; i += 1) rect(x + i * 7 - 2, y + 12, 4, 6, WHITE);
      } else if (kind === "claw-device") {
        oval(x, y, 34, 33, INK);
        oval(x, y - 2, 30, 29, "#a582d7");
        [-1, 1].forEach((side) => {
          box(x + side * 43 - 18, y - 3, 36, 10, "#eac96b");
          const cy = y + Math.sin(time * 3) * 10;
          box(x + side * 66 - 8, cy - 18, 16, 36, "#ed877f");
          rect(x + side * 65 - 4, cy - 18, 8, 13, INK);
        });
        eyes(x, y - 9, 11, 2);
      } else {
        oval(x, y, 43, 40, INK);
        oval(x, y - 2, 39, 36, "#d479af");
        box(x - 31, y - 40, 62, 12, "#f4ca55");
        [-1, 0, 1].forEach((side) => box(x + side * 23 - 5, y - 52, 10, 16, "#f4ca55"));
        eyes(x, y - 16, 13, 2);
        box(x - 19, y + 11, 38, 12, "#782d69");
        [-1, 1].forEach((side) => box(x + side * 45 - 10, y + 7, 20, 25, "#f4ca55"));
      }
      if (Array.isArray(entity.parts)) entity.parts.forEach((part) => {
        if (part.dead || part.hp <= 0) return;
        const px = Number.isFinite(part.x) ? part.x : x + (part.dx || 0);
        const py = Number.isFinite(part.y) ? part.y : y + (part.dy || 0);
        box(px - 6, py - 6, 12, 12, "#ffae6f");
        rect(px - 2, py - 3, 4, 8, INK);
      });
    }

    function pickup(item, time) {
      const { x, y, kind } = item;
      if (kind === "bell") {
        const color = item.color === "flashing" ? (Math.floor(time * 6) % 2 ? WHITE : BELL.red) : (BELL[item.color] || BELL.yellow);
        box(x - 3, y - 17, 6, 5, color);
        box(x - 8, y - 11, 16, 16, color);
        box(x - 12, y + 2, 24, 7, color);
        rect(x - 10, y + 3, 20, 4, color);
        rect(x - 5, y - 9, 4, 9, "#ffffff88");
        box(x - 3, y + 11, 6, 4, "#d59b3b");
      } else if (kind === "ambulance") {
        box(x - 16, y - 18, 32, 36, WHITE);
        box(x - 12, y - 13, 24, 8, "#9dcae3");
        rect(x - 4, y - 1, 8, 17, "#e75d69");
        rect(x - 10, y + 4, 20, 7, "#e75d69");
        rect(x - 20, y - 10, 4, 9, INK);
        rect(x + 16, y + 5, 4, 9, INK);
      } else if (kind === "milk") {
        box(x - 5, y - 16, 10, 7, "#f7d0cb");
        box(x - 9, y - 7, 18, 23, WHITE);
        rect(x - 5, y + 1, 10, 8, "#82b6e4");
        rect(x - 7, y - 6, 3, 19, "#d4e7ed");
      } else if (kind === "star") {
        star(x, y, 17, INK);
        star(x, y, 13, "#ffe369");
      } else if (kind === "candy" || kind === "spread") {
        box(x - 17, y - 5, 8, 10, "#fff3cb");
        box(x + 9, y - 5, 8, 10, "#fff3cb");
        oval(x, y, 12, 10, INK);
        oval(x, y - 1, 10, 8, "#f388ba");
        rect(x - 3, y - 7, 5, 13, WHITE);
      } else {
        oval(x, y + 1, 12, 12, INK);
        oval(x, y, 10, 10, item.value === 500 ? "#efc34c" : "#ec6873");
        rect(x - 1, y - 15, 3, 7, "#624e34");
        rect(x + 2, y - 14, 7, 4, "#94d761");
        rect(x - 6, y - 5, 4, 5, "#ffc1a0");
      }
    }

    function render(state, level, time = 0) {
      draws = 0;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = false;
      terrain(state, level);
      (state.groundTargets || []).forEach((target) => {
        if (target.dead) return;
        const { x, y } = target;
        box(x - 13, y - 11, 26, 23, target.kind === "bush" ? "#497d40" : "#aeb0a9");
        box(x - 8, y - 7, 16, 14, "#e1cf83");
        rect(x - 3, y - 14, 6, 16, INK);
        rect(x - 1, y - 13, 2, 13, "#c5d8d0");
      });
      (state.clouds || []).forEach((cloud) => {
        if (cloud.dead) return;
        const { x, y } = cloud;
        [[-18, 3, 17, 12], [0, -6, 22, 18], [20, 3, 17, 13]].forEach(([dx, dy, rx, ry]) => {
          oval(x + dx, y + dy + 3, rx + 2, ry, "#d1e9dd");
          oval(x + dx, y + dy, rx, ry, cloud.bellReleased ? "#e1efe5" : WHITE);
        });
      });
      (state.pickups || []).forEach((item) => { if (!item.dead) pickup(item, time); });
      (state.bombs || []).forEach((bomb) => {
        if (bomb.exploded) return;
        ctx.strokeStyle = "#fff1a8";
        ctx.lineWidth = 2;
        ctx.strokeRect(bomb.targetX - 9, bomb.targetY - 9, 18, 18);
        rect(bomb.targetX - 14, bomb.targetY - 1, 28, 2, "#fff1a8");
        rect(bomb.targetX - 1, bomb.targetY - 14, 2, 28, "#fff1a8");
        oval(bomb.x, bomb.y, 6, 7, INK);
        rect(bomb.x - 2, bomb.y - 5, 3, 5, WHITE);
      });
      (state.enemies || []).forEach((item) => {
        if (item.dead) return;
        if (item.type === "boss") boss(item, time); else enemy(item, time);
      });
      (state.playerShots || []).forEach((shot) => {
        if (shot.dead) return;
        if (shot.kind === "star" || shot.kind === "combo-star") {
          star(shot.x, shot.y, shot.radius || 10, "#fff4a3");
        } else if (shot.kind === "fire" || shot.kind === "combo-fire") {
          box(shot.x - 8, shot.y - 10, 16, 20, "#ffb449", "#fff2a3");
        } else {
          rect(shot.x - 3, shot.y - 8, 6, 14, INK);
          rect(shot.x - 1, shot.y - 7, 2, 11, "#fff3b0");
        }
      });
      const players = state.players || [state.player];
      if (state.formation && players.length > 1 && players.every((p) => p.active !== false)) {
        const color = state.formation.kind === "star" ? "#fff6b2" : "#ffba68";
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(players[0].x, players[0].y);
        ctx.lineTo(players[1].x, players[1].y);
        ctx.stroke();
        if (state.formation.kind === "star") star(state.formation.x, state.formation.y, 10, color);
        else rect(state.formation.x - 7, state.formation.y - 5, 14, 10, color);
      }
      players.forEach((player) => {
        if (!player || player.active === false || player.lives <= 0) return;
        if (player.target) {
          const { x, y } = player.target;
          const color = player.id === 1 ? "#ffc1da" : "#c9eeff";
          [[-11, -11], [5, -11], [-11, 9], [5, 9]].forEach(([dx, dy]) => rect(x + dx, y + dy, 6, 2, color));
          [[-11, -11], [9, -11], [-11, 5], [9, 5]].forEach(([dx, dy]) => rect(x + dx, y + dy, 2, 6, color));
        }
        if (player.mirrors && player.clonePositions) player.clonePositions.forEach((position) => {
          craft({ ...player, ...position, shield: 0 }, time, true);
        });
        if (!(player.invulnerable > 0) || Math.floor(time * 12) % 2 === 0) craft(player, time);
      });
      (state.enemyShots || []).forEach((shot) => {
        if (shot.dead) return;
        const r = Math.max(3, shot.radius || 4);
        if (shot.kind === "ring") {
          ctx.beginPath();
          ctx.arc(shot.x, shot.y, r, 0, Math.PI * 2);
          ctx.lineWidth = 4;
          ctx.strokeStyle = (shot.t || 0) < 0.8 ? "#82dc88" : WHITE;
          ctx.stroke();
          return;
        }
        oval(shot.x, shot.y, r + 2, r + 2, INK);
        oval(shot.x, shot.y, r, r, "#ffe5bf");
        rect(shot.x - 2, shot.y - 2, 4, 4, "#dc5068");
      });
      (state.particles || []).forEach((particle) => {
        ctx.globalAlpha = Math.max(0, Math.min(1, particle.life / (particle.maxLife || 0.5)));
        const size = Math.max(2, particle.radius || 3);
        rect(particle.x - size / 2, particle.y - size / 2, size, size, particle.color || "#ffda71");
      });
      ctx.globalAlpha = 1;
    }

    function resize(pixelRatio = 1) {
      ratio = Math.max(1, pixelRatio);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.imageSmoothingEnabled = false;
    }

    return {
      render,
      resize,
      info: () => ({ kind: "canvas2d", perspective: false, projection: "orthographic", width, height, drawCalls: draws }),
    };
  }

  root.WorkerBeeFC = { createRenderer };
})(typeof globalThis !== "undefined" ? globalThis : window);
