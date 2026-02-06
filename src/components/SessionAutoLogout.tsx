"use client";

import { supabase } from "@/lib/supabaseClient";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_MINUTES = Number(process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES ?? "20");
const LAST_ACTIVE_KEY = "aerohawx:last-active";
const LOGOUT_KEY = "aerohawx:idle-logout";

type Props = { minutes?: number };

export default function SessionAutoLogout({ minutes = DEFAULT_MINUTES }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const timeoutRef = useRef<number | null>(null);
  const [enabled, setEnabled] = useState(false);
  const idleMs = Math.max(1, minutes) * 60 * 1000;

  const clearTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const redirectToLogin = useCallback(async () => {
    clearTimer();
    await supabase.auth.signOut();
    if (pathname !== "/login") {
      router.replace("/login?reason=timeout");
    }
  }, [clearTimer, pathname, router]);

  const schedule = useCallback(
    (lastActive: number) => {
      clearTimer();
      const remaining = idleMs - (Date.now() - lastActive);
      if (remaining <= 0) {
        localStorage.setItem(LOGOUT_KEY, `${Date.now()}`);
        void redirectToLogin();
        return;
      }
      timeoutRef.current = window.setTimeout(() => {
        localStorage.setItem(LOGOUT_KEY, `${Date.now()}`);
        void redirectToLogin();
      }, remaining);
    },
    [clearTimer, idleMs, redirectToLogin],
  );

  const bumpActivity = useCallback(() => {
    const now = Date.now();
    localStorage.setItem(LAST_ACTIVE_KEY, `${now}`);
    if (enabled) schedule(now);
  }, [enabled, schedule]);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      const hasSession = Boolean(data.session);
      setEnabled(hasSession);
      if (!hasSession) {
        clearTimer();
        return;
      }
      const last = Number(localStorage.getItem(LAST_ACTIVE_KEY) ?? Date.now());
      localStorage.setItem(LAST_ACTIVE_KEY, `${last}`);
      schedule(last);
    };
    void init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const hasSession = Boolean(session);
      setEnabled(hasSession);
      if (hasSession) {
        bumpActivity();
      } else {
        clearTimer();
      }
    });

    return () => {
      sub?.subscription.unsubscribe();
    };
  }, [bumpActivity, clearTimer, schedule]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === LOGOUT_KEY && event.newValue) {
        void redirectToLogin();
      }
      if (event.key === LAST_ACTIVE_KEY && event.newValue) {
        const ts = Number(event.newValue);
        if (!Number.isNaN(ts)) {
          schedule(ts);
        }
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [redirectToLogin, schedule]);

  useEffect(() => {
    const events: Array<keyof WindowEventMap> = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((eventName) => window.addEventListener(eventName, bumpActivity, { passive: true }));
    window.addEventListener("visibilitychange", bumpActivity);
    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, bumpActivity));
      window.removeEventListener("visibilitychange", bumpActivity);
    };
  }, [bumpActivity]);

  return null;
}
