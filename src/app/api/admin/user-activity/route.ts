import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TRACKED_EVENT_TYPES = [
  "auth_login",
  "auth_logout",
  "teacher_module_publish",
  "student_quiz_attempt",
];

const supabaseAdmin =
  SUPABASE_URL && SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

type AnalyticsEventRow = {
  id: number;
  user_id: string | null;
  event_type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
};

type UserLookupEntry = {
  name: string;
  email: string | null;
  role: string;
};

type LoginRow = {
  id: number;
  user_id: string | null;
  user_name: string;
  email: string | null;
  role: "teacher" | "student";
  event_type: "auth_login" | "auth_logout";
  reason: string | null;
  created_at: string;
};

type TeacherPublishAccumulator = {
  teacher_id: string;
  teacher_name: string;
  email: string | null;
  publish_events: number;
  module_keys: Set<string>;
};

type ActivityScoreAccumulator = {
  module_id: string;
  module_title: string;
  attempts: number;
  total_score: number;
  total_possible: number;
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

const asNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const asBoolean = (value: unknown) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return null;
};

const normalizeRole = (value: unknown): "admin" | "teacher" | "student" | "unknown" => {
  const role = asString(value, 40)?.toLowerCase();
  if (role === "admin") return "admin";
  if (role === "teacher") return "teacher";
  if (role === "student" || role === "customer") return "student";
  return "unknown";
};

const round2 = (value: number) => Math.round(value * 100) / 100;

