import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin =
  SUPABASE_URL && SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

type StudentRow = {
  id: string;
  name: string;
  grade: string | null;
  subject: string | null;
};

type SubmissionRow = {
  module_id: string | null;
  user_id: string | null;
  submission_number: number | null;
  updated_at: string | null;
  report_json: unknown;
};

type AnalyticsEventRow = {
  user_id: string | null;
  payload: unknown;
  created_at: string | null;
};

type SimulationProgressRow = {
  assignment_id: string;
  student_id: string;
  assessment_score: number | null;
  assessment_total: number | null;
  assessment_submitted_at: string | null;
};

type SteamhAssignmentRow = {
  student_id: string | null;
  title: string | null;
  submitted_at: string | null;
  status: string | null;
};

type ScorePoint = {
  timestamp: string;
  percent: number;
  source: "drone" | "simulation";
  title: string;
};

type StudentScoreAgg = {
  student_name: string;
  grade: string | null;
  subject: string | null;
  total_entries: number;
  total_percent: number;
  drone_entries: number;
  drone_total_percent: number;
  drone_accuracy_entries: number;
  drone_accuracy_total_percent: number;
  drone_assessment_entries: number;
  drone_assessment_total_percent: number;
  simulation_entries: number;
  simulation_total_percent: number;
};

const normalizeRole = (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase() : "");
const isStudentLikeRole = (role: string) => role === "student" || role === "customer";
const normalizeGradeKey = (value: string | null | undefined) =>
  (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/grade/gi, "")
    .replace(/[^a-z0-9]+/g, "");
