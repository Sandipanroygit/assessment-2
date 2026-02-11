import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ALLOWED_ROLES = ["admin", "teacher", "student", "customer"];

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
  const { data: profile, error: profileError } = await supabaseAdmin
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

  const users = listData.users.map((u) => {
    const rawName = (u.user_metadata?.full_name as string | undefined) ?? "";
    const full_name = rawName.trim().length ? rawName : u.email ?? "User";
    return {
      id: u.id,
      email: u.email,
      full_name,
      role: ((u.user_metadata?.role as string | undefined) ?? "student").toLowerCase(),
      grade: (u.user_metadata?.grade as string | undefined) ?? null,
      subject: (u.user_metadata?.subject as string | undefined) ?? null,
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

  let body: { id?: string; full_name?: string; role?: string; grade?: string | null; subject?: string | null };
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

  if (!targetId) {
    return NextResponse.json({ error: "Missing user id" }, { status: 400 });
  }
  if (!ALLOWED_ROLES.includes(nextRole)) {
    return NextResponse.json({ error: "Role must be admin, teacher, student, or customer" }, { status: 400 });
  }

  const updateResult = await supabaseAdmin.auth.admin.updateUserById(targetId, {
    user_metadata: {
      full_name: nextName ?? null,
      role: nextRole,
      grade: nextGrade ?? null,
      subject: nextRole === "teacher" ? nextSubject ?? null : null,
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
  };

  const { error: profileUpsertError } = await supabaseAdmin
    .from("profiles")
    .upsert(profilePayload, { onConflict: "id" });

  return NextResponse.json({
    updated: true,
    profileWarning: profileUpsertError?.message ?? null,
  });
}
