"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { CurriculumModule } from "@/types";
import { fetchCurriculumModules } from "@/lib/supabaseData";

const normalizeSubject = (subject: string) =>
  subject?.toLowerCase() === "maths" ? "Mathematics" : subject;

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  status: string;
  created_at: string;
  module_id?: string | null;
  subject?: string | null;
};

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
  const [studentRows, setStudentRows] = useState<Array<{ id: string; full_name: string; email?: string | null; grade?: string | null; subject?: string | null }>>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [notificationStatus, setNotificationStatus] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const unreadCount = useMemo(
    () => notifications.filter((n) => n.status === "unread").length,
    [notifications],
  );
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement | null>(null);

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
    const loadProfile = async () => {
      // Refresh to pick up latest user_metadata (e.g., subject updates from admin)
      const refreshed = await supabase.auth.refreshSession();
      const latestUser =
        refreshed.data.session?.user ?? (await supabase.auth.getUser()).data.user ?? null;
      const latestToken = refreshed.data.session?.access_token ?? null;
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

      const derivedRole = profileData?.role ?? latestUser.user_metadata.role ?? "customer";
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
        !profileData || (profileData.role ?? "").toLowerCase() !== derivedRole.toLowerCase();
      if (needsProfileUpsert) {
        await supabase.from("profiles").upsert({
          id: latestUser.id,
          full_name: latestUser.user_metadata?.full_name || latestUser.email || "User",
          role: derivedRole,
          grade: gradeFromMeta ?? undefined,
        });
      }

      setAuthChecked(true);

      // If an admin somehow lands here, redirect to the admin control room.
      if (derivedRole === "admin") {
        router.replace("/admin");
      }
    };
    loadProfile();
  }, [router]);

  useEffect(() => {
    if (!authChecked || !isAuthenticated) return;
    let cancelled = false;

    const loadCurriculum = async () => {
      try {
        setDataStatus("Loading activities...");
        let rows: CurriculumModule[] = [];
        if (role === "teacher" && sessionToken) {
          const res = await fetch("/api/teacher/modules", {
            headers: { Authorization: `Bearer ${sessionToken}` },
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(body?.error || "Unable to load modules");
          }
          rows = (body.modules ?? []) as CurriculumModule[];
        } else {
          rows = await fetchCurriculumModules({
            includeUnpublished: false,
            subject: role === "teacher" && teacherSubject ? teacherSubject : undefined,
          });
        }
        if (cancelled) return;
        setModules(rows.map((m) => enhanceModule(m)));
        setDataStatus(null);
      } catch {
        if (cancelled) return;
        setModules([]);
        setDataStatus("Database not reachable. No activities available.");
      }
    };

    loadCurriculum();
    return () => {
      cancelled = true;
    };
  }, [authChecked, isAuthenticated, enhanceModule, role, teacherSubject, sessionToken]);

  useEffect(() => {
    if (!authChecked || !isAuthenticated || role === "teacher") return;
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

  useEffect(() => {
    if (role !== "teacher" || !sessionToken) return;
    let cancelled = false;
    const loadStudents = async () => {
      try {
        const res = await fetch("/api/teacher/students", {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setDataStatus(body?.error ?? "Unable to load students");
          return;
        }
        if (cancelled) return;
        setStudentRows(body.students ?? []);
      } catch (err) {
        if (!cancelled) setDataStatus(err instanceof Error ? err.message : "Unable to load students");
      }
    };
    void loadStudents();
    return () => {
      cancelled = true;
    };
  }, [role, sessionToken]);

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
      const publishedMatch = role === "teacher" ? true : m.published !== false;
      return gradeMatch && subjectMatch && publishedMatch;
    });
  }, [gradeFilter, subjectFilter, modules, role, userGrade]);

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

  const formatSubject = (subject: string) => normalizeSubject(subject);

  const roleLabel = role === "teacher" ? "Teacher" : "Student";
  const roleSubline = "Browse activities for your grade. View code and download files.";

  return (
    <main className="section-padding space-y-8">
      {dataStatus && (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
          {dataStatus}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-accent-strong uppercase text-xs tracking-[0.2em]">{roleLabel}</p>
          <h1 className="text-3xl font-semibold text-white leading-tight">Hi {fullName}</h1>
          <p className="text-slate-300 text-sm">{roleSubline}</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/"
            className="px-4 py-2 rounded-xl border border-white/10 text-sm text-slate-900 text-center hover:border-accent-strong"
          >
            Back to Home
          </Link>
          {role === "teacher" && (
            <Link
              href="/teacher/progress"
              className="px-4 py-2 rounded-xl bg-accent text-true-white font-semibold shadow-glow disabled:opacity-60"
            >
              Student Progress
            </Link>
          )}
          <button
            onClick={() =>
              startSignOut(async () => {
                await supabase.auth.signOut();
                router.push("/login");
              })
            }
            className="px-4 py-2 rounded-xl bg-accent text-true-white font-semibold shadow-glow disabled:opacity-60"
            disabled={signingOut}
          >
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </div>

      {role !== "teacher" && (
        <section className="space-y-3">
          <div className="flex items-center justify-end">
            <div className="relative" ref={notificationsRef}>
              <button
                type="button"
                onClick={() => setNotificationsOpen((open) => !open)}
                className="relative inline-flex items-center justify-center h-11 w-11 rounded-full border border-white/10 bg-white/5 hover:border-accent-strong"
                aria-label="Notifications"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-6 w-6 text-white"
                >
                  <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.172V11a6 6 0 1 0-12 0v3.172a2 2 0 0 1-.6 1.428L4 17h5" />
                  <path d="M9 17a3 3 0 0 0 6 0" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-slate-900"></span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-2xl p-3 space-y-2 z-50 text-slate-900">
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
          </div>
        </section>
      )}

      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-white">Browse activities</h2>
        <div className="glass-panel rounded-2xl p-4 grid sm:grid-cols-3 gap-3">
          <label className="text-sm text-slate-200 space-y-1">
            Grade
            <select
              className="w-full rounded-lg bg-white/5 border border-slate-400/60 px-3 py-2"
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              disabled={!!userGrade}
            >
              {gradeOptions.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-200 space-y-1">
            Subject
            <select
              className="w-full rounded-lg bg-white/5 border border-slate-400/60 px-3 py-2"
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              disabled={!!teacherSubject}
            >
              {teacherSubject ? (
                <option value={teacherSubject}>{formatSubject(teacherSubject)}</option>
              ) : (
                <>
                  <option value="all">All</option>
                  {Array.from(new Set(modules.map((m) => normalizeSubject(m.subject)))).map((s) => (
                    <option key={s} value={s}>
                      {formatSubject(s)}
                    </option>
                  ))}
                </>
              )}
            </select>
          </label>
          <div className="flex items-end">
            <div className="w-full rounded-xl border border-white/10 p-3 bg-white/5 text-sm text-slate-300">
              Filter activities by grade and subject; pick one to view and download code.
            </div>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">System requirements</h2>
        <div className="glass-panel rounded-2xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-base font-semibold text-slate-100">
              For first-time users, it is recommended to install all dependencies using the Windows installer before performing the activity.
            </p>
            <a
              href="https://1drv.ms/u/c/d5c868b4d9600368/IQCspO91wHTLQINVFln61jdhAaeVZC9a_i_Tl8Xd-bU4AW4?e=gqzZN6"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-true-white shadow-glow hover:opacity-90"
              download
            >
              Download installer
            </a>
          </div>
        </div>
      </section>

      <section id="curriculum" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Activities</h2>
          <p className="text-sm text-slate-400">Showing {filteredModules.length} modules</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {filteredModules.map((module) => (
            <div key={module.id} className="glass-panel rounded-2xl p-5 space-y-3 hover:border-accent-strong">
              <div className="flex items-center justify-between text-xs text-accent-strong uppercase tracking-[0.2em]">
                <span>Grade {module.grade}</span>
                <span>{formatSubject(module.subject)}</span>
              </div>
              <h3 className="text-lg font-semibold text-white">{module.title}</h3>
              {role === "teacher" && (
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={`px-2 py-1 rounded-full font-semibold border ${
                      module.published
                        ? "bg-emerald-600 text-white border-emerald-300"
                        : "bg-amber-600 text-white border-amber-300"
                    }`}
                  >
                    {module.published ? "Published" : "Hidden from students"}
                  </span>
                  <button
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
                className="block w-full text-center mt-2 py-2 rounded-lg bg-accent text-true-white font-semibold"
              >
                Show activity/code
              </Link>
            </div>
          ))}
        </div>
      </section>

      {role === "teacher" && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Students (subject-matched)</h2>
            <p className="text-sm text-slate-400">{studentRows.length} visible</p>
          </div>
          <div className="glass-panel rounded-2xl p-4 overflow-auto">
            <table className="min-w-full text-sm text-slate-200">
              <thead>
                <tr className="text-left text-slate-400 border-b border-white/10">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Grade</th>
                </tr>
              </thead>
              <tbody>
                {studentRows.length === 0 ? (
                  <tr>
                    <td className="py-2 pr-3 text-slate-300" colSpan={3}>
                      No students found for this subject yet.
                    </td>
                  </tr>
                ) : (
                  studentRows.map((student) => (
                    <tr key={student.id} className="border-b border-white/5">
                      <td className="py-2 pr-3 font-semibold text-white">{student.full_name}</td>
                      <td className="py-2 pr-3 text-slate-300">{student.email ?? "—"}</td>
                      <td className="py-2 pr-3 text-slate-300">{student.grade ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

    </main>
  );
}









