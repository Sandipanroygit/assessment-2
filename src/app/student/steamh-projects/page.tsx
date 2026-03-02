"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadFileToBucket } from "@/lib/supabaseData";
import {
  fetchSteamhProjects,
  MAX_STEAMH_ATTACHMENTS,
  MAX_STEAMH_ATTACHMENT_SIZE_BYTES,
  MAX_STEAMH_IMAGES,
  MAX_STEAMH_IMAGE_SIZE_BYTES,
  MAX_STEAMH_VIDEOS,
  MAX_STEAMH_VIDEO_SIZE_BYTES,
  splitCsvValues,
  splitMultilineUrls,
  STEAMH_PROJECTS_BUCKET,
  STEAMH_PROJECTS_PATH_PREFIX,
} from "@/lib/steamhProjects";
import { supabase } from "@/lib/supabaseClient";
import type { SteamhProject, SteamhProjectLink } from "@/types";

type StudentRole = "student" | "teacher" | "admin" | "";

type AssignedSteamhTask = {
  id: string;
  teacher_id: string;
  teacher_name: string;
  student_id: string;
  student_name: string;
  title: string;
  instructions?: string | null;
  subject?: string | null;
  grade?: string | null;
  due_at: string;
  status?: string | null;
  submitted_project_id?: string | null;
  submitted_at?: string | null;
  last_reminded_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ProjectForm = {
  title: string;
  summary: string;
  description: string;
  subject: string;
  grade: string;
  schoolName: string;
  challenge: string;
  solution: string;
  tags: string;
  toolsUsed: string;
  videoLinks: string;
  externalLinks: string;
};

const initialForm: ProjectForm = {
  title: "",
  summary: "",
  description: "",
  subject: "",
  grade: "",
  schoolName: "",
  challenge: "",
  solution: "",
  tags: "",
  toolsUsed: "",
  videoLinks: "",
  externalLinks: "",
};

const formatBytes = (value: number) => {
  if (value >= 1024 * 1024) return `${Math.round((value / (1024 * 1024)) * 10) / 10} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} bytes`;
};

const formatDueAt = (value?: string | null) => {
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

const normalizeRole = (value: unknown): StudentRole => {
  const role = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (role === "teacher") return "teacher";
  if (role === "admin") return "admin";
  if (role === "student" || role === "customer") return "student";
  return "";
};

const sanitizeSegment = (value: string) =>
  value.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "item";

const parseExternalLinks = (raw: string, maxItems = 8) => {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const links: SteamhProjectLink[] = [];
  const invalidLines: string[] = [];

  for (const line of lines) {
    if (links.length >= maxItems) break;
    const pipeIndex = line.indexOf("|");
    const label = pipeIndex >= 0 ? line.slice(0, pipeIndex).trim() : "";
    const urlText = pipeIndex >= 0 ? line.slice(pipeIndex + 1).trim() : line;
    try {
      const parsed = new URL(urlText);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        invalidLines.push(line);
        continue;
      }
      links.push({
        url: parsed.toString(),
        label: label || undefined,
      });
    } catch {
      invalidLines.push(line);
    }
  }

  return { links, invalidLines };
};

const validateFiles = (
  files: File[],
  options: {
    label: string;
    maxFiles: number;
    maxSizeBytes: number;
    accept: (file: File) => boolean;
  },
) => {
  if (files.length > options.maxFiles) {
    return `You can upload up to ${options.maxFiles} ${options.label} files.`;
  }
  for (const file of files) {
    if (!options.accept(file)) {
      return `Unsupported ${options.label} file type: ${file.name}`;
    }
    if (file.size > options.maxSizeBytes) {
      return `${file.name} exceeds ${formatBytes(options.maxSizeBytes)} limit.`;
    }
  }
  return null;
};
const isMissingCollaborationEnabledColumnError = (error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";
  return /collaboration_enabled/i.test(message) && /(column|schema cache)/i.test(message);
};

export default function StudentSteamhProjectsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<StudentRole>("");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState("Student");
  const [projects, setProjects] = useState<SteamhProject[]>([]);
  const [assignments, setAssignments] = useState<AssignedSteamhTask[]>([]);
  const [assignmentStatus, setAssignmentStatus] = useState<string | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [form, setForm] = useState<ProjectForm>(initialForm);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [collaborationEnabled, setCollaborationEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canUpload = role === "student";

  const loadStudentProjects = useCallback(async (studentId: string) => {
    try {
      const rows = await fetchSteamhProjects({
        includeUnpublished: true,
        studentId,
        limit: 20,
      });
      setProjects(rows);
    } catch {
      setProjects([]);
    }
  }, []);

  const loadAssignedTasks = useCallback(async (token: string) => {
    try {
      setAssignmentStatus("Loading assigned tasks...");
      const response = await fetch("/api/student/steamh-assignments", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setAssignments([]);
        setAssignmentStatus(body?.error ?? "Unable to load assigned STEAM-H tasks.");
        return;
      }
      const rows = (body.assignments ?? []) as AssignedSteamhTask[];
      setAssignments(rows);
      setSelectedAssignmentId((prev) => {
        if (prev && rows.some((row) => row.id === prev)) return prev;
        const pending = rows.find((row) => !row.submitted_at);
        return pending?.id ?? "";
      });
      setAssignmentStatus(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load assigned STEAM-H tasks.";
      setAssignments([]);
      setAssignmentStatus(message);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data.user;
        if (!user) {
          if (mounted) {
            router.replace("/login");
          }
          return;
        }

        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token ?? null;

        const { data: profileData } = await supabase
          .from("profiles")
          .select("role,full_name,grade")
          .eq("id", user.id)
          .maybeSingle();

        if (!mounted) return;

        const resolvedRole =
          normalizeRole(user.user_metadata?.role) ||
          normalizeRole((profileData as { role?: unknown } | null)?.role) ||
          "";
        const resolvedName =
          (profileData as { full_name?: string } | null)?.full_name ??
          (user.user_metadata?.full_name as string | undefined) ??
          user.email ??
          "Student";
        const resolvedGrade =
          (profileData as { grade?: string } | null)?.grade ??
          (user.user_metadata?.grade as string | undefined) ??
          "";

        setRole(resolvedRole);
        setSessionToken(token);
        setUserId(user.id);
        setStudentName(resolvedName);
        setForm((prev) => ({ ...prev, grade: resolvedGrade || prev.grade }));
        setReady(true);

        if (resolvedRole === "student" && token) {
          void loadAssignedTasks(token);
          void loadStudentProjects(user.id);
        }
      } catch {
        if (!mounted) return;
        router.replace("/login");
      }
    };

    void loadUser();
    return () => {
      mounted = false;
    };
  }, [loadAssignedTasks, loadStudentProjects, router]);

  const mediaCountLabel = useMemo(() => {
    const videoUrlCount = splitMultilineUrls(form.videoLinks, 8).length;
    return `${imageFiles.length} images, ${videoFiles.length + videoUrlCount} videos`;
  }, [form.videoLinks, imageFiles.length, videoFiles.length]);

  const selectedAssignment = useMemo(
    () => assignments.find((assignment) => assignment.id === selectedAssignmentId) ?? null,
    [assignments, selectedAssignmentId],
  );

  const pendingAssignmentsCount = useMemo(
    () => assignments.filter((assignment) => !assignment.submitted_at).length,
    [assignments],
  );
  const fieldLabelClass = "space-y-1 text-sm text-slate-300";
  const fieldInputClass =
    "w-full rounded-xl border border-accent/25 bg-white px-3 py-2 text-slate-900 outline-none focus:border-accent-strong";
  const subtleCardClass = "rounded-xl border border-accent/15 bg-white/75";

  useEffect(() => {
    if (!selectedAssignment) return;
    setForm((prev) => ({
      ...prev,
      subject: prev.subject || selectedAssignment.subject || "",
      grade: prev.grade || selectedAssignment.grade || prev.grade,
      title: prev.title || selectedAssignment.title,
    }));
  }, [selectedAssignment]);

  const onFormChange = (key: keyof ProjectForm, value: string) => {
    setSubmitError(null);
    setSubmitStatus(null);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onImageChange = (files: FileList | null) => {
    const next = files ? Array.from(files) : [];
    const error = validateFiles(next, {
      label: "image",
      maxFiles: MAX_STEAMH_IMAGES,
      maxSizeBytes: MAX_STEAMH_IMAGE_SIZE_BYTES,
      accept: (file) => file.type.startsWith("image/"),
    });
    if (error) {
      setSubmitError(error);
      return;
    }
    setSubmitError(null);
    setImageFiles(next);
  };

  const onVideoChange = (files: FileList | null) => {
    const next = files ? Array.from(files) : [];
    const error = validateFiles(next, {
      label: "video",
      maxFiles: MAX_STEAMH_VIDEOS,
      maxSizeBytes: MAX_STEAMH_VIDEO_SIZE_BYTES,
      accept: (file) => file.type.startsWith("video/"),
    });
    if (error) {
      setSubmitError(error);
      return;
    }
    setSubmitError(null);
    setVideoFiles(next);
  };

  const onAttachmentChange = (files: FileList | null) => {
    const next = files ? Array.from(files) : [];
    const error = validateFiles(next, {
      label: "attachment",
      maxFiles: MAX_STEAMH_ATTACHMENTS,
      maxSizeBytes: MAX_STEAMH_ATTACHMENT_SIZE_BYTES,
      accept: (file) =>
        file.type === "application/pdf" ||
        file.type === "application/zip" ||
        file.type.includes("msword") ||
        file.type.includes("officedocument") ||
        file.name.toLowerCase().endsWith(".pdf") ||
        file.name.toLowerCase().endsWith(".ppt") ||
        file.name.toLowerCase().endsWith(".pptx") ||
        file.name.toLowerCase().endsWith(".doc") ||
        file.name.toLowerCase().endsWith(".docx") ||
        file.name.toLowerCase().endsWith(".zip"),
    });
    if (error) {
      setSubmitError(error);
      return;
    }
    setSubmitError(null);
    setAttachmentFiles(next);
  };

  const uploadBatch = useCallback(
    async (files: File[], pathPrefix: string) =>
      Promise.all(
        files.map((file) =>
          uploadFileToBucket({
            bucket: STEAMH_PROJECTS_BUCKET,
            file,
            pathPrefix,
          }),
        ),
      ),
    [],
  );

  const handleSubmit = async () => {
    if (!canUpload || !userId) {
      setSubmitError("Only signed-in students can upload projects.");
      return;
    }

    const title = form.title.trim();
    const summary = form.summary.trim();
    const description = form.description.trim();
    const subject = form.subject.trim();
    const grade = form.grade.trim();
    const schoolName = form.schoolName.trim();
    const challenge = form.challenge.trim();
    const solution = form.solution.trim();
    const tags = splitCsvValues(form.tags, 12);
    const toolsUsed = splitCsvValues(form.toolsUsed, 12);
    const videoLinks = splitMultilineUrls(form.videoLinks, 8);
    const external = parseExternalLinks(form.externalLinks, 8);

    if (!title || title.length < 6) {
      setSubmitError("Project title should be at least 6 characters.");
      return;
    }
    if (!summary || summary.length < 20) {
      setSubmitError("Add a short summary (minimum 20 characters).");
      return;
    }
    if (!description || description.length < 60) {
      setSubmitError("Describe your project in at least 60 characters.");
      return;
    }
    if (!subject) {
      setSubmitError("Subject is required.");
      return;
    }
    if (!grade) {
      setSubmitError("Grade is required.");
      return;
    }
    if (external.invalidLines.length > 0) {
      setSubmitError(
        `Some external links are invalid. Use URL or label|URL format. First invalid line: "${external.invalidLines[0]}"`,
      );
      return;
    }
    if (imageFiles.length === 0 && videoFiles.length === 0 && videoLinks.length === 0) {
      setSubmitError("Upload at least one image or provide at least one video.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSubmitStatus("Uploading media assets...");

    try {
      const prefixBase = `${STEAMH_PROJECTS_PATH_PREFIX}/${sanitizeSegment(userId)}/${Date.now()}`;
      const [imageUrls, uploadedVideoUrls, attachmentUrls] = await Promise.all([
        uploadBatch(imageFiles, `${prefixBase}/images`),
        uploadBatch(videoFiles, `${prefixBase}/videos`),
        uploadBatch(attachmentFiles, `${prefixBase}/attachments`),
      ]);

      setSubmitStatus("Saving project card...");

      const insertPayload = {
        student_id: userId,
        student_name: studentName,
        school_name: schoolName || null,
        grade,
        subject,
        title,
        summary,
        description,
        challenge: challenge || null,
        solution: solution || null,
        tools_used: toolsUsed,
        tags,
        image_urls: imageUrls,
        video_urls: [...uploadedVideoUrls, ...videoLinks],
        attachment_urls: attachmentUrls,
        external_links: external.links,
        published: true,
        collaboration_enabled: collaborationEnabled,
      };

      let insertedProject: { id: string } | null = null;
      let insertError: unknown = null;
      let collaborationPreferenceWarning: string | null = null;

      const firstInsert = await supabase.from("steamh_projects").insert(insertPayload).select("id").single();
      insertedProject = firstInsert.data as { id: string } | null;
      insertError = firstInsert.error;

      if (insertError && isMissingCollaborationEnabledColumnError(insertError)) {
        collaborationPreferenceWarning =
          "Saved project, but collaboration preference could not be stored. Apply `supabase/steamh_projects_patch.sql` in Supabase SQL Editor.";
        const fallbackInsert = await supabase
          .from("steamh_projects")
          .insert({
            student_id: insertPayload.student_id,
            student_name: insertPayload.student_name,
            school_name: insertPayload.school_name,
            grade: insertPayload.grade,
            subject: insertPayload.subject,
            title: insertPayload.title,
            summary: insertPayload.summary,
            description: insertPayload.description,
            challenge: insertPayload.challenge,
            solution: insertPayload.solution,
            tools_used: insertPayload.tools_used,
            tags: insertPayload.tags,
            image_urls: insertPayload.image_urls,
            video_urls: insertPayload.video_urls,
            attachment_urls: insertPayload.attachment_urls,
            external_links: insertPayload.external_links,
            published: true,
          })
          .select("id")
          .single();
        insertedProject = fallbackInsert.data as { id: string } | null;
        insertError = fallbackInsert.error;
      }

      if (insertError || !insertedProject?.id) {
        throw insertError ?? new Error("Unable to save project.");
      }

      let assignmentWarning: string | null = null;
      if (selectedAssignmentId) {
        if (!sessionToken) {
          assignmentWarning = "Project uploaded, but assignment submission failed because your session expired.";
        } else {
          const submitResponse = await fetch("/api/student/steamh-assignments", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${sessionToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              assignmentId: selectedAssignmentId,
              projectId: insertedProject.id,
            }),
          });
          const submitBody = await submitResponse.json().catch(() => ({}));
          if (!submitResponse.ok) {
            assignmentWarning = submitBody?.error ?? "Project uploaded, but assignment submission failed.";
          } else {
            const warning =
              typeof submitBody?.warning === "string" && submitBody.warning.trim().length > 0
                ? submitBody.warning
                : null;
            if (warning) assignmentWarning = warning;
            await loadAssignedTasks(sessionToken);
          }
        }
      }

      setForm((prev) => ({ ...initialForm, grade: prev.grade }));
      setImageFiles([]);
      setVideoFiles([]);
      setAttachmentFiles([]);
      setFileInputKey((prev) => prev + 1);
      setCollaborationEnabled(true);
      if (!assignmentWarning && selectedAssignmentId) {
        setSelectedAssignmentId("");
      }
      const warnings = [assignmentWarning, collaborationPreferenceWarning].filter(
        (item): item is string => Boolean(item && item.trim()),
      );
      setSubmitStatus(
        warnings.length > 0
          ? `Project uploaded with warning: ${warnings.join(" ")}`
          : selectedAssignmentId
            ? "Project uploaded and submitted to your teacher."
            : collaborationEnabled
              ? "Project uploaded and published to open gallery with collaboration enabled."
              : "Project uploaded and published to open gallery.",
      );
      await loadStudentProjects(userId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to upload project.";
      setSubmitError(message);
      setSubmitStatus(null);
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready) {
    return (
      <main className="section-padding">
        <div className="glass-panel rounded-2xl p-6">
          <p className="text-sm text-slate-400">Loading student access...</p>
        </div>
      </main>
    );
  }

  if (!canUpload) {
    return (
      <main className="section-padding space-y-6">
        <div className="glass-panel rounded-2xl p-6 space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-accent-strong">Student Area</p>
          <h1 className="text-2xl font-semibold text-white">STEAM-H project upload</h1>
          <p className="text-sm text-slate-300">
            This page is available for student accounts only. Sign in with a student profile to upload projects.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/login"
              className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-true-white shadow-glow"
            >
              Go to login
            </Link>
            <Link
              href="/steamh-projects"
              className="inline-flex items-center rounded-full border border-accent/30 bg-white/70 px-4 py-2 text-sm font-semibold text-accent-strong"
            >
              View public gallery
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="section-padding space-y-6">
      <section className="glass-panel rounded-3xl p-6 md:p-8 space-y-5">
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.22em] text-accent-strong">Student Publishing Studio</p>
              <h1 className="text-3xl font-semibold text-white md:text-[2rem]">Upload Your STEAM-H Project</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/customer"
                className="inline-flex items-center rounded-full border border-accent/30 bg-white/70 px-4 py-2 text-sm font-semibold text-accent-strong"
              >
                Back to dashboard
              </Link>
              <Link
                href="/steamh-projects"
                className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-true-white shadow-glow"
              >
                Open public gallery
              </Link>
            </div>
          </div>
          <p className="max-w-3xl text-sm leading-relaxed text-slate-300">
            Share your project with everyone without login barriers. Add media, explain your process, and publish your
            work directly to the open STEAM-H showcase.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className={`${subtleCardClass} px-4 py-3`}>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Pending tasks</p>
              <p className="mt-1 text-2xl font-semibold text-slate-800">{pendingAssignmentsCount}</p>
            </div>
            <div className={`${subtleCardClass} px-4 py-3`}>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Your uploads</p>
              <p className="mt-1 text-2xl font-semibold text-slate-800">{projects.length}</p>
            </div>
            <div className={`${subtleCardClass} px-4 py-3`}>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Media ready</p>
              <p className="mt-1 text-sm font-medium text-slate-700">{mediaCountLabel}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="glass-panel rounded-2xl p-5 md:p-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-accent-strong">Teacher Tasks</p>
            <h2 className="text-xl font-semibold text-white">Assigned STEAM-H Submissions</h2>
          </div>
          <span className="text-xs text-slate-400">{pendingAssignmentsCount} pending</span>
        </div>
        {assignmentStatus && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {assignmentStatus}
          </p>
        )}
        {assignments.length === 0 ? (
          <p className="text-sm text-slate-400">
            No teacher-assigned STEAM-H tasks right now. You can still upload to the public showcase.
          </p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {assignments.map((assignment) => {
              const isSubmitted = Boolean(assignment.submitted_at);
              const dueMs = Date.parse(assignment.due_at);
              const isOverdue = !isSubmitted && !Number.isNaN(dueMs) && dueMs < Date.now();
              return (
                <article key={assignment.id} className={`${subtleCardClass} px-3 py-2.5 space-y-1.5`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">{assignment.title}</p>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        isSubmitted
                          ? "bg-emerald-100 text-emerald-700"
                          : isOverdue
                            ? "bg-rose-100 text-rose-700"
                            : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {isSubmitted ? "Submitted" : isOverdue ? "Overdue" : "Pending"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Teacher: {assignment.teacher_name} | Due: {formatDueAt(assignment.due_at)}
                  </p>
                  {assignment.instructions ? <p className="text-xs text-slate-600">{assignment.instructions}</p> : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-6">
        <div className="glass-panel rounded-2xl p-5 md:p-6 space-y-6">
          <div className={`${subtleCardClass} p-4 space-y-3`}>
            <p className="text-xs uppercase tracking-[0.18em] text-accent-strong">Assignment Link</p>
            <label className={`${fieldLabelClass} block`}>
              Submit for teacher assignment (optional)
              <select
                value={selectedAssignmentId}
                onChange={(event) => setSelectedAssignmentId(event.target.value)}
                className={fieldInputClass}
              >
                <option value="">No assignment (publish only)</option>
                {assignments
                  .filter((assignment) => !assignment.submitted_at)
                  .map((assignment) => (
                    <option key={assignment.id} value={assignment.id}>
                      {assignment.title} | Due {formatDueAt(assignment.due_at)}
                    </option>
                  ))}
              </select>
            </label>
            {selectedAssignment ? (
              <p className="text-xs text-slate-300">
                Selected task from {selectedAssignment.teacher_name}. After upload, this will be submitted directly to
                your teacher.
              </p>
            ) : (
              <p className="text-xs text-slate-400">Choose an assignment to mark this upload as teacher submission.</p>
            )}
          </div>

          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.18em] text-accent-strong">Project Basics</p>
            <div className="grid gap-4 md:grid-cols-2">
              <label className={fieldLabelClass}>
                Project title*
                <input
                  value={form.title}
                  onChange={(event) => onFormChange("title", event.target.value)}
                  maxLength={120}
                  className={fieldInputClass}
                  placeholder="Example: Solar-Powered Smart Irrigation"
                />
              </label>
              <label className={fieldLabelClass}>
                Subject*
                <input
                  value={form.subject}
                  onChange={(event) => onFormChange("subject", event.target.value)}
                  maxLength={80}
                  className={fieldInputClass}
                  placeholder="Physics, Biology, Design Technology..."
                />
              </label>
              <label className={fieldLabelClass}>
                Grade*
                <input
                  value={form.grade}
                  onChange={(event) => onFormChange("grade", event.target.value)}
                  maxLength={40}
                  className={fieldInputClass}
                  placeholder="8"
                />
              </label>
              <label className={fieldLabelClass}>
                School (optional)
                <input
                  value={form.schoolName}
                  onChange={(event) => onFormChange("schoolName", event.target.value)}
                  maxLength={120}
                  className={fieldInputClass}
                  placeholder="Your school or club"
                />
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.18em] text-accent-strong">Story & Reflection</p>
            <label className={fieldLabelClass}>
              Short summary* (shown on home page cards)
              <textarea
                value={form.summary}
                onChange={(event) => onFormChange("summary", event.target.value)}
                maxLength={260}
                className={`${fieldInputClass} h-24 resize-none`}
                placeholder="What did you build and why is it useful?"
              />
            </label>
            <label className={fieldLabelClass}>
              Full project story* (problem, process, testing, outcomes)
              <textarea
                value={form.description}
                onChange={(event) => onFormChange("description", event.target.value)}
                maxLength={5000}
                className={`${fieldInputClass} h-44 resize-y`}
                placeholder="Explain how you approached the project from start to finish..."
              />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className={fieldLabelClass}>
                Challenge faced (optional)
                <textarea
                  value={form.challenge}
                  onChange={(event) => onFormChange("challenge", event.target.value)}
                  maxLength={1200}
                  className={`${fieldInputClass} h-24 resize-none`}
                  placeholder="What was difficult?"
                />
              </label>
              <label className={fieldLabelClass}>
                How you solved it (optional)
                <textarea
                  value={form.solution}
                  onChange={(event) => onFormChange("solution", event.target.value)}
                  maxLength={1200}
                  className={`${fieldInputClass} h-24 resize-none`}
                  placeholder="What changes worked?"
                />
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.18em] text-accent-strong">Discovery & Media</p>
            <div className="grid gap-4 md:grid-cols-2">
              <label className={fieldLabelClass}>
                Tags (comma separated)
                <input
                  value={form.tags}
                  onChange={(event) => onFormChange("tags", event.target.value)}
                  className={fieldInputClass}
                  placeholder="iot, sustainability, sensors"
                />
              </label>
              <label className={fieldLabelClass}>
                Tools used (comma separated)
                <input
                  value={form.toolsUsed}
                  onChange={(event) => onFormChange("toolsUsed", event.target.value)}
                  className={fieldInputClass}
                  placeholder="Arduino, Python, Fusion360"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className={fieldLabelClass}>
                Video URLs (one per line)
                <textarea
                  value={form.videoLinks}
                  onChange={(event) => onFormChange("videoLinks", event.target.value)}
                  className={`${fieldInputClass} h-24 resize-none`}
                  placeholder={"https://youtube.com/...\nhttps://drive.google.com/..."}
                />
              </label>
              <label className={fieldLabelClass}>
                External links (URL or label|URL)
                <textarea
                  value={form.externalLinks}
                  onChange={(event) => onFormChange("externalLinks", event.target.value)}
                  className={`${fieldInputClass} h-24 resize-none`}
                  placeholder={"GitHub|https://github.com/...\nhttps://example.com/demo"}
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className={fieldLabelClass}>
                Images* (max {MAX_STEAMH_IMAGES}, {formatBytes(MAX_STEAMH_IMAGE_SIZE_BYTES)} each)
                <input
                  key={`project-images-${fileInputKey}`}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(event) => onImageChange(event.target.files)}
                  className={`file-accent ${fieldInputClass}`}
                />
              </label>
              <label className={fieldLabelClass}>
                Video files (max {MAX_STEAMH_VIDEOS}, {formatBytes(MAX_STEAMH_VIDEO_SIZE_BYTES)} each)
                <input
                  key={`project-videos-${fileInputKey}`}
                  type="file"
                  multiple
                  accept="video/*"
                  onChange={(event) => onVideoChange(event.target.files)}
                  className={`file-accent ${fieldInputClass}`}
                />
              </label>
              <label className={fieldLabelClass}>
                Attachments (optional)
                <input
                  key={`project-attachments-${fileInputKey}`}
                  type="file"
                  multiple
                  accept=".pdf,.ppt,.pptx,.doc,.docx,.zip"
                  onChange={(event) => onAttachmentChange(event.target.files)}
                  className={`file-accent ${fieldInputClass}`}
                />
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-accent/20 bg-white/70 px-3 py-2 text-xs text-slate-600">
            Media ready: {mediaCountLabel}
          </div>

          {submitError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {submitError}
            </div>
          )}
          {submitStatus && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {submitStatus}
            </div>
          )}

          <div className={`${subtleCardClass} flex flex-wrap items-center justify-between gap-3 p-4`}>
            <div className="space-y-2">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={collaborationEnabled}
                  onChange={(event) => {
                    setSubmitError(null);
                    setSubmitStatus(null);
                    setCollaborationEnabled(event.target.checked);
                  }}
                  disabled={submitting}
                  className="h-4 w-4 rounded border-accent/40 text-accent focus:ring-accent"
                />
                Allow collaboration requests for this project
              </label>
              <p className="text-xs text-slate-500">
                {selectedAssignment
                  ? "This upload will be linked to your selected teacher assignment and marked as submitted."
                  : "Project will always publish to the open showcase. Collaboration appears only when this checkbox is enabled."}
              </p>
            </div>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleSubmit()}
              className="inline-flex min-w-[170px] items-center justify-center rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-true-white shadow-glow disabled:opacity-60"
            >
              {submitting ? "Uploading..." : "Publish Project"}
            </button>
          </div>
        </div>

      </section>
    </main>
  );
}
