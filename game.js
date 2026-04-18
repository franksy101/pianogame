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
  bgGain: null,
  beatGain: null,
  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    // Insert analyser for visualizer: master -> analyser -> destination
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.78;
    this.master.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    this.bgGain = this.ctx.createGain();
    this.bgGain.gain.value = 0.35;
    this.bgGain.connect(this.master);
    this.beatGain = this.ctx.createGain();
    this.beatGain.gain.value = 0.5;
    this.beatGain.connect(this.master);
    Visualizer.bindAnalyser(this.analyser);
  },
  // A crisp, louder note (used for user hits)
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
  // A soft, mellow "guide" note played automatically in the background so the
  // melody always runs. A clean user hit layers on top and sounds good.
  playBgNote(midi, whenOffset = 0, duration = 0.5) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const start = ctx.currentTime + Math.max(0, whenOffset);
    const end = start + duration;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.22, start + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, end);
    gain.connect(this.bgGain);

    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = freq;
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = freq * 2;
    const g2 = ctx.createGain();
    g2.gain.value = 0.25;
    osc1.connect(gain);
    osc2.connect(g2).connect(gain);
    osc1.start(start); osc1.stop(end + 0.05);
    osc2.start(start); osc2.stop(end + 0.05);
  },
  // A subtle bass note on beat 1 of each bar
  playBass(midi, whenOffset = 0, duration = 0.8) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const start = ctx.currentTime + Math.max(0, whenOffset);
    const end = start + duration;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.32, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, end);
    gain.connect(this.beatGain);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(gain);
    osc.start(start); osc.stop(end + 0.05);
  },
  // Short "tick" for every beat
  playTick(whenOffset = 0, strong = false) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const start = ctx.currentTime + Math.max(0, whenOffset);
    const end = start + 0.08;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(strong ? 0.18 : 0.08, start);
    gain.gain.exponentialRampToValueAtTime(0.001, end);
    gain.connect(this.beatGain);

    const osc = ctx.createOscillator();
    osc.type = strong ? 'square' : 'triangle';
    osc.frequency.value = strong ? 160 : 1800;
    osc.connect(gain);
    osc.start(start); osc.stop(end + 0.02);
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
  // Sustained piano tone for holds
  startSustained(midi) {
    if (!this.ctx) return null;
    const ctx = this.ctx;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.15);
    gain.connect(this.master);
    const oscs = [];
    const partials = [
      { ratio: 1, gain: 1.0, type: 'triangle' },
      { ratio: 2, gain: 0.3, type: 'sine' },
      { ratio: 3, gain: 0.12, type: 'sine' },
    ];
    partials.forEach(p => {
      const osc = ctx.createOscillator();
      osc.type = p.type;
      osc.frequency.value = freq * p.ratio;
      const g = ctx.createGain();
      g.gain.value = p.gain;
      osc.connect(g).connect(gain);
      osc.start(now);
      oscs.push(osc);
    });
    return { gain, oscs };
  },
  stopSustained(handle) {
    if (!handle || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    try {
      handle.gain.gain.cancelScheduledValues(now);
      handle.gain.gain.setValueAtTime(Math.max(0.001, handle.gain.gain.value), now);
      handle.gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      handle.oscs.forEach(o => o.stop(now + 0.22));
    } catch (_) {}
  },
};

