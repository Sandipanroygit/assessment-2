import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin =
  SUPABASE_URL && SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

const extractToken = (req: Request) => {
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
};

const normalize = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();

const resolveUserRole = async (userId: string, metadataRole?: string | null): Promise<string | null> => {
  const normalizedMetadataRole = normalize(metadataRole);
  if (normalizedMetadataRole) return normalizedMetadataRole;

  const { data: profile, error: profileError } = await supabaseAdmin!
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Role lookup failed: ${profileError.message}`);
  }

  return normalize((profile as { role?: string } | null)?.role) || null;
};

type TeacherRow = {
  id: string;
  full_name: string;
  email: string | null;
  subject: string | null;
  grade: string | null;
};

export async function GET(req: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const token = extractToken(req);
    if (!token) {
      return NextResponse.json({ error: "Missing access token" }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return NextResponse.json({ error: userError?.message ?? "Invalid token" }, { status: 401 });
    }

    const user = userData.user;
    const role = (await resolveUserRole(user.id, user.user_metadata?.role as string | undefined)) ?? "";
    if (role !== "student" && role !== "customer") {
      return NextResponse.json({ error: "Only students can view teachers" }, { status: 403 });
    }

    const studentSubject = normalize(user.user_metadata?.subject as string | undefined);
    const studentGrade = normalize(user.user_metadata?.grade as string | undefined);

    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }

    const users = usersData.users ?? [];
    const userIds = users.map((item) => item.id);
    const profileMap = new Map<string, { role?: string | null; grade?: string | null }>();
    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from("profiles")
        .select("id,role,grade")
        .in("id", userIds);
      if (profilesError) {
        return NextResponse.json({ error: profilesError.message }, { status: 500 });
      }
      for (const profile of profiles ?? []) {
        const row = profile as { id: string; role?: string | null; grade?: string | null };
        profileMap.set(row.id, { role: row.role ?? null, grade: row.grade ?? null });
      }
    }

    const allTeachers: TeacherRow[] = users
      .filter((item) => {
        const roleFromMetadata = normalize(item.user_metadata?.role as string | undefined);
        const roleFromProfile = normalize(profileMap.get(item.id)?.role);
        return roleFromMetadata === "teacher" || roleFromProfile === "teacher";
      })
      .map((item) => ({
        id: item.id,
        full_name: (item.user_metadata?.full_name as string | undefined) ?? item.email ?? "Teacher",
        email: item.email ?? null,
        subject: (item.user_metadata?.subject as string | undefined) ?? null,
        grade:
          (item.user_metadata?.grade as string | undefined)
          ?? profileMap.get(item.id)?.grade
          ?? null,
      }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));

    let filtered = allTeachers;

    if (studentSubject) {
      const subjectMatched = allTeachers.filter((teacher) => normalize(teacher.subject) === studentSubject);
      if (subjectMatched.length > 0) {
        filtered = subjectMatched;
      }
    }

    if (studentGrade) {
      const gradeMatched = filtered.filter((teacher) => {
        const teacherGrade = normalize(teacher.grade);
        return !teacherGrade || teacherGrade === studentGrade;
      });
      if (gradeMatched.length > 0) {
        filtered = gradeMatched;
      }
    }

    return NextResponse.json({ teachers: filtered });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to load teachers.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
