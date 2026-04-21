"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { supabase } from "@/lib/supabaseClient";

type Summary = {
  total_students: number;
  total_drone_modules: number;
  total_simulation_assignments: number;
  total_steamh_assignments: number;
  drone_average_accuracy_percent: number;
  drone_average_assessment_percent: number;
  drone_average_combined_percent: number;
  simulation_average_score_percent: number;
  steamh_submission_rate_percent: number;
  overall_student_average_percent: number;
};

type LeaderboardRow = {
  student_id: string;
  student_name: string;
  entries: number;
  average_percent: number;
};

type StudentOverviewRow = {
  student_id: string;
  student_name: string;
  grade: string | null;
  subject: string | null;
  total_entries: number;
  average_percent: number | null;
  drone_average_percent: number | null;
  drone_accuracy_average_percent: number | null;
  drone_assessment_average_percent: number | null;
  simulation_average_percent: number | null;
  steamh_assigned: number;
  steamh_submitted: number;
};

type ScorePoint = {
  timestamp: string;
  percent: number;
  source: "drone" | "simulation";
  title: string;
};

type SelectedStudent = StudentOverviewRow & {
  curves: {
    combined: ScorePoint[];
    drone: ScorePoint[];
    simulation: ScorePoint[];
  };
  recent_scores: ScorePoint[];
};

type AnalyticsResponse = {
  generated_at: string;
  summary: Summary;
  drone: {
    target_student_activity_pairs: number;
    submitted_pairs: number;
    submission_rate_percent: number;
    scored_pairs: number;
    average_accuracy_percent: number;
    average_assessment_percent: number;
    average_combined_percent: number;
    by_activity: Array<{
      module_id: string;
      title: string;
      target_students: number;
      submitted_students: number;
      submission_rate_percent: number;
      average_accuracy_percent: number;
      average_assessment_percent: number;
      average_combined_percent: number;
    }>;
  };
  simulation: {
    target_pairs: number;
    assessment_submissions: number;
    submission_rate_percent: number;
    scored_pairs: number;
    average_score_percent: number;
    by_assignment: Array<{
      title: string;
      targeted_students: number;
      submitted_students: number;
      submission_rate_percent: number;
      average_score_percent: number;
    }>;
  };
  steamh: {
    assigned: number;
    submitted: number;
    submission_rate_percent: number;
    pending_teacher_review: number;
    grading_note: string;
    by_task: Array<{
      title: string;
      assigned_students: number;
      submitted_students: number;
      submission_rate_percent: number;
    }>;
  };
  leaderboard: LeaderboardRow[];
  students_overview: StudentOverviewRow[];
  selected_student: SelectedStudent | null;
};

type AnalyticsTab = "individual" | "classwise" | "drone" | "simulation" | "steamh";

const normalizeApprovalStatus = (value: unknown) =>
  typeof value === "string" && value.trim().toLowerCase() === "approved" ? "approved" : "pending";
