"use client";

import { supabase } from "@/lib/supabaseClient";

const KEYS = {
  sessionId: "activity:session-id",
  anonymousId: "activity:anon-id",
  lastActive: "activity:last-active",
};

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes idle = new session

const fallbackUuid = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const getAnonymousId = () => {
  try {
    const existing = localStorage.getItem(KEYS.anonymousId);
    if (existing) return existing;
    const fresh = fallbackUuid();
    localStorage.setItem(KEYS.anonymousId, fresh);
    return fresh;
  } catch {
    return fallbackUuid();
  }
};

const getSessionId = () => {
  const now = Date.now();
  try {
    const last = Number(localStorage.getItem(KEYS.lastActive) ?? "0");
    const stored = localStorage.getItem(KEYS.sessionId);
    if (stored && now - last < SESSION_TTL_MS) {
      localStorage.setItem(KEYS.lastActive, `${now}`);
      return stored;
    }
    const fresh = fallbackUuid();
    localStorage.setItem(KEYS.sessionId, fresh);
    localStorage.setItem(KEYS.lastActive, `${now}`);
    return fresh;
  } catch {
    return fallbackUuid();
  }
};

export type ActivityPayload = {
  category?: string;
  pagePath?: string;
  pageTitle?: string;
  referrer?: string;
  metadata?: Record<string, unknown>;
};

export async function logActivity(eventName: string, payload: ActivityPayload = {}): Promise<void> {
  if (typeof window === "undefined") return;
  if (!eventName.trim()) return;

  // Require an authenticated session so we can attribute to user
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return;

  const body = {
    event_name: eventName.trim(),
    category: payload.category ?? "custom",
    page_path: payload.pagePath ?? window.location.pathname + window.location.search,
    page_title: payload.pageTitle ?? document.title,
    referrer: payload.referrer ?? document.referrer,
    metadata: payload.metadata ?? {},
    session_id: getSessionId(),
    anonymous_id: getAnonymousId(),
  };

  try {
    await fetch("/api/activity-events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch {
    // swallow logging errors
  }
}

export function logPageView() {
  return logActivity("page_view", { category: "page" });
}
