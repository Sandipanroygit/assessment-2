import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  DEFAULT_VR_SIMULATION_LIBRARY,
  dedupeAndSortModuleNames,
  normalizeVrSubjectKey,
} from "@/lib/vrModules";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type VrModuleDbRow = {
  module_name?: string | null;
};

const supabaseAdmin =
  SUPABASE_URL && SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

const isMissingVrModulesTableError = (message: string) => {
  const lower = message.toLowerCase();
  return (
    lower.includes("vr_modules") &&
    (lower.includes("schema cache") || lower.includes("relation") || lower.includes("could not find the table"))
  );
};

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
    return NextResponse.json({ error: "Only teachers can view VR modules" }, { status: 403 });
  }

  const teacherSubject = (userData.user.user_metadata?.subject as string | undefined) ?? null;
  const subject = normalizeVrSubjectKey(teacherSubject);
  if (!subject) {
    return NextResponse.json({ subject: null, modules: [] as string[], source: "none" as const });
  }

  const defaultModules = DEFAULT_VR_SIMULATION_LIBRARY[subject] ?? [];
  const { data, error } = await supabaseAdmin
    .from("vr_modules")
    .select("module_name")
    .eq("subject", subject)
    .order("module_name", { ascending: true });

  if (error) {
    if (isMissingVrModulesTableError(error.message)) {
      return NextResponse.json({
        subject,
        modules: defaultModules,
        source: "fallback" as const,
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const uploadedModules = dedupeAndSortModuleNames(
    ((data ?? []) as VrModuleDbRow[]).map((row) => row.module_name ?? ""),
  );
  const mergedModules = dedupeAndSortModuleNames([...defaultModules, ...uploadedModules]);

  return NextResponse.json({
    subject,
    modules: mergedModules,
    source: "database" as const,
  });
}
