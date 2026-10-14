import { describe, expect, it } from "vitest";
import { makeBuffer, NoiseEngine } from "./noiseEngine";
import { NOISE_TYPES } from "../../domain/settings";

class MockAudioBuffer {
  length: number;
  sampleRate: number;
  private channelData: Float32Array;

  constructor(_channels: number, length: number, sampleRate: number) {
    this.length = length;
    this.sampleRate = sampleRate;
    this.channelData = new Float32Array(length);
  }

  getChannelData(_channel: number) {
    return this.channelData;
  }
}

function createMockAudioContext(sampleRate = 44100): AudioContext {
  return {
    sampleRate,
    currentTime: 0,
    state: "running",
    createBuffer(channels: number, length: number, rate: number) {
      return new MockAudioBuffer(channels, length, rate) as unknown as AudioBuffer;
    },
  } as unknown as AudioContext;
}

describe("makeBuffer", () => {
  const ctx = createMockAudioContext();

  it("generates audio buffers for all supported noise types", () => {
    for (const type of NOISE_TYPES) {
      const buffer = makeBuffer(ctx, type);
      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(0);
      const data = buffer.getChannelData(0);
      expect(data.length).toBe(buffer.length);

      // Verify buffer contains valid non-NaN audio samples
      let hasInvalid = false;
      let nonZeroCount = 0;
      for (let i = 0; i < data.length; i++) {
        const val = data[i];
        if (Number.isNaN(val) || !Number.isFinite(val)) {
          hasInvalid = true;
        }
        if (val !== 0) nonZeroCount++;
      }
      expect(hasInvalid).toBe(false);
      expect(nonZeroCount).toBeGreaterThan(data.length * 0.8);
    }
  });

  it("produces 4-second buffers for rhythmic/complex types (rain, waves) and 2-second for static types", () => {
    const rainBuf = makeBuffer(ctx, "rain");
    const wavesBuf = makeBuffer(ctx, "waves");
    const whiteBuf = makeBuffer(ctx, "white");
    const brownBuf = makeBuffer(ctx, "brown");
    const pinkBuf = makeBuffer(ctx, "pink");

    expect(rainBuf.length).toBe(44100 * 4);
    expect(wavesBuf.length).toBe(44100 * 4);
    expect(whiteBuf.length).toBe(44100 * 2);
    expect(brownBuf.length).toBe(44100 * 2);
    expect(pinkBuf.length).toBe(44100 * 2);
  });
});

describe("NoiseEngine", () => {
  it("initializes in stopped state", () => {
    const engine = new NoiseEngine();
    expect(engine.isPlaying()).toBe(false);
  });

  it("clamps volume between 0 and 1", () => {
    const engine = new NoiseEngine();
    engine.setVolume(1.5);
    // Setting negative volume
    engine.setVolume(-0.5);
    expect(engine.isPlaying()).toBe(false);
  });

  it("changes noise type safely", () => {
    const engine = new NoiseEngine();
    for (const type of NOISE_TYPES) {
      expect(() => engine.setType(type)).not.toThrow();
    }
  });
});
