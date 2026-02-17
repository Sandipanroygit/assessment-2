import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ALLOWED_STATUSES = new Set(["new", "read"]);

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

const resolveRole = async (userId: string, metadataRole?: string | null): Promise<string | null> => {
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

const requireTeacher = async (req: Request) => {
  if (!supabaseAdmin) {
    return { error: NextResponse.json({ error: "Server misconfigured" }, { status: 500 }) };
  }

  const token = extractToken(req);
  if (!token) {
    return { error: NextResponse.json({ error: "Missing access token" }, { status: 401 }) };
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return { error: NextResponse.json({ error: userError?.message ?? "Invalid token" }, { status: 401 }) };
  }

  const teacher = userData.user;
  let role = "";
  try {
    role = (await resolveRole(teacher.id, teacher.user_metadata?.role as string | undefined)) ?? "";
  } catch (err) {
    const message = err instanceof Error ? err.message : "Role lookup failed";
    return { error: NextResponse.json({ error: message }, { status: 500 }) };
  }
  if (role !== "teacher") {
    return { error: NextResponse.json({ error: "Only teachers can access student queries" }, { status: 403 }) };
  }

  return { teacher };
};

export async function GET(req: Request) {
  try {
    const auth = await requireTeacher(req);
    if ("error" in auth) return auth.error;

    const { data, error } = await supabaseAdmin!
      .from("student_queries")
      .select("id,student_id,student_name,teacher_id,teacher_name,subject,grade,query_text,status,created_at")
      .eq("teacher_id", auth.teacher.id)
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) {
      const setupHint = isMissingTableError(error.message)
        ? " Apply `supabase/student_queries_patch.sql` in Supabase SQL Editor."
        : "";
      return NextResponse.json({ error: `${error.message}${setupHint}` }, { status: 500 });
    }

    return NextResponse.json({ queries: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to load student queries.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireTeacher(req);
    if ("error" in auth) return auth.error;

    const body = (await req.json().catch(() => ({}))) as { id?: string; status?: string };
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const status = typeof body.status === "string" ? body.status.trim().toLowerCase() : "";

    if (!id) {
      return NextResponse.json({ error: "Missing query id" }, { status: 400 });
    }
    if (!ALLOWED_STATUSES.has(status)) {
      return NextResponse.json({ error: "Status must be new or read" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin!
      .from("student_queries")
      .update({ status })
      .eq("id", id)
      .eq("teacher_id", auth.teacher.id)
      .select("id")
      .maybeSingle();

    if (error) {
      const setupHint = isMissingTableError(error.message)
        ? " Apply `supabase/student_queries_patch.sql` in Supabase SQL Editor."
        : "";
      return NextResponse.json({ error: `${error.message}${setupHint}` }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Query not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to update query.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
