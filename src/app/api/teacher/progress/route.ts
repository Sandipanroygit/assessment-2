import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin =
  SUPABASE_URL && SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY) : null;

const MODULE_SELECT_WITH_DUE = "id,title,grade,subject,published,due_at";
const MODULE_SELECT_WITHOUT_DUE = "id,title,grade,subject,published";
const SIMULATION_ASSIGNMENT_SELECT =
  "id,teacher_id,teacher_name,target_grade,target_grade_key,subject,simulation_title,simulation_url,notes,due_at,created_at,updated_at";
const SIMULATION_PROGRESS_SELECT =
  "assignment_id,student_id,student_name,student_grade,status,viewed_at,last_reminded_at,assessment_score,assessment_total,assessment_submitted_at,created_at,updated_at";
const STEAMH_ASSIGNMENT_SELECT =
  "id,teacher_id,teacher_name,student_id,student_name,title,instructions,subject,grade,due_at,status,submitted_project_id,submitted_at,last_reminded_at,created_at,updated_at";

const withTableHint = (message: string) => {
  const normalized = message.toLowerCase();
  if (
    (normalized.includes("simulation_assignments") ||
      normalized.includes("simulation_assignment_progress") ||
      normalized.includes("steamh_assignments") ||
      normalized.includes("due_at") ||
      normalized.includes("assessment_")) &&
    (normalized.includes("does not exist") || normalized.includes("schema cache") || normalized.includes("column"))
  ) {
    if (normalized.includes("steamh_assignments")) {
      return `${message} Apply \`supabase/steamh_assignments_patch.sql\` in Supabase SQL Editor.`;
    }
    if (
      normalized.includes("simulation_assignments") ||
      normalized.includes("simulation_assignment_progress")
    ) {
      return `${message} Apply \`supabase/simulation_assignments_patch.sql\` in Supabase SQL Editor.`;
    }
    if (normalized.includes("due_at")) {
      return `${message} Apply \`supabase/curriculum_module_deadlines_patch.sql\` in Supabase SQL Editor.`;
    }
  }
  return message;
};

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

  const role = (userData.user.user_metadata?.role as string | undefined)?.toLowerCase() ?? "";
  if (role !== "teacher") {
    return NextResponse.json({ error: "Only teachers can view progress" }, { status: 403 });
  }

  const teacherId = userData.user.id;
  const subject = (userData.user.user_metadata?.subject as string | undefined) ?? null;

  // Modules (published only) in teacher subject
  const buildModuleQuery = (includeDueAt: boolean) => {
    let query = supabaseAdmin
      .from("curriculum_modules")
      .select(includeDueAt ? MODULE_SELECT_WITH_DUE : MODULE_SELECT_WITHOUT_DUE)
      .eq("published", true);
    if (subject) query = query.eq("subject", subject);
    return query;
  };

  let includeDueAt = true;
  let modules: Array<Record<string, unknown>> = [];
  let modulesError: { message: string } | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await buildModuleQuery(includeDueAt);
    modulesError = result.error;
    if (!modulesError) {
      modules = (result.data ?? []) as Array<Record<string, unknown>>;
      break;
    }
    const normalized = modulesError.message.toLowerCase();
    if (includeDueAt && normalized.includes("due_at") && (normalized.includes("column") || normalized.includes("schema cache"))) {
      includeDueAt = false;
      continue;
    }
    break;
  }
  if (modulesError) {
    return NextResponse.json({ error: withTableHint(modulesError.message) }, { status: 500 });
  }

  // Students (auth metadata)
  const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 500,
  });
  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }
  const students = (listData.users ?? [])
    .filter((u) => {
      const normalizedRole = ((u.user_metadata?.role as string | undefined)?.toLowerCase() ?? "");
      return normalizedRole === "student" || normalizedRole === "customer";
    })
    .map((u) => ({
      id: u.id,
      email: u.email,
      full_name: (u.user_metadata?.full_name as string | undefined) ?? u.email ?? "Student",
      grade: (u.user_metadata?.grade as string | undefined) ?? null,
      subject: (u.user_metadata?.subject as string | undefined) ?? null,
    }))
    .filter((s) => {
      if (!subject) return true;
      return !s.subject || s.subject === subject; // show students without subject or matching subject
    });

  const moduleIds = modules
    .map((m) => (typeof m.id === "string" ? m.id : null))
    .filter((id): id is string => !!id);
  const { data: submissions, error: subError } = await supabaseAdmin
    .from("activity_submissions")
    .select(
      `
        id,
        module_id,
        user_id,
        submission_number,
        report_status,
        report_json,
        created_at,
        updated_at
      `,
    )
    .in("module_id", moduleIds.length ? moduleIds : ["00000000-0000-0000-0000-000000000000"])
    .order("updated_at", { ascending: false });
  if (subError) {
    return NextResponse.json({ error: withTableHint(subError.message) }, { status: 500 });
  }

  const { data: simulationAssignments, error: simulationAssignmentsError } = await supabaseAdmin
    .from("simulation_assignments")
    .select(SIMULATION_ASSIGNMENT_SELECT)
    .eq("teacher_id", teacherId)
    .order("due_at", { ascending: true })
    .order("created_at", { ascending: false });
  if (simulationAssignmentsError) {
    return NextResponse.json({ error: withTableHint(simulationAssignmentsError.message) }, { status: 500 });
  }

  const simulationAssignmentIds = (simulationAssignments ?? [])
    .map((row) => row.id)
    .filter((id): id is string => typeof id === "string");
  let simulationProgress: Array<Record<string, unknown>> = [];
  if (simulationAssignmentIds.length > 0) {
    const { data: simulationProgressRows, error: simulationProgressError } = await supabaseAdmin
      .from("simulation_assignment_progress")
      .select(SIMULATION_PROGRESS_SELECT)
      .in("assignment_id", simulationAssignmentIds);
    if (simulationProgressError) {
      return NextResponse.json({ error: withTableHint(simulationProgressError.message) }, { status: 500 });
    }
    simulationProgress = (simulationProgressRows ?? []) as Array<Record<string, unknown>>;
  }

  const { data: steamhAssignments, error: steamhAssignmentsError } = await supabaseAdmin
    .from("steamh_assignments")
    .select(STEAMH_ASSIGNMENT_SELECT)
    .eq("teacher_id", teacherId)
    .order("due_at", { ascending: true })
    .order("created_at", { ascending: false });
  if (steamhAssignmentsError) {
    return NextResponse.json({ error: withTableHint(steamhAssignmentsError.message) }, { status: 500 });
  }

  return NextResponse.json({
    modules,
    submissions: submissions ?? [],
    students,
    simulationAssignments: simulationAssignments ?? [],
    simulationProgress,
    steamhAssignments: steamhAssignments ?? [],
  });
}
