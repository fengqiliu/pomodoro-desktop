import { useEffect, useRef } from "react";
import { NoiseEngine } from "../../infrastructure/audio/noiseEngine";
import type { NoisePref } from "../../domain/settings";

// Owns the single NoiseEngine instance and mirrors the noise preference to it.
export function useNoise(noise: NoisePref) {
  const noiseEngine = useRef<NoiseEngine | null>(null);
  if (!noiseEngine.current) noiseEngine.current = new NoiseEngine();

  useEffect(() => {
    const eng = noiseEngine.current!;
    eng.setType(noise.type);
    eng.setVolume(noise.volume);
    if (noise.on) eng.start();
    else eng.stop();
  }, [noise]);
}