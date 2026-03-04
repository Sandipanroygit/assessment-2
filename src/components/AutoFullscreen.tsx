"use client";

import { useEffect } from "react";

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

async function requestDocumentFullscreen() {
  if (typeof document === "undefined" || document.fullscreenElement) {
    return;
  }

  const root = document.documentElement as FullscreenElement;
  const request =
    root.requestFullscreen ??
    root.webkitRequestFullscreen ??
    root.msRequestFullscreen;

  if (!request) {
    return;
  }

  try {
    await request.call(root);
  } catch {
    // Ignore rejection; many browsers require a user gesture.
  }
}

export default function AutoFullscreen() {
  useEffect(() => {
    void requestDocumentFullscreen();

    const onFirstInteraction = () => {
      void requestDocumentFullscreen();
      window.removeEventListener("pointerdown", onFirstInteraction);
      window.removeEventListener("keydown", onFirstInteraction);
      window.removeEventListener("touchstart", onFirstInteraction);
    };

    window.addEventListener("pointerdown", onFirstInteraction, { passive: true });
    window.addEventListener("keydown", onFirstInteraction);
    window.addEventListener("touchstart", onFirstInteraction, { passive: true });

    return () => {
      window.removeEventListener("pointerdown", onFirstInteraction);
      window.removeEventListener("keydown", onFirstInteraction);
      window.removeEventListener("touchstart", onFirstInteraction);
    };
  }, []);

  return null;
}
