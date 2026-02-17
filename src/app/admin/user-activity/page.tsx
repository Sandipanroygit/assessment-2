"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type LoginRow = {
  id: number;
  user_id: string | null;
  user_name: string;
  email: string | null;
  role: "teacher" | "student";
  event_type: "auth_login" | "auth_logout";
  created_at: string;
};

type SessionRow = {
  key: string;
  user_id: string | null;
  user_name: string;
  email: string | null;
  login_at: string | null;
  logout_at: string | null;
};

type TeacherPublishTotal = {
  teacher_id: string;
  teacher_name: string;
  email: string | null;
  publish_events: number;
  total_published_modules: number;
};

type ActivityScoreAverage = {
  module_id: string;
  module_title: string;
  attempts: number;
  average_score: number;
  average_total: number;
  average_percent: number;
};

type UserActivityResponse = {
  generated_at: string;
  summary: {
    teacher_logins: number;
    teacher_logouts: number;
    student_logins: number;
    student_logouts: number;
    teacher_publishers: number;
    tracked_activities: number;
    quiz_attempts: number;
  };
  login_logout: {
    teachers: LoginRow[];
    students: LoginRow[];
  };
  teacher_publish_totals: TeacherPublishTotal[];
  activity_score_averages: ActivityScoreAverage[];
};

type AnalyticsRibbonSection = "teacherLoginLogout" | "studentLoginLogout" | "liveModules" | "averageScores";

const formatTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";
const toLocalDateKey = (value?: string | null) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const todayDateKey = () => toLocalDateKey(new Date().toISOString());
const toTimeMs = (value?: string | null) => {
  if (!value) return 0;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};
const toUserSessionKey = (row: LoginRow) =>
  row.user_id ?? `${row.user_name.toLowerCase()}::${(row.email ?? "").toLowerCase()}`;
const buildSessionRows = (logs: LoginRow[]): SessionRow[] => {
  const rows: SessionRow[] = [];
  const pendingLogins = new Map<string, LoginRow[]>();
  const sorted = [...logs].sort((a, b) => toTimeMs(a.created_at) - toTimeMs(b.created_at));

  for (const entry of sorted) {
    const sessionKey = toUserSessionKey(entry);
    if (entry.event_type === "auth_login") {
      const queue = pendingLogins.get(sessionKey) ?? [];
      queue.push(entry);
      pendingLogins.set(sessionKey, queue);
      continue;
    }

    const queue = pendingLogins.get(sessionKey);
    if (queue && queue.length) {
      const loginEntry = queue.shift()!;
      if (!queue.length) pendingLogins.delete(sessionKey);
      rows.push({
        key: `${sessionKey}-${loginEntry.id}-${entry.id}`,
        user_id: entry.user_id ?? loginEntry.user_id,
        user_name: loginEntry.user_name,
        email: loginEntry.email ?? entry.email,
        login_at: loginEntry.created_at,
        logout_at: entry.created_at,
      });
      continue;
    }

    rows.push({
      key: `${sessionKey}-logout-${entry.id}`,
      user_id: entry.user_id,
      user_name: entry.user_name,
      email: entry.email,
      login_at: null,
      logout_at: entry.created_at,
    });
  }

  for (const [sessionKey, queue] of pendingLogins.entries()) {
    for (const loginEntry of queue) {
      rows.push({
        key: `${sessionKey}-login-${loginEntry.id}`,
        user_id: loginEntry.user_id,
        user_name: loginEntry.user_name,
        email: loginEntry.email,
        login_at: loginEntry.created_at,
        logout_at: null,
      });
    }
  }

  return rows.sort(
    (a, b) =>
      Math.max(toTimeMs(b.login_at), toTimeMs(b.logout_at)) - Math.max(toTimeMs(a.login_at), toTimeMs(a.logout_at)),
  );
};
const renderAnalyticsRibbonIcon = (sectionId: AnalyticsRibbonSection) => {
  switch (sectionId) {
    case "teacherLoginLogout":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-4 w-4">
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
          <path d="M16 8h5" />
          <path d="M18.5 5.5 21 8l-2.5 2.5" />
        </svg>
      );
    case "studentLoginLogout":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-4 w-4">
          <circle cx="10" cy="8" r="3" />
          <path d="M4.5 19a5.5 5.5 0 0 1 11 0" />
          <path d="M19 7v6" />
          <path d="M16.5 10.5 19 13l2.5-2.5" />
        </svg>
      );
    case "liveModules":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-4 w-4">
          <rect x="3" y="4" width="18" height="14" rx="2" />
          <path d="M7 20h10" />
          <path d="M12 18v2" />
        </svg>
      );
    case "averageScores":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-4 w-4">
          <path d="M4 19h16" />
          <path d="M7 16V9" />
          <path d="M12 16V6" />
          <path d="M17 16v-4" />
        </svg>
      );
    default:
      return null;
  }
};

