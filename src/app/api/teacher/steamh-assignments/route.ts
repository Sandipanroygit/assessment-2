import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin =
  SUPABASE_URL && SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY) : null;

const ASSIGNMENT_SELECT =
  "id,teacher_id,teacher_name,student_id,student_name,title,instructions,subject,grade,due_at,status,submitted_project_id,submitted_at,last_reminded_at,created_at,updated_at";

const normalizeRole = (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase() : "");

const isStudentLikeRole = (role: string) => role === "student" || role === "customer";

const withTableHint = (message: string) => {
  const normalized = message.toLowerCase();
  if (normalized.includes("steamh_assignments") && (normalized.includes("does not exist") || normalized.includes("schema cache"))) {
    return `${message} Apply \`supabase/steamh_assignments_patch.sql\` in Supabase SQL Editor.`;
  }
  return message;
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
    const studentId = typeof body?.studentId === "string" ? body.studentId.trim() : "";
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const instructions = typeof body?.instructions === "string" ? body.instructions.trim() : "";
    const dueAtRaw = typeof body?.dueAt === "string" ? body.dueAt.trim() : "";
    const subjectRaw = typeof body?.subject === "string" ? body.subject.trim() : "";

    if (!studentId) {
      return NextResponse.json({ error: "Student is required" }, { status: 400 });
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

    const { data: studentData, error: studentError } = await supabaseAdmin.auth.admin.getUserById(studentId);
    if (studentError || !studentData?.user) {
      return NextResponse.json({ error: studentError?.message ?? "Student not found" }, { status: 404 });
    }

    const student = studentData.user;
    const studentRole = normalizeRole(student.user_metadata?.role);
    if (!isStudentLikeRole(studentRole)) {
      return NextResponse.json({ error: "Selected user is not a student" }, { status: 400 });
    }

    const teacherName =
      (teacher.user_metadata?.full_name as string | undefined)?.trim() || teacher.email || "Teacher";
    const studentName =
      (student.user_metadata?.full_name as string | undefined)?.trim() || student.email || "Student";
    const subject =
      subjectRaw ||
      ((teacher.user_metadata?.subject as string | undefined)?.trim() ?? "") ||
      null;
    const grade = ((student.user_metadata?.grade as string | undefined)?.trim() ?? "") || null;

    const { error: teacherProfileError } = await ensureProfileRow({
      id: teacher.id,
      fullName: teacherName,
      role: "teacher",
      grade: ((teacher.user_metadata?.grade as string | undefined)?.trim() ?? "") || null,
    });
    if (teacherProfileError) {
      return NextResponse.json({ error: teacherProfileError.message }, { status: 500 });
    }

    const { error: studentProfileError } = await ensureProfileRow({
      id: student.id,
      fullName: studentName,
      role: studentRole === "customer" ? "customer" : "student",
      grade,
    });
    if (studentProfileError) {
      return NextResponse.json({ error: studentProfileError.message }, { status: 500 });
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("steamh_assignments")
      .insert({
        teacher_id: teacher.id,
        teacher_name: teacherName,
        student_id: student.id,
        student_name: studentName,
        title,
        instructions: instructions || null,
        subject,
        grade,
        due_at: dueAt.toISOString(),
        status: "assigned",
      })
      .select(ASSIGNMENT_SELECT)
      .single();

    if (insertError) {
      return NextResponse.json({ error: withTableHint(insertError.message) }, { status: 500 });
    }

    const dueLabel = formatDueLabel(dueAt.toISOString());
    const subjectSuffix = subject ? ` (${subject})` : "";
    const message = `${teacherName} assigned "${title}"${subjectSuffix}. Deadline: ${dueLabel}.`;

    const { error: notificationError } = await supabaseAdmin.from("notifications").insert({
      user_id: student.id,
      module_id: null,
      subject,
      title: `New STEAM-H task: ${title}`,
      message,
      status: "unread",
      inserted_by: teacher.id,
    });

    return NextResponse.json({
      assignment: inserted,
      warning: notificationError ? notificationError.message : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
