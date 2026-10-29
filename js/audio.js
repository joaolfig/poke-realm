'use strict';
/* ============ Áudio ============
 * Tudo sintetizado com WebAudio: nada de arquivos para baixar.
 * Efeitos: osciladores com envelope + ruído filtrado.
 * Música: sequenciador chiptune gerativo. Cada faixa define tom, escala,
 * progressão e padrões; a melodia é gerada com semente fixa, então a mesma
 * faixa soa sempre igual (frases A A B A que se repetem).
 * [N] alterna: tudo ligado → só efeitos → mudo.
 */
const SOUND_KEY = 'pkr_sound_v1';
let soundMode = 2; // 2 tudo, 1 só efeitos, 0 mudo
try { const v = localStorage.getItem(SOUND_KEY); if (v !== null) soundMode = +v; } catch (e) { /* ignora */ }

let AC_ = null, MASTER = null, SFX_BUS = null, MUS_BUS = null, NOISE = null;
function audioInit() {
  if (AC_) { if (AC_.state === 'suspended' && !document.hidden) AC_.resume(); return AC_; }
  try {
    AC_ = new (window.AudioContext || window.webkitAudioContext)();
    const comp = AC_.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    MASTER = AC_.createGain(); MASTER.gain.value = 0.9;
    SFX_BUS = AC_.createGain(); SFX_BUS.gain.value = soundMode ? 1 : 0;
    MUS_BUS = AC_.createGain(); MUS_BUS.gain.value = soundMode === 2 ? 0.55 : 0;
    SFX_BUS.connect(MASTER); MUS_BUS.connect(MASTER); MASTER.connect(comp); comp.connect(AC_.destination);
    NOISE = AC_.createBuffer(1, AC_.sampleRate, AC_.sampleRate);
    const d = NOISE.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { AC_ = null; }
  return AC_;
}
// o navegador só libera áudio depois de um gesto do jogador
['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, () => audioInit(), { capture: true }));
document.addEventListener('visibilitychange', () => {
  if (!AC_) return;
  if (document.hidden) AC_.suspend(); else AC_.resume();
});

function setSoundMode(m) {
  soundMode = m;
  try { localStorage.setItem(SOUND_KEY, String(m)); } catch (e) { /* ignora */ }
  if (!AC_) return;
  const t = AC_.currentTime;
  SFX_BUS.gain.setTargetAtTime(m ? 1 : 0, t, 0.05);
  MUS_BUS.gain.setTargetAtTime(m === 2 ? 0.55 : 0, t, 0.3);
}
function cycleSound() {
  setSoundMode((soundMode + 2) % 3);
  return ['Som desligado', 'Só efeitos (música desligada)', 'Música e efeitos ligados'][soundMode];
}

/* ---------- blocos de síntese ---------- */
const mtof = n => 440 * Math.pow(2, (n - 69) / 12);

// nota com envelope ADSR simples; f1 = frequência final (glide)
function voice(dest, t, f0, f1, dur, type, vol, o = {}) {
  const osc = AC_.createOscillator(), g = AC_.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  if (f1 && f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + (o.glide || dur));
  if (o.detune) osc.detune.value = o.detune;
  if (o.vib) {
    const lfo = AC_.createOscillator(), lg = AC_.createGain();
    lfo.frequency.value = 5.5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f0 * 0.012, t + Math.min(0.25, dur));
    lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t); lfo.stop(t + dur + 0.1);
  }
  const a = o.a || 0.005, r = o.r || 0.05;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + a);
  if (o.sus !== undefined) g.gain.setTargetAtTime(vol * o.sus, t + a, dur * 0.3);
  g.gain.setValueAtTime(o.sus !== undefined ? vol * o.sus : vol, t + Math.max(a, dur - r));
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  let out = osc;
  if (o.lp) {
    const f = AC_.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = o.q || 0.7;
    osc.connect(f); out = f;
  }
  out.connect(g); g.connect(dest);
  osc.start(t); osc.stop(t + dur + 0.05);
}
function noise(dest, t, dur, vol, type, f0, f1, q) {
  const s = AC_.createBufferSource(), f = AC_.createBiquadFilter(), g = AC_.createGain();
  s.buffer = NOISE; s.loop = true;
  f.type = type; f.frequency.setValueAtTime(f0, t); f.Q.value = q || 0.8;
  if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}

