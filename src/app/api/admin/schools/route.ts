import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const getClient = () => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Supabase server credentials are missing.");
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

const extractToken = (req: Request) => {
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
};

const isMissingSchoolsTableError = (message: string) => {
  const lower = message.toLowerCase();
  return (
    lower.includes("schools")
    && (lower.includes("schema cache") || lower.includes("relation") || lower.includes("could not find the table"))
  );
};

const applyPatchHint = " Apply `supabase/schools_patch.sql` in Supabase SQL Editor.";

const requireAdmin = async (req: Request) => {
  const token = extractToken(req);
  if (!token) {
    return { error: NextResponse.json({ error: "Missing access token" }, { status: 401 }) };
  }

  const supabase = getClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return { error: NextResponse.json({ error: userError?.message ?? "Invalid token" }, { status: 401 }) };
  }

  const userId = userData.user.id;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  const role =
    (profile?.role as string | undefined) ?? (userData.user.user_metadata?.role as string | undefined) ?? "";
  if (role.toLowerCase() !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { supabase, userId };
};

export async function GET(req: Request) {
  try {
    const auth = await requireAdmin(req);
    if ("error" in auth) return auth.error;

    const { data, error } = await auth.supabase
      .from("schools")
      .select("id,network_name,branch_name,display_name,sort_order,active,created_at")
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

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin(req);
    if ("error" in auth) return auth.error;

    const body = (await req.json().catch(() => ({}))) as {
      networkName?: string;
      branchName?: string;
      displayName?: string;
      sortOrder?: number;
      active?: boolean;
    };
    const networkName = typeof body.networkName === "string" ? body.networkName.trim() : "";
    const branchName = typeof body.branchName === "string" ? body.branchName.trim() : "";
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
    const sortOrder = Number.isFinite(body.sortOrder) ? Number(body.sortOrder) : 100;
    const active = typeof body.active === "boolean" ? body.active : true;

    if (!networkName) return NextResponse.json({ error: "Network name is required" }, { status: 400 });
    if (!branchName) return NextResponse.json({ error: "Branch name is required" }, { status: 400 });
    if (!displayName) return NextResponse.json({ error: "Display name is required" }, { status: 400 });

    const { data, error } = await auth.supabase
      .from("schools")
      .insert({
        network_name: networkName,
        branch_name: branchName,
        display_name: displayName,
        sort_order: sortOrder,
        active,
        created_by: auth.userId,
      })
      .select("id,network_name,branch_name,display_name,sort_order,active,created_at")
      .single();

    if (error) {
      if ((error as { code?: string }).code === "23505") {
        return NextResponse.json({ error: "School already exists." }, { status: 409 });
      }
      const hint = isMissingSchoolsTableError(error.message) ? applyPatchHint : "";
      return NextResponse.json({ error: `${error.message}${hint}` }, { status: 500 });
    }

    return NextResponse.json({ school: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to add school.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireAdmin(req);
    if ("error" in auth) return auth.error;

    const body = (await req.json().catch(() => ({}))) as {
      id?: string;
      networkName?: string;
      branchName?: string;
      displayName?: string;
      sortOrder?: number;
      active?: boolean;
    };
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) return NextResponse.json({ error: "School id is required" }, { status: 400 });

    const updatePayload: Record<string, string | number | boolean> = {};
    if (typeof body.networkName === "string") updatePayload.network_name = body.networkName.trim();
    if (typeof body.branchName === "string") updatePayload.branch_name = body.branchName.trim();
    if (typeof body.displayName === "string") updatePayload.display_name = body.displayName.trim();
    if (Number.isFinite(body.sortOrder)) updatePayload.sort_order = Number(body.sortOrder);
    if (typeof body.active === "boolean") updatePayload.active = body.active;

    if (!Object.keys(updatePayload).length) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from("schools")
      .update(updatePayload)
      .eq("id", id)
      .select("id,network_name,branch_name,display_name,sort_order,active,created_at")
      .maybeSingle();

    if (error) {
      if ((error as { code?: string }).code === "23505") {
        return NextResponse.json({ error: "School already exists." }, { status: 409 });
      }
      const hint = isMissingSchoolsTableError(error.message) ? applyPatchHint : "";
      return NextResponse.json({ error: `${error.message}${hint}` }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "School not found." }, { status: 404 });
    }

    return NextResponse.json({ school: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to update school.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireAdmin(req);
    if ("error" in auth) return auth.error;

    const body = (await req.json().catch(() => ({}))) as { id?: string };
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) {
      return NextResponse.json({ error: "School id is required" }, { status: 400 });
    }

    const { error, count } = await auth.supabase
      .from("schools")
      .delete({ count: "exact" })
      .eq("id", id);

    if (error) {
      const hint = isMissingSchoolsTableError(error.message) ? applyPatchHint : "";
      return NextResponse.json({ error: `${error.message}${hint}` }, { status: 500 });
    }
    if (!count) {
      return NextResponse.json({ error: "School not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to delete school.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

