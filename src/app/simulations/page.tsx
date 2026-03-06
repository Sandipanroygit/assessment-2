"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SimulationLibraryView } from "@/components/admin/SimulationLibraryView";
import { supabase } from "@/lib/supabaseClient";

type UserRole = "teacher" | "student" | "";

type SelectedSimulation = {
  subject: string;
  title: string;
  url: string;
  provider: string;
  focus: string;
};

type AssessmentQuestion = {
  id: string;
  question: string;
  options: string[];
};

type AssignedSimulation = {
  id: string;
  teacher_name: string;
  target_grade: string;
  subject?: string | null;
  simulation_title: string;
  simulation_url: string;
  notes?: string | null;
  due_at?: string | null;
  progress_status?: "assigned" | "viewed" | "completed" | string | null;
  viewed_at?: string | null;
  progress_updated_at?: string | null;
  assessment_questions?: AssessmentQuestion[];
  assessment_question_count?: number;
  assessment_score?: number | null;
  assessment_total?: number | null;
  assessment_submitted_at?: string | null;
  created_at?: string | null;
  is_unread?: boolean;
};

type TeacherStudentRow = {
  id: string;
  grade?: string | null;
};

const normalizeRole = (value: unknown): UserRole => {
  const role = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (role === "teacher") return "teacher";
  if (role === "student" || role === "customer") return "student";
  return "";
};

const sortGradeLabels = (grades: string[]) =>
  [...grades].sort((a, b) => {
    const aMatch = a.match(/\d+/);
    const bMatch = b.match(/\d+/);
    const aNumber = aMatch ? Number(aMatch[0]) : Number.MAX_SAFE_INTEGER;
    const bNumber = bMatch ? Number(bMatch[0]) : Number.MAX_SAFE_INTEGER;
    if (aNumber !== bNumber) return aNumber - bNumber;
    return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
  });