/* ---------- efeitos ---------- */
const SFX_GAP = { shoot: 0.06, hit: 0.045, hitSE: 0.06, hurt: 0.08, pick: 0.05, kill: 0.05, ui: 0.03 };
const sfxLast = {};
const SFX = {
  shoot(t, B) { const f = 700 + Math.random() * 80; voice(B, t, f, f * 0.55, 0.07, 'square', 0.035, { lp: 2600 }); },
  hit(t, B) { noise(B, t, 0.05, 0.09, 'bandpass', 2400, 900, 1.2); voice(B, t, 330, 160, 0.06, 'triangle', 0.06); },
  hitSE(t, B) { noise(B, t, 0.08, 0.13, 'bandpass', 3200, 700, 1); voice(B, t, 523, 784, 0.07, 'square', 0.045, { lp: 3000 }); },
  crit(t, B) {
    noise(B, t, 0.1, 0.14, 'highpass', 3000, 1500);
    voice(B, t, 1047, 0, 0.07, 'square', 0.05, { lp: 4000 }); voice(B, t + 0.06, 1568, 0, 0.12, 'square', 0.05, { lp: 4000 });
  },
  hurt(t, B) {
    noise(B, t, 0.18, 0.22, 'lowpass', 1800, 200);
    voice(B, t, 240, 70, 0.2, 'sawtooth', 0.09, { lp: 900 });
  },
  kill(t, B) { noise(B, t, 0.22, 0.12, 'lowpass', 2400, 120); voice(B, t, 392, 98, 0.18, 'triangle', 0.08); },
  boom(t, B) {
    noise(B, t, 0.7, 0.4, 'lowpass', 1600, 60, 1.5);
    voice(B, t, 110, 32, 0.6, 'sine', 0.35);
  },
  pot(t, B) {
    [0, 0.07, 0.14].forEach((d, i) => voice(B, t + d, 420 + i * 160, 700 + i * 220, 0.09, 'sine', 0.09, { glide: 0.08 }));
    voice(B, t + 0.2, 1175, 0, 0.25, 'triangle', 0.05, { r: 0.2 });
  },
  pick(t, B) { voice(B, t, 988, 0, 0.06, 'square', 0.045, { lp: 5000 }); voice(B, t + 0.06, 1319, 0, 0.18, 'square', 0.045, { lp: 5000, r: 0.15 }); },
  lvl(t, B) {
    [72, 76, 79, 84, 88].forEach((n, i) => voice(B, t + i * 0.075, mtof(n), 0, 0.14, 'square', 0.05, { lp: 4200 }));
    [72, 76, 79, 84].forEach(n => voice(B, t + 0.4, mtof(n), 0, 0.7, 'triangle', 0.045, { a: 0.02, r: 0.5, vib: 1 }));
  },
  boss(t, B) {
    [40, 41, 47].forEach(n => voice(B, t, mtof(n), mtof(n) * 0.97, 1.6, 'sawtooth', 0.07, { a: 0.05, r: 1, lp: 700, q: 4, detune: Math.random() * 12 - 6 }));
    noise(B, t, 1.4, 0.15, 'lowpass', 400, 60);
  },
  die(t, B) { [67, 63, 60, 55].forEach((n, i) => voice(B, t + i * 0.22, mtof(n), mtof(n) * 0.98, 0.3, 'triangle', 0.08, { r: 0.2, vib: 1 })); },
  ui(t, B) { voice(B, t, 1400, 1100, 0.035, 'square', 0.025, { lp: 3500 }); },
  open(t, B) { voice(B, t, 660, 0, 0.06, 'triangle', 0.06); voice(B, t + 0.05, 880, 0, 0.1, 'triangle', 0.06, { r: 0.08 }); },
};
function sfx(k) {
  if (!soundMode || !audioInit() || AC_.state !== 'running') return;
  const fn = SFX[k];
  if (!fn) return;
  const t = AC_.currentTime;
  if (SFX_GAP[k] && t - (sfxLast[k] || -1) < SFX_GAP[k]) return;
  sfxLast[k] = t;
  try { fn(t + 0.005, SFX_BUS); } catch (e) { /* sem áudio */ }
}

