"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { GuidedTour, type GuidedTourStep } from "@/components/GuidedTour";
import { playUiClickTone } from "@/lib/uiTone";
import {
  areGuidedToursEnabled,
  GUIDED_TOURS_ENABLED_KEY,
  GUIDED_TOURS_TOGGLE_EVENT,
} from "@/lib/tourControls";

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
  due_at?: string | null;
};

type StudentRow = {
  id: string;
  full_name: string;
  email?: string | null;
  grade?: string | null;
  subject?: string | null;
};

type SimulationAssignmentRow = {
  id: string;
  teacher_id: string;
  teacher_name: string;
  target_grade: string;
  target_grade_key?: string | null;
  subject?: string | null;
  simulation_title: string;
  simulation_url: string;
  notes?: string | null;
  due_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type SimulationProgressRow = {
  assignment_id: string;
  student_id: string;
  student_name?: string | null;
  student_grade?: string | null;
  status?: string | null;
  viewed_at?: string | null;
  assessment_score?: number | null;
  assessment_total?: number | null;
  assessment_submitted_at?: string | null;
  updated_at?: string | null;
};

type SteamhAssignmentRow = {
  id: string;
  student_id: string;
  student_name: string;
  title: string;
  subject?: string | null;
  grade?: string | null;
  due_at: string;
  submitted_at?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type ProgressTrack = "drone" | "simulation" | "steamh";

const normalizeGradeKey = (value?: string | null) =>
  (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/grade/gi, "")
    .replace(/[^a-z0-9]+/g, "");
const normalizeApprovalStatus = (value: unknown) =>
  typeof value === "string" && value.trim().toLowerCase() === "approved" ? "approved" : "pending";

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
  const [fullName, setFullName] = useState("Teacher");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [submissions, setSubmissions] = useState<ProgressRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [simulationAssignments, setSimulationAssignments] = useState<SimulationAssignmentRow[]>([]);
  const [simulationProgressRows, setSimulationProgressRows] = useState<SimulationProgressRow[]>([]);
  const [steamhAssignments, setSteamhAssignments] = useState<SteamhAssignmentRow[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [, startLoading] = useTransition();
  const [progressTrack, setProgressTrack] = useState<ProgressTrack>("drone");
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [simulationFilter, setSimulationFilter] = useState<string>("all");
  const [steamhFilter, setSteamhFilter] = useState<string>("all");
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [reminderBanner, setReminderBanner] = useState<string | null>(null);
  const [tourRun, setTourRun] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [tourInitialized, setTourInitialized] = useState(false);
  const [tourDisplayOffset, setTourDisplayOffset] = useState(0);
  const [returnToDashboardAfterTour, setReturnToDashboardAfterTour] = useState(false);
  const [dashboardResumeStepId, setDashboardResumeStepId] = useState("menu-queries");
  const [tourDisplayTotalOverride, setTourDisplayTotalOverride] = useState<number | null>(null);
  const [guidedToursEnabled, setGuidedToursEnabled] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => setGuidedToursEnabled(areGuidedToursEnabled());
    sync();
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === GUIDED_TOURS_ENABLED_KEY) sync();
    };
    const onToggle = () => sync();
    window.addEventListener("storage", onStorage);
    window.addEventListener(GUIDED_TOURS_TOGGLE_EVENT, onToggle as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(GUIDED_TOURS_TOGGLE_EVENT, onToggle as EventListener);
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token ?? null;
        setSessionToken(token);
        if (session?.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, approval_status")
            .eq("id", session.user.id)
            .maybeSingle();
          if (normalizeApprovalStatus(profile?.approval_status ?? session.user.user_metadata?.approval_status) !== "approved") {
            await supabase.auth.signOut();
            router.replace("/login?reason=pending");
            return;
          }
          setFullName(profile?.full_name || session.user.user_metadata?.full_name || session.user.email || "Teacher");
        }
        if (!token) {
          setStatus("Please log in again.");
          setIsInitialLoading(false);
          return;
        }
        startLoading(() => {
          void (async () => {
            setStatus("Loading progress...");
            try {
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
              setSimulationAssignments(body.simulationAssignments ?? []);
              setSimulationProgressRows(body.simulationProgress ?? []);
              setSteamhAssignments(body.steamhAssignments ?? []);
              setStatus(null);
            } catch (err) {
              const message = err instanceof Error ? err.message : "Unable to load progress";
              setStatus(message);
            } finally {
              setIsInitialLoading(false);
            }
          })();
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load progress";
        setStatus(message);
        setIsInitialLoading(false);
      }
    };
    void load();
  }, []);

  const moduleOptions = useMemo(
    () => [{ id: "all", title: "All Modules" }, ...modules.map((m) => ({ id: m.id, title: m.title }))],
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
    return students
      .filter((s) => !filteredModule || !filteredModule.grade || s.grade === filteredModule.grade)
      .map((student) => {
        const subs = submissions.filter(
          (sub) => sub.user_id === student.id && (!filteredModule || sub.module_id === filteredModule.id),
        );
        const latest = subs.reduce<string | null>((acc, s) => {
          if (!s.updated_at) return acc;
          if (!acc) return s.updated_at;
          return s.updated_at > acc ? s.updated_at : acc;
        }, null);

        let status = "Not Submitted";
        if (subs.length > 0) {
          const hasSubmitted = subs.some(s => 
            ["completed", "submitted", "report ready"].includes(s.report_status?.toLowerCase() ?? "")
          );
          status = hasSubmitted ? "Submitted" : "Not Submitted";
        }

        return {
          ...student,
          attempts: subs.length,
          status: filteredModule 
            ? (["completed", "submitted", "report ready"].includes(subs[0]?.report_status?.toLowerCase() ?? "") ? "Submitted" : "Not Submitted") 
            : status,
          latest,
          moduleTitle: filteredModule ? filteredModule.title : "All Modules",
        };
      });
  }, [filteredModule, modules, students, submissions]);

  const simulationProgressByAssignmentAndStudent = useMemo(() => {
    const map = new Map<string, SimulationProgressRow>();
    simulationProgressRows.forEach((row) => {
      const key = `${row.assignment_id}::${row.student_id}`;
      map.set(key, row);
    });
    return map;
  }, [simulationProgressRows]);

  const simulationStudentProgressRows = useMemo(() => {
    const rows: Array<{
      id: string;
      simulationTitle: string;
      simulationSubject: string | null;
      targetGrade: string;
      studentId: string;
      studentName: string;
      studentGrade: string | null;
      dueAt: string | null;
      status: "Submitted" | "Not Submitted";
      assessmentScore: number | null;
      assessmentTotal: number | null;
      assessmentSubmittedAt: string | null;
      viewedAt: string | null;
    }> = [];

    simulationAssignments.forEach((assignment) => {
      const gradeKey = normalizeGradeKey(assignment.target_grade_key || assignment.target_grade);
      const targetStudents = students.filter(
        (student) => normalizeGradeKey(student.grade) === gradeKey,
      );
      targetStudents.forEach((student) => {
        const progress =
          simulationProgressByAssignmentAndStudent.get(`${assignment.id}::${student.id}`) ?? null;
        const viewedAt = progress?.viewed_at ?? null;
        const assessmentSubmittedAt = progress?.assessment_submitted_at ?? null;
        const assessmentScore =
          typeof progress?.assessment_score === "number" && Number.isFinite(progress.assessment_score)
            ? progress.assessment_score
            : null;
        const assessmentTotal =
          typeof progress?.assessment_total === "number" && Number.isFinite(progress.assessment_total)
            ? progress.assessment_total
            : null;
        const isSubmitted = Boolean(assessmentSubmittedAt) || progress?.status?.toLowerCase() === "completed" || progress?.status?.toLowerCase() === "viewed" || Boolean(viewedAt);
        
        rows.push({
          id: `${assignment.id}::${student.id}`,
          simulationTitle: assignment.simulation_title,
          simulationSubject: assignment.subject ?? null,
          targetGrade: assignment.target_grade,
          studentId: student.id,
          studentName: student.full_name,
          studentGrade: student.grade ?? null,
          dueAt: assignment.due_at ?? null,
          status: isSubmitted ? "Submitted" : "Not Submitted",
          assessmentScore,
          assessmentTotal,
          assessmentSubmittedAt,
          viewedAt,
        });
      });
    });

    return rows.sort((a, b) => {
      const aDue = Date.parse(a.dueAt ?? "");
      const bDue = Date.parse(b.dueAt ?? "");
      const aDueComparable = Number.isNaN(aDue) ? Number.MAX_SAFE_INTEGER : aDue;
      const bDueComparable = Number.isNaN(bDue) ? Number.MAX_SAFE_INTEGER : bDue;
      if (aDueComparable !== bDueComparable) return aDueComparable - bDueComparable;
      const titleCompare = a.simulationTitle.localeCompare(b.simulationTitle, undefined, { sensitivity: "base" });
      if (titleCompare !== 0) return titleCompare;
      return a.studentName.localeCompare(b.studentName, undefined, { sensitivity: "base" });
    });
  }, [simulationAssignments, simulationProgressByAssignmentAndStudent, students]);

  const steamhProgressRows = useMemo(
    () =>
      [...steamhAssignments].sort((a, b) => {
        const aDue = Date.parse(a.due_at);
        const bDue = Date.parse(b.due_at);
        const aDueComparable = Number.isNaN(aDue) ? Number.MAX_SAFE_INTEGER : aDue;
        const bDueComparable = Number.isNaN(bDue) ? Number.MAX_SAFE_INTEGER : bDue;
        if (aDueComparable !== bDueComparable) return aDueComparable - bDueComparable;
        const aCreated = Date.parse(a.created_at ?? "");
        const bCreated = Date.parse(b.created_at ?? "");
        return (Number.isNaN(bCreated) ? 0 : bCreated) - (Number.isNaN(aCreated) ? 0 : aCreated);
      }),
    [steamhAssignments],
  );

  const simulationOptions = useMemo(() => {
    const uniqueTitles = new Set<string>();
    simulationAssignments.forEach((a) => uniqueTitles.add(a.simulation_title));
    return ["all", ...Array.from(uniqueTitles).sort()];
  }, [simulationAssignments]);

  const filteredSimulationProgressRows = useMemo(() => {
    if (simulationFilter === "all") return simulationStudentProgressRows;
    return simulationStudentProgressRows.filter((row) => row.simulationTitle === simulationFilter);
  }, [simulationFilter, simulationStudentProgressRows]);

  const steamhOptions = useMemo(() => {
    const uniqueTitles = new Set<string>();
    steamhAssignments.forEach((a) => uniqueTitles.add(a.title));
    return ["all", ...Array.from(uniqueTitles).sort()];
  }, [steamhAssignments]);

  const filteredSteamhProgressRows = useMemo(() => {
    if (steamhFilter === "all") return steamhProgressRows;
    return steamhProgressRows.filter((row) => row.title === steamhFilter);
  }, [steamhFilter, steamhProgressRows]);

  const firstRemindableStudentId = useMemo(
    () => studentProgress.find((row) => row.status === "Not Submitted")?.id ?? null,
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
        description: "Status chips indicate whether a learner has submitted or not submitted the work.",
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
        description: "If no bell appears, choose a module where students are still marked as Not Submitted.",
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
    if (!guidedToursEnabled) return;
    setTourDisplayOffset(0);
    setTourDisplayTotalOverride(null);
    setReturnToDashboardAfterTour(false);
    setTourStepIndex(0);
    setTourRun(true);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(TEACHER_PROGRESS_TOUR_STORAGE_KEY);
      window.localStorage.removeItem(TEACHER_PROGRESS_TOUR_CHAIN_KEY);
    }
  }, [guidedToursEnabled]);

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
    if (progressTrack !== "drone") {
      setProgressTrack("drone");
    }
    if (!tourPreferredModuleId) return;
    if (moduleFilter !== tourPreferredModuleId) {
      setModuleFilter(tourPreferredModuleId);
    }
  }, [moduleFilter, progressTourSteps, progressTrack, tourPreferredModuleId, tourRun, tourStepIndex]);

  useEffect(() => {
    if (tourInitialized) return;
    if (isInitialLoading) return;
    if (typeof window === "undefined") return;
    if (!guidedToursEnabled) {
      setTourRun(false);
      setTourInitialized(true);
      return;
    }

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
  }, [guidedToursEnabled, isInitialLoading, tourInitialized]);

  useEffect(() => {
    if (guidedToursEnabled) return;
    setTourRun(false);
  }, [guidedToursEnabled]);

  const tourDisplayTotal = useMemo(
    () =>
      tourDisplayTotalOverride ??
      (tourDisplayOffset > 0 ? tourDisplayOffset + progressTourSteps.length : undefined),
    [tourDisplayOffset, progressTourSteps.length, tourDisplayTotalOverride],
  );

  useEffect(() => {
    if (reminderBanner) {
      const timer = setTimeout(() => setReminderBanner(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [reminderBanner]);

  return (
    <main className="section-padding space-y-8">
      {reminderBanner && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-none">
          <div className="bg-white px-8 py-3 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.4)] border border-white/20">
            <p className="text-lg font-extrabold tracking-tight whitespace-nowrap text-black">
              {reminderBanner}
            </p>
          </div>
        </div>
      )}

      {guidedToursEnabled && (
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
      )}

      <div
        className="sticky top-0 z-30 isolate -mx-[clamp(1.25rem,4vw,4rem)] -mt-[clamp(2rem,4vw,3.5rem)] space-y-3 overflow-visible rounded-none border border-white/35 bg-white/30 supports-[backdrop-filter]:bg-white/16 px-3 pb-3 pt-[clamp(2rem,4vw,3.5rem)] shadow-[0_26px_56px_rgba(15,23,42,0.24)] backdrop-blur-3xl backdrop-saturate-150"
      >
        <div
          className="relative z-20 rounded-none border border-white/28 bg-white/35 supports-[backdrop-filter]:bg-white/20 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.16)] backdrop-blur-2xl"
          data-tour="teacher-progress-header"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-accent-strong">Teacher</p>
              <h1 className="text-3xl font-semibold text-white leading-tight">Hi {fullName}</h1>
              <p className="text-slate-300 text-sm">Reviewing Student Progress</p>
            </div>

            <div className="flex items-center gap-2">
              {guidedToursEnabled && (
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
              )}
              <Link
                href="/customer"
                data-tour="teacher-progress-back-dashboard"
                className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-sm !text-white hover:!text-white visited:!text-white font-semibold shadow-md ring-1 ring-white/10 hover:-translate-y-0.5 transition-transform duration-150"
              >
                Back to dashboard
              </Link>
            </div>
          </div>
        </div>

        <section className="relative z-10 rounded-none border border-white/28 bg-white/35 supports-[backdrop-filter]:bg-white/20 p-2.5 shadow-[0_12px_26px_rgba(15,23,42,0.14)] backdrop-blur-2xl">
          <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setProgressTrack("drone")}
              className={`group relative shrink-0 inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-all ${
                progressTrack === "drone"
                  ? "bg-accent text-true-white border-accent-strong/40 shadow-glow hover:-translate-y-0.5"
                  : "bg-white/85 text-foreground border-accent/25 hover:border-accent-strong hover:bg-white"
              }`}
            >
              <span
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
                  progressTrack === "drone"
                    ? "border-white/20 bg-accent-strong/90 text-true-white"
                    : "border-accent/25 bg-white text-accent-strong group-hover:bg-accent/10"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-4 w-4">
                  <path d="M12 10v4" />
                  <path d="M10 12h4" />
                  <path d="M5 5l4 4" />
                  <path d="M19 5l-4 4" />
                  <path d="M5 19l4-4" />
                  <path d="M19 19l-4-4" />
                  <circle cx="5" cy="5" r="2.5" />
                  <circle cx="19" cy="5" r="2.5" />
                  <circle cx="5" cy="19" r="2.5" />
                  <circle cx="19" cy="19" r="2.5" />
                </svg>
              </span>
              Drone Activity
            </button>
            <button
              type="button"
              onClick={() => setProgressTrack("simulation")}
              className={`group relative shrink-0 inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-all ${
                progressTrack === "simulation"
                  ? "bg-accent text-true-white border-accent-strong/40 shadow-glow hover:-translate-y-0.5"
                  : "bg-white/85 text-foreground border-accent/25 hover:border-accent-strong hover:bg-white"
              }`}
            >
              <span
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
                  progressTrack === "simulation"
                    ? "border-white/20 bg-accent-strong/90 text-true-white"
                    : "border-accent/25 bg-white text-accent-strong group-hover:bg-accent/10"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-4 w-4">
                  <path d="M7 4h10" />
                  <path d="M9 4v3l-4.5 8a3 3 0 0 0 2.6 4.5h10.8a3 3 0 0 0 2.6-4.5L16 7V4" />
                  <path d="M8 13h8" />
                  <path d="M10 16h4" />
                </svg>
              </span>
              Simulation
            </button>
            <button
              type="button"
              onClick={() => setProgressTrack("steamh")}
              className={`group relative shrink-0 inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-all ${
                progressTrack === "steamh"
                  ? "bg-accent text-true-white border-accent-strong/40 shadow-glow hover:-translate-y-0.5"
                  : "bg-white/85 text-foreground border-accent/25 hover:border-accent-strong hover:bg-white"
              }`}
            >
              <span
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
                  progressTrack === "steamh"
                    ? "border-white/20 bg-accent-strong/90 text-true-white"
                    : "border-accent/25 bg-white text-accent-strong group-hover:bg-accent/10"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-4 w-4">
                  <path d="M12 19V5" />
                  <path d="m5 12 7-7 7 7" />
                  <path d="M5 19h14" />
                </svg>
              </span>
              STEAM-H
            </button>
          </div>
        </section>
      </div>

      {isInitialLoading ? (
        <>
          <div className="glass-panel rounded-2xl p-4 flex flex-wrap gap-3 items-center">
            <div className="h-4 w-16 rounded bg-white/15 animate-pulse" />
            <div className="h-10 w-64 rounded-lg bg-white/10 animate-pulse" />
          </div>
          <div className="glass-panel rounded-2xl p-4 overflow-auto">
            <div className="space-y-3 min-w-[760px]">
              <div className="grid grid-cols-6 gap-3">
                <div className="h-4 rounded bg-white/10 animate-pulse" />
                <div className="h-4 rounded bg-white/10 animate-pulse" />
                <div className="h-4 rounded bg-white/10 animate-pulse" />
                <div className="h-4 rounded bg-white/10 animate-pulse" />
                <div className="h-4 rounded bg-white/10 animate-pulse" />
                <div className="h-4 rounded bg-white/10 animate-pulse" />
              </div>
              {Array.from({ length: 7 }).map((_, index) => (
                <div key={`progress-skeleton-${index}`} className="grid grid-cols-6 gap-3">
                  <div className="h-4 rounded bg-white/10 animate-pulse" />
                  <div className="h-4 rounded bg-white/10 animate-pulse" />
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
          {status && (
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-amber-200">{status}</div>
          )}
          {reminderBanner && (
            <div className="rounded-xl border border-emerald-300/40 bg-emerald-700/30 px-3 py-2 text-sm text-emerald-100">
              {reminderBanner}
            </div>
          )}

          {progressTrack === "drone" ? (
            <>
              <div className="glass-panel rounded-2xl p-4 flex flex-wrap gap-3 items-center" data-tour="teacher-progress-filter-panel">
                <label className="text-sm text-slate-200 space-y-1">
                  Module
                  <select
                    data-tour="teacher-progress-module-select"
                    className="w-full rounded-lg bg-white/5 border border-slate-400/60 px-3 py-2 text-slate-900 outline-none"
                    value={moduleFilter}
                    onChange={(e) => setModuleFilter(e.target.value)}
                  >
                    {moduleOptions.map((opt) => (
                      <option key={opt.id} value={opt.id} className="text-black">
                        {opt.title}
                      </option>
                    ))}
                  </select>
                </label>
                {filteredModule?.due_at && (
                  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                    Deadline: {formatDateTime(filteredModule.due_at)}
                  </div>
                )}
              </div>
              <div className="glass-panel rounded-2xl p-4 overflow-auto" data-tour="teacher-progress-table">
                <table className="table-v1">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-white/10">
                      <th className="py-2 pr-3">Student</th>
                      <th className="py-2 pr-3">Grade</th>
                      <th className="py-2 pr-3">Deadline</th>
                      <th className="py-2 pr-3" data-tour="teacher-progress-status-column">Status</th>
                      <th className="py-2 pr-3" data-tour="teacher-progress-reminder-column">Reminder</th>
                      <th className="py-2 pr-3">Attempts</th>
                      <th className="py-2 pr-3">Last updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentProgress.length === 0 ? (
                      <tr>
                        <td className="py-3 pr-3 text-slate-300" colSpan={7}>
                          {filteredModule ? "No students found for this subject/grade yet." : "Select module"}
                        </td>
                      </tr>
                    ) : (
                      studentProgress.map((row) => (
                        <tr key={row.id} className="border-b border-white/5">
                          <td className="py-2 pr-3 font-semibold text-white">{row.full_name}</td>
                          <td className="py-2 pr-3 text-slate-300">{row.grade ?? "-"}</td>
                          <td className="py-2 pr-3 text-slate-300">
                            {formatDateTime(filteredModule?.due_at ?? null)}
                          </td>
                          <td className="py-2 pr-3">
                            <span
                              className={`px-2 py-1 rounded-full text-xs !text-white ${
                                row.status === "Submitted"
                                  ? "bg-emerald-600 font-semibold"
                                  : "bg-rose-700 font-semibold"
                              }`}
                            >
                              {row.status}
                            </span>
                          </td>
                          <td className="py-2 pr-3">
                            {row.status === "Not Submitted" ? (
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
            </>
          ) : null}

          {progressTrack === "simulation" ? (
            <>
              <div className="glass-panel rounded-2xl p-4 flex flex-wrap gap-3 items-center">
                <label className="text-sm text-slate-200 space-y-1">
                  Simulation
                  <select
                    className="w-full rounded-lg bg-white/5 border border-slate-400/60 px-3 py-2 text-slate-900 outline-none"
                    value={simulationFilter}
                    onChange={(e) => setSimulationFilter(e.target.value)}
                  >
                    <option value="all" className="text-black">All Simulations</option>
                    {simulationOptions.filter(opt => opt !== "all").map((opt) => (
                      <option key={opt} value={opt} className="text-black">
                        {opt}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="glass-panel rounded-2xl p-4 overflow-auto" data-tour="teacher-progress-table">
                <table className="table-v1">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-white/10">
                      <th className="py-2 pr-3">Simulation</th>
                      <th className="py-2 pr-3">Grade</th>
                      <th className="py-2 pr-3">Student</th>
                      <th className="py-2 pr-3">Deadline</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Reminder</th>
                      <th className="py-2 pr-3">Score</th>
                      <th className="py-2 pr-3">Completed at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSimulationProgressRows.length === 0 ? (
                      <tr>
                        <td className="py-3 pr-3 text-slate-300" colSpan={8}>
                          No simulation assignments mapped to current students yet.
                        </td>
                      </tr>
                    ) : (
                      filteredSimulationProgressRows.map((row) => (
                        <tr key={row.id} className="border-b border-white/5">
                          <td className="py-2 pr-3 text-white">
                            <p className="font-semibold">{row.simulationTitle}</p>
                            {row.simulationSubject ? (
                              <p className="text-xs text-slate-400">{row.simulationSubject}</p>
                            ) : null}
                          </td>
                          <td className="py-2 pr-3 text-slate-300">{row.targetGrade}</td>
                          <td className="py-2 pr-3 text-slate-200">{row.studentName}</td>
                          <td className="py-2 pr-3 text-slate-300">{formatDateTime(row.dueAt)}</td>
                          <td className="py-2 pr-3">
                            <span
                              className={`px-2 py-1 rounded-full text-xs !text-white ${
                                row.status === "Submitted"
                                  ? "bg-emerald-600 font-semibold"
                                  : "bg-rose-700 font-semibold"
                              }`}
                            >
                              {row.status}
                            </span>
                          </td>
                          <td className="py-2 pr-3">
                            {row.status === "Not Submitted" ? (
                              <button
                                className="h-8 w-8 rounded-full bg-amber-500 text-slate-900 text-xs font-semibold border border-amber-300 hover:bg-amber-400 disabled:opacity-50 inline-flex items-center justify-center"
                                onClick={() =>
                                  void sendReminder(
                                    row.studentId,
                                    row.studentName,
                                    null,
                                    row.simulationTitle,
                                    row.simulationSubject
                                  )
                                }
                                disabled={remindingId === row.studentId}
                                aria-label="Send reminder"
                              >
                                {remindingId === row.studentId ? (
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
                          <td className="py-2 pr-3 text-slate-300">
                            {row.assessmentScore !== null && row.assessmentTotal !== null
                              ? `${row.assessmentScore}/${row.assessmentTotal}`
                              : "--"}
                          </td>
                          <td className="py-2 pr-3 text-slate-300">{formatDateTime(row.assessmentSubmittedAt)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {progressTrack === "steamh" ? (
            <>
              <div className="glass-panel rounded-2xl p-4 flex flex-wrap gap-3 items-center">
                <label className="text-sm text-slate-200 space-y-1">
                  STEAM-H Task
                  <select
                    className="w-full rounded-lg bg-white/5 border border-slate-400/60 px-3 py-2 text-slate-900 outline-none"
                    value={steamhFilter}
                    onChange={(e) => setSteamhFilter(e.target.value)}
                  >
                    <option value="all" className="text-black">All Tasks</option>
                    {steamhOptions.filter(opt => opt !== "all").map((opt) => (
                      <option key={opt} value={opt} className="text-black">
                        {opt}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="glass-panel rounded-2xl p-4 overflow-auto" data-tour="teacher-progress-table">
                <table className="table-v1">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-white/10">
                      <th className="py-2 pr-3">Student</th>
                      <th className="py-2 pr-3">Task</th>
                      <th className="py-2 pr-3">Deadline</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Reminder</th>
                      <th className="py-2 pr-3">Submitted at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSteamhProgressRows.length === 0 ? (
                      <tr>
                        <td className="py-3 pr-3 text-slate-300" colSpan={6}>
                          No STEAM-H assignments found.
                        </td>
                      </tr>
                    ) : (
                      filteredSteamhProgressRows.map((assignment) => {
                        const isSubmitted = Boolean(assignment.submitted_at);
                        const statusLabel = isSubmitted ? "Submitted" : "Not Submitted";
                        const statusClass = isSubmitted
                          ? "bg-emerald-600 font-semibold"
                          : "bg-rose-700 font-semibold";
                        return (
                          <tr key={assignment.id} className="border-b border-white/5">
                            <td className="py-2 pr-3 text-white">
                              <p className="font-semibold">{assignment.student_name}</p>
                              <p className="text-xs text-slate-400">{assignment.grade ?? "--"}</p>
                            </td>
                            <td className="py-2 pr-3 text-slate-200">
                              <p className="font-semibold">{assignment.title}</p>
                              {assignment.subject ? (
                                <p className="text-xs text-slate-400">{assignment.subject}</p>
                              ) : null}
                            </td>
                            <td className="py-2 pr-3 text-slate-300">{formatDateTime(assignment.due_at)}</td>
                            <td className="py-2 pr-3">
                              <span className={`px-2 py-1 rounded-full text-xs !text-white ${statusClass}`}>
                                {statusLabel}
                              </span>
                            </td>
                            <td className="py-2 pr-3">
                              {!isSubmitted ? (
                                <button
                                  className="h-8 w-8 rounded-full bg-amber-500 text-slate-900 text-xs font-semibold border border-amber-300 hover:bg-amber-400 disabled:opacity-50 inline-flex items-center justify-center"
                                  onClick={() =>
                                    void sendReminder(
                                      assignment.student_id,
                                      assignment.student_name,
                                      null,
                                      assignment.title,
                                      assignment.subject
                                    )
                                  }
                                  disabled={remindingId === assignment.student_id}
                                  aria-label="Send reminder"
                                >
                                  {remindingId === assignment.student_id ? (
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
                            <td className="py-2 pr-3 text-slate-300">{formatDateTime(assignment.submitted_at)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </>
      )}
    </main>
  );
}
