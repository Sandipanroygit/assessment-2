"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  msFullscreenElement?: Element | null;
};

const SCROLL_KEYS = new Set([
  " ",
  "PageUp",
  "PageDown",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
]);

function getFullscreenElement(doc: FullscreenDocument) {
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? doc.msFullscreenElement ?? null;
}

function hasFullscreenSupport(doc: FullscreenDocument) {
  const root = doc.documentElement as FullscreenElement;
  return Boolean(root.requestFullscreen ?? root.webkitRequestFullscreen ?? root.msRequestFullscreen);
}

async function requestDocumentFullscreen() {
  const doc = document as FullscreenDocument;
  if (typeof document === "undefined" || getFullscreenElement(doc)) {
    return;
  }

  const root = doc.documentElement as FullscreenElement;
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
  const router = useRouter();
  const [showScrollPrompt, setShowScrollPrompt] = useState(false);
  const needsGestureRef = useRef(false);
  const gestureFailureCountRef = useRef(0);
  const scrollLockYRef = useRef(0);
  const scrollLockedRef = useRef(false);
  const bodyStyleSnapshotRef = useRef<{
    position: string;
    top: string;
    left: string;
    right: string;
    width: string;
    overflow: string;
    touchAction: string;
  } | null>(null);
  const htmlOverscrollSnapshotRef = useRef<string | null>(null);

  const lockScroll = useCallback((y: number) => {
    if (typeof document === "undefined" || scrollLockedRef.current) {
      return;
    }

    const body = document.body;
    const html = document.documentElement;
    bodyStyleSnapshotRef.current = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
      touchAction: body.style.touchAction,
    };
    htmlOverscrollSnapshotRef.current = html.style.overscrollBehavior;

    scrollLockYRef.current = y;
    body.style.position = "fixed";
    body.style.top = `-${y}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    body.style.touchAction = "none";
    html.style.overscrollBehavior = "none";
    scrollLockedRef.current = true;
  }, []);

  const unlockScroll = useCallback(() => {
    if (typeof document === "undefined" || !scrollLockedRef.current) {
      return;
    }

    const body = document.body;
    const html = document.documentElement;
    const snapshot = bodyStyleSnapshotRef.current;
    if (snapshot) {
      body.style.position = snapshot.position;
      body.style.top = snapshot.top;
      body.style.left = snapshot.left;
      body.style.right = snapshot.right;
      body.style.width = snapshot.width;
      body.style.overflow = snapshot.overflow;
      body.style.touchAction = snapshot.touchAction;
    } else {
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      body.style.width = "";
      body.style.overflow = "";
      body.style.touchAction = "";
    }

    html.style.overscrollBehavior = htmlOverscrollSnapshotRef.current ?? "";
    window.scrollTo(0, scrollLockYRef.current);

    bodyStyleSnapshotRef.current = null;
    htmlOverscrollSnapshotRef.current = null;
    scrollLockedRef.current = false;
  }, []);

  const showPromptWithoutScroll = useCallback(() => {
    const currentY = window.scrollY;
    setShowScrollPrompt(true);
    lockScroll(currentY);
    requestAnimationFrame(() => {
      window.scrollTo(0, currentY);
    });
  }, [lockScroll]);

  const attemptFullscreen = useCallback(async (isUserGesture: boolean) => {
    if (typeof document === "undefined" || !needsGestureRef.current) {
      return;
    }

    await requestDocumentFullscreen();

    const doc = document as FullscreenDocument;
    const enteredFullscreen = Boolean(getFullscreenElement(doc));

    if (enteredFullscreen) {
      needsGestureRef.current = false;
      setShowScrollPrompt(false);
      return;
    }

    if (!isUserGesture) {
      return;
    }

    gestureFailureCountRef.current += 1;
    if (gestureFailureCountRef.current >= 2) {
      // Avoid trapping users on browsers that reject fullscreen.
      needsGestureRef.current = false;
      setShowScrollPrompt(false);
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const doc = document as FullscreenDocument;
    if (!hasFullscreenSupport(doc)) {
      return;
    }

    const syncFullscreenState = () => {
      const fullscreenActive = Boolean(getFullscreenElement(doc));
      needsGestureRef.current = !fullscreenActive;
      if (fullscreenActive) {
        setShowScrollPrompt(false);
        unlockScroll();
      }
    };

    syncFullscreenState();
    void attemptFullscreen(false);

    const onPointerDown = () => {
      void attemptFullscreen(true);
    };

    const onTouchStart = () => {
      void attemptFullscreen(true);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!needsGestureRef.current) {
        return;
      }

      if (SCROLL_KEYS.has(event.key)) {
        event.preventDefault();
        showPromptWithoutScroll();
        return;
      }

      void attemptFullscreen(true);
    };

    const onWheel = (event: WheelEvent) => {
      if (!needsGestureRef.current) {
        return;
      }

      if (event.cancelable) {
        event.preventDefault();
      }
      showPromptWithoutScroll();
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!needsGestureRef.current) {
        return;
      }

      if (event.cancelable) {
        event.preventDefault();
      }
      showPromptWithoutScroll();
    };

    const onFullscreenChange = () => {
      syncFullscreenState();
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("wheel", onWheel, { passive: false, capture: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
    doc.addEventListener("fullscreenchange", onFullscreenChange);
    doc.addEventListener("webkitfullscreenchange", onFullscreenChange as EventListener);
    doc.addEventListener("MSFullscreenChange", onFullscreenChange as EventListener);

    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("touchstart", onTouchStart, true);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("wheel", onWheel, true);
      window.removeEventListener("touchmove", onTouchMove, true);
      doc.removeEventListener("fullscreenchange", onFullscreenChange);
      doc.removeEventListener("webkitfullscreenchange", onFullscreenChange as EventListener);
      doc.removeEventListener("MSFullscreenChange", onFullscreenChange as EventListener);
    };
  }, [attemptFullscreen, showPromptWithoutScroll, unlockScroll]);

  useEffect(() => {
    if (showScrollPrompt) {
      lockScroll(window.scrollY);
      return;
    }
    unlockScroll();
  }, [lockScroll, showScrollPrompt, unlockScroll]);

  const handleChoice = useCallback(
    (choice: "auth" | "skip") => {
      void (async () => {
        await attemptFullscreen(true);
        setShowScrollPrompt(false);

        if (choice === "auth") {
          router.push("/login");
        }
      })();
    },
    [attemptFullscreen, router]
  );

  if (!showScrollPrompt) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/30 px-4 backdrop-blur-md">
      <div className="glass-panel w-full max-w-4xl rounded-3xl p-6 shadow-2xl md:p-10">
        <div className="flex items-center justify-between gap-3">
          <Image
            src="/aerohawx-logo.png"
            alt="Aerohawx logo"
            width={210}
            height={60}
            className="h-14 w-auto object-contain md:h-16"
            priority
          />
          <Image
            src="/indus-trust-logo.jpeg"
            alt="Indus Trust logo"
            width={250}
            height={72}
            className="h-[3.9rem] w-auto rounded-lg object-contain md:h-[4.4rem]"
            priority
          />
        </div>

        <div className="mt-6 flex justify-center" aria-hidden="true">
          <div className="welcome-separator" />
        </div>

        <div className="mt-4 text-center">
          <h2 className="mx-auto max-w-3xl text-[1.7rem] font-semibold leading-tight tracking-normal text-slate-900 md:text-[2.5rem]">
            Step Into Smart Learning
          </h2>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => handleChoice("auth")}
            className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-true-white transition hover:bg-emerald-800"
          >
            Login / Sign Up
          </button>
          <button
            type="button"
            onClick={() => handleChoice("skip")}
            className="rounded-xl border border-slate-300 bg-white/85 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
