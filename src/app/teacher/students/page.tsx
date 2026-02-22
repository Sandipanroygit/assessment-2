"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { GuidedTour, type GuidedTourStep } from "@/components/GuidedTour";
import { playUiClickTone } from "@/lib/uiTone";

type StudentRow = {
  id: string;
  full_name: string;
  email?: string | null;
  grade?: string | null;
  subject?: string | null;
  joined_at?: string | null;
};

type SortField = "name" | "grade" | "joined";

const TEACHER_STUDENTS_TOUR_STORAGE_KEY = "teacher_students_feature_tour_v2";
const TEACHER_STUDENTS_TOUR_FORCE_KEY = "teacher_students_tour_force_once_v2";
const TEACHER_STUDENTS_TOUR_CHAIN_KEY = "teacher_students_tour_chain_meta_v2";
const TEACHER_DASHBOARD_TOUR_RESUME_KEY = "teacher_dashboard_tour_resume_v2";
const TEACHER_TOUR_PALETTE = {
  accent: "#2563eb",
  accentStrong: "#1e3a8a",
} as const;

function formatJoinedDate(value?: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString();
}

export default function TeacherStudentsPage() {
  const router = useRouter();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [, startLoading] = useTransition();
  const [sortField, setSortField] = useState<SortField>("grade");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [tourRun, setTourRun] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [tourInitialized, setTourInitialized] = useState(false);
  const [tourDisplayOffset, setTourDisplayOffset] = useState(0);
  const [returnToDashboardAfterTour, setReturnToDashboardAfterTour] = useState(false);
  const [dashboardResumeStepId, setDashboardResumeStepId] = useState("menu-signout");
  const [tourDisplayTotalOverride, setTourDisplayTotalOverride] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? null;
      if (!token) {
        setStatus("Please log in again.");
        return;
      }
      startLoading(async () => {
        setStatus("Loading students...");
        const res = await fetch("/api/teacher/students", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setStatus(body?.error ?? "Unable to load students");
          return;
        }
        setStudents(body.students ?? []);
        setStatus(null);
      });
    };
    void load();
  }, []);

  const sortedStudents = useMemo(() => {
    const copy = [...students];
    copy.sort((a, b) => {
      const direction = sortDir === "asc" ? 1 : -1;

      if (sortField === "name") {
        const aName = (a.full_name ?? "").trim();
        const bName = (b.full_name ?? "").trim();
        if (!aName && !bName) return 0;
        if (!aName) return 1;
        if (!bName) return -1;
        return aName.localeCompare(bName, undefined, { sensitivity: "base", numeric: true }) * direction;
      }

      if (sortField === "joined") {
        const aTime = a.joined_at ? Date.parse(a.joined_at) : Number.NaN;
        const bTime = b.joined_at ? Date.parse(b.joined_at) : Number.NaN;
        const aMissing = Number.isNaN(aTime);
        const bMissing = Number.isNaN(bTime);
        if (aMissing && bMissing) return 0;
        if (aMissing) return 1;
        if (bMissing) return -1;
        return (aTime - bTime) * direction;
      }

      const aGrade = (a.grade ?? "").trim();
      const bGrade = (b.grade ?? "").trim();
      if (!aGrade && !bGrade) return 0;
      if (!aGrade) return 1;
      if (!bGrade) return -1;
      return aGrade.localeCompare(bGrade, undefined, { sensitivity: "base", numeric: true }) * direction;
    });
    return copy;
  }, [students, sortDir, sortField]);

  const sortDirectionLabel = useMemo(() => {
    if (sortField === "joined") return sortDir === "asc" ? "Oldest-Newest" : "Newest-Oldest";
    return sortDir === "asc" ? "A-Z" : "Z-A";
  }, [sortDir, sortField]);

  const studentTourSteps = useMemo<GuidedTourStep[]>(
    () => [
      {
        id: "students-header",
        target: '[data-tour="teacher-students-header"]',
        title: "Registered Students",
        description: "Use this page to review your subject-matched class roster.",
        placement: "bottom",
      },
      {
        id: "students-controls",
        target: '[data-tour="teacher-students-controls"]',
        title: "Roster Controls",
        description: "Track total students and control sorting from this top panel.",
        placement: "bottom",
      },
      {
        id: "students-sort-field",
        target: '[data-tour="teacher-students-sort-field"]',
        title: "Sort By",
        description: "Sort the roster by name, grade, or join date.",
        placement: "bottom",
      },
      {
        id: "students-sort-order",
        target: '[data-tour="teacher-students-sort-order"]',
        title: "Order Direction",
        description: "Toggle ascending or descending ordering for the selected sort mode.",
        placement: "bottom",
      },
      {
        id: "students-table",
        target: '[data-tour="teacher-students-table"]',
        title: "Students Table",
        description: "View profile basics such as email, grade, and enrollment date for planning.",
        placement: "top",
      },
    ],
    [],
  );

  const startTour = useCallback(() => {
    setTourDisplayOffset(0);
    setTourDisplayTotalOverride(null);
    setReturnToDashboardAfterTour(false);
    setDashboardResumeStepId("menu-signout");
    setTourStepIndex(0);
    setTourRun(true);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(TEACHER_STUDENTS_TOUR_STORAGE_KEY);
      window.localStorage.removeItem(TEACHER_STUDENTS_TOUR_CHAIN_KEY);
    }
  }, []);

  const closeTour = useCallback((completed: boolean) => {
    setTourRun(false);
    setTourStepIndex(0);
    setTourDisplayOffset(0);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TEACHER_STUDENTS_TOUR_STORAGE_KEY, completed ? "done" : "skipped");
      window.localStorage.removeItem(TEACHER_STUDENTS_TOUR_CHAIN_KEY);
    }
    if (returnToDashboardAfterTour && completed) {
      if (typeof window !== "undefined") {
        const displayTotal =
          tourDisplayTotalOverride ??
          (tourDisplayOffset > 0 ? tourDisplayOffset + studentTourSteps.length : undefined);
        window.localStorage.setItem(
          TEACHER_DASHBOARD_TOUR_RESUME_KEY,
          JSON.stringify({
            stepId: dashboardResumeStepId,
            displayOffset: tourDisplayOffset + studentTourSteps.length,
            displayTotal,
          }),
        );
      }
      setReturnToDashboardAfterTour(false);
      router.push("/customer");
      return;
    }
    setReturnToDashboardAfterTour(false);
    setDashboardResumeStepId("menu-signout");
    setTourDisplayTotalOverride(null);
  }, [
    dashboardResumeStepId,
    returnToDashboardAfterTour,
    router,
    studentTourSteps.length,
    tourDisplayOffset,
    tourDisplayTotalOverride,
  ]);

  const handleTourStepChange = useCallback(
    (nextStepIndex: number) => {
      if (nextStepIndex < 0) return;
      if (nextStepIndex >= studentTourSteps.length) {
        closeTour(true);
        return;
      }
      setTourStepIndex(nextStepIndex);
    },
    [closeTour, studentTourSteps.length],
  );

  useEffect(() => {
    if (!tourRun) return;
    if (studentTourSteps.length === 0) {
      closeTour(false);
      return;
    }
    if (tourStepIndex >= studentTourSteps.length) {
      setTourStepIndex(Math.max(0, studentTourSteps.length - 1));
    }
  }, [closeTour, studentTourSteps.length, tourRun, tourStepIndex]);

  useEffect(() => {
    if (tourInitialized) return;
    if (status === "Loading students...") return;
    if (typeof window === "undefined") return;

    const forcedFromDashboard =
      window.localStorage.getItem(TEACHER_STUDENTS_TOUR_FORCE_KEY) === "1";
    const rawMeta = window.localStorage.getItem(TEACHER_STUDENTS_TOUR_CHAIN_KEY);
    const chainedFromDashboard = forcedFromDashboard || !!rawMeta;
    if (forcedFromDashboard) {
      window.localStorage.removeItem(TEACHER_STUDENTS_TOUR_FORCE_KEY);
    }
    if (rawMeta) {
      try {
        const meta = JSON.parse(rawMeta) as {
          offset?: unknown;
          returnToDashboard?: unknown;
          resumeStepId?: unknown;
          total?: unknown;
        };
        if (typeof meta.offset === "number" && Number.isFinite(meta.offset) && meta.offset > 0) {
          setTourDisplayOffset(meta.offset);
        }
        setReturnToDashboardAfterTour(meta.returnToDashboard === true);
        if (typeof meta.resumeStepId === "string" && meta.resumeStepId.trim().length > 0) {
          setDashboardResumeStepId(meta.resumeStepId);
        }
        if (typeof meta.total === "number" && Number.isFinite(meta.total) && meta.total > 0) {
          setTourDisplayTotalOverride(meta.total);
        } else {
          setTourDisplayTotalOverride(null);
        }
      } catch {
        setTourDisplayOffset(0);
        setReturnToDashboardAfterTour(false);
        setDashboardResumeStepId("menu-signout");
        setTourDisplayTotalOverride(null);
      }
    }

    const seen = window.localStorage.getItem(TEACHER_STUDENTS_TOUR_STORAGE_KEY);
    if (chainedFromDashboard || !seen) {
      setTourStepIndex(0);
      setTourRun(true);
    }
    setTourInitialized(true);
  }, [status, tourInitialized]);

  const tourDisplayTotal = useMemo(
    () =>
      tourDisplayTotalOverride ??
      (tourDisplayOffset > 0 ? tourDisplayOffset + studentTourSteps.length : undefined),
    [studentTourSteps.length, tourDisplayOffset, tourDisplayTotalOverride],
  );

  return (
    <main className="section-padding space-y-8">
      <GuidedTour
        run={tourRun}
        stepIndex={tourStepIndex}
        steps={studentTourSteps}
        onStepIndexChange={handleTourStepChange}
        onClose={closeTour}
        displayStepOffset={tourDisplayOffset > 0 ? tourDisplayOffset : undefined}
        displayStepTotal={tourDisplayTotal}
        palette={TEACHER_TOUR_PALETTE}
      />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div data-tour="teacher-students-header">
          <p className="text-accent-strong uppercase text-xs tracking-[0.2em]">Teacher</p>
          <h1 className="text-3xl font-semibold text-white">Registered students</h1>
          <p className="text-slate-300 text-sm">Subject-matched students for your classes.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void playUiClickTone();
              startTour();
            }}
            className="px-4 py-2 rounded-xl border border-cyan-300/70 bg-cyan-500/10 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/20"
          >
            Take tour
          </button>
          <Link
            href="/customer"
            className="px-4 py-2 rounded-xl border border-accent bg-accent outline outline-1 outline-black text-sm text-true-white shadow-glow hover:opacity-90"
          >
            Back to dashboard
          </Link>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-4 flex flex-wrap gap-3 items-center" data-tour="teacher-students-controls">
        <div className="text-sm text-slate-300">Students: {students.length}</div>
        <label className="inline-flex items-center gap-2 text-sm text-slate-300">
          Sort by
          <select
            data-tour="teacher-students-sort-field"
            className="rounded-lg bg-accent border border-accent-strong px-3 py-2 text-sm text-true-white shadow-glow"
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
          >
            <option value="name">Name</option>
            <option value="grade">Grade</option>
            <option value="joined">Date joined</option>
          </select>
        </label>
        <button
          data-tour="teacher-students-sort-order"
          className="px-3 py-2 rounded-lg border border-accent bg-accent text-sm text-true-white shadow-glow hover:opacity-90"
          onClick={() => setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))}
        >
          Order ({sortDirectionLabel})
        </button>
        {status && (
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-amber-200">{status}</div>
        )}
      </div>

      <div className="glass-panel rounded-2xl p-4 overflow-auto" data-tour="teacher-students-table">
        <table className="table-v1">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Grade</th>
              <th>Date joined</th>
            </tr>
          </thead>
          <tbody>
            {sortedStudents.length === 0 ? (
              <tr>
                <td colSpan={4}>No students found for this subject yet.</td>
              </tr>
            ) : (
              sortedStudents.map((student) => (
                <tr key={student.id}>
                  <td className="font-semibold text-white">{student.full_name}</td>
                  <td className="text-slate-300">{student.email ?? "--"}</td>
                  <td className="text-slate-300">{student.grade ?? "--"}</td>
                  <td className="text-slate-300">{formatJoinedDate(student.joined_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
