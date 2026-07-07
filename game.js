const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const boardWrap = document.getElementById("boardWrap");
const heartsEl = document.getElementById("hearts");
const timeText = document.getElementById("timeText");
const messageEl = document.getElementById("message");
const restartBtn = document.getElementById("restartBtn");
const hintBtn = document.getElementById("hintBtn");
const clearBtn = document.getElementById("clearBtn");
const shuffleBtn = document.getElementById("shuffleBtn");
const infoBtn = document.getElementById("infoBtn");
const infoPanel = document.getElementById("infoPanel");
const closeInfoBtn = document.getElementById("closeInfoBtn");

const COLS = 14;
const ROWS = 21;
const START_TIME = 300;
const INK = "#111331";
const GOOD = "#ac2e55";
const PALE = "#e8e4f2";
const dirs = {
  up: { x: 0, y: -1, angle: -Math.PI / 2 },
  right: { x: 1, y: 0, angle: 0 },
  down: { x: 0, y: 1, angle: Math.PI / 2 },
  left: { x: -1, y: 0, angle: Math.PI },
};
const dirNames = Object.keys(dirs);

let arrows = [];
let particles = [];
let hintId = null;
let lives = 3;
let timeLeft = START_TIME;
let lastTick = performance.now();
let gameOver = false;
let nextId = 1;

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function buildLevel() {
  const rand = seededRandom(20260707);
  arrows = [];
  particles = [];
  hintId = null;
  lives = 3;
  timeLeft = START_TIME;
  gameOver = false;
  nextId = 1;

  const occupied = new Map();
  const starts = allCells().sort(() => rand() - 0.5);

  for (const start of starts) {
    if (occupied.has(keyOf(start.col, start.row))) continue;
    const targetLength = 7 + Math.floor(rand() * 9);
    const path = growPath(start, targetLength, occupied, rand);
    if (path.length < 2) continue;
    addArrow(path, occupied);
  }

  fillSmallGaps(occupied, rand);
  makeSureThereAreOpenMoves();
  updateHearts();
  updateTimer();
  showMessage("\u70b9\u51fb\u65e0\u906e\u6321\u7bad\u5934");
  setTimeout(() => hideMessage(), 900);
}

function allCells() {
  const cells = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      cells.push({ col, row });
    }
  }
  return cells;
}

function growPath(start, targetLength, occupied, rand) {
  const path = [start];
  const used = new Set([keyOf(start.col, start.row)]);
  let previousDir = null;
  let stepsSinceTurn = 0;

  while (path.length < targetLength) {
    const here = path[path.length - 1];
    const choices = dirNames
      .map((name) => ({ name, ...dirs[name] }))
      .filter((dir) => {
        const next = { col: here.col + dir.x, row: here.row + dir.y };
        const key = keyOf(next.col, next.row);
        return isInside(next.col, next.row) && !occupied.has(key) && !used.has(key);
      })
      .sort((a, b) => scoreDirection(b, here, previousDir, stepsSinceTurn, rand) - scoreDirection(a, here, previousDir, stepsSinceTurn, rand));

    if (!choices.length) break;
    const picked = choices[0];
    const next = { col: here.col + picked.x, row: here.row + picked.y };
    path.push(next);
    used.add(keyOf(next.col, next.row));
    stepsSinceTurn = previousDir && previousDir !== picked.name ? 0 : stepsSinceTurn + 1;
    previousDir = picked.name;

    if (path.length >= 2 && outwardDirection(next)) break;
  }

  return path;
}

function scoreDirection(dir, from, previousDir, stepsSinceTurn, rand) {
  const next = { col: from.col + dir.x, row: from.row + dir.y };
  let score = rand();
  if (!previousDir) score += 0.1;
  else if (previousDir === dir.name) score += Math.max(-0.32, 0.14 - stepsSinceTurn * 0.24);
  else score += 0.56 + Math.min(0.22, stepsSinceTurn * 0.08);
  if (touchesExit(next, dir.name)) score += 0.42;
  if (next.col === 0 || next.col === COLS - 1 || next.row === 0 || next.row === ROWS - 1) score += 0.06;
  return score;
}

