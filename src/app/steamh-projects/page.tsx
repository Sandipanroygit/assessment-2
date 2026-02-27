"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import CollaborateButton from "@/components/CollaborateButton";
import { enrichSteamhProjectWithSampleDetails, sampleSteamhProjects } from "@/data/sampleSteamhProjects";
import {
  toGradeSortValue,
  toShowcaseDetails,
  truncateText,
} from "@/lib/steamhShowcase";
import { buildProjectCollabPath } from "@/lib/steamhCollaboration";
import { fetchSteamhProjects } from "@/lib/steamhProjects";
import { supabase } from "@/lib/supabaseClient";
import type { SteamhProject } from "@/types";

type SortMode = "latest" | "title" | "grade";

const resolveProjectCover = (project: SteamhProject) => {
  return project.imageUrls[0] ?? "";
};

const normalizeRole = (value: unknown) => {
  const role = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (role === "student" || role === "customer") return "student";
  if (role === "teacher" || role === "admin") return role;
  return "";
};

const moveStrawFingerToEnd = (items: SteamhProject[]) => {
  const regularProjects: SteamhProject[] = [];
  const strawFingerProjects: SteamhProject[] = [];

  for (const project of items) {
    if (project.title.trim().toLowerCase() === "straw finger") {
      strawFingerProjects.push(project);
    } else {
      regularProjects.push(project);
    }
  }

  return [...regularProjects, ...strawFingerProjects];
};

