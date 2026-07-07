(function () {
  const canvas = document.querySelector(".life-bg");
  if (!canvas) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  const stillLifes = [
    [[0, 0], [1, 0], [0, 1], [1, 1]],
    [[1, 0], [2, 0], [0, 1], [3, 1], [1, 2], [2, 2]],
    [[1, 0], [2, 0], [0, 1], [3, 1], [1, 2], [3, 2], [2, 3]],
    [[0, 0], [1, 0], [0, 1], [2, 1], [1, 2]],
    [[1, 0], [0, 1], [2, 1], [1, 2]]
  ];

  const gliderGun = [
    [24, 0],
    [22, 1], [24, 1],
    [12, 2], [13, 2], [20, 2], [21, 2], [34, 2], [35, 2],
    [11, 3], [15, 3], [20, 3], [21, 3], [34, 3], [35, 3],
    [0, 4], [1, 4], [10, 4], [16, 4], [20, 4], [21, 4],
    [0, 5], [1, 5], [10, 5], [14, 5], [16, 5], [17, 5], [22, 5], [24, 5],
    [10, 6], [16, 6], [24, 6],
    [11, 7], [15, 7],
    [12, 8], [13, 8]
  ];

  const state = {
    dpr: 1,
    width: 0,
    height: 0,
    cell: 14,
    cols: 0,
    rows: 0,
    current: new Uint8Array(0),
    next: new Uint8Array(0),
    age: new Uint8Array(0),
    mouseX: -9999,
    mouseY: -9999,
    lastStep: 0,
    running: true,
    frame: 0
  };

  function index(x, y) {
    return y * state.cols + x;
  }

  function resize() {
    const nextWidth = window.innerWidth;
    const nextHeight = window.innerHeight;
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.width = nextWidth;
    state.height = nextHeight;
    state.cell = nextWidth < 680 ? 18 : 14;
    state.cols = Math.ceil(nextWidth / state.cell);
    state.rows = Math.ceil(nextHeight / state.cell);

    canvas.width = Math.ceil(nextWidth * state.dpr);
    canvas.height = Math.ceil(nextHeight * state.dpr);
    canvas.style.width = nextWidth + "px";
    canvas.style.height = nextHeight + "px";
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

    state.current = new Uint8Array(state.cols * state.rows);
    state.next = new Uint8Array(state.cols * state.rows);
    state.age = new Uint8Array(state.cols * state.rows);
    seed();
  }

  function seed() {
    const clusters = Math.max(12, Math.floor((state.cols * state.rows) / 720));
    for (let i = 0; i < clusters; i += 1) {
      const x = Math.floor(Math.random() * state.cols);
      const y = Math.floor(Math.random() * state.rows);
      placePattern(x, y, stillLifes[Math.floor(Math.random() * stillLifes.length)]);
    }

    seedGliderGuns();
  }

  function transformPattern(pattern) {
    const rotation = Math.floor(Math.random() * 4);
    const mirror = Math.random() > 0.5 ? -1 : 1;
    const points = pattern.map(([x, y]) => {
      let tx = x * mirror;
      let ty = y;
      for (let i = 0; i < rotation; i += 1) {
        const nextX = -ty;
        ty = tx;
        tx = nextX;
      }
      return [tx, ty];
    });
    const minX = Math.min(...points.map(([x]) => x));
    const minY = Math.min(...points.map(([, y]) => y));
    return points.map(([x, y]) => [x - minX, y - minY]);
  }

  function placePattern(cx, cy, pattern) {
    const points = transformPattern(pattern);
    const maxX = Math.max(...points.map(([x]) => x));
    const maxY = Math.max(...points.map(([, y]) => y));
    const ox = cx - Math.floor(maxX / 2);
    const oy = cy - Math.floor(maxY / 2);

    points.forEach(([x, y]) => {
      const px = ox + x;
      const py = oy + y;
      if (px < 1 || py < 1 || px >= state.cols - 1 || py >= state.rows - 1) return;
      const cellIndex = index(px, py);
      state.current[cellIndex] = 1;
      state.age[cellIndex] = 1;
    });
  }

  function placeFixedPattern(x, y, pattern) {
    pattern.forEach(([dx, dy]) => {
      const px = x + dx;
      const py = y + dy;
      if (px < 1 || py < 1 || px >= state.cols - 1 || py >= state.rows - 1) return;
      const cellIndex = index(px, py);
      state.current[cellIndex] = 1;
      state.age[cellIndex] = 1;
    });
  }

  function clearCells(x, y, width, height) {
    for (let py = y; py < y + height; py += 1) {
      for (let px = x; px < x + width; px += 1) {
        if (px < 0 || py < 0 || px >= state.cols || py >= state.rows) continue;
        const cellIndex = index(px, py);
        state.current[cellIndex] = 0;
        state.age[cellIndex] = 0;
      }
    }
  }

  function placeGliderGun(x, y, mirrorX) {
    const gunWidth = 36;
    const gunHeight = 9;
    const padding = 4;
    const pattern = mirrorX
      ? gliderGun.map(([px, py]) => [gunWidth - 1 - px, py])
      : gliderGun;

    clearCells(x - padding, y - padding, gunWidth + padding * 2, gunHeight + padding * 2);
    placeFixedPattern(x, y, pattern);
  }

  function seedGliderGuns() {
    const gunWidth = 36;
    const gunHeight = 9;
    if (state.cols < gunWidth + 24 || state.rows < gunHeight + 16 || state.width < 900) return;

    const gunCount = state.cols > 120 && state.rows > 68 ? 2 : 1;
    const lanes = [
      [8, Math.floor(state.rows * 0.18), false],
      [Math.max(8, state.cols - gunWidth - 12), Math.floor(state.rows * 0.68), true]
    ];

    for (let i = 0; i < gunCount; i += 1) {
      const [x, y, mirrorX] = lanes[i];
      placeGliderGun(x, y, mirrorX);
    }
  }

  function step() {
    for (let y = 0; y < state.rows; y += 1) {
      for (let x = 0; x < state.cols; x += 1) {
        let neighbors = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= state.cols || ny >= state.rows) continue;
            neighbors += state.current[index(nx, ny)];
          }
        }

        const cellIndex = index(x, y);
        const alive = state.current[cellIndex] === 1;
        const nextAlive = alive ? neighbors === 2 || neighbors === 3 : neighbors === 3;
        state.next[cellIndex] = nextAlive ? 1 : 0;
        state.age[cellIndex] = nextAlive ? Math.min(state.age[cellIndex] + 1, 18) : 0;
      }
    }

    const previous = state.current;
    state.current = state.next;
    state.next = previous;
  }

  function draw() {
    ctx.clearRect(0, 0, state.width, state.height);
    ctx.fillStyle = "rgba(251, 250, 247, 0.55)";
    ctx.fillRect(0, 0, state.width, state.height);

    for (let y = 0; y < state.rows; y += 1) {
      for (let x = 0; x < state.cols; x += 1) {
        const cellIndex = index(x, y);
        if (!state.current[cellIndex]) continue;

        const px = x * state.cell;
        const py = y * state.cell;
        const dx = px + state.cell / 2 - state.mouseX;
        const dy = py + state.cell / 2 - state.mouseY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const lift = Math.max(0, 1 - distance / 180);
        const ageTone = Math.min(state.age[cellIndex] / 18, 1);
        const alpha = 0.08 + ageTone * 0.15 + lift * 0.25;
        const blue = Math.round(72 + lift * 72);
        const green = Math.round(112 + lift * 48);

        ctx.fillStyle = "rgba(" + blue + ", " + green + ", 108, " + alpha.toFixed(3) + ")";
        ctx.fillRect(px + 1, py + 1, Math.max(1, state.cell - 3), Math.max(1, state.cell - 3));
      }
    }
  }

  function tick(now) {
    if (!state.running) return;
    if (reducedMotion.matches) {
      draw();
      state.frame = 0;
      return;
    }
    if (!reducedMotion.matches && now - state.lastStep > 115) {
      step();
      state.lastStep = now;
    }
    draw();
    state.frame = window.requestAnimationFrame(tick);
  }

  function start() {
    if (state.frame) return;
    state.running = true;
    state.lastStep = performance.now();
    state.frame = window.requestAnimationFrame(tick);
  }

  function stop() {
    state.running = false;
    if (state.frame) {
      window.cancelAnimationFrame(state.frame);
      state.frame = 0;
    }
  }

  function pointerToCell(event) {
    return {
      x: Math.floor(event.clientX / state.cell),
      y: Math.floor(event.clientY / state.cell)
    };
  }

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", (event) => {
    state.mouseX = event.clientX;
    state.mouseY = event.clientY;
  });
  window.addEventListener("pointerleave", () => {
    state.mouseX = -9999;
    state.mouseY = -9999;
  });
  window.addEventListener("pointerdown", (event) => {
    if (event.target.closest("a, button, input, textarea, select")) return;
    const cell = pointerToCell(event);
    const pattern = stillLifes[Math.floor(Math.random() * stillLifes.length)];
    placePattern(cell.x, cell.y, pattern);
    draw();
  });
  function handleMotionPreferenceChange() {
    state.lastStep = performance.now();
    if (reducedMotion.matches) {
      draw();
      return;
    }
    start();
  }

  if (typeof reducedMotion.addEventListener === "function") {
    reducedMotion.addEventListener("change", handleMotionPreferenceChange);
  } else if (typeof reducedMotion.addListener === "function") {
    reducedMotion.addListener(handleMotionPreferenceChange);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") start();
    else stop();
  });

  resize();
  if (reducedMotion.matches) draw();
  else start();
})();
