"use client";

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { use, useEffect, useMemo, useState } from "react";
import CollaborateButton from "@/components/CollaborateButton";
import { enrichSteamhProjectWithSampleDetails, sampleSteamhProjects } from "@/data/sampleSteamhProjects";
import { buildProjectCollabPath } from "@/lib/steamhCollaboration";
import { fetchSteamhProjectById } from "@/lib/steamhProjects";
import {
  resolveShowcaseProjectMeta,
  toFocusTerms,
  toNarrativeParagraphs,
  toShowcaseChallenge,
  toShowcaseDetails,
  toShowcaseSolution,
  truncateText,
} from "@/lib/steamhShowcase";
import type { SteamhProject } from "@/types";

const formatDate = (isoDate: string) =>
  new Date(isoDate).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const resolveRouteId = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const findSampleProjectById = (id: string) => sampleSteamhProjects.find((project) => project.id === id) ?? null;

const resolveProjectCover = (project: SteamhProject) => project.imageUrls[0] ?? "";

export default function SteamhProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const projectId = useMemo(() => resolveRouteId(id), [id]);
  const [project, setProject] = useState<SteamhProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadProject = async () => {
      const sampleProject = findSampleProjectById(projectId);
      try {
        setLoading(true);
        const liveProject = await fetchSteamhProjectById(projectId);
        if (cancelled) return;

        if (liveProject) {
          setProject(enrichSteamhProjectWithSampleDetails(liveProject));
          setError(null);
        } else if (sampleProject) {
          setProject(sampleProject);
          setError(null);
        } else {
          setProject(null);
          setError(null);
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Unable to load project details.";
        if (sampleProject) {
          setProject(sampleProject);
          setError("Live project data is unavailable right now. Showing sample project details.");
        } else {
          setProject(null);
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadProject();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (loading) {
    return (
      <main className="section-padding space-y-6">
        <div className="glass-panel rounded-3xl p-6 md:p-8 animate-pulse border border-accent/10 bg-white/60 h-80" />
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="glass-panel rounded-3xl p-6 animate-pulse border border-accent/10 bg-white/60 h-64" />
          <div className="glass-panel rounded-3xl p-6 animate-pulse border border-accent/10 bg-white/60 h-64" />
        </div>
      </main>
    );
  }

  if (!project && !error) {
    notFound();
    return null;
  }

  if (!project) {
    return (
      <main className="section-padding space-y-6">
        <section className="glass-panel rounded-3xl p-6 md:p-8 space-y-3">
          <h1 className="text-2xl font-semibold text-white">Project unavailable</h1>
          <p className="text-sm text-rose-300">{error ?? "Unable to find this project."}</p>
          <Link
            href="/steamh-projects"
            className="inline-flex items-center rounded-full border border-accent/30 bg-white/70 px-4 py-2 text-sm font-semibold text-accent-strong hover:border-accent-strong"
          >
            Back to all projects
          </Link>
        </section>
      </main>
    );
  }

  const coverUrl = resolveProjectCover(project);
  const galleryImages = project.imageUrls.slice(1, 7);
  const showcaseDetails = toShowcaseDetails(project.description, project.summary);
  const showcaseChallenge = toShowcaseChallenge(project);
  const showcaseSolution = toShowcaseSolution(project);
  const detailParagraphs = toNarrativeParagraphs(showcaseDetails, 3);
  const focusTerms = toFocusTerms(project, 8);
  const projectMeta = resolveShowcaseProjectMeta(project);
  const initials = projectMeta.initials;

  return (
    <main className="section-padding space-y-7">
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
          <span className="text-white font-semibold truncate">{project.title}</span>
        </nav>
        <Link
          href="/"
          className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-true-white shadow-glow hover:opacity-90"
        >
          Back to Home
        </Link>
      </div>

      {error && (
        <p className="rounded-lg border border-amber-300/60 bg-amber-50/80 px-3 py-2 text-xs font-medium text-amber-800">
          {error}
        </p>
      )}

      <section className="glass-panel relative overflow-hidden rounded-3xl border border-accent/15">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
        <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
          <div className="relative min-h-[300px] md:min-h-[420px] bg-gradient-to-br from-emerald-100 via-teal-100 to-cyan-100">
            {coverUrl ? (
              <Image
                src={coverUrl}
                alt={`${project.title} cover`}
                fill
                sizes="(max-width: 1024px) 100vw, 60vw"
                className="object-contain p-3 md:p-4"
                unoptimized
              />
            ) : (
              <div className="h-full w-full grid place-items-center text-7xl font-semibold text-accent-strong/60">
                {project.title.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="absolute left-4 bottom-4 flex flex-wrap gap-2">
              {project.subject && (
                <span className="rounded-full border border-white/65 bg-white/90 px-3 py-1 text-xs font-semibold text-accent-strong">
                  {project.subject}
                </span>
              )}
              {projectMeta.grade && (
                <span className="rounded-full border border-white/65 bg-white/90 px-3 py-1 text-xs font-semibold text-accent-strong">
                  Grade {projectMeta.grade}
                </span>
              )}
              <span className="rounded-full border border-white/65 bg-white/90 px-3 py-1 text-xs font-semibold text-accent-strong">
                {formatDate(projectMeta.publishedAt)}
              </span>
            </div>
          </div>

          <div className="p-6 md:p-8 space-y-5">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-strong">Exhibition Entry</p>
            <h1 className="text-3xl md:text-4xl font-semibold text-white">{project.title}</h1>
            <p className="text-base leading-relaxed text-slate-200">{project.summary}</p>

            <div className="rounded-2xl border border-accent/20 bg-white/75 p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-full border border-accent/25 bg-white text-sm font-semibold text-accent-strong">
                  {initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{projectMeta.studentName}</p>
                  <p className="text-xs text-slate-600">{projectMeta.schoolName}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-accent/15 bg-white px-2.5 py-2 text-slate-700">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Grade</p>
                  <p className="mt-1 font-semibold">{projectMeta.grade ? `Grade ${projectMeta.grade}` : "Not specified"}</p>
                </div>
                <div className="rounded-lg border border-accent/15 bg-white px-2.5 py-2 text-slate-700">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Published</p>
                  <p className="mt-1 font-semibold">{formatDate(projectMeta.publishedAt)}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/steamh-projects"
                className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-true-white shadow-glow hover:opacity-90"
              >
                Back to Showcase
              </Link>
              <a
                href="#project-insight"
                className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-true-white shadow-glow hover:opacity-90"
              >
                Jump to Insights
              </a>
              <CollaborateButton
                href={buildProjectCollabPath(project.id)}
                label="Collaborate with Publisher"
              />
            </div>
          </div>
        </div>
      </section>

      {galleryImages.length > 0 && (
        <section className="glass-panel rounded-3xl p-5 md:p-6 space-y-3 border border-accent/15">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-white">Project Gallery</h2>
            <p className="text-xs text-slate-500">
              {galleryImages.length} supporting {galleryImages.length === 1 ? "image" : "images"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {galleryImages.map((url, index) => (
              <div
                key={`${project.id}-gallery-${index}`}
                className="relative h-40 md:h-52 rounded-xl overflow-hidden border border-accent/10 bg-slate-900/30"
              >
                <Image
                  src={url}
                  alt={`${project.title} image ${index + 2}`}
                  fill
                  sizes="(max-width: 768px) 50vw, 33vw"
                  className="object-contain p-2"
                  unoptimized
                />
              </div>
            ))}
          </div>
        </section>
      )}

      <section id="project-insight" className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <div className="space-y-6">
          <article className="glass-panel rounded-3xl p-6 md:p-8 space-y-4 border border-accent/15">
            <h2 className="text-2xl font-semibold text-white">Project Story</h2>
            <div className="space-y-3 text-sm md:text-base leading-relaxed text-slate-200">
              {(detailParagraphs.length > 0 ? detailParagraphs : [showcaseDetails]).map((paragraph, index) => (
                <p key={`${project.id}-story-${index}`}>{paragraph}</p>
              ))}
            </div>
          </article>

          <article className="glass-panel rounded-3xl p-6 md:p-8 space-y-2 border border-accent/15">
            <h2 className="text-xl font-semibold text-white">Challenge The Student Faced</h2>
            <p className="text-sm md:text-base leading-relaxed text-slate-200">{showcaseChallenge}</p>
          </article>

          <article className="glass-panel rounded-3xl p-6 md:p-8 space-y-2 border border-accent/15">
            <h2 className="text-xl font-semibold text-white">What This Project Solves</h2>
            <p className="text-sm md:text-base leading-relaxed text-slate-200">{showcaseSolution}</p>
          </article>
        </div>

        <aside className="space-y-6">
          <section
            className="rounded-3xl p-5 md:p-6 space-y-3 border shadow-glow"
            style={{
              background: "var(--accent)",
              borderColor: "color-mix(in srgb, #ffffff 22%, var(--accent))",
            }}
          >
            <h2 className="text-lg font-semibold text-true-white">
              Student Details
            </h2>
            <dl className="space-y-2 text-sm font-semibold">
              <div className="flex items-start justify-between gap-3 border-b pb-2" style={{ borderColor: "rgba(255, 255, 255, 0.24)" }}>
                <dt style={{ color: "rgba(255, 255, 255, 0.78)" }}>Student</dt>
                <dd className="text-right font-semibold text-true-white">
                  {projectMeta.studentName}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3 border-b pb-2" style={{ borderColor: "rgba(255, 255, 255, 0.24)" }}>
                <dt style={{ color: "rgba(255, 255, 255, 0.78)" }}>Grade</dt>
                <dd className="text-right font-semibold text-true-white">
                  {projectMeta.grade ? `Grade ${projectMeta.grade}` : "Not specified"}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3 border-b pb-2" style={{ borderColor: "rgba(255, 255, 255, 0.24)" }}>
                <dt style={{ color: "rgba(255, 255, 255, 0.78)" }}>Subject</dt>
                <dd className="text-right font-semibold text-true-white">
                  {project.subject || "Not specified"}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt style={{ color: "rgba(255, 255, 255, 0.78)" }}>Published</dt>
                <dd className="text-right font-semibold text-true-white">
                  {formatDate(projectMeta.publishedAt)}
                </dd>
              </div>
            </dl>
          </section>

          {focusTerms.length > 0 && (
            <section className="glass-panel rounded-3xl p-5 md:p-6 space-y-3 border border-accent/15">
              <h2 className="text-lg font-semibold text-white">Focus Areas</h2>
              <div className="flex flex-wrap gap-2">
                {focusTerms.map((tag) => (
                  <span
                    key={`${project.id}-tag-${tag}`}
                    className="rounded-md border border-accent/15 bg-white/80 px-2 py-1 text-[11px] font-medium text-slate-700"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </section>
          )}

          {project.toolsUsed.length > 0 && (
            <section className="glass-panel rounded-3xl p-5 md:p-6 space-y-3 border border-accent/15">
              <h2 className="text-lg font-semibold text-white">Methods and Components</h2>
              <div className="flex flex-wrap gap-2">
                {project.toolsUsed.slice(0, 10).map((tool) => (
                  <span
                    key={`${project.id}-tool-${tool}`}
                    className="rounded-md border border-accent/15 bg-white/80 px-2 py-1 text-[11px] font-medium text-slate-700"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="glass-panel rounded-3xl p-5 md:p-6 space-y-3 border border-accent/15">
            <h2 className="text-lg font-semibold text-white">Exhibition Notes</h2>
            <p className="text-sm leading-relaxed text-slate-300">
              This entry is displayed as a student showcase panel. The focus is on intent, challenge, and outcome
              rather than step-by-step build instructions.
            </p>
            <p className="text-xs text-slate-500">Reference ID: {truncateText(project.id, 18)}</p>
          </section>
        </aside>
      </section>
    </main>
  );
}
