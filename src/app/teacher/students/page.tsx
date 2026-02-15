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
  joined_at?: string | null;
};

type SortField = "name" | "grade" | "joined";

function formatJoinedDate(value?: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString();
}

export default function TeacherStudentsPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [, startLoading] = useTransition();
  const [sortField, setSortField] = useState<SortField>("grade");
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
          className="px-4 py-2 rounded-xl border border-accent bg-accent outline outline-1 outline-black text-sm text-true-white shadow-glow hover:opacity-90"
        >
          Back to dashboard
        </Link>
      </div>

      <div className="glass-panel rounded-2xl p-4 flex flex-wrap gap-3 items-center">
        <div className="text-sm text-slate-300">Students: {students.length}</div>
        <label className="inline-flex items-center gap-2 text-sm text-slate-300">
          Sort by
          <select
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
          className="px-3 py-2 rounded-lg border border-accent bg-accent text-sm text-true-white shadow-glow hover:opacity-90"
          onClick={() => setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))}
        >
          Order ({sortDirectionLabel})
        </button>
        {status && (
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-amber-200">{status}</div>
        )}
      </div>

      <div className="glass-panel rounded-2xl p-4 overflow-auto">
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
