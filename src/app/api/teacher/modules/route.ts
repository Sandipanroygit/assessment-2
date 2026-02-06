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
    return NextResponse.json({ error: "Only teachers can view" }, { status: 403 });
  }

  const subject = (userData.user.user_metadata?.subject as string | undefined) ?? null;
  const grade = (userData.user.user_metadata?.grade as string | undefined) ?? null;

  let query = supabaseAdmin
    .from("curriculum_modules")
    .select("id,title,grade,subject,module,description,asset_urls,price_yearly,published,created_at")
    .order("created_at", { ascending: false });

  if (subject) query = query.eq("subject", subject);
  if (grade) query = query.eq("grade", grade);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ modules: data ?? [] });
}
