import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin =
  SUPABASE_URL && SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY) : null;

const ensureProfile = async (user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }, role: string) => {
  if (!supabaseAdmin) return;
  const fullName = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? role;
  const { error } = await supabaseAdmin
    .from("profiles")
    .upsert({ id: user.id, full_name: fullName, role })
    .select("id")
    .single();
  if (error) {
    throw new Error(`Profile upsert failed: ${error.message}`);
  }
};

export async function POST(req: Request) {
  try {
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
      return NextResponse.json({ error: userError?.message ?? "Invalid token" }, { status: 401 });
    }

    const teacher = userData.user;
    const teacherRole = (teacher.user_metadata?.role as string | undefined)?.toLowerCase() ?? "";
    if (teacherRole !== "teacher") {
      return NextResponse.json({ error: "Only teachers can send reminders" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const studentId = (body?.studentId as string | undefined) ?? "";
    const moduleId = (body?.moduleId as string | undefined) ?? null;
    const moduleTitleFromClient = (body?.moduleTitle as string | undefined) ?? null;
    const subjectFromClient = (body?.subject as string | undefined) ?? null;

    if (!studentId) {
      return NextResponse.json({ error: "Missing studentId" }, { status: 400 });
    }

    const { data: studentData, error: studentError } = await supabaseAdmin.auth.admin.getUserById(studentId);
    if (studentError || !studentData?.user) {
      return NextResponse.json({ error: studentError?.message ?? "Student not found" }, { status: 404 });
    }
    const studentRole = (studentData.user.user_metadata?.role as string | undefined)?.toLowerCase() ?? "";
    if (studentRole !== "student") {
      return NextResponse.json({ error: "Target user is not a student" }, { status: 400 });
    }
    await ensureProfile(teacher, "teacher");
    await ensureProfile(studentData.user, "student");

    let moduleTitle = moduleTitleFromClient;
    let moduleSubject = subjectFromClient ?? (teacher.user_metadata?.subject as string | undefined) ?? null;
    if (moduleId) {
      const { data: moduleRow, error: moduleError } = await supabaseAdmin
        .from("curriculum_modules")
        .select("title,subject,grade")
        .eq("id", moduleId)
        .maybeSingle();
      if (moduleError) {
        return NextResponse.json({ error: moduleError.message }, { status: 500 });
      }
      if (moduleRow?.title) moduleTitle = moduleRow.title;
      if (moduleRow?.subject) moduleSubject = moduleRow.subject;
    }

    const title = moduleTitle ? `Reminder: ${moduleTitle}` : "Submission reminder";
    const subjectLine = moduleSubject ? ` for ${moduleSubject}` : "";
    const message = `Please submit your activity${moduleTitle ? ` "${moduleTitle}"` : ""}${subjectLine}. Your teacher has requested your submission.`;

    const { error: insertError } = await supabaseAdmin.from("notifications").insert({
      user_id: studentId,
      module_id: moduleId ?? null,
      subject: moduleSubject ?? null,
      title,
      message,
      status: "unread",
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
