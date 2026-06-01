const WALL = 0, PATH = 1, START = 2, FINISH = 3, VISITED = 4, SHORTEST = 5;

let grid = [], ROWS = 15, COLS = 15;
let bfsSteps = [];       // JSON-exportable log
let bfsPath  = [];
let animTimer = null;
let mazeReady = false;
let bfsDone = false;

// DFS maze generation (recursive backtracking) ──
function generateMazeGrid(rows, cols) {
  // Init all walls
  const g = Array.from({length: rows}, () => new Array(cols).fill(WALL));

  const inBounds = (r, c) => r > 0 && r < rows-1 && c > 0 && c < cols-1;
  const dirs = [[0,2],[2,0],[0,-2],[-2,0]];

  function shuffle(arr) {
    for (let i = arr.length-1; i > 0; i--) {
      const j = Math.floor(Math.random()*(i+1));
      [arr[i],arr[j]] = [arr[j],arr[i]];
    }
    return arr;
  }

  // DFS
  const stack = [];
  const startR = 1, startC = 1;
  g[startR][startC] = PATH;
  stack.push([startR, startC]);

  while (stack.length) {
    const [r, c] = stack[stack.length-1];
    const neighbors = shuffle([...dirs])
      .map(([dr,dc]) => [r+dr, c+dc, r+dr/2, c+dc/2])
      .filter(([nr,nc]) => inBounds(nr,nc) && g[nr][nc] === WALL);

    if (neighbors.length === 0) {
      stack.pop();
    } else {
      const [nr, nc, wr, wc] = neighbors[Math.floor(Math.random()*neighbors.length)];
      g[wr][wc] = PATH;
      g[nr][nc] = PATH;
      stack.push([nr, nc]);
    }
  }

  // Set start and finish
  g[1][1] = START;
  g[rows-2][cols-2] = FINISH;
  return g;
}

//BFS pathfinding ──
function bfsFind(g) {
  const rows = g.length, cols = g[0].length;
  let sr = -1, sc = -1, fr = -1, fc = -1;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (g[r][c] === START)  { sr = r; sc = c; }
      if (g[r][c] === FINISH) { fr = r; fc = c; }
    }

  const visited = Array.from({length: rows}, () => new Array(cols).fill(false));
  const parent  = Array.from({length: rows}, () => new Array(cols).fill(null));
  const steps   = []; // JSON log: {step, row, col, type}
  const queue   = [[sr, sc]];
  visited[sr][sc] = true;
  const dirs4 = [[-1,0],[1,0],[0,-1],[0,1]];
  let stepIdx = 0;

  while (queue.length) {
    const [r, c] = queue.shift();
    steps.push({ step: stepIdx++, row: r, col: c, type: 'visit',
      cell: g[r][c] === START ? 'start' : g[r][c] === FINISH ? 'finish' : 'path' });

    if (r === fr && c === fc) break;

    for (const [dr, dc] of dirs4) {
      const nr = r+dr, nc = c+dc;
      if (nr<0||nr>=rows||nc<0||nc>=cols) continue;
      if (visited[nr][nc]) continue;
      if (g[nr][nc] === WALL) continue;
      visited[nr][nc] = true;
      parent[nr][nc] = [r, c];
      queue.push([nr, nc]);
    }
  }

  // Reconstruct path
  const path = [];
  let cur = [fr, fc];
  while (cur) {
    path.unshift(cur);
    steps.push({ step: stepIdx++, row: cur[0], col: cur[1], type: 'path' });
    cur = parent[cur[0]][cur[1]];
  }

  return { steps, path };
}

// FE
const canvas = document.getElementById('maze-canvas');
const ctx    = canvas.getContext('2d');

const COLORS = {
  [WALL]:    '#12121a',
  [PATH]:    '#23232e',
  [START]:   '#34d399',
  [FINISH]:  '#f87171',
  [VISITED]: '#2d2a4a',
  [SHORTEST]:'#6c63ff',
};
const WALL_BORDER = '#0a0a10';

let CELL = 28; // px per cell

function calcCell(rows, cols) {
  const maxW = Math.min(window.innerWidth - 280, 680);
  const maxH = Math.min(window.innerHeight - 110, 680);
  return Math.max(6, Math.floor(Math.min(maxW/cols, maxH/rows)));
}

