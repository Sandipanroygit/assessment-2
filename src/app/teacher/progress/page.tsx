"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

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

export default function TeacherProgressPage() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [submissions, setSubmissions] = useState<ProgressRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [reminderBanner, setReminderBanner] = useState<string | null>(null);

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

  return (
    <main className="section-padding space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-accent-strong uppercase text-xs tracking-[0.2em]">Teacher</p>
          <h1 className="text-3xl font-semibold text-white">Student progress</h1>
          <p className="text-slate-300 text-sm">See who attempted your published activities.</p>
        </div>
        <Link
          href="/customer"
          className="px-4 py-2 rounded-xl border border-white/10 text-sm text-white hover:border-accent-strong"
        >
          Back to dashboard
        </Link>
      </div>

      <div className="glass-panel rounded-2xl p-4 flex flex-wrap gap-3 items-center">
        <label className="text-sm text-slate-200 space-y-1">
          Module
          <select
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
        <div className="text-sm text-slate-300">
          Students: {students.length} | Modules: {modules.length}
        </div>
        {status && (
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-amber-200">{status}</div>
        )}
        {reminderBanner && (
          <div className="rounded-xl border border-emerald-300/40 bg-emerald-700/30 px-3 py-2 text-sm text-emerald-100">
            {reminderBanner}
          </div>
        )}
      </div>

      <div className="glass-panel rounded-2xl p-4 overflow-auto">
        <table className="min-w-full text-sm text-slate-200">
          <thead>
            <tr className="text-left text-slate-400 border-b border-white/10">
              <th className="py-2 pr-3">Student</th>
              <th className="py-2 pr-3">Grade</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Reminder</th>
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
                        className="h-8 w-8 rounded-full bg-rose-700 text-white text-xs font-semibold hover:bg-rose-600 disabled:opacity-50 inline-flex items-center justify-center"
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

