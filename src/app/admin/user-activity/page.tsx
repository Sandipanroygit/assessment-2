"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type LoginRow = {
  id: number;
  user_id: string | null;
  user_name: string;
  email: string | null;
  role: "teacher" | "student";
  event_type: "auth_login" | "auth_logout";
  reason: string | null;
  created_at: string;
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

const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString() : "-");

export default function AdminUserActivityPage() {
  const router = useRouter();
  const [data, setData] = useState<UserActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

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

  const summary = data?.summary;
  const teacherLogs = data?.login_logout.teachers ?? [];
  const studentLogs = data?.login_logout.students ?? [];
  const publishRows = data?.teacher_publish_totals ?? [];
  const scoreRows = data?.activity_score_averages ?? [];
  const topActivities = scoreRows.slice(0, 50);

  return (
    <main className="section-padding space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-accent-strong">Admin logs</p>
          <h1 className="text-3xl font-semibold text-white">User Analytics</h1>
          <p className="text-sm text-slate-300 mt-1">
            Login/logout logs, teacher publish totals, and student question score averages by activity.
          </p>
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

      {loading && !data ? (
        <div className="glass-panel rounded-2xl p-6 text-sm text-slate-300">Loading activity logs...</div>
      ) : null}

      {data && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-panel rounded-2xl p-4 space-y-1">
              <p className="text-sm text-slate-400">Teacher login/logout</p>
              <p className="text-2xl font-semibold text-white">
                {summary?.teacher_logins ?? 0}/{summary?.teacher_logouts ?? 0}
              </p>
            </div>
            <div className="glass-panel rounded-2xl p-4 space-y-1">
              <p className="text-sm text-slate-400">Student login/logout</p>
              <p className="text-2xl font-semibold text-white">
                {summary?.student_logins ?? 0}/{summary?.student_logouts ?? 0}
              </p>
            </div>
            <div className="glass-panel rounded-2xl p-4 space-y-1">
              <p className="text-sm text-slate-400">Teacher publishers</p>
              <p className="text-2xl font-semibold text-white">{summary?.teacher_publishers ?? 0}</p>
            </div>
            <div className="glass-panel rounded-2xl p-4 space-y-1">
              <p className="text-sm text-slate-400">Tracked quiz attempts</p>
              <p className="text-2xl font-semibold text-white">{summary?.quiz_attempts ?? 0}</p>
            </div>
          </div>

          <div className="text-xs text-slate-400">Last updated: {formatDateTime(data.generated_at)}</div>

          <section className="glass-panel rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">Teacher login/logout</h2>
            <div className="overflow-auto">
              <table className="table-v1">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-white/10">
                    <th className="py-2 pr-3">Teacher</th>
                    <th className="py-2 pr-3">Event</th>
                    <th className="py-2 pr-3">Reason</th>
                    <th className="py-2 pr-3">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {teacherLogs.length === 0 ? (
                    <tr className="border-b border-white/5">
                      <td className="py-2 pr-3 text-slate-300" colSpan={4}>
                        No teacher login/logout logs yet.
                      </td>
                    </tr>
                  ) : (
                    teacherLogs.map((row) => (
                      <tr key={row.id} className="border-b border-white/5">
                        <td className="py-2 pr-3 text-slate-100">
                          <p className="font-semibold">{row.user_name}</p>
                          <p className="text-xs text-slate-400">{row.email ?? "-"}</p>
                        </td>
                        <td className="py-2 pr-3 text-slate-200">
                          {row.event_type === "auth_login" ? "Login" : "Logout"}
                        </td>
                        <td className="py-2 pr-3 text-slate-300">{row.reason ?? "-"}</td>
                        <td className="py-2 pr-3 text-slate-300">{formatDateTime(row.created_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="glass-panel rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">Student login/logout</h2>
            <div className="overflow-auto">
              <table className="table-v1">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-white/10">
                    <th className="py-2 pr-3">Student</th>
                    <th className="py-2 pr-3">Event</th>
                    <th className="py-2 pr-3">Reason</th>
                    <th className="py-2 pr-3">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {studentLogs.length === 0 ? (
                    <tr className="border-b border-white/5">
                      <td className="py-2 pr-3 text-slate-300" colSpan={4}>
                        No student login/logout logs yet.
                      </td>
                    </tr>
                  ) : (
                    studentLogs.map((row) => (
                      <tr key={row.id} className="border-b border-white/5">
                        <td className="py-2 pr-3 text-slate-100">
                          <p className="font-semibold">{row.user_name}</p>
                          <p className="text-xs text-slate-400">{row.email ?? "-"}</p>
                        </td>
                        <td className="py-2 pr-3 text-slate-200">
                          {row.event_type === "auth_login" ? "Login" : "Logout"}
                        </td>
                        <td className="py-2 pr-3 text-slate-300">{row.reason ?? "-"}</td>
                        <td className="py-2 pr-3 text-slate-300">{formatDateTime(row.created_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="glass-panel rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">Total published modules by teacher</h2>
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
        </>
      )}
    </main>
  );
}
