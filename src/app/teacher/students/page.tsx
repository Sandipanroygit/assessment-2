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
  const [fullName, setFullName] = useState("Teacher");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
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
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token ?? null;
        if (data.session?.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", data.session.user.id)
            .maybeSingle();
          setFullName(profile?.full_name || data.session.user.user_metadata?.full_name || data.session.user.email || "Teacher");
        }
        if (!token) {
          setStatus("Please log in again.");
          setIsInitialLoading(false);
          return;
        }
        startLoading(() => {
          void (async () => {
            setStatus("Loading students...");
            try {
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
            } catch (err) {
              const message = err instanceof Error ? err.message : "Unable to load students";
              setStatus(message);
            } finally {
              setIsInitialLoading(false);
            }
          })();
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load students";
        setStatus(message);
        setIsInitialLoading(false);
      }
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

  const closeTour = useCallback(
    (completed: boolean) => {
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
    },
    [
      dashboardResumeStepId,
      returnToDashboardAfterTour,
      router,
      studentTourSteps.length,
      tourDisplayOffset,
      tourDisplayTotalOverride,
    ],
  );

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
    if (isInitialLoading) return;
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
  }, [isInitialLoading, tourInitialized]);

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

      <div
        className="sticky top-0 z-30 isolate -mx-[clamp(1.25rem,4vw,4rem)] -mt-[clamp(2rem,4vw,3.5rem)] space-y-3 overflow-visible rounded-none border border-white/35 bg-white/30 supports-[backdrop-filter]:bg-white/16 px-3 pb-3 pt-[clamp(2rem,4vw,3.5rem)] shadow-[0_26px_56px_rgba(15,23,42,0.24)] backdrop-blur-3xl backdrop-saturate-150"
      >
        <div
          className="relative z-20 rounded-none border border-white/28 bg-white/35 supports-[backdrop-filter]:bg-white/20 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.16)] backdrop-blur-2xl"
          data-tour="teacher-students-header"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-accent-strong">Teacher</p>
              <h1 className="text-3xl font-semibold text-white leading-tight">Hi {fullName}</h1>
              <p className="text-slate-300 text-sm">Managing Registered Students</p>
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
                className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-sm !text-white hover:!text-white visited:!text-white font-semibold shadow-md ring-1 ring-white/10 hover:-translate-y-0.5 transition-transform duration-150"
              >
                Back to dashboard
              </Link>
            </div>
          </div>
        </div>

        <section className="relative z-10 rounded-none border border-white/28 bg-white/35 supports-[backdrop-filter]:bg-white/20 p-2.5 shadow-[0_12px_26px_rgba(15,23,42,0.14)] backdrop-blur-2xl">
          <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Link
              href="/teacher/students"
              className="group relative shrink-0 inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-all bg-accent text-true-white border-accent-strong/40 shadow-glow hover:-translate-y-0.5"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-accent-strong/90 text-true-white">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-4 w-4">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </span>
              Class Roster
            </Link>
          </div>
        </section>
      </div>

      {isInitialLoading ? (
        <>
          <div className="glass-panel rounded-2xl p-4 flex flex-wrap gap-3 items-center">
            <div className="h-4 w-24 rounded bg-white/15 animate-pulse" />
            <div className="h-10 w-44 rounded-lg bg-white/10 animate-pulse" />
            <div className="h-10 w-32 rounded-lg bg-white/10 animate-pulse" />
          </div>

          <div className="glass-panel rounded-2xl p-4 overflow-auto">
            <div className="space-y-3 min-w-[640px]">
              <div className="grid grid-cols-4 gap-3">
                <div className="h-4 rounded bg-white/10 animate-pulse" />
                <div className="h-4 rounded bg-white/10 animate-pulse" />
                <div className="h-4 rounded bg-white/10 animate-pulse" />
                <div className="h-4 rounded bg-white/10 animate-pulse" />
              </div>
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={`students-skeleton-${index}`} className="grid grid-cols-4 gap-3">
                  <div className="h-4 rounded bg-white/10 animate-pulse" />
                  <div className="h-4 rounded bg-white/10 animate-pulse" />
                  <div className="h-4 rounded bg-white/10 animate-pulse" />
                  <div className="h-4 rounded bg-white/10 animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
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
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-amber-200">
                {status}
              </div>
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
        </>
      )}
    </main>
  );
}
