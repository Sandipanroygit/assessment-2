import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin =
  SUPABASE_URL && SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY) : null;

export async function POST(req: Request) {
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

  let body: { moduleId?: string; published?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const moduleId = body.moduleId?.trim();
  const published = body.published ?? true;

  if (!moduleId) {
    return NextResponse.json({ error: "moduleId is required" }, { status: 400 });
  }

  const userMeta = userData.user.user_metadata || {};
  const role = (userMeta.role as string | undefined)?.toLowerCase() ?? "";
  const teacherSubject = userMeta.subject as string | undefined;
  if (role !== "teacher") {
    return NextResponse.json({ error: "Only teachers can publish" }, { status: 403 });
  }

  // Ensure the module belongs to the teacher's subject (if provided)
  const { data: moduleRow, error: moduleError } = await supabaseAdmin
    .from("curriculum_modules")
    .select("id, subject")
    .eq("id", moduleId)
    .maybeSingle();

  if (moduleError) {
    return NextResponse.json({ error: moduleError.message }, { status: 500 });
  }
  if (!moduleRow) {
    return NextResponse.json({ error: "Module not found" }, { status: 404 });
  }
  if (teacherSubject && moduleRow.subject !== teacherSubject) {
    return NextResponse.json({ error: "Cannot publish modules outside your subject" }, { status: 403 });
  }

  const { error: updateError } = await supabaseAdmin
    .from("curriculum_modules")
    .update({ published })
    .eq("id", moduleId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, published });
}