export default function SteamhProjectsPage() {
  const [projects, setProjects] = useState<SteamhProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("latest");
  const [canUpload, setCanUpload] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadProjects = async () => {
      try {
        setLoading(true);
        const rows = await fetchSteamhProjects({ limit: 150 });
        if (cancelled) return;
        if (rows.length === 0) {
          setProjects(sampleSteamhProjects);
          setInfoMessage(
            sampleSteamhProjects.length > 0
              ? "No published student projects yet. Showing sample projects with all showcase features."
              : null,
          );
        } else {
          setProjects(rows.map(enrichSteamhProjectWithSampleDetails));
          setInfoMessage(null);
        }
        setError(null);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Unable to load projects.";
        setProjects(sampleSteamhProjects);
        if (sampleSteamhProjects.length > 0) {
          setInfoMessage("Live project data is unavailable right now. Showing sample projects.");
          setError(null);
        } else {
          setInfoMessage(null);
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadProjects();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const checkRole = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data.user;
        if (!user || !mounted) {
          if (mounted) setCanUpload(false);
          return;
        }
        const metadataRole = normalizeRole(user.user_metadata?.role);
        if (metadataRole === "student") {
          if (mounted) setCanUpload(true);
          return;
        }
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        if (!mounted) return;
        setCanUpload(normalizeRole(profile?.role) === "student");
      } catch {
        if (mounted) setCanUpload(false);
      }
    };
    checkRole();
    return () => {
      mounted = false;
    };
  }, []);

  const availableTags = useMemo(
    () => ["all", ...Array.from(new Set(projects.flatMap((project) => project.tags))).slice(0, 30)],
    [projects],
  );

  const filteredProjects = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return projects.filter((project) => {
      const matchesTag = selectedTag === "all" || project.tags.includes(selectedTag);
      if (!matchesTag) return false;
      if (!normalizedSearch) return true;
      const haystack = [
        project.title,
        project.summary,
        project.description,
        project.studentName,
        project.subject,
        project.grade,
        project.tags.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [projects, search, selectedTag]);

  const showcasedProjects = useMemo(() => {
    const list = [...filteredProjects];

    if (sortMode === "title") {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortMode === "grade") {
      list.sort((a, b) => {
        const gradeSortDelta = toGradeSortValue(a.grade) - toGradeSortValue(b.grade);
        if (gradeSortDelta !== 0) return gradeSortDelta;
        return a.title.localeCompare(b.title);
      });
    } else {
      list.sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
        return bTime - aTime;
      });
    }

    return moveStrawFingerToEnd(list);
  }, [filteredProjects, sortMode]);

  return (
    <main className="section-padding space-y-8">
      <section className="glass-panel relative overflow-hidden rounded-3xl p-6 md:p-8 space-y-6 border border-accent/15">
        <div className="pointer-events-none absolute -top-16 -right-12 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />

        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-accent-strong">Open Access Gallery</p>
            <h1 className="text-3xl md:text-4xl font-semibold text-white">Student STEAM-H Projects</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/"
              className="inline-flex items-center rounded-full border border-accent/30 bg-white/70 px-4 py-2 text-sm font-semibold text-accent-strong hover:border-accent-strong"
            >
              Back to Home
            </Link>
            <Link
              href={canUpload ? "/student/steamh-projects" : "/login"}
              className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-true-white shadow-glow hover:opacity-90"
            >
              {canUpload ? "Upload my project" : "Student login to upload"}
            </Link>
          </div>
        </div>
      </section>

      <section className="glass-panel rounded-3xl p-5 space-y-4 border border-accent/15">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title, student, subject, or keyword..."
            className="w-full rounded-xl border border-accent/25 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-accent-strong"
          />
          <select
            value={selectedTag}
            onChange={(event) => setSelectedTag(event.target.value)}
            className="rounded-xl border border-accent/25 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-accent-strong"
          >
            {availableTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag === "all" ? "All tags" : tag}
              </option>
            ))}
          </select>
          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
            className="rounded-xl border border-accent/25 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-accent-strong"
          >
            <option value="latest">Newest first</option>
            <option value="title">Title A-Z</option>
            <option value="grade">Grade order</option>
          </select>
        </div>
        <p className="text-xs text-slate-500">
          Showing {showcasedProjects.length} projects - Sorted by{" "}
          {sortMode === "latest" ? "newest" : sortMode === "title" ? "title" : "grade"}
        </p>
        {infoMessage && (
          <p className="rounded-lg border border-amber-300/60 bg-amber-50/80 px-3 py-2 text-xs font-medium text-amber-800">
            {infoMessage}
          </p>
        )}
      </section>

      {loading ? (
        <section className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="glass-panel rounded-3xl p-4 animate-pulse border border-accent/10 bg-white/60 h-[30rem]"
            />
          ))}
        </section>
      ) : error ? (
        <section className="glass-panel rounded-2xl p-6">
          <p className="text-sm text-rose-700">{error}</p>
          <p className="mt-2 text-xs text-slate-500">
            If this is a new setup, apply `supabase/steamh_projects_patch.sql` in Supabase SQL Editor.
          </p>
        </section>
      ) : filteredProjects.length === 0 ? (
        <section className="glass-panel rounded-2xl p-7 text-center">
          <h2 className="text-xl font-semibold text-white">No projects matched your filters</h2>
          <p className="mt-2 text-sm text-slate-300">Try a different keyword or remove the tag filter.</p>
        </section>
      ) : (
        <>
          <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {showcasedProjects.map((project) => {
            const coverUrl = resolveProjectCover(project);
            const showcaseDetail = truncateText(toShowcaseDetails(project.description, project.summary), 180);

            return (
            <article
              key={project.id}
              id={project.id}
              className="glass-panel h-full rounded-2xl border border-accent/15 bg-white/70 overflow-hidden"
            >
              <div className="grid h-full min-h-[248px] grid-cols-[40%_60%]">
                <div className="relative h-full border-r border-accent/15 bg-gradient-to-br from-emerald-100 via-cyan-100 to-blue-100">
                  {coverUrl ? (
                    <Image
                      src={coverUrl}
                      alt={`${project.title} preview`}
                      fill
                      sizes="(max-width: 768px) 40vw, 38vw"
                      className="object-cover object-left-top"
                      unoptimized
                    />
                  ) : (
                    <div className="h-full w-full grid place-items-center text-4xl font-semibold text-accent-strong/60">
                      {project.title.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="p-5 space-y-3 flex flex-col">
                  <div className="flex flex-wrap gap-2">
                    {project.subject && (
                      <span className="rounded-full border border-accent/20 bg-white px-2.5 py-1 text-[11px] font-semibold text-accent-strong">
                        {project.subject}
                      </span>
                    )}
                    {project.grade?.trim() && (
                      <span className="rounded-full border border-accent/20 bg-white px-2.5 py-1 text-[11px] font-semibold text-accent-strong">
                        Grade {project.grade}
                      </span>
                    )}
                  </div>

                  <h2 className="truncate text-lg font-semibold leading-snug text-white">{project.title}</h2>
                  <p
                    className="text-sm leading-relaxed text-slate-300"
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {showcaseDetail}
                  </p>

                  {project.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {project.tags.slice(0, 4).map((tag) => (
                        <span
                          key={`${project.id}-${tag}`}
                          className="rounded-md border border-accent/15 bg-white/80 px-2 py-1 text-[11px] font-medium text-slate-700"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 text-xs">
                    {project.videoUrls.length > 0 && (
                      <span className="rounded-full bg-white px-2.5 py-1 text-slate-700 border border-accent/15">
                        {project.videoUrls.length} video demo
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1 mt-auto">
                    <Link
                      href={`/steamh-projects/${encodeURIComponent(project.id)}`}
                      className="inline-flex items-center justify-center rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-true-white shadow-glow hover:opacity-90"
                    >
                      View
                    </Link>
                    <CollaborateButton
                      href={buildProjectCollabPath(project.id)}
                      label="Collaborate"
                      compact
                    />
                  </div>
                </div>
              </div>
            </article>
            );
          })}
          </section>
        </>
      )}
    </main>
  );
}
