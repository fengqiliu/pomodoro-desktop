import { useEffect, useRef } from "react";
import { NoiseEngine } from "../../infrastructure/audio/noiseEngine";
import type { NoisePref } from "../../domain/settings";
import type { Phase } from "../../domain/timer";

interface UseNoiseOptions {
  noise: NoisePref;
  running: boolean;
  phase: Phase;
}

// Owns the single NoiseEngine instance and mirrors the noise preference to it.
// When `noise.autoWithFocus` is enabled, noise automatically plays ONLY during
// an active (running) focus session, and pauses on break or pause.
export function useNoise({ noise, running, phase }: UseNoiseOptions) {
  const noiseEngine = useRef<NoiseEngine | null>(null);
  if (!noiseEngine.current) noiseEngine.current = new NoiseEngine();

  useEffect(() => {
    const eng = noiseEngine.current!;
    eng.setType(noise.type);
    eng.setVolume(noise.volume);

    const shouldPlay = noise.autoWithFocus
      ? noise.on && running && phase === "focus"
      : noise.on;

    if (shouldPlay) {
      eng.start();
    } else {
      eng.stop();
    }
  }, [noise, running, phase]);

  useEffect(() => {
    return () => {
      noiseEngine.current?.stop();
    };
  }, []);
}
