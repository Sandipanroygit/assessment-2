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

const isMissingTableError = (message: string) =>
  message.toLowerCase().includes("student_queries")
  && (message.toLowerCase().includes("schema cache") || message.toLowerCase().includes("relation"));

const normalizeRole = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();

const resolveUserRole = async (userId: string, metadataRole?: string | null): Promise<string | null> => {
  const normalizedMetadataRole = normalizeRole(metadataRole);
  if (normalizedMetadataRole) return normalizedMetadataRole;

  const { data: profile, error: profileError } = await supabaseAdmin!
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Role lookup failed: ${profileError.message}`);
  }

  return normalizeRole((profile as { role?: string } | null)?.role) || null;
};

const ensureProfile = async (user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}, fallbackRole: "student" | "teacher") => {
  if (!supabaseAdmin) return;
  const fullName = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "User";

  const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existingProfileError) {
    throw new Error(`Profile lookup failed: ${existingProfileError.message}`);
  }

  if (existingProfile?.id) {
    return;
  }

  const insertPayload = {
    id: user.id,
    full_name: fullName,
    role: fallbackRole,
  };

  const { error: insertError } = await supabaseAdmin.from("profiles").insert(insertPayload);
  if (!insertError) return;

  const lowerMessage = insertError.message.toLowerCase();
  const isRoleConstraintError =
    lowerMessage.includes("profiles_role_check") || (lowerMessage.includes("check constraint") && lowerMessage.includes("role"));
  const isDuplicateError = insertError.code === "23505";

  if (isDuplicateError) {
    return;
  }

  if (isRoleConstraintError) {
    const payloadWithoutRole = {
      id: user.id,
      full_name: fullName,
    };
    const { error: withoutRoleError } = await supabaseAdmin.from("profiles").insert(payloadWithoutRole);
    if (!withoutRoleError) return;
    throw new Error(`Profile upsert failed: ${withoutRoleError.message}`);
  }

  throw new Error(`Profile upsert failed: ${insertError.message}`);
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

    const student = userData.user;
    const role = (await resolveUserRole(student.id, student.user_metadata?.role as string | undefined)) ?? "";
    if (role !== "student" && role !== "customer") {
      return NextResponse.json({ error: "Only students can view queries" }, { status: 403 });
    }

    const url = new URL(req.url);
    const teacherIdParam = (url.searchParams.get("teacherId") ?? "").trim();

    let query = supabaseAdmin
      .from("student_queries")
      .select("id,student_id,student_name,teacher_id,teacher_name,subject,grade,query_text,status,created_at")
      .eq("student_id", student.id)
      .order("created_at", { ascending: false })
      .limit(200);

    if (teacherIdParam) {
      query = query.eq("teacher_id", teacherIdParam);
    }

    const { data, error } = await query;
    if (error) {
      const setupHint = isMissingTableError(error.message)
        ? " Apply `supabase/student_queries_patch.sql` in Supabase SQL Editor."
        : "";
      return NextResponse.json({ error: `${error.message}${setupHint}` }, { status: 500 });
    }

    return NextResponse.json({ queries: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to load queries.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
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

    const student = userData.user;
    const role = (await resolveUserRole(student.id, student.user_metadata?.role as string | undefined)) ?? "";
    if (role !== "student" && role !== "customer") {
      return NextResponse.json({ error: "Only students can send queries" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      teacherId?: string;
      query?: string;
    };

    const teacherId = typeof body.teacherId === "string" ? body.teacherId.trim() : "";
    const query = typeof body.query === "string" ? body.query.trim() : "";

    if (!teacherId) {
      return NextResponse.json({ error: "Select a teacher." }, { status: 400 });
    }
    if (!query) {
      return NextResponse.json({ error: "Type your query." }, { status: 400 });
    }
    if (query.length > 1200) {
      return NextResponse.json({ error: "Query is too long. Keep it under 1200 characters." }, { status: 400 });
    }

    const { data: teacherData, error: teacherError } = await supabaseAdmin.auth.admin.getUserById(teacherId);
    if (teacherError || !teacherData?.user) {
      return NextResponse.json({ error: teacherError?.message ?? "Teacher not found" }, { status: 404 });
    }

    const teacher = teacherData.user;
    const teacherRole = (await resolveUserRole(teacher.id, teacher.user_metadata?.role as string | undefined)) ?? "";
    if (teacherRole !== "teacher") {
      return NextResponse.json({ error: "Selected user is not a teacher." }, { status: 400 });
    }

    await ensureProfile(student, "student");
    await ensureProfile(teacher, "teacher");

    const studentName = (student.user_metadata?.full_name as string | undefined) ?? student.email ?? "Student";
    const teacherName = (teacher.user_metadata?.full_name as string | undefined) ?? teacher.email ?? "Teacher";
    const subject = (student.user_metadata?.subject as string | undefined) ?? null;
    const grade = (student.user_metadata?.grade as string | undefined) ?? null;

    const { data: insertedQuery, error: insertError } = await supabaseAdmin
      .from("student_queries")
      .insert({
        student_id: student.id,
        teacher_id: teacher.id,
        student_name: studentName,
        teacher_name: teacherName,
        subject,
        grade,
        query_text: query,
        status: "new",
      })
      .select("id")
      .single();

    if (insertError) {
      const setupHint = isMissingTableError(insertError.message)
        ? " Apply `supabase/student_queries_patch.sql` in Supabase SQL Editor."
        : "";
      return NextResponse.json({ error: `${insertError.message}${setupHint}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true, queryId: insertedQuery?.id ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to send query.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
