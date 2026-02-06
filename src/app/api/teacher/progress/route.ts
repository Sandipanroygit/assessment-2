import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin =
  SUPABASE_URL && SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY) : null;

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
    return NextResponse.json({ error: "Only teachers can view progress" }, { status: 403 });
  }

  const subject = (userData.user.user_metadata?.subject as string | undefined) ?? null;

  // Modules (published only) in teacher subject
  let moduleQuery = supabaseAdmin
    .from("curriculum_modules")
    .select("id,title,grade,subject,published")
    .eq("published", true);
  if (subject) moduleQuery = moduleQuery.eq("subject", subject);
  const { data: modules, error: modulesError } = await moduleQuery;
  if (modulesError) {
    return NextResponse.json({ error: modulesError.message }, { status: 500 });
  }

  // Students (auth metadata)
  const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 500,
  });
  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }
  const students = (listData.users ?? [])
    .filter((u) => ((u.user_metadata?.role as string | undefined)?.toLowerCase() ?? "") === "student")
    .map((u) => ({
      id: u.id,
      email: u.email,
      full_name: (u.user_metadata?.full_name as string | undefined) ?? u.email ?? "Student",
      grade: (u.user_metadata?.grade as string | undefined) ?? null,
      subject: (u.user_metadata?.subject as string | undefined) ?? null,
    }))
    .filter((s) => {
      if (!subject) return true;
      return !s.subject || s.subject === subject; // show students without subject or matching subject
    });

  const moduleIds = (modules ?? []).map((m) => m.id);
  const { data: submissions, error: subError } = await supabaseAdmin
    .from("activity_submissions")
    .select(
      `
        id,
        module_id,
        user_id,
        submission_number,
        report_status,
        report_json,
        created_at,
        updated_at
      `,
    )
    .in("module_id", moduleIds.length ? moduleIds : ["00000000-0000-0000-0000-000000000000"])
    .order("updated_at", { ascending: false });
  if (subError) {
    return NextResponse.json({ error: subError.message }, { status: 500 });
  }

  return NextResponse.json({
    modules: modules ?? [],
    submissions: submissions ?? [],
    students,
  });
}
