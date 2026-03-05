"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { CurriculumModule } from "@/types";
import { fetchCurriculumModules } from "@/lib/supabaseData";
import { logActivity } from "@/lib/activityLogger";
import {
  DEFAULT_VR_SIMULATION_LIBRARY,
  dedupeAndSortModuleNames,
  normalizeVrSubjectKey,
} from "@/lib/vrModules";
import { GuidedTour, type GuidedTourStep } from "@/components/GuidedTour";
import { playUiClickTone } from "@/lib/uiTone";

const normalizeSubject = (subject: string) =>
  subject?.toLowerCase() === "maths" ? "Mathematics" : subject;
const normalizeStatusValue = (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase() : "");
const normalizeTextValue = (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase() : "");

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  status: string;
  created_at: string;
  module_id?: string | null;
  subject?: string | null;
};

type TeacherOption = {
  id: string;
  full_name: string;
  email?: string | null;
  subject?: string | null;
  grade?: string | null;
};

type StudentQueryRow = {
  id: string;
  student_id: string;
  student_name: string;
  teacher_id: string;
  teacher_name: string;
  subject?: string | null;
  grade?: string | null;
  query_text: string;
  status: "new" | "read";
  created_at: string;
  updated_at?: string | null;
};

type QueryMessageRow = {
  id: string;
  query_id: string;
  sender_id: string;
  sender_role: "student" | "teacher";
  sender_name: string;
  message_text: string;
  created_at: string;
};

const ANY_OTHER_OPTION = "Any other";
const TEACHER_TOUR_STORAGE_KEY = "teacher_feature_tour_v2";
const TEACHER_PROGRESS_TOUR_FORCE_KEY = "teacher_progress_tour_force_once_v2";
const TEACHER_PROGRESS_TOUR_CHAIN_KEY = "teacher_progress_tour_chain_meta_v2";
const TEACHER_DASHBOARD_TOUR_RESUME_KEY = "teacher_dashboard_tour_resume_v2";
const TEACHER_TOUR_AUTOSTART_KEY = "teacher_dashboard_tour_autostart_v1";
const TEACHER_PROGRESS_TOUR_STEP_COUNT = 7;
const STUDENT_TOUR_STORAGE_KEY = "student_feature_tour_v2";
const STUDENT_ACTIVITY_TOUR_AUTOSTART_KEY = "student_activity_tour_autostart_v2";
const STUDENT_ACTIVITY_TOUR_CHAIN_KEY = "student_activity_tour_chain_meta_v2";
const STUDENT_DASHBOARD_TOUR_RESUME_KEY = "student_dashboard_tour_resume_v2";
const STUDENT_ACTIVITY_TOUR_STEP_COUNT_STANDARD = 14;
const STUDENT_ACTIVITY_TOUR_STEP_COUNT_DESIGN = 13;
const TEACHER_TOUR_PALETTE = {
  accent: "#2563eb",
  accentStrong: "#1e3a8a",
} as const;
const STUDENT_TOUR_PALETTE = {
  accent: "#f97316",
  accentStrong: "#9a3412",
} as const;

