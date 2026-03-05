import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin =
  SUPABASE_URL && SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY) : null;

const ASSIGNMENT_SELECT =
  "id,teacher_id,teacher_name,target_grade,target_grade_key,subject,simulation_title,simulation_url,notes,created_at,updated_at";

const normalizeRole = (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase() : "");
const isStudentLikeRole = (role: string) => role === "student" || role === "customer";
const normalizeGradeKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/grade/gi, "")
    .replace(/[^a-z0-9]+/g, "");

const extractToken = (req: Request) => {
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
};

const withTableHint = (message: string) => {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("simulation_assignments") &&
    (normalized.includes("does not exist") || normalized.includes("schema cache"))
  ) {
    return `${message} Apply \`supabase/simulation_assignments_patch.sql\` in Supabase SQL Editor.`;
  }
  return message;
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
    const roleFromMeta = normalizeRole(student.user_metadata?.role);

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role,grade")
      .eq("id", student.id)
      .maybeSingle();
    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    const roleFromProfile = normalizeRole(profile?.role);
    const role = roleFromMeta || roleFromProfile;
    if (!isStudentLikeRole(role)) {
      return NextResponse.json({ error: "Only students can view assigned simulations" }, { status: 403 });
    }

    const gradeFromMeta = (student.user_metadata?.grade as string | undefined)?.trim() ?? "";
    const gradeFromProfile = (profile?.grade ?? "").trim();
    const grade = gradeFromProfile || gradeFromMeta;

    const gradeKey = normalizeGradeKey(grade);
    if (!gradeKey) {
      return NextResponse.json({
        assignments: [],
        grade: null,
        message: "Your grade is not set. Ask your teacher/admin to update your profile.",
      });
    }

    const { data, error } = await supabaseAdmin
      .from("simulation_assignments")
      .select(ASSIGNMENT_SELECT)
      .eq("target_grade_key", gradeKey)
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) {
      return NextResponse.json({ error: withTableHint(error.message) }, { status: 500 });
    }

    return NextResponse.json({
      grade,
      assignments: data ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