export async function GET(req: Request) {
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

  const requesterId = userData.user.id;
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", requesterId)
    .maybeSingle();

  const requesterRole = normalizeRole(profile?.role ?? userData.user.user_metadata?.role);
  if (requesterRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userLookup = new Map<string, UserLookupEntry>();
  const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  for (const user of usersData?.users ?? []) {
    const name = asString(user.user_metadata?.full_name, 200) ?? user.email ?? "User";
    const role = normalizeRole(user.user_metadata?.role);
    userLookup.set(user.id, {
      name,
      email: user.email ?? null,
      role,
    });
  }

  const { data, error } = await supabaseAdmin
    .from("analytics_events")
    .select("id,user_id,event_type,payload,created_at")
    .in("event_type", TRACKED_EVENT_TYPES)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const events = (data as AnalyticsEventRow[]) ?? [];

  const teacherAuthLogs: LoginRow[] = [];
  const studentAuthLogs: LoginRow[] = [];
  const teacherPublishMap = new Map<string, TeacherPublishAccumulator>();
  const activityScoreMap = new Map<string, ActivityScoreAccumulator>();

  for (const event of events) {
    const payload = asObject(event.payload);
    const metadata = asObject(payload.metadata);
    const lookup = event.user_id ? userLookup.get(event.user_id) : undefined;

    const resolvedRole = normalizeRole(payload.role ?? metadata.role ?? lookup?.role);
    const resolvedName = asString(payload.full_name, 200) ?? asString(metadata.full_name, 200) ?? lookup?.name ?? "User";
    const resolvedEmail = asString(payload.email, 200) ?? asString(metadata.email, 200) ?? lookup?.email ?? null;

    if ((event.event_type === "auth_login" || event.event_type === "auth_logout") && (resolvedRole === "teacher" || resolvedRole === "student")) {
      const row: LoginRow = {
        id: event.id,
        user_id: event.user_id,
        user_name: resolvedName,
        email: resolvedEmail,
        role: resolvedRole,
        event_type: event.event_type,
        reason:
          event.event_type === "auth_logout"
            ? asString(metadata.reason, 80) ?? asString(payload.reason, 80) ?? null
            : null,
        created_at: event.created_at,
      };
      if (resolvedRole === "teacher") {
        teacherAuthLogs.push(row);
      } else {
        studentAuthLogs.push(row);
      }
      continue;
    }

    if (event.event_type === "teacher_module_publish" && resolvedRole === "teacher") {
      const published = asBoolean(payload.published ?? metadata.published) ?? false;
      const moduleId = asString(payload.module_id, 120) ?? asString(metadata.module_id, 120);
      const moduleTitle = asString(payload.module_title, 200) ?? asString(metadata.module_title, 200);
      const moduleKey = moduleId ?? (moduleTitle ? `title:${moduleTitle.toLowerCase()}` : null);
      const teacherId = event.user_id ?? `unknown:${resolvedName.toLowerCase()}`;
      const existing = teacherPublishMap.get(teacherId) ?? {
        teacher_id: event.user_id ?? "unknown",
        teacher_name: resolvedName,
        email: resolvedEmail,
        publish_events: 0,
        module_keys: new Set<string>(),
      };

      if (published) {
        existing.publish_events += 1;
        if (moduleKey) {
          existing.module_keys.add(moduleKey);
        }
      }

      teacherPublishMap.set(teacherId, existing);
      continue;
    }

    if (event.event_type === "student_quiz_attempt" && resolvedRole === "student") {
      const score = asNumber(metadata.score ?? payload.score);
      const total = asNumber(metadata.total ?? payload.total);
      if (score === null || total === null || total <= 0) continue;

      const moduleId = asString(metadata.module_id, 120) ?? asString(payload.module_id, 120) ?? "unknown";
      const moduleTitle = asString(metadata.module_title, 200) ?? asString(payload.module_title, 200) ?? "Unknown activity";
      const key = moduleId !== "unknown" ? moduleId : `title:${moduleTitle.toLowerCase()}`;
      const existing = activityScoreMap.get(key) ?? {
        module_id: moduleId,
        module_title: moduleTitle,
        attempts: 0,
        total_score: 0,
        total_possible: 0,
      };

      existing.attempts += 1;
      existing.total_score += score;
      existing.total_possible += total;
      if (existing.module_id === "unknown" && moduleId !== "unknown") {
        existing.module_id = moduleId;
      }
      if (existing.module_title === "Unknown activity" && moduleTitle !== "Unknown activity") {
        existing.module_title = moduleTitle;
      }

      activityScoreMap.set(key, existing);
    }
  }

  const teacherPublishTotals = Array.from(teacherPublishMap.values())
    .map((row) => ({
      teacher_id: row.teacher_id,
      teacher_name: row.teacher_name,
      email: row.email,
      publish_events: row.publish_events,
      total_published_modules: row.module_keys.size,
    }))
    .sort(
      (a, b) =>
        b.total_published_modules - a.total_published_modules ||
        b.publish_events - a.publish_events ||
        a.teacher_name.localeCompare(b.teacher_name),
    );

  const activityScoreAverages = Array.from(activityScoreMap.values())
    .map((row) => ({
      module_id: row.module_id,
      module_title: row.module_title,
      attempts: row.attempts,
      average_score: round2(row.total_score / row.attempts),
      average_total: round2(row.total_possible / row.attempts),
      average_percent: row.total_possible > 0 ? round2((row.total_score / row.total_possible) * 100) : 0,
    }))
    .sort((a, b) => b.attempts - a.attempts || b.average_percent - a.average_percent);

  const teacherLogins = teacherAuthLogs.filter((item) => item.event_type === "auth_login").length;
  const teacherLogouts = teacherAuthLogs.filter((item) => item.event_type === "auth_logout").length;
  const studentLogins = studentAuthLogs.filter((item) => item.event_type === "auth_login").length;
  const studentLogouts = studentAuthLogs.filter((item) => item.event_type === "auth_logout").length;

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    summary: {
      teacher_logins: teacherLogins,
      teacher_logouts: teacherLogouts,
      student_logins: studentLogins,
      student_logouts: studentLogouts,
      teacher_publishers: teacherPublishTotals.length,
      tracked_activities: activityScoreAverages.length,
      quiz_attempts: activityScoreAverages.reduce((sum, row) => sum + row.attempts, 0),
    },
    login_logout: {
      teachers: teacherAuthLogs.slice(0, 300),
      students: studentAuthLogs.slice(0, 300),
    },
    teacher_publish_totals: teacherPublishTotals,
    activity_score_averages: activityScoreAverages,
  });
}
