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
    return NextResponse.json({ error: "Only teachers can view students" }, { status: 403 });
  }

  const teacherSubject = (userData.user.user_metadata?.subject as string | undefined) ?? null;

  // Prefer auth metadata for student list; fallback to profiles.
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
    .filter((u) => {
      if (!teacherSubject) return true;
      return u.subject ? u.subject === teacherSubject : true;
    });

  return NextResponse.json({ students });
}
