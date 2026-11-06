// Lightweight synthesized sound effects via WebAudio — no external audio assets needed.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

function beep(freq: number, durationMs: number, type: OscillatorType = "square", gain = 0.08) {
  const audioCtx = getCtx();
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g).connect(audioCtx.destination);
  const now = audioCtx.currentTime;
  g.gain.setValueAtTime(gain, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);
  osc.start(now);
  osc.stop(now + durationMs / 1000);
}

function noiseBurst(durationMs: number, gain = 0.1) {
  const audioCtx = getCtx();
  if (!audioCtx) return;
  const bufferSize = Math.floor(audioCtx.sampleRate * (durationMs / 1000));
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  const g = audioCtx.createGain();
  g.gain.value = gain;
  src.connect(g).connect(audioCtx.destination);
  src.start();
}

export function playSfx(name: string) {
  switch (name) {
    case "typewriter":
      beep(1800, 40, "square", 0.05);
      setTimeout(() => beep(1600, 40, "square", 0.05), 70);
      break;
    case "gavel":
      noiseBurst(120, 0.25);
      beep(90, 150, "triangle", 0.2);
      break;
    case "shutter":
      noiseBurst(60, 0.15);
      beep(3200, 25, "square", 0.04);
      break;
    case "stamp":
      beep(220, 90, "square", 0.15);
      break;
    case "tada":
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 180, "triangle", 0.12), i * 90));
      break;
    case "snitch":
      [440, 330].forEach((f, i) => setTimeout(() => beep(f, 140, "sawtooth", 0.1), i * 110));
      break;
  }
}
