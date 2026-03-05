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

type AssignedSimulation = {
  id: string;
  teacher_name: string;
  target_grade: string;
  subject?: string | null;
  simulation_title: string;
  simulation_url: string;
  notes?: string | null;
  created_at?: string | null;
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

  return (
    <main className="min-h-screen section-padding space-y-6">
      <div className="glass-panel rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Library</p>
          <h1 className="text-2xl font-semibold text-slate-900">Simulations</h1>
          {isTeacher && (
            <p className="mt-1 text-xs text-slate-600">
              Click <span className="font-semibold">Assign</span> on any row to open the grade assignment popup here.
            </p>
          )}
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
                ring: studentAssignments.length > 0,
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
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Refresh
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setStudentAssignmentsOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="overflow-auto space-y-3 pr-1 max-h-[66vh]">
              {studentAssignments.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  No assigned simulations yet.
                </div>
              ) : (
                studentAssignments.map((assignment) => (
                  <article key={assignment.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{assignment.simulation_title}</p>
                    </div>
                    <p className="text-xs text-slate-600">
                      Teacher: {assignment.teacher_name}
                      {assignment.subject ? ` | ${assignment.subject}` : ""}
                    </p>
                    {assignment.notes && <p className="text-xs text-slate-700">{assignment.notes}</p>}
                    <div>
                      <a
                        href={assignment.simulation_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center rounded-lg border border-emerald-700 bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-true-white hover:bg-emerald-600 transition"
                      >
                        Open simulation
                      </a>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
