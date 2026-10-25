(function exposeWorkerBeeWebGL(root) {
  "use strict";

  const VERTEX_SHADER = `#version 300 es
    in vec3 aPosition;
    in vec3 aNormal;
    uniform mat4 uModel;
    uniform mat4 uViewProjection;
    out vec3 vNormal;
    out float vDepth;
    void main() {
      vec4 world = uModel * vec4(aPosition, 1.0);
      vec4 clip = uViewProjection * world;
      gl_Position = clip;
      vNormal = normalize(mat3(uModel) * aNormal);
      vDepth = clip.w;
    }
  `;

  const FRAGMENT_SHADER = `#version 300 es
    precision highp float;
    in vec3 vNormal;
    in float vDepth;
    uniform vec4 uColor;
    uniform vec3 uFogColor;
    out vec4 outColor;
    void main() {
      vec3 lightDirection = normalize(vec3(-0.45, 0.9, 0.55));
      float light = 0.3 + max(dot(normalize(vNormal), lightDirection), 0.0) * 0.88;
      vec3 lit = uColor.rgb * light;
      float fog = smoothstep(20.0, 38.0, vDepth) * 0.55;
      outColor = vec4(mix(lit, uFogColor, fog), uColor.a);
    }
  `;

  const BELL_COLORS = {
    yellow: "#ffd447",
    blue: "#55a7ff",
    white: "#f8fbff",
    green: "#37c978",
    red: "#ff5b63",
  };

  function multiply(a, b) {
    const out = new Float32Array(16);
    for (let column = 0; column < 4; column += 1) {
      for (let row = 0; row < 4; row += 1) {
        let value = 0;
        for (let index = 0; index < 4; index += 1) value += a[index * 4 + row] * b[column * 4 + index];
        out[column * 4 + row] = value;
      }
    }
    return out;
  }

  function perspective(fieldOfView, aspect, near, far) {
    const f = 1 / Math.tan(fieldOfView / 2);
    const range = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (near + far) * range, -1,
      0, 0, near * far * 2 * range, 0,
    ]);
  }

  function lookAt(eye, target) {
    const normalize = (vector) => {
      const length = Math.hypot(...vector) || 1;
      return vector.map((value) => value / length);
    };
    const cross = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const forward = normalize([eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]]);
    const right = normalize(cross([0, 1, 0], forward));
    const up = cross(forward, right);
    return new Float32Array([
      right[0], up[0], forward[0], 0,
      right[1], up[1], forward[1], 0,
      right[2], up[2], forward[2], 0,
      -dot(right, eye), -dot(up, eye), -dot(forward, eye), 1,
    ]);
  }

  function modelMatrix(position, scale, rotation = 0) {
    const cosine = Math.cos(rotation);
    const sine = Math.sin(rotation);
    return new Float32Array([
      cosine * scale[0], 0, -sine * scale[0], 0,
      0, scale[1], 0, 0,
      sine * scale[2], 0, cosine * scale[2], 0,
      position[0], position[1], position[2], 1,
    ]);
  }

  function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }

  function createProgram(gl) {
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    return program;
  }

  function triangle(target, a, b, c, normals) {
    [a, b, c].forEach((point, index) => target.push(...point, ...(normals[index] || normals[0])));
  }

  function cubeVertices() {
    const vertices = [];
    const faces = [
      [[0, 0, 1], [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]],
      [[0, 0, -1], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]]],
      [[1, 0, 0], [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]]],
      [[-1, 0, 0], [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]]],
      [[0, 1, 0], [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]]],
      [[0, -1, 0], [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]]],
    ];
    faces.forEach(([normal, points]) => {
      triangle(vertices, points[0], points[1], points[2], [normal]);
      triangle(vertices, points[0], points[2], points[3], [normal]);
    });
    return vertices;
  }

  function sphereVertices(rows = 8, columns = 12) {
    const vertices = [];
    const point = (row, column) => {
      const latitude = (row / rows) * Math.PI;
      const longitude = (column / columns) * Math.PI * 2;
      return [Math.sin(latitude) * Math.cos(longitude), Math.cos(latitude), Math.sin(latitude) * Math.sin(longitude)];
    };
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const a = point(row, column);
        const b = point(row + 1, column);
        const c = point(row + 1, column + 1);
        const d = point(row, column + 1);
        triangle(vertices, a, b, c, [a, b, c]);
        triangle(vertices, a, c, d, [a, c, d]);
      }
    }
    return vertices;
  }

  function frustumVertices(segments = 14) {
    const vertices = [];
    for (let index = 0; index < segments; index += 1) {
      const a = (index / segments) * Math.PI * 2;
      const b = ((index + 1) / segments) * Math.PI * 2;
      const bottomA = [Math.cos(a), -1, Math.sin(a)];
      const bottomB = [Math.cos(b), -1, Math.sin(b)];
      const topA = [Math.cos(a) * 0.45, 1, Math.sin(a) * 0.45];
      const topB = [Math.cos(b) * 0.45, 1, Math.sin(b) * 0.45];
      const normalA = [Math.cos(a), 0.28, Math.sin(a)];
      const normalB = [Math.cos(b), 0.28, Math.sin(b)];
      triangle(vertices, bottomA, bottomB, topB, [normalA, normalB, normalB]);
      triangle(vertices, bottomA, topB, topA, [normalA, normalB, normalA]);
      triangle(vertices, [0, -1, 0], bottomB, bottomA, [[0, -1, 0]]);
      triangle(vertices, [0, 1, 0], topA, topB, [[0, 1, 0]]);
    }
    return vertices;
  }

  function parseColor(hex, alpha = 1) {
    const value = Number.parseInt(hex.replace("#", ""), 16);
    return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255, alpha];
  }

  function hash(value) {
    return Math.abs(Math.sin(value * 12.9898) * 43758.5453) % 1;
  }

  function colorForKind(kind) {
    if (kind.includes("blue") || kind.includes("dish")) return "#5b8cff";
    if (kind.includes("purple") || kind.includes("octopus")) return "#a066d8";
    if (kind.includes("green") || kind.includes("onion")) return "#62bd69";
    if (kind.includes("yellow") || kind.includes("knife") || kind.includes("fork")) return "#ffd05a";
    if (kind.includes("pink") || kind.includes("strawberry") || kind.includes("prawn")) return "#ed5c78";
    return "#e85a5f";
  }

  function createRenderer(canvas, width, height) {
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: true, powerPreference: "high-performance" });
    if (!gl) throw new Error("工蜂 3D 需要支持 WebGL2 的浏览器");

    const program = createProgram(gl);
    const locations = {
      position: gl.getAttribLocation(program, "aPosition"),
      normal: gl.getAttribLocation(program, "aNormal"),
      model: gl.getUniformLocation(program, "uModel"),
      viewProjection: gl.getUniformLocation(program, "uViewProjection"),
      color: gl.getUniformLocation(program, "uColor"),
      fog: gl.getUniformLocation(program, "uFogColor"),
    };

    function upload(vertices) {
      const vao = gl.createVertexArray();
      const buffer = gl.createBuffer();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(locations.position);
      gl.vertexAttribPointer(locations.position, 3, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(locations.normal);
      gl.vertexAttribPointer(locations.normal, 3, gl.FLOAT, false, 24, 12);
      return { vao, count: vertices.length / 6 };
    }

    const meshes = { cube: upload(cubeVertices()), sphere: upload(sphereVertices()), frustum: upload(frustumVertices()) };
    const stats = { drawCalls: 0, triangles: 0 };
    let viewProjection = new Float32Array(16);
    let fogColor = [0.8, 0.95, 1];

    gl.useProgram(program);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    function draw(meshName, position, scale, color, rotation = 0, alpha = 1) {
      const mesh = meshes[meshName];
      gl.bindVertexArray(mesh.vao);
      gl.uniformMatrix4fv(locations.model, false, modelMatrix(position, scale, rotation));
      gl.uniform4fv(locations.color, parseColor(color, alpha));
      gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
      stats.drawCalls += 1;
      stats.triangles += mesh.count / 3;
    }

    const worldX = (x) => ((x / width) - 0.5) * 10;
    const worldZ = (y) => ((y / height) - 0.5) * 15;

    function shadow(x, z, radius) {
      draw("sphere", [x, -0.16, z + 0.18], [radius, 0.025, radius * 0.72], "#17364b", 0, 0.42);
    }

    function craft(x, y, radius, color, time, boss = false, arms = { left: true, right: true }) {
      const scale = radius / 18;
      const px = worldX(x);
      const pz = worldZ(y);
      const altitude = boss ? 2.35 : 2.05;
      shadow(px, pz, 0.55 * scale);
      draw("sphere", [px, altitude, pz], [0.42 * scale, 0.27 * scale, 0.68 * scale], color, Math.sin(time * 3) * 0.04);
      draw("frustum", [px, altitude + 0.28 * scale, pz - 0.12 * scale], [0.18 * scale, 0.25 * scale, 0.18 * scale], "#f4fbff");
      if (arms.left) draw("cube", [px - 0.5 * scale, altitude, pz + 0.08 * scale], [0.36 * scale, 0.08 * scale, 0.28 * scale], "#d7ecff", -0.12);
      if (arms.right) draw("cube", [px + 0.5 * scale, altitude, pz + 0.08 * scale], [0.36 * scale, 0.08 * scale, 0.28 * scale], "#d7ecff", 0.12);
      draw("frustum", [px, altitude, pz + 0.7 * scale], [0.17 * scale, 0.32 * scale, 0.17 * scale], "#ffcf55", Math.PI);
    }

    function bossMesh(enemy, time) {
      const x = worldX(enemy.x);
      const z = worldZ(enemy.y);
      const scale = enemy.radius / 36;
      shadow(x, z, scale);
      if (enemy.kind === "parallel-dish") {
        draw("sphere", [x, 2.35, z], [1.25 * scale, 0.22 * scale, 1.0 * scale], "#9b74db", time * 0.35);
        draw("sphere", [x, 2.58, z], [0.52 * scale, 0.24 * scale, 0.52 * scale], "#78dfff");
        return;
      }
      if (enemy.kind === "tiger-shark") {
        draw("sphere", [x, 2.35, z], [0.72 * scale, 0.5 * scale, 1.35 * scale], "#e4c04f", 0.05);
        draw("frustum", [x, 2.82, z + 0.1], [0.25 * scale, 0.4 * scale, 0.25 * scale], "#243b68");
        return;
      }
      if (enemy.kind === "claw-device") {
        draw("sphere", [x, 2.35, z], [0.72 * scale, 0.55 * scale, 0.72 * scale], "#a36de0", time * 0.5);
        [-1, 1].forEach((side) => {
          draw("cube", [x + side * 0.95 * scale, 2.35, z], [0.48 * scale, 0.16 * scale, 0.18 * scale], "#ffca54", side * 0.35);
          draw("frustum", [x + side * 1.35 * scale, 2.35, z - 0.08], [0.22 * scale, 0.42 * scale, 0.22 * scale], "#ef6d69", side * 1.3);
        });
        return;
      }
      craft(enemy.x, enemy.y, enemy.radius * 0.72, enemy.kind === "king-spice" ? "#dc4d8c" : "#7bc55b", time, true);
      draw("frustum", [x, 3.2, z], [0.48 * scale, 0.58 * scale, 0.48 * scale], "#ffd447", Math.PI);
    }

    function renderTerrain(state, level) {
      draw("cube", [0, -0.45, 0], [8.2, 0.25, 12], level.palette.sky);
      const scroll = (state.scroll || 0) * 0.028;
      for (let index = 0; index < 10; index += 1) {
        const row = Math.floor(scroll / 3) + index;
        const z = ((index * 3 + scroll) % 30) - 15;
        const x = (hash(row * 17 + state.stageIndex * 31) - 0.5) * 8.2;
        const size = 0.65 + hash(row * 41) * 0.85;
        draw("sphere", [x, 0, z], [size, 0.3, size * 1.35], level.palette.land, hash(row) * Math.PI);
        if ((row + state.stageIndex) % 3 === 0) {
          if (state.stageIndex === 0) {
            draw("frustum", [x, 0.48, z], [0.16, 0.4, 0.16], "#9a6c3a");
            draw("sphere", [x, 0.92, z], [0.42, 0.24, 0.42], "#39a85a");
          } else if (state.stageIndex === 1) {
            draw("sphere", [x, 0.38, z], [0.56, 0.08, 0.56], "#f4f1dc");
            draw("sphere", [x, 0.43, z], [0.26, 0.04, 0.26], level.palette.accent);
          } else if (state.stageIndex === 2) {
            draw("frustum", [x, 0.56, z], [0.3, 0.56, 0.3], "#6d4b9b", row);
          } else if (state.stageIndex === 3) {
            draw("cube", [x, 0.54, z], [0.16, 0.5, 0.16], "#2f5472");
            draw("sphere", [x, 1.05, z], [0.3, 0.16, 0.3], "#54e4d7");
          } else {
            draw("cube", [x, 0.45, z], [0.34, 0.42, 0.34], "#9552a6");
            draw("frustum", [x, 1.05, z], [0.34, 0.42, 0.34], level.palette.accent);
          }
        }
      }
      for (let index = 0; index < 7; index += 1) {
        const z = ((index * 4.4 + scroll * 1.8) % 30) - 15;
        draw("cube", [-3.8, -0.12, z], [0.025, 0.015, 0.72], "#dff8ff", 0, 0.32);
        draw("cube", [3.8, -0.12, z + 1.4], [0.025, 0.015, 0.72], "#dff8ff", 0, 0.32);
      }
    }

    function render(state, level, time, reducedMotion = false) {
      stats.drawCalls = 0;
      stats.triangles = 0;
      fogColor = parseColor(level.palette.haze).slice(0, 3);
      gl.clearColor(...parseColor(level.palette.haze));
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const tracking = reducedMotion ? 0 : worldX(state.player.x) * 0.08;
      const camera = [tracking, 9.8, 12.8];
      const projection = perspective(42 * Math.PI / 180, canvas.width / canvas.height, 0.1, 42);
      viewProjection = multiply(projection, lookAt(camera, [tracking * 0.45, 0.2, -0.6]));
      gl.uniformMatrix4fv(locations.viewProjection, false, viewProjection);
      gl.uniform3fv(locations.fog, fogColor);

      renderTerrain(state, level);

      state.groundTargets.forEach((target) => {
        const x = worldX(target.x);
        const z = worldZ(target.y);
        draw("frustum", [x, 0.25, z], [0.35, 0.42, 0.35], target.kind === "bush" ? "#2f8b54" : "#7e8798");
        draw("cube", [x, 0.6, z], [0.08, 0.22, 0.08], "#202f44");
      });

      state.clouds.forEach((cloud) => {
        const x = worldX(cloud.x);
        const z = worldZ(cloud.y);
        shadow(x, z, 0.65);
        [[0, 0, 0], [-0.42, -0.08, 0.05], [0.42, -0.04, 0.08], [0.05, 0.18, -0.08]].forEach(([dx, dy, dz], index) => {
          draw("sphere", [x + dx, 2.65 + dy, z + dz], [0.48 - index * 0.03, 0.3, 0.42], "#f5fbff");
        });
      });

      state.pickups.forEach((pickup) => {
        const x = worldX(pickup.x);
        const z = worldZ(pickup.y);
        if (pickup.kind === "bell") {
          draw("frustum", [x, 2.2 + Math.sin(time * 4 + pickup.phase) * 0.08, z], [0.28, 0.32, 0.28], BELL_COLORS[pickup.color] || BELL_COLORS.yellow, Math.PI);
          draw("sphere", [x, 1.88, z], [0.1, 0.1, 0.1], "#fff1a6");
        } else if (pickup.kind === "ambulance") {
          draw("cube", [x, 1.9, z], [0.46, 0.28, 0.62], "#f5fbff");
          draw("cube", [x, 2.2, z], [0.08, 0.18, 0.08], "#e5484d");
          draw("cube", [x, 2.2, z], [0.2, 0.07, 0.08], "#e5484d");
        } else {
          draw("sphere", [x, 1.85, z], [0.3, 0.3, 0.3], pickup.kind === "star" ? "#ffd447" : "#37c978", time * 0.8);
        }
      });

      state.bombs.forEach((bomb) => draw("sphere", [worldX(bomb.x), 1.1 + (bomb.z || 0) / 20, worldZ(bomb.y)], [0.17, 0.17, 0.17], "#17243b"));
      state.playerShots.forEach((shot) => draw("sphere", [worldX(shot.x), 2.1, worldZ(shot.y)], [0.08, 0.08, 0.28], "#fff26b"));
      state.enemyShots.forEach((shot) => draw("sphere", [worldX(shot.x), 1.9, worldZ(shot.y)], [0.12, 0.12, 0.12], shot.kind === "ground" ? "#ffbc4f" : "#ff5b63"));
      state.enemies.forEach((enemy) => {
        if (enemy.type === "boss") bossMesh(enemy, time);
        else craft(enemy.x, enemy.y, enemy.radius, colorForKind(enemy.kind), time + enemy.phase);
      });

      const player = state.player;
      if (player.invulnerable <= 0 || Math.floor(time * 12) % 2 === 0) craft(player.x, player.y, player.radius, "#2f7fe5", time, false, player.arms);
      if (player.mirrors) [-1, 1].forEach((side) => craft(player.x + side * 34, player.y + 25, 9, "#37c978", time));
      if (player.shield) draw("sphere", [worldX(player.x), 2.05, worldZ(player.y)], [0.9, 0.55, 0.9], "#ff6d76", time, 0.28);
      state.particles.forEach((particle) => draw("sphere", [worldX(particle.x), 2, worldZ(particle.y)], [particle.radius / 18, particle.radius / 18, particle.radius / 18], particle.color));
    }

    function resize(pixelRatio) {
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    function info() {
      return {
        kind: "webgl2",
        depthTest: gl.isEnabled(gl.DEPTH_TEST),
        perspective: true,
        drawCalls: stats.drawCalls,
        triangles: Math.round(stats.triangles),
        meshes: Object.keys(meshes).length,
      };
    }

    return { render, resize, info };
  }

  root.WorkerBeeWebGL = { createRenderer };
})(typeof globalThis !== "undefined" ? globalThis : window);