/* ---------- música ---------- */
const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
  mixo: [0, 2, 4, 5, 7, 9, 10], phryg: [0, 1, 3, 5, 7, 8, 10], harm: [0, 2, 3, 5, 7, 8, 11],
};
// prog: graus da escala (0 = tônica), um por compasso. drums: k = bumbo, s = caixa, h = chimbal (16 passos)
const TRACKS = {
  menu: { bpm: 76, root: 57, scale: 'minor', prog: [0, 5, 2, 6], pad: 0.05, arp: [0, 1, 2, 1, 3, 2, 1, 2], arpRate: 2, arpVol: 0.022, bass: [0], lead: 0.35, leadVol: 0.04, seed: 11 },
  vila: { bpm: 96, root: 53, scale: 'major', prog: [0, 4, 5, 3], pad: 0.025, arp: [0, 2, 1, 2], arpRate: 2, arpVol: 0.025, bass: [0, 6, 8, 14], lead: 0.55, leadVol: 0.045, seed: 3, drums: { k: [0, 8], s: [], h: [4, 12] } },
  campo: { bpm: 122, root: 55, scale: 'mixo', prog: [0, 6, 3, 0, 0, 6, 3, 4], arp: [0, 1, 2, 3], arpRate: 2, arpVol: 0.022, bass: [0, 3, 6, 8, 11, 14], lead: 0.6, leadVol: 0.045, seed: 7, drums: { k: [0, 6, 8], s: [4, 12], h: [0, 2, 4, 6, 8, 10, 12, 14] } },
  floresta: { bpm: 104, root: 52, scale: 'dorian', prog: [0, 3, 0, 6], pad: 0.03, arp: [0, 2, 1, 3, 2, 1], arpRate: 1, arpVol: 0.016, bass: [0, 10], lead: 0.4, leadVol: 0.04, seed: 21, drums: { k: [0, 10], s: [8], h: [2, 6, 10, 14] } },
  montanha: { bpm: 112, root: 50, scale: 'dorian', prog: [0, 6, 5, 6], arp: [0, 2, 3, 2], arpRate: 2, arpVol: 0.022, bass: [0, 4, 8, 12], lead: 0.5, leadVol: 0.045, seed: 33, drums: { k: [0, 8, 10], s: [4, 12], h: [2, 6, 10, 14] } },
  sombra: { bpm: 92, root: 48, scale: 'harm', prog: [0, 5, 3, 4], pad: 0.04, arp: [0, 1, 2, 1], arpRate: 2, arpVol: 0.02, bass: [0, 7], lead: 0.3, leadVol: 0.04, seed: 9, drums: { k: [0, 7], s: [12], h: [] } },
  masmorra: { bpm: 100, root: 50, scale: 'phryg', prog: [0, 1, 0, 6], pad: 0.035, arp: [0, 2], arpRate: 4, arpVol: 0.02, bass: [0, 3, 8, 11], lead: 0.25, leadVol: 0.035, seed: 17, drums: { k: [0, 8], s: [], h: [4, 12] } },
  chefe: { bpm: 150, root: 52, scale: 'harm', prog: [0, 0, 5, 4], arp: [0, 1, 2, 3, 2, 1], arpRate: 1, arpVol: 0.02, bass: [0, 2, 4, 6, 8, 10, 12, 14], lead: 0.7, leadVol: 0.05, seed: 5, drums: { k: [0, 4, 8, 10, 12], s: [4, 12], h: [0, 2, 4, 6, 8, 10, 12, 14] } },
};

function seeded(seed) { let a = seed * 9973 + 1; return () => { a = (a * 16807) % 2147483647; return (a - 1) / 2147483646; }; }
// gera 4 frases (A A B A) de 16 passos para a faixa: [grau relativo | null, duração em passos]
function buildLead(tr) {
  const R = seeded(tr.seed), phrase = () => {
    const out = [];
    let deg = 4, i = 0;
    while (i < 16) {
      const len = R() < 0.6 ? 2 : R() < 0.5 ? 4 : R() < 0.5 ? 1 : 3;
      if (R() < tr.lead || i === 0) {
        deg = Math.max(0, Math.min(9, deg + Math.round((R() - 0.5) * 4)));
        out.push([i, deg, Math.min(len, 16 - i)]);
      }
      i += len;
    }
    return out;
  };
  const A = [phrase(), phrase()], B = [phrase(), phrase()];
  return [A[0], A[1], A[0], A[1], B[0], B[1], A[0], A[1]];
}
for (const k in TRACKS) TRACKS[k].leadBars = buildLead(TRACKS[k]);

