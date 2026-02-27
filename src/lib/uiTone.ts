"use client";

type AudioContextCtor = typeof AudioContext;

const getAudioContextCtor = (): AudioContextCtor | null => {
  if (typeof window === "undefined") return null;
  const win = window as typeof window & { webkitAudioContext?: AudioContextCtor };
  return win.AudioContext || win.webkitAudioContext || null;
};

let sharedCtx: AudioContext | null = null;
let tonePrimeListenerAttached = false;

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

const attachTonePrimeListeners = () => {
  if (typeof window === "undefined" || tonePrimeListenerAttached) return;
  tonePrimeListenerAttached = true;

  const unlock = async () => {
    const audioCtx = await getContext();
    if (!audioCtx) return;
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    tonePrimeListenerAttached = false;
  };

  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock);
};

export const primeUiTone = () => {
  attachTonePrimeListeners();
};

export const unlockUiTone = async () => {
  const audioCtx = await getContext();
  return Boolean(audioCtx);
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

const playEagleReadyToneInternal = async (): Promise<boolean> => {
  const audioCtx = await getContext();
  if (!audioCtx) return false;

  const now = audioCtx.currentTime;
  const notes = [
    { frequency: 587.33, offset: 0, duration: 0.14 },
    { frequency: 739.99, offset: 0.13, duration: 0.15 },
    { frequency: 880, offset: 0.28, duration: 0.18 },
  ] as const;

  notes.forEach((note) => {
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const start = now + note.offset;
    const end = start + note.duration;

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(note.frequency, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.15, start + 0.022);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(gain);
    gain.connect(audioCtx.destination);
    oscillator.start(start);
    oscillator.stop(end + 0.01);
  });
  return true;
};

export const playEagleReadyTone = async () => {
  await playEagleReadyToneInternal();
};
