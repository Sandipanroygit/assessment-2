import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  buildFallbackSimulationAssessment,
  normalizeStoredSimulationAssessment,
  scoreSimulationAssessment,
  toPublicSimulationAssessment,
} from "@/lib/simulationAssessment";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin =
  SUPABASE_URL && SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY) : null;

const ASSIGNMENT_SELECT =
  "id,teacher_id,teacher_name,target_grade,target_grade_key,subject,simulation_title,simulation_url,notes,due_at,assessment_questions,assessment_generated_at,created_at,updated_at";

const normalizeRole = (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase() : "");
const isStudentLikeRole = (role: string) => role === "student" || role === "customer";
const normalizeText = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
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

const simulationTitleFromNotification = (title: string) => {
  const prefix = "simulation assigned:";
  const normalized = title.trim();
  if (!normalized.toLowerCase().startsWith(prefix)) return null;
  const extracted = normalized.slice(prefix.length).trim();
  return extracted || null;
};

type StudentContext = {
  user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown>;
  };
  grade: string;
  gradeKey: string;
};

const resolveStudentContext = async (token: string): Promise<
  | { ok: true; context: StudentContext }
  | { ok: false; response: NextResponse }
> => {
  if (!supabaseAdmin) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Server misconfigured" }, { status: 500 }),
    };
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: userError?.message ?? "Invalid token" }, { status: 401 }),
    };
  }

  const student = userData.user;
  const roleFromMeta = normalizeRole(student.user_metadata?.role);
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role,grade")
    .eq("id", student.id)
    .maybeSingle();
  if (profileError) {
    return {
      ok: false,
      response: NextResponse.json({ error: profileError.message }, { status: 500 }),
    };
  }

  const roleFromProfile = normalizeRole(profile?.role);
  const role = roleFromMeta || roleFromProfile;
  if (!isStudentLikeRole(role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Only students can view assigned simulations" }, { status: 403 }),
    };
  }

  const gradeFromMeta = (student.user_metadata?.grade as string | undefined)?.trim() ?? "";
  const gradeFromProfile = (profile?.grade ?? "").trim();
  const grade = gradeFromProfile || gradeFromMeta;
  const gradeKey = normalizeGradeKey(grade);
  if (!gradeKey) {
    return {
      ok: false,
      response: NextResponse.json({
        assignments: [],
        grade: null,
        error: "Your grade is not set. Ask your teacher/admin to update your profile.",
        message: "Your grade is not set. Ask your teacher/admin to update your profile.",
      }, { status: 400 }),
    };
  }

  return {
    ok: true,
    context: {
      user: student,
      grade,
      gradeKey,
    },
  };
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

    const contextResult = await resolveStudentContext(token);
    if (!contextResult.ok) {
      return contextResult.response;
    }
    const { user: student, grade, gradeKey } = contextResult.context;

    const { data, error } = await supabaseAdmin
      .from("simulation_assignments")
      .select(ASSIGNMENT_SELECT)
      .eq("target_grade_key", gradeKey)
      .order("due_at", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) {
      return NextResponse.json({ error: withTableHint(error.message) }, { status: 500 });
    }

    const assignmentIds = (data ?? []).map((assignment) => assignment.id);
    let progressByAssignmentId = new Map<
      string,
      {
        status: string | null;
        viewed_at: string | null;
        updated_at: string | null;
        assessment_score: number | null;
        assessment_total: number | null;
        assessment_submitted_at: string | null;
      }
    >();
    if (assignmentIds.length > 0) {
      const { data: progressRows, error: progressError } = await supabaseAdmin
        .from("simulation_assignment_progress")
        .select("assignment_id,status,viewed_at,updated_at,assessment_score,assessment_total,assessment_submitted_at")
        .eq("student_id", student.id)
        .in("assignment_id", assignmentIds);
      if (progressError) {
        return NextResponse.json({ error: withTableHint(progressError.message) }, { status: 500 });
      }
      progressByAssignmentId = new Map(
        (progressRows ?? []).map((row) => [
          row.assignment_id,
          {
            status: row.status ?? null,
            viewed_at: row.viewed_at ?? null,
            updated_at: row.updated_at ?? null,
            assessment_score:
              typeof row.assessment_score === "number" && Number.isFinite(row.assessment_score)
                ? row.assessment_score
                : null,
            assessment_total:
              typeof row.assessment_total === "number" && Number.isFinite(row.assessment_total)
                ? row.assessment_total
                : null,
            assessment_submitted_at: row.assessment_submitted_at ?? null,
          },
        ]),
      );
    }

    const { data: unreadNotifications, error: notificationError } = await supabaseAdmin
      .from("notifications")
      .select("title")
      .eq("user_id", student.id)
      .eq("status", "unread")
      .order("created_at", { ascending: false })
      .limit(200);
    if (notificationError) {
      return NextResponse.json({ error: notificationError.message }, { status: 500 });
    }

    const unreadSimulationTitleKeys = new Set(
      (unreadNotifications ?? [])
        .map((note) => simulationTitleFromNotification(note.title ?? ""))
        .filter((title): title is string => !!title)
        .map((title) => normalizeText(title)),
    );

    const assignmentQuestionsById = new Map<string, ReturnType<typeof normalizeStoredSimulationAssessment>>();
    for (const assignment of data ?? []) {
      const normalized = normalizeStoredSimulationAssessment(assignment.assessment_questions);
      if (normalized.length > 0) {
        assignmentQuestionsById.set(assignment.id, normalized);
        continue;
      }

      const fallbackQuestions = buildFallbackSimulationAssessment({
        simulationTitle: assignment.simulation_title ?? "Simulation",
        subject: assignment.subject ?? null,
        targetGrade: assignment.target_grade ?? null,
        notes: assignment.notes ?? null,
      });
      assignmentQuestionsById.set(assignment.id, fallbackQuestions);

      const generatedAt = new Date().toISOString();
      const { error: patchError } = await supabaseAdmin
        .from("simulation_assignments")
        .update({
          assessment_questions: fallbackQuestions,
          assessment_generated_at: generatedAt,
          updated_at: generatedAt,
        })
        .eq("id", assignment.id);
      if (patchError) {
        // Keep response usable even if patching legacy rows fails.
      }
    }

    const assignmentsWithReadState = (data ?? []).map((assignment) => {
      const assessmentQuestions =
        assignmentQuestionsById.get(assignment.id) ??
        buildFallbackSimulationAssessment({
          simulationTitle: assignment.simulation_title ?? "Simulation",
          subject: assignment.subject ?? null,
          targetGrade: assignment.target_grade ?? null,
          notes: assignment.notes ?? null,
        });
      const titleKey = normalizeText(assignment.simulation_title ?? "");
      const isUnread = unreadSimulationTitleKeys.has(titleKey);
      const progress = progressByAssignmentId.get(assignment.id);
      const viewedAt = progress?.viewed_at ?? null;
      const isCompleted = Boolean(progress?.assessment_submitted_at);
      const progressStatus =
        isCompleted
          ? "completed"
          : progress?.status?.toLowerCase() === "viewed" || viewedAt
            ? "viewed"
            : "assigned";
      return {
        ...assignment,
        is_unread: isUnread,
        progress_status: progressStatus,
        viewed_at: viewedAt,
        progress_updated_at: progress?.updated_at ?? null,
        assessment_questions: toPublicSimulationAssessment(assessmentQuestions),
        assessment_question_count: assessmentQuestions.length,
        assessment_score: progress?.assessment_score ?? null,
        assessment_total: progress?.assessment_total ?? null,
        assessment_submitted_at: progress?.assessment_submitted_at ?? null,
      };
    });

    return NextResponse.json({
      grade,
      assignments: assignmentsWithReadState,
    });
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

    const contextResult = await resolveStudentContext(token);
    if (!contextResult.ok) {
      return contextResult.response;
    }
    const { user: student, grade, gradeKey } = contextResult.context;

    const body = (await req.json().catch(() => ({}))) as {
      assignmentId?: string;
      answers?: Record<string, number | string>;
    };
    const assignmentId = typeof body.assignmentId === "string" ? body.assignmentId.trim() : "";
    const hasAssessmentPayload = Boolean(
      body.answers && typeof body.answers === "object" && Object.keys(body.answers).length > 0,
    );
    if (!assignmentId) {
      return NextResponse.json({ error: "assignmentId is required" }, { status: 400 });
    }

    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from("simulation_assignments")
      .select("id,teacher_id,target_grade_key,subject,simulation_title,assessment_questions")
      .eq("id", assignmentId)
      .maybeSingle();
    if (assignmentError) {
      return NextResponse.json({ error: withTableHint(assignmentError.message) }, { status: 500 });
    }
    if (!assignment) {
      return NextResponse.json({ error: "Simulation assignment not found" }, { status: 404 });
    }
    if ((assignment.target_grade_key ?? "") !== gradeKey) {
      return NextResponse.json({ error: "This simulation is not assigned to your grade" }, { status: 403 });
    }

    const studentName =
      (student.user_metadata?.full_name as string | undefined)?.trim() ||
      student.email ||
      "Student";
    const notificationTitle = `Simulation assigned: ${assignment.simulation_title}`;

    if (hasAssessmentPayload) {
      const storedQuestions = normalizeStoredSimulationAssessment(assignment.assessment_questions);
      const questions =
        storedQuestions.length > 0
          ? storedQuestions
          : buildFallbackSimulationAssessment({
              simulationTitle: assignment.simulation_title ?? "Simulation",
              subject: assignment.subject ?? null,
              targetGrade: grade,
            });
      if (questions.length === 0) {
        return NextResponse.json({ error: "Assessment questions are not available yet." }, { status: 400 });
      }

      const { score, total, normalizedAnswers } = scoreSimulationAssessment(questions, body.answers);
      const hasUnanswered = Object.values(normalizedAnswers).some((value) => value < 0);
      if (hasUnanswered) {
        return NextResponse.json({ error: "Please answer all assessment questions before submitting." }, { status: 400 });
      }
      const submittedAt = new Date().toISOString();
      const { error: assessmentProgressError } = await supabaseAdmin
        .from("simulation_assignment_progress")
        .upsert(
          {
            assignment_id: assignment.id,
            student_id: student.id,
            student_name: studentName,
            student_grade: grade,
            status: "viewed",
            viewed_at: submittedAt,
            assessment_score: score,
            assessment_total: total,
            assessment_submitted_at: submittedAt,
            assessment_answers: normalizedAnswers,
            updated_at: submittedAt,
          },
          { onConflict: "assignment_id,student_id" },
        );
      if (assessmentProgressError) {
        return NextResponse.json({ error: withTableHint(assessmentProgressError.message) }, { status: 500 });
      }

      const { error: markReadError } = await supabaseAdmin
        .from("notifications")
        .update({ status: "read" })
        .eq("user_id", student.id)
        .eq("title", notificationTitle)
        .eq("status", "unread");
      if (markReadError) {
        return NextResponse.json({ error: markReadError.message }, { status: 500 });
      }

      const teacherNotificationMessage = `${studentName} submitted the simulation assessment "${assignment.simulation_title}" and scored ${score}/${total}.`;
      const { error: teacherNotificationError } = await supabaseAdmin
        .from("notifications")
        .insert({
          user_id: assignment.teacher_id ?? null,
          module_id: null,
          subject: assignment.subject ?? null,
          title: "Simulation assessment submitted",
          message: teacherNotificationMessage,
          status: "unread",
          inserted_by: student.id,
        });
      if (teacherNotificationError) {
        // Assessment is saved; avoid failing submission for notification issue.
      }

      return NextResponse.json({
        ok: true,
        assignmentId: assignment.id,
        score,
        total,
        submittedAt,
        status: "completed",
      });
    }

    const viewedAt = new Date().toISOString();
    const { error: progressError } = await supabaseAdmin
      .from("simulation_assignment_progress")
      .upsert(
        {
          assignment_id: assignment.id,
          student_id: student.id,
          student_name: studentName,
          student_grade: grade,
          status: "viewed",
          viewed_at: viewedAt,
          updated_at: viewedAt,
        },
        { onConflict: "assignment_id,student_id" },
      );
    if (progressError) {
      return NextResponse.json({ error: withTableHint(progressError.message) }, { status: 500 });
    }

    const { error: notificationError } = await supabaseAdmin
      .from("notifications")
      .update({ status: "read" })
      .eq("user_id", student.id)
      .eq("title", notificationTitle)
      .eq("status", "unread");
    if (notificationError) {
      return NextResponse.json({ error: notificationError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, assignmentId: assignment.id, viewedAt, status: "viewed" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
