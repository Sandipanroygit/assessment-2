import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin =
  SUPABASE_URL && SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY) : null;
const normalize = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();
const isMissingSchoolColumnError = (message: string) => message.toLowerCase().includes("school_name");
const DEFAULT_LEGACY_SCHOOL_NAME = "10X International School, Bangalore";

export async function GET(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) {
    return NextResponse.json({ error: "Missing access token" }, { status: 401 });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const role = (userData.user.user_metadata?.role as string | undefined)?.toLowerCase() ?? "";
  if (role !== "teacher") {
    return NextResponse.json({ error: "Only teachers can view students" }, { status: 403 });
  }

  const teacherSubject = (userData.user.user_metadata?.subject as string | undefined) ?? null;
  const teacherSchoolFromMetadata = normalize(userData.user.user_metadata?.school_name as string | undefined);
  let teacherSchool = teacherSchoolFromMetadata;

  if (!teacherSchool) {
    const { data: teacherProfile, error: teacherProfileError } = await supabaseAdmin
      .from("profiles")
      .select("school_name")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (teacherProfileError) {
      if (!isMissingSchoolColumnError(teacherProfileError.message)) {
        return NextResponse.json({ error: teacherProfileError.message }, { status: 500 });
      }
    } else {
      teacherSchool = normalize((teacherProfile as { school_name?: string } | null)?.school_name);
    }
  }
  if (!teacherSchool) {
    teacherSchool = normalize(DEFAULT_LEGACY_SCHOOL_NAME);
  }

  // Prefer auth metadata for student list; fallback to profiles.
  const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 500,
  });
  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const users = listData.users ?? [];
  const userIds = users.map((u) => u.id);
  const profileMap = new Map<string, { school_name?: string | null }>();
  if (userIds.length) {
    const { data: profileRows, error: profileRowsError } = await supabaseAdmin
      .from("profiles")
      .select("id,school_name")
      .in("id", userIds);
    if (profileRowsError) {
      if (!isMissingSchoolColumnError(profileRowsError.message)) {
        return NextResponse.json({ error: profileRowsError.message }, { status: 500 });
      }
    } else {
      for (const row of profileRows ?? []) {
        const typed = row as { id: string; school_name?: string | null };
        profileMap.set(typed.id, { school_name: typed.school_name ?? null });
      }
    }
  }

  const students = users
    .filter((u) => ((u.user_metadata?.role as string | undefined)?.toLowerCase() ?? "") === "student")
    .map((u) => ({
      id: u.id,
      email: u.email,
      full_name: (u.user_metadata?.full_name as string | undefined) ?? u.email ?? "Student",
      grade: (u.user_metadata?.grade as string | undefined) ?? null,
      subject: (u.user_metadata?.subject as string | undefined) ?? null,
      school_name:
        (u.user_metadata?.school_name as string | undefined)
        ?? profileMap.get(u.id)?.school_name
        ?? DEFAULT_LEGACY_SCHOOL_NAME,
      joined_at: u.created_at ?? null,
    }))
    .filter((u) => {
      if (!teacherSubject) return true;
      return u.subject ? u.subject === teacherSubject : true;
    })
    .filter((u) => {
      if (!teacherSchool) return true;
      return normalize(u.school_name) === teacherSchool;
    });

  return NextResponse.json({
    students: students.map((student) => ({
      id: student.id,
      email: student.email,
      full_name: student.full_name,
      grade: student.grade,
      subject: student.subject,
      joined_at: student.joined_at,
    })),
  });
}
