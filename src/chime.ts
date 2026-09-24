import type { Phase } from "./timer/timerRules";

// Shared AudioContext for the completion chime. Reused across chimes instead of
// new+close each time — avoids hitting the browser's AudioContext instance cap
// and repeated autoplay-policy warnings.
let chimeCtx: AudioContext | null = null;

function getChimeCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!chimeCtx) chimeCtx = new Ctor();
  if (chimeCtx.state === "suspended") void chimeCtx.resume();
  return chimeCtx;
}

export function playChime(phase: Phase) {
  try {
    const ctx = getChimeCtx();
    if (!ctx) return;
    const notes = phase === "focus" ? [880, 660, 523] : [523, 659, 784];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.55);
    });
  } catch {
    /* audio unavailable */
  }
}
