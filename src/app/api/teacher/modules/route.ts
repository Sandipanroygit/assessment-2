import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin =
  SUPABASE_URL && SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY) : null;

const isMissingJudgingLogicColumn = (message?: string) =>
  /judging_logic/i.test(message || "") && /(column|schema cache)/i.test(message || "");
const isMissingDueAtColumn = (message?: string) =>
  /due_at/i.test(message || "") && /(column|schema cache)/i.test(message || "");
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

  let profileRole: string | null = null;

  if (metadataRole !== "teacher") {
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }
    profileRole = normalizeRole(profileData?.role) || null;
  }

  const role = metadataRole === "teacher" ? "teacher" : profileRole ?? "";
  if (role !== "teacher") {
    return NextResponse.json({ error: "Only teachers can view" }, { status: 403 });
  }

  const subject = metadataSubject;

  const buildQuery = (includeJudgingLogic: boolean, includeDueAt: boolean) => {
    const selectParts = [
      "id",
      "title",
      "grade",
      "subject",
      "module",
      "description",
      "asset_urls",
      "price_yearly",
      "published",
      "created_at",
    ];
    if (includeJudgingLogic) selectParts.splice(6, 0, "judging_logic");
    if (includeDueAt) selectParts.splice(includeJudgingLogic ? 7 : 6, 0, "due_at");

    let query = supabaseAdmin
      .from("curriculum_modules")
      .select(selectParts.join(","))
      .order("created_at", { ascending: false });
    if (subject) query = query.eq("subject", subject);
    return query;
  };

  let includeJudgingLogic = true;
  let includeDueAt = true;
  let data: unknown = null;
  let error: { message: string } | null = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const result = await buildQuery(includeJudgingLogic, includeDueAt);
    data = result.data;
    error = result.error;
    if (!error) break;
    if (includeDueAt && isMissingDueAtColumn(error.message)) {
      includeDueAt = false;
      continue;
    }
    if (includeJudgingLogic && isMissingJudgingLogicColumn(error.message)) {
      includeJudgingLogic = false;
      continue;
    }
    break;
  }
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ modules: data ?? [] });
}
