import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin =
  SUPABASE_URL && SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY) : null;

const extractToken = (req: Request) => {
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
};

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

    const teacher = userData.user;
    const teacherRole = (teacher.user_metadata?.role as string | undefined)?.toLowerCase() ?? "";
    if (teacherRole !== "teacher") {
      return NextResponse.json({ error: "Only teachers can send requests" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      subject?: string;
      items?: unknown;
      neededBy?: string;
      notes?: string | null;
      requestType?: string;
    };

    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const neededBy = typeof body.neededBy === "string" ? body.neededBy : "";
    const notes = typeof body.notes === "string" ? body.notes.trim() : null;
    const requestType =
      typeof body.requestType === "string" && body.requestType.trim()
        ? body.requestType.trim()
        : "vr_simulation";

    const itemsArray = Array.isArray(body.items)
      ? (body.items as unknown[])
          .filter((item) => typeof item === "string" && !!item.trim())
          .map((item) => (item as string).trim())
      : [];

    if (!subject) {
      return NextResponse.json({ error: "Missing subject" }, { status: 400 });
    }
    if (!itemsArray.length) {
      return NextResponse.json({ error: "Select at least one item" }, { status: 400 });
    }
    if (!neededBy) {
      return NextResponse.json({ error: "Missing neededBy date" }, { status: 400 });
    }

    const payload = {
      teacher_id: teacher.id,
      teacher_name:
        (teacher.user_metadata?.full_name as string | undefined) ?? teacher.email ?? "Teacher",
      subject,
      items: itemsArray,
      needed_by: neededBy,
      notes: notes || null,
      status: "pending",
      request_type: requestType,
    };

    const { error: insertError } = await supabaseAdmin.from("teacher_requests").insert(payload);
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