const formatPct = (value: number) => `${Math.round(value * 100) / 100}%`;
const formatPctOrDash = (value: number | null) => (value === null ? "--" : formatPct(value));
const formatDateTime = (iso: string) => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "--";
  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function ScoreCurve({
  title,
  subtitle,
  points,
  stroke,
}: {
  title: string;
  subtitle: string;
  points: ScorePoint[];
  stroke: string;
}) {
  const gradientId = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [pointerClient, setPointerClient] = useState<{ x: number; y: number } | null>(null);
  const width = 640;
  const height = 220;
  const padX = 38;
  const padY = 24;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const sorted = useMemo(
    () => [...points].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)),
    [points],
  );
  const plottedPoints = useMemo(() => {
    return sorted.map((point, index) => {
      const x = padX + (sorted.length === 1 ? innerW / 2 : (index / (sorted.length - 1)) * innerW);
      const y = padY + ((100 - point.percent) / 100) * innerH;
      return { ...point, x, y };
    });
  }, [innerH, innerW, padX, padY, sorted]);
  const path = useMemo(() => {
    if (sorted.length === 0) return "";
    return plottedPoints
      .map((point, index) => {
        return `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`;
      })
      .join(" ");
  }, [plottedPoints, sorted.length]);
  const areaPath = useMemo(() => {
    if (!path || sorted.length === 0) return "";
    const firstX = padX + (sorted.length === 1 ? innerW / 2 : 0);
    const lastX = padX + (sorted.length === 1 ? innerW / 2 : innerW);
    const baseY = padY + innerH;
    return `${path} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;
  }, [innerH, innerW, padX, padY, path, sorted.length]);
  const activePoint =
    hoveredIndex !== null && hoveredIndex >= 0 && hoveredIndex < plottedPoints.length
      ? plottedPoints[hoveredIndex]
      : null;

  return (
    <div className="glass-panel rounded-2xl p-4 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <span className="text-xs text-slate-300">{subtitle}</span>
      </div>
      {sorted.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-5 text-sm text-slate-300">No scored points yet.</div>
      ) : (
        <>
          <div className="relative">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${width} ${height}`}
              className="w-full"
              onMouseMove={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                const relX = ((event.clientX - rect.left) / rect.width) * width;
                let nearestIdx = 0;
                let nearestDistance = Number.POSITIVE_INFINITY;
                for (let idx = 0; idx < plottedPoints.length; idx += 1) {
                  const distance = Math.abs(plottedPoints[idx].x - relX);
                  if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestIdx = idx;
                  }
                }
                setHoveredIndex(nearestIdx);
                setPointerClient({ x: event.clientX, y: event.clientY });
              }}
              onMouseLeave={() => {
                setHoveredIndex(null);
                setPointerClient(null);
              }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
                  <stop offset="100%" stopColor={stroke} stopOpacity="0.03" />
                </linearGradient>
              </defs>
              {[0, 50, 100].map((value) => {
                const y = padY + ((100 - value) / 100) * innerH;
                return (
                  <g key={`grid-${value}`}>
                    <line x1={padX} y1={y} x2={padX + innerW} y2={y} stroke="rgba(148,163,184,0.28)" strokeWidth="1" />
                    <text x={8} y={y + 4} fontSize="11" fill="#cbd5e1">
                      {value}
                    </text>
                  </g>
                );
              })}
              <text x={8} y={14} fontSize="11" fill="#cbd5e1">
                Score (%)
              </text>
              <text x={width - 62} y={height - 6} fontSize="11" fill="#cbd5e1">
                Timeline
              </text>
              {areaPath ? <path d={areaPath} fill={`url(#${gradientId})`} /> : null}
              {path ? (
                <path d={path} fill="none" stroke={stroke} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
              ) : null}
              {plottedPoints.map((point, index) => {
                const isActive = hoveredIndex === index;
                return (
                  <circle
                    key={`${point.timestamp}-${index}`}
                    cx={point.x}
                    cy={point.y}
                    r={isActive ? 4.8 : 3.2}
                    fill={stroke}
                    stroke={isActive ? "#ffffff" : "transparent"}
                    strokeWidth={isActive ? 1.5 : 0}
                  />
                );
              })}
            </svg>
            {activePoint && pointerClient && svgRef.current ? (() => {
              const rect = svgRef.current.getBoundingClientRect();
              const left = Math.min(Math.max(pointerClient.x - rect.left + 12, 8), rect.width - 220);
              const top = Math.min(Math.max(pointerClient.y - rect.top + 12, 8), rect.height - 88);
              return (
                <div
                  className="pointer-events-none absolute z-20 w-[212px] rounded-lg border border-slate-300 bg-white p-2 text-[11px] leading-tight text-slate-800 shadow-[0_10px_24px_rgba(15,23,42,0.22)]"
                  style={{ left, top }}
                >
                  <p className="font-semibold text-slate-900">{activePoint.title}</p>
                  <p className="text-slate-700">
                    {activePoint.source === "drone" ? "Drone Accuracy (%)" : "Simulation Assessment (%)"}
                  </p>
                  <p className="text-slate-600">{formatDateTime(activePoint.timestamp)}</p>
                  <p className="mt-1 text-slate-900 font-semibold">Score: {formatPct(activePoint.percent)}</p>
                </div>
              );
            })() : null}
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
            <span>Hover over curve points to see details.</span>
          </div>
        </>
      )}
    </div>
  );
}

