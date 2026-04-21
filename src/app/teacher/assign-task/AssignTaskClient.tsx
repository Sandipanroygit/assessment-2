"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { uploadFileToBucket } from "@/lib/supabaseData";

type StudentRow = {
  id: string;
  full_name: string;
  email?: string | null;
  grade?: string | null;
  subject?: string | null;
  joined_at?: string | null;
};

type SteamhAssignmentRow = {
  id: string;
  teacher_id: string;
  teacher_name: string;
  student_id: string;
  student_name: string;
  title: string;
  instructions?: string | null;
  instruction_links?: string[] | null;
  instruction_attachments?: Array<{ name?: string | null; url?: string | null; mimeType?: string | null }> | null;
  subject?: string | null;
  grade?: string | null;
  due_at: string;
  status?: string | null;
  assignment_mode?: "individual" | "group" | null;
  group_id?: string | null;
  group_name?: string | null;
  group_size?: number | null;
  submitted_project_id?: string | null;
  submitted_at?: string | null;
  last_reminded_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function formatDueDate(value?: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toInputDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function defaultAssignmentDueInput() {
  const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  date.setHours(23, 59, 0, 0);
  return toInputDateTime(date.toISOString());
}

function normalizeGrade(value?: string | null) {
  return typeof value === "string" ? value.trim() : "";
}

const STEAMH_ASSIGNMENT_ASSETS_BUCKET = "steamh-projects";
const STEAMH_ASSIGNMENT_ASSETS_PREFIX = "teacher-assignment-assets";

export default function TeacherAssignTaskPage() {
  const [fullName, setFullName] = useState("Teacher");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [selectedGrade, setSelectedGrade] = useState("");
  const [assignments, setAssignments] = useState<SteamhAssignmentRow[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [assignmentStatus, setAssignmentStatus] = useState<string | null>(null);
  const [assignmentForm, setAssignmentForm] = useState({
    mode: "individual" as "individual" | "group",
    studentId: "",
    studentIds: [] as string[],
    groupName: "",
    title: "",
    dueAt: defaultAssignmentDueInput(),
    instructions: "",
    instructionLinks: "",
  });
  const [instructionFiles, setInstructionFiles] = useState<File[]>([]);
  const [assigningTask, setAssigningTask] = useState(false);
  const [remindingAssignmentId, setRemindingAssignmentId] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const onInstructionFilesChange = (files: FileList | null) => {
    const next = files ? Array.from(files) : [];
    setInstructionFiles(next.slice(0, 10));
  };

  const loadAssignments = useCallback(async (token: string) => {
    try {
      const res = await fetch("/api/teacher/steamh-assignments", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAssignments([]);
        setAssignmentStatus(body?.error ?? "Unable to load STEAM-H assignments");
        return;
      }
      const rows = (body.assignments ?? []) as SteamhAssignmentRow[];
      setAssignments(rows);
      setAssignmentStatus(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load STEAM-H assignments";
      setAssignments([]);
      setAssignmentStatus(message);
    }
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
            .select("full_name")
            .eq("id", session.user.id)
            .maybeSingle();
          setFullName(profile?.full_name || session.user.user_metadata?.full_name || session.user.email || "Teacher");
        }
        if (!token) {
          setStatus("Please log in again.");
          setIsInitialLoading(false);
          return;
        }
        setStatus("Loading assignment workspace...");
        const res = await fetch("/api/teacher/students", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setStatus(body?.error ?? "Unable to load students");
          setIsInitialLoading(false);
          return;
        }
        setStudents(body.students ?? []);
        await loadAssignments(token);
        setStatus(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load assignment workspace";
        setStatus(message);
      } finally {
        setIsInitialLoading(false);
      }
    };
    void load();
  }, [loadAssignments]);

  const gradeOptions = useMemo(() => {
    const uniqueGrades = new Map<string, string>();
    for (const student of students) {
      const grade = normalizeGrade(student.grade);
      if (!grade) continue;
      const key = grade.toLowerCase();
      if (!uniqueGrades.has(key)) {
        uniqueGrades.set(key, grade);
      }
    }
    return Array.from(uniqueGrades.values()).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
    );
  }, [students]);

  const filteredStudents = useMemo(() => {
    if (!selectedGrade) return students;
    const selectedKey = selectedGrade.toLowerCase();
    return students.filter((student) => normalizeGrade(student.grade).toLowerCase() === selectedKey);
  }, [selectedGrade, students]);

  useEffect(() => {
    setAssignmentForm((prev) => {
      if (prev.mode === "group") {
        const nextStudentIds = prev.studentIds.filter((id) => filteredStudents.some((student) => student.id === id));
        return {
          ...prev,
          studentIds: nextStudentIds,
        };
      }
      if (prev.studentId && filteredStudents.some((student) => student.id === prev.studentId)) {
        return prev;
      }
      return { ...prev, studentId: filteredStudents[0]?.id ?? "" };
    });
  }, [filteredStudents]);

  const assignmentRows = useMemo(
    () =>
      [...assignments].sort((a, b) => {
        const aDue = Date.parse(a.due_at);
        const bDue = Date.parse(b.due_at);
        if (!Number.isNaN(aDue) && !Number.isNaN(bDue) && aDue !== bDue) return aDue - bDue;
        const aCreated = a.created_at ? Date.parse(a.created_at) : 0;
        const bCreated = b.created_at ? Date.parse(b.created_at) : 0;
        return bCreated - aCreated;
      }),
    [assignments],
  );

  const createAssignment = useCallback(async () => {
    if (!sessionToken) {
      setAssignmentStatus("Please log in again.");
      return;
    }
    const mode = assignmentForm.mode;
    const studentId = assignmentForm.studentId.trim();
    const studentIds = assignmentForm.studentIds;
    const groupName = assignmentForm.groupName.trim();
    const title = assignmentForm.title.trim();
    const dueAtRaw = assignmentForm.dueAt.trim();
    const instructions = assignmentForm.instructions.trim();
    const instructionLinks = assignmentForm.instructionLinks
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 20);

    if (mode === "individual") {
      if (!studentId) {
        setAssignmentStatus("Select a student before assigning.");
        return;
      }
    } else {
      if (studentIds.length < 2) {
        setAssignmentStatus("Select at least 2 students to create a group task.");
        return;
      }
      if (!groupName || groupName.length < 2) {
        setAssignmentStatus("Group name should be at least 2 characters.");
        return;
      }
    }
    if (!title || title.length < 4) {
      setAssignmentStatus("Assignment title should be at least 4 characters.");
      return;
    }
    if (!dueAtRaw) {
      setAssignmentStatus("Deadline is required.");
      return;
    }
    const dueAtDate = new Date(dueAtRaw);
    if (Number.isNaN(dueAtDate.getTime())) {
      setAssignmentStatus("Please provide a valid deadline.");
      return;
    }

    try {
      setAssigningTask(true);
      setAssignmentStatus(null);
      const uploadedInstructionAttachments = await Promise.all(
        instructionFiles.map(async (file) => {
          const url = await uploadFileToBucket({
            bucket: STEAMH_ASSIGNMENT_ASSETS_BUCKET,
            file,
            pathPrefix: `${STEAMH_ASSIGNMENT_ASSETS_PREFIX}/${Date.now()}`,
          });
          return {
            name: file.name,
            url,
            mimeType: file.type || null,
          };
        }),
      );
      const res = await fetch("/api/teacher/steamh-assignments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode,
          studentId: mode === "individual" ? studentId : undefined,
          studentIds: mode === "group" ? studentIds : undefined,
          groupName: mode === "group" ? groupName : undefined,
          title,
          dueAt: dueAtDate.toISOString(),
          instructions,
          instructionLinks,
          instructionAttachments: uploadedInstructionAttachments,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAssignmentStatus(body?.error ?? "Unable to create STEAM-H task.");
        return;
      }

      const warning =
        typeof body?.warning === "string" && body.warning.trim().length > 0 ? ` (${body.warning})` : "";
      setAssignmentStatus(`Task assigned successfully.${warning}`);
      setAssignmentForm((prev) => ({
        ...prev,
        studentIds: [],
        groupName: "",
        title: "",
        instructions: "",
        instructionLinks: "",
        dueAt: defaultAssignmentDueInput(),
      }));
      setInstructionFiles([]);
      await loadAssignments(sessionToken);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create STEAM-H task.";
      setAssignmentStatus(message);
    } finally {
      setAssigningTask(false);
    }
  }, [assignmentForm, instructionFiles, loadAssignments, sessionToken]);

  const selectedGroupStudents = useMemo(
    () => filteredStudents.filter((student) => assignmentForm.studentIds.includes(student.id)),
    [assignmentForm.studentIds, filteredStudents],
  );

  const sendAssignmentReminder = useCallback(
    async (assignmentId: string, studentName: string) => {
      if (!sessionToken) {
        setAssignmentStatus("Please log in again.");
        return;
      }
      try {
        setRemindingAssignmentId(assignmentId);
        setAssignmentStatus(null);
        const res = await fetch("/api/teacher/steamh-assignments/reminders", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ assignmentId }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setAssignmentStatus(body?.error ?? "Unable to send reminder");
          return;
        }
        setAssignmentStatus(`Reminder sent to ${studentName}`);
        await loadAssignments(sessionToken);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to send reminder";
        setAssignmentStatus(message);
      } finally {
        setRemindingAssignmentId(null);
      }
    },
    [loadAssignments, sessionToken],
  );

  return (
    <main className="section-padding space-y-8">
      <div
        className="sticky top-0 z-30 isolate -mx-[clamp(1.25rem,4vw,4rem)] -mt-[clamp(2rem,4vw,3.5rem)] space-y-3 overflow-visible rounded-none border border-white/35 bg-white/30 supports-[backdrop-filter]:bg-white/16 px-3 pb-3 pt-[clamp(2rem,4vw,3.5rem)] shadow-[0_26px_56px_rgba(15,23,42,0.24)] backdrop-blur-3xl backdrop-saturate-150"
      >
        <div
          className="relative z-20 rounded-none border border-white/28 bg-white/35 supports-[backdrop-filter]:bg-white/20 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.16)] backdrop-blur-2xl"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-accent-strong">Teacher</p>
              <h1 className="text-3xl font-semibold text-white leading-tight">Hi {fullName}</h1>
              <p className="text-slate-300 text-sm">Create and Manage STEAM-H Tasks</p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/teacher/students"
                className="px-4 py-2 rounded-xl border border-white/20 bg-white/5 text-sm text-slate-200 hover:bg-white/10"
              >
                Registered students
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

        <section className="relative z-10 rounded-none border border-white/28 bg-white/35 supports-[backdrop-filter]:bg-white/20 p-2.5 shadow-[0_12px_26px_rgba(15,23,42,0.14)] backdrop-blur-2xl">
          <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Link
              href="/teacher/assign-task"
              className="group relative shrink-0 inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-all bg-accent text-true-white border-accent-strong/40 shadow-glow hover:-translate-y-0.5"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-accent-strong/90 text-true-white">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                  <path d="M9 5h6" />
                  <path d="M9 9h6" />
                  <path d="M9 13h4" />
                  <path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
                </svg>
              </span>
              STEAM-H Task
            </Link>
          </div>
        </section>
      </div>

      {isInitialLoading ? (
        <>
          <div className="glass-panel rounded-2xl p-4 flex flex-wrap gap-3 items-center">
            <div className="h-4 w-40 rounded bg-white/15 animate-pulse" />
            <div className="h-10 w-48 rounded-lg bg-white/10 animate-pulse" />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <section className="glass-panel rounded-2xl p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={`assign-form-skeleton-${index}`} className="h-10 rounded-lg bg-white/10 animate-pulse" />
              ))}
            </section>
            <section className="glass-panel rounded-2xl p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={`assign-table-skeleton-${index}`} className="h-8 rounded bg-white/10 animate-pulse" />
              ))}
            </section>
          </div>
        </>
      ) : (
        <>
          <div className="glass-panel rounded-2xl p-4 flex flex-wrap gap-3 items-center">
            <div className="text-sm text-slate-300">Students: {filteredStudents.length}</div>
            {selectedGrade && <div className="text-sm text-slate-300">Grade: {selectedGrade}</div>}
            <div className="text-sm text-slate-300">STEAM-H tasks: {assignmentRows.length}</div>
            {status && (
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-amber-200">
                {status}
              </div>
            )}
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <section className="glass-panel rounded-2xl p-4 space-y-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-accent-strong">STEAM-H Task</p>
                <h2 className="text-xl font-semibold text-white">Assign STEAM-H Project</h2>
              </div>
              <label className="block text-sm text-slate-300 space-y-1">
                Grade
                <select
                  value={selectedGrade}
                  onChange={(event) => setSelectedGrade(event.target.value)}
                  className="w-full rounded-xl border border-accent/25 bg-white px-3 py-2 text-slate-900 outline-none focus:border-accent-strong"
                >
                  <option value="" className="text-black">All grades</option>
                  {gradeOptions.map((grade) => (
                    <option key={grade} value={grade} className="text-black">
                      {grade}
                    </option>
                  ))}
                </select>
              </label>
              <div className="space-y-2">
                <p className="text-sm text-slate-300">Assignment mode</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setAssignmentForm((prev) => ({
                        ...prev,
                        mode: "individual",
                        studentIds: [],
                        groupName: "",
                      }))
                    }
                    className={`rounded-xl px-3 py-2 text-sm font-semibold border ${
                      assignmentForm.mode === "individual"
                        ? "border-accent bg-accent text-true-white shadow-glow"
                        : "border-white/20 bg-white/5 text-slate-200 hover:bg-white/10"
                    }`}
                  >
                    Individual
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setAssignmentForm((prev) => ({
                        ...prev,
                        mode: "group",
                        studentId: "",
                      }))
                    }
                    className={`rounded-xl px-3 py-2 text-sm font-semibold border ${
                      assignmentForm.mode === "group"
                        ? "border-accent bg-accent text-true-white shadow-glow"
                        : "border-white/20 bg-white/5 text-slate-200 hover:bg-white/10"
                    }`}
                  >
                    Group
                  </button>
                </div>
              </div>
              {assignmentForm.mode === "individual" ? (
                <label className="block text-sm text-slate-300 space-y-1">
                  Student
                  <select
                    value={assignmentForm.studentId}
                    onChange={(event) =>
                      setAssignmentForm((prev) => ({
                        ...prev,
                        studentId: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-accent/25 bg-white px-3 py-2 text-slate-900 outline-none focus:border-accent-strong"
                  >
                    <option value="" className="text-black">Select student</option>
                    {filteredStudents.map((student) => (
                      <option key={student.id} value={student.id} className="text-black">
                        {student.full_name} {student.grade ? `- ${student.grade}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="space-y-2">
                  <label className="block text-sm text-slate-300 space-y-1">
                    Group name
                    <input
                      value={assignmentForm.groupName}
                      onChange={(event) =>
                        setAssignmentForm((prev) => ({
                          ...prev,
                          groupName: event.target.value,
                        }))
                      }
                      maxLength={80}
                      placeholder="Example: Team Falcon"
                      className="w-full rounded-xl border border-accent/25 bg-white px-3 py-2 text-slate-900 outline-none focus:border-accent-strong"
                    />
                  </label>
                  <div className="rounded-xl border border-white/15 bg-white/5 p-3 space-y-2">
                    <p className="text-sm text-slate-200">Select group members</p>
                    <div className="max-h-44 overflow-auto space-y-1 pr-1">
                      {filteredStudents.map((student) => {
                        const checked = assignmentForm.studentIds.includes(student.id);
                        return (
                          <label key={student.id} className="flex items-center gap-2 text-sm text-slate-200">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) =>
                                setAssignmentForm((prev) => ({
                                  ...prev,
                                  studentIds: event.target.checked
                                    ? [...prev.studentIds, student.id]
                                    : prev.studentIds.filter((id) => id !== student.id),
                                }))
                              }
                            />
                            <span>{student.full_name} {student.grade ? `- ${student.grade}` : ""}</span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-xs text-slate-300">
                      Selected: {selectedGroupStudents.length}
                    </p>
                  </div>
                </div>
              )}
              {selectedGrade && filteredStudents.length === 0 && (
                <p className="text-xs text-amber-200">No students found for grade {selectedGrade}.</p>
              )}

              <label className="block text-sm text-slate-300 space-y-1">
                Task title<span className="text-rose-400">*</span>
                <input
                  value={assignmentForm.title}
                  onChange={(event) =>
                    setAssignmentForm((prev) => ({
                      ...prev,
                      title: event.target.value,
                    }))
                  }
                  maxLength={140}
                  placeholder="Example: Build a Solar Water Purifier"
                  className="w-full rounded-xl border border-accent/25 bg-white px-3 py-2 text-slate-900 outline-none focus:border-accent-strong"
                />
              </label>

              <label className="block text-sm text-slate-300 space-y-1">
                Deadline<span className="text-rose-400">*</span>
                <input
                  type="datetime-local"
                  value={assignmentForm.dueAt}
                  onChange={(event) =>
                    setAssignmentForm((prev) => ({
                      ...prev,
                      dueAt: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-accent/25 bg-white px-3 py-2 text-slate-900 outline-none focus:border-accent-strong"
                />
              </label>

              <label className="block text-sm text-slate-300 space-y-1">
                Instructions (optional)
                <textarea
                  value={assignmentForm.instructions}
                  onChange={(event) =>
                    setAssignmentForm((prev) => ({
                      ...prev,
                      instructions: event.target.value,
                    }))
                  }
                  rows={4}
                  maxLength={1500}
                  placeholder="Add expected outcome, rubric points, and submission guidelines."
                  className="w-full rounded-xl border border-accent/25 bg-white px-3 py-2 text-slate-900 outline-none focus:border-accent-strong resize-y"
                />
              </label>
              <label className="block text-sm text-slate-300 space-y-1">
                Reference links (optional, one per line)
                <textarea
                  value={assignmentForm.instructionLinks}
                  onChange={(event) =>
                    setAssignmentForm((prev) => ({
                      ...prev,
                      instructionLinks: event.target.value,
                    }))
                  }
                  rows={3}
                  maxLength={3000}
                  placeholder={"https://example.com/reference\nhttps://drive.google.com/..."}
                  className="w-full rounded-xl border border-accent/25 bg-white px-3 py-2 text-slate-900 outline-none focus:border-accent-strong resize-y"
                />
              </label>
              <label className="block text-sm text-slate-300 space-y-1">
                Attachments (images/pdf/word/ppt/zip)
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.txt"
                  onChange={(event) => onInstructionFilesChange(event.target.files)}
                  className="w-full rounded-xl border border-accent/25 bg-white px-3 py-2 text-slate-900 outline-none focus:border-accent-strong file-accent"
                />
                {instructionFiles.length > 0 ? (
                  <p className="text-xs text-slate-300">{instructionFiles.length} file(s) selected.</p>
                ) : null}
              </label>

              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-400">Students submit this directly from the STEAM-H upload page.</p>
                <button
                  type="button"
                  onClick={() => void createAssignment()}
                  disabled={assigningTask || filteredStudents.length === 0}
                  className="px-4 py-2 rounded-xl border border-accent bg-accent text-sm text-true-white shadow-glow hover:opacity-90 disabled:opacity-60"
                >
                  {assigningTask ? "Saving STEAM-H Task..." : "Assign Task"}
                </button>
              </div>
            </section>

            <section className="glass-panel rounded-2xl p-4 space-y-3 overflow-auto">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-accent-strong">Submission Tracker</p>
                  <h2 className="text-xl font-semibold text-white">Assigned STEAM-H Tasks</h2>
                </div>
                <span className="text-xs text-slate-400">{assignmentRows.length} total</span>
              </div>
              {assignmentRows.length === 0 ? (
                <p className="text-sm text-slate-400">No STEAM-H assignments yet. Create your first task on the left.</p>
              ) : (
                <div className="min-w-[640px] overflow-auto">
                  <table className="table-v1">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Mode</th>
                        <th>Task</th>
                        <th>Deadline</th>
                        <th>Status</th>
                        <th>Submission</th>
                        <th>Reminder</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignmentRows.map((assignment) => {
                        const isSubmitted = Boolean(assignment.submitted_at);
                        const statusLabel = isSubmitted ? "Submitted" : "Not Submitted";
                        const statusClass = isSubmitted
                          ? "border-emerald-700/40 bg-emerald-300 text-emerald-950"
                          : "border-red-800/70 bg-red-600 text-white";

                        return (
                          <tr key={assignment.id}>
                            <td>
                              <p className="font-semibold text-white">
                                {assignment.assignment_mode === "group" && assignment.group_name
                                  ? `${assignment.group_name} - ${assignment.student_name}`
                                  : assignment.student_name}
                              </p>
                              <p className="text-xs text-slate-400">{assignment.grade ?? "--"}</p>
                            </td>
                            <td className="text-slate-300">
                              {assignment.assignment_mode === "group"
                                ? `Group (${assignment.group_size ?? "--"})`
                                : "Individual"}
                            </td>
                            <td>
                              <p className="font-semibold text-white">{assignment.title}</p>
                              {assignment.instructions ? (
                                <p className="text-xs text-slate-400 line-clamp-2">{assignment.instructions}</p>
                              ) : (
                                <p className="text-xs text-slate-500">No instructions added</p>
                              )}
                              {(assignment.instruction_links?.length ?? 0) > 0 ? (
                                <p className="text-xs text-cyan-200">{assignment.instruction_links?.length} link(s) attached</p>
                              ) : null}
                              {(assignment.instruction_attachments?.length ?? 0) > 0 ? (
                                <p className="text-xs text-cyan-200">{assignment.instruction_attachments?.length} file(s) attached</p>
                              ) : null}
                            </td>
                            <td className="text-slate-300">{formatDueDate(assignment.due_at)}</td>
                            <td>
                              <span
                                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass}`}
                              >
                                {statusLabel}
                              </span>
                            </td>
                            <td>
                              {assignment.submitted_at ? (
                                <div className="space-y-1">
                                  <p className="text-xs text-slate-300">{formatDueDate(assignment.submitted_at)}</p>
                                  {assignment.submitted_project_id ? (
                                    <Link
                                      href={`/steamh-projects/${encodeURIComponent(assignment.submitted_project_id)}`}
                                      className="text-xs text-cyan-200 underline"
                                    >
                                      Open project
                                    </Link>
                                  ) : (
                                    <span className="text-xs text-slate-500">Project link unavailable</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-500">Not submitted</span>
                              )}
                            </td>
                            <td>
                              <button
                                type="button"
                                disabled={isSubmitted || remindingAssignmentId === assignment.id}
                                onClick={() => void sendAssignmentReminder(assignment.id, assignment.student_name)}
                                className="inline-flex items-center justify-center rounded-lg border border-amber-700/60 bg-amber-300 px-2.5 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-200 disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500 disabled:opacity-100"
                              >
                                {remindingAssignmentId === assignment.id ? "Sending..." : "Send"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          {assignmentStatus && (
            <div className="rounded-xl border border-amber-600/40 bg-amber-100 px-3 py-2 text-sm font-medium text-amber-950">
              {assignmentStatus}
            </div>
          )}
        </>
      )}
    </main>
  );
}