export default function CustomerPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("Customer");
  const [role, setRole] = useState<string>("customer");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [userGrade, setUserGrade] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [teacherSubject, setTeacherSubject] = useState<string | null>(null);
  const [modules, setModules] = useState<CurriculumModule[]>([]);
  const [signingOut, startSignOut] = useTransition();
  const [dataStatus, setDataStatus] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [progressMap, setProgressMap] = useState<Record<string, { completed?: boolean; score?: number; total?: number; completedAt?: string }>>({});
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [notificationStatus, setNotificationStatus] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const unreadCount = useMemo(
    () => notifications.filter((n) => normalizeStatusValue(n.status) === "unread").length,
    [notifications],
  );
  const hasUnreadSimulationAssignment = useMemo(
    () =>
      notifications.some(
        (n) => {
          if (normalizeStatusValue(n.status) !== "unread") return false;
          const combinedText = `${normalizeTextValue(n.title)} ${normalizeTextValue(n.message)} ${normalizeTextValue(n.subject)}`;
          return combinedText.includes("simulation") && combinedText.includes("assign");
        },
      ),
    [notifications],
  );
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const [teacherMenuOpen, setTeacherMenuOpen] = useState(false);
  const teacherMenuRef = useRef<HTMLDivElement | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestMode, setRequestMode] = useState<"vr" | "drone">("vr");
  const [requestItems, setRequestItems] = useState<string[]>([]);
  const [droneConcept, setDroneConcept] = useState("");
  const [requestDate, setRequestDate] = useState("");
  const [requestNotes, setRequestNotes] = useState("");
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [teacherVrModules, setTeacherVrModules] = useState<string[]>([]);
  const [seenModules, setSeenModules] = useState<Set<string>>(new Set());
  const [studentDoubtOpen, setStudentDoubtOpen] = useState(false);
  const [availableTeachers, setAvailableTeachers] = useState<TeacherOption[]>([]);
  const [availableTeachersStatus, setAvailableTeachersStatus] = useState<string | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [teacherPickerOpen, setTeacherPickerOpen] = useState(false);
  const [studentDoubtText, setStudentDoubtText] = useState("");
  const [studentDoubtStatus, setStudentDoubtStatus] = useState<string | null>(null);
  const [sendingStudentDoubt, setSendingStudentDoubt] = useState(false);
  const [teacherQueriesOpen, setTeacherQueriesOpen] = useState(false);
  const [teacherQueries, setTeacherQueries] = useState<StudentQueryRow[]>([]);
  const [teacherQueriesStatus, setTeacherQueriesStatus] = useState<string | null>(null);
  const [markingTeacherQueryId, setMarkingTeacherQueryId] = useState<string | null>(null);
  const [studentQueries, setStudentQueries] = useState<StudentQueryRow[]>([]);
  const [studentQueriesStatus, setStudentQueriesStatus] = useState<string | null>(null);
  const [activeStudentQueryId, setActiveStudentQueryId] = useState<string | null>(null);
  const [activeTeacherQueryId, setActiveTeacherQueryId] = useState<string | null>(null);
  const [queryMessagesById, setQueryMessagesById] = useState<Record<string, QueryMessageRow[]>>({});
  const [queryMessagesStatus, setQueryMessagesStatus] = useState<string | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [teacherReplyDrafts, setTeacherReplyDrafts] = useState<Record<string, string>>({});
  const [teacherTourRun, setTeacherTourRun] = useState(false);
  const [teacherTourInitialized, setTeacherTourInitialized] = useState(false);
  const [teacherTourDisplayOffset, setTeacherTourDisplayOffset] = useState(0);
  const [teacherTourDisplayTotalOverride, setTeacherTourDisplayTotalOverride] = useState<number | null>(null);
  const [teacherTourActiveStepId, setTeacherTourActiveStepId] = useState<string | null>(null);
  const [teacherTourLockedSteps, setTeacherTourLockedSteps] = useState<GuidedTourStep[] | null>(null);
  const [teacherTourPromptOpen, setTeacherTourPromptOpen] = useState(false);
  const [teacherTourResumeMeta, setTeacherTourResumeMeta] = useState<{
    stepId: string;
    completedCount: number;
    displayTotal: number | null;
  } | null>(null);
  const [studentTourRun, setStudentTourRun] = useState(false);
  const [studentTourInitialized, setStudentTourInitialized] = useState(false);
  const [studentTourDisplayOffset, setStudentTourDisplayOffset] = useState(0);
  const [studentTourDisplayTotalOverride, setStudentTourDisplayTotalOverride] = useState<number | null>(null);
  const [studentTourActiveStepId, setStudentTourActiveStepId] = useState<string | null>(null);
  const [studentTourLockedSteps, setStudentTourLockedSteps] = useState<GuidedTourStep[] | null>(null);
  const [studentTourPromptOpen, setStudentTourPromptOpen] = useState(false);
  const [studentTourResumeMeta, setStudentTourResumeMeta] = useState<{
    stepId: string;
    completedCount: number;
    displayTotal: number | null;
  } | null>(null);
  const unreadTeacherQueries = useMemo(
    () => teacherQueries.filter((query) => query.status === "new").length,
    [teacherQueries],
  );
  const teacherBellUnreadCount = useMemo(
    () => unreadCount + unreadTeacherQueries,
    [unreadCount, unreadTeacherQueries],
  );
  const chatStatusMessage = queryMessagesStatus ?? studentDoubtStatus;
  const filteredStudentQueries = useMemo(
    () =>
      selectedTeacherId
        ? studentQueries.filter((query) => query.teacher_id === selectedTeacherId)
        : studentQueries,
    [selectedTeacherId, studentQueries],
  );
  const activeStudentQuery = useMemo(
    () => filteredStudentQueries.find((query) => query.id === activeStudentQueryId) ?? null,
    [activeStudentQueryId, filteredStudentQueries],
  );
  const activeTeacherQuery = useMemo(
    () => teacherQueries.find((query) => query.id === activeTeacherQueryId) ?? null,
    [activeTeacherQueryId, teacherQueries],
  );
  const selectedTeacher = useMemo(
    () => availableTeachers.find((teacher) => teacher.id === selectedTeacherId) ?? null,
    [availableTeachers, selectedTeacherId],
  );
  const selectedTeacherLabel = useMemo(() => {
    if (!selectedTeacher) return "Select teacher";
    return `${selectedTeacher.full_name}${selectedTeacher.subject ? ` (${selectedTeacher.subject})` : ""}`;
  }, [selectedTeacher]);
  const roleDisplayLabel = useMemo(() => {
    const normalized = (role ?? "").trim().toLowerCase();
    if (normalized === "admin") return "Admin";
    if (normalized === "teacher") return "Teacher";
    if (normalized === "student" || normalized === "customer") return "Student";
    return "Student";
  }, [role]);
  const formatConversationDate = useCallback(
    (isoDate: string) =>
      new Date(isoDate).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "numeric",
        year: "numeric",
      }),
    [],
  );
  useEffect(() => {
    const loadProgress = () => {
      try {
        const stored = localStorage.getItem("activityProgress");
        if (!stored) {
          setProgressMap({});
          return;
        }
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object") {
          setProgressMap(parsed);
        } else {
          setProgressMap({});
        }
      } catch {
        setProgressMap({});
      }
    };
    loadProgress();
    const onStorage = (event: StorageEvent) => {
      if (event.key === "activityProgress") {
        loadProgress();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!notificationsOpen) return;
      const target = event.target as Node | null;
      if (notificationsRef.current && target && !notificationsRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notificationsOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!teacherMenuOpen) return;
      const target = event.target as Node | null;
      if (teacherMenuRef.current && target && !teacherMenuRef.current.contains(target)) {
        setTeacherMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [teacherMenuOpen]);

  useEffect(() => {
    if (role !== "teacher") return;
    try {
      const raw = localStorage.getItem("teacherModuleSeen");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setSeenModules(new Set(parsed.filter((id) => typeof id === "string")));
      }
    } catch {
      // ignore errors reading localStorage
    }
  }, [role]);

  const decodeDataUrl = useCallback((url?: string) => {
    if (!url || !url.startsWith("data:")) return null;
    const commaIndex = url.indexOf(",");
    if (commaIndex === -1) return null;
    try {
      const base64 = url.slice(commaIndex + 1);
      return atob(base64);
    } catch {
      return null;
    }
  }, []);

  const encodeToBase64 = useCallback((text: string) => {
    if (typeof window === "undefined") {
      return Buffer.from(text, "utf-8").toString("base64");
    }
    try {
      return btoa(unescape(encodeURIComponent(text)));
    } catch {
      return btoa(text);
    }
  }, []);

  const enhanceModule = useCallback((module: CurriculumModule): CurriculumModule => {
    let codeSnippet = module.codeSnippet;
    let assets = module.assets ?? [];
    const codeIndex = assets.findIndex((a) => a.type === "code");
    const codeAsset = codeIndex >= 0 ? assets[codeIndex] : undefined;

    if (!codeSnippet && codeAsset?.url) {
      const decoded = decodeDataUrl(codeAsset.url);
      if (decoded) codeSnippet = decoded;
    }

    if (codeSnippet) {
      const dataUrl = `data:text/plain;base64,${encodeToBase64(codeSnippet)}`;
      if (codeIndex >= 0) {
        assets = assets.map((a, i) => (i === codeIndex ? { ...a, url: dataUrl } : a));
      } else {
        assets = [...assets, { type: "code", url: dataUrl, label: codeAsset?.label || "Python code" }];
      }
    }

    return { ...module, codeSnippet, assets };
  }, [decodeDataUrl, encodeToBase64]);


  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      try {
        // Refresh to pick up latest user_metadata (e.g., subject updates from admin)
        const refreshed = await supabase.auth.refreshSession();
        const sessionFromRefresh = refreshed.data.session ?? null;
        const sessionFromStore =
          sessionFromRefresh ?? (await supabase.auth.getSession()).data.session ?? null;
        const latestUser = sessionFromStore?.user ?? (await supabase.auth.getUser()).data.user ?? null;
        const latestToken = sessionFromStore?.access_token ?? null;
        if (cancelled) return;
        setSessionToken(latestToken);
        if (!latestUser) {
          setIsAuthenticated(false);
          setAuthChecked(true);
          router.replace("/login");
          return;
        }
        setIsAuthenticated(true);

        // Profile fetch is best-effort; fall back to metadata even if it fails.
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name, role, grade")
          .eq("id", latestUser.id)
          .maybeSingle();
        if (cancelled) return;

        const normalizeRoleValue = (value: unknown) => {
          const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
          if (normalized === "admin" || normalized === "teacher" || normalized === "student" || normalized === "customer") {
            return normalized;
          }
          return null;
        };
        const roleFromMeta = normalizeRoleValue(latestUser.user_metadata?.role);
        const roleFromProfile = normalizeRoleValue(profileData?.role);
        const derivedRole = roleFromMeta ?? roleFromProfile ?? "customer";
        setRole(derivedRole);
        setFullName(profileData?.full_name ?? latestUser.user_metadata.full_name ?? latestUser.email ?? "Customer");

        const gradeFromMeta =
          (profileData as { grade?: string } | null)?.grade ??
          (latestUser.user_metadata?.grade as string | undefined) ??
          null;
        if (gradeFromMeta) {
          setGradeFilter(gradeFromMeta);
          setUserGrade(gradeFromMeta);
        }

        const subjectFromMeta = (latestUser.user_metadata?.subject as string | undefined) ?? null;
        if (derivedRole === "teacher" && subjectFromMeta) {
          const normalized = normalizeSubject(subjectFromMeta);
          setSubjectFilter(normalized);
          setTeacherSubject(normalized);
        }

        // Ensure profile exists with correct role for RLS (teachers need role=teacher in profiles).
        const needsProfileUpsert =
          !profileData || (roleFromProfile ?? "") !== derivedRole;
        if (needsProfileUpsert) {
          await supabase.from("profiles").upsert({
            id: latestUser.id,
            full_name: latestUser.user_metadata?.full_name || latestUser.email || "User",
            role: derivedRole,
            grade: gradeFromMeta ?? undefined,
          });
        }

        if (cancelled) return;
        setAuthChecked(true);

        // If an admin somehow lands here, redirect to the admin control room.
        if (derivedRole === "admin") {
          router.replace("/admin");
        }
      } catch {
        if (cancelled) return;
        setSessionToken(null);
        setIsAuthenticated(false);
        setAuthChecked(true);
        setDataStatus("Unable to reach the server. Check your internet and refresh.");
      }
    };
    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!authChecked || !isAuthenticated) return;
    let cancelled = false;

    const loadCurriculum = async () => {
      try {
        setDataStatus("Loading activities...");
        let rows: CurriculumModule[] = [];
        if (role === "teacher") {
          const liveToken =
            sessionToken ??
            (await supabase.auth.getSession()).data.session?.access_token ??
            null;
          if (liveToken && liveToken !== sessionToken) {
            setSessionToken(liveToken);
          }

          if (liveToken) {
            const res = await fetch("/api/teacher/modules", {
              headers: { Authorization: `Bearer ${liveToken}` },
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
              throw new Error(body?.error || "Unable to load modules");
            }
            rows = (body.modules ?? []) as CurriculumModule[];
          } else {
            rows = await fetchCurriculumModules({
              includeUnpublished: true,
              subject: teacherSubject ?? undefined,
            });
          }
        } else {
          rows = await fetchCurriculumModules({
            includeUnpublished: false,
            subject: undefined,
          });
        }
        if (cancelled) return;
        setModules(rows.map((m) => enhanceModule(m)));
        setDataStatus(null);
      } catch (err) {
        if (cancelled) return;
        setModules([]);
        const message =
          err instanceof Error && err.message.trim()
            ? err.message
            : "Database not reachable. No activities available.";
        setDataStatus(message);
      }
    };

    loadCurriculum();
    return () => {
      cancelled = true;
    };
  }, [authChecked, isAuthenticated, enhanceModule, role, teacherSubject, sessionToken]);

  const markModuleSeen = useCallback((id: string) => {
    setSeenModules((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem("teacherModuleSeen", JSON.stringify(Array.from(next)));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!authChecked || !isAuthenticated) return;
    let cancelled = false;

    const loadNotifications = async () => {
      try {
        setNotificationStatus("Loading notifications...");
        const { data, error } = await supabase
          .from("notifications")
          .select("id,title,message,status,created_at,module_id,subject")
          .order("created_at", { ascending: false })
          .limit(20);
        if (error) {
          throw error;
        }
        if (!cancelled) {
          setNotifications(data ?? []);
          setNotificationStatus(null);
        }
      } catch {
        if (!cancelled) {
          setNotifications([]);
          setNotificationStatus("Notifications unavailable");
        }
      }
    };

    void loadNotifications();
    return () => {
      cancelled = true;
    };
  }, [authChecked, isAuthenticated, role]);

  const markNotificationRead = useCallback(
    async (id: string) => {
      try {
        setMarkingId(id);
        const { error } = await supabase.from("notifications").update({ status: "read" }).eq("id", id);
        if (error) {
          throw error;
        }
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, status: "read" } : n)));
      } catch {
        setNotificationStatus("Could not update notification");
      } finally {
        setMarkingId(null);
      }
    },
    [],
  );

  const loadAvailableTeachers = useCallback(async () => {
    if (!sessionToken) return;
    try {
      setAvailableTeachersStatus("Loading teachers...");
      const response = await fetch("/api/student/teachers", {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      const body = (await response.json().catch(() => ({}))) as {
        teachers?: TeacherOption[];
        error?: string;
      };
      if (!response.ok) {
        setAvailableTeachers([]);
        setAvailableTeachersStatus(body?.error ?? `Unable to load teachers (status ${response.status})`);
        return;
      }
      const teachers = Array.isArray(body.teachers) ? body.teachers : [];
      setAvailableTeachers(teachers);
      setAvailableTeachersStatus(teachers.length ? null : "No teachers available right now.");
      setSelectedTeacherId((prev) => {
        if (prev && teachers.some((teacher) => teacher.id === prev)) return prev;
        return "";
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load teachers";
      setAvailableTeachers([]);
      setAvailableTeachersStatus(message);
    }
  }, [sessionToken]);

  const loadTeacherQueries = useCallback(async () => {
    if (!sessionToken) return;
    try {
      setTeacherQueriesStatus("Loading student queries...");
      const response = await fetch("/api/teacher/student-queries", {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      const body = (await response.json().catch(() => ({}))) as {
        queries?: StudentQueryRow[];
        error?: string;
      };
      if (!response.ok) {
        setTeacherQueries([]);
        setTeacherQueriesStatus(body?.error ?? `Unable to load queries (status ${response.status})`);
        return;
      }
      const queries = Array.isArray(body.queries) ? body.queries : [];
      setTeacherQueries(queries);
      setTeacherQueriesStatus(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load student queries";
      setTeacherQueries([]);
      setTeacherQueriesStatus(message);
    }
  }, [sessionToken]);

  const loadStudentQueries = useCallback(
    async (teacherIdOverride?: string) => {
      if (!sessionToken) return;
      try {
        setStudentQueriesStatus("Loading chats...");
        const response = await fetch("/api/student/queries", {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        const body = (await response.json().catch(() => ({}))) as {
          queries?: StudentQueryRow[];
          error?: string;
        };
        if (!response.ok) {
          setStudentQueries([]);
          setStudentQueriesStatus(body?.error ?? `Unable to load chats (status ${response.status})`);
          return;
        }
        const queries = Array.isArray(body.queries) ? body.queries : [];
        setStudentQueries(queries);
        setStudentQueriesStatus(null);
        const effectiveTeacherId = teacherIdOverride ?? selectedTeacherId;
        setActiveStudentQueryId((prev) => {
          if (!effectiveTeacherId) return null;
          const scopedQueries = effectiveTeacherId
            ? queries.filter((query) => query.teacher_id === effectiveTeacherId)
            : queries;
          if (prev && scopedQueries.some((query) => query.id === prev)) return prev;
          return scopedQueries[0]?.id ?? null;
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load chats";
        setStudentQueries([]);
        setStudentQueriesStatus(message);
      }
    },
    [selectedTeacherId, sessionToken],
  );

  const loadQueryMessages = useCallback(
    async (queryId: string) => {
      if (!sessionToken || !queryId) return;
      try {
        setQueryMessagesStatus("Loading conversation...");
        const params = new URLSearchParams({ queryId });
        const response = await fetch(`/api/student/query-messages?${params.toString()}`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        const body = (await response.json().catch(() => ({}))) as {
          messages?: QueryMessageRow[];
          error?: string;
        };
        if (!response.ok) {
          setQueryMessagesStatus(body?.error ?? `Unable to load messages (status ${response.status})`);
          return;
        }
        const messages = Array.isArray(body.messages) ? body.messages : [];
        setQueryMessagesById((prev) => ({ ...prev, [queryId]: messages }));
        setQueryMessagesStatus(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load messages";
        setQueryMessagesStatus(message);
      }
    },
    [sessionToken],
  );

  useEffect(() => {
    if (!authChecked || !isAuthenticated || !sessionToken) return;
    if (role === "teacher") {
      void loadTeacherQueries();
      return;
    }
    if (role === "student" || role === "customer") {
      void loadAvailableTeachers();
      void loadStudentQueries();
    }
  }, [authChecked, isAuthenticated, loadAvailableTeachers, loadStudentQueries, loadTeacherQueries, role, sessionToken]);

  const submitStudentQuery = useCallback(async () => {
    if (!sessionToken) {
      setStudentDoubtStatus("Missing session. Please re-login.");
      return;
    }
    if (!selectedTeacherId) {
      setStudentDoubtStatus("Select a teacher.");
      return;
    }
    const trimmedQuery = studentDoubtText.trim();
    if (!trimmedQuery) {
      setStudentDoubtStatus("Type your query.");
      return;
    }

    setSendingStudentDoubt(true);
    setStudentDoubtStatus("Sending query...");
    try {
      const response = await fetch("/api/student/queries", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teacherId: selectedTeacherId,
          query: trimmedQuery,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string; queryId?: string | null };
      if (!response.ok) {
        setStudentDoubtStatus(body?.error ?? `Failed to send query (status ${response.status})`);
        return;
      }
      setStudentDoubtStatus("Query sent to teacher.");
      setStudentDoubtText("");
      const newQueryId = typeof body.queryId === "string" ? body.queryId : null;
      if (newQueryId) {
        setActiveStudentQueryId(newQueryId);
        void loadQueryMessages(newQueryId);
      }
      void loadStudentQueries();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to send query";
      setStudentDoubtStatus(message);
    } finally {
      setSendingStudentDoubt(false);
    }
  }, [loadQueryMessages, loadStudentQueries, selectedTeacherId, sessionToken, studentDoubtText]);

  const sendQueryMessage = useCallback(
    async (queryId: string, messageText: string) => {
      if (!sessionToken) {
        setQueryMessagesStatus("Missing session. Please re-login.");
        return false;
      }
      const trimmed = messageText.trim();
      if (!trimmed) {
        setQueryMessagesStatus("Type a message.");
        return false;
      }

      setSendingMessage(true);
      setQueryMessagesStatus("Sending message...");
      try {
        const response = await fetch("/api/student/query-messages", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ queryId, message: trimmed }),
        });
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          setQueryMessagesStatus(body?.error ?? `Unable to send message (status ${response.status})`);
          return false;
        }
        setQueryMessagesStatus(null);
        await loadQueryMessages(queryId);
        if (role === "teacher") {
          void loadTeacherQueries();
        } else {
          void loadStudentQueries();
        }
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to send message";
        setQueryMessagesStatus(message);
        return false;
      } finally {
        setSendingMessage(false);
      }
    },
    [loadQueryMessages, loadStudentQueries, loadTeacherQueries, role, sessionToken],
  );

  const handleStudentSendMessage = useCallback(async () => {
    if (activeStudentQueryId) {
      const sent = await sendQueryMessage(activeStudentQueryId, studentDoubtText);
      if (sent) {
        setStudentDoubtText("");
      }
      return;
    }
    await submitStudentQuery();
  }, [activeStudentQueryId, sendQueryMessage, studentDoubtText, submitStudentQuery]);

  const markTeacherQueryRead = useCallback(
    async (id: string) => {
      if (!sessionToken) return;
      try {
        setMarkingTeacherQueryId(id);
        const response = await fetch("/api/teacher/student-queries", {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id, status: "read" }),
        });
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          setTeacherQueriesStatus(body?.error ?? `Unable to update query (status ${response.status})`);
          return;
        }
        setTeacherQueries((prev) =>
          prev.map((query) => (query.id === id ? { ...query, status: "read" } : query)),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to update query";
        setTeacherQueriesStatus(message);
      } finally {
        setMarkingTeacherQueryId(null);
      }
    },
    [sessionToken],
  );

  useEffect(() => {
    if (!activeStudentQueryId) return;
    void loadQueryMessages(activeStudentQueryId);
  }, [activeStudentQueryId, loadQueryMessages]);

  useEffect(() => {
    if (!activeTeacherQueryId) return;
    void loadQueryMessages(activeTeacherQueryId);
    const target = teacherQueries.find((query) => query.id === activeTeacherQueryId);
    if (target && target.status === "new") {
      void markTeacherQueryRead(activeTeacherQueryId);
    }
  }, [activeTeacherQueryId, loadQueryMessages, markTeacherQueryRead, teacherQueries]);

  useEffect(() => {
    if (!studentDoubtOpen || role === "teacher" || !sessionToken) return;
    void loadStudentQueries();
    if (activeStudentQueryId) {
      void loadQueryMessages(activeStudentQueryId);
    }

    const intervalId = window.setInterval(() => {
      void loadStudentQueries();
      if (activeStudentQueryId) {
        void loadQueryMessages(activeStudentQueryId);
      }
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, [
    activeStudentQueryId,
    loadQueryMessages,
    loadStudentQueries,
    role,
    sessionToken,
    studentDoubtOpen,
  ]);

  const gradeOptions = useMemo(() => {
    if (userGrade) return [userGrade];
    const uniqueGrades = Array.from(new Set(modules.map((m) => m.grade)));
    return ["all", ...uniqueGrades];
  }, [modules, userGrade]);

  const filteredModules = useMemo(() => {
    return modules.filter((m) => {
      const effectiveGrade = userGrade ?? gradeFilter;
      const gradeMatch = effectiveGrade === "all" || m.grade === effectiveGrade;
      const normalizedSubject = normalizeSubject(m.subject);
      const subjectMatch = subjectFilter === "all" || normalizedSubject === subjectFilter;
      const isDesignTech = normalizedSubject === "Design & Technology" || normalizedSubject === "Design Technology";
      const publishedMatch = role === "teacher" ? true : m.published !== false || isDesignTech;
      return gradeMatch && subjectMatch && publishedMatch;
    });
  }, [gradeFilter, subjectFilter, modules, role, userGrade]);

  const studentTourTargetModuleId = useMemo(() => {
    if (filteredModules.length === 0) return null;
    const normalized = (module: CurriculumModule) =>
      `${module.title} ${module.module} ${module.description}`.toLowerCase();

    const pressureVsAltitudeMatch = filteredModules.find((module) => {
      const text = normalized(module);
      return (
        text.includes("pressure vs altitude") ||
        text.includes("pressure and altitude") ||
        (text.includes("pressure") && text.includes("altitude"))
      );
    });

    return (pressureVsAltitudeMatch ?? filteredModules[0])?.id ?? null;
  }, [filteredModules]);
  const studentDroneActivityHref = useMemo(
    () => (studentTourTargetModuleId ? `/customer/activity/${studentTourTargetModuleId}` : null),
    [studentTourTargetModuleId],
  );
  const vrSubjectKey = useMemo(() => normalizeVrSubjectKey(teacherSubject ?? subjectFilter), [subjectFilter, teacherSubject]);

  useEffect(() => {
    if (role !== "teacher" || !sessionToken || !vrSubjectKey) {
      setTeacherVrModules([]);
      return;
    }

    let cancelled = false;
    const loadTeacherVrModules = async () => {
      try {
        const res = await fetch("/api/teacher/vr-modules", {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        const body = (await res.json().catch(() => ({}))) as {
          modules?: unknown;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(body?.error ?? `Unable to load VR modules (status ${res.status})`);
        }
        const items = Array.isArray(body.modules)
          ? body.modules.filter((item): item is string => typeof item === "string")
          : [];
        if (!cancelled) {
          setTeacherVrModules(dedupeAndSortModuleNames(items));
        }
      } catch {
        if (!cancelled) {
          setTeacherVrModules([]);
        }
      }
    };

    void loadTeacherVrModules();
    return () => {
      cancelled = true;
    };
  }, [role, sessionToken, vrSubjectKey]);

  const vrItems = useMemo(() => {
    if (!vrSubjectKey) return [];
    const fallback = DEFAULT_VR_SIMULATION_LIBRARY[vrSubjectKey] ?? [];
    return dedupeAndSortModuleNames([...fallback, ...teacherVrModules]);
  }, [teacherVrModules, vrSubjectKey]);

  const requestMinDate = useMemo(() => {
    const today = new Date();
    const hasAnyOther = requestItems.includes(ANY_OTHER_OPTION);
    const offsetDays = requestMode === "vr" ? (hasAnyOther ? 14 : 3) : 8; // extend lead time when "Any other" is selected
    const minDate = new Date(today);
    minDate.setDate(today.getDate() + offsetDays);
    return minDate.toISOString().split("T")[0];
  }, [requestItems, requestMode]);

  const anyOtherSelected = requestItems.includes(ANY_OTHER_OPTION);
  const dateHelpText =
    requestMode === "vr"
      ? anyOtherSelected
        ? "Select a date at least 14 days from today (custom VR requests need more lead time)."
        : "Select a date at least 3 days from today (next 2 days are blocked)."
      : "Select a date at least 8 days from today; require 7 days for R&D to draft and test.";

  useEffect(() => {
    // If switching modes makes the previously selected date invalid, clear it.
    if (requestDate && requestDate < requestMinDate) {
      setRequestDate("");
    }
  }, [requestDate, requestMinDate]);

  useEffect(() => {
    if (!teacherQueriesOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [teacherQueriesOpen]);

  const togglePublish = async (moduleId: string, nextPublished: boolean) => {
    if (!sessionToken) {
      setDataStatus("Missing session. Please re-login.");
      return;
    }
    try {
      setPublishingId(moduleId);
      const res = await fetch("/api/teacher/publish", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ moduleId, published: nextPublished }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDataStatus(body?.error ?? "Publish failed");
        return;
      }
      setModules((prev) =>
        prev.map((m) => (m.id === moduleId ? { ...m, published: nextPublished } : m)),
      );
      setDataStatus(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Publish failed";
      setDataStatus(message);
    } finally {
      setPublishingId(null);
    }
  };

  const toggleRequestItem = (item: string) => {
    setRequestItems((prev) => {
      const isAnyOther = item === ANY_OTHER_OPTION;
      const prevHasAnyOther = prev.includes(ANY_OTHER_OPTION);

      if (isAnyOther) {
        return prevHasAnyOther ? [] : [ANY_OTHER_OPTION];
      }

      if (prevHasAnyOther) {
        return [item];
      }

      return prev.includes(item) ? prev.filter((v) => v !== item) : [...prev, item];
    });
  };

  const resetRequestForm = () => {
    setRequestMode("vr");
    setRequestItems([]);
    setDroneConcept("");
    setRequestDate("");
    setRequestNotes("");
  };

  const closeRequestModal = () => {
    setRequestOpen(false);
    setRequestStatus(null);
  };

  const submitVrRequest = async () => {
    if (!sessionToken) {
      setRequestStatus("Missing session. Please re-login.");
      return;
    }
    if (role !== "teacher") {
      setRequestStatus("Only teachers can send requests.");
      return;
    }
    if (!vrSubjectKey) {
      setRequestStatus("Your subject is not set. Ask an admin to add your subject.");
      return;
    }
    if (requestMode === "vr" && requestItems.length === 0) {
      setRequestStatus("Select at least one VR simulation.");
      return;
    }
    if (requestMode === "vr" && anyOtherSelected && !requestNotes.trim()) {
      setRequestStatus("Describe the VR module you require in Extra notes.");
      return;
    }
    if (requestMode === "drone" && !droneConcept.trim()) {
      setRequestStatus("Describe the drone activity concept you need.");
      return;
    }
    if (!requestDate) {
      setRequestStatus("Pick the date when you need this content.");
      return;
    }
    const selectedDate = new Date(requestDate);
    const minSelectableDate = new Date(requestMinDate);
    if (selectedDate < minSelectableDate) {
      setRequestStatus(
        requestMode === "vr" && anyOtherSelected
          ? "For 'Any other' requests, pick a date at least 14 days from today."
          : "Date is earlier than the allowed window.",
      );
      return;
    }

    setSendingRequest(true);
    setRequestStatus("Sending request...");
    try {
      const res = await fetch("/api/teacher/requests", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject: vrSubjectKey,
          items: requestMode === "vr" ? requestItems : [droneConcept.trim()],
          neededBy: requestDate,
          notes: requestNotes.trim() || null,
          requestType: requestMode === "vr" ? "vr_simulation" : "drone_activity",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRequestStatus(body?.error ?? `Request failed (status ${res.status})`);
        return;
      }
      setRequestStatus("Request sent to admin.");
      resetRequestForm();
      setRequestOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to send request";
      setRequestStatus(message);
    } finally {
      setSendingRequest(false);
    }
  };

  const formatSubject = (subject: string) => normalizeSubject(subject);

  const teacherTourLiveBadgeModuleId = useMemo(() => {
    const firstModule = filteredModules[0];
    if (!firstModule?.published) return null;
    return firstModule.id;
  }, [filteredModules]);

  const teacherTourComputedSteps = useMemo<GuidedTourStep[]>(() => {
    if (role !== "teacher") return [];

    const steps: GuidedTourStep[] = [
      {
        id: "header",
        target: '[data-tour="teacher-header"]',
        title: "Teacher Dashboard Header",
        description: "Use this header as your daily control surface for alerts, menu actions, and quick orientation.",
        placement: "bottom",
        forcePageTop: true,
      },
      {
        id: "notification-bell",
        target: '[data-tour="teacher-notification-bell"]',
        title: "Notification Bell",
        description: "Open this to check unread updates and student query alerts before and after class.",
        placement: "left",
        forcePageTop: true,
      },
      {
        id: "notification-panel",
        target: '[data-tour="teacher-notification-panel"]',
        title: "Notification Drawer",
        description: "This drawer aggregates notifications so no student-facing update is missed.",
        placement: "left",
        forcePageTop: true,
      },
      {
        id: "notification-query-shortcut",
        target: '[data-tour="teacher-notification-query-shortcut"]',
        title: "Student Query Shortcut",
        description: "Jump directly into the query inbox from here for fast learner support.",
        placement: "left",
        forcePageTop: true,
      },
      {
        id: "menu-trigger",
        target: '[data-tour="teacher-menu-trigger"]',
        title: "Teacher Menu",
        description:
          "Open the menu to access content requests, assignment workflow, student progress, student queries, and student registry.",
        placement: "left",
        forcePageTop: true,
        lockTooltipPositionToPrev: true,
      },
      {
        id: "menu-panel",
        target: '[data-tour="teacher-menu-panel"]',
        title: "Teacher Action Panel",
        description: "All teacher workflows are centralized in this panel.",
        placement: "left",
        forcePageTop: true,
      },
      {
        id: "menu-raise-request",
        target: '[data-tour="teacher-menu-raise-request"]',
        title: "Raise a Content Request",
        description: "Request new VR simulations or drone activities from admin.",
        placement: "left",
        forcePageTop: true,
      },
      {
        id: "request-modal",
        target: '[data-tour="teacher-request-modal"]',
        title: "Request Content Modal",
        description: "Configure what you need, by when you need it, and what context admin should consider.",
        placement: "top",
      },
      {
        id: "request-mode",
        target: '[data-tour="teacher-request-mode"]',
        title: "Request Mode Selection",
        description: "Switch between VR simulation requests and drone activity requests based on your lesson plan.",
        placement: "top",
      },
      {
        id: "request-date",
        target: '[data-tour="teacher-request-date"]',
        title: "Needed-By Date",
        description: "Date guardrails enforce enough lead time for content drafting and QA.",
        placement: "top",
      },
      {
        id: "request-send",
        target: '[data-tour="teacher-request-send"]',
        title: "Send to Admin",
        description: "Submit finalized request details to the admin control room.",
        placement: "top",
      },
      {
        id: "request-any-other",
        target: '[data-tour="teacher-request-any-other"]',
        title: "Missing VR Simulation? Use Any other",
        description: "If the simulation you need is not listed, select Any other in the VR simulations section.",
        placement: "left",
        forcePageTop: true,
      },
      {
        id: "request-notes",
        target: '[data-tour="teacher-request-notes"]',
        title: "Describe Requirement in Extra Notes",
        description: "Clearly describe the exact VR simulation you want, learning outcome, and any classroom constraints.",
        placement: "top",
      },
      {
        id: "request-date-any-other",
        target: '[data-tour="teacher-request-date"]',
        title: "Choose Date With 14-Day Lead Time",
        description: "For Any other custom VR requests, pick a needed-by date at least 14 days from today.",
        placement: "top",
      },
      {
        id: "request-send-any-other",
        target: '[data-tour="teacher-request-send"]',
        title: "Send Custom Request to Admin",
        description: "After selecting Any other, adding notes, and choosing a 14+ day date, click Send to Admin.",
        placement: "left",
        scrollBlock: "center",
        lockTooltipPositionToPrev: true,
      },
      {
        id: "filters",
        target: '[data-tour="teacher-filters"]',
        title: "Filter Activity List",
        description: "Refine modules by grade and subject to focus on the right classroom scope.",
        placement: "bottom",
      },
    ];

    if (filteredModules.length > 0) {
      steps.push(
        {
          id: "activity-card",
          target: '[data-tour="teacher-activity-card"]',
          title: "Activity Cards",
          description: "Each card shows a module's classroom state and provides direct access to activity assets.",
          placement: "top",
        },
        {
          id: "publish-status",
          target: '[data-tour="teacher-publish-status"]',
          title: "Published vs Hidden State",
          description: "Published modules are visible to students; hidden modules stay internal until teacher practice/try and publish.",
          placement: "top",
        },
        {
          id: "publish-toggle",
          target: '[data-tour="teacher-publish-toggle"]',
          title: "Publish/Unpublish Control",
          description: "Use this toggle to go live with a module or withdraw it for updates.",
          placement: "top",
        },
      );
      if (teacherTourLiveBadgeModuleId) {
        steps.push({
          id: "live-badge",
          target: '[data-tour="teacher-live-badge"]',
          title: "Live Activity Indicator",
          description: "The live badge confirms modules currently published to learners.",
          placement: "top",
        });
      }
      steps.push({
        id: "activity-launch",
        target: '[data-tour="teacher-activity-launch"]',
        title: "Open Activity and Code",
        description: "Launch the module detail page to run classroom activity instructions and code assets.",
        placement: "top",
      });
    }

    steps.push(
      {
        id: "menu-progress",
        target: '[data-tour="teacher-menu-progress"]',
        title: "Student Progress Page",
        description: "Click Next from this step to open Student Progress and continue the walkthrough there.",
        placement: "left",
        forcePageTop: true,
      },
      {
        id: "menu-queries",
        target: '[data-tour="teacher-menu-student-queries"]',
        title: "Student Query Inbox",
        description: "Open direct student conversations and resolve doubts quickly.",
        placement: "left",
        forcePageTop: true,
      },
      {
        id: "inbox-panel",
        target: '[data-tour="teacher-inbox-modal"]',
        title: "Teacher Inbox Workspace",
        description: "Manage student conversations from a focused split-pane inbox.",
        placement: "top",
      },
      {
        id: "inbox-refresh",
        target: '[data-tour="teacher-inbox-refresh"]',
        title: "Refresh Conversations",
        description: "Use refresh to pull the latest query states and incoming student messages.",
        placement: "bottom",
      },
      {
        id: "inbox-list",
        target: '[data-tour="teacher-inbox-list"]',
        title: "Student Query List",
        description: "Each row is a student conversation. New queries appear here first for action.",
        placement: "right",
      },
      {
        id: "inbox-conversation",
        target: '[data-tour="teacher-inbox-conversation"]',
        title: "Conversation Workspace",
        description: "Open a query to view thread history and teaching context before replying.",
        placement: "left",
      },
      {
        id: "inbox-reply",
        target: '[data-tour="teacher-inbox-reply"]',
        title: "Reply Box",
        description: "Type and send your response here to resolve student doubts quickly.",
        placement: "top",
      },
      {
        id: "menu-signout",
        target: '[data-tour="teacher-menu-signout"]',
        title: "Sign Out Safely",
        description: "Use this to securely end your teacher session after completing your workflow.",
        placement: "left",
        forcePageTop: true,
      },
    );

    return steps;
  }, [filteredModules, role, teacherTourLiveBadgeModuleId]);

  const teacherTourSteps = teacherTourLockedSteps ?? teacherTourComputedSteps;

  const startTeacherTour = useCallback(() => {
    setNotificationsOpen(false);
    setTeacherMenuOpen(false);
    setRequestOpen(false);
    setTeacherQueriesOpen(false);
    setTeacherTourPromptOpen(false);
    setTeacherTourLockedSteps(teacherTourComputedSteps);
    setTeacherTourActiveStepId(teacherTourComputedSteps[0]?.id ?? null);
    setTeacherTourDisplayOffset(0);
    setTeacherTourDisplayTotalOverride(null);
    setTeacherTourResumeMeta(null);
    setTeacherTourRun(true);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(TEACHER_TOUR_STORAGE_KEY);
      window.localStorage.removeItem(TEACHER_DASHBOARD_TOUR_RESUME_KEY);
      window.localStorage.removeItem(TEACHER_PROGRESS_TOUR_FORCE_KEY);
      window.localStorage.removeItem(TEACHER_PROGRESS_TOUR_CHAIN_KEY);
    }
  }, [teacherTourComputedSteps]);

  const closeTeacherTour = useCallback((completed: boolean) => {
    setTeacherTourRun(false);
    setTeacherTourActiveStepId(null);
    setTeacherTourLockedSteps(null);
    setTeacherTourPromptOpen(false);
    setTeacherTourDisplayOffset(0);
    setTeacherTourDisplayTotalOverride(null);
    setTeacherTourResumeMeta(null);
    setNotificationsOpen(false);
    setTeacherMenuOpen(false);
    setRequestOpen(false);
    setTeacherQueriesOpen(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TEACHER_TOUR_STORAGE_KEY, completed ? "done" : "skipped");
      window.localStorage.removeItem(TEACHER_DASHBOARD_TOUR_RESUME_KEY);
      window.localStorage.removeItem(TEACHER_PROGRESS_TOUR_FORCE_KEY);
      window.localStorage.removeItem(TEACHER_PROGRESS_TOUR_CHAIN_KEY);
    }
  }, []);

  const teacherTourDisplayTotal = useMemo(
    () => teacherTourDisplayTotalOverride ?? (teacherTourSteps.length + TEACHER_PROGRESS_TOUR_STEP_COUNT),
    [teacherTourDisplayTotalOverride, teacherTourSteps.length],
  );

  const teacherTourCurrentStepIndex = useMemo(() => {
    if (!teacherTourActiveStepId) return 0;
    const resolvedIndex = teacherTourSteps.findIndex((tourStep) => tourStep.id === teacherTourActiveStepId);
    return resolvedIndex >= 0 ? resolvedIndex : 0;
  }, [teacherTourActiveStepId, teacherTourSteps]);

  const handleTeacherTourStepChange = useCallback(
    (nextStepIndex: number) => {
      if (nextStepIndex < 0) return;
      const currentStepId = teacherTourSteps[teacherTourCurrentStepIndex]?.id ?? teacherTourActiveStepId;
      const isAdvancing = nextStepIndex === teacherTourCurrentStepIndex + 1;
      const shownCurrentStepNumber = teacherTourDisplayOffset + teacherTourCurrentStepIndex + 1;

      if (currentStepId === "menu-progress" && isAdvancing) {
        setTeacherTourResumeMeta(null);
        setTeacherTourRun(false);
        setTeacherTourActiveStepId(null);
        setTeacherTourLockedSteps(null);
        setTeacherTourDisplayOffset(0);
        setTeacherTourDisplayTotalOverride(null);
        setNotificationsOpen(false);
        setTeacherMenuOpen(false);
        setRequestOpen(false);
        setTeacherQueriesOpen(false);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(TEACHER_TOUR_STORAGE_KEY, "done");
          window.localStorage.setItem(TEACHER_PROGRESS_TOUR_FORCE_KEY, "1");
          window.localStorage.setItem(
            TEACHER_PROGRESS_TOUR_CHAIN_KEY,
            JSON.stringify({
              offset: shownCurrentStepNumber,
              returnToDashboard: true,
              resumeStepId: "menu-queries",
              total: teacherTourDisplayTotal,
            }),
          );
        }
        router.push("/teacher/progress");
        return;
      }

      if (nextStepIndex >= teacherTourSteps.length) {
        closeTeacherTour(true);
        return;
      }
      const nextStepId = teacherTourSteps[nextStepIndex]?.id;
      if (!nextStepId) {
        closeTeacherTour(true);
        return;
      }
      setTeacherTourResumeMeta(null);
      setTeacherTourActiveStepId(nextStepId);
    },
    [
      closeTeacherTour,
      router,
      teacherTourActiveStepId,
      teacherTourCurrentStepIndex,
      teacherTourDisplayOffset,
      teacherTourDisplayTotal,
      teacherTourSteps,
    ],
  );

  useEffect(() => {
    if (!teacherTourRun) return;
    const stepId = teacherTourActiveStepId ?? teacherTourSteps[teacherTourCurrentStepIndex]?.id;
    if (!stepId) return;

    const menuStepIds = new Set([
      "menu-panel",
      "menu-raise-request",
      "menu-progress",
      "menu-queries",
      "menu-signout",
    ]);
    const requestStepIds = new Set(["request-modal", "request-mode", "request-date", "request-send"]);
    const requestAnyOtherFlowStepIds = new Set([
      "request-any-other",
      "request-notes",
      "request-date-any-other",
      "request-send-any-other",
    ]);
    const notificationStepIds = new Set(["notification-panel", "notification-query-shortcut"]);
    const inboxStepIds = new Set([
      "inbox-panel",
      "inbox-refresh",
      "inbox-list",
      "inbox-conversation",
      "inbox-reply",
    ]);

    setTeacherMenuOpen(menuStepIds.has(stepId));
    setRequestOpen(requestStepIds.has(stepId) || requestAnyOtherFlowStepIds.has(stepId));
    if (requestAnyOtherFlowStepIds.has(stepId)) {
      setRequestMode("vr");
      setRequestItems((prev) => (prev.includes(ANY_OTHER_OPTION) ? prev : [ANY_OTHER_OPTION]));
    }
    setNotificationsOpen(notificationStepIds.has(stepId));
    setTeacherQueriesOpen(inboxStepIds.has(stepId));
    if (inboxStepIds.has(stepId)) {
      void loadTeacherQueries();
    }
  }, [loadTeacherQueries, teacherTourActiveStepId, teacherTourCurrentStepIndex, teacherTourRun, teacherTourSteps]);

  useEffect(() => {
    if (!teacherTourRun) return;
    if (teacherTourSteps.length === 0) {
      closeTeacherTour(false);
      return;
    }
    const activeStepExists =
      !!teacherTourActiveStepId && teacherTourSteps.some((tourStep) => tourStep.id === teacherTourActiveStepId);
    if (!activeStepExists) {
      setTeacherTourActiveStepId(teacherTourSteps[0]?.id ?? null);
    }
  }, [
    closeTeacherTour,
    teacherTourActiveStepId,
    teacherTourRun,
    teacherTourSteps,
  ]);

  useEffect(() => {
    if (role !== "teacher" || !authChecked || !isAuthenticated || teacherTourInitialized) return;
    if (dataStatus === "Loading activities...") return;
    if (typeof window === "undefined") return;

    const resumeRaw = window.localStorage.getItem(TEACHER_DASHBOARD_TOUR_RESUME_KEY);
    if (resumeRaw) {
      window.localStorage.removeItem(TEACHER_DASHBOARD_TOUR_RESUME_KEY);
      try {
        const parsed = JSON.parse(resumeRaw) as {
          stepId?: unknown;
          displayOffset?: unknown;
          displayTotal?: unknown;
        };
        const stepId = typeof parsed.stepId === "string" ? parsed.stepId : "";
        if (stepId) {
          const completedCount =
            typeof parsed.displayOffset === "number" && Number.isFinite(parsed.displayOffset)
              ? parsed.displayOffset
              : 0;
          const displayTotal =
            typeof parsed.displayTotal === "number" && Number.isFinite(parsed.displayTotal) && parsed.displayTotal > 0
              ? parsed.displayTotal
              : null;
          setTeacherTourResumeMeta({ stepId, completedCount, displayTotal });
          setTeacherTourInitialized(true);
          return;
        }
      } catch {
        // ignore invalid resume payload
      }
    }

    const autoStart = window.sessionStorage.getItem(TEACHER_TOUR_AUTOSTART_KEY) === "1";
    const teacherTourStatus = window.localStorage.getItem(TEACHER_TOUR_STORAGE_KEY);
    const hasTeacherTourPreference = teacherTourStatus === "done" || teacherTourStatus === "skipped";
    if (autoStart) {
      window.sessionStorage.removeItem(TEACHER_TOUR_AUTOSTART_KEY);
    }
    if (autoStart) {
      setTeacherTourLockedSteps(teacherTourComputedSteps);
      setTeacherTourDisplayOffset(0);
      setTeacherTourDisplayTotalOverride(null);
      setTeacherTourActiveStepId(teacherTourComputedSteps[0]?.id ?? null);
      setTeacherTourRun(true);
      setTeacherTourPromptOpen(false);
    } else {
      setTeacherTourRun(false);
      setTeacherTourPromptOpen(!hasTeacherTourPreference);
    }
    setTeacherTourInitialized(true);
  }, [authChecked, dataStatus, isAuthenticated, role, teacherTourComputedSteps, teacherTourInitialized]);

  useEffect(() => {
    if (!teacherTourResumeMeta) return;
    const resumeIndex = teacherTourSteps.findIndex((tourStep) => tourStep.id === teacherTourResumeMeta.stepId);
    if (resumeIndex < 0) return;

    setTeacherTourPromptOpen(false);
    setTeacherTourLockedSteps(teacherTourComputedSteps);
    setTeacherTourDisplayTotalOverride(teacherTourResumeMeta.displayTotal);
    setTeacherTourDisplayOffset(Math.max(0, teacherTourResumeMeta.completedCount - resumeIndex));
    setTeacherTourActiveStepId(teacherTourResumeMeta.stepId);
    setTeacherTourRun(true);
    setTeacherTourResumeMeta(null);
  }, [teacherTourComputedSteps, teacherTourResumeMeta, teacherTourSteps]);

  const studentTourComputedSteps = useMemo<GuidedTourStep[]>(() => {
    if (role === "teacher") return [];

    const steps: GuidedTourStep[] = [
      {
        id: "student-header",
        target: '[data-tour="student-header"]',
        title: "Student Dashboard Header",
        description: "This is your everyday control point for alerts, menu shortcuts, and quick orientation.",
        placement: "bottom",
      },
      {
        id: "student-notification-bell",
        target: '[data-tour="student-notification-bell"]',
        title: "Notification Bell",
        description: "Open this to review unread updates for your activities.",
        placement: "left",
      },
      {
        id: "student-notification-panel",
        target: '[data-tour="student-notification-panel"]',
        title: "Notification Drawer",
        description: "All your activity and status updates appear in this drawer.",
        placement: "left",
        forcePageTop: true,
      },
      {
        id: "student-menu-trigger",
        target: '[data-tour="student-menu-trigger"]',
        title: "Student Menu",
        description: "Open the menu to ask doubts, go home, or sign out.",
        placement: "left",
      },
      {
        id: "student-menu-panel",
        target: '[data-tour="student-menu-panel"]',
        title: "Student Actions Panel",
        description: "This panel groups your key student workflows in one place.",
        placement: "left",
      },
      {
        id: "student-menu-doubt",
        target: '[data-tour="student-menu-doubt"]',
        title: "Doubt Section Shortcut",
        description: "Use this to open your teacher chat and ask questions.",
        placement: "left",
      },
      {
        id: "student-menu-upload-project",
        target: '[data-tour="student-menu-upload-project"]',
        title: "STEAM-H Project",
        description: "Open this to publish your project to the STEAM-H showcase.",
        placement: "left",
      },
    ];

    if (filteredModules.length > 0) {
      steps.push(
        {
          id: "student-activity-card",
          target: '[data-tour="student-activity-card"]',
          title: "Activity Cards",
          description: "Each card shows module details and completion state.",
          placement: "top",
          forcePageTop: false,
          scrollBlock: "center",
        },
        {
          id: "student-activity-launch",
          target: '[data-tour="student-activity-launch"]',
          title: "Open Activity",
          description: "Launch the activity workspace from this button. Click Next here to continue the tour inside it.",
          placement: "bottom",
          forcePageTop: false,
          scrollBlock: "center",
        },
      );
    }

    steps.push({
      id: "student-menu-signout",
      target: '[data-tour="student-menu-signout"]',
      title: "Sign Out Safely",
      description: "Use this option to end your student session securely.",
      placement: "left",
    });

    return steps;
  }, [filteredModules.length, role]);

  const studentTourSteps = studentTourLockedSteps ?? studentTourComputedSteps;
  const studentTourTargetModule = useMemo(
    () => filteredModules.find((module) => module.id === studentTourTargetModuleId) ?? null,
    [filteredModules, studentTourTargetModuleId],
  );
  const studentActivityTourStepCount = useMemo(() => {
    const normalizedSubject = (studentTourTargetModule?.subject ?? "").toLowerCase();
    return normalizedSubject.includes("design")
      ? STUDENT_ACTIVITY_TOUR_STEP_COUNT_DESIGN
      : STUDENT_ACTIVITY_TOUR_STEP_COUNT_STANDARD;
  }, [studentTourTargetModule]);
  const studentTourExpectedTotal = useMemo(() => {
    const includesActivityLaunch = studentTourSteps.some((tourStep) => tourStep.id === "student-activity-launch");
    if (includesActivityLaunch && studentTourTargetModuleId) {
      return studentTourSteps.length + studentActivityTourStepCount;
    }
    return studentTourSteps.length;
  }, [studentActivityTourStepCount, studentTourSteps, studentTourTargetModuleId]);

  useEffect(() => {
    if (!studentTourResumeMeta) return;
    const resumeIndex = studentTourSteps.findIndex((tourStep) => tourStep.id === studentTourResumeMeta.stepId);
    if (resumeIndex < 0) return;

    setStudentTourPromptOpen(false);
    setStudentTourLockedSteps(studentTourComputedSteps);
    setStudentTourDisplayTotalOverride(studentTourResumeMeta.displayTotal);
    setStudentTourDisplayOffset(Math.max(0, studentTourResumeMeta.completedCount - resumeIndex));
    setStudentTourActiveStepId(studentTourResumeMeta.stepId);
    setStudentTourRun(true);
    setStudentTourResumeMeta(null);
  }, [studentTourComputedSteps, studentTourResumeMeta, studentTourSteps]);

  const startStudentTour = useCallback(() => {
    setNotificationsOpen(false);
    setTeacherMenuOpen(false);
    setStudentDoubtOpen(false);
    setStudentTourPromptOpen(false);
    setStudentTourLockedSteps(studentTourComputedSteps);
    setStudentTourActiveStepId(studentTourComputedSteps[0]?.id ?? null);
    setStudentTourDisplayOffset(0);
    setStudentTourDisplayTotalOverride(null);
    setStudentTourResumeMeta(null);
    setStudentTourRun(true);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STUDENT_TOUR_STORAGE_KEY);
      window.localStorage.removeItem(STUDENT_DASHBOARD_TOUR_RESUME_KEY);
      window.localStorage.removeItem(STUDENT_ACTIVITY_TOUR_CHAIN_KEY);
    }
  }, [studentTourComputedSteps]);

  const closeStudentTour = useCallback((completed: boolean) => {
    setStudentTourRun(false);
    setStudentTourActiveStepId(null);
    setStudentTourLockedSteps(null);
    setStudentTourPromptOpen(false);
    setStudentTourDisplayOffset(0);
    setStudentTourDisplayTotalOverride(null);
    setStudentTourResumeMeta(null);
    setNotificationsOpen(false);
    setTeacherMenuOpen(false);
    setStudentDoubtOpen(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STUDENT_TOUR_STORAGE_KEY, completed ? "done" : "skipped");
      window.localStorage.removeItem(STUDENT_DASHBOARD_TOUR_RESUME_KEY);
      window.localStorage.removeItem(STUDENT_ACTIVITY_TOUR_CHAIN_KEY);
    }
  }, []);

  const studentTourCurrentStepIndex = useMemo(() => {
    if (!studentTourActiveStepId) return 0;
    const resolvedIndex = studentTourSteps.findIndex((tourStep) => tourStep.id === studentTourActiveStepId);
    return resolvedIndex >= 0 ? resolvedIndex : 0;
  }, [studentTourActiveStepId, studentTourSteps]);

  const studentTourDisplayTotal = useMemo(
    () =>
      studentTourDisplayTotalOverride ??
      (studentTourDisplayOffset > 0
        ? studentTourDisplayOffset + studentTourSteps.length
        : studentTourExpectedTotal),
    [studentTourDisplayOffset, studentTourDisplayTotalOverride, studentTourExpectedTotal, studentTourSteps.length],
  );

  const handleStudentTourStepChange = useCallback(
    (nextStepIndex: number) => {
      if (nextStepIndex < 0) return;
      const currentStepId = studentTourSteps[studentTourCurrentStepIndex]?.id ?? studentTourActiveStepId;
      const isAdvancing = nextStepIndex === studentTourCurrentStepIndex + 1;
      const shownCurrentStepNumber = studentTourDisplayOffset + studentTourCurrentStepIndex + 1;

      if (currentStepId === "student-activity-launch" && isAdvancing) {
        const targetModuleId = studentTourTargetModuleId;
        if (targetModuleId) {
          setStudentTourRun(false);
          setStudentTourActiveStepId(null);
          setStudentTourLockedSteps(null);
          setStudentTourPromptOpen(false);
          setNotificationsOpen(false);
          setTeacherMenuOpen(false);
          setStudentDoubtOpen(false);
          setStudentTourResumeMeta(null);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(STUDENT_TOUR_STORAGE_KEY, "done");
            window.sessionStorage.setItem(STUDENT_ACTIVITY_TOUR_AUTOSTART_KEY, "1");
            window.localStorage.setItem(
              STUDENT_ACTIVITY_TOUR_CHAIN_KEY,
              JSON.stringify({
                offset: shownCurrentStepNumber,
                returnToDashboard: true,
                resumeStepId: "student-menu-signout",
                total: studentTourDisplayTotal,
              }),
            );
            window.localStorage.removeItem(STUDENT_DASHBOARD_TOUR_RESUME_KEY);
          }
          router.push(`/customer/activity/${targetModuleId}`);
          return;
        }
      }

      if (nextStepIndex >= studentTourSteps.length) {
        closeStudentTour(true);
        return;
      }
      const nextStepId = studentTourSteps[nextStepIndex]?.id;
      if (!nextStepId) {
        closeStudentTour(true);
        return;
      }
      setStudentTourActiveStepId(nextStepId);
    },
    [
      closeStudentTour,
      router,
      studentTourDisplayOffset,
      studentTourDisplayTotal,
      studentTourTargetModuleId,
      studentTourActiveStepId,
      studentTourCurrentStepIndex,
      studentTourSteps,
    ],
  );

  useEffect(() => {
    if (!studentTourRun) return;
    const stepId = studentTourActiveStepId ?? studentTourSteps[studentTourCurrentStepIndex]?.id;
    if (!stepId) return;

    const menuStepIds = new Set([
      "student-menu-panel",
      "student-menu-doubt",
      "student-menu-upload-project",
      "student-menu-signout",
    ]);
    const doubtStepIds = new Set([
      "student-doubt-teacher-select",
      "student-doubt-list",
      "student-doubt-reply",
    ]);
    const notificationStepIds = new Set(["student-notification-panel"]);

    setTeacherMenuOpen(menuStepIds.has(stepId));
    setStudentDoubtOpen(doubtStepIds.has(stepId));
    setNotificationsOpen(notificationStepIds.has(stepId));
    if (doubtStepIds.has(stepId) && availableTeachers.length === 0) {
      void loadAvailableTeachers();
    }
  }, [
    availableTeachers.length,
    loadAvailableTeachers,
    studentTourActiveStepId,
    studentTourCurrentStepIndex,
    studentTourRun,
    studentTourSteps,
  ]);

  useEffect(() => {
    if (!studentTourRun) return;
    if (studentTourSteps.length === 0) {
      closeStudentTour(false);
      return;
    }
    const activeStepExists =
      !!studentTourActiveStepId && studentTourSteps.some((tourStep) => tourStep.id === studentTourActiveStepId);
    if (!activeStepExists) {
      setStudentTourActiveStepId(studentTourSteps[0]?.id ?? null);
    }
  }, [closeStudentTour, studentTourActiveStepId, studentTourRun, studentTourSteps]);

  useEffect(() => {
    if (role === "teacher" || !authChecked || !isAuthenticated || studentTourInitialized) return;
    if (dataStatus === "Loading activities...") return;
    if (typeof window === "undefined") return;

    const resumeRaw = window.localStorage.getItem(STUDENT_DASHBOARD_TOUR_RESUME_KEY);
    if (resumeRaw) {
      window.localStorage.removeItem(STUDENT_DASHBOARD_TOUR_RESUME_KEY);
      try {
        const parsed = JSON.parse(resumeRaw) as {
          stepId?: unknown;
          displayOffset?: unknown;
          displayTotal?: unknown;
        };
        const stepId = typeof parsed.stepId === "string" ? parsed.stepId : "";
        if (stepId) {
          const completedCount =
            typeof parsed.displayOffset === "number" && Number.isFinite(parsed.displayOffset)
              ? parsed.displayOffset
              : 0;
          const displayTotal =
            typeof parsed.displayTotal === "number" && Number.isFinite(parsed.displayTotal) && parsed.displayTotal > 0
              ? parsed.displayTotal
              : null;
          setStudentTourResumeMeta({ stepId, completedCount, displayTotal });
          setStudentTourPromptOpen(false);
          setStudentTourRun(false);
          setStudentTourInitialized(true);
          return;
        }
      } catch {
        setStudentTourDisplayOffset(0);
        setStudentTourDisplayTotalOverride(null);
        setStudentTourResumeMeta(null);
      }
    }

    const studentTourStatus = window.localStorage.getItem(STUDENT_TOUR_STORAGE_KEY);
    const hasStudentTourPreference = studentTourStatus === "done" || studentTourStatus === "skipped";
    setStudentTourRun(false);
    setStudentTourPromptOpen(!hasStudentTourPreference);
    setStudentTourInitialized(true);
  }, [authChecked, dataStatus, isAuthenticated, role, studentTourInitialized]);

  return (
    <main className="section-padding space-y-8">
      {role === "teacher" && (
        <GuidedTour
          run={teacherTourRun}
          stepIndex={teacherTourCurrentStepIndex}
          steps={teacherTourSteps}
          onStepIndexChange={handleTeacherTourStepChange}
          onClose={closeTeacherTour}
          displayStepOffset={teacherTourDisplayOffset}
          displayStepTotal={teacherTourDisplayTotal}
          palette={TEACHER_TOUR_PALETTE}
        />
      )}

      {role !== "teacher" && (
        <GuidedTour
          run={studentTourRun}
          stepIndex={studentTourCurrentStepIndex}
          steps={studentTourSteps}
          onStepIndexChange={handleStudentTourStepChange}
          onClose={closeStudentTour}
          displayStepOffset={studentTourDisplayOffset > 0 ? studentTourDisplayOffset : undefined}
          displayStepTotal={studentTourDisplayTotal}
          palette={STUDENT_TOUR_PALETTE}
        />
      )}

      {role === "teacher" && teacherTourPromptOpen && !teacherTourRun && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-14" style={{ background: "rgba(15, 23, 42, 0.14)" }}>
          <div
            className="w-full max-w-lg rounded-2xl p-5"
            style={{
              border: `1px solid color-mix(in srgb, ${TEACHER_TOUR_PALETTE.accent} 28%, transparent)`,
              background: "var(--surface)",
              color: "var(--foreground)",
              boxShadow:
                `0 18px 42px rgba(15, 23, 42, 0.18), 0 0 0 1px color-mix(in srgb, ${TEACHER_TOUR_PALETTE.accent} 12%, transparent)`,
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                borderRadius: 999,
                border: `1px solid color-mix(in srgb, ${TEACHER_TOUR_PALETTE.accent} 40%, transparent)`,
                background: `color-mix(in srgb, ${TEACHER_TOUR_PALETTE.accent} 10%, #ffffff)`,
                padding: "2px 10px",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: TEACHER_TOUR_PALETTE.accentStrong,
              }}
            >
              Teacher Walkthrough
            </span>
            <h3 className="mt-3 text-2xl font-semibold" style={{ color: TEACHER_TOUR_PALETTE.accentStrong }}>
              Take Tour
            </h3>
            <p className="mt-2 text-sm" style={{ color: "color-mix(in srgb, var(--foreground) 82%, #64748b)" }}>
              Start a guided walkthrough of all teacher features from this dashboard.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  void playUiClickTone();
                  startTeacherTour();
                }}
                style={{
                  borderRadius: 8,
                  border: `1px solid color-mix(in srgb, ${TEACHER_TOUR_PALETTE.accentStrong} 42%, transparent)`,
                  background: TEACHER_TOUR_PALETTE.accent,
                  color: "#ffffff",
                  padding: "8px 14px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Take tour
              </button>
              <button
                type="button"
                onClick={() => {
                  void playUiClickTone();
                  closeTeacherTour(false);
                }}
                style={{
                  borderRadius: 8,
                  border: `1px solid color-mix(in srgb, ${TEACHER_TOUR_PALETTE.accent} 32%, transparent)`,
                  background: "color-mix(in srgb, var(--background-2) 70%, #ffffff)",
                  color: TEACHER_TOUR_PALETTE.accentStrong,
                  padding: "8px 12px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {role !== "teacher" && studentTourPromptOpen && !studentTourRun && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-14" style={{ background: "rgba(15, 23, 42, 0.14)" }}>
          <div
            className="w-full max-w-lg rounded-2xl p-5"
            style={{
              border: `1px solid color-mix(in srgb, ${STUDENT_TOUR_PALETTE.accent} 28%, transparent)`,
              background: "var(--surface)",
              color: "var(--foreground)",
              boxShadow:
                `0 18px 42px rgba(15, 23, 42, 0.18), 0 0 0 1px color-mix(in srgb, ${STUDENT_TOUR_PALETTE.accent} 12%, transparent)`,
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                borderRadius: 999,
                border: `1px solid color-mix(in srgb, ${STUDENT_TOUR_PALETTE.accent} 40%, transparent)`,
                background: `color-mix(in srgb, ${STUDENT_TOUR_PALETTE.accent} 10%, #ffffff)`,
                padding: "2px 10px",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: STUDENT_TOUR_PALETTE.accentStrong,
              }}
            >
              Student Walkthrough
            </span>
            <h3 className="mt-3 text-2xl font-semibold" style={{ color: STUDENT_TOUR_PALETTE.accentStrong }}>
              Take Tour
            </h3>
            <p className="mt-2 text-sm" style={{ color: "color-mix(in srgb, var(--foreground) 82%, #64748b)" }}>
              Start a guided walkthrough of all student features from this dashboard.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  void playUiClickTone();
                  startStudentTour();
                }}
                style={{
                  borderRadius: 8,
                  border: `1px solid color-mix(in srgb, ${STUDENT_TOUR_PALETTE.accentStrong} 42%, transparent)`,
                  background: STUDENT_TOUR_PALETTE.accent,
                  color: "#ffffff",
                  padding: "8px 14px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Take tour
              </button>
              <button
                type="button"
                onClick={() => {
                  void playUiClickTone();
                  closeStudentTour(false);
                }}
                style={{
                  borderRadius: 8,
                  border: `1px solid color-mix(in srgb, ${STUDENT_TOUR_PALETTE.accent} 32%, transparent)`,
                  background: "color-mix(in srgb, var(--background-2) 70%, #ffffff)",
                  color: STUDENT_TOUR_PALETTE.accentStrong,
                  padding: "8px 12px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {dataStatus && (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
          {dataStatus}
        </div>
      )}

      {requestOpen && role === "teacher" && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 pb-10 pt-12 md:pt-16 bg-slate-900/70 backdrop-blur-sm">
          <div
            className="w-full max-w-3xl rounded-2xl bg-white border border-stone-300 shadow-2xl p-6 space-y-4"
            data-tour="teacher-request-modal"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-accent-strong">Teacher Request</p>
                <h3 className="text-2xl font-semibold text-slate-900">Request content</h3>
                <p className="text-sm text-slate-600">
                  {vrSubjectKey
                    ? "Pick what you need."
                    : "Add your subject in your profile to request content."}
                </p>
              </div>
              <button
                className="text-sm px-3 py-1 rounded-lg border border-rose-400 bg-rose-700 text-true-white hover:bg-rose-600 hover:border-rose-300 cursor-pointer"
                onClick={() => {
                  closeRequestModal();
                  resetRequestForm();
                }}
              >
                Close
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3" data-tour="teacher-request-mode">
              <button
                type="button"
                data-tour="teacher-request-mode-vr"
                className={`w-full text-left rounded-xl border px-4 py-3 transition ${
                  requestMode === "vr"
                    ? "border-accent bg-accent text-true-white font-semibold shadow-glow"
                    : "border-slate-300 bg-slate-50 text-slate-900 hover:border-accent"
                }`}
                onClick={() => setRequestMode("vr")}
              >
                <p
                  className={`text-sm font-semibold ${
                    requestMode === "vr" ? "text-true-white" : "text-slate-900"
                  }`}
                >
                  VR simulations
                </p>
                <p
                  className={`text-xs mt-1 ${
                    requestMode === "vr" ? "text-true-white/90" : "text-slate-900/80"
                  }`}
                >
                  Select ready-made VR labs by topic.
                </p>
              </button>
              <button
                type="button"
                className={`w-full text-left rounded-xl border px-4 py-3 transition ${
                  requestMode === "drone"
                    ? "border-accent bg-accent text-true-white font-semibold shadow-glow"
                    : "border-slate-300 bg-slate-50 text-slate-900 hover:border-accent"
                }`}
                onClick={() => setRequestMode("drone")}
              >
                <p
                  className={`text-sm font-semibold ${
                    requestMode === "drone" ? "text-true-white" : "text-slate-900"
                  }`}
                >
                  Drone activity
                </p>
                <p
                  className={`text-xs mt-1 ${
                    requestMode === "drone" ? "text-true-white/90" : "text-slate-900/80"
                  }`}
                >
                  Describe a concept to deliver with drones.
                </p>
              </button>
            </div>

            {requestMode === "vr" ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-800">VR simulations</p>
                {vrItems.length === 0 && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {vrSubjectKey
                      ? "No VR simulations listed for this subject yet. You can still request a custom one."
                      : "Subject not set; ask an admin to assign your subject."}
                  </div>
                )}
                <div className="grid sm:grid-cols-2 gap-2 max-h-72 overflow-auto p-1">
                  {vrItems.map((item) => (
                    <label
                      key={item}
                      className={`flex items-start gap-2 rounded-xl border border-slate-200 ring-1 ring-inset ring-blue-500/40 bg-white px-3 py-2 text-sm text-slate-800 hover:border-accent-strong ${
                        anyOtherSelected ? "opacity-60" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 rounded border-slate-400/70 bg-white outline outline-1 outline-slate-300/60"
                        checked={requestItems.includes(item)}
                        onChange={() => toggleRequestItem(item)}
                        disabled={anyOtherSelected}
                      />
                      <span className="font-semibold text-slate-900">{item}</span>
                    </label>
                  ))}
                  <label
                    data-tour="teacher-request-any-other"
                    className="flex items-start gap-2 rounded-xl border border-accent/40 ring-1 ring-inset ring-blue-500/40 bg-accent/10 px-3 py-2 text-sm text-slate-800 hover:border-accent-strong"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-slate-400/70 bg-white outline outline-1 outline-slate-300/60"
                      checked={anyOtherSelected}
                      onChange={() => toggleRequestItem(ANY_OTHER_OPTION)}
                    />
                    <span className="font-semibold">Any other</span>
                  </label>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-800">Drone activity concept</p>
                <textarea
                  value={droneConcept}
                  onChange={(e) => setDroneConcept(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-accent focus:outline-none"
                  placeholder="Describe the concept or outcome you want to deliver with the drone activity."
                />
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-sm text-slate-700 space-y-2">
                <span className="font-semibold text-slate-900">Needed by</span>
                <input
                  type="date"
                  data-tour="teacher-request-date"
                  value={requestDate}
                  onChange={(e) => setRequestDate(e.target.value)}
                  min={requestMinDate}
                  title={dateHelpText}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-accent focus:outline-none"
                />
                <p
                  className={`text-xs ${
                    requestMode === "drone" || (requestMode === "vr" && anyOtherSelected)
                      ? "font-semibold text-black"
                      : "text-slate-500"
                  }`}
                >
                  {dateHelpText}
                </p>
              </label>
              <label className="text-sm text-slate-700 space-y-2">
                <span className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">Extra notes</span>
                  {requestMode === "vr" && anyOtherSelected && <span className="text-rose-400">*</span>}
                  <span className="text-xs text-slate-500 font-semibold">
                    {requestMode === "vr" && anyOtherSelected ? "" : "(optional)"}
                  </span>
                </span>
                <textarea
                  data-tour="teacher-request-notes"
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-accent focus:outline-none"
                  placeholder={
                    requestMode === "vr" && anyOtherSelected
                      ? "Describe the VR module you require."
                      : "Describe what you need added or any context for admin."
                  }
                  aria-required={requestMode === "vr" && anyOtherSelected}
                  required={requestMode === "vr" && anyOtherSelected}
                />
              </label>
            </div>

            {requestStatus && (
              <div
                className={`rounded-xl border px-4 py-3 text-sm ${
                  requestStatus === "Select at least one VR simulation."
                    ? "border-rose-500/50 bg-rose-500/15 text-rose-700 font-semibold"
                    : requestStatus === "Pick the date when you need this content."
                      ? "border-sky-500/50 bg-sky-500/15 text-sky-700 font-semibold"
                      : requestStatus === "Sending request..."
                        ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-700 font-semibold"
                    : "border-slate-300 bg-slate-50 text-slate-700"
                }`}
              >
                {requestStatus}
              </div>
            )}

            <div className="flex flex-wrap gap-3 justify-end">
              <button
                className="px-4 py-2 rounded-xl border border-accent text-accent-strong font-semibold hover:bg-accent/10"
                onClick={() => {
                  closeRequestModal();
                  resetRequestForm();
                }}
              >
                Cancel
              </button>
              <button
                data-tour="teacher-request-send"
                className="px-4 py-2 rounded-xl bg-accent text-true-white font-semibold shadow-glow disabled:opacity-60"
                onClick={() => void submitVrRequest()}
                disabled={sendingRequest}
              >
                {sendingRequest ? "Sending..." : "Send to Admin"}
              </button>
            </div>
          </div>
        </div>
      )}

      {studentDoubtOpen && role !== "teacher" && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 pb-8 pt-8 bg-slate-900/70 backdrop-blur-sm">
          <div
            className="relative w-full max-w-5xl h-[88vh] rounded-3xl bg-surface border border-white/15 shadow-2xl overflow-hidden"
            data-tour="student-doubt-modal"
          >
            <div className="flex h-full flex-col md:flex-row" data-tour="student-doubt-workspace">
              <aside className="w-full md:w-[320px] md:max-w-[320px] border-b md:border-b-0 md:border-r border-slate-200 bg-surface flex flex-col">
                <div className="p-4 border-b border-slate-200 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-accent-strong">Student Inbox</p>
                      <h3 className="text-xl font-semibold text-slate-900">Ask your Doubts</h3>
                    </div>
                    <button
                      className="text-sm px-3 py-1 rounded-lg border border-rose-400 bg-rose-700 text-true-white hover:bg-rose-600 hover:border-rose-300 cursor-pointer"
                      onClick={() => {
                        setStudentDoubtOpen(false);
                        setStudentDoubtStatus(null);
                        setTeacherPickerOpen(false);
                      }}
                    >
                      Close
                    </button>
                  </div>

                  <div className="block text-xs text-slate-600 space-y-1">
                    <span className="font-semibold text-slate-900">Available teachers</span>
                    <button
                      type="button"
                      data-tour="student-doubt-teacher-select"
                      onClick={() => setTeacherPickerOpen((open) => !open)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900 hover:bg-slate-50"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate">{selectedTeacherLabel}</span>
                        <span className="text-xs text-slate-500">{teacherPickerOpen ? "Hide" : "Choose"}</span>
                      </span>
                    </button>
                    {teacherPickerOpen && (
                      <div className="max-h-28 overflow-y-auto space-y-1 rounded-xl border border-slate-300 bg-white p-1.5">
                        {availableTeachers.length === 0 ? (
                          <p className="px-2 py-1 text-xs text-slate-500">No teachers available</p>
                        ) : (
                          availableTeachers.map((teacher) => {
                            const isSelected = selectedTeacherId === teacher.id;
                            return (
                              <button
                                key={teacher.id}
                                type="button"
                                onClick={() => {
                                  setSelectedTeacherId(teacher.id);
                                  setTeacherPickerOpen(false);
                                  setActiveStudentQueryId(null);
                                  setQueryMessagesStatus(null);
                                  setStudentDoubtStatus(null);
                                  void loadStudentQueries(teacher.id);
                                }}
                                className={`w-full rounded-lg px-2 py-1.5 text-left text-sm transition ${
                                  isSelected
                                    ? "bg-accent text-true-white font-semibold"
                                    : "text-slate-800 hover:bg-slate-100"
                                }`}
                              >
                                {teacher.full_name}
                                {teacher.subject ? ` (${teacher.subject})` : ""}
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  {availableTeachersStatus && (
                    <p className="text-xs text-slate-500">{availableTeachersStatus}</p>
                  )}
                  {studentQueriesStatus && (
                    <p className="text-xs text-slate-500">{studentQueriesStatus}</p>
                  )}
                </div>

                <div className="max-h-56 md:max-h-none md:flex-1 overflow-y-auto p-3 space-y-2 bg-card/40" data-tour="student-doubt-list">
                  {filteredStudentQueries.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-surface px-3 py-2 text-xs text-slate-600">
                      No chats yet.
                    </div>
                  ) : (
                    filteredStudentQueries.map((query) => (
                      <button
                        key={query.id}
                        type="button"
                        onClick={() => {
                          setActiveStudentQueryId(query.id);
                          void loadQueryMessages(query.id);
                        }}
                        className={`w-full text-left rounded-2xl border p-3 transition ${
                          query.status === "new"
                            ? "border-orange-400 bg-orange-100 hover:bg-orange-100"
                            : "border-emerald-300 bg-emerald-50 hover:bg-emerald-50"
                        } ${activeStudentQueryId === query.id ? "ring-2 ring-accent/45" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="h-9 w-9 rounded-full bg-accent text-true-white text-xs font-bold flex items-center justify-center">
                              {query.teacher_name.charAt(0).toUpperCase()}
                            </span>
                            <p className="text-sm font-semibold text-slate-900 truncate">{query.teacher_name}</p>
                          </div>
                          <span
                            className={`text-[10px] font-bold tracking-wide shrink-0 ${
                              query.status === "new"
                                ? "px-2 py-0.5 rounded-full bg-orange-600 text-true-white"
                                : "text-emerald-700 italic"
                            }`}
                          >
                            {query.status === "new" ? "UNREAD" : "Opened"}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-700">{new Date(query.created_at).toLocaleDateString()}</p>
                        <p className="mt-1 text-xs text-slate-700 truncate">{query.query_text}</p>
                      </button>
                    ))
                  )}
                </div>
              </aside>

              <section className="min-h-0 flex-1 flex flex-col whatsapp-chat-wallpaper" data-tour="student-doubt-conversation">
                <div className="border-b border-slate-200 bg-white/80 backdrop-blur-sm px-5 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="h-10 w-10 rounded-full bg-accent text-true-white text-sm font-bold flex items-center justify-center">
                      {(activeStudentQuery?.teacher_name ?? selectedTeacher?.full_name ?? "T").charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {activeStudentQuery?.teacher_name ?? selectedTeacher?.full_name ?? "Select a teacher"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {activeStudentQuery || selectedTeacher ? "Direct chat" : "Choose a teacher to start"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                  {!activeStudentQuery ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="max-w-sm text-center space-y-2">
                        <p className="text-base font-semibold text-slate-900">
                          {selectedTeacher ? `Chat with ${selectedTeacher.full_name}` : "Your messages"}
                        </p>
                        <p className="text-sm text-slate-600">
                          {selectedTeacher
                            ? "Type your message below and press Start chat."
                            : "Choose a teacher from the left panel to begin."}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-center">
                        <span className="rounded-full border border-slate-300 bg-surface px-3 py-1 text-[11px] font-semibold text-slate-700">
                          {formatConversationDate(activeStudentQuery.created_at)}
                        </span>
                      </div>
                      <div className="flex justify-end">
                        <div className="max-w-[82%] rounded-2xl bg-orange-100 border border-orange-200 px-3 py-2 text-sm text-slate-800">
                          <p>{activeStudentQuery.query_text}</p>
                        </div>
                      </div>
                      {(queryMessagesById[activeStudentQuery.id] ?? []).map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.sender_role === "student" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[82%] rounded-2xl border px-3 py-2 text-sm ${
                              message.sender_role === "student"
                                ? "bg-orange-100 border-orange-200 text-slate-800"
                                : "bg-sky-100 border-sky-200 text-slate-800"
                            }`}
                          >
                            <p>{message.message_text}</p>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                <div className="border-t border-slate-200 bg-white/80 backdrop-blur-sm p-3 space-y-2">
                  {chatStatusMessage && (
                    <div
                      className={`rounded-xl border px-3 py-2 text-xs ${
                        chatStatusMessage === "Sending query..." || chatStatusMessage === "Sending message..."
                          ? "border-sky-300 bg-sky-50 text-sky-700"
                          : chatStatusMessage === "Query sent to teacher."
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                            : "border-rose-300 bg-rose-50 text-rose-700"
                      }`}
                    >
                      {chatStatusMessage}
                    </div>
                  )}

                  <div
                    className="rounded-2xl border border-slate-300 bg-surface p-2 flex items-end gap-2"
                    data-tour="student-doubt-reply"
                  >
                    <textarea
                      value={studentDoubtText}
                      onChange={(e) => setStudentDoubtText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void handleStudentSendMessage();
                        }
                      }}
                      rows={2}
                      className="flex-1 resize-none rounded-xl border-0 bg-transparent px-2 py-1 text-sm text-slate-900 focus:outline-none"
                      placeholder="Type your message..."
                    />
                    <button
                      className="px-4 py-2 rounded-xl bg-accent text-true-white text-sm font-semibold shadow-glow disabled:opacity-60"
                      onClick={() => {
                        void handleStudentSendMessage();
                      }}
                      disabled={sendingStudentDoubt || sendingMessage}
                    >
                      {sendingStudentDoubt || sendingMessage
                        ? "Sending..."
                        : activeStudentQueryId
                          ? "Send"
                          : "Start chat"}
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {teacherQueriesOpen && role === "teacher" && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 pb-8 pt-8 bg-slate-900/70 backdrop-blur-sm">
          <div
            className="w-full max-w-5xl h-[88vh] rounded-3xl bg-surface border border-white/15 shadow-2xl overflow-hidden"
            data-tour="teacher-inbox-modal"
          >
            <div className="flex h-full flex-col md:flex-row">
              <aside className="w-full md:w-[320px] md:max-w-[320px] border-b md:border-b-0 md:border-r border-slate-200 bg-surface flex flex-col">
                <div className="p-4 border-b border-slate-200 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-accent-strong">Teacher Inbox</p>
                      <h3 className="text-xl font-semibold text-slate-900">Student queries</h3>
                    </div>
                    <button
                      className="text-sm px-3 py-1 rounded-lg border border-rose-400 bg-rose-700 text-true-white hover:bg-rose-600 hover:border-rose-300 cursor-pointer"
                      onClick={() => setTeacherQueriesOpen(false)}
                    >
                      Close
                    </button>
                  </div>

                  <button
                    type="button"
                    data-tour="teacher-inbox-refresh"
                    className="w-full px-3 py-2 rounded-xl border border-accent text-accent-strong text-sm font-semibold hover:bg-accent/10"
                    onClick={() => void loadTeacherQueries()}
                  >
                    Refresh
                  </button>

                  {teacherQueriesStatus && (
                    <p className="text-xs text-slate-500">{teacherQueriesStatus}</p>
                  )}
                </div>

                <div className="max-h-56 md:max-h-none md:flex-1 overflow-y-auto p-3 space-y-2 bg-card/40">
                  {teacherQueries.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-surface px-3 py-2 text-xs text-slate-600">
                      No student queries yet.
                    </div>
                  ) : (
                    teacherQueries.map((query) => (
                      <button
                        key={query.id}
                        type="button"
                        onClick={() => {
                          setActiveTeacherQueryId(query.id);
                          void loadQueryMessages(query.id);
                        }}
                        className={`w-full text-left rounded-2xl border p-3 transition ${
                          query.status === "new"
                            ? "border-orange-400 bg-orange-100 hover:bg-orange-100"
                            : "border-emerald-300 bg-emerald-50 hover:bg-emerald-50"
                        } ${activeTeacherQueryId === query.id ? "ring-2 ring-accent/45" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="h-9 w-9 rounded-full bg-accent text-true-white text-xs font-bold flex items-center justify-center">
                              {query.student_name.charAt(0).toUpperCase()}
                            </span>
                            <p className="text-sm font-semibold text-slate-900 truncate">{query.student_name}</p>
                          </div>
                          <span
                            className={`text-[10px] font-bold tracking-wide shrink-0 ${
                              query.status === "new"
                                ? "px-2 py-0.5 rounded-full bg-orange-600 text-true-white"
                                : "text-emerald-700 italic"
                            }`}
                          >
                            {query.status === "new" ? "UNREAD" : "Opened"}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-700">
                          {new Date(query.created_at).toLocaleDateString()}
                        </p>
                        <p className="mt-1 text-xs text-slate-700 truncate">{query.query_text}</p>
                      </button>
                    ))
                  )}
                </div>
              </aside>

              <section className="min-h-0 flex-1 flex flex-col whatsapp-chat-wallpaper" data-tour="teacher-inbox-conversation">
                <div className="border-b border-slate-200 bg-white/80 backdrop-blur-sm px-5 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="h-10 w-10 rounded-full bg-accent text-true-white text-sm font-bold flex items-center justify-center">
                      {(activeTeacherQuery?.student_name ?? "S").charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {activeTeacherQuery?.student_name ?? "Select a conversation"}
                      </p>
                    </div>
                  </div>
                  {activeTeacherQuery?.status === "new" && (
                    <button
                      type="button"
                      className="px-3 py-1 rounded-lg bg-emerald-600 text-true-white text-xs font-semibold hover:bg-emerald-500 disabled:opacity-50"
                      onClick={() => void markTeacherQueryRead(activeTeacherQuery.id)}
                      disabled={markingTeacherQueryId === activeTeacherQuery.id}
                    >
                      {markingTeacherQueryId === activeTeacherQuery.id ? "Updating..." : "Mark read"}
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                  {!activeTeacherQuery ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="max-w-sm text-center space-y-2">
                        <p className="text-base font-semibold text-slate-900">Student messages</p>
                        <p className="text-sm text-slate-600">
                          Select a conversation from the left to view and reply.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-center">
                        <span className="rounded-full border border-slate-300 bg-surface px-3 py-1 text-[11px] font-semibold text-slate-700">
                          {formatConversationDate(activeTeacherQuery.created_at)}
                        </span>
                      </div>
                      <div className="flex justify-start">
                        <div className="max-w-[82%] rounded-2xl bg-sky-100 border border-sky-200 px-3 py-2 text-sm text-slate-800">
                          <p>{activeTeacherQuery.query_text}</p>
                        </div>
                      </div>
                      {(queryMessagesById[activeTeacherQuery.id] ?? []).map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.sender_role === "teacher" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[82%] rounded-2xl border px-3 py-2 text-sm ${
                              message.sender_role === "teacher"
                                ? "bg-orange-100 border-orange-200 text-slate-800"
                                : "bg-sky-100 border-sky-200 text-slate-800"
                            }`}
                          >
                            <p>{message.message_text}</p>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                <div className="border-t border-slate-200 bg-white/80 backdrop-blur-sm p-3 space-y-2">
                  {queryMessagesStatus && (
                    <div
                      className={`rounded-xl border px-3 py-2 text-xs ${
                        queryMessagesStatus === "Sending message..." || queryMessagesStatus === "Loading conversation..."
                          ? "border-sky-300 bg-sky-50 text-sky-700"
                          : "border-rose-300 bg-rose-50 text-rose-700"
                      }`}
                    >
                      {queryMessagesStatus}
                    </div>
                  )}

                  <div className="rounded-2xl border border-slate-300 bg-surface p-2 flex items-end gap-2">
                    <textarea
                      value={activeTeacherQuery ? teacherReplyDrafts[activeTeacherQuery.id] ?? "" : ""}
                      onChange={(e) => {
                        if (!activeTeacherQuery) return;
                        setTeacherReplyDrafts((prev) => ({ ...prev, [activeTeacherQuery.id]: e.target.value }));
                      }}
                      rows={2}
                      className="flex-1 resize-none rounded-xl border-0 bg-transparent px-2 py-1 text-sm text-slate-900 focus:outline-none disabled:opacity-60"
                      placeholder={activeTeacherQuery ? "Type your reply to student..." : "Select a conversation to reply"}
                      disabled={!activeTeacherQuery}
                    />
                    <button
                      type="button"
                      className="px-4 py-2 rounded-xl bg-accent text-true-white text-sm font-semibold shadow-glow disabled:opacity-60"
                      onClick={async () => {
                        if (!activeTeacherQuery) return;
                        const draft = teacherReplyDrafts[activeTeacherQuery.id] ?? "";
                        const sent = await sendQueryMessage(activeTeacherQuery.id, draft);
                        if (sent) {
                          setTeacherReplyDrafts((prev) => ({ ...prev, [activeTeacherQuery.id]: "" }));
                        }
                      }}
                      disabled={!activeTeacherQuery || sendingMessage}
                    >
                      {sendingMessage ? "Sending..." : "Send"}
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      <div
        className="sticky top-0 z-30 rounded-2xl border border-white/10 bg-surface/65 p-3 shadow-[0_10px_30px_rgba(0,0,0,0.2)] backdrop-blur-xl"
        data-tour={role === "teacher" ? "teacher-header" : "student-header"}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-strong">{roleDisplayLabel}</p>
            <h1 className="text-3xl font-semibold text-white leading-tight">Hi {fullName}</h1>
          </div>

          {role === "teacher" ? (
            <div className="flex items-start gap-3">
              <div className="relative" ref={notificationsRef}>
                <button
                  type="button"
                  onClick={() => {
                    setTeacherMenuOpen(false);
                    setNotificationsOpen((open) => !open);
                  }}
                  data-tour="teacher-notification-bell"
                  className="relative inline-flex items-center justify-center h-11 w-11 rounded-full border border-white/10 outline outline-2 outline-black/50 bg-white/5 hover:border-accent-strong"
                  aria-label="Notifications"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="#facc15"
                    stroke="#111827"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`h-6 w-6 ${teacherBellUnreadCount > 0 ? "customer-bell-ring" : ""}`}
                  >
                    <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.172V11a6 6 0 1 0-12 0v3.172a2 2 0 0 1-.6 1.428L4 17h5" />
                    <path d="M9 17a3 3 0 0 0 6 0" />
                  </svg>
                  {teacherBellUnreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-1 ring-slate-900"></span>
                  )}
                </button>

                {notificationsOpen && (
                  <div
                    className="absolute right-0 mt-2 w-80 max-h-96 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-2xl p-3 space-y-2 z-50 text-slate-900"
                    data-tour="teacher-notification-panel"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold">Notifications</span>
                      <span className="text-xs text-slate-500">{teacherBellUnreadCount} unread</span>
                    </div>
                    <button
                      type="button"
                      data-tour="teacher-notification-query-shortcut"
                      onClick={() => {
                        setNotificationsOpen(false);
                        setTeacherQueriesOpen(true);
                        void loadTeacherQueries();
                      }}
                      className="w-full text-left rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 p-3 transition"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-900">Student Queries</p>
                          <p className="text-xs text-slate-700">Open doubts from students</p>
                        </div>
                        {unreadTeacherQueries > 0 && (
                          <span className="min-w-[22px] h-5 px-1.5 rounded-full bg-red-700 text-yellow-200 text-[11px] font-extrabold flex items-center justify-center leading-none shadow-lg">
                            {unreadTeacherQueries}
                          </span>
                        )}
                      </div>
                    </button>
                    {notificationStatus ? (
                      <div className="text-sm text-slate-600">{notificationStatus}</div>
                    ) : notifications.length === 0 ? (
                      <div className="text-sm text-slate-500">
                        {unreadTeacherQueries > 0 ? "No other notifications." : "No notifications yet."}
                      </div>
                    ) : (
                      notifications.map((note) => (
                        <div
                          key={note.id}
                          className={`rounded-xl border p-3 space-y-1 ${
                            note.status === "unread"
                              ? "bg-emerald-50 border-emerald-200"
                              : "bg-slate-50 border-slate-200"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-slate-900">{note.title}</p>
                              <p className="text-xs text-slate-700">{note.message}</p>
                              <p className="text-[11px] text-slate-500">
                                {new Date(note.created_at).toLocaleString()}
                                {note.subject ? ` | ${note.subject}` : ""}
                              </p>
                            </div>
                            {note.status !== "read" && (
                              <button
                                className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-500 disabled:opacity-50"
                                onClick={() => void markNotificationRead(note.id)}
                                disabled={markingId === note.id}
                              >
                                {markingId === note.id ? "Marking..." : "Mark read"}
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="relative" ref={teacherMenuRef}>
              <button
                type="button"
                aria-expanded={teacherMenuOpen}
                aria-haspopup="menu"
                aria-label="Open teacher menu"
                data-tour="teacher-menu-trigger"
                onClick={() => {
                  setNotificationsOpen(false);
                  setTeacherMenuOpen((open) => !open);
                }}
                className="group flex items-center gap-3 rounded-xl px-4 py-2 bg-emerald-800 hover:bg-emerald-700 text-white font-semibold shadow-md ring-1 ring-white/10 hover:-translate-y-0.5 transition-transform duration-150"
              >
                <span className="sr-only">Open teacher menu</span>
                <span className="space-y-1.5">
                  <span className="block h-0.5 w-5 rounded-full bg-white"></span>
                  <span className="block h-0.5 w-5 rounded-full bg-white"></span>
                  <span className="block h-0.5 w-5 rounded-full bg-white"></span>
                </span>
                <span className="text-sm font-semibold text-white/90">Menu</span>
              </button>

              {teacherMenuOpen && (
                <div
                  className="absolute right-0 mt-3 w-80 rounded-2xl bg-white border border-stone-300 outline outline-1 outline-black/5 shadow-2xl shadow-slate-900/15 ring-1 ring-black/5 p-4 space-y-3 z-40 transition"
                  data-tour="teacher-menu-panel"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.16em] text-accent-strong">Teacher actions</p>
                    <span className="text-[11px] text-slate-400">Quick access</span>
                  </div>
                  <div className="space-y-2">
                    <Link
                      href="/"
                      onClick={() => setTeacherMenuOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-slate-50 hover:bg-purple-50 border border-slate-200 hover:border-purple-300/60 text-sm text-slate-800 transition"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500 border border-purple-300 text-true-white shadow-glow">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-5 w-5"
                        >
                          <path d="M3 11.5 12 4l9 7.5" />
                          <path d="M6 10v9h12v-9" />
                          <path d="M10 19v-5h4v5" />
                        </svg>
                      </span>
                      <div className="text-left">
                        <p className="font-semibold">Back to Home</p>
                        <p className="text-xs text-slate-500">Customer dashboard</p>
                      </div>
                    </Link>
                    <Link
                      href="/simulations"
                      onClick={() => setTeacherMenuOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300/60 text-sm text-slate-800 transition"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 border border-emerald-400 text-true-white shadow-glow">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.9"
                          className="h-5 w-5"
                        >
                          <path d="M7 4h10" />
                          <path d="M9 4v3l-4.5 8a3 3 0 0 0 2.6 4.5h10.8a3 3 0 0 0 2.6-4.5L16 7V4" />
                          <path d="M8 13h8" />
                          <path d="M10 16h4" />
                        </svg>
                      </span>
                      <div className="text-left">
                        <p className="font-semibold">Simulations</p>
                        <p className="text-xs text-slate-500">Open full simulation library</p>
                      </div>
                    </Link>
                    <button
                      data-tour="teacher-menu-raise-request"
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300/60 text-sm text-slate-800 transition"
                      onClick={() => {
                        setTeacherMenuOpen(false);
                        setRequestStatus(null);
                        setRequestOpen(true);
                      }}
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-700 border border-amber-500 text-true-white shadow-glow">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          className="h-5 w-5"
                        >
                          <path d="M12 5v14" />
                          <path d="M5 12h14" />
                        </svg>
                      </span>
                      <div className="text-left">
                        <p className="font-semibold">Raise a Request</p>
                        <p className="text-xs text-slate-500">Ask admin for VR or drone content</p>
                      </div>
                    </button>
                    <Link
                      href="/teacher/progress"
                      data-tour="teacher-menu-progress"
                      onClick={() => setTeacherMenuOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300/60 text-sm text-slate-800 transition"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500 border border-sky-300 text-true-white shadow-glow">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-5 w-5"
                        >
                          <path d="M3 3v18h18" />
                          <path d="m7 14 3-3 3 2 4-5" />
                        </svg>
                      </span>
                      <div className="text-left">
                        <p className="font-semibold">Student Progress</p>
                        <p className="text-xs text-slate-500">Track submissions and attempts</p>
                      </div>
                    </Link>
                    <button
                      type="button"
                      data-tour="teacher-menu-student-queries"
                      onClick={() => {
                        setTeacherMenuOpen(false);
                        setTeacherQueriesOpen(true);
                        void loadTeacherQueries();
                      }}
                      className="w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300/60 text-sm text-slate-800 transition"
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500 border border-orange-300 text-true-white shadow-glow">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-5 w-5"
                          >
                            <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            <path d="M8 9h8" />
                            <path d="M8 13h5" />
                          </svg>
                        </span>
                        <span className="text-left">
                          <span className="block font-semibold">Student Queries</span>
                          <span className="text-xs text-slate-500">Open doubts from students</span>
                        </span>
                      </span>
                      {unreadTeacherQueries > 0 && (
                        <span className="min-w-[22px] h-5 px-1.5 rounded-full bg-red-700 text-yellow-200 text-[11px] font-extrabold flex items-center justify-center leading-none shadow-lg">
                          {unreadTeacherQueries}
                        </span>
                      )}
                    </button>
                    <Link
                      href="/teacher/assign-task"
                      onClick={() => setTeacherMenuOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300/60 text-sm text-slate-800 transition"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500 border border-indigo-300 text-true-white shadow-glow">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          className="h-5 w-5"
                        >
                          <path d="M9 5h6" />
                          <path d="M9 9h6" />
                          <path d="M9 13h4" />
                          <path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
                        </svg>
                      </span>
                      <div className="text-left">
                        <p className="font-semibold">STEAM-H Task</p>
                        <p className="text-xs text-slate-500">Create STEAM-H work for students</p>
                      </div>
                    </Link>
                    <button
                      data-tour="teacher-menu-signout"
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-sm text-rose-700 transition disabled:opacity-60"
                      onClick={() =>
                        startSignOut(async () => {
                          setTeacherMenuOpen(false);
                          await logActivity("auth_logout", {
                            category: "auth",
                            metadata: { reason: "manual" },
                          });
                          await supabase.auth.signOut();
                          router.push("/login");
                        })
                      }
                      disabled={signingOut}
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500 border border-rose-300 text-true-white shadow-glow">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          className="h-5 w-5"
                        >
                          <path d="M9 21h-4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                          <path d="M16 17l5-5-5-5" />
                          <path d="M21 12H9" />
                        </svg>
                      </span>
                      <div className="text-left">
                        <p className="font-semibold">{signingOut ? "Signing out..." : "Sign out"}</p>
                        <p className="text-xs text-rose-600">End session safely</p>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <div className="relative" ref={notificationsRef}>
                <button
                  type="button"
                  onClick={() => {
                    setTeacherMenuOpen(false);
                    setNotificationsOpen((open) => !open);
                  }}
                  data-tour="student-notification-bell"
                  className="relative inline-flex items-center justify-center h-11 w-11 rounded-full border border-white/10 outline outline-2 outline-black/50 bg-white/5 hover:border-accent-strong"
                  aria-label="Notifications"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill={hasUnreadSimulationAssignment ? "#dc2626" : "#facc15"}
                    stroke={hasUnreadSimulationAssignment ? "#fbbf24" : "#111827"}
                    style={hasUnreadSimulationAssignment ? { fill: "#dc2626", stroke: "#fbbf24" } : undefined}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`h-6 w-6 ${unreadCount > 0 ? "customer-bell-ring" : ""}`}
                  >
                    <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.172V11a6 6 0 1 0-12 0v3.172a2 2 0 0 1-.6 1.428L4 17h5" />
                    <path d="M9 17a3 3 0 0 0 6 0" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-1 ring-slate-900"></span>
                  )}
                </button>

                {notificationsOpen && (
                  <div
                    className="absolute right-0 mt-2 w-80 max-h-96 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-2xl p-3 space-y-2 z-50 text-slate-900"
                    data-tour="student-notification-panel"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold">Notifications</span>
                      <span className="text-xs text-slate-500">{unreadCount} unread</span>
                    </div>
                    {notificationStatus ? (
                      <div className="text-sm text-slate-600">{notificationStatus}</div>
                    ) : notifications.length === 0 ? (
                      <div className="text-sm text-slate-500">No notifications yet.</div>
                    ) : (
                      notifications.map((note) => (
                        <div
                          key={note.id}
                          className={`rounded-xl border p-3 space-y-1 ${
                            note.status === "unread"
                              ? "bg-emerald-50 border-emerald-200"
                              : "bg-slate-50 border-slate-200"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-slate-900">{note.title}</p>
                              <p className="text-xs text-slate-700">{note.message}</p>
                              <p className="text-[11px] text-slate-500">
                                {new Date(note.created_at).toLocaleString()}
                                {note.subject ? ` | ${note.subject}` : ""}
                              </p>
                            </div>
                            {note.status !== "read" && (
                              <button
                                className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-500 disabled:opacity-50"
                                onClick={() => void markNotificationRead(note.id)}
                                disabled={markingId === note.id}
                              >
                                {markingId === note.id ? "Marking..." : "Mark read"}
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="relative" ref={teacherMenuRef}>
                <button
                  type="button"
                  aria-expanded={teacherMenuOpen}
                  aria-haspopup="menu"
                  aria-label="Open student menu"
                  data-tour="student-menu-trigger"
                  onClick={() => {
                    setNotificationsOpen(false);
                    setTeacherMenuOpen((open) => !open);
                  }}
                  className="group flex items-center gap-3 rounded-xl px-4 py-2 bg-emerald-800 hover:bg-emerald-700 text-white font-semibold shadow-md ring-1 ring-white/10 hover:-translate-y-0.5 transition-transform duration-150"
                >
                  <span className="sr-only">Open student menu</span>
                  <span className="space-y-1.5">
                    <span className="block h-0.5 w-5 rounded-full bg-white"></span>
                    <span className="block h-0.5 w-5 rounded-full bg-white"></span>
                    <span className="block h-0.5 w-5 rounded-full bg-white"></span>
                  </span>
                  <span className="text-sm font-semibold text-white/90">Menu</span>
                </button>

                {teacherMenuOpen && (
                  <div
                    className="absolute right-0 mt-3 w-80 rounded-2xl bg-white border border-stone-300 outline outline-1 outline-black/5 shadow-2xl shadow-slate-900/15 ring-1 ring-black/5 p-4 space-y-3 z-40 transition"
                    data-tour="student-menu-panel"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-[0.16em] text-accent-strong">Student actions</p>
                      <span className="text-[11px] text-slate-400">Quick access</span>
                    </div>
                    <div className="space-y-2">
                      <Link
                        href="/"
                        onClick={() => setTeacherMenuOpen(false)}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-slate-50 hover:bg-purple-50 border border-slate-200 hover:border-purple-300/60 text-sm text-slate-800 transition"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500 border border-purple-300 text-true-white shadow-glow">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-5 w-5"
                          >
                            <path d="M3 11.5 12 4l9 7.5" />
                            <path d="M6 10v9h12v-9" />
                            <path d="M10 19v-5h4v5" />
                          </svg>
                        </span>
                        <div className="text-left">
                          <p className="font-semibold">Back to Home</p>
                          <p className="text-xs text-slate-500">Customer dashboard</p>
                        </div>
                      </Link>
                      <Link
                        href="/simulations"
                        onClick={() => setTeacherMenuOpen(false)}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300/60 text-sm text-slate-800 transition"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 border border-emerald-400 text-true-white shadow-glow">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.9"
                            className="h-5 w-5"
                          >
                            <path d="M7 4h10" />
                            <path d="M9 4v3l-4.5 8a3 3 0 0 0 2.6 4.5h10.8a3 3 0 0 0 2.6-4.5L16 7V4" />
                            <path d="M8 13h8" />
                            <path d="M10 16h4" />
                          </svg>
                        </span>
                        <div className="text-left">
                          <p className="font-semibold">Simulations</p>
                          <p className="text-xs text-slate-500">Open full simulation library</p>
                        </div>
                      </Link>
                      <button
                        type="button"
                        data-tour="student-menu-doubt"
                        onClick={() => {
                          setTeacherMenuOpen(false);
                          setStudentDoubtOpen(true);
                          setStudentDoubtStatus(null);
                          if (availableTeachers.length === 0) {
                            void loadAvailableTeachers();
                          }
                        }}
                        className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300/60 text-sm text-slate-800 transition"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 border border-emerald-300 text-true-white shadow-glow">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-5 w-5"
                          >
                            <path d="M9.09 9a3 3 0 1 1 5.82 1c0 2-3 3-3 3" />
                            <path d="M12 17h.01" />
                            <circle cx="12" cy="12" r="10" />
                          </svg>
                        </span>
                        <div className="text-left">
                          <p className="font-semibold">Doubt Section</p>
                          <p className="text-xs text-slate-500">Send query to your teacher</p>
                        </div>
                      </button>

                      <Link
                        href="/student/steamh-projects"
                        data-tour="student-menu-upload-project"
                        onClick={() => setTeacherMenuOpen(false)}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-300/60 text-sm text-slate-800 transition"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500 border border-sky-300 text-true-white shadow-glow">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-5 w-5"
                          >
                            <path d="M12 19V5" />
                            <path d="m5 12 7-7 7 7" />
                            <path d="M5 19h14" />
                          </svg>
                        </span>
                        <div className="text-left">
                          <p className="font-semibold">STEAM-H Project</p>
                          <p className="text-xs text-slate-500">Publish work to open showcase</p>
                        </div>
                      </Link>

                      <button
                        type="button"
                        data-tour="student-menu-signout"
                        onClick={() =>
                          startSignOut(async () => {
                            setTeacherMenuOpen(false);
                            await logActivity("auth_logout", {
                              category: "auth",
                              metadata: { reason: "manual" },
                            });
                            await supabase.auth.signOut();
                            router.push("/login");
                          })
                        }
                        className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-sm text-rose-700 transition disabled:opacity-60"
                        disabled={signingOut}
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500 border border-rose-300 text-true-white shadow-glow">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-5 w-5"
                          >
                            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                            <path d="m10 17 5-5-5-5" />
                            <path d="M15 12H3" />
                          </svg>
                        </span>
                        <div className="text-left">
                          <p className="font-semibold">{signingOut ? "Signing out..." : "Sign out"}</p>
                          <p className="text-xs text-rose-600">End current session</p>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {role !== "teacher" && (
        <section className="relative rounded-3xl border border-stone-300/75 bg-gradient-to-r from-stone-100 via-amber-50/80 to-zinc-100/95 p-2.5 ring-1 ring-white/70 shadow-[0_20px_38px_rgba(120,113,108,0.22),inset_0_2px_0_rgba(255,255,255,0.88)]">
          <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {studentDroneActivityHref ? (
              <Link
                href={studentDroneActivityHref}
                onClick={() => {
                  if (studentTourTargetModuleId) {
                    markModuleSeen(studentTourTargetModuleId);
                  }
                }}
                className="group relative shrink-0 inline-flex items-center gap-2 rounded-2xl border ring-1 ring-inset px-4 py-2.5 text-sm font-semibold transition-all bg-amber-100 text-slate-900 border-amber-300 shadow-[0_8px_18px_rgba(120,113,108,0.18)] ring-black/20"
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border bg-amber-200/70 border-amber-300 text-amber-900">
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
                Student Drone Activity
              </Link>
            ) : (
              <a
                href="#curriculum"
                className="group relative shrink-0 inline-flex items-center gap-2 rounded-2xl border ring-1 ring-inset px-4 py-2.5 text-sm font-semibold transition-all bg-amber-100 text-slate-900 border-amber-300 shadow-[0_8px_18px_rgba(120,113,108,0.18)] ring-black/20"
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border bg-amber-200/70 border-amber-300 text-amber-900">
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
                Student Drone Activity
              </a>
            )}
            <Link
              href="/simulations"
              className="group relative shrink-0 inline-flex items-center gap-2 rounded-2xl border ring-1 ring-inset px-4 py-2.5 text-sm font-semibold transition-all bg-white/85 text-slate-700 border-stone-200 ring-black/10 hover:border-stone-400 hover:bg-white hover:ring-black/20"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border bg-stone-100 border-stone-300/80 text-slate-700 group-hover:bg-stone-200">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-4 w-4">
                  <path d="M7 4h10" />
                  <path d="M9 4v3l-4.5 8a3 3 0 0 0 2.6 4.5h10.8a3 3 0 0 0 2.6-4.5L16 7V4" />
                  <path d="M8 13h8" />
                  <path d="M10 16h4" />
                </svg>
              </span>
              Simulations
            </Link>
          </div>
        </section>
      )}

      <section className="space-y-3" data-tour={role === "teacher" ? undefined : "student-system-requirements"}>
        <h2
          className="text-xl font-semibold text-white"
          data-tour={role === "teacher" ? undefined : "student-system-requirements-heading"}
        >
          System requirements
        </h2>
        <div className="glass-panel rounded-2xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-base font-semibold text-slate-100">
              For first-time users, it is recommended to install all dependencies using the &ldquo;<span className="underline">Download Installer</span>&rdquo; before performing the activity.
            </p>
            <a
              href="https://1drv.ms/u/c/d5c868b4d9600368/IQCspO91wHTLQINVFln61jdhAaeVZC9a_i_Tl8Xd-bU4AW4?e=gqzZN6"
              data-tour={role === "teacher" ? undefined : "student-installer-download"}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-true-white underline shadow-glow hover:opacity-90"
              download
            >
              Download Installer
            </a>
          </div>
        </div>
      </section>

      {role === "teacher" && (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-white">Browse activities</h2>
          <div className="glass-panel rounded-2xl p-4 grid sm:grid-cols-3 gap-3" data-tour="teacher-filters">
            <label className="text-sm text-slate-200 space-y-1">
              Grade
              <select
                className="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-slate-900 focus:border-accent focus:outline-none disabled:bg-slate-100 [color-scheme:light]"
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                disabled={!!userGrade}
              >
                {gradeOptions.map((g) => (
                  <option key={g} value={g} className="bg-white text-slate-900">
                    {g}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-200 space-y-1">
              Subject
              <select
                className="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-slate-900 focus:border-accent focus:outline-none disabled:bg-slate-100 [color-scheme:light]"
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                disabled={!!teacherSubject}
              >
                {teacherSubject ? (
                  <option value={teacherSubject} className="bg-white text-slate-900">
                    {formatSubject(teacherSubject)}
                  </option>
                ) : (
                  <>
                    <option value="all" className="bg-white text-slate-900">
                      All
                    </option>
                    {Array.from(new Set(modules.map((m) => normalizeSubject(m.subject)))).map((s) => (
                      <option key={s} value={s} className="bg-white text-slate-900">
                        {formatSubject(s)}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </label>
            <div className="flex items-end"></div>
          </div>
        </div>
      )}

      <section id="curriculum" className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">Activities</h2>
            {role !== "teacher" && <p className="text-xs text-slate-300">All listed activities are drone related.</p>}
          </div>
          <p className="text-sm text-slate-400">Showing {filteredModules.length} modules</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {filteredModules.map((module, index) => (
            <div
              key={module.id}
              className="glass-panel rounded-2xl p-5 space-y-3 hover:border-accent-strong"
              data-tour={
                role === "teacher"
                  ? (index === 0 ? "teacher-activity-card" : undefined)
                  : (module.id === studentTourTargetModuleId ? "student-activity-card" : undefined)
              }
            >
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] font-semibold text-accent-strong">
                <span>Grade {module.grade}</span>
                <span className="text-emerald-800">{formatSubject(module.subject)}</span>
              </div>
              {role === "teacher" && !seenModules.has(module.id) && (
                <span className="inline-flex items-center !text-red-500 text-[11px] font-bold animate-pulse">
                  NEWLY ADDED!
                </span>
              )}
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-white">{module.title}</h3>
                {role === "teacher" && module.published && (
                  <div
                    className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-red-500"
                    data-tour={module.id === teacherTourLiveBadgeModuleId ? "teacher-live-badge" : undefined}
                  >
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
                    Live
                  </div>
                )}
              </div>
              {role === "teacher" && (
                <div className="flex items-center gap-2 text-xs">
                  <span
                    data-tour={index === 0 ? "teacher-publish-status" : undefined}
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full font-semibold border ${
                      module.published
                        ? "bg-blue-600 text-true-white border-blue-300"
                        : "bg-amber-600 text-white border-amber-300"
                    }`}
                  >
                    {module.published ? "Published" : "Hidden from students"}
                  </span>
                  <button
                    data-tour={index === 0 ? "teacher-publish-toggle" : undefined}
                    className="px-3 py-1 rounded-lg bg-emerald-500 text-white font-semibold border border-emerald-300 shadow-glow hover:bg-emerald-400 disabled:opacity-50"
                    onClick={() => void togglePublish(module.id, !module.published)}
                    disabled={publishingId === module.id}
                  >
                    {publishingId === module.id
                      ? "Saving..."
                      : module.published
                        ? "Unpublish"
                        : "Publish"}
                  </button>
                </div>
              )}
              {progressMap[String(module.id)]?.completed ? (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-emerald-700 font-semibold">Completed</span>
                  {typeof progressMap[String(module.id)].score === "number" && (
                    <span className="px-2 py-1 rounded-full bg-white/10 text-slate-200 border border-white/15">
                      Score {progressMap[String(module.id)].score}/{progressMap[String(module.id)].total || 5}
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400">Not completed</p>
              )}
              <Link
                href={`/customer/activity/${module.id}`}
                data-tour={
                  role === "teacher"
                    ? (index === 0 ? "teacher-activity-launch" : undefined)
                    : (module.id === studentTourTargetModuleId ? "student-activity-launch" : undefined)
                }
                className="block w-full text-center mt-2 py-2 rounded-lg bg-accent text-true-white font-semibold"
                onClick={() => markModuleSeen(module.id)}
              >
                Show activity/code
              </Link>
            </div>
          ))}
        </div>
      </section>

    </main>
  );
}









