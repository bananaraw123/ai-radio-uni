/* AIラジオ大学 — アプリ本体
   外部サービスは使わず、ブラウザ内蔵の機能だけで動きます：
   IndexedDB（講義と音声の保存）/ Media Session（ロック画面・車のボタン）/
   Web Speech（音声合成の講義とアナウンス）/ Web Audio（チャイム）/ Wake Lock（画面点灯） */
'use strict';
(() => {
const SEED = window.AIRU_SEED;

/* ================= 小道具 ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = n => String(n).padStart(2, '0');
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
function fmt(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
function fmtMin(sec) {
  const m = Math.round((sec || 0) / 60);
  if (m < 60) return `${m}分`;
  return `${Math.floor(m / 60)}時間${m % 60 ? (m % 60) + '分' : ''}`;
}
function hashStr(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

const ICON = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4.2" height="14" rx="1.2"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.2"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/></svg>',
  fwd: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v4h-4"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 6.2v11.6a.9.9 0 0 0 1.4.75L15 12.75a.9.9 0 0 0 0-1.5L6.4 5.45A.9.9 0 0 0 5 6.2z"/><rect x="16.5" y="5" width="2.6" height="14" rx="1"/></svg>',
  prev: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.2v11.6a.9.9 0 0 1-1.4.75L9 12.75a.9.9 0 0 1 0-1.5l8.6-5.8A.9.9 0 0 1 19 6.2z"/><rect x="4.9" y="5" width="2.6" height="14" rx="1"/></svg>',
  car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 16V11l1.8-4.2A2 2 0 0 1 8.6 5.6h6.8a2 2 0 0 1 1.8 1.2L19 11v5"/><path d="M3.5 16h17v2.2a.8.8 0 0 1-.8.8h-1.9a.8.8 0 0 1-.8-.8V16M7.5 16v2.2a.8.8 0 0 1-.8.8H4.3a.8.8 0 0 1-.8-.8V16"/><path d="M5 11h14"/><circle cx="8" cy="13.5" r=".6" fill="currentColor"/><circle cx="16" cy="13.5" r=".6" fill="currentColor"/></svg>',
  mark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M7 3.5h10a1 1 0 0 1 1 1V21l-6-4.2L6 21V4.5a1 1 0 0 1 1-1z"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M3 10.5 12 4l9 6.5"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-5h4v5"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
  lab: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
  phones: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="5" height="7" rx="2"/><rect x="16" y="14" width="5" height="7" rx="2"/></svg>',
  radio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="3" y="8" width="18" height="12" rx="2"/><path d="m7 8 9-5"/><circle cx="15.5" cy="14" r="2.6"/><path d="M6.5 12.5h4M6.5 15.5h4"/></svg>'
};

/* ================= 保存（IndexedDB。使えない環境ではメモリに退避） ================= */
const DB = {
  db: null, mem: null,
  open() {
    return new Promise(res => {
      const fallback = () => { this.mem = { lectures: new Map(), notes: new Map(), blobs: new Map(), kv: new Map() }; res(); };
      try {
        const r = indexedDB.open('ai-radio-univ', 1);
        r.onupgradeneeded = () => {
          const d = r.result;
          for (const n of ['lectures', 'notes']) if (!d.objectStoreNames.contains(n)) d.createObjectStore(n, { keyPath: 'id' });
          for (const n of ['blobs', 'kv']) if (!d.objectStoreNames.contains(n)) d.createObjectStore(n);
        };
        r.onsuccess = () => { this.db = r.result; res(); };
        r.onerror = fallback; r.onblocked = fallback;
      } catch { fallback(); }
    });
  },
  req(store, mode, fn) {
    return new Promise((res, rej) => {
      let t; try { t = this.db.transaction(store, mode); } catch (e) { return rej(e); }
      const r = fn(t.objectStore(store));
      t.oncomplete = () => res(r ? r.result : undefined);
      t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  },
  get(st, k) { return this.mem ? Promise.resolve(this.mem[st].get(k)) : this.req(st, 'readonly', s => s.get(k)); },
  all(st) { return this.mem ? Promise.resolve([...this.mem[st].values()]) : this.req(st, 'readonly', s => s.getAll()); },
  put(st, v, k) {
    if (this.mem) { this.mem[st].set(k ?? v.id, v); return Promise.resolve(); }
    return this.req(st, 'readwrite', s => (k === undefined ? s.put(v) : s.put(v, k)));
  },
  del(st, k) { if (this.mem) { this.mem[st].delete(k); return Promise.resolve(); } return this.req(st, 'readwrite', s => s.delete(k)); },
  clear(st) { if (this.mem) { this.mem[st].clear(); return Promise.resolve(); } return this.req(st, 'readwrite', s => s.clear()); }
};

/* ================= 状態 ================= */
const DEFAULTS = { quickImport: true, theme: 'auto', announcer: true, chime: true, back: 15, fwd: 30, rate: 1, voiceURI: '', enrolled: dayKey(), studentNo: '' };
const S = {
  lectures: [], faculties: [], progress: {}, notes: [], logs: {}, settings: { ...DEFAULTS },
  view: 'home', facultyView: null, libQuery: '', libFac: 'all', libStatus: 'all', studioTab: 'import', pending: [],
  station: lsGet('airu.station', 'all')
};
const fac = id => S.faculties.find(f => f.id === id) || { id: 'none', name: '学部未設定', short: '未設定', seal: '無', color: '#6b7488', freq: '--', professor: '客員', pitch: 1, rate: 1 };
const lect = id => S.lectures.find(l => l.id === id);
const prog = id => S.progress[id] || {};
const profName = l => { const p = (l.professor || fac(l.facultyId).professor || '').trim(); return !p ? '' : /(教授|先生|博士|講師|氏)$/.test(p) ? p : p + ' 教授'; };
const save = {
  progress: debounce(() => DB.put('kv', S.progress, 'progress'), 800),
  logs: debounce(() => DB.put('kv', S.logs, 'logs'), 2000),
  settings: () => DB.put('kv', S.settings, 'settings'),
  faculties: () => DB.put('kv', S.faculties, 'faculties')
};
function debounce(fn, ms) { let t; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; }

/* 講義台本を文単位に分ける。【見出し】だけの行は読み上げない */
const sentCache = new Map();
function sentences(text) {
  if (sentCache.has(text)) return sentCache.get(text);
  const out = String(text || '').replace(/([。！？!?])/g, '$1\n').split(/\n+/).map(s => s.trim())
    .filter(s => s && !/^[【［\[][^】］\]]*[】］\]]$/.test(s) && !/^[#＃■◆●・\-—]+$/.test(s));
  sentCache.set(text, out); return out;
}
const CPS = 7.2; // 日本語の読み上げ速度の目安（文字/秒）
function scriptDuration(text) { return Math.round(sentences(text).join('').length / CPS); }
function lectDuration(l) { return l.type === 'script' ? scriptDuration(l.script) : (l.duration || 0); }
function lectPct(l) {
  const p = prog(l.id); if (p.done) return 1;
  if (!p.pos) return 0;
  if (l.type === 'script') { const n = sentences(l.script).length; return n ? p.pos / n : 0; }
  return l.duration ? p.pos / l.duration : 0;
}
function status(l) { const p = prog(l.id); return p.done ? 'done' : (p.pos > 0 ? 'doing' : 'new'); }
const STATUS_LABEL = { done: '修了', doing: '聴講中', new: '未聴講' };

/* 単位と学位 */
const FAC_RANKS = [[0, '聴講生'], [1, '学部生'], [3, '学士'], [6, '修士'], [10, '博士'], [20, '教授'], [40, '名誉教授']];
const ALL_RANKS = [[0, '入学予定者'], [1, '新入生'], [5, '学部生'], [12, '学士'], [25, '修士'], [45, '博士'], [80, '名誉博士'], [150, '賢者']];
const rankOf = (n, table) => { let r = table[0], nx = null; for (let i = 0; i < table.length; i++) { if (n >= table[i][0]) { r = table[i]; nx = table[i + 1] || null; } } return { name: r[1], next: nx }; };
const credits = facId => S.lectures.filter(l => (!facId || l.facultyId === facId) && prog(l.id).done).length;
function streak() {
  const ok = k => (S.logs[k] || 0) >= 60;
  const d = new Date(); if (!ok(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0; while (ok(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function longestStreak() {
  const keys = Object.keys(S.logs).filter(k => S.logs[k] >= 60).sort();
  let best = 0, cur = 0, prev = null;
  for (const k of keys) { const t = new Date(k + 'T00:00:00'); cur = prev && (t - prev) / 864e5 === 1 ? cur + 1 : 1; best = Math.max(best, cur); prev = t; }
  return best;
}
const totalSec = () => Object.values(S.logs).reduce((a, b) => a + b, 0);

/* ================= 学部の印を画像に（ロック画面・車のディスプレイ用） ================= */
const artCache = new Map();
/* ロック画面・車の画面に出すジャケット画像：教授キャラをPNGにする */
function avatarPNG(f) {
  const key = 'avapng' + f.id + f.color;
  if (artCache.has(key)) return Promise.resolve(artCache.get(key));
  return new Promise(res => {
    try {
      const img = new Image();
      img.onload = () => { try { const c = document.createElement('canvas'); c.width = c.height = 512; c.getContext('2d').drawImage(img, 0, 0, 512, 512); const u = c.toDataURL('image/png'); artCache.set(key, u); res(u); } catch { res(''); } };
      img.onerror = () => res('');
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(avatarSVG(f).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" '));
    } catch { res(''); }
  });
}
function sealArt(f) {
  if (artCache.has(f.id + f.color + f.seal)) return artCache.get(f.id + f.color + f.seal);
  let url = '';
  try {
    const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
    g.fillStyle = '#0d1220'; g.fillRect(0, 0, 512, 512);
    g.fillStyle = f.color; roundRect(g, 56, 56, 400, 400, 60); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 10; roundRect(g, 84, 84, 344, 344, 40); g.stroke();
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 230px "Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif'; g.fillText(f.seal, 256, 270);
    url = c.toDataURL('image/png');
  } catch {}
  artCache.set(f.id + f.color + f.seal, url); return url;
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
/* 教授のキャラクター（丸・角の丸い四角だけで描く。色は少なく、表情は笑顔） */
const INK = '#2b2347', SKIN = '#ffe1c7';
const RADIO_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="50" fill="#5b6cff"/><rect x="58" y="16" width="5" height="22" rx="2.5" fill="#ffd34d" transform="rotate(30 60 27)"/><circle cx="68" cy="15" r="5" fill="#ffd34d"/>
  <rect x="20" y="36" width="60" height="40" rx="14" fill="#fff"/><circle cx="62" cy="56" r="11" fill="#ff6b3d"/><circle cx="62" cy="56" r="4.5" fill="#fff"/><rect x="29" y="47" width="18" height="5" rx="2.5" fill="#d9d3f5"/><rect x="29" y="57" width="18" height="5" rx="2.5" fill="#d9d3f5"/>
  <path d="M37 66q3 3 6 0" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`;
const EYES = `<path d="M39 47q4-4 8 0M53 47q4-4 8 0" stroke="${INK}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`;
const FACE_BASE = `<circle cx="37" cy="54" r="3.4" fill="#ff9aa8" opacity=".7"/><circle cx="63" cy="54" r="3.4" fill="#ff9aa8" opacity=".7"/><path d="M45 57q5 5 10 0" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
const AVA = {
  ai: { shirt: '#ffffff', back: `<path d="M27 46q0-26 23-26t23 26q-7-12-23-12t-23 12z" fill="#3b3557"/>`,
        front: `<circle cx="43" cy="47" r="7" fill="none" stroke="${INK}" stroke-width="2.4"/><circle cx="57" cy="47" r="7" fill="none" stroke="${INK}" stroke-width="2.4"/><path d="M50 47h0" stroke="${INK}" stroke-width="2.4"/><rect x="45" y="78" width="10" height="10" rx="3" fill="#4f8cff"/>`, eyes: `<circle cx="43" cy="47" r="2" fill="${INK}"/><circle cx="57" cy="47" r="2" fill="${INK}"/>` },
  space: { shirt: '#fff4c9', back: `<path d="M24 50q0-30 26-30t26 30v22q-6 4-10 0V44q-6-10-16-10t-16 10v28q-4 4-10 0z" fill="#5a3e8c"/>`,
        front: `<circle cx="70" cy="28" r="6" fill="#ffd34d"/><ellipse cx="70" cy="28" rx="11" ry="3.4" fill="none" stroke="#ffd34d" stroke-width="2.2"/>` },
  philo: { shirt: '#e9e4ff', back: `<circle cx="29" cy="42" r="6" fill="#d8d3e6"/><circle cx="71" cy="42" r="6" fill="#d8d3e6"/>`,
        front: `<path d="M34 58q16 22 32 0q-4 10-16 10t-16-10z" fill="#e8e3f2"/>` },
  psy: { shirt: '#ffe2ec', back: `<path d="M26 50q0-28 24-28t24 28v8q-5 2-8-2V40q-6-8-16-8t-16 8v16q-3 4-8 2z" fill="#8a4b3b"/>`,
        front: `<circle cx="66" cy="26" r="5" fill="#ff6b8b"/><circle cx="74" cy="30" r="5" fill="#ff6b8b"/>` },
  myst: { shirt: '#4b2e7a', back: `<path d="M20 74q0-50 30-56q30 6 30 56z" fill="#4b2e7a"/>`,
        front: `<circle cx="66" cy="30" r="5" fill="#ffe17a"/><circle cx="68.5" cy="28" r="4.5" fill="#4b2e7a"/>` },
  relig: { shirt: '#c98a3a', back: '',
        front: `<g fill="#6b3f1d">${[30, 38, 46, 54, 62, 70].map((x, i) => `<circle cx="${x}" cy="${78 + Math.abs(i - 2.5) * -1.6 + 4}" r="2.6"/>`).join('')}</g>` },
  econ: { shirt: '#ffffff', back: `<path d="M27 44q0-24 23-24t23 24q-3-8-12-10q-14 6-34 10z" fill="#2f2a2a"/>`,
        front: `<circle cx="44" cy="80" r="4" fill="#ff6b3d"/><circle cx="56" cy="80" r="4" fill="#ff6b3d"/><circle cx="50" cy="80" r="2.6" fill="#d9481e"/>` },
  hist: { shirt: '#f4e3c8', back: `<rect x="27" y="18" width="46" height="12" rx="6" fill="#7a4a2a"/><rect x="34" y="10" width="32" height="14" rx="6" fill="#7a4a2a"/>`,
        front: `<path d="M41 55q9-5 18 0q-9 3-18 0z" fill="#7a4a2a"/>` }
};
function avatarSVG(f) {
  const a = AVA[f.id] || { shirt: '#ffffff', back: '', front: `<text x="50" y="86" text-anchor="middle" font-size="13" font-weight="700" fill="${INK}">${esc(f.seal)}</text>` };
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="50" fill="${esc(f.color)}"/>${a.back}
    <path d="M16 104q0-32 34-32t34 32z" fill="${a.shirt}"/><circle cx="50" cy="48" r="22" fill="${SKIN}"/>${a.eyes || EYES}${FACE_BASE}${a.front}</svg>`;
}
const sealHTML = (f, size = '') => `<span class="ava ${size}">${avatarSVG(f)}</span>`;

/* ================= チャイム（Web Audio） ================= */
const Chime = {
  ctx: null,
  unlock() { try { this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)(); if (this.ctx.state === 'suspended') this.ctx.resume(); } catch {} },
  play(kind = 'next') {
    return new Promise(res => {
      if (!S.settings.chime || !this.ctx) return res();
      const notes = kind === 'credit' ? [659.3, 784, 1046.5, 1318.5] : kind === 'open' ? [392, 523.3, 659.3, 784] : [523.3, 659.3, 784];
      const step = kind === 'credit' ? 0.12 : 0.26;
      try {
        const t0 = this.ctx.currentTime + 0.05;
        notes.forEach((f, i) => {
          for (const [mul, vol] of [[1, 0.16], [2.01, 0.04]]) {
            const o = this.ctx.createOscillator(), g = this.ctx.createGain(), t = t0 + i * step;
            o.type = 'sine'; o.frequency.value = f * mul;
            g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0005, t + 1.3);
            o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + 1.4);
          }
        });
      } catch {}
      setTimeout(res, notes.length * step * 1000 + 650);
    });
  }
};

/* ================= 音声合成（台本講義とアナウンサー） ================= */
const Voice = {
  ok: 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window,
  list: [],
  load() { if (!this.ok) return; const v = speechSynthesis.getVoices(); this.list = v.filter(x => /^ja/i.test(x.lang)); },
  pick() { return this.list.find(v => v.voiceURI === S.settings.voiceURI) || this.list.find(v => /Kyoko|O-ren|Google|Nanami|Haruka/i.test(v.name)) || this.list[0] || null; },
  utter(text, { pitch = 1, rate = 1 } = {}) {
    const u = new SpeechSynthesisUtterance(text); u.lang = 'ja-JP';
    const v = this.pick(); if (v) u.voice = v;
    u.pitch = clamp(pitch, 0.5, 1.6); u.rate = clamp(rate, 0.5, 2.5); return u;
  },
  say(text, opt) {
    return new Promise(res => {
      if (!this.ok) return res();
      let done = false; const fin = () => { if (!done) { done = true; res(); } };
      try { speechSynthesis.cancel(); const u = this.utter(text, opt); u.onend = fin; u.onerror = fin; speechSynthesis.speak(u); } catch { fin(); }
      setTimeout(fin, 2500 + text.length * 260);
    });
  }
};
if (Voice.ok) { Voice.load(); speechSynthesis.onvoiceschanged = () => { Voice.load(); if (S.view === 'prefs') render(); }; }

const Speech = {
  list: [], idx: 0, playing: false, token: 0, opt: {}, onEnd: null, onStep: null, keep: null,
  load(text, opt) { this.stop(); this.list = sentences(text); this.idx = 0; this.opt = opt; },
  play() {
    if (!Voice.ok) { toast('この端末は音声合成に対応していません'); return; }
    this.playing = true; this.speak();
    clearInterval(this.keep); // Chrome は長時間の読み上げで止まることがあるので定期的に起こす
    this.keep = setInterval(() => { if (this.playing && speechSynthesis.paused) speechSynthesis.resume(); }, 5000);
  },
  speak() {
    const tok = ++this.token;
    try { speechSynthesis.cancel(); } catch {}
    if (this.idx >= this.list.length) { this.playing = false; this.onEnd && this.onEnd(); return; }
    const u = Voice.utter(this.list[this.idx], { pitch: this.opt.pitch, rate: (this.opt.rate || 1) * S.settings.rate });
    const go = () => { if (tok !== this.token || !this.playing) return; this.idx++; this.onStep && this.onStep(); this.speak(); };
    u.onend = go; u.onerror = e => { if (e.error === 'interrupted' || e.error === 'canceled') return; go(); };
    setTimeout(() => { if (tok === this.token && this.playing) speechSynthesis.speak(u); }, 60);
  },
  pause() { this.playing = false; this.token++; clearInterval(this.keep); try { speechSynthesis.cancel(); } catch {} },
  stop() { this.pause(); },
  seekBy(sec) {
    const target = sec * CPS * S.settings.rate; let acc = 0, i = this.idx;
    if (sec > 0) { while (i < this.list.length - 1 && acc < target) { acc += this.list[i].length; i++; } }
    else { while (i > 0 && acc < -target) { i--; acc += this.list[i].length; } }
    this.seekTo(i);
  },
  seekTo(i) { this.idx = clamp(i, 0, Math.max(0, this.list.length - 1)); if (this.playing) this.speak(); this.onStep && this.onStep(); },
  posSec() { return this.list.slice(0, this.idx).join('').length / CPS; },
  durSec() { return this.list.join('').length / CPS; }
};

/* iOS 等で最初の再生をユーザー操作の中で「解錠」するための無音WAV */
const SILENT = (() => {
  const n = 800, b = new Uint8Array(44 + n), v = new DataView(b.buffer);
  const w = (o, s) => [...s].forEach((c, i) => b[o + i] = c.charCodeAt(0));
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
  b.fill(128, 44); let s = ''; b.forEach(x => s += String.fromCharCode(x)); return 'data:audio/wav;base64,' + btoa(s);
})();

/* ================= プレイヤー ================= */
const Player = {
  audio: new Audio(), mode: null, cur: null, queue: [], qi: -1, radio: false, radioFac: 'all',
  announcing: false, url: null, unlocked: false, lastSave: 0, sleepAt: 0, sleepEnd: false, wantPlay: false,

  init() {
    const a = this.audio; a.preload = 'auto';
    a.addEventListener('timeupdate', () => this.tick());
    a.addEventListener('ended', () => { if (!a.src.startsWith('data:')) this.finished(); });
    a.addEventListener('play', () => this.sync());
    a.addEventListener('pause', () => { this.persist(true); this.sync(); });
    a.addEventListener('loadedmetadata', () => {
      if (this.cur && this.cur.type === 'audio' && isFinite(a.duration) && Math.abs((this.cur.duration || 0) - a.duration) > 1) {
        this.cur.duration = a.duration; DB.put('lectures', this.cur);
      }
    });
    Speech.onStep = () => { this.persist(); this.sync(); };
    Speech.onEnd = () => this.finished();
    this.media();
  },
  unlock() { // クリック直後（同期的）に呼ぶ
    Chime.unlock();
    if (!this.unlocked) {
      this.unlocked = true;
      try { this.audio.src = SILENT; const p = this.audio.play(); p && p.catch(() => {}); } catch {}
      if (Voice.ok) { try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch {} }
    }
  },
  playing() { return this.announcing || (this.mode === 'audio' ? !this.audio.paused && !!this.cur : this.mode === 'speech' ? Speech.playing : false); },
  pos() { return this.mode === 'audio' ? this.audio.currentTime || 0 : this.mode === 'speech' ? Speech.posSec() : 0; },
  dur() { return this.mode === 'audio' ? (isFinite(this.audio.duration) ? this.audio.duration : (this.cur?.duration || 0)) : this.mode === 'speech' ? Speech.durSec() : 0; },

  async start(ids, i = 0, { radio = false, radioFac = 'all', program = null } = {}) {
    this.unlock();
    if (!ids.length) { toast('再生できる講義がありません'); return; }
    this.queue = ids.slice(); this.qi = i; this.radio = radio; this.radioFac = radioFac;
    this.program = program ? { ...program, endAt: Date.now() + program.minutes * 60000 } : null;
    if (radio) { await this.stopEngines(); await this.announce(async () => { await Chime.play('open'); if (S.settings.announcer) await Voice.say(openingLine(radioFac), { rate: 1.05 }); }); }
    await this.load(this.queue[this.qi], { autoplay: true, intro: radio });
  },
  async announce(fn) { this.announcing = true; this.sync(); try { await fn(); } finally { this.announcing = false; } },
  async stopEngines() { try { this.audio.pause(); } catch {} Speech.stop(); },

  async load(id, { autoplay = true, intro = false, at = null } = {}) {
    const l = lect(id); if (!l) return this.next();
    await this.stopEngines(); this.persist(true);
    this.cur = l; this.mode = l.type === 'script' ? 'speech' : 'audio'; this.sync();
    if (intro) await this.announce(async () => { await Chime.play('next'); if (S.settings.announcer) await Voice.say(introLine(l), { rate: 1.05 }); });
    if (this.cur !== l) return; // 途中で別の講義に切り替えられた
    const p = prog(id); const startAt = at ?? (p.done ? 0 : (p.pos || 0));
    p.plays = (p.plays || 0) + 1; p.last = Date.now(); S.progress[id] = p; save.progress();
    if (this.mode === 'audio') {
      const blob = await DB.get('blobs', id);
      if (!blob) { toast('音声ファイルが見つかりません。研究室から追加し直してください'); this.mode = null; this.sync(); return; }
      if (this.url) URL.revokeObjectURL(this.url);
      this.url = URL.createObjectURL(blob);
      const a = this.audio; a.src = this.url; a.playbackRate = S.settings.rate;
      await new Promise(r => { const t = setTimeout(r, 4000); a.addEventListener('loadedmetadata', () => { clearTimeout(t); r(); }, { once: true }); a.load(); });
      if (startAt > 0 && (!isFinite(a.duration) || startAt < a.duration - 3)) a.currentTime = startAt;
      a.playbackRate = S.settings.rate;
      if (autoplay) await a.play().catch(() => toast('再生ボタンをもう一度押してください'));
    } else {
      const f = fac(l.facultyId);
      Speech.load(l.script, { pitch: f.pitch || 1, rate: f.rate || 1 });
      Speech.idx = clamp(Math.round(startAt), 0, Math.max(0, Speech.list.length - 1));
      if (autoplay) Speech.play();
    }
    this.metadata(); this.sync(); render(true);
  },
  play() {
    this.unlock();
    if (!this.cur) { const ids = radioQueue('all'); return this.start(ids, 0, { radio: true }); }
    if (this.mode === 'audio') this.audio.play().catch(() => {});
    else if (this.mode === 'speech') Speech.play();
    else this.load(this.cur.id);
    this.sync();
  },
  pause() { if (this.mode === 'audio') this.audio.pause(); else if (this.mode === 'speech') { Speech.pause(); this.persist(true); } this.sync(); },
  toggle() { this.playing() ? this.pause() : this.play(); },
  skip(sec) {
    if (this.mode === 'audio') { const a = this.audio; a.currentTime = clamp(a.currentTime + sec, 0, (a.duration || 1e9) - 0.5); }
    else if (this.mode === 'speech') Speech.seekBy(sec);
    this.sync();
  },
  seekFrac(fr) {
    if (this.mode === 'audio' && isFinite(this.audio.duration)) this.audio.currentTime = fr * this.audio.duration;
    else if (this.mode === 'speech') Speech.seekTo(Math.floor(fr * Speech.list.length));
    this.sync();
  },
  next() {
    this.persist(true);
    if (this.qi + 1 < this.queue.length) { this.qi++; return this.load(this.queue[this.qi], { intro: this.radio }); }
    if (this.program) { this.closing(); return; }
    if (this.radio) { // ラジオは終わらない：次の番組表を組む
      const more = radioQueue(this.radioFac, this.cur && this.cur.id);
      if (more.length) { this.queue.push(...more); this.qi++; return this.load(this.queue[this.qi], { intro: true }); }
    }
    this.stopEngines(); this.sync(); toast('番組表の最後まで聴きました');
  },
  async closing() {
    this.program = null; await this.stopEngines(); this.sync();
    await this.announce(async () => { await Chime.play('open'); if (S.settings.announcer) await Voice.say('本日の番組は、ここまでです。お疲れさまでした。', { rate: 1.05 }); });
    this.cur = null; this.mode = null; this.sync(); toast('番組が終わりました。お疲れさまでした', { ms: 5000 }); render(true);
  },
  prev() {
    if (this.pos() > 6 || this.qi <= 0) { this.mode === 'audio' ? (this.audio.currentTime = 0) : Speech.seekTo(0); this.sync(); return; }
    this.qi--; this.load(this.queue[this.qi]);
  },
  finished() {
    if (!this.cur) return;
    markDone(this.cur);
    if (this.sleepEnd) { this.sleepEnd = false; this.stopEngines(); this.sync(); Bedtime.off(); toast('講義の終わりで停止しました。おやすみなさい'); return; }
    this.next();
  },
  tick() {
    if (!this.cur) return;
    const now = Date.now();
    if (now - this.lastSave > 5000) { this.lastSave = now; this.persist(); }
    if (this.mode === 'audio') {
      const d = this.audio.duration;
      if (isFinite(d) && d > 30 && this.audio.currentTime / d > 0.97 && !prog(this.cur.id).done) markDone(this.cur, true);
      if ('mediaSession' in navigator && navigator.mediaSession.setPositionState && isFinite(d) && d > 0) {
        try { navigator.mediaSession.setPositionState({ duration: d, position: Math.min(d, this.audio.currentTime), playbackRate: this.audio.playbackRate }); } catch {}
      }
    }
    updateProgressUI();
  },
  persist(force) {
    const l = this.cur; if (!l || !this.mode) return;
    const p = S.progress[l.id] || {};
    if (p.done && !force) return;
    const pos = this.mode === 'audio' ? this.audio.currentTime : Speech.idx;
    if (p.done && pos < 1) return;
    if (pos > 0) { p.pos = pos; p.last = Date.now(); S.progress[l.id] = p; save.progress(); }
  },
  setRate(r) { S.settings.rate = r; save.settings(); this.audio.playbackRate = r; if (this.mode === 'speech' && Speech.playing) Speech.speak(); this.sync(); },
  metadata() {
    if (!('mediaSession' in navigator) || !this.cur) return;
    const l = this.cur, f = fac(l.facultyId), art = sealArt(f);
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: l.title, artist: profName(l) || f.name, album: `${f.name}｜AIラジオ大学`, artwork: art ? [{ src: art, sizes: '512x512', type: 'image/png' }] : [] });
    } catch {}
    avatarPNG(f).then(u => { if (!u || this.cur !== l) return; try { navigator.mediaSession.metadata.artwork = [{ src: u, sizes: '512x512', type: 'image/png' }]; } catch {} });
  },
  media() {
    if (!('mediaSession' in navigator)) return;
    const set = (a, fn) => { try { navigator.mediaSession.setActionHandler(a, fn); } catch {} };
    set('play', () => this.play()); set('pause', () => this.pause());
    set('nexttrack', () => this.next()); set('previoustrack', () => this.prev());
    set('seekbackward', d => this.skip(-(d?.seekOffset || S.settings.back)));
    set('seekforward', d => this.skip(d?.seekOffset || S.settings.fwd));
    set('seekto', d => { if (this.mode === 'audio' && d.seekTime != null) this.audio.currentTime = d.seekTime; });
  },
  sync() {
    if ('mediaSession' in navigator) try { navigator.mediaSession.playbackState = this.cur ? (this.playing() ? 'playing' : 'paused') : 'none'; } catch {}
    renderMini(); updateProgressUI(); updateDrive(); updatePlayerSheet();
    const lamp = $('#onair'); if (lamp) lamp.classList.toggle('live', this.playing());
  }
};

function programLeft() { const p = Player.program; return p ? Math.max(0, Math.ceil((p.endAt - Date.now()) / 60000)) : null; }
function greeting() { const h = new Date().getHours(); return h >= 4 && h < 10 ? 'おはようございます' : h < 17 && h >= 10 ? 'こんにちは' : 'こんばんは'; }
function openingLine(fid) {
  const f = fid !== 'all' ? fac(fid) : null;
  return `${greeting()}。AIラジオ大学、${f ? f.freq.replace('.', '点') + 'メガヘルツ、' + f.name + 'の' : ''}講義放送をお届けします。`;
}
function introLine(l) {
  const f = fac(l.facultyId), p = profName(l);
  const ep = l.episode ? `${l.series ? l.series + '、' : ''}第${l.episode}回。` : '';
  return `続いては、${f.name}。${p ? p + 'による、' : ''}${ep}「${l.title}」。`;
}

/* ラジオの番組表：聴講中→未聴講→修了済み（再放送）の順、学部が偏らないよう交互に */
function radioQueue(fid = 'all', exclude = null) {
  const pool = S.lectures.filter(l => (fid === 'all' || l.facultyId === fid) && l.id !== exclude && (l.type === 'script' ? Voice.ok : true));
  const groups = [pool.filter(l => status(l) === 'doing').sort((a, b) => (prog(b.id).last || 0) - (prog(a.id).last || 0)),
    shuffle(pool.filter(l => status(l) === 'new')), shuffle(pool.filter(l => status(l) === 'done'))];
  const out = [];
  for (const g of groups) {
    const by = {}; g.forEach(l => (by[l.facultyId] = by[l.facultyId] || []).push(l));
    // 同じシリーズは回の順番を守る
    Object.values(by).forEach(arr => arr.sort((a, b) => (a.series === b.series ? (a.episode || 0) - (b.episode || 0) : 0)));
    const keys = shuffle(Object.keys(by));
    while (keys.some(k => by[k].length)) for (const k of keys) if (by[k].length) out.push(by[k].shift());
  }
  return out.slice(0, 12).map(l => l.id);
}

/* 時間ぴったり番組：決めた時間にぴったり収まるように講義を選ぶ（0/1ナップサック） */
const ANN_SEC = () => (S.settings.announcer ? 10 : 3);
function lectRemain(l) { const d = lectDuration(l); return status(l) === 'doing' ? d * (1 - lectPct(l)) : d; }
function planProgram(minutes, fid = 'all') {
  const rate = S.settings.rate || 1, cap = minutes * 60 - (S.settings.announcer ? 12 : 4) - 15;
  const pri = l => ({ doing: 3, new: 2, done: 0 }[status(l)]);
  const pool = S.lectures.filter(l => (fid === 'all' || l.facultyId === fid) && (l.type === 'script' ? Voice.ok : true) && lectDuration(l) > 0);
  const cands = shuffle(pool).sort((a, b) => pri(b) - pri(a)).slice(0, 40).map(l => ({ l, c: lectRemain(l) / rate + ANN_SEC() }));
  const G = 5, W = Math.floor(cap / G);
  if (W <= 0 || !cands.length) return { ids: [], total: 0 };
  const best = new Float64Array(W + 1).fill(-1); best[0] = 0;
  const keep = cands.map(() => new Uint8Array(W + 1));
  cands.forEach((x, i) => {
    const w = Math.ceil(x.c / G), v = x.c + pri(x.l) * 25;
    for (let j = W; j >= w; j--) if (best[j - w] >= 0 && best[j - w] + v > best[j]) { best[j] = best[j - w] + v; keep[i][j] = 1; }
  });
  // 埋まった時間を最優先（残り1分以内なら優先度で選ぶ）
  let j = 0; for (let k = W; k >= 0; k--) if (best[k] >= 0) { j = k; break; }
  for (let k = j; k >= Math.max(0, j - 12); k--) if (best[k] > best[j]) j = k;
  const picked = [];
  for (let i = cands.length - 1; i >= 0; i--) if (keep[i][j]) { picked.push(cands[i]); j -= Math.ceil(cands[i].c / G); }
  picked.sort((a, b) => pri(b.l) - pri(a.l) || (a.l.series === b.l.series ? (a.l.episode || 0) - (b.l.episode || 0) : 0));
  // 同じ学部が続かないように並べ替え（聴講中は先頭のまま）
  const head = picked.filter(x => status(x.l) === 'doing'), rest = picked.filter(x => status(x.l) !== 'doing'), out = [...head];
  while (rest.length) { const last = out.length ? out[out.length - 1].l.facultyId : null; let i = rest.findIndex(x => x.l.facultyId !== last); if (i < 0) i = 0; out.push(rest.splice(i, 1)[0]); }
  return { ids: out.map(x => x.l.id), total: out.reduce((a, x) => a + x.c, 0) + (S.settings.announcer ? 12 : 4) };
}
function programSheet(minutes, fid = S.station || 'all') {
  lsSet('airu.mins', minutes);
  const plan = planProgram(minutes, fid), st = stations().find(x => x.id === fid) || stations()[0];
  const body = plan.ids.length
    ? `<div class="list">${plan.ids.map(id => rowHTML(lect(id))).join('')}</div>`
    : `<div class="card empty"><span class="em-title">${minutes}分に収まる講義がありません</span><span class="small">時間を長くするか、ダイヤルで「総合」を選んでみてください。</span></div>`;
  openSheet(`<div class="sheet-head"><div class="sh-main"><p class="eyebrow">Drive Program · ${esc(st.freq)} ${esc(st.short)}</p><h2>${minutes}分の番組</h2>
    <p class="small muted">${plan.ids.length ? `${plan.ids.length}講義 · 約${fmt(plan.total)}（到着の${fmt(Math.max(0, minutes * 60 - plan.total))}前に終わります）` : ''}</p></div></div>
    ${plan.ids.length && minutes * 60 - plan.total > 180 ? `<p class="hint">登録されている講義では${minutes}分を埋めきれませんでした。講義を増やすと、ぴったりに近づきます。</p>` : ''}
    ${body}
    ${plan.ids.length ? `<div class="btn-row"><button class="btn primary" data-act="startprog" data-min="${minutes}" data-fac="${fid}" data-ids="${plan.ids.join(',')}" data-drive="1">${ICON.car}ドライブモードで開始</button>
      <button class="btn" data-act="startprog" data-min="${minutes}" data-fac="${fid}" data-ids="${plan.ids.join(',')}">${ICON.play}放送開始</button>
      <button class="btn ghost" data-act="plan" data-min="${minutes}" data-fac="${fid}">組み直す</button></div>` : ''}`, 'program');
}
const MINUTE_CHOICES = [10, 15, 20, 30, 45, 60];

function sceneSheet(kind) {
  if (kind === 'nagara') {
    openSheet(`<div class="sheet-head">${''}<div class="sh-main"><p class="eyebrow">ながら聴き</p><h2>何分くらい聴く？</h2><p class="small muted">その時間にぴったり収まるように、講義を組みます（ダイヤルで選んだ局から）。</p></div></div>
      <div class="opt-grid">${[15, 30, 45, 60].map(m => `<button class="opt" data-act="plan" data-min="${m}"><b class="num">${m}</b>分</button>`).join('')}
      <button class="opt wide" data-act="radio" data-fac="${S.station || 'all'}">時間を決めずに聴く</button></div>`, 'scene');
  } else {
    openSheet(`<div class="sheet-head"><div class="sh-main"><p class="eyebrow">寝る前</p><h2>おやすみタイマー</h2><p class="small muted">画面が暗くなり、最後の2分で音をゆっくり小さくしてから止まります。</p></div></div>
      <div class="opt-grid">${[15, 30, 60].map(m => `<button class="opt" data-act="sleepstart" data-min="${m}"><b class="num">${m}</b>分</button>`).join('')}
      <button class="opt" data-act="sleepstart" data-min="end"><b style="font-size:15px">講義の終わり</b></button></div>`, 'scene');
  }
}
/* 寝る前モード：一時的に夜の配色にして、終わったら元に戻す */
const Bedtime = {
  prev: null, active: false,
  on() { if (this.active) return; this.active = true; this.prev = document.documentElement.getAttribute('data-theme'); document.documentElement.setAttribute('data-theme', 'dark'); },
  off() { if (!this.active) return; this.active = false; if (this.prev) document.documentElement.setAttribute('data-theme', this.prev); else applyTheme(); Player.audio.volume = 1; }
};

function markDone(l, silent) {
  const p = S.progress[l.id] || {}; if (p.done) return;
  const before = rankOf(credits(l.facultyId), FAC_RANKS).name, beforeAll = rankOf(credits(), ALL_RANKS).name;
  p.done = true; p.doneAt = Date.now(); p.pos = 0; S.progress[l.id] = p; save.progress();
  const f = fac(l.facultyId), after = rankOf(credits(l.facultyId), FAC_RANKS).name, afterAll = rankOf(credits(), ALL_RANKS).name;
  Chime.play('credit');
  let msg = `単位取得！ ${f.name} ${credits(l.facultyId)}単位目`;
  if (after !== before) msg = `${f.name}の「${after}」になりました`;
  if (afterAll !== beforeAll) msg += ` ／ 称号「${afterAll}」`;
  toast(msg, { cls: 'credit', action: Drive.open ? null : ['ひとことメモ', () => noteDialog(l, null)], ms: 6000 });
  if (!silent) render(true);
}

/* 聴講時間の記録（実際に再生していた秒数だけ） */
setInterval(() => {
  if (Player.cur && Player.playing() && !Player.announcing) { const k = dayKey(); S.logs[k] = (S.logs[k] || 0) + 1; save.logs(); }
  if (Player.sleepAt) {
    const rem = (Player.sleepAt - Date.now()) / 1000;
    if (rem <= 120 && Player.mode === 'audio') Player.audio.volume = clamp(rem / 120, 0, 1);
    if (rem <= 0) { Player.sleepAt = 0; Player.pause(); Player.audio.volume = 1; Bedtime.off(); toast('おやすみタイマーで止まりました'); updatePlayerSheet(); }
  }
  if (Player.mode === 'speech') updateProgressUI();
  if (Drive.open) { const c = $('#dClock'); if (c) c.textContent = new Date().toTimeString().slice(0, 5); const lf = $('#dLeft'); if (lf) lf.textContent = programLeft() != null ? `到着まで あと${programLeft()}分` : ''; }
}, 1000);

/* ================= トーストと確認ダイアログ ================= */
function toast(msg, { cls = '', action = null, ms = 3200 } = {}) {
  const box = $('#toasts'); const t = document.createElement('div'); t.className = 'toast ' + cls;
  t.innerHTML = `<span>${esc(msg)}</span>`;
  if (action) { const b = document.createElement('button'); b.textContent = action[0]; b.onclick = () => { t.remove(); action[1](); }; t.appendChild(b); }
  box.appendChild(t); setTimeout(() => t.remove(), ms);
}
function ask(msg, { ok = 'OK', danger = false } = {}) {
  return new Promise(res => {
    const s = document.createElement('div'); s.className = 'scrim';
    s.innerHTML = `<div class="dialog" role="dialog" aria-modal="true"><p>${esc(msg)}</p><div class="btn-row" style="justify-content:flex-end"><button class="btn ghost" data-r="0">やめる</button><button class="btn ${danger ? 'danger' : 'primary'}" data-r="1">${esc(ok)}</button></div></div>`;
    s.addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (b || e.target === s) { s.remove(); res(b ? b.dataset.r === '1' : false); } });
    document.body.appendChild(s);
  });
}

/* ================= シート ================= */
let sheetKind = null;
function openSheet(html, kind = 'misc') {
  closeSheet();
  const s = document.createElement('div'); s.className = 'scrim'; s.id = 'scrim';
  s.innerHTML = `<div class="sheet ${kind === 'player' ? 'player' : ''}" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  s.addEventListener('click', e => { if (e.target === s) closeSheet(); });
  document.body.appendChild(s); sheetKind = kind; document.body.style.overflow = 'hidden';
  return s;
}
function closeSheet() { const s = $('#scrim'); if (s) s.remove(); sheetKind = null; document.body.style.overflow = ''; }

/* ================= 画面 ================= */
const VIEWS = ['home', 'library', 'faculty', 'studio', 'record', 'prefs'];
function go(v) { if (location.hash !== '#' + v) location.hash = v; else render(); window.scrollTo(0, 0); }
function currentView() { const h = location.hash.slice(1); return VIEWS.includes(h) ? h : 'home'; }
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

function render(soft) {
  S.view = currentView();
  if (S.view === 'faculty' && !S.facultyView) S.view = 'home';
  if (soft && S.view === 'studio') return; // 入力中のフォームを壊さない
  const v = $('#view');
  const keepScroll = soft ? window.scrollY : 0;
  v.innerHTML = ({ home: viewHome, library: viewLibrary, faculty: viewFaculty, studio: viewStudio, record: viewRecord, prefs: viewPrefs })[S.view]();
  $$('.nav button').forEach(b => b.classList.toggle('on', b.dataset.go === S.view || (S.view === 'faculty' && b.dataset.go === 'home')));
  if (S.view === 'home') initTuner();
  if (S.view === 'library') bindLibrary();
  if (S.view === 'studio') bindStudio();
  if (soft) window.scrollTo(0, keepScroll);
}

/* ---- 講義の行 ---- */
function rowHTML(l, { showFac = true } = {}) {
  const f = fac(l.facultyId), st = status(l), now = Player.cur && Player.cur.id === l.id;
  const sub = [showFac ? f.name : '', profName(l), l.episode ? `第${l.episode}回` : '', fmt(lectDuration(l)), l.type === 'script' ? '音声合成' : ''].filter(Boolean).join(' · ');
  return `<div class="row ${now ? 'playing' : ''}">
    <button class="row-open" data-act="detail" data-id="${l.id}">${sealHTML(f, 'sm')}
      <span class="row-main"><span class="row-title">${esc(l.title)}</span><span class="row-sub">${esc(sub)}</span></span>
      <span class="pill ${st}">${STATUS_LABEL[st]}</span></button>
    <button class="row-play" data-act="play" data-id="${l.id}" aria-label="${esc(l.title)}を再生">${now && Player.playing() ? ICON.pause : ICON.play}</button>
  </div>`;
}

/* ---- ホーム（キャンパス） ---- */
function stations() {
  return [{ id: 'all', freq: '77.7', short: '総合', name: 'AIラジオ大学 総合放送', sub: '全学部から番組表を自動で編成' },
    ...S.faculties.map(f => ({ id: f.id, freq: f.freq, short: f.short, name: f.name, sub: `${f.professor} 教授ほか` }))];
}
function viewHome() {
  const today = S.logs[dayKey()] || 0, cr = credits(), sk = streak();
  const doing = S.lectures.filter(l => status(l) === 'doing').sort((a, b) => (prog(b.id).last || 0) - (prog(a.id).last || 0))[0];
  const fresh = S.lectures.filter(l => status(l) === 'new' && (!doing || l.id !== doing.id));
  const pick = fresh.length ? fresh[hashStr(dayKey()) % fresh.length] : null;
  const recent = S.lectures.slice().sort((a, b) => b.addedAt - a.addedAt).filter(l => !pick || l.id !== pick.id).slice(0, 3);
  const unheard = S.lectures.filter(l => status(l) !== 'done').length;
  const hero = doing
    ? `<button class="hero-card" data-act="play" data-id="${doing.id}">${sealHTML(fac(doing.facultyId), 'lg')}
        <span class="hc-main"><span class="hc-label">続きから</span><span class="hc-title">${esc(doing.title)}</span>
        <span class="hc-sub">${esc(profName(doing))} · 残り ${fmt(lectDuration(doing) * (1 - lectPct(doing)))}</span>
        <span class="bar"><i style="width:${lectPct(doing) * 100}%"></i></span></span><span class="hero-play" aria-hidden="true">${ICON.play}</span></button>`
    : `<button class="hero-card" id="heroRadio" data-act="radio" data-fac="all"><span class="ava lg">${RADIO_SVG}</span>
        <span class="hc-main"><span class="hc-label">ラジオを始める</span><span class="hc-title" id="heroTitle">全学部から、自動で番組を組みます</span>
        <span class="hc-sub" id="heroSub">${S.lectures.length}講義・未聴講${unheard}</span></span><span class="hero-play" aria-hidden="true">${ICON.play}</span></button>`;
  return `
  <section class="home-hero">
    <p class="eyebrow">${new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}</p>
    <h1>${greeting()}、学長。</h1>
    ${hero}
    <p class="home-stats">今日 <b class="num">${Math.floor(today / 60)}</b>分 ・ 連続 <b class="num">${sk}</b>日 ・ <b class="num">${cr}</b>単位</p>
  </section>

  <section class="scene-grid" aria-label="聴き方を選ぶ">
    <button class="scene sc-nagara" data-act="scene" data-scene="nagara"><span class="sc-ico">${ICON.phones}</span>ながら<small>時間ぴったり</small></button>
    <button class="scene sc-sleep" data-act="scene" data-scene="sleep"><span class="sc-ico">${ICON.moon}</span>寝る前<small>ゆっくり止まる</small></button>
    <button class="scene sc-move" data-act="drive"><span class="sc-ico">${ICON.car}</span>移動中<small>大きなボタン</small></button>
  </section>

  <section class="tuner" aria-label="チューニングダイヤル">
    <div class="tuner-head"><span class="eyebrow">局を選ぶ · FM</span><span class="small muted">ダイヤルを左右に</span></div>
    <div class="tuner-window"><div class="tuner-scale" id="tunerScale"><div class="pad"></div>
      ${stations().map(s => `<button class="station" data-act="tune" data-st="${s.id}"><span class="freq">${s.freq}</span><span class="st-name">${esc(s.short)}</span></button>`).join('')}
      <div class="pad"></div></div><div class="needle"></div></div>
    <div class="tuner-info" id="tunerInfo"></div>
  </section>

  ${pick ? `<section><div class="sec-head"><h2>今日のおすすめ</h2></div><div class="list">${rowHTML(pick)}</div></section>` : ''}

  <section><div class="sec-head"><h2>新着</h2><button class="link" data-act="go" data-go="library">すべて見る</button></div>
    ${recent.length ? `<div class="list">${recent.map(l => rowHTML(l)).join('')}</div>` : emptyLib()}</section>`;
}
function emptyLib() {
  return `<div class="card empty"><span class="em-title">講義はまだありません</span><span class="small">MuseでつくったMP3を追加すると、ここに並びます。</span><button class="btn primary" data-act="go" data-go="studio">${ICON.upload}MP3を追加</button></div>`;
}
function initTuner() {
  const sc = $('#tunerScale'); if (!sc) return;
  const btns = $$('.station', sc);
  const pick = (id, smooth) => { const b = btns.find(x => x.dataset.st === id) || btns[0]; sc.scrollTo({ left: b.offsetLeft - sc.clientWidth / 2 + b.offsetWidth / 2, behavior: smooth ? 'smooth' : 'auto' }); };
  const update = () => {
    const mid = sc.scrollLeft + sc.clientWidth / 2;
    let best = btns[0], bd = 1e9; for (const b of btns) { const d = Math.abs(b.offsetLeft + b.offsetWidth / 2 - mid); if (d < bd) { bd = d; best = b; } }
    btns.forEach(b => b.classList.toggle('active', b === best));
    if (S.station !== best.dataset.st || !$('#tunerInfo').innerHTML) { S.station = best.dataset.st; lsSet('airu.station', S.station); tunerInfo(); }
  };
  let t; sc.addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(update, 60); }, { passive: true });
  sc._pick = pick;
  requestAnimationFrame(() => { pick(S.station); update(); tunerInfo(); });
}
function tunerInfo() {
  const st = stations().find(s => s.id === S.station) || stations()[0];
  const ls = S.lectures.filter(l => st.id === 'all' || l.facultyId === st.id);
  const unheard = ls.filter(l => status(l) !== 'done').length;
  const hero = $('#heroRadio');
  if (hero) { // 何も聴きかけていないときは、大きなボタンが選んだ局の放送になる
    hero.dataset.fac = st.id;
    $('#heroTitle').textContent = st.id === 'all' ? '全学部から、自動で番組を組みます' : `${st.name}の放送`;
    $('#heroSub').textContent = `${st.freq}MHz・${ls.length}講義・未聴講${unheard}`;
  }
  $('#tunerInfo').innerHTML = `<div class="ti-main"><div class="ti-name"><span class="num" style="color:var(--accent)">${st.freq}</span> ${esc(st.name)}</div>
    <div class="ti-sub">${esc(st.sub)} · ${ls.length}講義</div></div>
    ${hero ? '' : `<button class="btn ghost" style="min-height:38px" data-act="radio" data-fac="${st.id}">この局を聴く</button>`}`;
}

/* ---- 講義一覧 ---- */
function viewLibrary() {
  return `<section class="stack">
    <h1>講義</h1>
    <div class="seal-strip">${S.faculties.map(f => `<button class="ss-item" data-act="faculty" data-fac="${f.id}">${sealHTML(f)}<span>${esc(f.short)}</span></button>`).join('')}
      <button class="ss-item" data-act="newfac"><span class="seal" style="--c:var(--surface-2);color:var(--muted)" aria-hidden="true">＋</span><span>新設</span></button></div>
    <label class="search">${ICON.search}<input id="libQ" type="search" placeholder="タイトル・教授・タグで検索" value="${esc(S.libQuery)}" autocomplete="off"></label>
    <div class="chips" id="libSt">${[['all', 'すべて'], ['new', '未聴講'], ['doing', '聴講中'], ['done', '修了'], ['audio', 'MP3'], ['script', '音声合成']].map(([id, n]) => `<button class="chip ${S.libStatus === id ? 'on' : ''}" data-s="${id}">${n}</button>`).join('')}</div>
  </section>
  <section id="libList"></section>`;
}
function bindLibrary() {
  const draw = () => {
    const q = S.libQuery.trim().toLowerCase();
    let ls = S.lectures.filter(l => (S.libFac === 'all' || l.facultyId === S.libFac)
      && (S.libStatus === 'all' || (['audio', 'script'].includes(S.libStatus) ? l.type === S.libStatus : status(l) === S.libStatus))
      && (!q || [l.title, l.professor, l.series, l.description, (l.tags || []).join(' '), fac(l.facultyId).name].join(' ').toLowerCase().includes(q)));
    ls.sort((a, b) => b.addedAt - a.addedAt);
    $('#libList').innerHTML = ls.length ? `<p class="small muted" style="margin-bottom:8px">${ls.length}件の講義 · 合計 ${fmtMin(ls.reduce((s, l) => s + lectDuration(l), 0))}</p><div class="list">${ls.map(l => rowHTML(l)).join('')}</div>
      <div class="btn-row" style="margin-top:12px"><button class="btn" data-act="playlist" data-ids="${ls.map(l => l.id).join(',')}">${ICON.play}この並びで連続再生</button></div>`
      : (S.lectures.length ? `<div class="card empty"><span class="em-title">該当する講義がありません</span><span class="small">検索語や絞り込みを変えてみてください。</span></div>` : emptyLib());
  };
  $('#libQ').addEventListener('input', e => { S.libQuery = e.target.value; draw(); });
  $('#libFac')?.addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (!b) return; S.libFac = b.dataset.f; $$('#libFac .chip').forEach(c => c.classList.toggle('on', c === b)); draw(); });
  $('#libSt').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (!b) return; S.libStatus = b.dataset.s; $$('#libSt .chip').forEach(c => c.classList.toggle('on', c === b)); draw(); });
  draw();
}

/* ---- 学部ページ ---- */
function viewFaculty() {
  const f = fac(S.facultyView), ls = S.lectures.filter(l => l.facultyId === f.id), c = credits(f.id), r = rankOf(c, FAC_RANKS);
  const series = {}; ls.forEach(l => (series[l.series || 'その他の講義'] = series[l.series || 'その他の講義'] || []).push(l));
  Object.values(series).forEach(a => a.sort((x, y) => (x.episode || 0) - (y.episode || 0) || x.addedAt - y.addedAt));
  return `<section class="fac-hero">${sealHTML(f, 'lg')}<div class="fh-main"><p class="eyebrow">${f.freq} MHz</p><h1>${esc(f.name)}</h1>
    <div class="degree">${esc(f.professor)} 教授 ・ あなたは<b>${r.name}</b>${r.next ? `（あと${r.next[0] - c}単位で${r.next[1]}）` : ''}</div></div></section>
    <p class="muted">${esc(f.desc || '')}</p>
    <div class="btn-row"><button class="btn primary" data-act="radio" data-fac="${f.id}">${ICON.radio}この学部のラジオ</button>
      <button class="btn" data-act="editfac" data-fac="${f.id}">学部を編集</button>
      <button class="btn ghost" data-act="writefor" data-fac="${f.id}">講義をつくる</button></div>
    ${ls.length ? Object.entries(series).map(([name, arr]) => `<section><div class="sec-head"><h2>${esc(name)}</h2><span class="small muted">${arr.length}講</span></div><div class="list">${arr.map(l => rowHTML(l, { showFac: false })).join('')}</div></section>`).join('')
      : `<div class="card empty"><span class="em-title">まだ講義がありません</span><span class="small">MP3を追加するか、台本から講義をつくりましょう。</span><button class="btn primary" data-act="go" data-go="studio">研究室へ</button></div>`}`;
}

/* ---- 研究室 ---- */
function facOptions(sel) { return S.faculties.map(f => `<option value="${f.id}" ${f.id === sel ? 'selected' : ''}>${esc(f.name)}</option>`).join(''); }
function viewStudio() {
  const tabs = [['import', 'MP3を追加'], ['write', '台本から講義'], ['muse', 'Muse台本メーカー']];
  return `<section class="stack"><h1>研究室</h1><p class="muted small">新しい講義を迎え入れる場所。MuseでつくったMP3の登録も、アプリ内での講義づくりもここで。</p>
    <div class="tabs" role="tablist">${tabs.map(([id, n]) => `<button class="tab ${S.studioTab === id ? 'on' : ''}" data-act="stab" data-tab="${id}">${n}</button>`).join('')}</div></section>
    <section id="studioBody">${({ import: studioImport, write: studioWrite, muse: studioMuse })[S.studioTab]()}</section>`;
}
function studioImport() {
  if (S.pending.length) {
    return `<div class="stack">
      <div class="card form"><h3>${S.pending.length}本の講義を登録します</h3>
        <p class="hint">ファイル名から学部・タイトル・回数を推測しました。まとめて設定もできます。</p>
        <div class="grid2"><div class="field"><label for="bulkFac">学部をまとめて設定</label><select class="input" id="bulkFac"><option value="">変更しない</option>${facOptions()}</select></div>
        <div class="field"><label for="bulkSeries">シリーズ名をまとめて設定</label><input class="input" id="bulkSeries" placeholder="例：ブラックホール入門"></div></div>
        <div class="field"><label for="bulkProf">教授名をまとめて設定</label><input class="input" id="bulkProf" placeholder="空欄なら学部の教授"></div>
      </div>
      <div class="list" id="pendList">${S.pending.map((p, i) => `<div class="pending-item" data-i="${i}">
        <div class="pi-file"><span>${esc(p.file.name)}</span><span>${p.duration ? fmt(p.duration) : '…'} · ${(p.file.size / 1048576).toFixed(1)}MB</span></div>
        <div class="field"><label for="pt${i}">タイトル</label><input class="input" id="pt${i}" data-k="title" value="${esc(p.title)}"></div>
        <div class="grid3"><div class="field"><label for="pf${i}">学部</label><select class="input" id="pf${i}" data-k="facultyId">${facOptions(p.facultyId)}</select></div>
        <div class="field"><label for="pe${i}">回</label><input class="input" id="pe${i}" data-k="episode" inputmode="numeric" value="${p.episode || ''}"></div></div>
        <div class="grid2"><div class="field"><label for="ps${i}">シリーズ</label><input class="input" id="ps${i}" data-k="series" value="${esc(p.series)}"></div>
        <div class="field"><label for="pp${i}">教授</label><input class="input" id="pp${i}" data-k="professor" value="${esc(p.professor)}" placeholder="${esc(fac(p.facultyId).professor)}"></div></div>
        <button class="link" style="align-self:flex-start;color:var(--muted)" data-act="unpend" data-i="${i}">この講義を外す</button>
      </div>`).join('')}</div>
      <div class="btn-row"><button class="btn primary" data-act="savepend" id="savePend">${S.pending.length}本を登録する</button><button class="btn ghost" data-act="cancelpend">やめる</button></div>
    </div>`;
  }
  return `<div class="stack">
    <label class="drop" id="drop" for="fileIn">${ICON.upload}
      <strong>MP3ファイルをここにドロップ</strong><span class="small muted">またはタップして選択（複数まとめてOK）</span>
      <input type="file" id="fileIn" accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac" multiple hidden></label>
    <div class="card"><h3 style="margin-bottom:6px">ファイル名のコツ</h3>
      <p class="hint">ファイル名を <code>学部_タイトル_第1回.mp3</code> の形にすると、学部・タイトル・回数を自動で読み取ります。<br>例：<code>宇宙_ブラックホール入門_第2回.mp3</code>　<code>【哲学】ニーチェと永劫回帰.mp3</code></p></div>
    <p class="hint">iPhoneなら「ファイル」の選択画面で OneDrive（または iCloud Drive）の講義フォルダを開き、右上の「選択」から全部選んでください。登録済みの講義は自動で飛ばします。</p>
    <p class="hint">音声はこの端末のブラウザ内（IndexedDB）に保存され、どこにもアップロードされません。設定画面から「データを消さないよう端末に依頼」しておくと安心です。</p>
  </div>`;
}
function studioWrite() {
  const d = S.draft || (S.draft = { title: '', facultyId: S.faculties[0]?.id, professor: '', series: '', episode: '', description: '', script: '' });
  return `<div class="card form">
    <p class="hint">台本を書くと、端末の音声合成が教授の声で読み上げます。<code>【見出し】</code>だけの行は読まれません。</p>
    <div class="field"><label for="wTitle">講義タイトル</label><input class="input" id="wTitle" value="${esc(d.title)}" placeholder="例：ストア派に学ぶ、心の平静"></div>
    <div class="grid2"><div class="field"><label for="wFac">学部</label><select class="input" id="wFac">${facOptions(d.facultyId)}</select></div>
    <div class="field"><label for="wProf">教授</label><input class="input" id="wProf" value="${esc(d.professor)}" placeholder="空欄なら学部の教授"></div></div>
    <div class="grid3"><div class="field"><label for="wSeries">シリーズ</label><input class="input" id="wSeries" value="${esc(d.series)}"></div>
    <div class="field"><label for="wEp">回</label><input class="input" id="wEp" inputmode="numeric" value="${esc(d.episode)}"></div></div>
    <div class="field"><label for="wDesc">講義紹介（任意）</label><input class="input" id="wDesc" value="${esc(d.description)}"></div>
    <div class="field"><label for="wScript">台本 <span id="wCount" class="num"></span></label><textarea class="input script" id="wScript" placeholder="みなさん、こんにちは。今日のテーマは……">${esc(d.script)}</textarea></div>
    <div class="btn-row"><button class="btn" data-act="tmpl">構成テンプレを挿入</button><button class="btn" data-act="preview">冒頭を試聴</button></div>
    <button class="btn primary block" data-act="savewrite">${d.editId ? '講義を更新する' : '講義として登録する'}</button>
    ${d.editId ? '<button class="btn ghost block" data-act="clearwrite">新しい台本にする</button>' : ''}
  </div>`;
}
function studioMuse() {
  const m = S.muse || (S.muse = { theme: '', facultyId: S.faculties[0]?.id, minutes: 15, level: '教養として初めて学ぶ大人', tone: 'NHKの教養講座のように、穏やかで知的', ep: 1 });
  return `<div class="stack"><div class="card form">
    <p class="hint">テーマを決めると、Museに渡す講義台本の依頼文をつくります。完成したMP3は「MP3を追加」から登録してください。</p>
    <div class="field"><label for="mTheme">テーマ</label><div style="display:flex;gap:8px"><input class="input" id="mTheme" value="${esc(m.theme)}" placeholder="例：ダークマターという見えない重さ"><button class="btn" data-act="gacha" style="flex:none">お題ガチャ</button></div></div>
    <div class="grid2"><div class="field"><label for="mFac">学部</label><select class="input" id="mFac">${facOptions(m.facultyId)}</select></div>
    <div class="field"><label for="mMin">長さ</label><select class="input" id="mMin">${[5, 10, 15, 20, 30].map(n => `<option value="${n}" ${+m.minutes === n ? 'selected' : ''}>約${n}分</option>`).join('')}</select></div></div>
    <div class="field"><label for="mTone">語り口</label><select class="input" id="mTone">${['NHKの教養講座のように、穏やかで知的', '深夜ラジオのように、親密で少しユーモラス', '情熱的な名物教授の白熱講義', '教授とアシスタントの対談形式', '物語仕立てで、謎解きのように'].map(t => `<option ${m.tone === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    <div class="grid3"><div class="field"><label for="mLevel">聴き手</label><select class="input" id="mLevel">${['教養として初めて学ぶ大人', 'ある程度の基礎知識がある人', '専門的な話も楽しめる上級者'].map(t => `<option ${m.level === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    <div class="field"><label for="mEp">回</label><input class="input" id="mEp" inputmode="numeric" value="${esc(m.ep)}"></div></div>
  </div>
  <div class="card stack"><div class="sec-head" style="margin:0"><h3>Museへの依頼文</h3><button class="btn primary" data-act="copymuse">コピー</button></div>
    <div class="output" id="museOut"></div>
    <p class="hint">保存するファイル名：<code id="museFile"></code> <button class="link" data-act="copyfile">名前をコピー</button></p></div></div>`;
}
function musePrompt() {
  const m = S.muse, f = fac(m.facultyId), chars = m.minutes * 300, theme = m.theme || '（テーマ）';
  return `あなたは「AIラジオ大学」${f.name}の${f.professor}教授です。
ラジオで放送する特別講義の台本を書き、音声にしてください。

■テーマ：${theme}
■講義：${f.name}「${theme}」第${m.ep || 1}回
■長さ：約${m.minutes}分（台本で約${chars.toLocaleString()}字）
■聴き手：${m.level}
■語り口：${m.tone}

■構成
1. オープニング：短い挨拶と、思わず続きを聴きたくなる問いかけ
2. 本論：要点は3つまで。それぞれに具体的なエピソードや身近な例え話を入れる
3. 視点の転換：常識がひっくり返るような意外な事実や見方を1つ
4. まとめ：今日の要点を、覚えやすい短い言葉で3つ
5. 結び：日常の中で考えてみたくなる小さな「宿題」と、次回への予告

■条件
・車の運転中に耳だけで理解できるよう、図や表に頼らず、一文を短くする
・専門用語は、初めて出たときに必ずやさしく言い換える
・人名・年代・数字は、確かなものだけを使い、不確かな説は「〜という説もある」と明示する
・見出しや記号、箇条書きは読み上げず、自然な話し言葉だけで語る`;
}
function museFileName() { const m = S.muse, f = fac(m.facultyId); return `${f.short}_${(m.theme || 'テーマ').replace(/[\\/:*?"<>|_]/g, ' ').trim()}_第${m.ep || 1}回.mp3`; }

function bindStudio() {
  const body = $('#studioBody'); if (!body) return;
  if (S.studioTab === 'import') {
    const drop = $('#drop'), inp = $('#fileIn');
    if (drop) {
      inp.addEventListener('change', () => { addFiles([...inp.files]); inp.value = ''; });
      ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
      ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
      drop.addEventListener('drop', e => addFiles([...(e.dataTransfer?.files || [])]));
    }
    const list = $('#pendList');
    if (list) {
      list.addEventListener('input', e => { const k = e.target.dataset.k, it = e.target.closest('[data-i]'); if (!k || !it) return; S.pending[+it.dataset.i][k] = k === 'episode' ? (parseInt(e.target.value, 10) || '') : e.target.value; });
      const bulk = (id, k) => $(id).addEventListener('change', e => { if (!e.target.value) return; S.pending.forEach(p => p[k] = e.target.value); refreshStudio(); });
      bulk('#bulkFac', 'facultyId'); bulk('#bulkSeries', 'series'); bulk('#bulkProf', 'professor');
    }
  }
  if (S.studioTab === 'write') {
    const map = { wTitle: 'title', wFac: 'facultyId', wProf: 'professor', wSeries: 'series', wEp: 'episode', wDesc: 'description', wScript: 'script' };
    const count = () => { const t = S.draft.script; $('#wCount').textContent = t ? `${t.length.toLocaleString()}字 · 約${Math.max(1, Math.round(scriptDuration(t) / 60))}分` : ''; };
    body.addEventListener('input', e => { const k = map[e.target.id]; if (k) { S.draft[k] = e.target.value; lsSet('airu.draft', S.draft); if (k === 'script') count(); } });
    count();
  }
  if (S.studioTab === 'muse') {
    const map = { mTheme: 'theme', mFac: 'facultyId', mMin: 'minutes', mTone: 'tone', mLevel: 'level', mEp: 'ep' };
    const out = () => { $('#museOut').textContent = musePrompt(); $('#museFile').textContent = museFileName(); };
    body.addEventListener('input', e => { const k = map[e.target.id]; if (k) { S.muse[k] = e.target.value; out(); } });
    out();
  }
}
function refreshStudio() { const b = $('#studioBody'); if (!b) return; const y = window.scrollY; render(); window.scrollTo(0, y); }

/* ファイル名から講義情報を推測する */
function guessFaculty(text) {
  for (const f of S.faculties) if (text.includes(f.name) || text.includes(f.short)) return f.id;
  for (const f of S.faculties) if ((f.keywords || []).some(k => text.toLowerCase().includes(k.toLowerCase()))) return f.id;
  return null;
}
function parseName(name) {
  let base = name.replace(/\.[^.]+$/, '').replace(/[＿]/g, '_').trim();
  let episode = '';
  const em = base.match(/第\s*([0-9０-９]+)\s*[回講話]|#\s*(\d+)|(?:ep|vol)\.?\s*(\d+)/i);
  if (em) { episode = parseInt((em[1] || em[2] || em[3]).replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 65248)), 10); base = base.replace(em[0], ' '); }
  let facultyId = null;
  const br = base.match(/^[\[【［(（]([^\]】］)）]+)[\]】］)）]\s*/);
  if (br) { facultyId = guessFaculty(br[1]); if (facultyId) base = base.slice(br[0].length); }
  let parts = base.split(/_| - |｜|\|/).map(s => s.trim()).filter(Boolean);
  if (!facultyId && parts.length > 1) { const g = guessFaculty(parts[0]); if (g && parts[0].length <= 8) { facultyId = g; parts.shift(); } }
  if (!facultyId) facultyId = guessFaculty(base) || S.faculties[0]?.id;
  let title = parts.join(' ').replace(/\s+/g, ' ').trim() || name;
  let series = '';
  if (parts.length > 1 && episode) { series = parts[0]; title = parts.slice(1).join(' '); }
  else if (episode) series = title;
  return { title, facultyId, episode, series };
}
function audioDuration(file) {
  return new Promise(res => {
    const a = document.createElement('audio'), u = URL.createObjectURL(file); let done = false;
    const fin = v => { if (done) return; done = true; URL.revokeObjectURL(u); res(v); };
    a.preload = 'metadata'; a.onloadedmetadata = () => fin(isFinite(a.duration) ? a.duration : 0); a.onerror = () => fin(0);
    setTimeout(() => fin(0), 10000); a.src = u;
  });
}
/* 同じファイル名の講義は「同じなら飛ばす／作り直されていたら差し替える」。
   すぐ登録モードなら確認画面を出さずにそのまま登録する（フォルダの中身を全部選ぶだけでOK）。 */
async function addFiles(files) {
  files = files.filter(f => /^audio\//.test(f.type) || /\.(mp3|m4a|wav|ogg|aac|flac)$/i.test(f.name));
  if (!files.length) { toast('音声ファイルが見つかりませんでした'); return; }
  const known = new Map(S.lectures.filter(l => l.fileName).map(l => [l.fileName, l]));
  let same = 0, updated = 0; const fresh = [];
  for (const file of files) {
    const old = known.get(file.name);
    if (!old) { fresh.push(file); continue; }
    if (old.size === file.size) { same++; continue; }
    try {
      await DB.put('blobs', file, old.id);
      Object.assign(old, { size: file.size, duration: await audioDuration(file) || old.duration, updatedAt: Date.now() });
      await DB.put('lectures', old); updated++;
      if (Player.cur && Player.cur.id === old.id) toast('再生中の講義が新しい音声に差し替わりました。次に再生したときから反映されます');
    } catch (e) { toast('差し替えに失敗しました：' + file.name); }
  }
  for (const file of fresh) S.pending.push({ file, ...parseName(file.name), professor: '', duration: 0 });
  for (const p of S.pending) if (!p.duration) p.duration = await audioDuration(p.file);
  const parts = [fresh.length && `新しく${fresh.length}本`, updated && `作り直し${updated}本を差し替え`, same && `登録済み${same}本は飛ばしました`].filter(Boolean);
  if (S.settings.quickImport && fresh.length) { await savePending(parts.join('、')); return; }
  if (!fresh.length) { toast(parts.join('、') || '新しい講義はありませんでした'); render(true); return; }
  refreshStudio(); if (parts.length > 1) toast(parts.join('、'));
}
async function savePending(summary) {
  const btn = $('#savePend'); if (btn) { btn.disabled = true; btn.textContent = '保存しています…'; }
  let n = 0;
  try {
    for (const p of S.pending) {
      const id = uid();
      await DB.put('blobs', p.file, id);
      const l = { id, type: 'audio', title: p.title.trim() || p.file.name, facultyId: p.facultyId, professor: p.professor.trim(), series: p.series.trim(), episode: p.episode || '', description: '', tags: [], duration: p.duration || 0, fileName: p.file.name, size: p.file.size, addedAt: Date.now() + n };
      await DB.put('lectures', l); S.lectures.push(l); n++;
    }
  } catch (e) {
    toast('保存に失敗しました。端末の空き容量を確認してください（' + (e?.name || e) + '）', { ms: 6000 });
  }
  S.pending = S.pending.slice(n);
  toast(summary ? `${summary}。登録しました` : `${n}本の講義を登録しました`, { ms: 5000 });
  if (!S.pending.length) { S.libFac = 'all'; S.libStatus = 'all'; S.libQuery = ''; go('library'); } else refreshStudio();
}

/* ---- 学籍簿 ---- */
function viewRecord() {
  const cr = credits(), r = rankOf(cr, ALL_RANKS), tot = totalSec(), sk = streak(), ls = longestStreak();
  const weeks = 22, end = new Date(); end.setHours(0, 0, 0, 0);
  const start = new Date(end); start.setDate(end.getDate() - end.getDay() - (weeks - 1) * 7); // 日曜はじまりに揃える
  const cells = []; for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const k = dayKey(d), m = (S.logs[k] || 0) / 60; const lv = m <= 0 ? 0 : m < 10 ? 1 : m < 30 ? 2 : m < 60 ? 3 : 4;
    cells.push(`<i class="l${lv} ${k === dayKey() ? 'today' : ''}" title="${k} ${Math.round(m)}分"></i>`);
  }
  const notes = S.notes.slice().sort((a, b) => b.createdAt - a.createdAt);
  return `<section class="student">
    <div class="s-top"><div><p class="eyebrow">学籍簿 · Student Record</p><div class="s-rank">${r.name}</div>
      <p class="small muted">${r.next ? `あと${r.next[0] - cr}単位で「${r.next[1]}」` : '最高位に到達しました'}</p></div>
      <div style="text-align:right"><div class="s-id">${esc(S.settings.studentNo)}</div><div class="small muted">${esc(S.settings.enrolled.replace(/-/g, '.'))} 入学</div></div></div>
    <div class="kpis"><div class="kpi"><b>${cr}</b><span>取得単位</span></div><div class="kpi"><b>${(tot / 3600).toFixed(1)}</b><span>総聴講（時間）</span></div>
      <div class="kpi"><b>${sk}</b><span>連続日数</span></div><div class="kpi"><b>${ls}</b><span>最長連続</span></div></div>
  </section>
  <section><div class="sec-head"><h2>聴講の記録</h2><span class="small muted">直近${weeks}週</span></div>
    <div class="card"><div class="heat-wrap"><div class="heat">${cells.join('')}</div></div>
    <div class="legend">少ない <i style="background:var(--line)"></i><i class="l1" style="background:color-mix(in srgb,var(--accent) 35%,var(--line))"></i><i style="background:color-mix(in srgb,var(--accent) 60%,var(--line))"></i><i style="background:color-mix(in srgb,var(--accent) 82%,var(--line))"></i><i style="background:var(--accent)"></i> 多い（1日1分以上で連続記録）</div></div></section>
  <section><div class="sec-head"><h2>学位</h2></div><div class="card">${S.faculties.map(f => {
    const c = credits(f.id), fr = rankOf(c, FAC_RANKS), lo = fr.next ? FAC_RANKS.find(x => x[1] === fr.name)[0] : c, pct = fr.next ? (c - lo) / (fr.next[0] - lo) : 1;
    return `<div class="deg-row">${sealHTML(f, 'sm')}<div class="dr-main"><div style="display:flex;justify-content:space-between;gap:8px"><b class="small">${esc(f.name)}</b><span class="small" style="color:var(--accent)">${fr.name}</span></div>
      <div class="bar"><i style="width:${pct * 100}%"></i></div><span class="small muted">${c}単位${fr.next ? ` · 次の${fr.next[1]}まで${fr.next[0] - c}` : ''}</span></div></div>`;
  }).join('')}</div></section>
  <section><div class="sec-head"><h2>実績</h2><span class="small muted">${achievements().filter(a => a.on).length}/${achievements().length}</span></div>
    <div class="badges">${achievements().map(a => `<div class="badge ${a.on ? 'on' : ''}"><span class="b-ico">${a.ico}</span><span class="b-name">${a.name}</span><span class="b-desc">${a.desc}</span></div>`).join('')}</div></section>
  <section><div class="sec-head"><h2>ひらめきノート</h2><span class="small muted">${notes.length}件</span></div>
    <div class="card">${notes.length ? notes.map(n => noteHTML(n, true)).join('') : '<p class="small muted">運転中は「しおり」をワンタップ。あとでここに考えたことを書き足せます。</p>'}</div></section>`;
}
function achievements() {
  const cr = credits(), tot = totalSec(), ls = longestStreak(), facs = S.faculties.filter(f => credits(f.id) > 0).length;
  return [
    { ico: '始', name: '入学式', desc: '初めての単位', on: cr >= 1 },
    { ico: '五', name: '学びの習慣', desc: '5単位を取得', on: cr >= 5 },
    { ico: '廿', name: '本の虫', desc: '20単位を取得', on: cr >= 20 },
    { ico: '三', name: '三日坊主卒業', desc: '3日連続で聴講', on: ls >= 3 },
    { ico: '週', name: '皆勤賞', desc: '7日連続で聴講', on: ls >= 7 },
    { ico: '月', name: '月の満ち欠け', desc: '30日連続で聴講', on: ls >= 30 },
    { ico: '時', name: '十時間の旅', desc: '累計10時間聴講', on: tot >= 36000 },
    { ico: '博', name: '学際人', desc: '4学部で単位取得', on: facs >= 4 },
    { ico: '全', name: '全学部制覇', desc: 'すべての学部で単位', on: S.faculties.length > 0 && facs >= S.faculties.length },
    { ico: '記', name: '思索家', desc: 'ノートを10件', on: S.notes.length >= 10 },
    { ico: '創', name: '教壇に立つ', desc: '講義を自作する', on: S.lectures.some(l => l.type === 'script' && !l.sample) },
    { ico: '録', name: '放送局長', desc: 'MP3を10本登録', on: S.lectures.filter(l => l.type === 'audio').length >= 10 }
  ];
}
function posLabel(l, pos) { return l && l.type === 'script' ? `${Math.round(pos) + 1}文目` : fmt(pos); }
function noteHTML(n, withLect) {
  const l = lect(n.lectureId);
  return `<div class="note"><button class="n-time" data-act="jump" data-id="${n.lectureId}" data-pos="${n.pos}">${ICON.play.replace('<svg', '<svg style="width:10px;height:10px;display:inline-block;margin-right:3px"')}${posLabel(l, n.pos)}</button>
    <div class="n-main">${n.text ? esc(n.text) : '<span class="muted">しおり（メモを書き足せます）</span>'}<div class="n-meta">${withLect && l ? esc(l.title) + ' · ' : ''}${new Date(n.createdAt).toLocaleDateString('ja-JP')}</div></div>
    <button class="n-del" data-act="editnote" data-note="${n.id}">編集</button></div>`;
}

/* ---- 設定 ---- */
function viewPrefs() {
  const voices = Voice.list;
  return `<section class="stack"><h1>設定</h1></section>
  <section class="card form"><h3>再生</h3>
    <div class="grid2"><div class="field"><label for="pBack">戻る秒数</label><select class="input" id="pBack" data-set="back">${[10, 15, 30].map(n => `<option value="${n}" ${S.settings.back === n ? 'selected' : ''}>${n}秒</option>`).join('')}</select></div>
    <div class="field"><label for="pFwd">送る秒数</label><select class="input" id="pFwd" data-set="fwd">${[15, 30, 60].map(n => `<option value="${n}" ${S.settings.fwd === n ? 'selected' : ''}>${n}秒</option>`).join('')}</select></div></div>
    <div class="field"><label for="pAnn">ラジオのアナウンス</label><select class="input" id="pAnn" data-set="announcer"><option value="1" ${S.settings.announcer ? 'selected' : ''}>講義の前に曲紹介を入れる</option><option value="0" ${!S.settings.announcer ? 'selected' : ''}>入れない</option></select></div>
    <div class="field"><label for="pChime">チャイム</label><select class="input" id="pChime" data-set="chime"><option value="1" ${S.settings.chime ? 'selected' : ''}>鳴らす</option><option value="0" ${!S.settings.chime ? 'selected' : ''}>鳴らさない</option></select></div>
    <div class="field"><label for="pVoice">音声合成の声</label><select class="input" id="pVoice" data-set="voiceURI"><option value="">自動で選ぶ</option>${voices.map(v => `<option value="${esc(v.voiceURI)}" ${S.settings.voiceURI === v.voiceURI ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select>
      <span class="hint">${Voice.ok ? (voices.length ? `日本語の声が${voices.length}種類あります。` : '日本語の声が見つかりません。端末の設定で日本語の読み上げ音声を追加してください。') : 'この端末は音声合成に対応していません。'}</span></div>
    <button class="btn" data-act="testvoice">声を試す</button>
  </section>
  <section class="card form"><h3>講義の追加</h3>
    <div class="field"><label for="pQuick">MP3を選んだとき</label><select class="input" id="pQuick" data-set="quickImport"><option value="1" ${S.settings.quickImport ? 'selected' : ''}>すぐ登録する（ファイル名から自動で振り分け）</option><option value="0" ${!S.settings.quickImport ? 'selected' : ''}>確認画面で内容を直してから登録する</option></select>
      <span class="hint">フォルダのMP3を全部選んでも大丈夫です。登録済みのものは飛ばし、作り直されたものは差し替えます。</span></div>
  </section>
  <section class="card form"><h3>表示</h3>
    <div class="field"><label for="pTheme">テーマ</label><select class="input" id="pTheme" data-set="theme">${[['auto', '端末に合わせる'], ['dark', '夜の講堂（ダーク）'], ['light', '昼の講堂（ライト）']].map(([v, n]) => `<option value="${v}" ${S.settings.theme === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
  </section>
  <section class="card form"><h3>データ</h3><p class="hint" id="storageInfo">保存容量を確認しています…</p>
    <div class="btn-row"><button class="btn" data-act="persist">データを消さないよう端末に依頼</button></div>
    <p class="hint">講義情報・進み具合・ノート・記録を1つのファイルに書き出せます（音声ファイルそのものは含みません。MP3は手元に保管しておいてください）。</p>
    <div class="btn-row"><button class="btn" data-act="export">記録を書き出す</button><label class="btn" for="importIn">記録を読み込む<input type="file" id="importIn" accept="application/json,.json" hidden></label></div>
    <div class="btn-row"><button class="btn ghost" data-act="rmsamples">開講記念講義（サンプル）を削除</button><button class="btn danger" data-act="wipe">すべてのデータを消去</button></div>
  </section>
  <p class="hint" style="text-align:center">AIラジオ大学 · 外部サービスを使わず、この端末の中だけで動いています。</p>`;
}

/* ================= シートの中身 ================= */
function detailSheet(id) {
  const l = lect(id); if (!l) return;
  const f = fac(l.facultyId), st = status(l), notes = S.notes.filter(n => n.lectureId === id).sort((a, b) => a.pos - b.pos);
  openSheet(`<div class="sheet-head">${sealHTML(f, 'lg')}<div class="sh-main"><p class="eyebrow">${esc(f.name)}${l.series ? ' · ' + esc(l.series) : ''}${l.episode ? ' 第' + l.episode + '回' : ''}</p>
      <h2>${esc(l.title)}</h2><p class="small muted">${esc(profName(l))} · ${fmt(lectDuration(l))} · ${l.type === 'script' ? '音声合成' : 'MP3'} · <span class="pill ${st}">${STATUS_LABEL[st]}</span></p></div></div>
    ${l.description ? `<p>${esc(l.description)}</p>` : ''}
    ${(l.tags || []).length ? `<div class="btn-row">${l.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
    ${st === 'doing' ? `<div><div class="bar"><i style="width:${lectPct(l) * 100}%"></i></div><p class="small muted" style="margin-top:4px">${Math.round(lectPct(l) * 100)}% まで聴講</p></div>` : ''}
    <div class="btn-row"><button class="btn primary" data-act="play" data-id="${id}">${ICON.play}${st === 'doing' ? '続きから聴く' : st === 'done' ? 'もう一度聴く' : '聴講する'}</button>
      ${st === 'doing' ? `<button class="btn" data-act="restart" data-id="${id}">最初から</button>` : ''}
      <button class="btn" data-act="enqueue" data-id="${id}">次に再生</button></div>
    <section><div class="sec-head"><h3>ノートとしおり</h3><button class="link" data-act="addnote" data-id="${id}">メモを書く</button></div>
      ${notes.length ? notes.map(n => noteHTML(n)).join('') : '<p class="small muted">再生中に「しおり」を押すと、その瞬間がここに残ります。</p>'}</section>
    <div class="btn-row"><button class="btn ghost" data-act="edit" data-id="${id}">講義情報を編集</button>
      <button class="btn ghost" data-act="toggledone" data-id="${id}">${st === 'done' ? '未修了に戻す' : '修了にする'}</button>
      <button class="btn danger" data-act="delete" data-id="${id}">削除</button></div>`, 'detail');
}
function editSheet(id) {
  const l = lect(id); if (!l) return;
  if (l.type === 'script') { S.draft = { editId: id, title: l.title, facultyId: l.facultyId, professor: l.professor || '', series: l.series || '', episode: l.episode || '', description: l.description || '', script: l.script }; S.studioTab = 'write'; closeSheet(); go('studio'); return; }
  openSheet(`<h2>講義情報を編集</h2><form class="form" id="editForm">
    <div class="field"><label for="eTitle">タイトル</label><input class="input" id="eTitle" name="title" value="${esc(l.title)}" required></div>
    <div class="grid2"><div class="field"><label for="eFac">学部</label><select class="input" id="eFac" name="facultyId">${facOptions(l.facultyId)}</select></div>
    <div class="field"><label for="eProf">教授</label><input class="input" id="eProf" name="professor" value="${esc(l.professor || '')}" placeholder="${esc(fac(l.facultyId).professor)}"></div></div>
    <div class="grid3"><div class="field"><label for="eSeries">シリーズ</label><input class="input" id="eSeries" name="series" value="${esc(l.series || '')}"></div>
    <div class="field"><label for="eEp">回</label><input class="input" id="eEp" name="episode" inputmode="numeric" value="${esc(l.episode || '')}"></div></div>
    <div class="field"><label for="eDesc">講義紹介</label><textarea class="input" id="eDesc" name="description">${esc(l.description || '')}</textarea></div>
    <div class="field"><label for="eTags">タグ（読点かカンマ区切り）</label><input class="input" id="eTags" name="tags" value="${esc((l.tags || []).join('、'))}"></div>
    <p class="hint">元ファイル：${esc(l.fileName || '')}</p>
    <button class="btn primary block" type="submit">保存する</button></form>`, 'edit');
  $('#editForm').addEventListener('submit', async e => {
    e.preventDefault(); const fd = new FormData(e.target);
    Object.assign(l, { title: fd.get('title').trim() || l.title, facultyId: fd.get('facultyId'), professor: fd.get('professor').trim(), series: fd.get('series').trim(), episode: parseInt(fd.get('episode'), 10) || '', description: fd.get('description').trim(), tags: fd.get('tags').split(/[、,]/).map(s => s.trim()).filter(Boolean) });
    await DB.put('lectures', l); closeSheet(); toast('保存しました'); render(true); if (Player.cur?.id === l.id) Player.metadata();
  });
}
function facultySheet(id) {
  const f = id ? fac(id) : { id: '', name: '', short: '', seal: '', color: '#3fa7c9', professor: '', desc: '', freq: '' };
  openSheet(`<h2>${id ? '学部を編集' : '学部を新設'}</h2><form class="form" id="facForm">
    <div class="grid3"><div class="field"><label for="fName">学部名</label><input class="input" id="fName" name="name" value="${esc(f.name)}" placeholder="例：芸術学部" required></div>
    <div class="field"><label for="fSeal">印（1文字）</label><input class="input" id="fSeal" name="seal" maxlength="2" value="${esc(f.seal)}" placeholder="芸" required></div></div>
    <div class="grid2"><div class="field"><label for="fShort">略称（ダイヤル表示）</label><input class="input" id="fShort" name="short" maxlength="4" value="${esc(f.short)}" placeholder="芸術"></div>
    <div class="field"><label for="fColor">学部の色</label><input class="input" id="fColor" name="color" type="color" value="${esc(f.color)}" style="padding:4px"></div></div>
    <div class="field"><label for="fProf">学部の教授</label><input class="input" id="fProf" name="professor" value="${esc(f.professor)}" placeholder="例：彩野 光"></div>
    <div class="field"><label for="fDesc">学部の紹介</label><input class="input" id="fDesc" name="desc" value="${esc(f.desc || '')}"></div>
    <div class="field"><label for="fKw">自動振り分けのキーワード（カンマ区切り）</label><input class="input" id="fKw" name="keywords" value="${esc((f.keywords || []).join(','))}" placeholder="美術,音楽,絵画"></div>
    <button class="btn primary block" type="submit">${id ? '保存する' : '開設する'}</button>
    ${id ? '<button class="btn danger block" type="button" data-act="delfac" data-fac="' + id + '">この学部を廃止</button>' : ''}</form>`, 'fac');
  $('#facForm').addEventListener('submit', async e => {
    e.preventDefault(); const fd = new FormData(e.target), name = fd.get('name').trim();
    const data = { name, seal: fd.get('seal').trim().slice(0, 2) || name[0], short: fd.get('short').trim() || name.replace(/学部$/, '').slice(0, 4), color: fd.get('color'), professor: fd.get('professor').trim() || '客員', desc: fd.get('desc').trim(), keywords: fd.get('keywords').split(/[,、]/).map(s => s.trim()).filter(Boolean) };
    if (id) Object.assign(f, data);
    else {
      const used = S.faculties.map(x => parseFloat(x.freq) || 0); let fq = Math.max(95.2, ...used) + 2.4; if (fq > 107.9) fq = 76 + Math.random() * 30;
      S.faculties.push({ id: 'f' + uid(), freq: fq.toFixed(1), pitch: 0.9 + Math.random() * 0.3, rate: 1, ...data });
    }
    await save.faculties(); closeSheet(); toast(id ? '学部を更新しました' : `${name}を開設しました`); render();
  });
}
function noteDialog(l, noteId, pos) {
  const n = noteId ? S.notes.find(x => x.id === noteId) : null;
  openSheet(`<h2>${n ? 'ノートを編集' : 'ひとことメモ'}</h2><p class="small muted">${esc(l.title)}${n ? ' · ' + posLabel(l, n.pos) : ''}</p>
    <form class="form" id="noteForm"><textarea class="input" id="noteText" placeholder="心に残ったこと、疑問、次に調べたいこと">${esc(n?.text || '')}</textarea>
    <button class="btn primary block" type="submit">保存する</button>${n ? '<button class="btn danger block" type="button" id="noteDel">このノートを削除</button>' : ''}</form>`, 'note');
  setTimeout(() => $('#noteText')?.focus(), 50);
  $('#noteForm').addEventListener('submit', async e => {
    e.preventDefault(); const text = $('#noteText').value.trim();
    const rec = n || { id: uid(), lectureId: l.id, pos: pos ?? (Player.cur?.id === l.id ? (Player.mode === 'audio' ? Player.audio.currentTime : Speech.idx) : 0), createdAt: Date.now() };
    rec.text = text; if (!n) S.notes.push(rec);
    await DB.put('notes', rec); closeSheet(); toast('ノートに記録しました'); render(true);
  });
  $('#noteDel')?.addEventListener('click', async () => { S.notes = S.notes.filter(x => x.id !== n.id); await DB.del('notes', n.id); closeSheet(); render(true); });
}
function bookmark() {
  const l = Player.cur; if (!l) return;
  const pos = Player.mode === 'audio' ? Player.audio.currentTime : Speech.idx;
  const rec = { id: uid(), lectureId: l.id, pos, text: '', createdAt: Date.now() };
  S.notes.push(rec); DB.put('notes', rec);
  toast(`しおりを挟みました（${posLabel(l, pos)}）`, { action: Drive.open ? null : ['メモを書く', () => noteDialog(l, rec.id)] });
  if (navigator.vibrate) try { navigator.vibrate(40); } catch {}
}

/* ---- フルプレイヤー ---- */
function playerSheet() {
  if (!Player.cur) return;
  openSheet(`<div id="ps"></div>`, 'player'); updatePlayerSheet(true);
}
function updatePlayerSheet(full) {
  if (sheetKind !== 'player') return;
  const box = $('#ps'); if (!box) return;
  const l = Player.cur; if (!l) { closeSheet(); return; }
  if (full || box.dataset.id !== l.id + Player.qi) {
    box.dataset.id = l.id + Player.qi;
    const f = fac(l.facultyId);
    const q = Player.queue.map((id, i) => ({ l: lect(id), i })).filter(x => x.l && x.i >= Player.qi - 1).slice(0, 8);
    box.innerHTML = `<div class="art">${sealHTML(f, 'xl')}</div>
      <div><p class="eyebrow" id="psState"></p><div class="p-title">${esc(l.title)}</div><div class="p-sub">${esc(f.name)} · ${esc(profName(l))}</div></div>
      <div><input type="range" class="scrub" id="scrub" min="0" max="1000" value="0" aria-label="再生位置"><div class="times"><span id="tCur">0:00</span><span id="tDur">0:00</span></div></div>
      <div class="controls"><button class="ctrl" data-act="prev" aria-label="前へ">${ICON.prev}</button>
        <button class="ctrl" data-act="back" aria-label="${S.settings.back}秒戻る">${ICON.back}<span class="lbl">${S.settings.back}</span></button>
        <button class="ctrl big" data-act="toggle" id="psToggle" aria-label="再生・一時停止"></button>
        <button class="ctrl" data-act="fwd" aria-label="${S.settings.fwd}秒送る">${ICON.fwd}<span class="lbl">${S.settings.fwd}</span></button>
        <button class="ctrl" data-act="next" aria-label="次へ">${ICON.next}</button></div>
      <div class="p-tools"><button class="btn" data-act="rate" id="psRate"></button><button class="btn" data-act="sleep" id="psSleep"></button>
        <button class="btn" data-act="mark">${ICON.mark}しおり</button><button class="btn" data-act="drive">${ICON.car}ドライブ</button></div>
      ${q.length > 1 ? `<div class="queue"><div class="sec-head"><h3>番組表</h3>${Player.radio ? '<span class="small muted">ラジオは自動で続きます</span>' : ''}</div><div class="list">${q.map(({ l: x, i }) => `<div class="row"><button class="row-open" data-act="qjump" data-qi="${i}">${sealHTML(fac(x.facultyId), 'sm')}<span class="row-main"><span class="row-title ${i === Player.qi ? 'q-now' : ''}">${i === Player.qi ? '放送中 · ' : ''}${esc(x.title)}</span><span class="row-sub">${esc(fac(x.facultyId).name)} · ${fmt(lectDuration(x))}</span></span></button></div>`).join('')}</div></div>` : ''}`;
    const sc = $('#scrub'); let drag = false;
    sc.addEventListener('input', () => { drag = true; $('#tCur').textContent = fmt(sc.value / 1000 * Player.dur()); });
    sc.addEventListener('change', () => { Player.seekFrac(sc.value / 1000); drag = false; });
    sc._drag = () => drag;
  }
  $('#psToggle').innerHTML = Player.playing() ? ICON.pause : ICON.play;
  $('#psState').textContent = Player.announcing ? 'ON AIR · アナウンス中' : Player.playing() ? 'ON AIR · 聴講中' : '一時停止中';
  $('#psRate').textContent = `速度 ${S.settings.rate}×`;
  const sl = $('#psSleep');
  sl.textContent = Player.sleepEnd ? 'この講義で停止' : Player.sleepAt ? `停止まで ${Math.ceil((Player.sleepAt - Date.now()) / 60000)}分` : 'スリープ';
  sl.classList.toggle('on', !!(Player.sleepAt || Player.sleepEnd));
  updateProgressUI();
}
function updateProgressUI() {
  const d = Player.dur(), p = Player.pos(), fr = d ? clamp(p / d, 0, 1) : 0;
  const mp = $('#mProg'); if (mp) mp.style.width = fr * 100 + '%';
  const sc = $('#scrub'); if (sc && !(sc._drag && sc._drag())) { sc.value = fr * 1000; $('#tCur').textContent = fmt(p); $('#tDur').textContent = (Player.mode === 'speech' ? '約' : '') + fmt(d); }
  const dp = $('#dProg'); if (dp) dp.style.width = fr * 100 + '%';
}

/* ---- ミニプレイヤー ---- */
function renderMini() {
  const m = $('#mini'); const l = Player.cur;
  m.hidden = !l; document.body.classList.toggle('no-mini', !l);
  if (!l) { m.innerHTML = `<button class="m-open" data-act="radio" data-fac="all"><span class="seal sm" style="--c:var(--accent);color:var(--accent-ink)">放</span><span class="m-main"><span class="m-title">AIラジオ大学 総合放送</span><span class="m-sub">タップで放送開始 · 全学部から自動編成</span></span></button><button class="m-btn main" data-act="radio" data-fac="all" aria-label="放送開始">${ICON.play}</button><button class="m-btn" data-act="drive" aria-label="ドライブモード">${ICON.car}</button>`; return; }
  const f = fac(l.facultyId);
  m.innerHTML = `<button class="m-open" data-act="fullplayer">${sealHTML(f, 'sm')}<span class="m-main"><span class="m-title">${esc(l.title)}</span><span class="m-sub">${Player.announcing ? 'ON AIR · 番組紹介中' : esc((Player.program ? `番組 残り${programLeft()}分 · ` : '') + f.name + ' · ' + profName(l))}</span></span></button>
    <button class="m-btn" data-act="back" aria-label="戻る">${ICON.back}</button>
    <button class="m-btn main" data-act="toggle" aria-label="再生・一時停止">${Player.playing() ? ICON.pause : ICON.play}</button>
    <button class="m-btn" data-act="drive" aria-label="ドライブモード">${ICON.car}</button><span class="m-prog" id="mProg"></span>`;
}

/* ================= ドライブモード ================= */
const Drive = {
  open: false, lock: null,
  async show() {
    Player.unlock(); this.open = true;
    const d = document.createElement('div'); d.className = 'drive'; d.id = 'drive';
    d.innerHTML = `<div class="d-top"><span class="onair-lamp" id="dLamp"><i></i>ON AIR</span><span class="d-clock"><span id="dClock">${new Date().toTimeString().slice(0, 5)}</span><span class="d-left" id="dLeft"></span></span><button class="d-exit" data-act="undrive">終了</button></div>
      <div class="d-info" id="dInfo"></div><div class="d-prog"><i id="dProg"></i></div>
      <div class="d-pad" id="dPad"></div>
      <div class="d-hint">左にスワイプで次の講義 · 車のボタン・ロック画面からも操作できます</div>`;
    let sx = null, sy = null;
    d.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    d.addEventListener('touchend', e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; if (Math.abs(dx) > 90 && Math.abs(dx) > Math.abs(dy) * 1.5) { dx < 0 ? Player.next() : Player.prev(); toast(dx < 0 ? '次の講義へ' : '前へ'); } sx = null; });
    document.body.appendChild(d); document.body.style.overflow = 'hidden'; document.body.classList.add('driving');
    try { this.lock = await navigator.wakeLock?.request('screen'); } catch {}
    updateDrive();
  },
  hide() { this.open = false; $('#drive')?.remove(); document.body.style.overflow = ''; document.body.classList.remove('driving'); try { this.lock?.release(); } catch {} this.lock = null; }
};
document.addEventListener('visibilitychange', async () => { if (Drive.open && document.visibilityState === 'visible') { try { Drive.lock = await navigator.wakeLock?.request('screen'); } catch {} } });
function updateDrive() {
  if (!Drive.open) return;
  const l = Player.cur, f = l ? fac(l.facultyId) : null;
  const info = $('#dInfo'); const key = l ? l.id + (Player.announcing ? 'a' : '') : '';
  if (info && info.dataset.k !== key) {
    info.dataset.k = key;
    info.innerHTML = !l && !Player.announcing ? '<div class="di-main"><div class="d-fac">ドライブモード</div><div class="d-title">今日はどのくらい走りますか</div></div>' : l ? `${sealHTML(f, 'lg')}<div class="di-main"><div class="d-fac">${esc(f.name)} · ${esc(profName(l))}${Player.announcing ? ' · 番組紹介中' : ''}</div><div class="d-title">${esc(l.title)}</div></div>` : '<div class="di-main"><div class="d-title">放送の準備中…</div></div>';
  }
  const pad = $('#dPad'), mode = l || Player.announcing ? 'play' : 'choose';
  if (pad && pad.dataset.mode !== mode) {
    pad.dataset.mode = mode; pad.classList.toggle('choose', mode === 'choose');
    pad.innerHTML = mode === 'play' ? `<button class="d-key main" data-act="toggle" id="dToggle"></button>
        <button class="d-key" data-act="back">${ICON.back}${S.settings.back}秒もどる</button>
        <button class="d-key" data-act="dmark">${ICON.mark}しおり</button>`
      : `<p class="d-ask">到着まで、何分ですか？</p>${[15, 25, 40, 60].map(m => `<button class="d-key" data-act="dstart" data-min="${m}"><b class="num">${m}</b>分</button>`).join('')}
        <button class="d-key wide" data-act="dstart" data-min="0">${ICON.radio}時間を決めずに聴く</button>`;
  }
  const t = $('#dToggle'); if (t) t.innerHTML = Player.playing() ? `${ICON.pause}一時停止` : `${ICON.play}再生`;
  $('#dLamp')?.classList.toggle('live', Player.playing());
  updateProgressUI();
}

/* ================= 操作（イベント委譲） ================= */
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const a = el.dataset.act, id = el.dataset.id;
  switch (a) {
    case 'go': closeSheet(); go(el.dataset.go); break;
    case 'faculty': S.facultyView = el.dataset.fac; go('faculty'); break;
    case 'tune': $('#tunerScale')?._pick(el.dataset.st, true); break;
    case 'radio': { Player.unlock(); const fid = el.dataset.fac || 'all'; const ids = radioQueue(fid); if (!ids.length) { toast('この局で放送できる講義がまだありません'); break; } Player.start(ids, 0, { radio: true, radioFac: fid }); toast(fid === 'all' ? '総合放送を開始します' : `${fac(fid).name}の放送を開始します`); break; }
    case 'play': {
      Player.unlock(); closeSheet();
      if (Player.cur && Player.cur.id === id) { Player.toggle(); break; }
      const l = lect(id); const ctx = S.view === 'faculty' ? S.lectures.filter(x => x.facultyId === l.facultyId && status(x) !== 'done' && x.id !== id).map(x => x.id) : [];
      Player.start([id, ...ctx]); break;
    }
    case 'playlist': Player.unlock(); Player.start(el.dataset.ids.split(',')); break;
    case 'restart': Player.unlock(); closeSheet(); { const p = prog(id); p.pos = 0; p.done = false; S.progress[id] = p; } Player.start([id]); break;
    case 'jump': {
      Player.unlock(); closeSheet(); const pos = parseFloat(el.dataset.pos);
      if (Player.cur && Player.cur.id === id) { if (Player.mode === 'audio') Player.audio.currentTime = pos; else Speech.seekTo(pos); Player.play(); }
      else { Player.queue = [id]; Player.qi = 0; Player.radio = false; Player.load(id, { at: pos }); }
      break;
    }
    case 'enqueue': if (!Player.cur) { Player.unlock(); Player.start([id]); } else { Player.queue.splice(Player.qi + 1, 0, id); toast('次に再生します'); } closeSheet(); break;
    case 'detail': detailSheet(id); break;
    case 'edit': editSheet(id); break;
    case 'toggledone': {
      const l = lect(id), p = prog(id);
      if (p.done) { p.done = false; S.progress[id] = p; save.progress(); toast('未修了に戻しました'); } else markDone(l, true);
      detailSheet(id); render(true); break;
    }
    case 'delete': {
      const l = lect(id); if (!(await ask(`「${l.title}」を削除しますか？ 音声とノートも消えます。`, { ok: '削除する', danger: true }))) break;
      if (Player.cur?.id === id) { Player.stopEngines(); Player.cur = null; Player.mode = null; Player.sync(); }
      S.lectures = S.lectures.filter(x => x.id !== id); delete S.progress[id]; save.progress();
      for (const n of S.notes.filter(n => n.lectureId === id)) await DB.del('notes', n.id);
      S.notes = S.notes.filter(n => n.lectureId !== id);
      await DB.del('lectures', id); await DB.del('blobs', id); closeSheet(); toast('削除しました'); render(); break;
    }
    case 'addnote': noteDialog(lect(id), null); break;
    case 'editnote': { const n = S.notes.find(x => x.id === el.dataset.note); if (n) noteDialog(lect(n.lectureId) || { title: '', id: n.lectureId }, n.id); break; }
    case 'toggle': Player.toggle(); break;
    case 'back': Player.skip(-S.settings.back); break;
    case 'fwd': Player.skip(S.settings.fwd); break;
    case 'next': Player.next(); break;
    case 'prev': Player.prev(); break;
    case 'qjump': Player.qi = +el.dataset.qi; Player.load(Player.queue[Player.qi]); break;
    case 'fullplayer': playerSheet(); break;
    case 'mark': bookmark(); break;
    case 'dmark': bookmark(); break;
    case 'rate': { const rs = [0.8, 1, 1.2, 1.5, 1.75, 2]; Player.setRate(rs[(rs.indexOf(S.settings.rate) + 1) % rs.length]); break; }
    case 'sleep': {
      const steps = [0, 15, 30, 60, 'end'];
      const cur = Player.sleepEnd ? 'end' : Player.sleepAt ? Math.round((Player.sleepAt - Date.now()) / 60000) : 0;
      const idx = cur === 'end' ? 4 : cur === 0 ? 0 : cur <= 15 ? 1 : cur <= 30 ? 2 : 3;
      const nx = steps[(idx + 1) % steps.length];
      Player.sleepEnd = nx === 'end'; Player.sleepAt = typeof nx === 'number' && nx ? Date.now() + nx * 60000 : 0;
      if (nx === 0) Bedtime.off();
      toast(nx === 0 ? 'スリープタイマーを解除しました' : nx === 'end' ? 'この講義が終わったら停止します' : `${nx}分後に停止します`);
      updatePlayerSheet(); break;
    }
    case 'drive': closeSheet(); Drive.show(); break;
    case 'scene': sceneSheet(el.dataset.scene); break;
    case 'sleepstart': {
      Player.unlock(); closeSheet(); const m = el.dataset.min;
      if (!Player.cur) { const ids = radioQueue(S.station || 'all'); if (!ids.length) { toast('聴ける講義がありません'); break; } Player.start(ids, 0, { radio: true, radioFac: S.station || 'all' }); }
      else if (!Player.playing()) Player.play();
      Player.sleepEnd = m === 'end'; Player.sleepAt = m === 'end' ? 0 : Date.now() + (+m) * 60000;
      Bedtime.on(); toast(m === 'end' ? 'この講義が終わったら止まります。おやすみなさい' : `${m}分後、音を小さくしながら止まります。おやすみなさい`, { ms: 4000 }); break;
    }
    case 'plan': programSheet(+el.dataset.min, el.dataset.fac || S.station || 'all'); break;
    case 'startprog': {
      Player.unlock(); const ids = el.dataset.ids.split(','), m = +el.dataset.min, drive = el.dataset.drive;
      closeSheet(); if (drive) Drive.show();
      Player.start(ids, 0, { radio: true, radioFac: el.dataset.fac, program: { minutes: m } }); break;
    }
    case 'dstart': {
      Player.unlock(); const m = +el.dataset.min, fid = S.station || 'all';
      if (!m) { const ids = radioQueue(fid); if (ids.length) Player.start(ids, 0, { radio: true, radioFac: fid }); else toast('放送できる講義がありません'); break; }
      lsSet('airu.mins', m); const plan = planProgram(m, fid);
      if (!plan.ids.length) { toast(`${m}分に収まる講義がありません`); break; }
      Player.start(plan.ids, 0, { radio: true, radioFac: fid, program: { minutes: m } });
      toast(`${m}分の番組：${plan.ids.length}講義`); break;
    }
    case 'undrive': Drive.hide(); break;
    case 'settings': go('prefs'); break;
    case 'newfac': facultySheet(null); break;
    case 'editfac': facultySheet(el.dataset.fac); break;
    case 'delfac': {
      const f = fac(el.dataset.fac), n = S.lectures.filter(l => l.facultyId === f.id).length;
      if (n) { toast(`${f.name}には${n}本の講義があります。先に講義を別の学部へ移してください`, { ms: 5000 }); break; }
      if (!(await ask(`${f.name}を廃止しますか？`, { ok: '廃止する', danger: true }))) break;
      S.faculties = S.faculties.filter(x => x.id !== f.id); await save.faculties(); closeSheet(); go('home'); break;
    }
    case 'writefor': S.studioTab = 'write'; S.draft = { ...(S.draft || {}), editId: null, facultyId: el.dataset.fac, title: '', script: '', professor: '', series: '', episode: '', description: '' }; go('studio'); break;
    case 'stab': S.studioTab = el.dataset.tab; render(); break;
    case 'unpend': S.pending.splice(+el.dataset.i, 1); refreshStudio(); break;
    case 'cancelpend': S.pending = []; refreshStudio(); break;
    case 'savepend': savePending(); break;
    case 'tmpl': {
      const t = $('#wScript'), th = S.draft.title || '今日のテーマ';
      const tpl = `【オープニング】\nみなさん、こんにちは。${fac(S.draft.facultyId).name}の${S.draft.professor || fac(S.draft.facultyId).professor}です。\n今日のテーマは、「${th}」です。\n\n【問いかけ】\n（聴き手が思わず考えたくなる問いを一つ）\n\n【本論1】\n\n【本論2】\n\n【本論3】\n\n【意外な視点】\n\n【まとめ】\n今日のお話をまとめると、ポイントは三つです。\n\n【宿題と次回予告】\n今日の宿題です。\nそれでは、また次の講義でお会いしましょう。\n`;
      t.value = t.value ? t.value + '\n\n' + tpl : tpl; S.draft.script = t.value; lsSet('airu.draft', S.draft); t.dispatchEvent(new Event('input', { bubbles: true })); break;
    }
    case 'preview': {
      Player.unlock(); if (Player.playing()) Player.pause();
      const ss = sentences(S.draft.script).slice(0, 3).join(''); if (!ss) { toast('台本を書いてから試聴できます'); break; }
      const f = fac(S.draft.facultyId); Voice.say(ss, { pitch: f.pitch, rate: (f.rate || 1) * S.settings.rate }); break;
    }
    case 'clearwrite': S.draft = null; lsSet('airu.draft', null); render(); break;
    case 'savewrite': {
      const d = S.draft; if (!d.title.trim() || !sentences(d.script).length) { toast('タイトルと台本を入力してください'); break; }
      const base = { title: d.title.trim(), facultyId: d.facultyId, professor: d.professor.trim(), series: d.series.trim(), episode: parseInt(d.episode, 10) || '', description: d.description.trim(), script: d.script };
      let l;
      if (d.editId && (l = lect(d.editId))) { Object.assign(l, base); }
      else { l = { id: uid(), type: 'script', tags: [], addedAt: Date.now(), ...base }; S.lectures.push(l); }
      await DB.put('lectures', l); S.draft = null; lsSet('airu.draft', null);
      toast(d.editId ? '講義を更新しました' : '講義を登録しました'); S.facultyView = l.facultyId; go('faculty'); break;
    }
    case 'gacha': {
      const fid = S.muse.facultyId, pool = (SEED.seeds[fid] || Object.values(SEED.seeds).flat());
      S.muse.theme = pool[Math.floor(Math.random() * pool.length)]; $('#mTheme').value = S.muse.theme;
      $('#mTheme').dispatchEvent(new Event('input', { bubbles: true })); break;
    }
    case 'copymuse': copy(musePrompt(), '依頼文をコピーしました'); break;
    case 'copyfile': copy(museFileName(), 'ファイル名をコピーしました'); break;
    case 'testvoice': Player.unlock(); Voice.say('こんにちは。AIラジオ大学へようこそ。今日も一緒に学びましょう。'); break;
    case 'persist': {
      try { const ok = await navigator.storage?.persist?.(); toast(ok ? 'データを保護するよう設定されました' : 'この環境では保護設定が許可されませんでした（ホーム画面に追加すると許可されやすくなります）', { ms: 5000 }); } catch { toast('この環境では設定できません'); }
      storageInfo(); break;
    }
    case 'export': exportData(); break;
    case 'rmsamples': {
      if (!(await ask('開講記念講義（サンプル8本）を削除しますか？', { ok: '削除する', danger: true }))) break;
      for (const l of S.lectures.filter(l => l.sample)) await DB.del('lectures', l.id);
      S.lectures = S.lectures.filter(l => !l.sample); toast('サンプルを削除しました'); render(); break;
    }
    case 'wipe': {
      if (!(await ask('講義・音声・記録・ノートをすべて消去します。元に戻せません。', { ok: 'すべて消去', danger: true }))) break;
      Player.stopEngines(); for (const st of ['lectures', 'notes', 'blobs', 'kv']) await DB.clear(st);
      try { localStorage.removeItem('airu.draft'); localStorage.removeItem('airu.station'); } catch {}
      location.hash = ''; location.reload(); break;
    }
  }
});
document.addEventListener('change', e => {
  const k = e.target.dataset.set;
  if (k) {
    let v = e.target.value;
    if (['back', 'fwd'].includes(k)) v = +v; if (['announcer', 'chime', 'quickImport'].includes(k)) v = v === '1';
    S.settings[k] = v; save.settings(); if (k === 'theme') applyTheme(); toast('設定を保存しました');
  }
  if (e.target.id === 'importIn' && e.target.files[0]) importData(e.target.files[0]);
});
document.addEventListener('keydown', e => {
  if (e.target.closest('input,textarea,select')) return;
  if (e.key === 'Escape') { if (Drive.open) Drive.hide(); else closeSheet(); }
  if (e.key === ' ' && Player.cur) { e.preventDefault(); Player.toggle(); }
  if (e.key === 'ArrowLeft' && Player.cur) Player.skip(-S.settings.back);
  if (e.key === 'ArrowRight' && Player.cur) Player.skip(S.settings.fwd);
});

async function copy(text, msg) {
  try { await navigator.clipboard.writeText(text); toast(msg); }
  catch { const o = $('#museOut'); if (o) { const r = document.createRange(); r.selectNodeContents(o); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } toast('選択しました。長押しでコピーしてください'); }
}
async function storageInfo() {
  const el = $('#storageInfo'); if (!el) return;
  try {
    const est = await navigator.storage.estimate(), per = await navigator.storage.persisted?.();
    const audio = S.lectures.filter(l => l.type === 'audio');
    el.textContent = `MP3 ${audio.length}本（約${(audio.reduce((s, l) => s + (l.size || 0), 0) / 1048576).toFixed(0)}MB）を保存中。使用量 ${(est.usage / 1048576).toFixed(0)}MB / 上限の目安 ${(est.quota / 1073741824).toFixed(1)}GB。${per ? 'データ保護：有効' : 'データ保護：未設定'}`;
  } catch { el.textContent = DB.mem ? 'この環境ではデータを保存できないため、閉じると消えます。' : '容量を取得できませんでした。'; }
}
function exportData() {
  const data = { app: 'ai-radio-univ', version: 1, exportedAt: new Date().toISOString(), faculties: S.faculties, lectures: S.lectures, progress: S.progress, notes: S.notes, logs: S.logs, settings: S.settings };
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `ai-radio-univ-${dayKey()}.json`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast('記録を書き出しました');
}
async function importData(file) {
  try {
    const d = JSON.parse(await file.text()); if (d.app !== 'ai-radio-univ') throw new Error('形式が違います');
    if (!(await ask('記録を読み込み、今のデータに統合しますか？（同じ講義は上書きされます）', { ok: '読み込む' }))) return;
    for (const f of d.faculties || []) { const i = S.faculties.findIndex(x => x.id === f.id); i >= 0 ? S.faculties[i] = f : S.faculties.push(f); }
    for (const l of d.lectures || []) { await DB.put('lectures', l); const i = S.lectures.findIndex(x => x.id === l.id); i >= 0 ? S.lectures[i] = l : S.lectures.push(l); }
    for (const n of d.notes || []) { await DB.put('notes', n); if (!S.notes.some(x => x.id === n.id)) S.notes.push(n); }
    Object.assign(S.progress, d.progress || {});
    for (const [k, v] of Object.entries(d.logs || {})) S.logs[k] = Math.max(S.logs[k] || 0, v);
    await save.faculties(); await DB.put('kv', S.progress, 'progress'); await DB.put('kv', S.logs, 'logs');
    const missing = (d.lectures || []).filter(l => l.type === 'audio').length;
    toast(`読み込みました${missing ? `。MP3の講義は音声ファイルを追加し直すと再生できます` : ''}`, { ms: 5000 }); render();
  } catch (err) { toast('読み込めませんでした：' + err.message); }
}
function applyTheme() { const t = S.settings.theme; if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); }

/* ================= 起動 ================= */
async function boot() {
  await DB.open();
  const [lectures, notes, faculties, progress, logs, settings, seeded] = await Promise.all([
    DB.all('lectures'), DB.all('notes'), DB.get('kv', 'faculties'), DB.get('kv', 'progress'), DB.get('kv', 'logs'), DB.get('kv', 'settings'), DB.get('kv', 'seeded')]);
  S.faculties = faculties || SEED.faculties.map(f => ({ ...f }));
  S.settings = { ...DEFAULTS, ...(settings || {}) };
  if (!S.settings.studentNo) { S.settings.studentNo = `AIRU-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`; save.settings(); }
  S.lectures = lectures; S.notes = notes; S.progress = progress || {}; S.logs = logs || {};
  if (!seeded) {
    const t = Date.now() - 1e6;
    for (const [i, l] of SEED.lectures.entries()) { const rec = { ...l, type: 'script', sample: true, professor: '', addedAt: t + i }; await DB.put('lectures', rec); S.lectures.push(rec); }
    await DB.put('kv', true, 'seeded'); await save.faculties();
  }
  S.draft = lsGet('airu.draft', null);
  applyTheme(); Player.init(); renderMini(); render();
  if (S.view === 'prefs') storageInfo();
  window.addEventListener('hashchange', () => { if (currentView() === 'prefs') storageInfo(); });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
}
window.addEventListener('pagehide', () => Player.persist(true));
boot();
})();