// ---------- Visualizer (generative, music-reactive background) ----------
const Visualizer = {
  canvas: null,
  ctx: null,
  analyser: null,
  freq: null,
  time: null,
  enabled: false,
  mode: 'waves',
  hue: 200,
  accentRgb: [0, 229, 255],
  particles: null,
  plasmaBuf: null,
  plasmaCanvas: null,
  W: 0, H: 0, dpr: 1,
  t0: 0,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    this.t0 = performance.now();
    requestAnimationFrame(this.loop.bind(this));
    window.addEventListener('resize', () => this.resize());
  },
  bindAnalyser(an) {
    this.analyser = an;
    this.freq = new Uint8Array(an.frequencyBinCount);
    this.time = new Uint8Array(an.frequencyBinCount);
  },
  resize() {
    this.dpr = window.devicePixelRatio || 1;
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width = this.W * this.dpr;
    this.canvas.height = this.H * this.dpr;
    this.canvas.style.width = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.plasmaBuf = null; // force rebuild
  },
  setAccent(hex) {
    const h = hex.replace('#', '');
    this.accentRgb = [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  },
  setEnabled(on) {
    this.enabled = on;
    this.canvas.classList.toggle('on', on);
    document.body.classList.toggle('live-bg', on);
  },
  setMode(mode) {
    this.mode = mode;
    this.particles = null; // rebuild if needed
  },
  bands() {
    // Compute bass/mid/treble/overall energy in [0..1]
    if (!this.freq) return { bass: 0, mid: 0, treble: 0, avg: 0 };
    const len = this.freq.length;
    let b = 0, m = 0, tr = 0, all = 0;
    const bEnd = Math.floor(len * 0.08);
    const mEnd = Math.floor(len * 0.35);
    for (let i = 0; i < len; i++) {
      const v = this.freq[i];
      all += v;
      if (i < bEnd) b += v;
      else if (i < mEnd) m += v;
      else tr += v;
    }
    return {
      bass: (b / Math.max(1, bEnd)) / 255,
      mid: (m / Math.max(1, mEnd - bEnd)) / 255,
      treble: (tr / Math.max(1, len - mEnd)) / 255,
      avg: (all / len) / 255,
    };
  },
  loop(t) {
    requestAnimationFrame(this.loop.bind(this));
    if (!this.enabled) return;
    if (this.analyser) {
      this.analyser.getByteFrequencyData(this.freq);
      this.analyser.getByteTimeDomainData(this.time);
    }
    this.render((t - this.t0) / 1000);
  },
  render(tSec) {
    const fn = this['render_' + this.mode] || this.render_waves;
    fn.call(this, tSec);
  },

  render_waves(t) {
    const { W, H, ctx } = this;
    const b = this.bands();
    ctx.fillStyle = 'rgba(8, 10, 20, 0.22)';
    ctx.fillRect(0, 0, W, H);
    const [R, G, B] = this.accentRgb;
    const layers = 5;
    for (let l = 0; l < layers; l++) {
      const phase = t * (0.6 + l * 0.25) + l;
      const amp = 22 + l * 14 + b.bass * 110;
      const yBase = H * (0.28 + l * 0.12);
      ctx.beginPath();
      for (let x = 0; x <= W; x += 6) {
        const y = yBase
          + Math.sin(x * 0.008 + phase) * amp
          + Math.sin(x * 0.021 + phase * 1.7) * amp * 0.4
          + (this.time ? (this.time[x % this.time.length] - 128) * 0.5 * (0.3 + b.mid) : 0);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
      const a = 0.12 + l * 0.06 + b.avg * 0.25;
      const grad = ctx.createLinearGradient(0, yBase - amp, 0, H);
      grad.addColorStop(0, `rgba(${R},${G},${B},${a})`);
      grad.addColorStop(1, `rgba(${R * 0.3},${G * 0.3},${B * 0.5},0)`);
      ctx.fillStyle = grad;
      ctx.fill();
    }
  },

  render_pixels(t) {
    const { W, H, ctx } = this;
    const b = this.bands();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.fillRect(0, 0, W, H);
    const cell = 24;
    const cols = Math.ceil(W / cell);
    const rows = Math.ceil(H / cell);
    const [R, G, B] = this.accentRgb;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const freqIdx = ((i + j * 3) * 7) % (this.freq ? this.freq.length : 1);
        const v = this.freq ? this.freq[freqIdx] / 255 : 0;
        const noise = Math.sin(i * 0.4 + t * 1.1) * Math.cos(j * 0.35 - t * 0.9);
        const lvl = Math.max(0, v * 0.9 + noise * 0.25 + b.bass * 0.4);
        if (lvl < 0.15) continue;
        const a = Math.min(1, lvl);
        ctx.fillStyle = `rgba(${R},${G},${B},${a * 0.8})`;
        const s = cell - 2;
        ctx.fillRect(i * cell + 1, j * cell + 1, s, s);
      }
    }
  },

  render_sphere(t) {
    const { W, H, ctx } = this;
    const b = this.bands();
    ctx.fillStyle = 'rgba(6, 8, 20, 0.28)';
    ctx.fillRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2;
    const baseR = Math.min(W, H) * 0.18 * (1 + b.bass * 0.5);
    const [R, G, B] = this.accentRgb;
    const bins = this.freq ? this.freq.length : 0;
    const bars = 128;
    ctx.lineWidth = 2;
    for (let i = 0; i < bars; i++) {
      const idx = Math.floor((i / bars) * bins * 0.6);
      const v = this.freq ? this.freq[idx] / 255 : 0;
      const angle = (i / bars) * Math.PI * 2 + t * 0.2;
      const r1 = baseR;
      const r2 = baseR + 10 + v * Math.min(W, H) * 0.22;
      const x1 = cx + Math.cos(angle) * r1;
      const y1 = cy + Math.sin(angle) * r1;
      const x2 = cx + Math.cos(angle) * r2;
      const y2 = cy + Math.sin(angle) * r2;
      const a = 0.35 + v * 0.65;
      ctx.strokeStyle = `rgba(${R},${G},${B},${a})`;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    // Inner glow
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR);
    grad.addColorStop(0, `rgba(${R},${G},${B},${0.35 + b.avg * 0.4})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  },

  render_plasma(t) {
    const { ctx, W, H } = this;
    // Render small buffer, scale up for smoothness + perf
    const bw = 160, bh = 90;
    if (!this.plasmaBuf) {
      this.plasmaCanvas = document.createElement('canvas');
      this.plasmaCanvas.width = bw;
      this.plasmaCanvas.height = bh;
      this.plasmaBuf = this.plasmaCanvas.getContext('2d').createImageData(bw, bh);
    }
    const img = this.plasmaBuf;
    const data = img.data;
    const b = this.bands();
    const speed = 0.8 + b.bass * 2.0;
    const [R0, G0, B0] = this.accentRgb;
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        const v =
          Math.sin(x * 0.08 + t * speed) +
          Math.sin(y * 0.1 + t * speed * 0.7) +
          Math.sin((x + y) * 0.06 + t * 0.5) +
          Math.sin(Math.hypot(x - bw / 2, y - bh / 2) * 0.12 - t * speed);
        const n = (v + 4) / 8; // 0..1
        const idx = (y * bw + x) * 4;
        data[idx]     = Math.min(255, R0 * n + 30 * (1 - n));
        data[idx + 1] = Math.min(255, G0 * n * 0.9 + 20 * (1 - n));
        data[idx + 2] = Math.min(255, B0 * (0.5 + n * 0.6));
        data[idx + 3] = 255;
      }
    }
    this.plasmaCanvas.getContext('2d').putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.plasmaCanvas, 0, 0, W, H);
    // Darken overlay
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 0, W, H);
  },

  render_particles(t) {
    const { ctx, W, H } = this;
    const b = this.bands();
    if (!this.particles) {
      this.particles = [];
      const N = 140;
      for (let i = 0; i < N; i++) {
        this.particles.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * 40,
          vy: (Math.random() - 0.5) * 40,
          r: 1 + Math.random() * 3,
        });
      }
    }
    ctx.fillStyle = 'rgba(5, 7, 18, 0.25)';
    ctx.fillRect(0, 0, W, H);
    const [R, G, B] = this.accentRgb;
    const push = 1 + b.bass * 4;
    const cx = W / 2, cy = H / 2;
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      // Attract toward centre with bass pulse
      const dx = cx - p.x, dy = cy - p.y;
      const d = Math.hypot(dx, dy) + 0.001;
      p.vx += (dx / d) * (1.5 - b.bass * 3);
      p.vy += (dy / d) * (1.5 - b.bass * 3);
      p.vx += (Math.random() - 0.5) * 2;
      p.vy += (Math.random() - 0.5) * 2;
      p.vx *= 0.96; p.vy *= 0.96;
      p.x += p.vx * 0.05 * push;
      p.y += p.vy * 0.05 * push;
      if (p.x < 0) p.x += W; if (p.x > W) p.x -= W;
      if (p.y < 0) p.y += H; if (p.y > H) p.y -= H;
      const rad = p.r * (1 + b.avg * 2);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad * 6);
      g.addColorStop(0, `rgba(${R},${G},${B},${0.6 + b.treble * 0.4})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad * 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  },

  render_tunnel(t) {
    const { ctx, W, H } = this;
    const b = this.bands();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fillRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2;
    const rings = 18;
    const [R, G, B] = this.accentRgb;
    for (let i = 0; i < rings; i++) {
      const p = ((i / rings) + (t * (0.15 + b.bass * 0.3)) % 1) % 1;
      const r = p * Math.max(W, H) * 0.9;
      const a = (1 - p) * (0.25 + b.avg * 0.6);
      ctx.strokeStyle = `rgba(${R},${G},${B},${a})`;
      ctx.lineWidth = 2 + b.bass * 6;
      ctx.beginPath();
      const sides = 32;
      for (let s = 0; s <= sides; s++) {
        const ang = (s / sides) * Math.PI * 2 + t * 0.4 + i * 0.05;
        const wobble = 1 + Math.sin(ang * 3 + t * 2) * 0.06 * (1 + b.treble);
        const x = cx + Math.cos(ang) * r * wobble;
        const y = cy + Math.sin(ang) * r * wobble;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
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
const maxMissesSelect = document.getElementById('max-misses');
const songLoopsSelect = document.getElementById('song-loops');
const liveBgCheck = document.getElementById('live-bg');
const liveModeSelect = document.getElementById('live-mode');
const liveHueInput = document.getElementById('live-hue-color');
const visualCanvas = document.getElementById('visual-canvas');
const helpBtn = document.getElementById('help-btn');
const helpOverlay = document.getElementById('help-overlay');
const closeHelpBtn = document.getElementById('close-help');
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
  maxMisses: 3, // 0 = unlimited
  songLoops: 2, // repeat song N times for longer playtime
  liveBg: false,
  liveMode: 'waves',
  liveHue: '#00e5ff',
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

const LEAD_IN_SECONDS = 3.0; // countdown before first tile reaches hit line
const SONG_LOOPS = 2;         // repeat each song to extend playtime
const HIT_EARLY = 0.9;        // how far BEFORE the line a hit is accepted (s)
const HIT_LATE = 0.22;        // how far AFTER the line a hit is still counted

function loadSong(songId) {
  const s = SONGS.find(x => x.id === songId) || SONGS[0];
  const loops = Math.max(1, Number(settings.songLoops) || SONG_LOOPS);
  const notes = [];
  for (let i = 0; i < loops; i++) notes.push(...s.notes);
  game.songNotes = notes;
  game.bpm = s.bpm;
  songTitleEl.textContent = s.title + (loops > 1 ? `  ·  ${loops}×` : '');
  return s;
}

function startGame() {
  Audio.init();
  loadSong(settings.songId);
  game.state = 'playing';
  game.tiles = [];
  game.spawnIndex = 0;
  game.bgNoteIndex = 0;
  game.nextBeatIndex = 0;
  game.score = 0;
  game.combo = 0;
  game.maxCombo = 0;
  game.misses = 0;
  game.maxMisses = Number(settings.maxMisses) || 0;
  game.speedMul = Number(settings.speed) || 1.0;
  game.tileFallSeconds = 2.0 / game.speedMul;
  game.lastTime = performance.now();
  // Offset start so songT begins at -LEAD_IN_SECONDS
  game.songStart = game.lastTime + LEAD_IN_SECONDS * 1000;
  game.laneLastSpawn = [-1, -1, -1, -1];
  game.songTimeCursor = 0;
  updateHud();
  hide(menu); hide(gameOver); hide(startOverlay); hide(helpOverlay);
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
  const beatSeconds = 60 / game.bpm / game.speedMul;

  // Spawn tiles ahead so the first one reaches the hit line at songT=0
  while (game.spawnIndex < game.songNotes.length && game.songTimeCursor < songT + game.tileFallSeconds + 2) {
    const [midi, beats] = game.songNotes[game.spawnIndex++];
    spawnTile(midi, beats);
  }

  // Auto-play the melody as a soft background track. User hits layer on top.
  while (game.bgNoteIndex < game.tiles.length) {
    const tile = game.tiles[game.bgNoteIndex];
    if (!tile) break;
    if (tile.bgPlayed) { game.bgNoteIndex++; continue; }
    // Schedule once the note is within ~0.2s of the hit line
    if (tile.hitTime - songT <= 0.02) {
      tile.bgPlayed = true;
      // Quiet auto-play only if user hasn't already hit it (to avoid doubling)
      if (!tile.hit) {
        Audio.playBgNote(tile.note, 0, Math.max(0.25, tile.beats * beatSeconds * 0.6));
      }
      game.bgNoteIndex++;
    } else {
      break;
    }
  }

  // Metronome: tick every beat, strong tick at the downbeat; bass on downbeat
  const beatIndexNow = Math.floor(songT / beatSeconds);
  while (game.nextBeatIndex <= beatIndexNow + 1) {
    const beatT = game.nextBeatIndex * beatSeconds;
    const when = beatT - songT; // seconds from now
    if (when >= -0.01) {
      const strong = (game.nextBeatIndex % 4) === 0;
      Audio.playTick(Math.max(0, when), strong);
      if (strong) {
        // Soft bass root two octaves below current-ish melody
        const upcoming = game.tiles.find(tl => !tl.hit && tl.hitTime >= beatT - 0.1);
        const bassMidi = upcoming ? upcoming.note - 24 : 36;
        Audio.playBass(bassMidi, Math.max(0, when), beatSeconds * 1.8);
      }
    }
    game.nextBeatIndex++;
  }

  // Check for misses (tile past hit line by more than HIT_LATE)
  for (const tile of game.tiles) {
    if (!tile.hit && !tile.missed && tile.hitTime + HIT_LATE < songT) {
      tile.missed = true;
      game.combo = 0;
      game.misses++;
      if (game.maxMisses > 0 && game.misses >= game.maxMisses) {
        endGame();
        return;
      }
    }
  }

  // Update active holds: continuous scoring, sparks, pulse vibration
  const nowMs = performance.now();
  for (const [id, h] of activeHolds) {
    const elapsed = songT - h.startSongT;
    const maxHold = Math.max(0, h.endsAt - h.tile.hitTime); // hold duration in seconds
    const active = songT < h.endsAt + 0.1;

    if (active && elapsed > 0) {
      // Award bonus points proportional to held time (cap at tile length)
      const effective = Math.min(elapsed, maxHold);
      const delta = Math.max(0, effective - (h.lastScoreT - h.startSongT));
      if (delta > 0) {
        game.score += Math.round(delta * 40); // 40 pts per held second
      }
      h.lastScoreT = songT;

      // Periodic vibration pulse (every ~120ms)
      if (nowMs - h.lastVibT > 120) {
        vibrate(18);
        h.lastVibT = nowMs;
      }

      // Emit sparks at pointer position
      if (nowMs - h.lastSparkT > 28) {
        spawnSparks(h.x, h.y, 3);
        h.lastSparkT = nowMs;
      }
    } else {
      // Natural end of the long note: stop audio but keep hold "alive" until release
      if (h.audio) {
        Audio.stopSustained(h.audio);
        h.audio = null;
      }
    }
  }

  // Update spark particles
  updateSparks(dt);

  // Remove tiles that have scrolled off-screen
  const cutoff = songT - 1.2;
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
    const dtToHit = tile.hitTime - songT;
    const yBottom = hitY - (dtToHit / fall) * hitY;
    const tileH = (tile.beats * beatSeconds / fall) * hitY;
    const yTop = yBottom - tileH;

    if (yBottom < -20) continue;
    if (yTop > H + 20) continue;

    const x = tile.lane * laneW;
    const pad = 4;

    // Regular (not yet hit) tile
    if (!tile.hit) {
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

      ctx2d.save();
      ctx2d.globalAlpha = 0.18;
      ctx2d.fillStyle = '#fff';
      roundRect(ctx2d, x + pad, yTop + pad, laneW - pad * 2, 6, 6);
      ctx2d.fill();
      ctx2d.restore();
      continue;
    }

    // Held / hit tile: keep drawing the remaining body with a pulsing glow
    // while the player holds it.
    if (tile.holding && songT < tile.endTime + 0.05) {
      const pulse = 0.5 + 0.5 * Math.sin(songT * 14);
      const remainTop = Math.min(yTop, hitY);
      const remainBottom = hitY;
      const h2 = Math.max(12, remainBottom - remainTop - pad * 2);
      ctx2d.save();
      ctx2d.shadowColor = settings.tileGlow;
      ctx2d.shadowBlur = 20 + pulse * 30;
      ctx2d.globalAlpha = 0.85;
      ctx2d.fillStyle = settings.tileGlow;
      roundRect(ctx2d, x + pad, remainTop + pad, laneW - pad * 2, h2, 10);
      ctx2d.fill();
      ctx2d.restore();

      // Bright core
      ctx2d.save();
      ctx2d.globalAlpha = 0.3 + pulse * 0.4;
      ctx2d.fillStyle = '#ffffff';
      roundRect(ctx2d, x + pad + 4, remainTop + pad + 4, laneW - pad * 2 - 8, Math.max(4, h2 - 8), 8);
      ctx2d.fill();
      ctx2d.restore();
    }
  }

  renderSparks();

  // Countdown overlay during lead-in
  if (songT < 0) {
    const remaining = Math.ceil(-songT);
    ctx2d.save();
    ctx2d.globalAlpha = 0.85;
    ctx2d.textAlign = 'center';
    ctx2d.textBaseline = 'middle';
    ctx2d.fillStyle = settings.tileGlow;
    ctx2d.shadowColor = settings.tileGlow;
    ctx2d.shadowBlur = 30;
    ctx2d.font = 'bold 180px system-ui, sans-serif';
    ctx2d.fillText(String(remaining), W / 2, H / 2);
    ctx2d.font = 'bold 24px system-ui, sans-serif';
    ctx2d.shadowBlur = 0;
    ctx2d.fillStyle = 'rgba(255,255,255,0.85)';
    ctx2d.fillText('Bereit machen…', W / 2, H / 2 + 120);
    ctx2d.restore();
  }
}

// ---------- Sparks (hold particles) ----------
function spawnSparks(x, y, n) {
  if (!game.sparks) game.sparks = [];
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 220;
    game.sparks.push({
      x, y,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed - 30,
      life: 0,
      maxLife: 0.45 + Math.random() * 0.35,
      size: 1 + Math.random() * 2.2,
    });
  }
  if (game.sparks.length > 600) game.sparks.splice(0, game.sparks.length - 600);
}

function updateSparks(dt) {
  if (!game.sparks) return;
  const next = [];
  for (const s of game.sparks) {
    s.life += dt;
    if (s.life >= s.maxLife) continue;
    s.vy += 420 * dt;        // gravity
    s.vx *= 1 - 1.4 * dt;
    s.vy *= 1 - 0.6 * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    next.push(s);
  }
  game.sparks = next;
}

function renderSparks() {
  if (!game.sparks || game.sparks.length === 0) return;
  const ctx = ctx2d;
  const glow = settings.tileGlow;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const s of game.sparks) {
    const a = 1 - s.life / s.maxLife;
    const r = s.size * (1 + a);
    const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 4);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.35, glow);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.globalAlpha = Math.max(0, a);
    ctx.beginPath();
    ctx.arc(s.x, s.y, r * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
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

// Active holds keyed by pointer (or keyboard) id.
// state: { lane, tile, audio, x, y, startSongT, lastScoreT, lastVibT, lastSparkT, endsAt }
const activeHolds = new Map();

function vibrate(pattern) {
  if (navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch (_) {}
  }
}

function startHit(holdId, lane, x, y) {
  if (game.state !== 'playing') return;
  if (lane < 0 || lane >= LANES) return;
  const songT = currentSongTime();

  // Find the closest unhit tile in this lane inside the hit window
  let best = null;
  let bestAbs = Infinity;
  for (const tile of game.tiles) {
    if (tile.hit || tile.missed) continue;
    if (tile.lane !== lane) continue;
    const rel = tile.hitTime - songT;
    if (rel > HIT_EARLY) continue;
    if (rel < -HIT_LATE) continue;
    const abs = Math.abs(rel);
    if (abs < bestAbs) { best = tile; bestAbs = abs; }
  }

  if (!best) {
    // Missed tap
    Audio.miss();
    vibrate([8, 30, 8]);
    game.combo = 0;
    game.misses++;
    if (game.maxMisses > 0 && game.misses >= game.maxMisses) endGame();
    updateHud();
    return;
  }

  best.hit = true;
  best.holding = true;
  const offset = Math.abs(best.hitTime - songT);
  let quality = 'good';
  if (offset < 0.08) quality = 'perfect';
  else if (offset < 0.2) quality = 'great';
  game.combo++;
  if (game.combo > game.maxCombo) game.maxCombo = game.combo;
  const base = quality === 'perfect' ? 30 : quality === 'great' ? 20 : 10;
  game.score += base + Math.min(20, game.combo);
  showHitFlash(lane * laneW + laneW / 2, H * HIT_LINE_RATIO, quality);

  // Start sustained tone and track the hold
  const audio = Audio.startSustained(best.note);
  vibrate(quality === 'perfect' ? 45 : 28);

  activeHolds.set(holdId, {
    lane,
    tile: best,
    audio,
    x: x == null ? lane * laneW + laneW / 2 : x,
    y: y == null ? H * HIT_LINE_RATIO : y,
    startSongT: songT,
    lastScoreT: songT,
    lastVibT: performance.now(),
    lastSparkT: 0,
    endsAt: best.endTime,
  });
  updateHud();
}

function moveHit(holdId, x, y) {
  const h = activeHolds.get(holdId);
  if (!h) return;
  h.x = x; h.y = y;
}

function endHit(holdId) {
  const h = activeHolds.get(holdId);
  if (!h) return;
  activeHolds.delete(holdId);
  if (h.audio) Audio.stopSustained(h.audio);
  if (h.tile) h.tile.holding = false;
  vibrate(10);
}

function showHitFlash(x, y, quality = 'good') {
  const el = document.createElement('div');
  el.className = 'hit-flash';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.width = '120px';
  el.style.height = '120px';
  el.style.marginLeft = '-60px';
  el.style.marginTop = '-60px';
  if (quality === 'perfect') el.style.filter = 'hue-rotate(60deg) brightness(1.3)';
  else if (quality === 'great') el.style.filter = 'hue-rotate(20deg)';
  document.getElementById('app').appendChild(el);
  setTimeout(() => el.remove(), 400);

  if (quality !== 'good') {
    const label = document.createElement('div');
    label.className = 'hit-label ' + quality;
    label.textContent = quality === 'perfect' ? 'PERFECT' : 'GREAT';
    label.style.left = x + 'px';
    label.style.top = (y - 40) + 'px';
    document.getElementById('app').appendChild(label);
    setTimeout(() => label.remove(), 700);
  }
}

function updateHud() {
  scoreEl.textContent = game.score;
  const parts = [];
  if (game.combo > 1) parts.push(`Combo x${game.combo}`);
  if (game.maxMisses > 0) {
    const left = Math.max(0, game.maxMisses - game.misses);
    parts.push('♥'.repeat(left) + '·'.repeat(game.maxMisses - left));
  }
  comboEl.textContent = parts.join('   ');
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
  try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  const lane = Math.floor(e.clientX / laneW);
  startHit('p' + e.pointerId, lane, e.clientX, e.clientY);
});
canvas.addEventListener('pointermove', (e) => {
  moveHit('p' + e.pointerId, e.clientX, e.clientY);
});
const endPointer = (e) => endHit('p' + e.pointerId);
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', endPointer);

const KEY_LANE = { 'a': 0, 's': 1, 'k': 2, 'l': 3, 'd': 1, 'j': 2 };
window.addEventListener('keydown', (e) => {
  if (game.state !== 'playing') return;
  if (e.repeat) return;
  const lane = KEY_LANE[e.key.toLowerCase()];
  if (lane !== undefined) {
    startHit('k' + e.key.toLowerCase(), lane,
      lane * laneW + laneW / 2, H * HIT_LINE_RATIO);
  }
});
window.addEventListener('keyup', (e) => {
  const lane = KEY_LANE[e.key.toLowerCase()];
  if (lane !== undefined) endHit('k' + e.key.toLowerCase());
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
maxMissesSelect.addEventListener('change', () => {
  settings.maxMisses = Number(maxMissesSelect.value);
  saveSettings();
});
songLoopsSelect.addEventListener('change', () => {
  settings.songLoops = Number(songLoopsSelect.value) || 1;
  saveSettings();
});
liveBgCheck.addEventListener('change', () => {
  settings.liveBg = liveBgCheck.checked;
  saveSettings();
  Visualizer.setEnabled(settings.liveBg);
  if (settings.liveBg) Audio.init();
});
liveModeSelect.addEventListener('change', () => {
  settings.liveMode = liveModeSelect.value;
  saveSettings();
  Visualizer.setMode(settings.liveMode);
});
liveHueInput.addEventListener('input', () => {
  settings.liveHue = liveHueInput.value;
  saveSettings();
  Visualizer.setAccent(settings.liveHue);
});

helpBtn.addEventListener('click', () => show(helpOverlay));
closeHelpBtn.addEventListener('click', () => hide(helpOverlay));

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
  maxMissesSelect.value = String(settings.maxMisses);
  songLoopsSelect.value = String(settings.songLoops);
  liveBgCheck.checked = !!settings.liveBg;
  liveModeSelect.value = settings.liveMode;
  liveHueInput.value = settings.liveHue;
  applyCssVars();

  Visualizer.init(visualCanvas);
  Visualizer.setAccent(settings.liveHue);
  Visualizer.setMode(settings.liveMode);
  Visualizer.setEnabled(!!settings.liveBg);

  const bg = findBg(settings.bgId) || PRESET_BGS[0];
  // First paint: no animation
  bgA.style.backgroundImage = `url("${bg.url}")`;
  bgA.classList.add('active');
  currentBgId = bg.id;
  scheduleAutoMorph();
}
init();

})();