function fillSmallGaps(occupied, rand) {
  for (const cell of allCells()) {
    if (occupied.has(keyOf(cell.col, cell.row)) || rand() < 0.18) continue;
    const path = growPath(cell, 4 + Math.floor(rand() * 6), occupied, rand);
    if (path.length >= 2) addArrow(path, occupied);
  }
}

function addArrow(path, occupied) {
  if (!pathExitDirection(path) && pathStartExitDirection(path)) {
    path = path.slice().reverse();
  }

  const head = path[path.length - 1];
  const beforeHead = path[path.length - 2];
  const dir = pathExitDirection(path) ?? directionBetween(beforeHead, head);
  const arrow = {
    id: nextId,
    path,
    cells: path.map((cell) => keyOf(cell.col, cell.row)),
    col: head.col,
    row: head.row,
    dir,
    removed: false,
    exiting: false,
    progress: 0,
  };
  arrows.push(arrow);
  for (const cell of path) occupied.set(keyOf(cell.col, cell.row), arrow.id);
  nextId += 1;
}

function directionBetween(a, b) {
  if (b.col > a.col) return "right";
  if (b.col < a.col) return "left";
  if (b.row > a.row) return "down";
  return "up";
}

function touchesExit(cell, dir) {
  return (
    (dir === "left" && cell.col === 0) ||
    (dir === "right" && cell.col === COLS - 1) ||
    (dir === "up" && cell.row === 0) ||
    (dir === "down" && cell.row === ROWS - 1)
  );
}

function pathExitDirection(path) {
  if (path.length < 2) return null;
  const head = path[path.length - 1];
  const beforeHead = path[path.length - 2];
  const dir = directionBetween(beforeHead, head);
  return touchesExit(head, dir) ? dir : null;
}

function pathStartExitDirection(path) {
  if (path.length < 2) return null;
  const head = path[0];
  const beforeHead = path[1];
  const dir = directionBetween(beforeHead, head);
  return touchesExit(head, dir) ? dir : null;
}

function makeSureThereAreOpenMoves() {
  if (arrows.some((arrow) => !arrow.removed && !arrow.exiting && canExit(arrow).ok)) return;

  if (promoteBoundarySegmentToExit()) return;
}

function promoteBoundarySegmentToExit() {
  for (const arrow of activeArrows()) {
    const boundaryIndex = arrow.path.findIndex((cell, index) => {
      if (index === 0) return false;
      const dir = directionBetween(arrow.path[index - 1], cell);
      return touchesExit(cell, dir);
    });
    if (boundaryIndex < 0) continue;

    arrow.path = arrow.path.slice(0, boundaryIndex + 1);

    refreshArrowShape(arrow);
    if (canExit(arrow).ok) return true;
  }

  return false;
}

function refreshArrowShape(arrow) {
  const head = getHead(arrow);
  const beforeHead = arrow.path[arrow.path.length - 2];
  arrow.cells = arrow.path.map((cell) => keyOf(cell.col, cell.row));
  arrow.col = head.col;
  arrow.row = head.row;
  arrow.dir = pathExitDirection(arrow.path) ?? directionBetween(beforeHead, head);
}

function boardMetrics() {
  const marginX = 20;
  const marginY = 18;
  const cell = Math.min((canvas.width - marginX * 2) / COLS, (canvas.height - marginY * 2) / ROWS);
  const width = cell * COLS;
  const height = cell * ROWS;
  return {
    cell,
    left: (canvas.width - width) / 2,
    top: (canvas.height - height) / 2,
    width,
    height,
  };
}

function activeArrows() {
  return arrows.filter((arrow) => !arrow.removed && !arrow.exiting);
}

function arrowAt(col, row) {
  const key = keyOf(col, row);
  return activeArrows().find((arrow) => arrow.cells.includes(key));
}

function canExit(arrow) {
  const head = getHead(arrow);
  const d = dirs[arrow.dir];
  let col = head.col + d.x;
  let row = head.row + d.y;
  const blockers = [];

  while (isInside(col, row)) {
    const found = arrowAt(col, row);
    if (found && found.id !== arrow.id) blockers.push(found);
    col += d.x;
    row += d.y;
  }

  return { ok: blockers.length === 0, blockers };
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const m = boardMetrics();
  drawTrails();

  const ordered = arrows.slice().sort((a, b) => a.exiting - b.exiting);
  for (const arrow of ordered) {
    if (!arrow.removed) drawArrow(arrow, m);
  }

  drawParticles();
  requestAnimationFrame(draw);
}

