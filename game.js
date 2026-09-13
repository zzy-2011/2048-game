/* 2048 — 纯 DOM/CSS 实现，无外部资源依赖 */
(() => {
  'use strict';

  const SIZE = 4;
  const boardEl = document.getElementById('board');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const overlay = document.getElementById('overlay');
  const ovTitle = document.getElementById('ov-title');
  const ovSub = document.getElementById('ov-sub');

  let grid = [];          // 4x4，0 表示空
  let score = 0;
  let best = Number(localStorage.getItem('g2048_best') || 0);
  let won = false;        // 是否已达成 2048（允许继续）
  let over = false;
  let tiles = [];         // 16 个持久 .tile 元素

  // 创建 16 个持久格子
  for (let i = 0; i < SIZE * SIZE; i++) {
    const t = document.createElement('div');
    t.className = 'tile';
    boardEl.appendChild(t);
    tiles.push(t);
  }

  bestEl.textContent = best;

  function idx(r, c) { return r * SIZE + c; }

  function emptyCells() {
    const out = [];
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (grid[idx(r, c)] === 0) out.push(idx(r, c));
    return out;
  }

  function spawn() {
    const cells = emptyCells();
    if (!cells.length) return -1;
    const i = cells[Math.floor(Math.random() * cells.length)];
    grid[i] = Math.random() < 0.9 ? 2 : 4;
    return i;
  }

  // 各方向的「移动线」：每条线是从边缘到内部的 4 个坐标，方块向索引 0 方向滑动
  function lines(dir) {
    const out = [];
    if (dir === 'left' || dir === 'right') {
      for (let r = 0; r < SIZE; r++) {
        const line = [];
        for (let c = 0; c < SIZE; c++) line.push(idx(r, c));
        if (dir === 'right') line.reverse();
        out.push(line);
      }
    } else {
      for (let c = 0; c < SIZE; c++) {
        const line = [];
        for (let r = 0; r < SIZE; r++) line.push(idx(r, c));
        if (dir === 'down') line.reverse();
        out.push(line);
      }
    }
    return out;
  }

  // 把一条线向索引 0 压缩并合并（每个方块最多合并一次）
  function slide(line) {
    const vals = line.map(i => grid[i]);
    const compact = vals.filter(v => v > 0);
    const merged = [];
    for (let k = 0; k < compact.length - 1; k++) {
      if (compact[k] === compact[k + 1]) {
        compact[k] *= 2;
        score += compact[k];
        merged.push(k);
        compact.splice(k + 1, 1);
      }
    }
    while (compact.length < SIZE) compact.push(0);
    const changed = line.some((i, k) => grid[i] !== compact[k]);
    line.forEach((i, k) => { grid[i] = compact[k]; });
    return { changed, merged };
  }

  function move(dir) {
    if (over) return;
    const ls = lines(dir);
    let anyChanged = false;
    const mergedSet = new Set();
    for (const line of ls) {
      const res = slide(line);
      if (res.changed) anyChanged = true;
      res.merged.forEach(k => mergedSet.add(line[k]));
    }
    if (!anyChanged) return;

    const newCell = spawn();
    render(mergedSet, new Set(newCell >= 0 ? [newCell] : []));

    if (score > best) { best = score; localStorage.setItem('g2048_best', best); bestEl.textContent = best; }
    scoreEl.textContent = score;

    checkEnd();
  }

  function canMove() {
    if (emptyCells().length) return true;
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      const v = grid[idx(r, c)];
      if (c + 1 < SIZE && grid[idx(r, c + 1)] === v) return true;
      if (r + 1 < SIZE && grid[idx(r + 1, c)] === v) return true;
    }
    return false;
  }

  function checkEnd() {
    if (!won && grid.includes(2048)) {
      won = true;
      showOverlay('你赢了！🎉', '已合成 2048，可以继续挑战更大数字', '继续玩');
      return;
    }
    if (!canMove()) {
      over = true;
      showOverlay('游戏结束', '没有可移动的步数了', '再来一局');
    }
  }

  function render(merged, isNew) {
    for (let i = 0; i < tiles.length; i++) {
      const v = grid[i];
      const t = tiles[i];
      t.className = 'tile';
      if (v > 0) {
        t.textContent = v;
        t.classList.add(v <= 2048 ? 'v' + v : 'vbig');
        if (isNew && isNew.has(i)) { t.classList.add('pop'); }
        else if (merged && merged.has(i)) { t.classList.add('merged'); }
      } else {
        t.textContent = '';
      }
    }
  }

  function showOverlay(title, sub, btn) {
    ovTitle.textContent = title;
    ovSub.textContent = sub;
    document.getElementById('ov-btn').textContent = btn;
    overlay.classList.remove('hidden');
  }
  function hideOverlay() { overlay.classList.add('hidden'); }

  function newGame() {
    grid = new Array(SIZE * SIZE).fill(0);
    score = 0; won = false; over = false;
    scoreEl.textContent = '0';
    hideOverlay();
    const a = spawn(); const b = spawn();
    render(new Set(), new Set([a, b]));
  }

  // ---- 输入 ----
  const KEYMAP = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    a: 'left', d: 'right', w: 'up', s: 'down',
    A: 'left', D: 'right', W: 'up', S: 'down'
  };
  window.addEventListener('keydown', (e) => {
    const dir = KEYMAP[e.key];
    if (dir) { e.preventDefault(); move(dir); }
  });

  // 触屏滑动
  let sx = 0, sy = 0;
  boardEl.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0]; sx = t.clientX; sy = t.clientY;
  }, { passive: true });
  boardEl.addEventListener('touchend', (e) => {
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
    else move(dy > 0 ? 'down' : 'up');
  }, { passive: true });

  document.getElementById('new').addEventListener('click', newGame);
  document.getElementById('ov-btn').addEventListener('click', () => {
    if (over || !won) newGame();
    else hideOverlay();   // 胜利后选择继续
  });

  newGame();
})();
