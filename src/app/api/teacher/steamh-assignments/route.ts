import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

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

const parseInstructionLinks = (value: unknown) => {
  if (!Array.isArray(value)) return [] as string[];
  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 20);
  const valid: string[] = [];
  for (const item of normalized) {
    try {
      const parsed = new URL(item);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        valid.push(parsed.toString());
      }
    } catch {
      // ignore invalid links
    }
  }
  return valid;
};

type InstructionAttachment = {
  name: string;
  url: string;
  mimeType: string | null;
};

const parseInstructionAttachments = (value: unknown): InstructionAttachment[] => {
  if (!Array.isArray(value)) return [];
  const items: InstructionAttachment[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const row = raw as { name?: unknown; url?: unknown; mimeType?: unknown };
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const urlText = typeof row.url === "string" ? row.url.trim() : "";
    if (!name || !urlText) continue;
    try {
      const parsed = new URL(urlText);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
      items.push({
        name: name.slice(0, 160),
        url: parsed.toString(),
        mimeType: typeof row.mimeType === "string" && row.mimeType.trim() ? row.mimeType.trim().slice(0, 120) : null,
      });
    } catch {
      // ignore invalid urls
    }
    if (items.length >= 20) break;
  }
  return items;
};

const formatDueLabel = (iso: string) => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const ensureProfileRow = async (input: {
  id: string;
  fullName: string;
  role: "teacher" | "student" | "customer";
  grade?: string | null;
}) => {
  if (!supabaseAdmin) return { error: new Error("Server misconfigured") };
  const { error } = await supabaseAdmin.from("profiles").upsert(
    {
      id: input.id,
      full_name: input.fullName,
      role: input.role,
      grade: input.grade ?? null,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  return { error };
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

    const teacher = userData.user;
    const role = normalizeRole(teacher.user_metadata?.role);
    if (role !== "teacher") {
      return NextResponse.json({ error: "Only teachers can manage STEAM-H assignments" }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from("steamh_assignments")
      .select(ASSIGNMENT_SELECT)
      .eq("teacher_id", teacher.id)
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

    const teacher = userData.user;
    const role = normalizeRole(teacher.user_metadata?.role);
    if (role !== "teacher") {
      return NextResponse.json({ error: "Only teachers can assign STEAM-H tasks" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const modeRaw = typeof body?.mode === "string" ? body.mode.trim().toLowerCase() : "individual";
    const requestedMode = modeRaw === "group" ? "group" : "individual";
    const studentId = typeof body?.studentId === "string" ? body.studentId.trim() : "";
    const studentIds: string[] = Array.isArray(body?.studentIds)
      ? body.studentIds
          .filter((value: unknown): value is string => typeof value === "string")
          .map((value: string) => value.trim())
      : [];
    const selectedStudentIds: string[] = studentIds.length > 0 ? studentIds : studentId ? [studentId] : [];
    const uniqueStudentIds: string[] = Array.from(
      new Set(selectedStudentIds.filter((value: string) => value.trim().length > 0)),
    );
    const isGroupAssignment = requestedMode === "group" || uniqueStudentIds.length > 1;
    const assignmentMode: "individual" | "group" = isGroupAssignment ? "group" : "individual";
    const groupNameRaw = typeof body?.groupName === "string" ? body.groupName.trim() : "";
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const instructions = typeof body?.instructions === "string" ? body.instructions.trim() : "";
    const instructionLinks = parseInstructionLinks(body?.instructionLinks);
    const instructionAttachments = parseInstructionAttachments(body?.instructionAttachments);
    const dueAtRaw = typeof body?.dueAt === "string" ? body.dueAt.trim() : "";
    const subjectRaw = typeof body?.subject === "string" ? body.subject.trim() : "";

    if (uniqueStudentIds.length === 0) {
      return NextResponse.json({ error: "Select at least one student" }, { status: 400 });
    }
    if (assignmentMode === "group" && uniqueStudentIds.length < 2) {
      return NextResponse.json({ error: "Group assignment requires at least 2 students" }, { status: 400 });
    }
    if (assignmentMode === "group" && (!groupNameRaw || groupNameRaw.length < 2)) {
      return NextResponse.json({ error: "Group name should be at least 2 characters" }, { status: 400 });
    }
    if (!title || title.length < 4) {
      return NextResponse.json({ error: "Assignment title should be at least 4 characters" }, { status: 400 });
    }
    if (!dueAtRaw) {
      return NextResponse.json({ error: "Deadline is required" }, { status: 400 });
    }
    const dueAt = new Date(dueAtRaw);
    if (Number.isNaN(dueAt.getTime())) {
      return NextResponse.json({ error: "Invalid deadline date" }, { status: 400 });
    }

    const studentUsers = await Promise.all(
      uniqueStudentIds.map(async (id) => {
        const { data, error } = await supabaseAdmin.auth.admin.getUserById(id);
        if (error || !data?.user) {
          return { error: error?.message ?? "Student not found", user: null };
        }
        return { error: null, user: data.user };
      }),
    );
    const failed = studentUsers.find((item) => item.error || !item.user);
    if (failed?.error) {
      return NextResponse.json({ error: failed.error }, { status: 404 });
    }

    const students = studentUsers
      .map((item) => item.user)
      .filter((item): item is NonNullable<typeof item> => !!item);
    for (const student of students) {
      const studentRole = normalizeRole(student.user_metadata?.role);
      if (!isStudentLikeRole(studentRole)) {
        return NextResponse.json({ error: `Selected user (${student.email ?? student.id}) is not a student` }, { status: 400 });
      }
    }

    const teacherName =
      (teacher.user_metadata?.full_name as string | undefined)?.trim() || teacher.email || "Teacher";
    const subject =
      subjectRaw ||
      ((teacher.user_metadata?.subject as string | undefined)?.trim() ?? "") ||
      null;

    const { error: teacherProfileError } = await ensureProfileRow({
      id: teacher.id,
      fullName: teacherName,
      role: "teacher",
      grade: ((teacher.user_metadata?.grade as string | undefined)?.trim() ?? "") || null,
    });
    if (teacherProfileError) {
      return NextResponse.json({ error: teacherProfileError.message }, { status: 500 });
    }

    for (const student of students) {
      const studentName =
        (student.user_metadata?.full_name as string | undefined)?.trim() || student.email || "Student";
      const studentRole = normalizeRole(student.user_metadata?.role);
      const studentGrade = ((student.user_metadata?.grade as string | undefined)?.trim() ?? "") || null;
      const { error: studentProfileError } = await ensureProfileRow({
        id: student.id,
        fullName: studentName,
        role: studentRole === "customer" ? "customer" : "student",
        grade: studentGrade,
      });
      if (studentProfileError) {
        return NextResponse.json({ error: studentProfileError.message }, { status: 500 });
      }
    }

    const groupId = assignmentMode === "group" ? randomUUID() : null;
    const groupName = assignmentMode === "group" ? groupNameRaw : null;
    const groupSize = assignmentMode === "group" ? students.length : 1;

    const insertRows = students.map((student) => ({
      teacher_id: teacher.id,
      teacher_name: teacherName,
      student_id: student.id,
      student_name:
        (student.user_metadata?.full_name as string | undefined)?.trim() || student.email || "Student",
      title,
      instructions: instructions || null,
      instruction_links: instructionLinks,
      instruction_attachments: instructionAttachments,
      subject,
      grade: ((student.user_metadata?.grade as string | undefined)?.trim() ?? "") || null,
      due_at: dueAt.toISOString(),
      status: "assigned",
      assignment_mode: assignmentMode,
      group_id: groupId,
      group_name: groupName,
      group_size: groupSize,
    }));

    const { data: insertedRows, error: insertError } = await supabaseAdmin
      .from("steamh_assignments")
      .insert(insertRows)
      .select(ASSIGNMENT_SELECT);

    if (insertError) {
      return NextResponse.json({ error: withTableHint(insertError.message) }, { status: 500 });
    }

    const dueLabel = formatDueLabel(dueAt.toISOString());
    const subjectSuffix = subject ? ` (${subject})` : "";
    const baseMessage =
      assignmentMode === "group"
        ? `${teacherName} assigned group task "${title}"${subjectSuffix} to ${groupName}. Deadline: ${dueLabel}.`
        : `${teacherName} assigned "${title}"${subjectSuffix}. Deadline: ${dueLabel}.`;

    const notificationRows = students.map((student) => ({
      user_id: student.id,
      module_id: null,
      subject,
      title: assignmentMode === "group" ? `New STEAM-H group task: ${title}` : `New STEAM-H task: ${title}`,
      message: baseMessage,
      status: "unread",
      inserted_by: teacher.id,
    }));
    const { error: notificationError } = await supabaseAdmin.from("notifications").insert(notificationRows);

    return NextResponse.json({
      assignment: (insertedRows ?? [])[0] ?? null,
      assignments: insertedRows ?? [],
      warning: notificationError ? notificationError.message : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