function drawTrails() {
  ctx.save();
  ctx.fillStyle = PALE;
  for (const particle of particles) {
    ctx.globalAlpha = particle.life;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawParticles() {
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#dbe8ff";
  ctx.lineWidth = 2;
  for (const particle of particles.slice(-28)) {
    ctx.globalAlpha = particle.life * 0.75;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.r * 0.64, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawArrow(arrow, m) {
  const d = dirs[arrow.dir];
  const distance = arrow.exiting ? (Math.max(COLS, ROWS) + 2) * m.cell * easeOutCubic(arrow.progress) : 0;
  const offset = { x: d.x * distance, y: d.y * distance };
  const points = arrow.path.map((cell) => gridPoint(cell, m, offset));

  ctx.save();
  ctx.lineCap = "square";
  ctx.lineJoin = "miter";
  ctx.strokeStyle = hintId === arrow.id ? GOOD : INK;
  ctx.lineWidth = hintId === arrow.id ? 10 : 8;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
  drawHead(points[points.length - 1], arrow.dir, m.cell, hintId === arrow.id ? GOOD : INK);
  ctx.restore();
}

function drawHead(point, dir, cell, color) {
  const d = dirs[dir];
  const side = { x: -d.y, y: d.x };
  const length = cell * 0.28;
  const spread = cell * 0.16;
  const tip = { x: point.x + d.x * length * 0.48, y: point.y + d.y * length * 0.48 };
  const base = { x: point.x - d.x * length * 0.24, y: point.y - d.y * length * 0.24 };

  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(base.x + side.x * spread, base.y + side.y * spread);
  ctx.lineTo(tip.x, tip.y);
  ctx.lineTo(base.x - side.x * spread, base.y - side.y * spread);
  ctx.stroke();
}

function gridPoint(cell, m, offset = { x: 0, y: 0 }) {
  return {
    x: m.left + (cell.col + 0.5) * m.cell + offset.x,
    y: m.top + (cell.row + 0.5) * m.cell + offset.y,
  };
}

function getHead(arrow) {
  return arrow.path[arrow.path.length - 1];
}

function handleCanvasClick(event) {
  if (gameOver) return;
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  const m = boardMetrics();
  const col = Math.floor((x - m.left) / m.cell);
  const row = Math.floor((y - m.top) / m.cell);
  const arrow = arrowAt(col, row);
  if (!arrow) return;

  const result = canExit(arrow);
  if (result.ok) {
    releaseArrow(arrow, m);
  } else {
    loseLife(result.blockers);
  }
}

function releaseArrow(arrow, m) {
  hintId = null;
  arrow.exiting = true;
  arrow.startedAt = performance.now();
  const d = dirs[arrow.dir];
  const head = gridPoint(getHead(arrow), m);

  for (let i = 0; i < 22; i += 1) {
    particles.push({
      x: head.x - d.x * i * 12,
      y: head.y - d.y * i * 12,
      r: Math.max(2, 5 - i * 0.1),
      life: Math.max(0.12, 0.66 - i * 0.022),
    });
  }
  animateArrow(arrow);
}

function animateArrow(arrow) {
  const step = (now) => {
    arrow.progress = Math.min(1, (now - arrow.startedAt) / 460);
    if (arrow.progress < 1) {
      requestAnimationFrame(step);
      return;
    }
    arrow.removed = true;
    arrow.exiting = false;
    arrow.progress = 0;
    particles = particles.slice(-110);
    checkWin();
  };
  requestAnimationFrame(step);
}

function loseLife(blockers) {
  lives -= 1;
  updateHearts();
  boardWrap.classList.remove("fail");
  void boardWrap.offsetWidth;
  boardWrap.classList.add("fail");
  hintId = blockers[0]?.id ?? null;
  setTimeout(() => {
    hintId = null;
  }, 520);

  if (lives <= 0) {
    endGame("\u6311\u6218\u5931\u8d25");
  } else {
    showMessage("\u524d\u65b9\u88ab\u6321\u4f4f\u4e86");
    setTimeout(() => hideMessage(), 650);
  }
}

function checkWin() {
  if (activeArrows().length === 0) {
    endGame("\u901a\u5173\u6210\u529f");
    return;
  }
  makeSureThereAreOpenMoves();
}

function endGame(text) {
  gameOver = true;
  showMessage(text);
}

function updateHearts() {
  heartsEl.innerHTML = "";
  for (let i = 0; i < 3; i += 1) {
    const heart = document.createElement("span");
    heart.className = `heart${i >= lives ? " lost" : ""}`;
    heartsEl.appendChild(heart);
  }
}

function updateTimer() {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  timeText.textContent = `${minutes}m${String(seconds).padStart(2, "0")}s`;
}

function tick(now) {
  if (!gameOver && now - lastTick >= 1000) {
    const steps = Math.floor((now - lastTick) / 1000);
    lastTick += steps * 1000;
    timeLeft = Math.max(0, timeLeft - steps);
    updateTimer();
    if (timeLeft === 0) endGame("\u65f6\u95f4\u5230");
  }

  particles = particles
    .map((particle) => ({ ...particle, life: particle.life - 0.01 }))
    .filter((particle) => particle.life > 0);
  requestAnimationFrame(tick);
}

function showMessage(text) {
  messageEl.textContent = text;
  messageEl.classList.add("show");
}

function hideMessage() {
  messageEl.classList.remove("show");
}

function openInfo() {
  infoPanel.classList.add("show");
  infoPanel.setAttribute("aria-hidden", "false");
}

function closeInfo() {
  infoPanel.classList.remove("show");
  infoPanel.setAttribute("aria-hidden", "true");
}

function showHint() {
  if (gameOver) return;
  const open = activeArrows().find((arrow) => canExit(arrow).ok);
  if (!open) return;
  hintId = open.id;
  showMessage("\u8fd9\u4e2a\u53ef\u4ee5\u6ed1\u51fa");
  setTimeout(() => hideMessage(), 700);
}

function clearOne() {
  if (gameOver) return;
  const open = activeArrows().find((arrow) => canExit(arrow).ok);
  if (open) releaseArrow(open, boardMetrics());
}

function shuffleDirections() {
  if (gameOver) return;
  const active = activeArrows();
  for (const arrow of active) {
    const beforeHead = arrow.path[arrow.path.length - 2];
    arrow.dir = pathExitDirection(arrow.path) ?? directionBetween(beforeHead, getHead(arrow));
  }
  makeSureThereAreOpenMoves();
  showMessage("\u65b9\u5411\u5df2\u91cd\u6392");
  setTimeout(() => hideMessage(), 650);
}

function outwardDirection(cell) {
  if (cell.row === 0) return "up";
  if (cell.row === ROWS - 1) return "down";
  if (cell.col === 0) return "left";
  if (cell.col === COLS - 1) return "right";
  return null;
}

function keyOf(col, row) {
  return `${col},${row}`;
}

function isInside(col, row) {
  return col >= 0 && col < COLS && row >= 0 && row < ROWS;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

window.arrowGameDebug = {
  getState() {
    return {
      lives,
      timeLeft,
      remaining: activeArrows().length,
      open: activeArrows()
        .filter((arrow) => canExit(arrow).ok)
        .map((arrow) => ({ id: arrow.id, head: getHead(arrow), dir: arrow.dir, length: arrow.path.length })),
      blocked: activeArrows()
        .filter((arrow) => !canExit(arrow).ok)
        .map((arrow) => ({ id: arrow.id, head: getHead(arrow), dir: arrow.dir, length: arrow.path.length })),
    };
  },
};

canvas.addEventListener("click", handleCanvasClick);
restartBtn.addEventListener("click", () => {
  lastTick = performance.now();
  buildLevel();
});
hintBtn.addEventListener("click", showHint);
clearBtn.addEventListener("click", clearOne);
shuffleBtn.addEventListener("click", shuffleDirections);
infoBtn.addEventListener("click", openInfo);
closeInfoBtn.addEventListener("click", closeInfo);
infoPanel.addEventListener("click", (event) => {
  if (event.target === infoPanel) closeInfo();
});

buildLevel();
requestAnimationFrame(draw);
requestAnimationFrame(tick);