function drawGrid(g, overlay = {}) {
  const rows = g.length, cols = g[0].length;
  CELL = calcCell(rows, cols);
  canvas.width  = cols * CELL;
  canvas.height = rows * CELL;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = r+','+c;
      const state = overlay[key] !== undefined ? overlay[key] : g[r][c];
      ctx.fillStyle = COLORS[state] || COLORS[PATH];
      ctx.fillRect(c*CELL, r*CELL, CELL, CELL);

      // Wall grid lines
      if (state === WALL) {
        ctx.strokeStyle = WALL_BORDER;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(c*CELL+0.25, r*CELL+0.25, CELL-0.5, CELL-0.5);
      }
    }
  }

  // Start/finish icons
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const v = overlay[r+','+c] !== undefined ? overlay[r+','+c] : g[r][c];
      if (v === START || v === FINISH) {
        ctx.fillStyle = v === START ? '#fff' : '#fff';
        ctx.font = `bold ${Math.max(10, CELL-8)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(v === START ? 'S' : 'F', c*CELL + CELL/2, r*CELL + CELL/2);
      }
    }
}

document.getElementById('grid-size').addEventListener('input', function() {
  let v = parseInt(this.value);
  if (v % 2 === 0) v++;
  document.getElementById('grid-size-val').textContent = v+'×'+v;
});

document.getElementById('anim-speed').addEventListener('input', function() {
  document.getElementById('anim-speed-val').textContent = '×'+this.value;
});

function setStatus(text, mode='') {
  document.getElementById('status-text').textContent = text;
  const dot = document.getElementById('status-dot');
  dot.className = 'status-dot' + (mode ? ' '+mode : '');
}

function generateMaze() {
  if (animTimer) { clearInterval(animTimer); animTimer = null; }

  let size = parseInt(document.getElementById('grid-size').value);
  if (size % 2 === 0) size++;
  ROWS = COLS = size;

  setStatus('Генерация лабиринта (DFS recursive backtracking)…', 'active');

  // Small delay so status renders
  setTimeout(() => {
    grid = generateMazeGrid(ROWS, COLS);
    bfsSteps = []; bfsPath = []; bfsDone = false;
    drawGrid(grid);

    document.getElementById('s-size').textContent = ROWS+'×'+COLS;
    document.getElementById('s-visited').textContent = '—';
    document.getElementById('s-path').textContent = '—';
    document.getElementById('s-steps').textContent = '—';
    document.getElementById('btn-bfs').disabled = false;
    document.getElementById('btn-export').disabled = true;
    mazeReady = true;

    setStatus('Лабиринт сгенерирован. Нажмите «Найти путь (BFS)»', 'done');
  }, 30);
}

function startBFS() {
  if (!mazeReady) return;
  if (animTimer) { clearInterval(animTimer); animTimer = null; }

  document.getElementById('btn-bfs').disabled = true;
  document.getElementById('btn-export').disabled = true;

  const result = bfsFind(grid);
  const visitSteps = result.steps.filter(s => s.type === 'visit');
  const pathSteps  = result.steps.filter(s => s.type === 'path');
  bfsPath  = result.path;
  bfsSteps = result.steps;

  document.getElementById('s-steps').textContent = visitSteps.length;
  setStatus('BFS: обход в ширину…', 'active');

  const overlay = {};
  const speedMap = {1:80, 2:40, 3:20, 4:8, 5:2};
  const delay = speedMap[parseInt(document.getElementById('anim-speed').value)] || 20;

  let i = 0;
  animTimer = setInterval(() => {
    // Process several steps per tick at high speeds
    const batch = delay < 10 ? 5 : 1;
    for (let b = 0; b < batch && i < visitSteps.length; b++, i++) {
      const {row, col, cell} = visitSteps[i];
      if (cell !== 'start' && cell !== 'finish') overlay[row+','+col] = VISITED;
    }
    drawGrid(grid, overlay);

    if (i >= visitSteps.length) {
      clearInterval(animTimer);
      setStatus('BFS завершён. Восстановление пути…', 'active');

      // Animate shortest path
      let pi = 0;
      animTimer = setInterval(() => {
        const {row, col} = pathSteps[pi] || {};
        if (row !== undefined) {
          const state = grid[row][col];
          if (state !== START && state !== FINISH) overlay[row+','+col] = SHORTEST;
        }
        drawGrid(grid, overlay);
        pi++;
        if (pi >= pathSteps.length) {
          clearInterval(animTimer);
          animTimer = null;
          bfsDone = true;

          const pathLen = bfsPath.length - 2; // exclude start/finish
          document.getElementById('s-visited').textContent = visitSteps.length;
          document.getElementById('s-path').textContent = pathLen > 0 ? pathLen+' шагов' : 'не найден';
          document.getElementById('btn-bfs').disabled = false;
          document.getElementById('btn-export').disabled = false;
          setStatus(pathLen > 0
            ? `Путь найден! Длина: ${pathLen} шагов, посещено: ${visitSteps.length} клеток`
            : 'Путь не найден', pathLen > 0 ? 'done' : 'error');
        }
      }, Math.max(delay, 15));
    }
  }, delay);
}

function exportJSON() {
  if (!bfsSteps.length) return;

  const payload = {
    maze: { rows: ROWS, cols: COLS },
    bfs: {
      totalSteps: bfsSteps.filter(s=>s.type==='visit').length,
      pathLength: bfsPath.length,
      steps: bfsSteps
    }
  };

  const json = JSON.stringify(payload, null, 2);
  const a = document.createElement('a');
  a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
  a.download = 'bfs_steps.json';
  a.click();
  setStatus('JSON экспортирован: bfs_steps.json', 'done');
}

// Init on load
window.addEventListener('load', () => {
  generateMaze();
});
window.addEventListener('resize', () => {
  if (mazeReady) drawGrid(grid);
});
