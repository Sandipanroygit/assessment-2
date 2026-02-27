import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin =
  SUPABASE_URL && SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY) : null;

const isMissingJudgingLogicColumn = (message?: string) =>
  /judging_logic/i.test(message || "") && /(column|schema cache)/i.test(message || "");
const cleanString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;
const normalizeRole = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

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

  const metadataRole = normalizeRole(userData.user.user_metadata?.role);
  const metadataSubject = cleanString(userData.user.user_metadata?.subject);
  const metadataGrade = cleanString(userData.user.user_metadata?.grade);

  let profileRole: string | null = null;
  let profileGrade: string | null = null;

  if (metadataRole !== "teacher" || !metadataGrade) {
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role,grade")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }
    profileRole = normalizeRole(profileData?.role) || null;
    profileGrade = cleanString(profileData?.grade);
  }

  const role = metadataRole === "teacher" ? "teacher" : profileRole ?? "";
  if (role !== "teacher") {
    return NextResponse.json({ error: "Only teachers can view" }, { status: 403 });
  }

  const subject = metadataSubject;
  const grade = metadataGrade ?? profileGrade;

  const buildQuery = (includeJudgingLogic: boolean) => {
    let query = supabaseAdmin
      .from("curriculum_modules")
      .select(
        includeJudgingLogic
          ? "id,title,grade,subject,module,description,judging_logic,asset_urls,price_yearly,published,created_at"
          : "id,title,grade,subject,module,description,asset_urls,price_yearly,published,created_at",
      )
      .order("created_at", { ascending: false });
    if (subject) query = query.eq("subject", subject);
    if (grade) query = query.eq("grade", grade);
    return query;
  };

  let { data, error } = await buildQuery(true);
  if (error && isMissingJudgingLogicColumn(error.message)) {
    ({ data, error } = await buildQuery(false));
  }
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ modules: data ?? [] });
}
