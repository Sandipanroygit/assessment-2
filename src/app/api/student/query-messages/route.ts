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
  message.toLowerCase().includes("student_query_messages")
  && (message.toLowerCase().includes("schema cache") || message.toLowerCase().includes("relation"));

const normalizeRole = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();

type AuthContext = {
  user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown>;
  };
  role: "teacher" | "student";
};

const resolveRole = async (
  userId: string,
  metadataRole?: string | null,
): Promise<"teacher" | "student" | null> => {
  const normalizedMetadataRole = normalizeRole(metadataRole);
  if (normalizedMetadataRole === "teacher") return "teacher";
  if (normalizedMetadataRole === "student" || normalizedMetadataRole === "customer") return "student";

  const { data: profile, error: profileError } = await supabaseAdmin!
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Role lookup failed: ${profileError.message}`);
  }

  const normalizedProfileRole = normalizeRole((profile as { role?: string } | null)?.role);
  if (normalizedProfileRole === "teacher") return "teacher";
  if (normalizedProfileRole === "student" || normalizedProfileRole === "customer") return "student";
  return null;
};

const requireTeacherOrStudent = async (req: Request): Promise<{ auth?: AuthContext; error?: NextResponse }> => {
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

  const user = userData.user;
  let role: "teacher" | "student" | null = null;
  try {
    role = await resolveRole(user.id, user.user_metadata?.role as string | undefined);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Role lookup failed";
    return { error: NextResponse.json({ error: message }, { status: 500 }) };
  }

  if (!role) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { auth: { user, role } };
};

const requireQueryAccess = async (queryId: string, auth: AuthContext) => {
  const { data: queryRow, error: queryError } = await supabaseAdmin!
    .from("student_queries")
    .select("id,student_id,teacher_id,query_text,created_at,status")
    .eq("id", queryId)
    .maybeSingle();

  if (queryError) {
    throw new Error(queryError.message);
  }
  if (!queryRow) {
    return { error: NextResponse.json({ error: "Query not found" }, { status: 404 }) };
  }

  if (auth.role === "teacher" && queryRow.teacher_id !== auth.user.id) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  if (auth.role === "student" && queryRow.student_id !== auth.user.id) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { queryRow };
};

export async function GET(req: Request) {
  try {
    const authResult = await requireTeacherOrStudent(req);
    if (authResult.error) return authResult.error;

    const url = new URL(req.url);
    const queryId = (url.searchParams.get("queryId") ?? "").trim();
    if (!queryId) {
      return NextResponse.json({ error: "Missing queryId" }, { status: 400 });
    }

    const access = await requireQueryAccess(queryId, authResult.auth!);
    if ("error" in access) return access.error;

    const { data: messages, error: messagesError } = await supabaseAdmin!
      .from("student_query_messages")
      .select("id,query_id,sender_id,sender_role,sender_name,message_text,created_at")
      .eq("query_id", queryId)
      .order("created_at", { ascending: true });

    if (messagesError) {
      const setupHint = isMissingTableError(messagesError.message)
        ? " Apply `supabase/student_queries_patch.sql` in Supabase SQL Editor."
        : "";
      return NextResponse.json({ error: `${messagesError.message}${setupHint}` }, { status: 500 });
    }

    return NextResponse.json({
      query: access.queryRow,
      messages: messages ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to load chat messages.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireTeacherOrStudent(req);
    if (authResult.error) return authResult.error;

    const body = (await req.json().catch(() => ({}))) as { queryId?: string; message?: string };
    const queryId = typeof body.queryId === "string" ? body.queryId.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!queryId) {
      return NextResponse.json({ error: "Missing queryId" }, { status: 400 });
    }
    if (!message) {
      return NextResponse.json({ error: "Type a message." }, { status: 400 });
    }
    if (message.length > 1200) {
      return NextResponse.json({ error: "Message is too long. Keep it under 1200 characters." }, { status: 400 });
    }

    const access = await requireQueryAccess(queryId, authResult.auth!);
    if ("error" in access) return access.error;

    const senderName =
      (authResult.auth!.user.user_metadata?.full_name as string | undefined)
      ?? authResult.auth!.user.email
      ?? (authResult.auth!.role === "teacher" ? "Teacher" : "Student");

    const { error: insertError } = await supabaseAdmin!.from("student_query_messages").insert({
      query_id: queryId,
      sender_id: authResult.auth!.user.id,
      sender_role: authResult.auth!.role,
      sender_name: senderName,
      message_text: message,
    });

    if (insertError) {
      const setupHint = isMissingTableError(insertError.message)
        ? " Apply `supabase/student_queries_patch.sql` in Supabase SQL Editor."
        : "";
      return NextResponse.json({ error: `${insertError.message}${setupHint}` }, { status: 500 });
    }

    const nextStatus = authResult.auth!.role === "teacher" ? "read" : "new";
    const { error: updateError } = await supabaseAdmin!
      .from("student_queries")
      .update({ status: nextStatus })
      .eq("id", queryId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to send message.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
