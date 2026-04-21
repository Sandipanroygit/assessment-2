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

const isMissingSchoolsTableError = (message: string) => {
  const lower = message.toLowerCase();
  return (
    lower.includes("schools")
    && (lower.includes("schema cache") || lower.includes("relation") || lower.includes("could not find the table"))
  );
};

const applyPatchHint = " Apply `supabase/schools_patch.sql` in Supabase SQL Editor.";

export async function GET() {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const { data, error } = await supabaseAdmin
      .from("schools")
      .select("id,network_name,branch_name,display_name")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("display_name", { ascending: true });

    if (error) {
      const hint = isMissingSchoolsTableError(error.message) ? applyPatchHint : "";
      return NextResponse.json({ error: `${error.message}${hint}` }, { status: 500 });
    }

    return NextResponse.json({ schools: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to load schools.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

