import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin =
  SUPABASE_URL && SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

type IncomingBody = {
  event_name?: unknown;
  category?: unknown;
  page_path?: unknown;
  page_title?: unknown;
  referrer?: unknown;
  metadata?: unknown;
  session_id?: unknown;
  anonymous_id?: unknown;
};

const asString = (value: unknown, max = 400) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
};

const asObject = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const normalizeRole = (value: unknown) => {
  const role = asString(value, 40)?.toLowerCase() ?? "student";
  if (role === "admin" || role === "teacher" || role === "student" || role === "customer") return role;
  return "student";
};

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) {
    return NextResponse.json({ error: "Missing access token" }, { status: 401 });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as IncomingBody;
  const eventName = asString(body.event_name, 120);
  if (!eventName) {
    return NextResponse.json({ error: "event_name is required" }, { status: 400 });
  }

  const meta = userData.user.user_metadata ?? {};
  const payload: Record<string, unknown> = {
    category: asString(body.category, 120) ?? "custom",
    page_path: asString(body.page_path, 512),
    page_title: asString(body.page_title, 300),
    referrer: asString(body.referrer, 512),
    metadata: asObject(body.metadata),
    session_id: asString(body.session_id, 120),
    anonymous_id: asString(body.anonymous_id, 120),
    role: normalizeRole(meta.role),
    email: userData.user.email ?? null,
    full_name: asString(meta.full_name, 200) ?? userData.user.email ?? "User",
  };

  const { error } = await supabaseAdmin.from("analytics_events").insert({
    user_id: userData.user.id,
    event_type: eventName,
    payload,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ logged: true });
}
