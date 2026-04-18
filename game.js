(() => {
'use strict';

// ---------- Preset backgrounds (gradient SVG data URIs, no copyright) ----------
function gradientBg(c1, c2, c3) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" preserveAspectRatio="none">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/>
      <stop offset="0.5" stop-color="${c2}"/>
      <stop offset="1" stop-color="${c3}"/>
    </linearGradient>
    <radialGradient id="r" cx="0.3" cy="0.3" r="0.8">
      <stop offset="0" stop-color="rgba(255,255,255,0.25)"/>
      <stop offset="1" stop-color="rgba(0,0,0,0)"/>
    </radialGradient></defs>
    <rect width="800" height="600" fill="url(#g)"/>
    <rect width="800" height="600" fill="url(#r)"/>
  </svg>`;
  return 'data:image/svg+xml;base64,' + btoa(svg);
}

const PRESET_BGS = [
  { id: 'neon', name: 'Neon Night', url: gradientBg('#0f0c29', '#302b63', '#24243e') },
  { id: 'sunset', name: 'Sunset', url: gradientBg('#ff512f', '#dd2476', '#24243e') },
  { id: 'ocean', name: 'Ocean', url: gradientBg('#2193b0', '#6dd5ed', '#0b486b') },
  { id: 'forest', name: 'Forest', url: gradientBg('#134e5e', '#71b280', '#0f3443') },
  { id: 'aurora', name: 'Aurora', url: gradientBg('#00c9ff', '#92fe9d', '#3a1c71') },
  { id: 'candy', name: 'Candy', url: gradientBg('#f857a6', '#ff5858', '#fbd786') },
  { id: 'cosmic', name: 'Cosmic', url: gradientBg('#1e3c72', '#2a5298', '#000428') },
  { id: 'lava', name: 'Lava', url: gradientBg('#200122', '#6f0000', '#ff4e00') },
  { id: 'mint', name: 'Mint', url: gradientBg('#43cea2', '#185a9d', '#0f2027') },
  { id: 'pastel', name: 'Pastel', url: gradientBg('#a1c4fd', '#c2e9fb', '#fbc2eb') },
  { id: 'midnight', name: 'Midnight', url: gradientBg('#020111', '#191621', '#3a1c71') },
  { id: 'rose', name: 'Rose Gold', url: gradientBg('#b06ab3', '#4568dc', '#ff9a9e') },
];

// ---------- Audio (Web Audio API, procedural piano tones) ----------
const Audio = {
  ctx: null,
  master: null,
  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.ctx.destination);
  },
  playNote(midi, duration = 0.6) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const now = ctx.currentTime;
    const end = now + duration;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, end);
    gain.connect(this.master);

    const partials = [
      { ratio: 1, gain: 1.0, type: 'triangle' },
      { ratio: 2, gain: 0.35, type: 'sine' },
      { ratio: 3, gain: 0.15, type: 'sine' },
      { ratio: 4, gain: 0.08, type: 'sine' },
    ];
    partials.forEach(p => {
      const osc = ctx.createOscillator();
      osc.type = p.type;
      osc.frequency.value = freq * p.ratio;
      const g = ctx.createGain();
      g.gain.value = p.gain;
      osc.connect(g).connect(gain);
      osc.start(now);
      osc.stop(end + 0.05);
    });
  },
  miss() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 110;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(g).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.3);
  },
};

// ---------- DOM refs ----------
const canvas = document.getElementById('game-canvas');
const ctx2d = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const comboEl = document.getElementById('combo');
const songTitleEl = document.getElementById('song-title');
const menu = document.getElementById('menu');
const menuBtn = document.getElementById('menu-btn');
const closeMenuBtn = document.getElementById('close-menu');
const startBtn = document.getElementById('start-btn');
const firstStart = document.getElementById('first-start');
const startOverlay = document.getElementById('start-overlay');
const gameOver = document.getElementById('game-over');
const goTitle = document.getElementById('go-title');
const goScore = document.getElementById('go-score');
const retryBtn = document.getElementById('retry-btn');
const backMenuBtn = document.getElementById('back-menu-btn');
const songSelect = document.getElementById('song-select');
const speedRange = document.getElementById('speed-range');
const speedValue = document.getElementById('speed-value');
const bgGrid = document.getElementById('bg-grid');
const bgUpload = document.getElementById('bg-upload');
const morphSelect = document.getElementById('morph-select');
const autoMorph = document.getElementById('auto-morph');
const morphInterval = document.getElementById('morph-interval');
const tileColor = document.getElementById('tile-color');
const tileGlow = document.getElementById('tile-glow');
const bgA = document.getElementById('bg-a');
const bgB = document.getElementById('bg-b');

// ---------- Persistent settings ----------
const LS_KEY = 'pianotiles-settings-v1';
const BG_KEY = 'pianotiles-custom-bgs-v1';

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }
  catch { return {}; }
}
function saveSettings() { localStorage.setItem(LS_KEY, JSON.stringify(settings)); }
function loadCustomBgs() {
  try { return JSON.parse(localStorage.getItem(BG_KEY) || '[]'); }
  catch { return []; }
}
function saveCustomBgs() { localStorage.setItem(BG_KEY, JSON.stringify(customBgs)); }

const settings = Object.assign({
  songId: SONGS[0].id,
  speed: 1.0,
  bgId: 'neon',
  morph: 'fade',
  autoMorph: true,
  morphInterval: 8,
  tileColor: '#111111',
  tileGlow: '#00e5ff',
}, loadSettings());

let customBgs = loadCustomBgs();

// ---------- Background handling ----------
let activeSlot = bgA;
let inactiveSlot = bgB;
let currentBgId = null;
let morphTimer = null;

function allBgs() { return [...PRESET_BGS, ...customBgs]; }
function findBg(id) { return allBgs().find(b => b.id === id); }

function applyMorph(bg) {
  if (!bg) return;
  if (bg.id === currentBgId) return;
  currentBgId = bg.id;

  const morph = settings.morph;
  const outgoing = activeSlot;
  const incoming = inactiveSlot;

  incoming.style.backgroundImage = `url("${bg.url}")`;
  incoming.classList.remove('active');
  incoming.className = 'bg-slot';

  // Reset outgoing classes (keep active until next frame)
  if (morph !== 'none') {
    incoming.classList.add(`morph-in-${morph}`);
  }

  // Force reflow so transition triggers
  void incoming.offsetWidth;

  incoming.classList.add('active');

  if (morph === 'none') {
    outgoing.classList.remove('active');
  } else {
    outgoing.classList.add(`morph-out-${morph}`);
    outgoing.classList.remove('active');
  }

  // Swap
  activeSlot = incoming;
  inactiveSlot = outgoing;

  // Cleanup outgoing after transition
  setTimeout(() => {
    outgoing.className = 'bg-slot';
    outgoing.style.backgroundImage = '';
  }, 1400);
}

function scheduleAutoMorph() {
  if (morphTimer) clearInterval(morphTimer);
  if (!settings.autoMorph) return;
  const secs = Math.max(2, Number(settings.morphInterval) || 8);
  morphTimer = setInterval(() => {
    const list = allBgs();
    if (list.length < 2) return;
    const others = list.filter(b => b.id !== currentBgId);
    const next = others[Math.floor(Math.random() * others.length)];
    applyMorph(next);
    settings.bgId = next.id;
    saveSettings();
    refreshBgGridSelection();
  }, secs * 1000);
}

// ---------- Background grid UI ----------
function renderBgGrid() {
  bgGrid.innerHTML = '';
  allBgs().forEach(bg => {
    const el = document.createElement('div');
    el.className = 'bg-thumb' + (bg.custom ? ' custom' : '') + (bg.id === settings.bgId ? ' selected' : '');
    el.style.backgroundImage = `url("${bg.url}")`;
    el.title = bg.name;
    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = bg.name;
    el.appendChild(label);
    if (bg.custom) {
      const del = document.createElement('button');
      del.className = 'del';
      del.textContent = '×';
      del.title = 'Löschen';
      del.onclick = (e) => {
        e.stopPropagation();
        customBgs = customBgs.filter(b => b.id !== bg.id);
        saveCustomBgs();
        if (settings.bgId === bg.id) {
          settings.bgId = PRESET_BGS[0].id;
          saveSettings();
          applyMorph(PRESET_BGS[0]);
        }
        renderBgGrid();
      };
      el.appendChild(del);
    }
    el.onclick = () => {
      settings.bgId = bg.id;
      saveSettings();
      applyMorph(bg);
      refreshBgGridSelection();
    };
    bgGrid.appendChild(el);
  });
}
function refreshBgGridSelection() {
  [...bgGrid.children].forEach(c => {
    const name = c.title;
    const bg = allBgs().find(b => b.name === name);
    c.classList.toggle('selected', bg && bg.id === settings.bgId);
  });
}

// ---------- Upload handling ----------
bgUpload.addEventListener('change', (e) => {
  const files = [...e.target.files];
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      // Resize/compress to keep localStorage lean
      compressImage(ev.target.result, 1280, 0.82).then(compressed => {
        const id = 'custom-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
        const bg = { id, name: file.name.replace(/\.[^.]+$/, '').slice(0, 24), url: compressed, custom: true };
        customBgs.push(bg);
        try {
          saveCustomBgs();
        } catch (err) {
          alert('Speicher voll. Entferne eigene Bilder, bevor du neue hinzufügst.');
          customBgs.pop();
          return;
        }
        renderBgGrid();
        settings.bgId = id;
        saveSettings();
        applyMorph(bg);
      });
    };
    reader.readAsDataURL(file);
  });
  bgUpload.value = '';
});

function compressImage(dataUrl, maxDim, quality) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      const scale = Math.min(1, maxDim / Math.max(width, height));
      width *= scale; height *= scale;
      const c = document.createElement('canvas');
      c.width = width; c.height = height;
      c.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });
}

// ---------- Game state ----------
const LANES = 4;
const HIT_LINE_RATIO = 0.82; // 82% down the screen
let W = 0, H = 0, laneW = 0;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  laneW = W / LANES;
}
window.addEventListener('resize', resize);

const game = {
  state: 'idle', // idle | playing | ended
  tiles: [],
  spawnIndex: 0,
  songNotes: [],
  bpm: 100,
  score: 0,
  combo: 0,
  maxCombo: 0,
  misses: 0,
  lastTime: 0,
  songStart: 0,
  laneLastSpawn: [-1, -1, -1, -1],
  speedMul: 1.0,
  tileFallSeconds: 2.0,
};

function loadSong(songId) {
  const s = SONGS.find(x => x.id === songId) || SONGS[0];
  game.songNotes = s.notes.slice();
  game.bpm = s.bpm;
  songTitleEl.textContent = s.title;
  return s;
}

function startGame() {
  Audio.init();
  loadSong(settings.songId);
  game.state = 'playing';
  game.tiles = [];
  game.spawnIndex = 0;
  game.score = 0;
  game.combo = 0;
  game.maxCombo = 0;
  game.misses = 0;
  game.speedMul = Number(settings.speed) || 1.0;
  game.tileFallSeconds = 2.0 / game.speedMul;
  game.lastTime = performance.now();
  game.songStart = game.lastTime;
  game.laneLastSpawn = [-1, -1, -1, -1];
  updateHud();
  hide(menu); hide(gameOver); hide(startOverlay);
  requestAnimationFrame(loop);
}

function chooseLane() {
  // Avoid same lane twice in a row
  const now = performance.now();
  let lane;
  let tries = 0;
  do {
    lane = Math.floor(Math.random() * LANES);
    tries++;
  } while (tries < 6 && now - game.laneLastSpawn[lane] < 180);
  game.laneLastSpawn[lane] = now;
  return lane;
}

function spawnTile(note, beats) {
  const beatSeconds = 60 / game.bpm / game.speedMul;
  const tileHeightBeats = Math.max(1, beats);
  const lane = chooseLane();
  game.tiles.push({
    lane,
    note: note,
    beats: tileHeightBeats,
    // Timing in song time (seconds since start)
    hitTime: game.songTimeCursor, // when it should reach the hit line
    endTime: game.songTimeCursor + tileHeightBeats * beatSeconds, // for holds
    hit: false,
    missed: false,
  });
  game.songTimeCursor += tileHeightBeats * beatSeconds;
}

function currentSongTime() {
  return (performance.now() - game.songStart) / 1000;
}

function loop(t) {
  if (game.state !== 'playing') return;
  const dt = (t - game.lastTime) / 1000;
  game.lastTime = t;
  const songT = currentSongTime();

  // Lazy-spawn tiles up to songT + tileFallSeconds + 1
  if (game.spawnIndex === 0) game.songTimeCursor = 0;
  while (game.spawnIndex < game.songNotes.length && game.songTimeCursor < songT + game.tileFallSeconds + 2) {
    const [midi, beats] = game.songNotes[game.spawnIndex++];
    spawnTile(midi, beats);
  }

  // Check for misses (tile past hit line)
  for (const tile of game.tiles) {
    if (!tile.hit && !tile.missed && tile.hitTime + 0.15 < songT) {
      tile.missed = true;
      game.combo = 0;
      game.misses++;
      Audio.miss();
      if (game.misses >= 3) {
        endGame();
        return;
      }
    }
  }

  // Remove tiles that have scrolled off-screen
  const cutoff = songT - 0.8;
  game.tiles = game.tiles.filter(t => t.hitTime > cutoff);

  // End when song finished
  if (game.spawnIndex >= game.songNotes.length && game.tiles.every(t => t.hit || t.missed)) {
    endGame(true);
    return;
  }

  updateHud();
  render(songT);
  requestAnimationFrame(loop);
}

function render(songT) {
  ctx2d.clearRect(0, 0, W, H);

  // Lane dividers
  ctx2d.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx2d.lineWidth = 1;
  for (let i = 1; i < LANES; i++) {
    ctx2d.beginPath();
    ctx2d.moveTo(i * laneW, 0);
    ctx2d.lineTo(i * laneW, H);
    ctx2d.stroke();
  }

  // Hit line
  const hitY = H * HIT_LINE_RATIO;
  const grad = ctx2d.createLinearGradient(0, hitY - 2, 0, hitY + 2);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.5, settings.tileGlow);
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx2d.fillStyle = grad;
  ctx2d.fillRect(0, hitY - 2, W, 4);

  // Tiles
  const fall = game.tileFallSeconds;
  const beatSeconds = 60 / game.bpm / game.speedMul;

  for (const tile of game.tiles) {
    if (tile.hit) continue;
    const dtToHit = tile.hitTime - songT; // seconds until reaching hit line
    const yBottom = hitY - (dtToHit / fall) * hitY;
    const tileH = (tile.beats * beatSeconds / fall) * hitY;
    const yTop = yBottom - tileH;

    if (yBottom < -20) continue;
    if (yTop > H + 20) continue;

    const x = tile.lane * laneW;
    const pad = 4;

    // Shadow / glow
    ctx2d.save();
    if (!tile.missed) {
      ctx2d.shadowColor = settings.tileGlow;
      ctx2d.shadowBlur = 24;
    } else {
      ctx2d.globalAlpha = 0.35;
    }
    ctx2d.fillStyle = tile.missed ? '#660000' : settings.tileColor;
    roundRect(ctx2d, x + pad, yTop + pad, laneW - pad * 2, Math.max(24, tileH - pad * 2), 10);
    ctx2d.fill();
    ctx2d.restore();

    // Top highlight
    ctx2d.save();
    ctx2d.globalAlpha = 0.18;
    ctx2d.fillStyle = '#fff';
    roundRect(ctx2d, x + pad, yTop + pad, laneW - pad * 2, 6, 6);
    ctx2d.fill();
    ctx2d.restore();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function handleTap(x, y) {
  if (game.state !== 'playing') return;
  const lane = Math.floor(x / laneW);
  if (lane < 0 || lane >= LANES) return;

  const songT = currentSongTime();
  // Find earliest active tile in this lane near hit line
  let best = null;
  let bestDt = Infinity;
  for (const tile of game.tiles) {
    if (tile.hit || tile.missed) continue;
    if (tile.lane !== lane) continue;
    const dt = Math.abs(tile.hitTime - songT);
    if (dt < bestDt && dt < 0.35) {
      best = tile;
      bestDt = dt;
    }
  }

  if (best) {
    best.hit = true;
    Audio.playNote(best.note, Math.max(0.25, best.beats * 0.35));
    game.combo++;
    if (game.combo > game.maxCombo) game.maxCombo = game.combo;
    const points = 10 + Math.min(20, game.combo);
    game.score += points;
    showHitFlash(lane * laneW + laneW / 2, H * HIT_LINE_RATIO);
  } else {
    Audio.miss();
    game.combo = 0;
    game.misses++;
    if (game.misses >= 3) endGame();
  }
  updateHud();
}

function showHitFlash(x, y) {
  const el = document.createElement('div');
  el.className = 'hit-flash';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.width = '120px';
  el.style.height = '120px';
  el.style.marginLeft = '-60px';
  el.style.marginTop = '-60px';
  document.getElementById('app').appendChild(el);
  setTimeout(() => el.remove(), 400);
}

function updateHud() {
  scoreEl.textContent = game.score;
  comboEl.textContent = game.combo > 1 ? `Combo x${game.combo}` : '';
}

function endGame(finished = false) {
  game.state = 'ended';
  goTitle.textContent = finished ? 'Fertig!' : 'Game Over';
  goScore.innerHTML = `<div style="text-align:center">
    <div style="font-size:48px;font-weight:800">${game.score}</div>
    <div style="opacity:0.7">Max Combo: ${game.maxCombo}</div>
  </div>`;
  show(gameOver);
}

// ---------- Input ----------
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  handleTap(e.clientX, e.clientY);
});
window.addEventListener('keydown', (e) => {
  if (game.state !== 'playing') return;
  const map = { 'a': 0, 's': 1, 'k': 2, 'l': 3, 'd': 1, 'j': 2 };
  const lane = map[e.key.toLowerCase()];
  if (lane !== undefined) {
    handleTap(lane * laneW + laneW / 2, H * HIT_LINE_RATIO);
  }
});

// ---------- UI wiring ----------
function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

function populateSongs() {
  songSelect.innerHTML = '';
  SONGS.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.title;
    if (s.id === settings.songId) opt.selected = true;
    songSelect.appendChild(opt);
  });
}

function applyCssVars() {
  document.documentElement.style.setProperty('--tile-color', settings.tileColor);
  document.documentElement.style.setProperty('--tile-glow', settings.tileGlow);
}

menuBtn.addEventListener('click', () => show(menu));
closeMenuBtn.addEventListener('click', () => hide(menu));
startBtn.addEventListener('click', () => startGame());
firstStart.addEventListener('click', () => { Audio.init(); hide(startOverlay); show(menu); });
retryBtn.addEventListener('click', () => startGame());
backMenuBtn.addEventListener('click', () => { hide(gameOver); show(menu); });

songSelect.addEventListener('change', () => { settings.songId = songSelect.value; saveSettings(); });
speedRange.addEventListener('input', () => {
  settings.speed = Number(speedRange.value);
  speedValue.textContent = settings.speed.toFixed(1) + 'x';
  saveSettings();
});
morphSelect.addEventListener('change', () => { settings.morph = morphSelect.value; saveSettings(); });
autoMorph.addEventListener('change', () => { settings.autoMorph = autoMorph.checked; saveSettings(); scheduleAutoMorph(); });
morphInterval.addEventListener('change', () => { settings.morphInterval = Number(morphInterval.value) || 8; saveSettings(); scheduleAutoMorph(); });
tileColor.addEventListener('input', () => { settings.tileColor = tileColor.value; applyCssVars(); saveSettings(); });
tileGlow.addEventListener('input', () => { settings.tileGlow = tileGlow.value; applyCssVars(); saveSettings(); });

// ---------- Init ----------
function init() {
  resize();
  populateSongs();
  renderBgGrid();
  speedRange.value = settings.speed;
  speedValue.textContent = Number(settings.speed).toFixed(1) + 'x';
  morphSelect.value = settings.morph;
  autoMorph.checked = settings.autoMorph;
  morphInterval.value = settings.morphInterval;
  tileColor.value = settings.tileColor;
  tileGlow.value = settings.tileGlow;
  applyCssVars();

  const bg = findBg(settings.bgId) || PRESET_BGS[0];
  // First paint: no animation
  bgA.style.backgroundImage = `url("${bg.url}")`;
  bgA.classList.add('active');
  currentBgId = bg.id;
  scheduleAutoMorph();
}
init();

})();
