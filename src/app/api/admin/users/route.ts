import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ALLOWED_ROLES = ["admin", "teacher", "student", "customer"];
const ALLOWED_APPROVAL_STATUSES = ["pending", "approved"];
const DEFAULT_LEGACY_SCHOOL_NAME = "10X International School, Bangalore";

const supabaseAdmin =
  SUPABASE_URL && SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY) : null;

export async function GET(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : null;
  if (!token) {
    return NextResponse.json({ error: "Missing access token" }, { status: 401 });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const userId = userData.user.id;
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  const role = profile?.role ?? (userData.user.user_metadata?.role as string | undefined);
  const roleLower = (role ?? "").toLowerCase();
  if (roleLower !== "admin") {
    const metaRole = (userData.user.user_metadata?.role as string | undefined)?.toLowerCase() ?? "";
    if (metaRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 500,
  });
  if (listError || !listData?.users) {
    return NextResponse.json({ error: listError?.message ?? "Unable to list users" }, { status: 500 });
  }

  const profileIds = listData.users.map((user) => user.id);
  const { data: profileRows } = profileIds.length
    ? await supabaseAdmin
        .from("profiles")
        .select("id, role, grade, approval_status, approved_at")
        .in("id", profileIds)
    : { data: [] };
  const profileMap = new Map((profileRows ?? []).map((profile) => [profile.id, profile]));

  const users = listData.users.map((u) => {
    const profile = profileMap.get(u.id);
    const rawName = (u.user_metadata?.full_name as string | undefined) ?? "";
    const full_name = rawName.trim().length ? rawName : u.email ?? "User";
    const metadataRole = ((u.user_metadata?.role as string | undefined) ?? "").toLowerCase();
    const profileRole = typeof profile?.role === "string" ? profile.role.toLowerCase() : "";
    const resolvedRole = profileRole || metadataRole || "student";
    const metadataApproval = ((u.user_metadata?.approval_status as string | undefined) ?? "").toLowerCase();
    const profileApproval = typeof profile?.approval_status === "string" ? profile.approval_status.toLowerCase() : "";
    const resolvedSchoolName =
      (u.user_metadata?.school_name as string | undefined)
      ?? (["teacher", "student", "customer"].includes(resolvedRole) ? DEFAULT_LEGACY_SCHOOL_NAME : null);
    return {
      id: u.id,
      email: u.email,
      full_name,
      role: resolvedRole,
      grade: (profile?.grade as string | null | undefined) ?? (u.user_metadata?.grade as string | undefined) ?? null,
      subject: (u.user_metadata?.subject as string | undefined) ?? null,
      school_name: resolvedSchoolName,
      approval_status: profileApproval || metadataApproval || "pending",
      approved_at: (profile?.approved_at as string | null | undefined) ?? null,
      created_at: u.created_at,
    };
  });

  return NextResponse.json({ total: users.length, users });
}

export async function PATCH(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : null;
  if (!token) {
    return NextResponse.json({ error: "Missing access token" }, { status: 401 });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const userId = userData.user.id;
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  const role = profile?.role ?? (userData.user.user_metadata?.role as string | undefined);
  if (profileError || (role ?? "").toLowerCase() !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    id?: string;
    full_name?: string;
    role?: string;
    grade?: string | null;
    subject?: string | null;
    school_name?: string | null;
    approval_status?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const targetId = body.id?.trim();
  const nextRole = (body.role ?? "").trim().toLowerCase();
  const nextName = body.full_name?.trim();
  const nextGrade = body.grade?.trim();
  const nextSubject = body.subject?.trim();
  const nextSchoolName = body.school_name?.trim();
  const nextApprovalStatus = (body.approval_status ?? "").trim().toLowerCase();

  if (!targetId) {
    return NextResponse.json({ error: "Missing user id" }, { status: 400 });
  }
  if (!ALLOWED_ROLES.includes(nextRole)) {
    return NextResponse.json({ error: "Role must be admin, teacher, student, or customer" }, { status: 400 });
  }
  if (!ALLOWED_APPROVAL_STATUSES.includes(nextApprovalStatus)) {
    return NextResponse.json({ error: "Approval status must be pending or approved" }, { status: 400 });
  }

  const { data: targetUserData, error: targetUserError } = await supabaseAdmin.auth.admin.getUserById(targetId);
  if (targetUserError || !targetUserData?.user) {
    return NextResponse.json({ error: targetUserError?.message ?? "Target user not found" }, { status: 404 });
  }
  const existingSchoolName =
    (targetUserData.user.user_metadata?.school_name as string | undefined)?.trim() ?? null;
  const resolvedSchoolName = nextSchoolName ?? existingSchoolName;

  const { data: existingProfile } = await supabaseAdmin
    .from("profiles")
    .select("approval_status")
    .eq("id", targetId)
    .maybeSingle();
  const wasApproved = (existingProfile?.approval_status ?? "").toLowerCase() === "approved";
  const isApprovingNow = nextApprovalStatus === "approved" && !wasApproved;
  const isRevertingToPending = nextApprovalStatus === "pending";

  const updateResult = await supabaseAdmin.auth.admin.updateUserById(targetId, {
    user_metadata: {
      full_name: nextName ?? null,
      role: nextRole,
      grade: nextGrade ?? null,
      subject: nextRole === "teacher" ? nextSubject ?? null : null,
      school_name: resolvedSchoolName,
      approval_status: nextApprovalStatus,
    },
  });

  if (updateResult.error) {
    return NextResponse.json({ error: updateResult.error.message }, { status: 500 });
  }

  // Profiles table has no subject column; only sync name/role/grade.
  const profilePayload = {
    id: targetId,
    full_name: nextName ?? null,
    role: nextRole,
    grade: nextGrade ?? null,
    school_name: resolvedSchoolName,
    approval_status: nextApprovalStatus,
    approved_at: isApprovingNow ? new Date().toISOString() : isRevertingToPending ? null : undefined,
    approved_by: isApprovingNow ? userId : isRevertingToPending ? null : undefined,
  };

  const { error: profileUpsertError } = await supabaseAdmin
    .from("profiles")
    .upsert(profilePayload, { onConflict: "id" });

  return NextResponse.json({
    updated: true,
    profileWarning: profileUpsertError?.message ?? null,
  });
}
