// Page-side: renders the street ambience offline (OfflineAudioContext, no speakers) and measures
// it, so "it sounds monotonous" becomes numbers. The real Ambience class is driven as the game
// drives it: a mood update every 0.25 s of audio time. Returns metrics and, if asked, a WAV.
async (seconds = 60, mood = {}, wav = false, recorded = false) => {
  const { Ambience } = await import('/src/audio/ambience.ts');
  const { makeNoise, audioRandom } = await import('/src/audio/noise.ts');
  const rate = 44100;
  const ctx = new OfflineAudioContext(2, rate * seconds, rate);
  const random = audioRandom(0x50da);
  const out = ctx.createGain();
  out.gain.value = 0.2; // the game's master at its default volume (45%, squared)
  // The game's output chain (src/audio/index.ts): a 70 Hz floor and a limiter.
  const floor = ctx.createBiquadFilter(); floor.type = 'highpass'; floor.frequency.value = 70;
  const limit = ctx.createDynamicsCompressor();
  limit.threshold.value = -14; limit.knee.value = 6; limit.ratio.value = 8; limit.attack.value = 0.004; limit.release.value = 0.25;
  out.connect(floor).connect(limit).connect(ctx.destination);
  const amb = new Ambience(ctx, out, makeNoise(ctx, random), random);
  if (recorded) {
    const { loadRecordings } = await import('/src/audio/recordings.ts');
    const r = await loadRecordings(ctx);
    if (!r.city) return 'recording failed to load';
    amb.useRecording(r.city);
  }
  const m = { busy: 1, night: 0.6, club: 0, rain: 0, level: 1, ...mood };
  for (let t = 0; t < seconds; t += 0.25) {
    ctx.suspend(t).then(() => { amb.set(m, 0.25, true, 1); ctx.resume(); });
  }
  const buf = await ctx.startRendering();
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  const n = L.length;
  let peak = 0, clip = 0, sum = 0, low = 0, lp = 0;
  const k = 1 - Math.exp(-2 * Math.PI * 150 / rate); // one-pole lowpass at 150 Hz
  const win = rate / 2, dbs = [];
  let ws = 0;
  for (let i = 0; i < n; i++) {
    const x = (L[i] + R[i]) / 2;
    const a = Math.abs(L[i]) > Math.abs(R[i]) ? Math.abs(L[i]) : Math.abs(R[i]);
    if (a > peak) peak = a;
    if (a > 0.99) clip++;
    sum += x * x;
    lp += k * (x - lp);
    low += lp * lp;
    ws += x * x;
    if ((i + 1) % win === 0) { dbs.push(10 * Math.log10(ws / win + 1e-12)); ws = 0; }
  }
  const sorted = [...dbs].sort((a, b) => a - b);
  const q = (p) => sorted[Math.floor(p * (sorted.length - 1))];
  const median = q(0.5);
  const steady = dbs.filter((d) => Math.abs(d - median) < 1.5).length / dbs.length;
  const res = {
    seconds, mood: m,
    rmsDb: +(10 * Math.log10(sum / n + 1e-12)).toFixed(1), peak: +peak.toFixed(3), clipped: clip,
    lowShare: +(low / (sum || 1)).toFixed(2),
    loudnessSpreadDb: +(q(0.9) - q(0.1)).toFixed(1),
    steadyShare: +steady.toFixed(2),
  };
  if (wav) {
    // 16-bit stereo WAV, base64.
    const bytes = new DataView(new ArrayBuffer(44 + n * 4));
    const str = (o, s) => { for (let i = 0; i < s.length; i++) bytes.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); bytes.setUint32(4, 36 + n * 4, true); str(8, 'WAVEfmt '); bytes.setUint32(16, 16, true); bytes.setUint16(20, 1, true); bytes.setUint16(22, 2, true);
    bytes.setUint32(24, rate, true); bytes.setUint32(28, rate * 4, true); bytes.setUint16(32, 4, true); bytes.setUint16(34, 16, true); str(36, 'data'); bytes.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++) { bytes.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); bytes.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
    const u8 = new Uint8Array(bytes.buffer); let bin = '';
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
    res.wav = btoa(bin);
  }
  return res;
}
