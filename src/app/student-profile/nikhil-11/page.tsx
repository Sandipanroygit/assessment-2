"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { buildCollabLoginPath, COLLAB_PROFILE_PATH, COLLAB_PUBLISHER } from "@/lib/steamhCollaboration";
import { supabase } from "@/lib/supabaseClient";

type ViewerContext = {
  name: string;
  role: string;
  grade: string;
};

const normalizeRole = (value: unknown) => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!normalized) return "member";
  return normalized;
};

export default function NikhilProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [viewer, setViewer] = useState<ViewerContext | null>(null);

  useEffect(() => {
    let active = true;

    const loadViewer = async () => {
      try {
        setLoading(true);
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;

        if (!user) {
          router.replace(buildCollabLoginPath(COLLAB_PROFILE_PATH));
          return;
        }

        const fallbackName =
          (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()) ||
          user.email ||
          "Collaborator";
        const fallbackRole = normalizeRole(user.user_metadata?.role);
        const fallbackGrade = typeof user.user_metadata?.grade === "string" ? user.user_metadata.grade : "";

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, role, grade")
          .eq("id", user.id)
          .maybeSingle();

        if (!active) return;

        setViewer({
          name:
            (typeof profile?.full_name === "string" && profile.full_name.trim()) ||
            fallbackName,
          role:
            normalizeRole(profile?.role) || fallbackRole,
          grade:
            (typeof profile?.grade === "string" && profile.grade.trim()) || fallbackGrade,
        });
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadViewer();
    return () => {
      active = false;
    };
  }, [router]);

  const collaborationMailTo = useMemo(() => {
    const viewerName = viewer?.name ?? "a collaborator";
    const viewerRole = viewer?.role ?? "member";
    const viewerGrade = viewer?.grade ? ` (${viewer?.grade})` : "";

    const subject = "Collaboration request from STEAM-H showcase";
    const body = [
      `Hi ${COLLAB_PUBLISHER.name},`,
      "",
      `I would like to collaborate on your STEAM-H project.`,
      `I am ${viewerName}${viewerGrade}, and my role is ${viewerRole}.`,
      "",
      "Please share next steps for working together.",
      "",
      "Thanks.",
    ].join("\n");

    return `mailto:${COLLAB_PUBLISHER.collaborationEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [viewer]);

  if (loading) {
    return (
      <main className="section-padding space-y-6">
        <div className="glass-panel rounded-3xl p-6 md:p-8 animate-pulse border border-accent/10 bg-white/60 h-72" />
        <div className="glass-panel rounded-3xl p-6 md:p-8 animate-pulse border border-accent/10 bg-white/60 h-56" />
      </main>
    );
  }

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
          <span className="text-white font-semibold">Student Profile</span>
        </nav>
        <Link
          href="/steamh-projects"
          className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-true-white shadow-glow hover:opacity-90"
        >
          Back to Showcase
        </Link>
      </div>

      <section className="glass-panel rounded-3xl p-6 md:p-8 space-y-5 border border-accent/15">
        <p className="text-xs uppercase tracking-[0.2em] text-accent-strong">Collaboration Profile</p>
        <h1 className="text-3xl md:text-4xl font-semibold text-white">
          {COLLAB_PUBLISHER.name} - Grade {COLLAB_PUBLISHER.grade}
        </h1>
        <p className="text-sm md:text-base leading-relaxed text-slate-200">
          You are viewing the collaboration profile linked from current STEAM-H showcase projects. If you want to work
          with the publisher, send a collaboration request directly from this page.
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-accent/20 bg-white/75 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Publisher</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{COLLAB_PUBLISHER.name}</p>
          </div>
          <div className="rounded-2xl border border-accent/20 bg-white/75 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Grade</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{COLLAB_PUBLISHER.grade}</p>
          </div>
          <div className="rounded-2xl border border-accent/20 bg-white/75 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Focus Area</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{COLLAB_PUBLISHER.focus}</p>
          </div>
        </div>
      </section>

      <section>
        <article className="glass-panel rounded-3xl p-6 md:p-8 space-y-4 border border-accent/15">
          <h2 className="text-2xl font-semibold text-white">Start Collaboration</h2>
          <p className="text-sm md:text-base leading-relaxed text-slate-200">
            Send your collaboration request to connect directly with the project publisher. Include the project name,
            your role, and what part you want to co-build or research.
          </p>
          <a
            href={collaborationMailTo}
            className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-true-white shadow-glow hover:opacity-90"
          >
            Send Collaboration Request
          </a>
        </article>
      </section>
    </main>
  );
}