export default function TeacherAnalyticsPage() {
  const [fullName, setFullName] = useState("Teacher");
  const [status, setStatus] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("individual");
  const [selectedGrade, setSelectedGrade] = useState<string>("all");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [, startLoading] = useTransition();

  useEffect(() => {
    const load = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData.session;
        const token = session?.access_token ?? null;
        if (session?.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, approval_status")
            .eq("id", session.user.id)
            .maybeSingle();
          if (normalizeApprovalStatus(profile?.approval_status ?? session.user.user_metadata?.approval_status) !== "approved") {
            await supabase.auth.signOut();
            window.location.href = "/login?reason=pending";
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
            setStatus("Loading analytics...");
            try {
              const query = selectedStudentId ? `?studentId=${encodeURIComponent(selectedStudentId)}` : "";
              const res = await fetch(`/api/teacher/analytics${query}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              const body = await res.json().catch(() => ({}));
              if (!res.ok) {
                setStatus(body?.error ?? "Unable to load analytics");
                return;
              }
              const parsed = body as AnalyticsResponse;
              setData(parsed);
              if (!selectedStudentId && parsed.selected_student?.student_id) {
                setSelectedStudentId(parsed.selected_student.student_id);
              }
              setStatus(null);
            } catch (err) {
              const message = err instanceof Error ? err.message : "Unable to load analytics";
              setStatus(message);
            } finally {
              setIsInitialLoading(false);
            }
          })();
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load analytics";
        setStatus(message);
        setIsInitialLoading(false);
      }
    };
    void load();
  }, [selectedStudentId]);

  const generatedLabel = useMemo(
    () => (data?.generated_at ? formatDateTime(data.generated_at) : "--"),
    [data?.generated_at],
  );

  const gradeOptions = useMemo(() => {
    if (!data) return [];
    const unique = new Map<string, string>();
    for (const row of data.students_overview) {
      const grade = row.grade?.trim();
      if (!grade) continue;
      const key = grade.toLowerCase();
      if (!unique.has(key)) unique.set(key, grade);
    }
    return Array.from(unique.values()).sort((a, b) => {
      const aMatch = a.match(/\d+/);
      const bMatch = b.match(/\d+/);
      const aRank = aMatch ? Number(aMatch[0]) : Number.MAX_SAFE_INTEGER;
      const bRank = bMatch ? Number(bMatch[0]) : Number.MAX_SAFE_INTEGER;
      return aRank - bRank || a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
    });
  }, [data]);

  const filteredStudents = useMemo(() => {
    if (!data) return [];
    if (selectedGrade === "all") return data.students_overview;
    return data.students_overview.filter((row) => (row.grade ?? "").trim() === selectedGrade);
  }, [data, selectedGrade]);

  const classwiseRows = useMemo(() => {
    if (!data) return [];
    const byGrade = new Map<
      string,
      {
        grade: string;
        studentCount: number;
        overallTotal: number;
        overallCount: number;
        droneTotal: number;
        droneCount: number;
        simulationTotal: number;
        simulationCount: number;
        steamhAssigned: number;
        steamhSubmitted: number;
      }
    >();
    for (const row of data.students_overview) {
      const grade = (row.grade ?? "").trim() || "Unspecified";
      const agg =
        byGrade.get(grade) ??
        {
          grade,
          studentCount: 0,
          overallTotal: 0,
          overallCount: 0,
          droneTotal: 0,
          droneCount: 0,
          simulationTotal: 0,
          simulationCount: 0,
          steamhAssigned: 0,
          steamhSubmitted: 0,
        };
      agg.studentCount += 1;
      if (typeof row.average_percent === "number") {
        agg.overallTotal += row.average_percent;
        agg.overallCount += 1;
      }
      if (typeof row.drone_average_percent === "number") {
        agg.droneTotal += row.drone_average_percent;
        agg.droneCount += 1;
      }
      if (typeof row.simulation_average_percent === "number") {
        agg.simulationTotal += row.simulation_average_percent;
        agg.simulationCount += 1;
      }
      agg.steamhAssigned += row.steamh_assigned;
      agg.steamhSubmitted += row.steamh_submitted;
      byGrade.set(grade, agg);
    }
    return Array.from(byGrade.values())
      .map((row) => ({
        grade: row.grade,
        students: row.studentCount,
        overall_avg_percent: row.overallCount > 0 ? Math.round((row.overallTotal / row.overallCount) * 100) / 100 : null,
        drone_avg_percent: row.droneCount > 0 ? Math.round((row.droneTotal / row.droneCount) * 100) / 100 : null,
        simulation_avg_percent:
          row.simulationCount > 0 ? Math.round((row.simulationTotal / row.simulationCount) * 100) / 100 : null,
        steamh_submission_rate_percent:
          row.steamhAssigned > 0 ? Math.round((row.steamhSubmitted / row.steamhAssigned) * 10000) / 100 : null,
      }))
      .sort((a, b) => {
        const aMatch = a.grade.match(/\d+/);
        const bMatch = b.grade.match(/\d+/);
        const aRank = aMatch ? Number(aMatch[0]) : Number.MAX_SAFE_INTEGER;
        const bRank = bMatch ? Number(bMatch[0]) : Number.MAX_SAFE_INTEGER;
        return aRank - bRank || a.grade.localeCompare(b.grade, undefined, { sensitivity: "base", numeric: true });
      });
  }, [data]);

  useEffect(() => {
    if (!data) return;
    if (filteredStudents.length === 0) return;
    const exists = filteredStudents.some((row) => row.student_id === selectedStudentId);
    if (!exists) {
      setSelectedStudentId(filteredStudents[0].student_id);
    }
  }, [data, filteredStudents, selectedStudentId]);

  const selectedStudent = data?.selected_student ?? null;
  const showSelectedStudent =
    !!selectedStudent && filteredStudents.some((row) => row.student_id === selectedStudent.student_id);

  return (
    <main className="section-padding space-y-8">
      <div className="sticky top-0 z-30 isolate -mx-[clamp(1.25rem,4vw,4rem)] -mt-[clamp(2rem,4vw,3.5rem)] space-y-3 overflow-visible rounded-none border border-white/35 bg-white/30 supports-[backdrop-filter]:bg-white/16 px-3 pb-3 pt-[clamp(2rem,4vw,3.5rem)] shadow-[0_26px_56px_rgba(15,23,42,0.24)] backdrop-blur-3xl backdrop-saturate-150">
        <div className="relative z-20 rounded-none border border-white/28 bg-white/35 supports-[backdrop-filter]:bg-white/20 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.16)] backdrop-blur-2xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-accent-strong">Teacher</p>
              <h1 className="text-3xl font-semibold text-white leading-tight">Hi {fullName}</h1>
              <p className="text-slate-300 text-sm">Separate Performance Analytics Dashboard</p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/teacher/progress"
                className="px-4 py-2 rounded-xl border border-white/20 bg-white/5 text-sm text-slate-200 hover:bg-white/10"
              >
                Student progress
              </Link>
              <Link
                href="/customer"
                className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-sm !text-white hover:!text-white visited:!text-white font-semibold shadow-md ring-1 ring-white/10 hover:-translate-y-0.5 transition-transform duration-150"
              >
                Back to dashboard
              </Link>
            </div>
          </div>
        </div>
        {data && (
          <section className="relative z-10 rounded-none border border-white/28 bg-white/35 supports-[backdrop-filter]:bg-white/20 p-2.5 shadow-[0_12px_26px_rgba(15,23,42,0.14)] backdrop-blur-2xl">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <button
                  type="button"
                  onClick={() => setActiveTab("individual")}
                  className={`group relative shrink-0 inline-flex min-h-11 items-center gap-2 rounded-full border px-5 py-3 text-base font-semibold transition-all ${
                    activeTab === "individual"
                      ? "bg-accent text-true-white border-accent-strong/40 shadow-glow"
                      : "bg-white/85 text-foreground border-accent/25 hover:border-accent-strong hover:bg-white"
                  }`}
                >
                  Individual
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("drone")}
                  className={`group relative shrink-0 inline-flex min-h-11 items-center gap-2 rounded-full border px-5 py-3 text-base font-semibold transition-all ${
                    activeTab === "drone"
                      ? "bg-accent text-true-white border-accent-strong/40 shadow-glow"
                      : "bg-white/85 text-foreground border-accent/25 hover:border-accent-strong hover:bg-white"
                  }`}
                >
                  Drone
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("classwise")}
                  className={`group relative shrink-0 inline-flex min-h-11 items-center gap-2 rounded-full border px-5 py-3 text-base font-semibold transition-all ${
                    activeTab === "classwise"
                      ? "bg-accent text-true-white border-accent-strong/40 shadow-glow"
                      : "bg-white/85 text-foreground border-accent/25 hover:border-accent-strong hover:bg-white"
                  }`}
                >
                  Classwise
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("simulation")}
                  className={`group relative shrink-0 inline-flex min-h-11 items-center gap-2 rounded-full border px-5 py-3 text-base font-semibold transition-all ${
                    activeTab === "simulation"
                      ? "bg-accent text-true-white border-accent-strong/40 shadow-glow"
                      : "bg-white/85 text-foreground border-accent/25 hover:border-accent-strong hover:bg-white"
                  }`}
                >
                  Simulation
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("steamh")}
                  className={`group relative shrink-0 inline-flex min-h-11 items-center gap-2 rounded-full border px-5 py-3 text-base font-semibold transition-all ${
                    activeTab === "steamh"
                      ? "bg-accent text-true-white border-accent-strong/40 shadow-glow"
                      : "bg-white/85 text-foreground border-accent/25 hover:border-accent-strong hover:bg-white"
                  }`}
                >
                  STEAM-H
                </button>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs text-slate-300 space-y-1">
                  Grade
                  <select
                    value={selectedGrade}
                    onChange={(event) => setSelectedGrade(event.target.value)}
                    className="block min-w-[140px] rounded-xl border border-white/20 bg-white px-3 py-2 text-slate-900 outline-none"
                  >
                    <option value="all">All grades</option>
                    {gradeOptions.map((grade) => (
                      <option key={grade} value={grade}>
                        {grade}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-slate-300 space-y-1">
                  Student
                  <select
                    value={selectedStudentId}
                    onChange={(event) => setSelectedStudentId(event.target.value)}
                    className="block min-w-[220px] rounded-xl border border-white/20 bg-white px-3 py-2 text-slate-900 outline-none"
                  >
                    {filteredStudents.map((row) => (
                      <option key={row.student_id} value={row.student_id}>
                        {row.student_name}{row.grade ? ` - ${row.grade}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-300">Generated: {generatedLabel}</div>
          </section>
        )}
      </div>

      {isInitialLoading ? (
        <div className="glass-panel rounded-2xl p-6">
          <p className="text-slate-200">Loading analytics...</p>
        </div>
      ) : (
        <>
          {status && (
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-amber-200">{status}</div>
          )}
          {data && (
            <>
              {activeTab === "individual" && (
                <section className="glass-panel rounded-2xl p-4 space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Individual Student Performance</h2>
                    <p className="text-xs text-slate-300">Professional score curves across drone and simulation assessments.</p>
                  </div>
                </div>

                {showSelectedStudent && selectedStudent ? (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <p className="text-xs uppercase text-slate-300">Student</p>
                        <p className="text-sm font-semibold text-white">{selectedStudent.student_name}</p>
                        <p className="text-xs text-slate-300">{selectedStudent.grade ?? "--"}</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <p className="text-xs uppercase text-slate-300">Overall Avg</p>
                        <p className="text-xl font-semibold text-white">{formatPctOrDash(selectedStudent.average_percent)}</p>
                        <p className="text-xs text-slate-300">Entries: {selectedStudent.total_entries}</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <p className="text-xs uppercase text-slate-300">Drone Combined Avg</p>
                        <p className="text-xl font-semibold text-white">{formatPctOrDash(selectedStudent.drone_average_percent)}</p>
                        <p className="text-xs text-slate-300">
                          Acc: {formatPctOrDash(selectedStudent.drone_accuracy_average_percent)} | Assess:{" "}
                          {formatPctOrDash(selectedStudent.drone_assessment_average_percent)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <p className="text-xs uppercase text-slate-300">Simulation Avg</p>
                        <p className="text-xl font-semibold text-white">{formatPctOrDash(selectedStudent.simulation_average_percent)}</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <p className="text-xs uppercase text-slate-300">STEAM-H</p>
                        <p className="text-xl font-semibold text-white">{selectedStudent.steamh_submitted}/{selectedStudent.steamh_assigned}</p>
                        <p className="text-xs text-slate-300">Submitted/Assigned</p>
                      </div>
                    </div>

                    <ScoreCurve
                      title="Combined Score (%) Curve"
                      subtitle={`${selectedStudent.curves.combined.length} points`}
                      points={selectedStudent.curves.combined}
                      stroke="#06b6d4"
                    />
                    <div className="grid gap-4 xl:grid-cols-2">
                      <ScoreCurve
                        title="Drone Accuracy (%) Curve"
                        subtitle={`${selectedStudent.curves.drone.length} points`}
                        points={selectedStudent.curves.drone}
                        stroke="#f59e0b"
                      />
                      <ScoreCurve
                        title="Simulation Assessment (%) Curve"
                        subtitle={`${selectedStudent.curves.simulation.length} points`}
                        points={selectedStudent.curves.simulation}
                        stroke="#34d399"
                      />
                    </div>

                    <div className="overflow-auto">
                      <table className="table-v1">
                        <thead>
                          <tr>
                            <th>When</th>
                            <th>Track</th>
                            <th>Activity</th>
                            <th>Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedStudent.recent_scores.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="text-slate-300">No recent scored activity.</td>
                            </tr>
                          ) : (
                            selectedStudent.recent_scores.map((item, index) => (
                              <tr key={`${item.timestamp}-${item.source}-${index}`}>
                                <td className="text-slate-300">{formatDateTime(item.timestamp)}</td>
                                <td className="text-slate-300 capitalize">{item.source}</td>
                                <td className="font-semibold text-white">{item.title}</td>
                                <td className="text-slate-300">{formatPct(item.percent)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-5 text-sm text-slate-300">
                    No students found for the selected grade.
                  </div>
                )}
                </section>
              )}

              {activeTab === "drone" && (
                <section className="glass-panel rounded-2xl p-4 overflow-auto">
                  <h2 className="text-lg font-semibold text-white mb-3">Drone Activities</h2>
                  <table className="table-v1">
                    <thead>
                      <tr>
                        <th>Activity</th>
                        <th>Submission Rate</th>
                        <th>Avg Accuracy</th>
                        <th>Avg Assessment</th>
                        <th>Avg Combined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.drone.by_activity.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-slate-300">No drone activity analytics yet.</td>
                        </tr>
                      ) : (
                        data.drone.by_activity.map((row) => (
                          <tr key={row.module_id}>
                            <td className="font-semibold text-white">{row.title}</td>
                            <td className="text-slate-300">{formatPct(row.submission_rate_percent)}</td>
                            <td className="text-slate-300">{formatPct(row.average_accuracy_percent)}</td>
                            <td className="text-slate-300">{formatPct(row.average_assessment_percent)}</td>
                            <td className="text-slate-300">{formatPct(row.average_combined_percent)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </section>
              )}

              {activeTab === "classwise" && (
                <section className="glass-panel rounded-2xl p-4 overflow-auto space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-white">Classwise Analytics</h2>
                    <span className="text-xs text-slate-300">By grade/class</span>
                  </div>
                  <table className="table-v1">
                    <thead>
                      <tr>
                        <th>Grade</th>
                        <th>Students</th>
                        <th>Overall Avg</th>
                        <th>Drone Avg</th>
                        <th>Simulation Avg</th>
                        <th>STEAM-H Submission</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classwiseRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-slate-300">No classwise analytics yet.</td>
                        </tr>
                      ) : (
                        classwiseRows.map((row) => (
                          <tr key={row.grade}>
                            <td className="font-semibold text-white">{row.grade}</td>
                            <td className="text-slate-300">{row.students}</td>
                            <td className="text-slate-300">{formatPctOrDash(row.overall_avg_percent)}</td>
                            <td className="text-slate-300">{formatPctOrDash(row.drone_avg_percent)}</td>
                            <td className="text-slate-300">{formatPctOrDash(row.simulation_avg_percent)}</td>
                            <td className="text-slate-300">{formatPctOrDash(row.steamh_submission_rate_percent)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </section>
              )}

              {activeTab === "simulation" && (
                <section className="glass-panel rounded-2xl p-4 overflow-auto">
                  <h2 className="text-lg font-semibold text-white mb-3">Simulations</h2>
                  <table className="table-v1">
                    <thead>
                      <tr>
                        <th>Simulation</th>
                        <th>Submission Rate</th>
                        <th>Avg Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.simulation.by_assignment.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="text-slate-300">No simulation analytics yet.</td>
                        </tr>
                      ) : (
                        data.simulation.by_assignment.map((row, rowIndex) => (
                          <tr key={`${row.title}-${rowIndex}`}>
                            <td className="font-semibold text-white">{row.title}</td>
                            <td className="text-slate-300">{formatPct(row.submission_rate_percent)}</td>
                            <td className="text-slate-300">{formatPct(row.average_score_percent)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </section>
              )}

              {activeTab === "steamh" && (
                <section className="glass-panel rounded-2xl p-4 overflow-auto space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-white">STEAM-H</h2>
                  <span className="text-xs text-slate-300">Pending review: {data.steamh.pending_teacher_review}</span>
                </div>
                <p className="text-xs text-slate-300">{data.steamh.grading_note}</p>
                <table className="table-v1">
                  <thead>
                    <tr>
                      <th>Task</th>
                      <th>Assigned</th>
                      <th>Submitted</th>
                      <th>Submission Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.steamh.by_task.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-slate-300">No STEAM-H analytics yet.</td>
                      </tr>
                    ) : (
                      data.steamh.by_task.map((row, rowIndex) => (
                        <tr key={`${row.title}-${rowIndex}`}>
                          <td className="font-semibold text-white">{row.title}</td>
                          <td className="text-slate-300">{row.assigned_students}</td>
                          <td className="text-slate-300">{row.submitted_students}</td>
                          <td className="text-slate-300">{formatPct(row.submission_rate_percent)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                </section>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
