import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateSimulationAssessment } from "@/lib/simulationAssessment";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin =
  SUPABASE_URL && SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY) : null;

const ASSIGNMENT_SELECT =
  "id,teacher_id,teacher_name,target_grade,target_grade_key,subject,simulation_title,simulation_url,notes,due_at,assessment_questions,assessment_generated_at,created_at,updated_at";

const normalizeRole = (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase() : "");
const normalizeGradeKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/grade/gi, "")
    .replace(/[^a-z0-9]+/g, "");

const extractToken = (req: Request) => {
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
};

const withTableHint = (message: string) => {
  const normalized = message.toLowerCase();
  if (
    (normalized.includes("simulation_assignments") ||
      normalized.includes("simulation_assignment_progress") ||
      normalized.includes("due_at") ||
      normalized.includes("assessment_")) &&
    (normalized.includes("does not exist") || normalized.includes("schema cache") || normalized.includes("column"))
  ) {
    return `${message} Apply \`supabase/simulation_assignments_patch.sql\` in Supabase SQL Editor.`;
  }
  return message;
};

export async function GET(req: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const token = extractToken(req);
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
      return NextResponse.json({ error: "Only teachers can view simulation assignments" }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from("simulation_assignments")
      .select(ASSIGNMENT_SELECT)
      .eq("teacher_id", teacher.id)
      .order("due_at", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(200);

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

    const token = extractToken(req);
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
      return NextResponse.json({ error: "Only teachers can assign simulations" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      grade?: string;
      simulationTitle?: string;
      simulationUrl?: string;
      subject?: string;
      notes?: string;
      dueAt?: string;
    };

    const targetGrade = typeof body.grade === "string" ? body.grade.trim() : "";
    const simulationTitle = typeof body.simulationTitle === "string" ? body.simulationTitle.trim() : "";
    const simulationUrl = typeof body.simulationUrl === "string" ? body.simulationUrl.trim() : "";
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";
    const dueAtRaw = typeof body.dueAt === "string" ? body.dueAt.trim() : "";

    const targetGradeKey = normalizeGradeKey(targetGrade);
    if (!targetGrade || !targetGradeKey) {
      return NextResponse.json({ error: "Select a valid grade" }, { status: 400 });
    }
    if (!simulationTitle || simulationTitle.length < 3) {
      return NextResponse.json({ error: "Simulation title is required" }, { status: 400 });
    }
    if (!simulationUrl) {
      return NextResponse.json({ error: "Simulation URL is required" }, { status: 400 });
    }
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(simulationUrl);
    } catch {
      return NextResponse.json({ error: "Simulation URL is invalid" }, { status: 400 });
    }
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return NextResponse.json({ error: "Simulation URL must be http or https" }, { status: 400 });
    }
    if (notes.length > 1500) {
      return NextResponse.json({ error: "Notes should be within 1500 characters" }, { status: 400 });
    }
    if (!dueAtRaw) {
      return NextResponse.json({ error: "Deadline is required" }, { status: 400 });
    }
    const dueAt = new Date(dueAtRaw);
    if (Number.isNaN(dueAt.getTime())) {
      return NextResponse.json({ error: "Invalid deadline date" }, { status: 400 });
    }

    const teacherName =
      (teacher.user_metadata?.full_name as string | undefined)?.trim() ?? teacher.email ?? "Teacher";

    const generatedAssessment = await generateSimulationAssessment({
      simulationTitle,
      subject,
      targetGrade,
      notes,
    });
    const assessmentGeneratedAt = new Date().toISOString();

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("simulation_assignments")
      .insert({
        teacher_id: teacher.id,
        teacher_name: teacherName,
        target_grade: targetGrade,
        target_grade_key: targetGradeKey,
        subject: subject || null,
        simulation_title: simulationTitle,
        simulation_url: parsedUrl.toString(),
        notes: notes || null,
        due_at: dueAt.toISOString(),
        assessment_questions: generatedAssessment.questions,
        assessment_generated_at: assessmentGeneratedAt,
      })
      .select(ASSIGNMENT_SELECT)
      .single();

    if (insertError) {
      return NextResponse.json({ error: withTableHint(insertError.message) }, { status: 500 });
    }
    if (!inserted) {
      return NextResponse.json({ error: "Unable to save simulation assignment" }, { status: 500 });
    }

    let warning: string | null = generatedAssessment.warning;
    try {
      const { data: profileRows, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("id,grade,role,full_name")
        .in("role", ["student", "customer"]);
      if (profileError) {
        warning = profileError.message;
      } else {
        const matchingStudents = (profileRows ?? [])
          .filter((row) => normalizeGradeKey(row.grade ?? "") === targetGradeKey)
          .map((row) => ({
            id: row.id,
            grade: row.grade ?? null,
            full_name: row.full_name ?? null,
          }));
        if (matchingStudents.length > 0) {
          const progressRows = matchingStudents.map((student) => ({
            assignment_id: inserted.id,
            student_id: student.id,
            student_name: student.full_name,
            student_grade: student.grade,
            status: "assigned",
            viewed_at: null,
          }));
          const { error: progressError } = await supabaseAdmin
            .from("simulation_assignment_progress")
            .upsert(progressRows, { onConflict: "assignment_id,student_id" });
          if (progressError) {
            warning = warning ? `${warning}; ${progressError.message}` : progressError.message;
          }

          const title = `Simulation assigned: ${simulationTitle}`;
          const deadlineLabel = dueAt.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });
          const message = `${teacherName} assigned a simulation for ${targetGrade}. Deadline: ${deadlineLabel}.`;
          const notifications = matchingStudents.map((student) => ({
            user_id: student.id,
            module_id: null,
            subject: subject || null,
            title,
            message,
            status: "unread",
            inserted_by: teacher.id,
          }));
          const { error: notificationError } = await supabaseAdmin.from("notifications").insert(notifications);
          if (notificationError) {
            warning = warning ? `${warning}; ${notificationError.message}` : notificationError.message;
          }
        }
      }
    } catch (notifyError) {
      warning = notifyError instanceof Error ? notifyError.message : "Unable to send notifications";
    }

    return NextResponse.json({
      assignment: inserted,
      warning,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
