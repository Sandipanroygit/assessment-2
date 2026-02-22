"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { GuidedTour, type GuidedTourStep } from "@/components/GuidedTour";
import { playUiClickTone } from "@/lib/uiTone";

type ProgressRow = {
  id: string;
  module_id: string;
  submission_number: number;
  report_status: string | null;
  created_at: string | null;
  updated_at: string | null;
  user_id: string;
};

type ModuleRow = {
  id: string;
  title: string;
  grade: string;
  subject: string;
  published: boolean | null;
};

type StudentRow = {
  id: string;
  full_name: string;
  email?: string | null;
  grade?: string | null;
  subject?: string | null;
};

const TEACHER_PROGRESS_TOUR_STORAGE_KEY = "teacher_progress_feature_tour_v2";
const TEACHER_PROGRESS_TOUR_FORCE_KEY = "teacher_progress_tour_force_once_v2";
const TEACHER_PROGRESS_TOUR_CHAIN_KEY = "teacher_progress_tour_chain_meta_v2";
const TEACHER_DASHBOARD_TOUR_RESUME_KEY = "teacher_dashboard_tour_resume_v2";
const TEACHER_TOUR_PALETTE = {
  accent: "#2563eb",
  accentStrong: "#1e3a8a",
} as const;

export default function TeacherProgressPage() {
  const router = useRouter();
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [submissions, setSubmissions] = useState<ProgressRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [, startLoading] = useTransition();
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [reminderBanner, setReminderBanner] = useState<string | null>(null);
  const [tourRun, setTourRun] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [tourInitialized, setTourInitialized] = useState(false);
  const [tourDisplayOffset, setTourDisplayOffset] = useState(0);
  const [returnToDashboardAfterTour, setReturnToDashboardAfterTour] = useState(false);
  const [dashboardResumeStepId, setDashboardResumeStepId] = useState("menu-queries");
  const [tourDisplayTotalOverride, setTourDisplayTotalOverride] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? null;
      setSessionToken(token);
      if (!token) {
        setStatus("Please log in again.");
        return;
      }
      startLoading(async () => {
        setStatus("Loading progress...");
        const res = await fetch("/api/teacher/progress", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setStatus(body?.error ?? "Unable to load progress");
          return;
        }
        setModules(body.modules ?? []);
        setSubmissions(body.submissions ?? []);
        setStudents(body.students ?? []);
        setStatus(null);
      });
    };
    void load();
  }, []);

  const moduleOptions = useMemo(
    () => [{ id: "all", title: "- select module -" }, ...modules.map((m) => ({ id: m.id, title: m.title }))],
    [modules],
  );

  const filteredModule = useMemo(
    () => (moduleFilter === "all" ? null : modules.find((m) => m.id === moduleFilter) ?? null),
    [moduleFilter, modules],
  );

  const statusByModuleAndStudent = useMemo(() => {
    const map = new Map<string, string>();
    submissions.forEach((sub) => {
      const key = `${sub.module_id}::${sub.user_id}`;
      if (!map.has(key)) {
        map.set(key, (sub.report_status ?? "not submitted").toLowerCase());
      }
    });
    return map;
  }, [submissions]);

  const tourPreferredModuleId = useMemo(() => {
    if (modules.length === 0) return null;
    const moduleWithPending = modules.find((module) => {
      const scopedStudents = students.filter((student) => !module.grade || student.grade === module.grade);
      return scopedStudents.some((student) => {
        const key = `${module.id}::${student.id}`;
        const normalizedStatus = statusByModuleAndStudent.get(key) ?? "not submitted";
        return normalizedStatus === "not submitted";
      });
    });
    return (moduleWithPending ?? modules[0]).id;
  }, [modules, statusByModuleAndStudent, students]);

  const studentProgress = useMemo(() => {
    if (!filteredModule) return [];
    return students
      .filter((s) => !filteredModule || !filteredModule.grade || s.grade === filteredModule.grade)
      .map((student) => {
        const subs = submissions.filter(
          (sub) => sub.user_id === student.id && (!filteredModule || sub.module_id === filteredModule.id),
        );
        const latest = subs.reduce<string | null>((acc, s) => {
          if (!s.updated_at) return acc;
          if (!acc) return s.updated_at;
          return acc > s.updated_at ? acc : s.updated_at;
        }, null);
        const status = subs[0]?.report_status ?? "not submitted";
        return {
          ...student,
          attempts: subs.length,
          status,
          latest,
          moduleTitle: filteredModule ? filteredModule.title : modules.find((m) => m.id === subs[0]?.module_id)?.title,
        };
      });
  }, [filteredModule, modules, students, submissions]);

  const firstRemindableStudentId = useMemo(
    () => studentProgress.find((row) => row.status?.toLowerCase() === "not submitted")?.id ?? null,
    [studentProgress],
  );
  const sendReminder = useCallback(
    async (studentId: string, studentName: string, moduleId?: string | null, moduleTitle?: string | null, subject?: string | null) => {
      if (!sessionToken) {
        setStatus("Please log in again.");
        return;
      }
      try {
        setRemindingId(studentId);
        setReminderBanner(null);
        const res = await fetch("/api/teacher/reminders", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ studentId, moduleId, moduleTitle, subject }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setReminderBanner(body?.error ?? "Unable to send reminder");
          return;
        }
        setReminderBanner(`Reminder sent to ${studentName}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to send reminder";
        setReminderBanner(message);
      } finally {
        setRemindingId(null);
      }
    },
    [sessionToken],
  );

  const progressTourSteps = useMemo<GuidedTourStep[]>(() => {
    const steps: GuidedTourStep[] = [
      {
        id: "progress-header",
        target: '[data-tour="teacher-progress-header"]',
        title: "Student Progress Overview",
        description: "This page tracks module-level learner performance for your classroom.",
        placement: "bottom",
      },
      {
        id: "progress-module-select",
        target: '[data-tour="teacher-progress-module-select"]',
        title: "Select Module",
        description: "The tour auto-selects a module so you can immediately review progress and reminder actions.",
        placement: "bottom",
      },
      {
        id: "progress-table",
        target: '[data-tour="teacher-progress-table"]',
        title: "Progress Table",
        description: "Review learner-wise status, attempts, reminder actions, and update timestamps.",
        placement: "top",
      },
      {
        id: "progress-status-column",
        target: '[data-tour="teacher-progress-status-column"]',
        title: "Status Column",
        description: "Status chips indicate whether a learner is pending, submitted, completed, or not submitted.",
        placement: "bottom",
      },
      {
        id: "progress-reminder-column",
        target: '[data-tour="teacher-progress-reminder-column"]',
        title: "Reminder Action",
        description: "Use reminders to nudge learners who still have not submitted the selected module.",
        placement: "bottom",
      },
    ];

    if (firstRemindableStudentId) {
      steps.push({
        id: "progress-reminder-bell",
        target: '[data-tour="teacher-progress-reminder-bell"]',
        title: "Reminder Bell Notification",
        description: "Click this bell to send a reminder notification to the selected student.",
        placement: "left",
      });
    } else {
      steps.push({
        id: "progress-reminder-bell-fallback",
        target: '[data-tour="teacher-progress-reminder-column"]',
        title: "Reminder Bell Notification",
        description: "If no bell appears, choose a module where students are still marked as not submitted.",
        placement: "bottom",
      });
    }

    steps.push({
      id: "progress-back-dashboard",
      target: '[data-tour="teacher-progress-back-dashboard"]',
      title: "Return to Dashboard",
      description: "Use this button to go back to dashboard. The walkthrough will continue with Student Queries next.",
      placement: "bottom",
    });

    return steps;
  }, [firstRemindableStudentId]);

  const startTour = useCallback(() => {
    setTourDisplayOffset(0);
    setTourDisplayTotalOverride(null);
    setReturnToDashboardAfterTour(false);
    setTourStepIndex(0);
    setTourRun(true);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(TEACHER_PROGRESS_TOUR_STORAGE_KEY);
      window.localStorage.removeItem(TEACHER_PROGRESS_TOUR_CHAIN_KEY);
    }
  }, []);

  const closeTour = useCallback((completed: boolean) => {
    setTourRun(false);
    setTourStepIndex(0);
    setTourDisplayOffset(0);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TEACHER_PROGRESS_TOUR_STORAGE_KEY, completed ? "done" : "skipped");
      window.localStorage.removeItem(TEACHER_PROGRESS_TOUR_CHAIN_KEY);
    }
    if (returnToDashboardAfterTour && completed) {
      if (typeof window !== "undefined") {
        const displayTotal =
          tourDisplayTotalOverride ??
          (tourDisplayOffset > 0 ? tourDisplayOffset + progressTourSteps.length : undefined);
        window.localStorage.setItem(
          TEACHER_DASHBOARD_TOUR_RESUME_KEY,
          JSON.stringify({
            stepId: dashboardResumeStepId,
            displayOffset: tourDisplayOffset + progressTourSteps.length,
            displayTotal,
          }),
        );
      }
      setReturnToDashboardAfterTour(false);
      router.push("/customer");
      return;
    }
    setReturnToDashboardAfterTour(false);
    setDashboardResumeStepId("menu-queries");
    setTourDisplayTotalOverride(null);
  }, [
    dashboardResumeStepId,
    progressTourSteps.length,
    returnToDashboardAfterTour,
    router,
    tourDisplayOffset,
    tourDisplayTotalOverride,
  ]);

  const handleTourStepChange = useCallback(
    (nextStepIndex: number) => {
      if (nextStepIndex < 0) return;
      if (nextStepIndex >= progressTourSteps.length) {
        closeTour(true);
        return;
      }
      setTourStepIndex(nextStepIndex);
    },
    [closeTour, progressTourSteps.length],
  );

  useEffect(() => {
    if (!tourRun) return;
    if (progressTourSteps.length === 0) {
      closeTour(false);
      return;
    }
    if (tourStepIndex >= progressTourSteps.length) {
      setTourStepIndex(Math.max(0, progressTourSteps.length - 1));
    }
  }, [closeTour, progressTourSteps.length, tourRun, tourStepIndex]);

  useEffect(() => {
    if (!tourRun) return;
    const stepId = progressTourSteps[tourStepIndex]?.id;
    if (!stepId) return;
    const moduleRequiredSteps = new Set([
      "progress-module-select",
      "progress-table",
      "progress-status-column",
      "progress-reminder-column",
      "progress-reminder-bell",
      "progress-reminder-bell-fallback",
    ]);
    if (!moduleRequiredSteps.has(stepId)) return;
    if (!tourPreferredModuleId) return;
    if (moduleFilter !== tourPreferredModuleId) {
      setModuleFilter(tourPreferredModuleId);
    }
  }, [moduleFilter, progressTourSteps, tourPreferredModuleId, tourRun, tourStepIndex]);

  useEffect(() => {
    if (tourInitialized) return;
    if (status === "Loading progress...") return;
    if (typeof window === "undefined") return;

    const forcedFromDashboard =
      window.localStorage.getItem(TEACHER_PROGRESS_TOUR_FORCE_KEY) === "1";
    const rawMeta = window.localStorage.getItem(TEACHER_PROGRESS_TOUR_CHAIN_KEY);
    const chainedFromDashboard = forcedFromDashboard || !!rawMeta;
    if (forcedFromDashboard) {
      window.localStorage.removeItem(TEACHER_PROGRESS_TOUR_FORCE_KEY);
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
        setDashboardResumeStepId("menu-queries");
        setTourDisplayTotalOverride(null);
      }
    }
    const seen = window.localStorage.getItem(TEACHER_PROGRESS_TOUR_STORAGE_KEY);
    if (chainedFromDashboard || !seen) {
      setTourStepIndex(0);
      setTourRun(true);
    }
    setTourInitialized(true);
  }, [status, tourInitialized]);

  const tourDisplayTotal = useMemo(
    () =>
      tourDisplayTotalOverride ??
      (tourDisplayOffset > 0 ? tourDisplayOffset + progressTourSteps.length : undefined),
    [tourDisplayOffset, progressTourSteps.length, tourDisplayTotalOverride],
  );

  return (
    <main className="section-padding space-y-8">
      <GuidedTour
        run={tourRun}
        stepIndex={tourStepIndex}
        steps={progressTourSteps}
        onStepIndexChange={handleTourStepChange}
        onClose={closeTour}
        displayStepOffset={tourDisplayOffset > 0 ? tourDisplayOffset : undefined}
        displayStepTotal={tourDisplayTotal}
        palette={TEACHER_TOUR_PALETTE}
      />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div data-tour="teacher-progress-header">
          <p className="text-accent-strong uppercase text-xs tracking-[0.2em]">Teacher</p>
          <h1 className="text-3xl font-semibold text-white">Student progress</h1>
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
            data-tour="teacher-progress-back-dashboard"
            className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-sm !text-white hover:!text-white visited:!text-white font-semibold shadow-md ring-1 ring-white/10 hover:-translate-y-0.5 transition-transform duration-150"
          >
            Back to dashboard
          </Link>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-4 flex flex-wrap gap-3 items-center" data-tour="teacher-progress-filter-panel">
        <label className="text-sm text-slate-200 space-y-1">
          Module
          <select
            data-tour="teacher-progress-module-select"
            className="w-full rounded-lg bg-white/5 border border-slate-400/60 px-3 py-2"
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
          >
            {moduleOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.title}
              </option>
            ))}
          </select>
        </label>
        {status && (
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-amber-200">{status}</div>
        )}
        {reminderBanner && (
          <div className="rounded-xl border border-emerald-300/40 bg-emerald-700/30 px-3 py-2 text-sm text-emerald-100">
            {reminderBanner}
          </div>
        )}
      </div>
      <div className="glass-panel rounded-2xl p-4 overflow-auto" data-tour="teacher-progress-table">
        <table className="table-v1">
          <thead>
            <tr className="text-left text-slate-400 border-b border-white/10">
              <th className="py-2 pr-3">Student</th>
              <th className="py-2 pr-3">Grade</th>
              <th className="py-2 pr-3" data-tour="teacher-progress-status-column">Status</th>
              <th className="py-2 pr-3" data-tour="teacher-progress-reminder-column">Reminder</th>
              <th className="py-2 pr-3">Attempts</th>
              <th className="py-2 pr-3">Last updated</th>
            </tr>
          </thead>
          <tbody>
            {studentProgress.length === 0 ? (
              <tr>
                <td className="py-3 pr-3 text-slate-300" colSpan={6}>
                  {filteredModule ? "No students found for this subject/grade yet." : "Select module"}
                </td>
              </tr>
            ) : (
              studentProgress.map((row) => (
                <tr key={row.id} className="border-b border-white/5">
                  <td className="py-2 pr-3 font-semibold text-white">{row.full_name}</td>
                  <td className="py-2 pr-3 text-slate-300">{row.grade ?? "-"}</td>
                  <td className="py-2 pr-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs !text-white ${
                        (() => {
                          const normalized = (row.status ?? "").toLowerCase();
                          const isSubmitted = normalized === "submitted" || normalized === "report ready";
                          const isNotSubmitted = normalized === "not submitted";
                          const bg =
                            normalized === "completed" || isSubmitted
                              ? "bg-emerald-600"
                              : normalized === "pending"
                                ? "bg-amber-600"
                                : isNotSubmitted
                                  ? "bg-rose-700"
                                  : "bg-slate-600";
                          const weight = isSubmitted || isNotSubmitted ? "font-semibold" : "";
                          return [bg, weight].filter(Boolean).join(" ");
                        })()
                      }`}
                    >
                      {row.status?.toLowerCase() === "report ready" ? "submitted" : row.status}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    {row.status?.toLowerCase() === "not submitted" ? (
                      <button
                        data-tour={
                          row.id === firstRemindableStudentId ? "teacher-progress-reminder-bell" : undefined
                        }
                        className="h-8 w-8 rounded-full bg-amber-500 text-slate-900 text-xs font-semibold border border-amber-300 hover:bg-amber-400 disabled:opacity-50 inline-flex items-center justify-center"
                        onClick={() =>
                          void sendReminder(
                            row.id,
                            row.full_name,
                            filteredModule?.id ?? null,
                            filteredModule?.title ?? row.moduleTitle ?? null,
                            filteredModule?.subject ?? row.subject ?? null
                          )
                        }
                        disabled={remindingId === row.id}
                        aria-label="Send reminder"
                      >
                        {remindingId === row.id ? (
                          <span className="text-[10px] font-semibold">...</span>
                        ) : (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="h-4 w-4"
                          >
                            <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.172V11a6 6 0 1 0-12 0v3.172a2 2 0 0 1-.6 1.428L4 17h5" />
                            <path d="M9 17a3 3 0 0 0 6 0" />
                          </svg>
                        )}
                        <span className="sr-only">Send reminder</span>
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-slate-300">{row.attempts}</td>
                  <td className="py-2 pr-3 text-slate-300">
                    {row.latest ? new Date(row.latest).toLocaleString() : "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

