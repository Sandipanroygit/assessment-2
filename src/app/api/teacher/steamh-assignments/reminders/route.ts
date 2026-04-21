import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin =
  SUPABASE_URL && SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY) : null;

const normalizeRole = (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase() : "");

const formatDueLabel = (iso: string | null) => {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
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
    const role = normalizeRole(teacher.user_metadata?.role);
    if (role !== "teacher") {
      return NextResponse.json({ error: "Only teachers can send assignment reminders" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const assignmentId = typeof body?.assignmentId === "string" ? body.assignmentId.trim() : "";
    if (!assignmentId) {
      return NextResponse.json({ error: "Missing assignmentId" }, { status: 400 });
    }

    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from("steamh_assignments")
      .select("id,teacher_id,student_id,title,subject,due_at,submitted_at,assignment_mode,group_id,group_name")
      .eq("id", assignmentId)
      .eq("teacher_id", teacher.id)
      .maybeSingle();

    if (assignmentError) {
      return NextResponse.json({ error: assignmentError.message }, { status: 500 });
    }
    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }
    if (assignment.submitted_at) {
      return NextResponse.json({ error: "Assignment is already submitted" }, { status: 400 });
    }

    const dueLabel = formatDueLabel(assignment.due_at);
    const dueSuffix = dueLabel ? ` Deadline: ${dueLabel}.` : "";
    const subjectSuffix = assignment.subject ? ` (${assignment.subject})` : "";
    const message = `Please submit "${assignment.title}"${subjectSuffix}.${dueSuffix}`;

    const isGroup = assignment.assignment_mode === "group" && !!assignment.group_id;
    let recipients = [{ student_id: assignment.student_id, assignment_id: assignment.id }];
    if (isGroup) {
      const { data: groupRows, error: groupError } = await supabaseAdmin
        .from("steamh_assignments")
        .select("id,student_id,submitted_at")
        .eq("group_id", assignment.group_id)
        .eq("teacher_id", teacher.id)
        .is("submitted_at", null);
      if (groupError) {
        return NextResponse.json({ error: groupError.message }, { status: 500 });
      }
      recipients = (groupRows ?? []).map((row) => ({ student_id: row.student_id, assignment_id: row.id }));
      if (recipients.length === 0) {
        return NextResponse.json({ error: "All group members have already submitted" }, { status: 400 });
      }
    }

    const { error: notificationError } = await supabaseAdmin.from("notifications").insert(
      recipients.map((recipient) => ({
        user_id: recipient.student_id,
        module_id: null,
        subject: assignment.subject ?? null,
        title: isGroup
          ? `Group reminder: ${assignment.title}`
          : `Reminder: ${assignment.title}`,
        message: isGroup && assignment.group_name ? `${message} Group: ${assignment.group_name}.` : message,
        status: "unread",
        inserted_by: teacher.id,
      })),
    );

    if (notificationError) {
      return NextResponse.json({ error: notificationError.message }, { status: 500 });
    }

    const { error: updateError } = await supabaseAdmin
      .from("steamh_assignments")
      .update({
        last_reminded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("teacher_id", teacher.id)
      .eq(isGroup ? "group_id" : "id", isGroup ? assignment.group_id : assignment.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
