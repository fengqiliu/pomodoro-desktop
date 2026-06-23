// WebAudio white-noise engine. Generates white / brown / pink-ish noise
// with a single looping buffer and a controllable gain. No asset files.

export type NoiseType = "white" | "brown" | "pink";

function getCtxClass(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return w.AudioContext || w.webkitAudioContext || null;
}

// Build a short noise buffer (2s) we loop continuously.
function makeBuffer(ctx: AudioContext, type: NoiseType): AudioBuffer {
  const seconds = 2;
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
  } else {
    // pink (Voss-McCartine approximation)
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.11;
    }
  }
  return buf;
}

export class NoiseEngine {
  private ctx: AudioContext | null = null;
  private src: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private type: NoiseType = "brown";
  private volume = 0.3;
  private playing = false;

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.gain && this.ctx) {
      this.gain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  setType(t: NoiseType) {
    if (t === this.type) return;
    this.type = t;
    if (this.playing) {
      // rebuild the buffer with the new color without audible gap
      this.stop();
      this.start();
    }
  }

  start() {
    if (this.playing) return;
    const Ctx = getCtxClass();
    if (!Ctx) return;
    if (!this.ctx) this.ctx = new Ctx();
    if (this.ctx.state === "suspended") void this.ctx.resume();

    this.gain = this.ctx.createGain();
    this.gain.gain.value = this.volume;
    this.src = this.ctx.createBufferSource();
    this.src.buffer = makeBuffer(this.ctx, this.type);
    this.src.loop = true;
    this.src.connect(this.gain);
    this.gain.connect(this.ctx.destination);
    this.src.start();
    this.playing = true;
  }

  stop() {
    if (!this.playing) return;
    try {
      this.src?.stop();
    } catch {
      /* already stopped */
    }
    this.src?.disconnect();
    this.gain?.disconnect();
    this.src = null;
    this.gain = null;
    this.playing = false;
  }

  isPlaying() {
    return this.playing;
  }
}