const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const asNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};
const round2 = (value: number) => Math.round(value * 100) / 100;
const gradeRank = (grade: string | null) => {
  if (!grade) return Number.MAX_SAFE_INTEGER;
  const match = grade.match(/\d+/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
};

const createStudentAgg = (student: StudentRow): StudentScoreAgg => ({
  student_name: student.name,
  grade: student.grade,
  subject: student.subject,
  total_entries: 0,
  total_percent: 0,
  drone_entries: 0,
  drone_total_percent: 0,
  drone_accuracy_entries: 0,
  drone_accuracy_total_percent: 0,
  drone_assessment_entries: 0,
  drone_assessment_total_percent: 0,
  simulation_entries: 0,
  simulation_total_percent: 0,
});

const sortPointsAsc = (points: ScorePoint[]) =>
  [...points].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

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
    return NextResponse.json({ error: userError?.message ?? "Invalid token" }, { status: 401 });
  }

  const teacher = userData.user;
  const role = normalizeRole(teacher.user_metadata?.role);
  if (role !== "teacher") {
    return NextResponse.json({ error: "Only teachers can view analytics" }, { status: 403 });
  }

  const selectedStudentId = new URL(req.url).searchParams.get("studentId")?.trim() ?? null;

  const teacherId = teacher.id;
  const teacherSubject = (teacher.user_metadata?.subject as string | undefined) ?? null;

  const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const students = (listData.users ?? [])
    .filter((u) => isStudentLikeRole(normalizeRole(u.user_metadata?.role)))
    .map((u) => ({
      id: u.id,
      name: (u.user_metadata?.full_name as string | undefined)?.trim() || u.email || "Student",
      grade: (u.user_metadata?.grade as string | undefined) ?? null,
      subject: (u.user_metadata?.subject as string | undefined) ?? null,
    }))
    .filter((s) => {
      if (!teacherSubject) return true;
      return !s.subject || s.subject === teacherSubject;
    });

  const studentById = new Map(students.map((item) => [item.id, item]));

  let modulesQuery = supabaseAdmin
    .from("curriculum_modules")
    .select("id,title,grade,subject,published,due_at")
    .eq("published", true);
  if (teacherSubject) {
    modulesQuery = modulesQuery.eq("subject", teacherSubject);
  }
  const { data: modules, error: modulesError } = await modulesQuery;
  if (modulesError) {
    return NextResponse.json({ error: modulesError.message }, { status: 500 });
  }

  const moduleRows = modules ?? [];
  const moduleById = new Map(moduleRows.map((row) => [row.id, row]));
  const moduleIds = moduleRows.map((row) => row.id);

  let submissionRows: SubmissionRow[] = [];
  if (moduleIds.length > 0) {
    const { data: submissions, error: submissionsError } = await supabaseAdmin
      .from("activity_submissions")
      .select("module_id,user_id,submission_number,updated_at,report_json")
      .in("module_id", moduleIds)
      .order("updated_at", { ascending: false })
      .limit(10000);
    if (submissionsError) {
      return NextResponse.json({ error: submissionsError.message }, { status: 500 });
    }
    submissionRows = (submissions as SubmissionRow[]) ?? [];
  }

  const studentIds = students.map((row) => row.id);
  let quizEventRows: AnalyticsEventRow[] = [];
  if (studentIds.length > 0) {
    const { data: quizEvents, error: quizEventsError } = await supabaseAdmin
      .from("analytics_events")
      .select("user_id,payload,created_at")
      .eq("event_type", "student_quiz_attempt")
      .in("user_id", studentIds)
      .order("created_at", { ascending: false })
      .limit(50000);
    if (quizEventsError) {
      return NextResponse.json({ error: quizEventsError.message }, { status: 500 });
    }
    quizEventRows = (quizEvents as AnalyticsEventRow[]) ?? [];
  }

  const { data: simulationAssignments, error: simulationAssignmentsError } = await supabaseAdmin
    .from("simulation_assignments")
    .select("id,simulation_title,target_grade")
    .eq("teacher_id", teacherId);
  if (simulationAssignmentsError) {
    return NextResponse.json({ error: simulationAssignmentsError.message }, { status: 500 });
  }
  const simulationById = new Map((simulationAssignments ?? []).map((row) => [row.id, row]));
  const simulationIds = (simulationAssignments ?? []).map((row) => row.id);

  let simulationProgressRows: SimulationProgressRow[] = [];
  if (simulationIds.length > 0) {
    const { data: simulationProgress, error: simulationProgressError } = await supabaseAdmin
      .from("simulation_assignment_progress")
      .select("assignment_id,student_id,assessment_score,assessment_total,assessment_submitted_at")
      .in("assignment_id", simulationIds)
      .limit(20000);
    if (simulationProgressError) {
      return NextResponse.json({ error: simulationProgressError.message }, { status: 500 });
    }
    simulationProgressRows = (simulationProgress as SimulationProgressRow[]) ?? [];
  }

  const { data: steamhAssignments, error: steamhAssignmentsError } = await supabaseAdmin
    .from("steamh_assignments")
    .select("student_id,title,submitted_at,status")
    .eq("teacher_id", teacherId)
    .limit(20000);
  if (steamhAssignmentsError) {
    return NextResponse.json({ error: steamhAssignmentsError.message }, { status: 500 });
  }
  const steamhRows = (steamhAssignments as SteamhAssignmentRow[]) ?? [];

  const latestDroneByPair = new Map<string, SubmissionRow>();
  for (const row of submissionRows) {
    if (!row.module_id || !row.user_id) continue;
    const key = `${row.module_id}::${row.user_id}`;
    if (!latestDroneByPair.has(key)) {
      latestDroneByPair.set(key, row);
    }
  }

  let targetDronePairs = 0;
  for (const moduleRow of moduleRows) {
    const moduleGradeKey = normalizeGradeKey(moduleRow.grade);
    const targetStudents = students.filter((student) => {
      if (!moduleGradeKey) return true;
      return normalizeGradeKey(student.grade) === moduleGradeKey;
    });
    targetDronePairs += targetStudents.length;
  }

  const studentAggById = new Map<string, StudentScoreAgg>();
  const studentPointsById = new Map<string, ScorePoint[]>();
  const ensureStudentAgg = (studentId: string) => {
    const student = studentById.get(studentId);
    if (!student) return null;
    const existing = studentAggById.get(studentId);
    if (existing) return existing;
    const created = createStudentAgg(student);
    studentAggById.set(studentId, created);
    return created;
  };

  const latestQuizByPair = new Map<string, { percent: number; timestamp: string; title: string }>();
  const quizPointsByStudent = new Map<string, ScorePoint[]>();

  for (const event of quizEventRows) {
    if (!event.user_id || !event.created_at) continue;
    if (!studentById.has(event.user_id)) continue;
    const payload = asRecord(event.payload);
    const metadata = asRecord(payload.metadata);
    const score = asNumber(metadata.score ?? payload.score);
    const total = asNumber(metadata.total ?? payload.total);
    if (score === null || total === null || total <= 0) continue;
    const moduleIdRaw = metadata.module_id ?? payload.module_id;
    const moduleId = typeof moduleIdRaw === "string" ? moduleIdRaw.trim() : "";
    if (!moduleId || !moduleById.has(moduleId)) continue;
    const moduleRow = moduleById.get(moduleId);
    const moduleTitle =
      (typeof metadata.module_title === "string" && metadata.module_title.trim()) ||
      (typeof payload.module_title === "string" && payload.module_title.trim()) ||
      moduleRow?.title ||
      "Activity";
    const percent = (score / total) * 100;

    const pairKey = `${moduleId}::${event.user_id}`;
    if (!latestQuizByPair.has(pairKey)) {
      latestQuizByPair.set(pairKey, {
        percent,
        timestamp: event.created_at,
        title: moduleTitle,
      });
    }

    const points = quizPointsByStudent.get(event.user_id) ?? [];
    points.push({
      timestamp: event.created_at,
      percent: round2(percent),
      source: "drone",
      title: `${moduleTitle} (Assessment)`,
    });
    quizPointsByStudent.set(event.user_id, points);
  }

  const droneAccuracies: number[] = [];
  const droneAssessmentPercents: number[] = [];
  const droneModuleAgg = new Map<
    string,
    {
      title: string;
      submissions: number;
      totalAccuracy: number;
      accuracyCount: number;
      totalAssessment: number;
      assessmentCount: number;
      totalCombined: number;
      combinedCount: number;
    }
  >();

  for (const row of latestDroneByPair.values()) {
    if (!row.module_id || !row.user_id) continue;
    if (!studentById.has(row.user_id)) continue;
    const moduleRow = moduleById.get(row.module_id);
    if (!moduleRow) continue;
    const report = asRecord(row.report_json);
    const accuracy = asNumber(report.accuracyPercent);
    const quiz = latestQuizByPair.get(`${row.module_id}::${row.user_id}`);
    const assessmentPercentRaw = quiz?.percent ?? null;
    const assessmentPercentForCombine =
      assessmentPercentRaw !== null && assessmentPercentRaw > 0 ? assessmentPercentRaw : null;
    const combinedPercent =
      accuracy !== null && assessmentPercentForCombine !== null
        ? (accuracy + assessmentPercentForCombine) / 2
        : accuracy !== null
          ? accuracy
          : assessmentPercentForCombine;
    if (combinedPercent === null) continue;
    if (accuracy !== null) {
      droneAccuracies.push(accuracy);
    }
    if (assessmentPercentForCombine !== null) {
      droneAssessmentPercents.push(assessmentPercentForCombine);
    }

    const moduleAgg = droneModuleAgg.get(row.module_id) ?? {
      title: moduleRow.title ?? "Activity",
      submissions: 0,
      totalAccuracy: 0,
      accuracyCount: 0,
      totalAssessment: 0,
      assessmentCount: 0,
      totalCombined: 0,
      combinedCount: 0,
    };
    moduleAgg.submissions += 1;
    if (accuracy !== null) {
      moduleAgg.totalAccuracy += accuracy;
      moduleAgg.accuracyCount += 1;
    }
    if (assessmentPercentForCombine !== null) {
      moduleAgg.totalAssessment += assessmentPercentForCombine;
      moduleAgg.assessmentCount += 1;
    }
    moduleAgg.totalCombined += combinedPercent;
    moduleAgg.combinedCount += 1;
    droneModuleAgg.set(row.module_id, moduleAgg);

    const studentAgg = ensureStudentAgg(row.user_id);
    if (studentAgg) {
      studentAgg.total_entries += 1;
      studentAgg.total_percent += combinedPercent;
      studentAgg.drone_entries += 1;
      studentAgg.drone_total_percent += combinedPercent;
      if (accuracy !== null) {
        studentAgg.drone_accuracy_entries += 1;
        studentAgg.drone_accuracy_total_percent += accuracy;
      }
      if (assessmentPercentForCombine !== null) {
        studentAgg.drone_assessment_entries += 1;
        studentAgg.drone_assessment_total_percent += assessmentPercentForCombine;
      }
    }
  }

  for (const row of submissionRows) {
    if (!row.module_id || !row.user_id || !row.updated_at) continue;
    if (!studentById.has(row.user_id)) continue;
    const moduleRow = moduleById.get(row.module_id);
    if (!moduleRow) continue;
    const report = asRecord(row.report_json);
    const accuracy = asNumber(report.accuracyPercent);
    if (accuracy === null) continue;
    const points = studentPointsById.get(row.user_id) ?? [];
    points.push({
      timestamp: row.updated_at,
      percent: round2(accuracy),
      source: "drone",
      title: moduleRow.title ?? "Activity",
    });
    studentPointsById.set(row.user_id, points);
  }

  for (const [studentId, points] of quizPointsByStudent.entries()) {
    const existing = studentPointsById.get(studentId) ?? [];
    studentPointsById.set(studentId, [...existing, ...points]);
  }

  const simulationPercents: number[] = [];
  const simulationAgg = new Map<string, { title: string; attempts: number; submitted: number; totalPercent: number; scoredCount: number }>();
  let simulationSubmitted = 0;

  for (const row of simulationProgressRows) {
    if (!studentById.has(row.student_id)) continue;
    const assignment = simulationById.get(row.assignment_id);
    if (!assignment) continue;
    const title = assignment.simulation_title ?? "Simulation";
    const agg = simulationAgg.get(row.assignment_id) ?? {
      title,
      attempts: 0,
      submitted: 0,
      totalPercent: 0,
      scoredCount: 0,
    };
    agg.attempts += 1;
    if (row.assessment_submitted_at) {
      agg.submitted += 1;
      simulationSubmitted += 1;
    }
    if (
      typeof row.assessment_score === "number" &&
      Number.isFinite(row.assessment_score) &&
      typeof row.assessment_total === "number" &&
      Number.isFinite(row.assessment_total) &&
      row.assessment_total > 0
    ) {
      const percent = (row.assessment_score / row.assessment_total) * 100;
      simulationPercents.push(percent);
      agg.totalPercent += percent;
      agg.scoredCount += 1;

      const studentAgg = ensureStudentAgg(row.student_id);
      if (studentAgg) {
        studentAgg.total_entries += 1;
        studentAgg.total_percent += percent;
        studentAgg.simulation_entries += 1;
        studentAgg.simulation_total_percent += percent;
      }
      if (row.assessment_submitted_at) {
        const points = studentPointsById.get(row.student_id) ?? [];
        points.push({
          timestamp: row.assessment_submitted_at,
          percent: round2(percent),
          source: "simulation",
          title,
        });
        studentPointsById.set(row.student_id, points);
      }
    }
    simulationAgg.set(row.assignment_id, agg);
  }

  const steamhSubmitted = steamhRows.filter((row) => !!row.submitted_at).length;
  const steamhPendingReview = steamhRows.filter(
    (row) => !!row.submitted_at && (row.status ?? "").toLowerCase() !== "graded",
  ).length;

  const steamhSubmittedByStudent = new Map<string, number>();
  const steamhAssignedByStudent = new Map<string, number>();
  for (const row of steamhRows) {
    if (!row.student_id || !studentById.has(row.student_id)) continue;
    steamhAssignedByStudent.set(row.student_id, (steamhAssignedByStudent.get(row.student_id) ?? 0) + 1);
    if (row.submitted_at) {
      steamhSubmittedByStudent.set(row.student_id, (steamhSubmittedByStudent.get(row.student_id) ?? 0) + 1);
    }
  }

  const droneAvg =
    droneAccuracies.length > 0 ? round2(droneAccuracies.reduce((sum, value) => sum + value, 0) / droneAccuracies.length) : 0;
  const droneAssessmentAvg =
    droneAssessmentPercents.length > 0
      ? round2(droneAssessmentPercents.reduce((sum, value) => sum + value, 0) / droneAssessmentPercents.length)
      : 0;
  const droneCombinedAvg = (() => {
    const values = Array.from(studentAggById.values()).filter((item) => item.drone_entries > 0);
    if (values.length === 0) return 0;
    const total = values.reduce((sum, item) => sum + item.drone_total_percent / item.drone_entries, 0);
    return round2(total / values.length);
  })();
  const simulationAvg =
    simulationPercents.length > 0
      ? round2(simulationPercents.reduce((sum, value) => sum + value, 0) / simulationPercents.length)
      : 0;
  const overallStudentAvg = (() => {
    const values = Array.from(studentAggById.values()).filter((item) => item.total_entries > 0);
    if (values.length === 0) return 0;
    const total = values.reduce((sum, item) => sum + item.total_percent / item.total_entries, 0);
    return round2(total / values.length);
  })();

  const studentsOverview = students
    .map((student) => {
      const agg = studentAggById.get(student.id) ?? createStudentAgg(student);
      const steamhAssigned = steamhAssignedByStudent.get(student.id) ?? 0;
      const steamhSubmittedCount = steamhSubmittedByStudent.get(student.id) ?? 0;
      return {
        student_id: student.id,
        student_name: agg.student_name,
        grade: agg.grade,
        subject: agg.subject,
        total_entries: agg.total_entries,
        average_percent: agg.total_entries > 0 ? round2(agg.total_percent / agg.total_entries) : null,
        drone_average_percent: agg.drone_entries > 0 ? round2(agg.drone_total_percent / agg.drone_entries) : null,
        drone_accuracy_average_percent:
          agg.drone_accuracy_entries > 0 ? round2(agg.drone_accuracy_total_percent / agg.drone_accuracy_entries) : null,
        drone_assessment_average_percent:
          agg.drone_assessment_entries > 0
            ? round2(agg.drone_assessment_total_percent / agg.drone_assessment_entries)
            : null,
        simulation_average_percent:
          agg.simulation_entries > 0 ? round2(agg.simulation_total_percent / agg.simulation_entries) : null,
        steamh_assigned: steamhAssigned,
        steamh_submitted: steamhSubmittedCount,
      };
    })
    .sort(
      (a, b) =>
        gradeRank(a.grade) - gradeRank(b.grade) ||
        (a.grade ?? "").localeCompare(b.grade ?? "", undefined, { sensitivity: "base", numeric: true }) ||
        a.student_name.localeCompare(b.student_name, undefined, { sensitivity: "base" }),
    );

  const leaderboard = studentsOverview
    .filter((row) => row.average_percent !== null)
    .map((row) => ({
      student_id: row.student_id,
      student_name: row.student_name,
      entries: row.total_entries,
      average_percent: row.average_percent ?? 0,
    }))
    .sort((a, b) => b.average_percent - a.average_percent || b.entries - a.entries || a.student_name.localeCompare(b.student_name))
    .slice(0, 12);

  const droneByActivity = Array.from(droneModuleAgg.entries())
    .map(([moduleId, row]) => {
      const moduleRow = moduleById.get(moduleId);
      const moduleGradeKey = normalizeGradeKey(moduleRow?.grade ?? null);
      const targetStudents = students.filter((student) => {
        if (!moduleGradeKey) return true;
        return normalizeGradeKey(student.grade) === moduleGradeKey;
      });
      return {
        module_id: moduleId,
        title: row.title,
        target_students: targetStudents.length,
        submitted_students: row.submissions,
        submission_rate_percent: targetStudents.length > 0 ? round2((row.submissions / targetStudents.length) * 100) : 0,
        average_accuracy_percent: row.accuracyCount > 0 ? round2(row.totalAccuracy / row.accuracyCount) : 0,
        average_assessment_percent: row.assessmentCount > 0 ? round2(row.totalAssessment / row.assessmentCount) : 0,
        average_combined_percent: row.combinedCount > 0 ? round2(row.totalCombined / row.combinedCount) : 0,
      };
    })
    .sort((a, b) => b.average_combined_percent - a.average_combined_percent || b.submitted_students - a.submitted_students);

  const simulationByAssignment = Array.from(simulationAgg.values())
    .map((row) => ({
      title: row.title,
      targeted_students: row.attempts,
      submitted_students: row.submitted,
      submission_rate_percent: row.attempts > 0 ? round2((row.submitted / row.attempts) * 100) : 0,
      average_score_percent: row.scoredCount > 0 ? round2(row.totalPercent / row.scoredCount) : 0,
    }))
    .sort((a, b) => b.average_score_percent - a.average_score_percent || b.submitted_students - a.submitted_students);

  const steamhByTask = (() => {
    const taskAgg = new Map<string, { assigned: number; submitted: number }>();
    for (const row of steamhRows) {
      const title = row.title?.trim() || "STEAM-H Task";
      const agg = taskAgg.get(title) ?? { assigned: 0, submitted: 0 };
      agg.assigned += 1;
      if (row.submitted_at) agg.submitted += 1;
      taskAgg.set(title, agg);
    }
    return Array.from(taskAgg.entries())
      .map(([title, values]) => ({
        title,
        assigned_students: values.assigned,
        submitted_students: values.submitted,
        submission_rate_percent: values.assigned > 0 ? round2((values.submitted / values.assigned) * 100) : 0,
      }))
      .sort((a, b) => b.submission_rate_percent - a.submission_rate_percent || b.submitted_students - a.submitted_students);
  })();

  const resolvedSelectedStudentId = (() => {
    if (selectedStudentId && studentById.has(selectedStudentId)) return selectedStudentId;
    return studentsOverview[0]?.student_id ?? null;
  })();

  const selectedStudent = (() => {
    if (!resolvedSelectedStudentId) return null;
    const summary = studentsOverview.find((row) => row.student_id === resolvedSelectedStudentId);
    if (!summary) return null;
    const points = sortPointsAsc(studentPointsById.get(resolvedSelectedStudentId) ?? []);
    const combined = points.slice(-40);
    const drone = points.filter((item) => item.source === "drone").slice(-30);
    const simulation = points.filter((item) => item.source === "simulation").slice(-30);
    const recentScores = [...points]
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
      .slice(0, 12);
    return {
      ...summary,
      curves: { combined, drone, simulation },
      recent_scores: recentScores,
    };
  })();

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    summary: {
      total_students: students.length,
      total_drone_modules: moduleRows.length,
      total_simulation_assignments: simulationAssignments?.length ?? 0,
      total_steamh_assignments: steamhRows.length,
      drone_average_accuracy_percent: droneAvg,
      drone_average_assessment_percent: droneAssessmentAvg,
      drone_average_combined_percent: droneCombinedAvg,
      simulation_average_score_percent: simulationAvg,
      steamh_submission_rate_percent: steamhRows.length > 0 ? round2((steamhSubmitted / steamhRows.length) * 100) : 0,
      overall_student_average_percent: overallStudentAvg,
    },
    drone: {
      target_student_activity_pairs: targetDronePairs,
      submitted_pairs: latestDroneByPair.size,
      submission_rate_percent: targetDronePairs > 0 ? round2((latestDroneByPair.size / targetDronePairs) * 100) : 0,
      scored_pairs: droneAccuracies.length,
      average_accuracy_percent: droneAvg,
      average_assessment_percent: droneAssessmentAvg,
      average_combined_percent: droneCombinedAvg,
      by_activity: droneByActivity.slice(0, 20),
    },
    simulation: {
      target_pairs: simulationProgressRows.length,
      assessment_submissions: simulationSubmitted,
      submission_rate_percent:
        simulationProgressRows.length > 0 ? round2((simulationSubmitted / simulationProgressRows.length) * 100) : 0,
      scored_pairs: simulationPercents.length,
      average_score_percent: simulationAvg,
      by_assignment: simulationByAssignment.slice(0, 20),
    },
    steamh: {
      assigned: steamhRows.length,
      submitted: steamhSubmitted,
      submission_rate_percent: steamhRows.length > 0 ? round2((steamhSubmitted / steamhRows.length) * 100) : 0,
      pending_teacher_review: steamhPendingReview,
      grading_note: "STEAM-H teacher marks are not enabled yet; this section shows submission analytics.",
      by_task: steamhByTask.slice(0, 20),
    },
    leaderboard,
    students_overview: studentsOverview,
    selected_student: selectedStudent,
  });
}
