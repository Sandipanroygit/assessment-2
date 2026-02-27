"use client";

import Image from "next/image";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { use, useEffect, useMemo, useState } from "react";
import { enrichSteamhProjectWithSampleDetails, sampleSteamhProjects } from "@/data/sampleSteamhProjects";
import { buildCollabLoginPath, buildProjectCollabPath, COLLAB_PUBLISHER } from "@/lib/steamhCollaboration";
import { fetchSteamhProjectById } from "@/lib/steamhProjects";
import { resolveShowcaseProjectMeta, toShowcaseChallenge, toShowcaseDetails, toShowcaseSolution, truncateText } from "@/lib/steamhShowcase";
import { supabase } from "@/lib/supabaseClient";
import type { SteamhProject } from "@/types";

type ViewerContext = {
  name: string;
  role: string;
  grade: string;
  email: string;
};

const resolveRouteId = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const findSampleProjectById = (id: string) => sampleSteamhProjects.find((project) => project.id === id) ?? null;
const resolveProjectCover = (project: SteamhProject) => project.imageUrls[0] ?? "";

const normalizeRole = (value: unknown) => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return normalized || "member";
};

export default function SteamhProjectCollaborationPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const projectId = useMemo(() => resolveRouteId(id), [id]);
  const collabPath = useMemo(() => buildProjectCollabPath(projectId), [projectId]);

  const [project, setProject] = useState<SteamhProject | null>(null);
  const [viewer, setViewer] = useState<ViewerContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirectingToLogin, setRedirectingToLogin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadContext = async () => {
      let redirected = false;
      try {
        setLoading(true);
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;
        if (!user) {
          redirected = true;
          setRedirectingToLogin(true);
          router.replace(buildCollabLoginPath(collabPath));
          return;
        }

        const profileResult = await supabase
          .from("profiles")
          .select("full_name, role, grade")
          .eq("id", user.id)
          .maybeSingle();

        let liveProject: SteamhProject | null = null;
        try {
          liveProject = await fetchSteamhProjectById(projectId);
        } catch {
          liveProject = null;
        }

        if (cancelled) return;

        const sampleProject = findSampleProjectById(projectId);
        const selectedProject = liveProject
          ? enrichSteamhProjectWithSampleDetails(liveProject)
          : sampleProject;

        if (!selectedProject) {
          setProject(null);
          setViewer(null);
          setError(null);
          return;
        }

        const viewerName =
          (typeof profileResult.data?.full_name === "string" && profileResult.data.full_name.trim()) ||
          (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()) ||
          user.email ||
          "Collaborator";
        const viewerRole =
          normalizeRole(profileResult.data?.role) ||
          normalizeRole(user.user_metadata?.role);
        const viewerGrade =
          (typeof profileResult.data?.grade === "string" && profileResult.data.grade.trim()) ||
          (typeof user.user_metadata?.grade === "string" && user.user_metadata.grade.trim()) ||
          "";
        const viewerEmail = user.email ?? "";

        const projectShortName = truncateText(selectedProject.title, 80);
        const selectedProjectMeta = resolveShowcaseProjectMeta(selectedProject);
        const selectedPublisherName = selectedProjectMeta.studentName.trim() || COLLAB_PUBLISHER.name;
        const seedMessage = `Hi ${selectedPublisherName}, I would like to collaborate on "${projectShortName}". I can contribute to research, testing, and presentation.`;

        setProject(selectedProject);
        setViewer({
          name: viewerName,
          role: viewerRole,
          grade: viewerGrade,
          email: viewerEmail,
        });
        setMessage(seedMessage);
        setStatus(null);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        const sampleProject = findSampleProjectById(projectId);
        if (sampleProject) {
          setProject(sampleProject);
          setError(null);
        } else {
          const message = err instanceof Error ? err.message : "Unable to load collaboration workspace.";
          setError(message);
        }
      } finally {
        if (!cancelled && !redirected) {
          setLoading(false);
        }
      }
    };

    void loadContext();
    return () => {
      cancelled = true;
    };
  }, [collabPath, projectId, router]);

  const handleSubmit = async () => {
    if (!project || !viewer) return;
    const activeProjectMeta = resolveShowcaseProjectMeta(project);
    const activePublisherName = activeProjectMeta.studentName.trim() || COLLAB_PUBLISHER.name;
    const activePublisherGrade = activeProjectMeta.grade.trim() || COLLAB_PUBLISHER.grade;
    const trimmed = message.trim();
    if (!trimmed) {
      setStatus("Write a short collaboration message before sending.");
      return;
    }
    if (trimmed.length > 1600) {
      setStatus("Keep your message within 1600 characters.");
      return;
    }

    setSubmitting(true);
    setStatus(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        router.replace(buildCollabLoginPath(collabPath));
        return;
      }

      const response = await fetch("/api/steamh-collaboration", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId: project.id,
          projectTitle: project.title,
          publisherName: activePublisherName,
          publisherGrade: activePublisherGrade,
          message: trimmed,
        }),
      });

      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setStatus(body.error ?? "Unable to send collaboration request.");
        return;
      }

      setStatus(`Collaboration request sent to ${activePublisherName}.`);
      setMessage("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Unable to send collaboration request.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="section-padding space-y-6">
        <div className="glass-panel rounded-3xl p-6 md:p-8 animate-pulse border border-accent/10 bg-white/60 h-72" />
        <div className="glass-panel rounded-3xl p-6 md:p-8 animate-pulse border border-accent/10 bg-white/60 h-72" />
      </main>
    );
  }

  if (redirectingToLogin) {
    return null;
  }

  if (!project && !error) {
    notFound();
    return null;
  }

  if (!project) {
    return (
      <main className="section-padding">
        <section className="glass-panel rounded-3xl p-6 md:p-8 space-y-3 border border-accent/15">
          <h1 className="text-2xl font-semibold text-white">Collaboration workspace unavailable</h1>
          <p className="text-sm text-rose-600">{error ?? "Unable to open this collaboration workspace."}</p>
          <Link
            href="/steamh-projects"
            className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-true-white shadow-glow hover:opacity-90"
          >
            Back to Showcase
          </Link>
        </section>
      </main>
    );
  }

  const coverUrl = resolveProjectCover(project);
  const showcaseDetails = toShowcaseDetails(project.description, project.summary);
  const showcaseChallenge = toShowcaseChallenge(project);
  const showcaseSolution = toShowcaseSolution(project);
  const projectMeta = resolveShowcaseProjectMeta(project);
  const publisherName = projectMeta.studentName.trim() || COLLAB_PUBLISHER.name;
  const publisherGrade = projectMeta.grade.trim() || COLLAB_PUBLISHER.grade;

  return (
    <main className="section-padding space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="text-sm text-slate-400 flex items-center gap-2">
          <Link href="/" className="hover:text-white">
            Home
          </Link>
          <span>{">"}</span>
          <Link href="/steamh-projects" className="hover:text-white">
            STEAM-H Projects
          </Link>
          <span>{">"}</span>
          <Link href={`/steamh-projects/${encodeURIComponent(project.id)}`} className="hover:text-white">
            {truncateText(project.title, 42)}
          </Link>
          <span>{">"}</span>
          <span className="text-white font-semibold">Collaborate</span>
        </nav>
        <Link
          href={`/steamh-projects/${encodeURIComponent(project.id)}`}
          className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-true-white shadow-glow hover:opacity-90"
        >
          Back to Project
        </Link>
      </div>

      <section className="glass-panel rounded-3xl overflow-hidden border border-accent/15">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative min-h-[260px] bg-gradient-to-br from-emerald-100 via-teal-100 to-cyan-100">
            {coverUrl ? (
              <Image
                src={coverUrl}
                alt={`${project.title} cover`}
                fill
                sizes="(max-width: 1024px) 100vw, 55vw"
                className="object-contain p-3 md:p-4"
                unoptimized
              />
            ) : (
              <div className="h-full w-full grid place-items-center text-7xl font-semibold text-accent-strong/60">
                {project.title.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="p-6 md:p-8 space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-strong">Collaboration Workspace</p>
            <h1 className="text-3xl font-semibold text-white">{project.title}</h1>
            <p className="text-sm leading-relaxed text-slate-200">{project.summary}</p>
            <div className="rounded-2xl border border-accent/20 bg-white/75 p-4 text-sm">
              <p className="text-slate-700">
                Author: <span className="font-semibold text-slate-900">{publisherName}</span>
                {publisherGrade ? ` (Grade ${publisherGrade})` : ""}
              </p>
              <p className="mt-1 text-slate-700">
                You are sending this as <span className="font-semibold text-slate-900">{viewer?.name ?? "Collaborator"}</span>
                {viewer?.grade ? ` (${viewer.grade})` : ""}.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="glass-panel rounded-3xl p-6 md:p-8 space-y-4 border border-accent/15">
          <h2 className="text-2xl font-semibold text-white">Project Detail</h2>
          <p className="text-sm leading-relaxed text-slate-200">{showcaseDetails}</p>
          <div className="rounded-xl border border-accent/15 bg-white/75 p-3 text-sm">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Challenge</p>
            <p className="mt-1 text-slate-700">{showcaseChallenge}</p>
          </div>
          <div className="rounded-xl border border-accent/15 bg-white/75 p-3 text-sm">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">What It Solves</p>
            <p className="mt-1 text-slate-700">{showcaseSolution}</p>
          </div>
        </article>

        <aside className="glass-panel rounded-3xl p-6 md:p-8 space-y-4 border border-accent/15">
          <h2 className="text-2xl font-semibold text-white">Message the Author</h2>
          <p className="text-sm text-slate-300">
            Share why you want to collaborate and what you can contribute. Your request will be sent to {publisherName}.
          </p>

          <label className="block space-y-2 text-sm text-slate-300">
            Collaboration message
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={8}
              maxLength={1600}
              placeholder={`Hi ${publisherName}, I want to collaborate on this project...`}
              className="w-full rounded-xl border border-accent/25 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent-strong"
            />
          </label>
          <p className="text-xs text-slate-500">{message.trim().length}/1600</p>

          {status && (
            <div
              className={
                status.toLowerCase().includes("sent")
                  ? "rounded-xl border border-emerald-300/70 bg-emerald-50/90 px-3 py-2 text-sm font-medium text-emerald-700"
                  : "rounded-xl border border-rose-300/70 bg-rose-50/90 px-3 py-2 text-sm font-medium text-rose-700"
              }
            >
              {status}
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-true-white shadow-glow hover:opacity-90 disabled:opacity-70"
          >
            {submitting ? "Sending..." : "Send Collaboration Request"}
          </button>
        </aside>
      </section>
    </main>
  );
}
