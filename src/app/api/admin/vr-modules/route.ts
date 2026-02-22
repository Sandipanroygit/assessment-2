import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { normalizeVrSubjectKey } from "@/lib/vrModules";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type VrModuleRow = {
  id: string;
  subject: string;
  module_name: string;
  created_at?: string | null;
};

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

const isMissingVrModulesTableError = (message: string) => {
  const lower = message.toLowerCase();
  return (
    lower.includes("vr_modules") &&
    (lower.includes("schema cache") || lower.includes("relation") || lower.includes("could not find the table"))
  );
};

const applyPatchHint = " Apply `supabase/vr_modules_patch.sql` in Supabase SQL Editor.";

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
      .from("vr_modules")
      .select("id,subject,module_name,created_at")
      .order("subject", { ascending: true })
      .order("module_name", { ascending: true });

    if (error) {
      const hint = isMissingVrModulesTableError(error.message) ? applyPatchHint : "";
      return NextResponse.json({ error: `${error.message}${hint}` }, { status: 500 });
    }

    return NextResponse.json({ modules: (data ?? []) as VrModuleRow[] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to load VR modules.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin(req);
    if ("error" in auth) return auth.error;

    const body = (await req.json().catch(() => ({}))) as {
      subject?: string;
      moduleName?: string;
    };

    const subject = normalizeVrSubjectKey(body.subject ?? null);
    const moduleName = typeof body.moduleName === "string" ? body.moduleName.trim() : "";

    if (!subject) {
      return NextResponse.json({ error: "Invalid or missing subject" }, { status: 400 });
    }
    if (!moduleName) {
      return NextResponse.json({ error: "Module name is required" }, { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from("vr_modules")
      .insert({
        subject,
        module_name: moduleName,
        created_by: auth.userId,
      })
      .select("id,subject,module_name,created_at")
      .single();

    if (error) {
      if ((error as { code?: string }).code === "23505") {
        return NextResponse.json({ error: "Module already exists for this subject." }, { status: 409 });
      }
      const hint = isMissingVrModulesTableError(error.message) ? applyPatchHint : "";
      return NextResponse.json({ error: `${error.message}${hint}` }, { status: 500 });
    }

    return NextResponse.json({ module: data as VrModuleRow });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to add VR module.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireAdmin(req);
    if ("error" in auth) return auth.error;

    const body = (await req.json().catch(() => ({}))) as {
      id?: string;
      moduleName?: string;
    };

    const id = typeof body.id === "string" ? body.id.trim() : "";
    const moduleName = typeof body.moduleName === "string" ? body.moduleName.trim() : "";

    if (!id) {
      return NextResponse.json({ error: "Module id is required" }, { status: 400 });
    }
    if (!moduleName) {
      return NextResponse.json({ error: "Module name is required" }, { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from("vr_modules")
      .update({ module_name: moduleName })
      .eq("id", id)
      .select("id,subject,module_name,created_at")
      .maybeSingle();

    if (error) {
      if ((error as { code?: string }).code === "23505") {
        return NextResponse.json({ error: "Module already exists for this subject." }, { status: 409 });
      }
      const hint = isMissingVrModulesTableError(error.message) ? applyPatchHint : "";
      return NextResponse.json({ error: `${error.message}${hint}` }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Module not found." }, { status: 404 });
    }

    return NextResponse.json({ module: data as VrModuleRow });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to update VR module.";
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
      return NextResponse.json({ error: "Module id is required" }, { status: 400 });
    }

    const { error, count } = await auth.supabase
      .from("vr_modules")
      .delete({ count: "exact" })
      .eq("id", id);

    if (error) {
      const hint = isMissingVrModulesTableError(error.message) ? applyPatchHint : "";
      return NextResponse.json({ error: `${error.message}${hint}` }, { status: 500 });
    }

    if (!count) {
      return NextResponse.json({ error: "Module not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to delete VR module.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