const formatDateTime = (value?: string | null) => {
  if (!value) return "--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "--";
  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function SimulationsPage() {
  const [role, setRole] = useState<UserRole>("");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [teacherGradeOptions, setTeacherGradeOptions] = useState<string[]>([]);
  const [selectedSimulation, setSelectedSimulation] = useState<SelectedSimulation | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignGrade, setAssignGrade] = useState("");
  const [assignNotes, setAssignNotes] = useState("");
  const [assigningSimulation, setAssigningSimulation] = useState(false);
  const [assignStatus, setAssignStatus] = useState<string | null>(null);
  const [studentAssignments, setStudentAssignments] = useState<AssignedSimulation[]>([]);
  const [studentAssignmentsStatus, setStudentAssignmentsStatus] = useState<string | null>(null);
  const [studentAssignmentsOpen, setStudentAssignmentsOpen] = useState(false);
  const [assessmentModalOpen, setAssessmentModalOpen] = useState(false);
  const [assessmentAssignment, setAssessmentAssignment] = useState<AssignedSimulation | null>(null);
  const [assessmentAnswers, setAssessmentAnswers] = useState<Record<string, number>>({});
  const [assessmentSubmitting, setAssessmentSubmitting] = useState(false);
  const [assessmentStatus, setAssessmentStatus] = useState<string | null>(null);

  const isTeacher = role === "teacher";
  const isStudent = role === "student";

  const loadTeacherGrades = useCallback(async (token: string) => {
    try {
      const response = await fetch("/api/teacher/students", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await response.json().catch(() => ({}))) as {
        students?: TeacherStudentRow[];
        error?: string;
      };
      if (!response.ok) {
        setAssignStatus(body?.error ?? "Unable to load grade list.");
        setTeacherGradeOptions([]);
        return;
      }
      const unique = new Set<string>();
      (body.students ?? []).forEach((student) => {
        const grade = student.grade?.trim() ?? "";
        if (grade) unique.add(grade);
      });
      const grades = sortGradeLabels(Array.from(unique));
      setTeacherGradeOptions(grades);
      setAssignGrade((prev) => (prev ? prev : grades[0] ?? ""));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load grade list.";
      setAssignStatus(message);
      setTeacherGradeOptions([]);
    }
  }, []);

  const loadStudentAssignments = useCallback(async (token: string) => {
    try {
      setStudentAssignmentsStatus("Loading assigned simulations...");
      const response = await fetch("/api/student/simulation-assignments", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await response.json().catch(() => ({}))) as {
        assignments?: AssignedSimulation[];
        message?: string;
        error?: string;
      };
      if (!response.ok) {
        setStudentAssignments([]);
        setStudentAssignmentsStatus(body?.error ?? "Unable to load assigned simulations.");
        return;
      }
      setStudentAssignments(body.assignments ?? []);
      setStudentAssignmentsStatus(body.message ?? null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load assigned simulations.";
      setStudentAssignments([]);
      setStudentAssignmentsStatus(message);
    }
  }, []);

  const markAssignmentAsRead = useCallback(
    async (assignment: AssignedSimulation) => {
      const nowIso = new Date().toISOString();
      setStudentAssignments((prev) =>
        prev.map((item) =>
          item.id === assignment.id
            ? {
                ...item,
                is_unread: false,
                progress_status: item.progress_status === "completed" ? "completed" : "viewed",
                viewed_at: item.viewed_at ?? nowIso,
                progress_updated_at: nowIso,
              }
            : item,
        ),
      );

      if (!sessionToken) return;
      try {
        const response = await fetch("/api/student/simulation-assignments", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ assignmentId: assignment.id }),
        });
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
          viewedAt?: string;
        };
        if (!response.ok) {
          setStudentAssignmentsStatus(body?.error ?? "Unable to update simulation progress.");
          return;
        }
        if (body.viewedAt) {
          setStudentAssignments((prev) =>
            prev.map((item) =>
              item.id === assignment.id
                ? {
                    ...item,
                    is_unread: false,
                    progress_status: item.progress_status === "completed" ? "completed" : "viewed",
                    viewed_at: body.viewedAt,
                    progress_updated_at: body.viewedAt,
                  }
                : item,
            ),
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to update simulation progress.";
        setStudentAssignmentsStatus(message);
      }
    },
    [sessionToken],
  );

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? null;
      if (!mounted) return;
      setSessionToken(token);

      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return;

      const roleFromMeta = normalizeRole(user.user_metadata?.role);
      let roleFromProfile: UserRole = "";
      if (!roleFromMeta) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        roleFromProfile = normalizeRole(profileData?.role);
      }

      const resolvedRole = roleFromMeta || roleFromProfile || "";
      if (!mounted) return;
      setRole(resolvedRole);

      if (token && resolvedRole === "teacher") {
        await loadTeacherGrades(token);
      }
      if (token && resolvedRole === "student") {
        await loadStudentAssignments(token);
      }
    };

    void bootstrap();
    return () => {
      mounted = false;
    };
  }, [loadStudentAssignments, loadTeacherGrades]);

  useEffect(() => {
    if (!isStudent || !studentAssignmentsOpen || !sessionToken) return;

    void loadStudentAssignments(sessionToken);
    const intervalId = window.setInterval(() => {
      void loadStudentAssignments(sessionToken);
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [isStudent, loadStudentAssignments, sessionToken, studentAssignmentsOpen]);

  useEffect(() => {
    if (!assignModalOpen && !studentAssignmentsOpen && !assessmentModalOpen) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [assignModalOpen, assessmentModalOpen, studentAssignmentsOpen]);

  const openAssignModal = useCallback((payload: { subject: string; simulation: { title: string; url: string; provider: string; focus: string } }) => {
    if (!isTeacher) return;
    setSelectedSimulation({
      subject: payload.subject,
      title: payload.simulation.title,
      url: payload.simulation.url,
      provider: payload.simulation.provider,
      focus: payload.simulation.focus,
    });
    setAssignModalOpen(true);
    setAssignStatus(null);
    setAssignNotes("");
    setAssignGrade((prev) => (prev ? prev : teacherGradeOptions[0] ?? ""));
  }, [isTeacher, teacherGradeOptions]);

  const assignSimulationToGrade = useCallback(async () => {
    if (!sessionToken) {
      setAssignStatus("Please log in again.");
      return;
    }
    if (!selectedSimulation) {
      setAssignStatus("Select a simulation first.");
      return;
    }
    if (!assignGrade.trim()) {
      setAssignStatus("Select a grade.");
      return;
    }

    try {
      setAssigningSimulation(true);
      setAssignStatus(null);

      const response = await fetch("/api/teacher/simulation-assignments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grade: assignGrade.trim(),
          simulationTitle: selectedSimulation.title,
          simulationUrl: selectedSimulation.url,
          subject: selectedSimulation.subject,
          notes: assignNotes.trim() || null,
        }),
      });

      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        warning?: string | null;
      };
      if (!response.ok) {
        setAssignStatus(body?.error ?? "Unable to assign simulation.");
        return;
      }

      const warning =
        typeof body?.warning === "string" && body.warning.trim().length > 0 ? ` (${body.warning})` : "";
      setAssignStatus(`Assigned "${selectedSimulation.title}" to ${assignGrade}.${warning}`);
      setAssignModalOpen(false);
      setAssignNotes("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to assign simulation.";
      setAssignStatus(message);
    } finally {
      setAssigningSimulation(false);
    }
  }, [assignGrade, assignNotes, selectedSimulation, sessionToken]);

  const openAssessmentModal = useCallback((assignment: AssignedSimulation) => {
    const questions = assignment.assessment_questions ?? [];
    if (!questions.length) {
      setStudentAssignmentsStatus("Assessment is being prepared. Try again in a moment.");
      return;
    }
    setAssessmentAssignment(assignment);
    setAssessmentAnswers({});
    setAssessmentStatus(null);
    setAssessmentModalOpen(true);
  }, []);

  const submitAssessment = useCallback(async () => {
    if (!sessionToken) {
      setAssessmentStatus("Please log in again.");
      return;
    }
    if (!assessmentAssignment) {
      setAssessmentStatus("Select an assignment first.");
      return;
    }

    const questions = assessmentAssignment.assessment_questions ?? [];
    const unanswered = questions.some((question) => typeof assessmentAnswers[question.id] !== "number");
    if (unanswered) {
      setAssessmentStatus("Answer all 20 questions before submitting.");
      return;
    }

    try {
      setAssessmentSubmitting(true);
      setAssessmentStatus(null);
      const response = await fetch("/api/student/simulation-assignments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assignmentId: assessmentAssignment.id,
          answers: assessmentAnswers,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        score?: number;
        total?: number;
        submittedAt?: string;
      };
      if (!response.ok) {
        setAssessmentStatus(body?.error ?? "Unable to submit assessment.");
        return;
      }

      const score = typeof body.score === "number" ? body.score : null;
      const total = typeof body.total === "number" ? body.total : questions.length;
      const submittedAt = typeof body.submittedAt === "string" ? body.submittedAt : new Date().toISOString();
      setStudentAssignments((prev) =>
        prev.map((item) =>
          item.id === assessmentAssignment.id
            ? {
                ...item,
                is_unread: false,
                progress_status: "completed",
                viewed_at: item.viewed_at ?? submittedAt,
                assessment_score: score,
                assessment_total: total,
                assessment_submitted_at: submittedAt,
                progress_updated_at: submittedAt,
              }
            : item,
        ),
      );
      setAssessmentModalOpen(false);
      setAssessmentAssignment(null);
      setAssessmentAnswers({});
      if (score !== null) {
        setStudentAssignmentsStatus(
          `Assessment submitted for "${assessmentAssignment.simulation_title}". Score: ${score}/${total}.`,
        );
      } else {
        setStudentAssignmentsStatus(`Assessment submitted for "${assessmentAssignment.simulation_title}".`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to submit assessment.";
      setAssessmentStatus(message);
    } finally {
      setAssessmentSubmitting(false);
    }
  }, [assessmentAnswers, assessmentAssignment, sessionToken]);

  return (
    <main className="min-h-screen section-padding space-y-6">
      <div className="glass-panel sticky top-0 z-30 -mx-[clamp(1.25rem,4vw,4rem)] rounded-2xl border border-white/35 bg-white/45 supports-[backdrop-filter]:bg-white/22 backdrop-blur-2xl shadow-[0_16px_36px_rgba(15,23,42,0.18)] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Library</p>
          <h1 className="text-2xl font-semibold text-slate-900">Simulations</h1>
          {isStudent && (
            <p className="mt-1 text-xs text-slate-600">
              Open <span className="font-semibold">Assigned Simulations</span> to access tasks sent by your teacher.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/customer"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>

      {assignStatus && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {assignStatus}
        </div>
      )}

      {studentAssignmentsStatus && (
        <div className="rounded-xl border border-white/10 bg-white/70 px-4 py-3 text-sm text-slate-700">
          {studentAssignmentsStatus}
        </div>
      )}

      <SimulationLibraryView
        enableTeacherAssign={isTeacher}
        studentOnlyView={isStudent}
        onAssignSimulation={openAssignModal}
        studentAssignedButton={
          isStudent
            ? {
                label: "Assigned Simulation",
                onClick: () => setStudentAssignmentsOpen(true),
                ring: studentAssignments.some((assignment) => assignment.is_unread),
              }
            : null
        }
      />

      {isTeacher && assignModalOpen && selectedSimulation && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-emerald-700">Assign Simulation</p>
                <h2 className="text-lg font-semibold text-slate-900">{selectedSimulation.title}</h2>
                <p className="text-xs text-slate-600 mt-1">
                  {selectedSimulation.subject} | {selectedSimulation.provider}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <p className="text-xs text-slate-600 break-all">{selectedSimulation.url}</p>

            <label className="block text-sm text-slate-800 space-y-1">
              Select Grade
              <select
                value={assignGrade}
                onChange={(event) => setAssignGrade(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-emerald-500"
              >
                <option value="">Select grade</option>
                {teacherGradeOptions.map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm text-slate-800 space-y-1">
              Notes (optional)
              <textarea
                value={assignNotes}
                onChange={(event) => setAssignNotes(event.target.value)}
                rows={3}
                maxLength={1500}
                placeholder="Add what students should observe or submit after this simulation."
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-emerald-500 resize-y"
              />
            </label>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Students in the selected grade will see this under Assigned Simulations.
              </p>
              <button
                type="button"
                onClick={() => void assignSimulationToGrade()}
                disabled={assigningSimulation || !assignGrade}
                className="rounded-lg border border-emerald-700 bg-emerald-700 px-4 py-2 text-sm font-semibold text-true-white hover:bg-emerald-600 transition disabled:opacity-60"
              >
                {assigningSimulation ? "Assigning..." : "Assign"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isStudent && studentAssignmentsOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-emerald-700">Student View</p>
                <h2 className="text-lg font-semibold text-slate-900">Assigned Simulations</h2>
              </div>
              <div className="flex items-center gap-2">
                {sessionToken && (
                  <button
                    type="button"
                    onClick={() => void loadStudentAssignments(sessionToken)}
                    className="rounded-lg border border-emerald-700 bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-true-white hover:bg-emerald-600 transition"
                  >
                    Refresh
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setStudentAssignmentsOpen(false)}
                  className="rounded-lg border border-rose-700 bg-rose-700 px-3 py-1.5 text-xs font-semibold text-true-white hover:bg-rose-600 transition"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="overflow-y-auto space-y-3 pr-1 max-h-[28rem]">
              {studentAssignments.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  No assigned simulations yet.
                </div>
              ) : (
                studentAssignments.map((assignment) => (
                  <article
                    key={assignment.id}
                    className={`rounded-xl border px-4 py-3 space-y-2 ${
                      assignment.is_unread
                        ? "border-amber-300 bg-amber-50"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{assignment.simulation_title}</p>
                      <span
                        className={`px-2 py-1 rounded-full text-[11px] font-semibold ${
                          assignment.progress_status === "completed"
                            ? "bg-emerald-700 text-true-white"
                            : assignment.progress_status === "viewed"
                              ? "bg-cyan-700 text-true-white"
                              : "bg-amber-500 text-slate-900"
                        }`}
                      >
                        {assignment.progress_status === "completed"
                          ? "Completed"
                          : assignment.progress_status === "viewed"
                            ? "Viewed"
                            : "Pending"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Teacher: {assignment.teacher_name}
                      {assignment.subject ? ` | ${assignment.subject}` : ""}
                    </p>
                    <p className="text-xs text-slate-600">Deadline: {formatDateTime(assignment.due_at)}</p>
                    {assignment.notes && <p className="text-xs text-slate-700">{assignment.notes}</p>}
                    {typeof assignment.assessment_score === "number" && typeof assignment.assessment_total === "number" ? (
                      <p className="text-xs font-semibold text-emerald-700">
                        Assessment score: {assignment.assessment_score}/{assignment.assessment_total}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={assignment.simulation_url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => void markAssignmentAsRead(assignment)}
                        className="inline-flex items-center rounded-lg border border-emerald-700 bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-true-white hover:bg-emerald-600 transition"
                      >
                        Open simulation
                      </a>
                      <button
                        type="button"
                        onClick={() => openAssessmentModal(assignment)}
                        disabled={
                          assignment.progress_status === "completed" ||
                          !(assignment.assessment_questions?.length)
                        }
                        className="inline-flex items-center rounded-lg border border-sky-700 bg-sky-700 px-3 py-1.5 text-xs font-semibold text-true-white hover:bg-sky-600 transition disabled:opacity-60"
                      >
                        {assignment.progress_status === "completed" ? "Assessment done" : "Take AI Assessment"}
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {isStudent && assessmentModalOpen && assessmentAssignment && (
        <div className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-sky-700">AI Assessment</p>
                <h2 className="text-lg font-semibold text-slate-900">{assessmentAssignment.simulation_title}</h2>
                <p className="text-xs text-slate-600 mt-1">
                  Answer all {assessmentAssignment.assessment_questions?.length ?? 20} questions and submit to mark
                  this simulation as completed.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAssessmentModalOpen(false);
                  setAssessmentAssignment(null);
                  setAssessmentAnswers({});
                  setAssessmentStatus(null);
                }}
                className="rounded-lg border border-rose-700 bg-rose-700 px-3 py-1.5 text-xs font-semibold text-true-white hover:bg-rose-600 transition"
              >
                Close
              </button>
            </div>

            <div className="overflow-y-auto pr-1 max-h-[60vh] space-y-4">
              {(assessmentAssignment.assessment_questions ?? []).map((question, questionIndex) => (
                <article key={question.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">
                    Q{questionIndex + 1}. {question.question}
                  </p>
                  <div className="mt-3 space-y-2">
                    {question.options.map((option, optionIndex) => (
                      <label
                        key={`${question.id}_${optionIndex}`}
                        className={`flex items-start gap-2 rounded-lg border px-3 py-2 cursor-pointer transition ${
                          assessmentAnswers[question.id] === optionIndex
                            ? "border-sky-500 bg-sky-50"
                            : "border-slate-200 bg-white hover:bg-slate-100"
                        }`}
                      >
                        <input
                          type="radio"
                          name={question.id}
                          checked={assessmentAnswers[question.id] === optionIndex}
                          onChange={() =>
                            setAssessmentAnswers((prev) => ({
                              ...prev,
                              [question.id]: optionIndex,
                            }))
                          }
                          className="mt-1"
                        />
                        <span className="text-sm text-slate-800">
                          {String.fromCharCode(65 + optionIndex)}. {option}
                        </span>
                      </label>
                    ))}
                  </div>
                </article>
              ))}
            </div>

            {assessmentStatus && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {assessmentStatus}
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-600">
                Answered {Object.keys(assessmentAnswers).length}/
                {assessmentAssignment.assessment_questions?.length ?? 0}
              </p>
              <button
                type="button"
                onClick={() => void submitAssessment()}
                disabled={
                  assessmentSubmitting ||
                  Object.keys(assessmentAnswers).length < (assessmentAssignment.assessment_questions?.length ?? 0)
                }
                className="rounded-lg border border-sky-700 bg-sky-700 px-4 py-2 text-sm font-semibold text-true-white hover:bg-sky-600 transition disabled:opacity-60"
              >
                {assessmentSubmitting ? "Submitting..." : "Submit Assessment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
