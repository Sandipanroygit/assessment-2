"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type StudentRow = {
  id: string;
  full_name: string;
  email?: string | null;
  grade?: string | null;
  subject?: string | null;
};

export default function TeacherStudentsPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [, startLoading] = useTransition();
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

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
      const aGrade = (a.grade ?? "").toLowerCase();
      const bGrade = (b.grade ?? "").toLowerCase();
      if (!aGrade && !bGrade) return 0;
      if (!aGrade) return 1;
      if (!bGrade) return -1;
      return sortDir === "asc" ? aGrade.localeCompare(bGrade) : bGrade.localeCompare(aGrade);
    });
    return copy;
  }, [students, sortDir]);

  return (
    <main className="section-padding space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-accent-strong uppercase text-xs tracking-[0.2em]">Teacher</p>
          <h1 className="text-3xl font-semibold text-white">Registered students</h1>
          <p className="text-slate-300 text-sm">Subject-matched students for your classes.</p>
        </div>
        <Link
          href="/customer"
          className="px-4 py-2 rounded-xl border border-white/10 text-sm text-white hover:border-accent-strong"
        >
          Back to dashboard
        </Link>
      </div>

      <div className="glass-panel rounded-2xl p-4 flex flex-wrap gap-3 items-center">
        <div className="text-sm text-slate-300">Students: {students.length}</div>
        <button
          className="px-3 py-2 rounded-lg border border-white/10 text-sm text-white hover:border-accent-strong"
          onClick={() => setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))}
        >
          Sort by Grade ({sortDir === "asc" ? "A→Z" : "Z→A"})
        </button>
        {status && (
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-amber-200">{status}</div>
        )}
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
            {sortedStudents.length === 0 ? (
              <tr>
                <td className="py-3 pr-3 text-slate-300" colSpan={3}>
                  No students found for this subject yet.
                </td>
              </tr>
            ) : (
              sortedStudents.map((student) => (
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
    </main>
  );
}
