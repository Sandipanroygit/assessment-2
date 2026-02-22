"use client";

type AudioContextCtor = typeof AudioContext;

const getAudioContextCtor = (): AudioContextCtor | null => {
  if (typeof window === "undefined") return null;
  const win = window as typeof window & { webkitAudioContext?: AudioContextCtor };
  return win.AudioContext || win.webkitAudioContext || null;
};

let sharedCtx: AudioContext | null = null;

const getContext = async (): Promise<AudioContext | null> => {
  const AudioContextType = getAudioContextCtor();
  if (!AudioContextType) return null;

  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new AudioContextType();
  }

  if (sharedCtx.state === "suspended") {
    try {
      await sharedCtx.resume();
    } catch {
      return null;
    }
  }

  return sharedCtx;
};

export const playUiClickTone = async () => {
  const audioCtx = await getContext();
  if (!audioCtx) return;

  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const now = audioCtx.currentTime;

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(740, now);
  oscillator.frequency.exponentialRampToValueAtTime(940, now + 0.09);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.075, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

  oscillator.connect(gain);
  gain.connect(audioCtx.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.12);
};

