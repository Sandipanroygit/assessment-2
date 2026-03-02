import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { COLLAB_PUBLISHER } from "@/lib/steamhCollaboration";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const getClient = () => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Supabase server credentials are missing.");
  }

  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

const extractToken = (req: Request) => {
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
};

const isMissingTableError = (message: string) =>
  message.toLowerCase().includes("steamh_collaboration_requests") &&
  (message.toLowerCase().includes("schema cache") || message.toLowerCase().includes("relation"));
const isMissingCollaborationEnabledColumnError = (error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";
  return /collaboration_enabled/i.test(message) && /(column|schema cache)/i.test(message);
};

const normalizeRole = (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase() : "");

const parseGradeNumber = (value: string) => {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : Number.NaN;
};

const resolvePublisherProfileId = async (
  supabase: ReturnType<typeof getClient>,
  publisherName: string,
  publisherGrade: string,
) => {
  const targetName = publisherName.trim() || COLLAB_PUBLISHER.name;
  const targetGradeLabel = publisherGrade.trim();

  const { data: candidates, error } = await supabase
    .from("profiles")
    .select("id,full_name,grade,role")
    .ilike("full_name", `${targetName}%`)
    .limit(10);

  if (error) return null;

  const targetGrade = parseGradeNumber(targetGradeLabel);
  const bestMatch = (candidates ?? []).find((candidate) => {
    const name = (candidate.full_name as string | null | undefined) ?? "";
    const candidateGrade = (candidate.grade as string | null | undefined) ?? "";
    const candidateRole = normalizeRole(candidate.role);
    const gradeNumber = parseGradeNumber(candidateGrade);

    return (
      name.trim().toLowerCase().startsWith(targetName.toLowerCase()) &&
      (Number.isNaN(targetGrade) || gradeNumber === targetGrade || candidateGrade.toLowerCase().includes(targetGradeLabel.toLowerCase())) &&
      (candidateRole === "student" || candidateRole === "customer")
    );
  });

  return bestMatch?.id ?? null;
};

export async function POST(req: Request) {
  try {
    const token = extractToken(req);
    if (!token) {
      return NextResponse.json({ error: "Missing access token" }, { status: 401 });
    }

    const supabase = getClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return NextResponse.json({ error: userError?.message ?? "Invalid token" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      projectId?: string;
      projectTitle?: string;
      publisherName?: string;
      publisherGrade?: string;
      message?: string;
    };

    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
    const projectTitle = typeof body.projectTitle === "string" ? body.projectTitle.trim() : "";
    const fallbackPublisherName = typeof body.publisherName === "string" ? body.publisherName.trim() : "";
    const fallbackPublisherGrade = typeof body.publisherGrade === "string" ? body.publisherGrade.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!projectId || !projectTitle) {
      return NextResponse.json({ error: "Missing project context for collaboration." }, { status: 400 });
    }
    if (!message) {
      return NextResponse.json({ error: "Write your collaboration message." }, { status: 400 });
    }
    if (message.length > 1600) {
      return NextResponse.json({ error: "Message is too long. Keep it within 1600 characters." }, { status: 400 });
    }

    const requester = userData.user;
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name,role,grade")
      .eq("id", requester.id)
      .maybeSingle();

    const requesterName =
      (typeof profile?.full_name === "string" && profile.full_name.trim()) ||
      (typeof requester.user_metadata?.full_name === "string" && requester.user_metadata.full_name.trim()) ||
      requester.email ||
      "Collaborator";
    const requesterRole =
      normalizeRole(profile?.role) ||
      normalizeRole(requester.user_metadata?.role) ||
      "member";
    const requesterGrade =
      (typeof profile?.grade === "string" && profile.grade.trim()) ||
      (typeof requester.user_metadata?.grade === "string" && requester.user_metadata.grade.trim()) ||
      null;
    const requesterEmail = requester.email ?? null;

    const withCollaborationEnabled = await supabase
      .from("steamh_projects")
      .select("student_name,grade,collaboration_enabled")
      .eq("id", projectId)
      .limit(1)
      .maybeSingle();
    let projectOwner = withCollaborationEnabled.data as
      | { student_name?: string | null; grade?: string | null; collaboration_enabled?: boolean | null }
      | null;
    let projectOwnerError = withCollaborationEnabled.error;
    if (projectOwnerError && isMissingCollaborationEnabledColumnError(projectOwnerError)) {
      const fallback = await supabase
        .from("steamh_projects")
        .select("student_name,grade")
        .eq("id", projectId)
        .limit(1)
        .maybeSingle();
      projectOwner = fallback.data as { student_name?: string | null; grade?: string | null } | null;
      projectOwnerError = fallback.error;
    }
    if (projectOwnerError) {
      return NextResponse.json({ error: projectOwnerError.message }, { status: 500 });
    }
    if (projectOwner?.collaboration_enabled === false) {
      return NextResponse.json({ error: "Collaboration is disabled for this project." }, { status: 403 });
    }

    const publisherName =
      (typeof projectOwner?.student_name === "string" && projectOwner.student_name.trim()) ||
      fallbackPublisherName ||
      COLLAB_PUBLISHER.name;
    const publisherGrade =
      (typeof projectOwner?.grade === "string" && projectOwner.grade.trim()) ||
      fallbackPublisherGrade ||
      COLLAB_PUBLISHER.grade;

    const publisherProfileId = await resolvePublisherProfileId(supabase, publisherName, publisherGrade);

    const { data: insertedRequest, error: insertError } = await supabase
      .from("steamh_collaboration_requests")
      .insert({
        project_id: projectId,
        project_title: projectTitle,
        requester_id: requester.id,
        requester_name: requesterName,
        requester_email: requesterEmail,
        requester_role: requesterRole,
        requester_grade: requesterGrade,
        publisher_profile_id: publisherProfileId,
        publisher_name: publisherName,
        publisher_grade: publisherGrade,
        message,
        status: "new",
      })
      .select("id")
      .single();

    if (insertError) {
      const setupHint = isMissingTableError(insertError.message)
        ? " Apply `supabase/steamh_collaboration_patch.sql` in Supabase SQL Editor."
        : "";
      return NextResponse.json({ error: `${insertError.message}${setupHint}` }, { status: 500 });
    }

    if (publisherProfileId) {
      await supabase.from("notifications").insert({
        user_id: publisherProfileId,
        module_id: null,
        subject: "Collaboration Request",
        title: `${requesterName} wants to collaborate`,
        message: `${requesterName} sent a request on "${projectTitle}".`,
        status: "unread",
        inserted_by: requester.id,
      });
    }

    return NextResponse.json({
      ok: true,
      requestId: insertedRequest?.id ?? null,
      deliveredToPublisher: Boolean(publisherProfileId),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to send collaboration request.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