const MUS = { cur: null, want: null, wantT: 0, bus: null, step: 0, next: 0, timer: null };
function noteOf(tr, deg, oct) {
  const sc = SCALES[tr.scale], o = Math.floor(deg / 7);
  return tr.root + 12 * (oct + o) + sc[((deg % 7) + 7) % 7];
}
function schedStep(tr, s, t) {
  const B = MUS.bus, sp = 60 / tr.bpm / 4, bar = Math.floor(s / 16), i = s % 16;
  const chord = tr.prog[bar % tr.prog.length];
  if (i === 0 && tr.pad) {
    for (const d of [0, 2, 4]) voice(B, t, mtof(noteOf(tr, chord + d, 0)), 0, sp * 16, 'triangle', tr.pad, { a: sp * 4, r: sp * 4, lp: 1400 });
  }
  if (tr.bass.includes(i)) {
    const n = noteOf(tr, chord, -1) + (i % 8 === 6 && tr.bass.length > 4 ? 12 : 0);
    voice(B, t, mtof(n), 0, sp * 1.8, 'triangle', 0.13, { r: 0.04 });
  }
  if (i % tr.arpRate === 0) {
    const a = tr.arp[(i / tr.arpRate) % tr.arp.length];
    voice(B, t, mtof(noteOf(tr, chord + a * 2, 1)), 0, sp * tr.arpRate * 0.9, 'square', tr.arpVol, { lp: 2200, r: 0.03 });
  }
  const ph = tr.leadBars[bar % tr.leadBars.length];
  for (const [at, deg, len] of ph) {
    if (at !== i) continue;
    // aproxima a nota do acorde para não soar aleatória
    let d = chord + deg - 4;
    const rel = ((d - chord) % 7 + 7) % 7;
    if (len >= 3 && rel !== 0 && rel !== 2 && rel !== 4) d += rel === 1 || rel === 3 ? -1 : 1;
    voice(B, t, mtof(noteOf(tr, d, 1)), 0, sp * len * 0.95, len >= 3 ? 'triangle' : 'square', tr.leadVol, { lp: 3200, vib: len >= 3, r: 0.06 });
  }
  const dr = tr.drums;
  if (dr) {
    if (dr.k.includes(i)) voice(B, t, 140, 42, 0.16, 'sine', 0.32, { glide: 0.1 });
    if (dr.s.includes(i)) { noise(B, t, 0.13, 0.11, 'highpass', 1400); voice(B, t, 220, 140, 0.06, 'triangle', 0.06); }
    if (dr.h.includes(i)) noise(B, t, 0.035, 0.035, 'highpass', 7500);
  }
}
function musicPump() {
  if (!AC_ || AC_.state !== 'running' || !MUS.cur) return;
  const tr = TRACKS[MUS.cur], sp = 60 / tr.bpm / 4;
  if (MUS.next < AC_.currentTime) MUS.next = AC_.currentTime + 0.05;
  while (MUS.next < AC_.currentTime + 0.15) {
    try { schedStep(tr, MUS.step, MUS.next); } catch (e) { /* ignora */ }
    MUS.step++; MUS.next += sp;
  }
}
function startTrack(k) {
  const t = AC_.currentTime;
  if (MUS.bus) {
    const old = MUS.bus;
    old.gain.setTargetAtTime(0, t, 0.4);
    setTimeout(() => old.disconnect(), 3000);
  }
  MUS.bus = AC_.createGain();
  MUS.bus.gain.setValueAtTime(0, t);
  MUS.bus.gain.linearRampToValueAtTime(1, t + 1.5);
  MUS.bus.connect(MUS_BUS);
  MUS.cur = k; MUS.step = 0; MUS.next = t + 0.1;
}
// chamado a cada quadro com a faixa desejada; troca só depois de 1,5s estável (evita piscar em bordas de zona)
function musicTick(k, dt) {
  if (!AC_ || AC_.state !== 'running') return;
  if (!MUS.timer) MUS.timer = setInterval(musicPump, 30);
  if (k !== MUS.want) { MUS.want = k; MUS.wantT = 0; }
  MUS.wantT += dt;
  if (MUS.want !== MUS.cur && (MUS.wantT > 1.5 || !MUS.cur || k === 'chefe')) startTrack(MUS.want);
}
document.addEventListener('click', ev => { if (ev.target.closest && ev.target.closest('button, .ccard, .rcard, .slot, .pet')) sfx('ui'); }, true);
