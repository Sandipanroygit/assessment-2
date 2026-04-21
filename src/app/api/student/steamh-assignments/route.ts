import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin =
  SUPABASE_URL && SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY) : null;

const ASSIGNMENT_SELECT =
  "id,teacher_id,teacher_name,student_id,student_name,title,instructions,instruction_links,instruction_attachments,subject,grade,due_at,status,assignment_mode,group_id,group_name,group_size,submitted_project_id,submitted_at,last_reminded_at,created_at,updated_at";

const normalizeRole = (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase() : "");

const isStudentLikeRole = (role: string) => role === "student" || role === "customer";

const withTableHint = (message: string) => {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("steamh_assignments") &&
    (normalized.includes("does not exist") || normalized.includes("schema cache"))
  ) {
    return `${message} Apply \`supabase/steamh_assignments_patch.sql\` and \`supabase/steamh_group_assignments_patch.sql\` in Supabase SQL Editor.`;
  }
  if (
    (normalized.includes("assignment_mode") ||
      normalized.includes("group_id") ||
      normalized.includes("group_name") ||
      normalized.includes("group_size") ||
      normalized.includes("instruction_links") ||
      normalized.includes("instruction_attachments")) &&
    (normalized.includes("column") || normalized.includes("schema cache"))
  ) {
    return `${message} Apply \`supabase/steamh_group_assignments_patch.sql\` and \`supabase/steamh_instruction_assets_patch.sql\` in Supabase SQL Editor.`;
  }
  return message;
};

export async function GET(req: Request) {
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

    const student = userData.user;
    const role = normalizeRole(student.user_metadata?.role);
    if (!isStudentLikeRole(role)) {
      return NextResponse.json({ error: "Only students can view STEAM-H assignments" }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from("steamh_assignments")
      .select(ASSIGNMENT_SELECT)
      .eq("student_id", student.id)
      .order("due_at", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: withTableHint(error.message) }, { status: 500 });
    }

    return NextResponse.json({ assignments: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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

    const student = userData.user;
    const role = normalizeRole(student.user_metadata?.role);
    if (!isStudentLikeRole(role)) {
      return NextResponse.json({ error: "Only students can submit STEAM-H assignments" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const assignmentId = typeof body?.assignmentId === "string" ? body.assignmentId.trim() : "";
    const projectId = typeof body?.projectId === "string" ? body.projectId.trim() : "";

    if (!assignmentId || !projectId) {
      return NextResponse.json({ error: "assignmentId and projectId are required" }, { status: 400 });
    }

    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from("steamh_assignments")
      .select("id,teacher_id,teacher_name,student_id,student_name,title,subject,due_at,assignment_mode,group_id,group_name,group_size,submitted_at")
      .eq("id", assignmentId)
      .eq("student_id", student.id)
      .maybeSingle();

    if (assignmentError) {
      return NextResponse.json({ error: withTableHint(assignmentError.message) }, { status: 500 });
    }
    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    const { data: project, error: projectError } = await supabaseAdmin
      .from("steamh_projects")
      .select("id,title,student_id")
      .eq("id", projectId)
      .eq("student_id", student.id)
      .maybeSingle();

    if (projectError) {
      return NextResponse.json({ error: projectError.message }, { status: 500 });
    }
    if (!project) {
      return NextResponse.json({ error: "Project not found for this student" }, { status: 404 });
    }

    if (assignment.submitted_at) {
      return NextResponse.json({ error: "Assignment already submitted" }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const isGroup = (assignment.assignment_mode ?? "individual") === "group" && !!assignment.group_id;

    let updatedRows: Array<Record<string, unknown>> = [];
    if (isGroup) {
      const { data: existingSubmission, error: existingError } = await supabaseAdmin
        .from("steamh_assignments")
        .select("id,student_name,submitted_at")
        .eq("group_id", assignment.group_id)
        .not("submitted_at", "is", null)
        .limit(1)
        .maybeSingle();
      if (existingError) {
        return NextResponse.json({ error: existingError.message }, { status: 500 });
      }
      if (existingSubmission?.submitted_at) {
        const submittedBy = (existingSubmission.student_name as string | null) ?? "a group member";
        return NextResponse.json({ error: `This group task is already submitted by ${submittedBy}.` }, { status: 409 });
      }

      const { data: updatedGroupRows, error: updateGroupError } = await supabaseAdmin
        .from("steamh_assignments")
        .update({
          status: "submitted",
          submitted_project_id: project.id,
          submitted_at: nowIso,
          updated_at: nowIso,
        })
        .eq("group_id", assignment.group_id)
        .select(ASSIGNMENT_SELECT);

      if (updateGroupError) {
        return NextResponse.json({ error: withTableHint(updateGroupError.message) }, { status: 500 });
      }
      updatedRows = (updatedGroupRows as Array<Record<string, unknown>>) ?? [];
    } else {
      const { data: updatedSingle, error: updateError } = await supabaseAdmin
        .from("steamh_assignments")
        .update({
          status: "submitted",
          submitted_project_id: project.id,
          submitted_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", assignment.id)
        .eq("student_id", student.id)
        .select(ASSIGNMENT_SELECT);

      if (updateError) {
        return NextResponse.json({ error: withTableHint(updateError.message) }, { status: 500 });
      }
      updatedRows = (updatedSingle as Array<Record<string, unknown>>) ?? [];
    }

    const assignmentForStudent =
      updatedRows.find((row) => row.id === assignment.id) ??
      updatedRows[0] ??
      null;

    const studentName =
      (student.user_metadata?.full_name as string | undefined)?.trim() ||
      student.email ||
      assignment.student_name ||
      "Student";
    const subjectSuffix = assignment.subject ? ` (${assignment.subject})` : "";
    const message = isGroup
      ? `${studentName} submitted group task "${assignment.title}"${subjectSuffix}${assignment.group_name ? ` for ${assignment.group_name}` : ""} using project "${project.title}".`
      : `${studentName} submitted "${assignment.title}"${subjectSuffix} using project "${project.title}".`;

    const { error: notificationError } = await supabaseAdmin.from("notifications").insert({
      user_id: assignment.teacher_id,
      module_id: null,
      subject: assignment.subject ?? null,
      title: isGroup ? "STEAM-H group submission received" : "STEAM-H submission received",
      message,
      status: "unread",
      inserted_by: student.id,
    });

    return NextResponse.json({
      assignment: assignmentForStudent,
      groupAssignments: isGroup ? updatedRows : null,
      warning: notificationError ? notificationError.message : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
