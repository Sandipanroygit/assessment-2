import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin =
  SUPABASE_URL && SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY) : null;

const withDeadlineHint = (message: string) => {
  const normalized = message.toLowerCase();
  if (normalized.includes("due_at") && (normalized.includes("column") || normalized.includes("schema cache"))) {
    return `${message} Apply \`supabase/curriculum_module_deadlines_patch.sql\` in Supabase SQL Editor.`;
  }
  return message;
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

  let body: {
    moduleId?: string;
    published?: boolean;
    dueAt?: string | null;
    grade?: string | null;
    notes?: string | null;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const moduleId = body.moduleId?.trim();
  const published = body.published ?? true;
  const dueAtRaw = typeof body.dueAt === "string" ? body.dueAt.trim() : "";
  const gradeRaw = typeof body.grade === "string" ? body.grade.trim() : "";
  const notesRaw = typeof body.notes === "string" ? body.notes.trim() : "";

  if (!moduleId) {
    return NextResponse.json({ error: "moduleId is required" }, { status: 400 });
  }

  let dueAtIso: string | null = null;
  if (published) {
    if (!dueAtRaw) {
      return NextResponse.json({ error: "Deadline is required while publishing" }, { status: 400 });
    }
    const parsedDueAt = new Date(dueAtRaw);
    if (Number.isNaN(parsedDueAt.getTime())) {
      return NextResponse.json({ error: "Invalid deadline date" }, { status: 400 });
    }
    if (!gradeRaw) {
      return NextResponse.json({ error: "Grade is required while publishing" }, { status: 400 });
    }
    if (notesRaw.length > 1500) {
      return NextResponse.json({ error: "Notes should be within 1500 characters" }, { status: 400 });
    }
    dueAtIso = parsedDueAt.toISOString();
  }

  const userMeta = userData.user.user_metadata || {};
  const role = (userMeta.role as string | undefined)?.toLowerCase() ?? "";
  const teacherSubject = userMeta.subject as string | undefined;
  if (role !== "teacher") {
    return NextResponse.json({ error: "Only teachers can publish" }, { status: 403 });
  }

  // Ensure the module belongs to the teacher's subject (if provided)
  const { data: moduleRow, error: moduleError } = await supabaseAdmin
    .from("curriculum_modules")
    .select("id, title, subject, grade, due_at")
    .eq("id", moduleId)
    .maybeSingle();

  if (moduleError) {
    return NextResponse.json({ error: withDeadlineHint(moduleError.message) }, { status: 500 });
  }
  if (!moduleRow) {
    return NextResponse.json({ error: "Module not found" }, { status: 404 });
  }
  if (teacherSubject && moduleRow.subject !== teacherSubject) {
    return NextResponse.json({ error: "Cannot publish modules outside your subject" }, { status: 403 });
  }

  const updatePayload: { published: boolean; due_at?: string; grade?: string } = { published };
  if (dueAtIso) {
    updatePayload.due_at = dueAtIso;
  }
  if (published) {
    updatePayload.grade = gradeRaw;
  }

  const { error: updateError } = await supabaseAdmin
    .from("curriculum_modules")
    .update(updatePayload)
    .eq("id", moduleId);

  if (updateError) {
    return NextResponse.json({ error: withDeadlineHint(updateError.message) }, { status: 500 });
  }

  // Logging failure should not block publish action.
  const { error: logError } = await supabaseAdmin.from("analytics_events").insert({
    user_id: userData.user.id,
    event_type: "teacher_module_publish",
    payload: {
      role: role,
      email: userData.user.email ?? null,
      full_name: (userMeta.full_name as string | undefined) ?? userData.user.email ?? "Teacher",
      module_id: moduleId,
      module_title: moduleRow.title ?? null,
      module_subject: moduleRow.subject,
      module_notes: notesRaw || null,
      published,
    },
  });
  if (logError) {
    console.warn("teacher_module_publish log error:", logError.message);
  }

  return NextResponse.json({ success: true, published });
}