export default function AdminUserActivityPage() {
  const router = useRouter();
  const [data, setData] = useState<UserActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(todayDateKey());
  const [activeAnalyticsSection, setActiveAnalyticsSection] = useState<AnalyticsRibbonSection>("teacherLoginLogout");
  const lastScrollYRef = useRef(0);
  const statsExpandGuardUntilRef = useRef(0);
  const [statsExpanded, setStatsExpanded] = useState(true);

  const loadActivityData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) {
          setStatus("Please sign in to access user activity logs.");
          router.push("/login");
          return;
        }

        const response = await fetch("/api/admin/user-activity", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = (await response.json().catch(() => ({}))) as UserActivityResponse & { error?: string };

        if (!response.ok) {
          setData(null);
          setStatus(body?.error ?? `Unable to load activity logs (status ${response.status}).`);
          if (response.status === 401) {
            router.push("/login");
          }
          return;
        }

        setData(body);
        setStatus(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load activity logs.";
        setData(null);
        setStatus(message);
      } finally {
        if (isRefresh) setRefreshing(false);
        else setLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    void loadActivityData(false);
  }, [loadActivityData]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    lastScrollYRef.current = window.scrollY;
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (Date.now() < statsExpandGuardUntilRef.current) {
        lastScrollYRef.current = currentScrollY;
        return;
      }
      if (currentScrollY > lastScrollYRef.current + 4) {
        setStatsExpanded(false);
      }
      lastScrollYRef.current = currentScrollY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const expandStatsCards = useCallback(() => {
    setStatsExpanded(true);
    if (typeof window !== "undefined") {
      lastScrollYRef.current = window.scrollY;
      statsExpandGuardUntilRef.current = Date.now() + 350;
    }
  }, []);

  const summary = data?.summary;
  const allTeacherLogs = data?.login_logout.teachers ?? [];
  const allStudentLogs = data?.login_logout.students ?? [];
  const todayKey = todayDateKey();
  const teacherTodayLogins = allTeacherLogs.filter(
    (row) => toLocalDateKey(row.created_at) === todayKey && row.event_type === "auth_login",
  ).length;
  const studentTodayLogins = allStudentLogs.filter(
    (row) => toLocalDateKey(row.created_at) === todayKey && row.event_type === "auth_login",
  ).length;
  const teacherSessions = buildSessionRows(allTeacherLogs).filter(
    (row) => toLocalDateKey(row.login_at) === selectedDate || toLocalDateKey(row.logout_at) === selectedDate,
  );
  const studentSessions = buildSessionRows(allStudentLogs).filter(
    (row) => toLocalDateKey(row.login_at) === selectedDate || toLocalDateKey(row.logout_at) === selectedDate,
  );
  const publishRows = data?.teacher_publish_totals ?? [];
  const scoreRows = data?.activity_score_averages ?? [];
  const topActivities = scoreRows.slice(0, 50);
  const liveModulesCount = publishRows.reduce((sum, row) => sum + row.total_published_modules, 0);
  const analyticsRibbonSections: Array<{ id: AnalyticsRibbonSection; label: string }> = [
    { id: "teacherLoginLogout", label: "Teacher Login/Logout" },
    { id: "studentLoginLogout", label: "Student Login/Logout" },
    { id: "liveModules", label: "Live Modules" },
    { id: "averageScores", label: "Average Scores" },
  ];
  const stats = [
    { label: "Teacher today login", value: teacherTodayLogins, delta: "Today's teacher sign-ins" },
    { label: "Student today login", value: studentTodayLogins, delta: "Today's student sign-ins" },
    { label: "LIVE MODULES", value: liveModulesCount, delta: "Total published live modules" },
    { label: "Tracked quiz attempts", value: summary?.quiz_attempts ?? 0, delta: "Total logged attempts" },
  ];

  return (
    <main className="section-padding space-y-8">
      <div className="sticky top-0 z-30 space-y-4 rounded-2xl border border-white/10 bg-surface/65 p-3 shadow-[0_10px_30px_rgba(0,0,0,0.2)] backdrop-blur-xl">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-accent-strong uppercase text-xs tracking-[0.2em]">Admin</p>
            <h1 className="text-3xl font-semibold text-white">User Analytics</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="px-4 py-2 rounded-xl border border-white/20 text-sm text-white hover:border-accent-strong"
            >
              Back to admin
            </Link>
            <button
              type="button"
              onClick={() => void loadActivityData(true)}
              className="px-4 py-2 rounded-xl bg-accent text-true-white text-sm font-semibold shadow-glow disabled:opacity-60"
              disabled={refreshing || loading}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>
        {status && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {status}
          </div>
        )}
        {data && (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map((item) => (
                <div
                  key={item.label}
                  onClick={expandStatsCards}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      expandStatsCards();
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className="glass-panel rounded-2xl p-4 cursor-pointer select-none"
                >
                  <div className="flex items-center">
                    <div className="rounded-lg bg-accent px-3 py-2 shadow-[inset_0_-1px_0_rgba(255,255,255,0.12)]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-true-white">{item.label}</p>
                    </div>
                  </div>
                  {statsExpanded && (
                    <div className="mt-3 space-y-2">
                      <p className="text-2xl font-semibold text-white">{item.value}</p>
                      <p className="text-xs text-accent-strong">{item.delta}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="relative rounded-3xl border border-stone-300/75 bg-gradient-to-r from-stone-100 via-amber-50/80 to-zinc-100/95 p-2.5 ring-1 ring-white/70 shadow-[0_20px_38px_rgba(120,113,108,0.22),inset_0_2px_0_rgba(255,255,255,0.88)]">
              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {analyticsRibbonSections.map((section) => {
                  const isActive = activeAnalyticsSection === section.id;
                  const buttonClass = isActive
                    ? "bg-amber-100 text-slate-900 border-amber-300 shadow-[0_8px_18px_rgba(120,113,108,0.18)] ring-black/20"
                    : "bg-white/85 text-slate-700 border-stone-200 ring-black/10 hover:border-stone-400 hover:bg-white hover:ring-black/20";
                  const iconClass = isActive
                    ? "bg-amber-200/70 border-amber-300 text-amber-900"
                    : "bg-stone-100 border-stone-300/80 text-slate-700 group-hover:bg-stone-200";
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setActiveAnalyticsSection(section.id)}
                      className={`group relative shrink-0 inline-flex items-center gap-2 rounded-2xl border ring-1 ring-inset px-4 py-2.5 text-sm font-semibold transition-all ${buttonClass}`}
                    >
                      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border ${iconClass}`}>
                        {renderAnalyticsRibbonIcon(section.id)}
                      </span>
                      {section.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {loading && !data ? (
        <div className="glass-panel rounded-2xl p-6 text-sm text-slate-300">Loading activity logs...</div>
      ) : null}

      {data && (
        <>

          {activeAnalyticsSection === "teacherLoginLogout" && (
            <section className="glass-panel rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-lg font-semibold text-white">Teacher login/logout</h2>
              <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-3 py-2">
                <label htmlFor="activity-date-teacher" className="text-xs text-slate-300">
                  Select date
                </label>
                <input
                  id="activity-date-teacher"
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  className="calendar-input rounded-lg px-2 py-1 text-sm"
                />
              </div>
            </div>
            <div className="overflow-auto max-h-[34rem]">
              <table className="table-v1">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-white/10">
                    <th className="py-2 pr-3">Teacher</th>
                    <th className="py-2 pr-3">Login</th>
                    <th className="py-2 pr-3">Logout</th>
                  </tr>
                </thead>
                <tbody>
                  {teacherSessions.length === 0 ? (
                    <tr className="border-b border-white/5">
                      <td className="py-2 pr-3 text-slate-300" colSpan={3}>
                        No teacher login/logout logs for the selected date.
                      </td>
                    </tr>
                  ) : (
                    teacherSessions.map((row) => (
                      <tr key={row.key} className="border-b border-white/5">
                        <td className="py-2 pr-3 text-slate-100">
                          <p className="font-semibold">{row.user_name}</p>
                          <p className="text-xs text-slate-400">{row.email ?? "-"}</p>
                        </td>
                        <td className="py-2 pr-3 text-slate-200">{formatTime(row.login_at)}</td>
                        <td className="py-2 pr-3 text-slate-300">{formatTime(row.logout_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            </section>
          )}

          {activeAnalyticsSection === "studentLoginLogout" && (
            <section className="glass-panel rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-lg font-semibold text-white">Student login/logout</h2>
              <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-3 py-2">
                <label htmlFor="activity-date-student" className="text-xs text-slate-300">
                  Select date
                </label>
                <input
                  id="activity-date-student"
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  className="calendar-input rounded-lg px-2 py-1 text-sm"
                />
              </div>
            </div>
            <div className="overflow-auto max-h-[34rem]">
              <table className="table-v1">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-white/10">
                    <th className="py-2 pr-3">Student</th>
                    <th className="py-2 pr-3">Login</th>
                    <th className="py-2 pr-3">Logout</th>
                  </tr>
                </thead>
                <tbody>
                  {studentSessions.length === 0 ? (
                    <tr className="border-b border-white/5">
                      <td className="py-2 pr-3 text-slate-300" colSpan={3}>
                        No student login/logout logs for the selected date.
                      </td>
                    </tr>
                  ) : (
                    studentSessions.map((row) => (
                      <tr key={row.key} className="border-b border-white/5">
                        <td className="py-2 pr-3 text-slate-100">
                          <p className="font-semibold">{row.user_name}</p>
                          <p className="text-xs text-slate-400">{row.email ?? "-"}</p>
                        </td>
                        <td className="py-2 pr-3 text-slate-200">{formatTime(row.login_at)}</td>
                        <td className="py-2 pr-3 text-slate-300">{formatTime(row.logout_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            </section>
          )}

          {activeAnalyticsSection === "liveModules" && (
            <section className="glass-panel rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-lg font-semibold text-white">LIVE MODULES</h2>
              <span className="inline-flex items-center gap-2 rounded-full border border-orange-300/70 bg-white px-3 py-1 text-xs font-semibold tracking-[0.12em] text-orange-600">
                <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" aria-hidden="true" />
                LIVE
              </span>
            </div>
            <div className="overflow-auto">
              <table className="table-v1">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-white/10">
                    <th className="py-2 pr-3">Teacher</th>
                    <th className="py-2 pr-3">Publish actions</th>
                    <th className="py-2 pr-3">Total published modules</th>
                  </tr>
                </thead>
                <tbody>
                  {publishRows.length === 0 ? (
                    <tr className="border-b border-white/5">
                      <td className="py-2 pr-3 text-slate-300" colSpan={3}>
                        No teacher publish logs yet.
                      </td>
                    </tr>
                  ) : (
                    publishRows.map((row) => (
                      <tr key={`${row.teacher_id}-${row.teacher_name}`} className="border-b border-white/5">
                        <td className="py-2 pr-3 text-slate-100">
                          <p className="font-semibold">{row.teacher_name}</p>
                          <p className="text-xs text-slate-400">{row.email ?? "-"}</p>
                        </td>
                        <td className="py-2 pr-3 text-slate-200">{row.publish_events}</td>
                        <td className="py-2 pr-3 text-slate-200">{row.total_published_modules}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            </section>
          )}

          {activeAnalyticsSection === "averageScores" && (
            <section className="glass-panel rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">Average student scores by activity</h2>
            <div className="overflow-auto">
              <table className="table-v1">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-white/10">
                    <th className="py-2 pr-3">Activity</th>
                    <th className="py-2 pr-3">Attempts</th>
                    <th className="py-2 pr-3">Average score</th>
                    <th className="py-2 pr-3">Average %</th>
                  </tr>
                </thead>
                <tbody>
                  {topActivities.length === 0 ? (
                    <tr className="border-b border-white/5">
                      <td className="py-2 pr-3 text-slate-300" colSpan={4}>
                        No question attempt scores logged yet.
                      </td>
                    </tr>
                  ) : (
                    topActivities.map((row) => (
                      <tr key={`${row.module_id}-${row.module_title}`} className="border-b border-white/5">
                        <td className="py-2 pr-3 text-slate-100">
                          <p className="font-semibold">{row.module_title}</p>
                          <p className="text-xs text-slate-400">{row.module_id}</p>
                        </td>
                        <td className="py-2 pr-3 text-slate-200">{row.attempts}</td>
                        <td className="py-2 pr-3 text-slate-200">
                          {row.average_score}/{row.average_total}
                        </td>
                        <td className="py-2 pr-3 text-accent-strong font-semibold">{row.average_percent}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
