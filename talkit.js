// talkit.js — a "Talk It!"-style formant speech synth for Strudel
// Paste this at the top of a Strudel REPL pattern (or load it as a module), then:
//
//   note("c3 e3 g3 c4").talk("hel lo wor ld")
//   note("<c3 g2>*4").talk("ah").tract(0.8)
//
// Each event speaks one token of text on the event's pitch.
// Plain English spelling is converted with simple letter-to-sound rules.
// Force exact phonemes with ARPAbet joined by colons:  "HH:EH:L:OW"
// Teach it words:  talkWords({ strudel: "s t r uw d ax l" })
//
// Controls:  .talk(text)  .tract(ratio)  .breath(0..1)  plus the usual
// note / gain / vib / vibmod / lpf / room / delay etc. from Strudel.
// Envelope: .attack() .decay() .sustain() .release() or .adsr("a:d:s:r") (seconds, sustain 0..1).

(() => {
  // ---------- phoneme data (Hz) ----------
  const VOWEL = {
    iy: [270, 2290, 3010], ih: [390, 1990, 2550], eh: [530, 1840, 2480],
    ae: [660, 1720, 2410], aa: [730, 1090, 2440], ao: [570, 840, 2410],
    uh: [440, 1020, 2240], uw: [300, 870, 2240], ah: [640, 1190, 2390],
    er: [490, 1350, 1690], ax: [500, 1500, 2500],
  };
  const DIPH = { ay: ['aa', 'iy'], aw: ['aa', 'uw'], ey: ['eh', 'iy'], ow: ['ao', 'uw'], oy: ['ao', 'iy'] };
  const GLIDE = { w: [290, 610, 2150], y: [260, 2070, 3020], r: [310, 1060, 1380], l: [360, 1300, 2800] };
  const NASAL = { m: [250, 1100, 2200], n: [250, 1600, 2600], ng: [250, 2000, 2700] };
  const FRIC = {
    s: { f: 7500, q: 1.4, g: 0.9, v: 0, d: 0.11 }, sh: { f: 3300, q: 1.1, g: 0.9, v: 0, d: 0.12 },
    f: { f: 6800, q: 0.4, g: 0.35, v: 0, d: 0.09 }, th: { f: 6500, q: 0.4, g: 0.3, v: 0, d: 0.09 },
    z: { f: 7500, q: 1.4, g: 0.6, v: 0.55, d: 0.09 }, zh: { f: 3300, q: 1.1, g: 0.6, v: 0.55, d: 0.1 },
    v: { f: 6800, q: 0.4, g: 0.25, v: 0.55, d: 0.07 }, dh: { f: 6500, q: 0.4, g: 0.2, v: 0.55, d: 0.06 },
  };
  const STOP = { p: { f: 1000, v: 0 }, t: { f: 4500, v: 0 }, k: { f: 2200, v: 0 }, b: { f: 1000, v: 1 }, d: { f: 4000, v: 1 }, g: { f: 2000, v: 1 } };
  const AFFR = { ch: ['t', 'sh'], jh: ['d', 'zh'] };
  const BW = [70, 110, 160, 250];
  const FG = [1, 0.75, 0.4, 0.2];

  // ---------- letter-to-sound ----------
  const DICT = {
    a: 'ax', the: 'dh ax', of: 'ah v', to: 't uw', too: 't uw', two: 't uw', you: 'y uw', your: 'y ao r', i: 'ay',
    my: 'm ay', me: 'm iy', we: 'w iy', he: 'hh iy', she: 'sh iy', be: 'b iy', no: 'n ow', so: 's ow', go: 'g ow',
    hi: 'hh ay', are: 'aa r', is: 'ih z', was: 'w ah z', what: 'w ah t', who: 'hh uw', said: 's eh d', have: 'hh ae v',
    love: 'l ah v', give: 'g ih v', come: 'k ah m', some: 's ah m', done: 'd ah n', gone: 'g ao n', do: 'd uw',
    does: 'd ah z', they: 'dh ey', them: 'dh eh m', then: 'dh eh n', this: 'dh ih s', that: 'dh ae t', there: 'dh eh r',
    their: 'dh eh r', where: 'w eh r', here: 'hh iy r', were: 'w er', would: 'w uh d', could: 'k uh d', should: 'sh uh d',
    one: 'w ah n', once: 'w ah n s', people: 'p iy p ax l', enough: 'ih n ah f', through: 'th r uw', though: 'dh ow',
    thought: 'th ao t', daughter: 'd ao t er', hello: 'hh eh l ow', world: 'w er l d', trust: 't r ah s t', us: 'ah s',
    ah: 'aa', aah: 'aa', oh: 'ow', ooh: 'uw', ee: 'iy', oo: 'uw', eh: 'eh', ih: 'ih', uh: 'ah', ay: 'ey', ow: 'aw',
    la: 'l aa', na: 'n aa', ma: 'm aa', da: 'd aa', ba: 'b aa', robot: 'r ow b aa t', computer: 'k ax m p y uw t er', music: 'm y uw z ih k', voice: 'v oy s',
    talk: 't ao k', walk: 'w ao k', know: 'n ow', night: 'n ay t', light: 'l ay t', eyes: 'ay z',
    again: 'ax g eh n', away: 'ax w ey', human: 'hh y uw m ax n', yes: 'y eh s', okay: 'ow k ey', ok: 'ow k ey',
  };
  const LONG = { a: ['ey'], e: ['iy'], i: ['ay'], o: ['ow'], u: ['y', 'uw'] };
  const SHORT = { a: ['ae'], e: ['eh'], i: ['ih'], o: ['aa'], u: ['ah'] };
  const D3 = { tch: ['ch'], igh: ['ay'], dge: ['jh'], eau: ['ow'] };
  const D2 = {
    ch: ['ch'], sh: ['sh'], th: ['th'], ph: ['f'], ng: ['ng'], ck: ['k'], qu: ['k', 'w'], wh: ['w'], ee: ['iy'], ea: ['iy'],
    ai: ['ey'], ay: ['ey'], oa: ['ow'], ou: ['aw'], oi: ['oy'], oy: ['oy'], au: ['ao'], aw: ['ao'], ie: ['iy'], ei: ['ey'],
    ey: ['iy'], ui: ['uw'], eu: ['y', 'uw'], ew: ['y', 'uw'], ar: ['aa', 'r'], or: ['ao', 'r'], er: ['er'], ir: ['er'], ur: ['er'],
  };
  const isVow = (c) => !!c && 'aeiou'.includes(c);
  const VOICED = new Set(['b', 'd', 'g', 'v', 'z', 'zh', 'm', 'n', 'ng', 'l', 'r', 'w', 'y', 'jh', 'dh']);
  const isVowelPh = (p) => !!p && (VOWEL[p] || DIPH[p]);

  function g2p(raw) {
    let word = raw.toLowerCase().replace(/[^a-z]/g, '');
    if (!word) return [];
    if (DICT[word]) return DICT[word].split(' ');
    let suffix = [];
    let b = word;
    // -ed / -s inflections (decided after the body is converted)
    let inflect = null;
    if (b.length > 4 && b.endsWith('ed') && !isVow(b[b.length - 3])) { b = b.slice(0, -2); inflect = 'ed'; }
    else if (b.length > 3 && b.endsWith('s') && !b.endsWith('ss') && !b.endsWith('us')) { b = b.slice(0, -1); inflect = 's'; }
    if (DICT[b] && inflect) { const base = DICT[b].split(' '); return base.concat(inflectPh(base, inflect)); }
    // syllabic -le
    if (b.length > 3 && b.endsWith('le') && !isVow(b[b.length - 3])) { b = b.slice(0, -2); suffix = ['ax', 'l']; }
    // silent final e, magic vowel lengthening
    let magicIdx = -1;
    if (!suffix.length && b.length > 2 && b.endsWith('e') && !isVow(b[b.length - 2]) && /[aeiouy]/.test(b.slice(0, -2))) {
      if (isVow(b[b.length - 3])) magicIdx = b.length - 3;
      b = b.slice(0, -1);
    }
    const out = [];
    const last = b.length - 1;
    for (let i = 0; i < b.length;) {
      const c = b[i], n = b[i + 1], s2 = b.substr(i, 2), s3 = b.substr(i, 3);
      if (D3[s3]) { out.push(...D3[s3]); i += 3; continue; }
      if (i === 0 && s2 === 'kn') { out.push('n'); i += 2; continue; }
      if (i === 0 && s2 === 'wr') { out.push('r'); i += 2; continue; }
      if (s2 === 'gh') { if (i === 0) out.push('g'); i += 2; continue; }
      if (s2 === 'oo') { out.push(n && 'kd'.includes(b[i + 2] || '-') ? 'uh' : 'uw'); i += 2; continue; }
      if (s2 === 'ow') { out.push(i + 2 > last || !b[i + 2] ? 'ow' : ('nld'.includes(b[i + 2]) ? 'aw' : 'ow')); i += 2; continue; }
      if (s2 === 'ue' && i + 2 > last) { out.push('uw'); i += 2; continue; }
      if (D2[s2]) { out.push(...D2[s2]); i += 2; continue; }
      if (c === 'n' && n === 'k') { out.push('ng'); i += 1; continue; }
      if (!isVow(c) && c === n && c !== 'c') { i += 1; continue; } // double consonants
      if (isVow(c)) {
        let ph;
        if (i === magicIdx) ph = LONG[c];
        else if (i === last && i > 0) ph = c === 'a' ? ['ax'] : c === 'e' ? ['iy'] : c === 'i' ? ['ay'] : c === 'o' ? ['ow'] : ['uw'];
        else ph = SHORT[c];
        out.push(...ph); i += 1; continue;
      }
      switch (c) {
        case 'c': out.push(n && 'eiy'.includes(n) ? 's' : 'k'); break;
        case 'g': out.push(n && 'eiy'.includes(n) ? 'jh' : 'g'); break;
        case 'j': out.push('jh'); break;
        case 'q': out.push('k'); break;
        case 'x': out.push('k', 's'); break;
        case 's': out.push(isVow(b[i - 1]) && isVow(n) ? 'z' : 's'); break;
        case 'y':
          if (i === 0 && isVow(n)) out.push('y');
          else if (i === last) out.push(/[aeiou]/.test(b.slice(0, -1)) ? 'iy' : 'ay');
          else if (isVow(n)) out.push('y');
          else out.push('ih');
          break;
        case 'n': out.push('n'); break;
        case 'h': out.push('hh'); break;
        default: out.push(c);
      }
      i += 1;
    }
    const ph = out.concat(suffix);
    return ph.concat(inflect ? inflectPh(ph, inflect) : []);
  }
  function inflectPh(ph, kind) {
    const l = ph[ph.length - 1];
    if (kind === 's') return [VOICED.has(l) || isVowelPh(l) ? 'z' : 's'];
    if (l === 't' || l === 'd') return ['ih', 'd'];
    return [['p', 'k', 'f', 's', 'sh', 'ch', 'th'].includes(l) ? 't' : 'd'];
  }
  function toPhonemes(text) {
    const t = String(text).trim();
    if (t.includes(':')) return t.toLowerCase().split(':').filter(Boolean).flatMap((p) => AFFR[p] || [p]);
    return g2p(t).flatMap((p) => AFFR[p] || [p]);
  }

  // ---------- phoneme -> timed segments ----------
  // unit: { f:[f1,f2,f3], vo, as, fr:{f,q,g}|null, fixed (sec) | w (stretch weight), tr (transition sec) }
  function buildUnits(ph, breath) {
    const units = [];
    const nextF = (i) => {
      for (let j = i + 1; j < ph.length; j++) {
        const p = ph[j];
        if (VOWEL[p]) return VOWEL[p];
        if (DIPH[p]) return VOWEL[DIPH[p][0]];
        if (GLIDE[p]) return GLIDE[p];
      }
      return VOWEL.ax;
    };
    ph.forEach((p, i) => {
      if (VOWEL[p]) units.push({ f: VOWEL[p], vo: 1, as: breath, w: 1, tr: 0.04 });
      else if (DIPH[p]) {
        units.push({ f: VOWEL[DIPH[p][0]], vo: 1, as: breath, w: 0.4, tr: 0.04 });
        units.push({ f: VOWEL[DIPH[p][1]], vo: 1, as: breath, w: 0.6, tr: 0.09 });
      } else if (GLIDE[p]) units.push({ f: GLIDE[p], vo: 1, as: breath * 0.5, fixed: 0.065, tr: 0.03 });
      else if (NASAL[p]) units.push({ f: NASAL[p], vo: 0.5, as: 0, fixed: 0.075, tr: 0.03, nasal: true });
      else if (FRIC[p]) {
        const F = FRIC[p];
        units.push({ f: [250, 1200, 2400], vo: F.v, as: 0, fr: { f: F.f, q: F.q, g: F.g }, fixed: F.d, tr: 0.02 });
      } else if (p === 'hh') units.push({ f: nextF(i), vo: 0, as: 0.9, fixed: 0.07, tr: 0.02 });
      else if (STOP[p]) {
        const S = STOP[p];
        units.push({ f: [200, 1200, 2400], vo: S.v ? 0.25 : 0, as: 0, fixed: S.v ? 0.04 : 0.055, tr: 0.015 });
        units.push({ f: nextF(i), vo: S.v ? 0.3 : 0, as: 0, fr: { f: S.f, q: 1, g: 0.8 }, fixed: 0.012, tr: 0.003 });
        if (!S.v) units.push({ f: nextF(i), vo: 0, as: 0.8, fixed: 0.025, tr: 0.005 });
      }
      // unknown tokens are skipped
    });
    // even out loudness between vowels (low-F1 vowels sit on strong harmonics)
    units.forEach((u) => { if (u.vo >= 1) u.vo *= Math.min(2.5, Math.max(0.5, Math.pow(u.f[0] / 400, 1.4))); });
    if (!units.some((u) => u.w)) {
      const u = units[units.length - 1];
      if (u) { u.w = 1; u.fixed = 0; }
    }
    return units;
  }
  function layout(units, D) {
    const room = D * 0.96;
    let fixed = 0, w = 0;
    units.forEach((u) => { fixed += u.fixed || 0; w += u.w || 0; });
    const vmin = 0.045;
    let k = 1, avail = room - fixed;
    if (avail < vmin * w) { k = room / (fixed + vmin * w); avail = vmin * w * k; }
    let t = 0;
    units.forEach((u) => {
      u.t0 = t;
      u.dur = u.w ? (avail * u.w) / w : u.fixed * k;
      t += u.dur;
    });
    return t;
  }

  // ---------- audio ----------
  const cache = new WeakMap();
  function shared(ctx) {
    let c = cache.get(ctx);
    if (c) return c;
    const len = ctx.sampleRate * 2;
    const noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const N = 48, real = new Float32Array(N + 1), imag = new Float32Array(N + 1);
    for (let n = 1; n <= N; n++) imag[n] = 1 / Math.pow(n, 1.3);
    c = { noise, wave: ctx.createPeriodicWave(real, imag) };
    cache.set(ctx, c);
    return c;
  }
  function noteToHz(v) {
    if (v.freq != null && !isNaN(Number(v.freq))) return Number(v.freq);
    let n = v.note ?? v.n;
    if (typeof n === 'string') {
      const m = /^([a-gA-G])([#bs]*)(-?\d+)?$/.exec(n.trim());
      if (m) {
        const base = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[m[1].toLowerCase()];
        let acc = 0;
        for (const ch of m[2]) acc += ch === 'b' ? -1 : 1;
        n = base + acc + 12 * ((m[3] == null ? 3 : parseInt(m[3], 10)) + 1);
      } else n = Number(n);
    }
    if (n == null || isNaN(n)) n = 48;
    return 440 * Math.pow(2, (n - 69) / 12);
  }

  const MASTER = 0.9;
  // Builds the voice graph. Returns { node, stop, end }. `dest` is optional (for offline tests).
  function talkVoice(ctx, t, value, onended, dest) {
    const { noise, wave } = shared(ctx);
    const D = Math.max(0.08, Number(value.duration) || 0.5);
    const tract = Number(value.tract) || 1;
    const breath = Math.min(1, Math.max(0, Number(value.breath) || 0));
    const gain = value.gain != null ? Number(value.gain) : 1;
    const ph = toPhonemes(value.text != null ? value.text : 'ah');
    const units = buildUnits(ph.length ? ph : ['ax'], breath);
    const total = layout(units, D);
    const tEnd = t + total;
    const num = (x, d) => (x != null && !isNaN(Number(x)) ? Number(x) : d);
    const atk = Math.max(0.001, num(value.attack, 0.004));
    const dec = Math.max(0, num(value.decay, 0));
    const sus = Math.min(1, Math.max(0, num(value.sustain, 1)));
    const rel = Math.max(0.005, num(value.release, 0.04));

    const osc = ctx.createOscillator();
    osc.setPeriodicWave(wave);
    osc.frequency.setValueAtTime(noteToHz(value), t);
    const nz = ctx.createBufferSource();
    nz.buffer = noise; nz.loop = true;

    const voiceG = ctx.createGain(), aspG = ctx.createGain(), formIn = ctx.createGain();
    voiceG.gain.value = 0; aspG.gain.value = 0;
    osc.connect(voiceG).connect(formIn);
    nz.connect(aspG).connect(formIn);

    const sum = ctx.createGain();
    const fil = [0, 1, 2, 3].map((i) => {
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = i === 3 ? 3500 * tract : 1000;
      f.Q.value = (i === 3 ? 3500 * tract : 1000) / BW[i];
      const g = ctx.createGain(); g.gain.value = FG[i];
      formIn.connect(f); f.connect(g); g.connect(sum);
      return f;
    });
    const fricF = ctx.createBiquadFilter(); fricF.type = 'bandpass'; fricF.frequency.value = 5000; fricF.Q.value = 1;
    const fricG = ctx.createGain(); fricG.gain.value = 0;
    nz.connect(fricF).connect(fricG).connect(sum);

    const out = ctx.createGain();
    const peak = MASTER * gain;
    const held = tEnd - t;
    const level = held <= atk ? peak * (held / atk)
      : held <= atk + dec ? peak * (1 - (1 - sus) * ((held - atk) / dec))
      : peak * sus;
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(peak, t + atk);
    if (dec > 0 && t + atk + dec < tEnd) out.gain.linearRampToValueAtTime(peak * sus, t + atk + dec);
    out.gain.setValueAtTime(level, tEnd);
    out.gain.linearRampToValueAtTime(0, tEnd + rel);
    sum.connect(out);

    // vibrato
    let lfo = null;
    if (value.vib != null) {
      lfo = ctx.createOscillator(); lfo.frequency.value = Number(value.vib) || 5;
      const lg = ctx.createGain(); lg.gain.value = (value.vibmod != null ? Number(value.vibmod) : 0.4) * 100;
      lfo.connect(lg).connect(osc.detune);
      lfo.start(t);
    }

    // parameter automation
    const lastVal = new Map();
    const ramp = (param, t0, tr, v, first) => {
      if (first || !lastVal.has(param)) param.setValueAtTime(v, t0);
      else { param.setValueAtTime(lastVal.get(param), t0); param.linearRampToValueAtTime(v, t0 + tr); }
      lastVal.set(param, v);
    };
    units.forEach((u, idx) => {
      const t0 = t + u.t0, tr = Math.min(u.tr || 0.03, u.dur * 0.9), first = idx === 0;
      [0, 1, 2].forEach((i) => {
        const hz = u.f[i] * tract;
        ramp(fil[i].frequency, t0, tr, hz, first);
        ramp(fil[i].Q, t0, tr, hz / BW[i], first);
      });
      ramp(voiceG.gain, t0, tr, u.vo, first);
      ramp(aspG.gain, t0, tr, u.as, first);
      ramp(fricG.gain, t0, tr, u.fr ? u.fr.g * 0.45 : 0, first);
      if (u.fr) { ramp(fricF.frequency, t0, tr, u.fr.f, first); ramp(fricF.Q, t0, tr, u.fr.q, first); }
    });

    const stopAt = tEnd + rel + 0.02;
    osc.start(t); nz.start(t);
    osc.stop(stopAt); nz.stop(stopAt);
    if (lfo) lfo.stop(stopAt);
    osc.onended = () => { try { out.disconnect(); sum.disconnect(); } catch (e) {} if (onended) onended(); };
    if (dest) out.connect(dest);
    const stop = (time) => {
      const s = Math.max(time ?? 0, t);
      if (s < tEnd) { out.gain.cancelScheduledValues(s); out.gain.setValueAtTime(out.gain.value || MASTER * gain, s); out.gain.linearRampToValueAtTime(0, s + rel); }
    };
    return { node: out, stop, end: stopAt, phonemes: ph };
  }

  // ---------- Strudel hooks ----------
  const G = typeof globalThis !== 'undefined' ? globalThis : window;
  G.talkWords = (obj) => { for (const k in obj) DICT[k.toLowerCase()] = String(obj[k]).toLowerCase(); };
  if (typeof registerSound === 'function') {
    registerSound('talk', (t, value, onended) => {
      const r = talkVoice(getAudioContext(), t, value, onended);
      return { node: r.node, stop: r.stop };
    }, { type: 'synth' });
    const setKey = (key) => (val) => (pat) => pat.withValue((v) => ({ ...(typeof v === 'object' && v !== null ? v : { note: v }), [key]: val }));
    register('talk', (text, pat) => setKey('text')(String(text))(pat.withValue((v) => ({ ...(typeof v === 'object' && v !== null ? v : { note: v }), s: 'talk' }))));
    register('tract', (x, pat) => setKey('tract')(Number(x))(pat));
    register('breath', (x, pat) => setKey('breath')(Number(x))(pat));
  }
  if (typeof module !== 'undefined') module.exports = { talkVoice, g2p, toPhonemes, layout, buildUnits };
})();
