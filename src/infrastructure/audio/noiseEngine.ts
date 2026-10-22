// WebAudio white-noise engine. Generates white / brown / pink / rain / waves noise
// with a single looping buffer and controllable gain with fade-in/out. No asset files.

import type { NoiseType } from "../../domain/settings";

const FADE_SEC = 0.35; // 350ms smooth fade duration

function getCtxClass(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return w.AudioContext || w.webkitAudioContext || null;
}

// Build a noise buffer we loop continuously.
export function makeBuffer(ctx: AudioContext, type: NoiseType): AudioBuffer {
  const seconds = type === "waves" || type === "rain" ? 4 : 2;
  const len = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);

  if (type === "white") {
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  } else if (type === "brown") {
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
  } else if (type === "pink") {
    // pink (Voss-McCartney approximation)
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.11;
    }
  } else if (type === "rain") {
    // Gentle rainfall: soft filtered atmospheric bed + randomized raindrop impacts
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.08;
    }
    // Random raindrop splatters
    const dropProb = 40 / ctx.sampleRate; // ~40 drops per second
    for (let i = 0; i < len - 200; i++) {
      if (Math.random() < dropProb) {
        const dropVol = 0.06 + Math.random() * 0.16;
        const decayLen = Math.floor(40 + Math.random() * 100);
        const freq = 0.18 + Math.random() * 0.22;
        for (let j = 0; j < decayLen && i + j < len; j++) {
          const decay = Math.exp(-j / (decayLen * 0.3));
          const splash = Math.sin(j * freq * Math.PI) * (Math.random() * 0.5 + 0.5);
          data[i + j] += splash * dropVol * decay;
        }
      }
    }
    // Circular crossfade at boundary (50ms) to ensure seamless loop
    const crossfadeLen = Math.floor(ctx.sampleRate * 0.05);
    for (let i = 0; i < crossfadeLen; i++) {
      const t = i / crossfadeLen;
      data[i] = data[i] * t + data[len - crossfadeLen + i] * (1 - t);
    }
  } else if (type === "waves") {
    // Ocean waves: 4-second period swelling and receding filtered noise
    let brown = 0;
    for (let i = 0; i < len; i++) {
      const t = i / ctx.sampleRate;
      const progress = (t % 4) / 4;
      const swell = Math.sin(Math.PI * progress);
      const envelope = Math.pow(Math.max(0, swell), 2.4);

      const white = Math.random() * 2 - 1;
      const alpha = 0.015 + envelope * 0.04;
      brown = (brown + alpha * white) / (1 + alpha);

      const foam = white * envelope * 0.08;
      const roar = brown * (0.35 + envelope * 0.65) * 3.2;

      data[i] = (roar + foam) * 0.85;
    }
    // Circular crossfade at boundary (100ms)
    const crossfadeLen = Math.floor(ctx.sampleRate * 0.1);
    for (let i = 0; i < crossfadeLen; i++) {
      const t = i / crossfadeLen;
      data[i] = data[i] * t + data[len - crossfadeLen + i] * (1 - t);
    }
  }
  return buf;
}

// Synthesizing a buffer is expensive (the rain/waves variants are 4s long and
// add per-drop impulses), and switching types would otherwise redo that work on
// the main thread every time. Cache per AudioContext so repeated start/type
// changes reuse the same buffer; the WeakMap lets a discarded context be GC'd.
const bufferCache = new WeakMap<AudioContext, Map<NoiseType, AudioBuffer>>();

export function getBuffer(ctx: AudioContext, type: NoiseType): AudioBuffer {
  let byType = bufferCache.get(ctx);
  if (!byType) {
    byType = new Map();
    bufferCache.set(ctx, byType);
  }
  const cached = byType.get(type);
  if (cached) return cached;

  const buffer = makeBuffer(ctx, type);
  byType.set(type, buffer);
  return buffer;
}

export class NoiseEngine {
  private ctx: AudioContext | null = null;
  private src: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private type: NoiseType = "brown";
  private volume = 0.3;
  private playing = false;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.gain && this.ctx && this.playing) {
      this.gain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  setType(t: NoiseType) {
    if (t === this.type) return;
    this.type = t;
    if (this.playing && this.ctx && this.gain) {
      // Seamlessly cross-fade to new buffer without interruption
      const oldSrc = this.src;
      const newSrc = this.ctx.createBufferSource();
      newSrc.buffer = getBuffer(this.ctx, this.type);
      newSrc.loop = true;
      newSrc.connect(this.gain);
      newSrc.start();
      this.src = newSrc;
      setTimeout(() => {
        try {
          oldSrc?.stop();
        } catch {
          /* already stopped */
        }
        oldSrc?.disconnect();
      }, 60);
    }
  }

  start() {
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }

    const Ctx = getCtxClass();
    if (!Ctx) return;
    if (!this.ctx) this.ctx = new Ctx();
    if (this.ctx.state === "suspended") void this.ctx.resume();

    const now = this.ctx.currentTime;

    if (this.playing && this.src && this.gain) {
      // Already running, smoothly ramp volume up if it was fading out
      this.gain.gain.cancelScheduledValues(now);
      this.gain.gain.setValueAtTime(this.gain.gain.value, now);
      this.gain.gain.linearRampToValueAtTime(this.volume, now + FADE_SEC);
      return;
    }

    this.gain = this.ctx.createGain();
    this.gain.gain.setValueAtTime(0, now);
    this.gain.gain.linearRampToValueAtTime(this.volume, now + FADE_SEC);

    this.src = this.ctx.createBufferSource();
    this.src.buffer = getBuffer(this.ctx, this.type);
    this.src.loop = true;
    this.src.connect(this.gain);
    this.gain.connect(this.ctx.destination);
    this.src.start();
    this.playing = true;
  }

  stop() {
    if (!this.playing) return;
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }

    this.playing = false;

    if (this.gain && this.ctx) {
      const now = this.ctx.currentTime;
      this.gain.gain.cancelScheduledValues(now);
      this.gain.gain.setValueAtTime(this.gain.gain.value, now);
      this.gain.gain.linearRampToValueAtTime(0.0001, now + FADE_SEC);

      const currentSrc = this.src;
      const currentGain = this.gain;
      this.stopTimer = setTimeout(() => {
        try {
          currentSrc?.stop();
        } catch {
          /* already stopped */
        }
        currentSrc?.disconnect();
        currentGain?.disconnect();
        if (this.src === currentSrc) this.src = null;
        if (this.gain === currentGain) this.gain = null;
        this.stopTimer = null;
      }, FADE_SEC * 1000 + 40);
    } else {
      try {
        this.src?.stop();
      } catch {
        /* already stopped */
      }
      this.src?.disconnect();
      this.gain?.disconnect();
      this.src = null;
      this.gain = null;
    }
  }

  isPlaying() {
    return this.playing;
  }
}
