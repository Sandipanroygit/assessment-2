import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ALLOWED_STATUSES = new Set(["new", "reviewed", "closed"]);

type SalesInquiryRow = {
  id: string;
  name: string;
  email: string;
  school?: string | null;
  message: string;
  status?: string | null;
  source_page?: string | null;
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

const isMissingTableError = (message: string) =>
  message.toLowerCase().includes("sales_inquiries") &&
  (message.toLowerCase().includes("schema cache") || message.toLowerCase().includes("relation"));

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

  const role = (profile?.role as string | undefined) ?? (userData.user.user_metadata?.role as string | undefined) ?? "";
  if (role.toLowerCase() !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { supabase };
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      email?: string;
      school?: string | null;
      message?: string;
      sourcePage?: string;
    };

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const school = typeof body.school === "string" ? body.school.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const sourcePage = typeof body.sourcePage === "string" && body.sourcePage.trim() ? body.sourcePage.trim() : "home";

    if (!name || !email || !message) {
      return NextResponse.json({ error: "Name, email, and message are required." }, { status: 400 });
    }
    if (!email.includes("@") || !email.includes(".")) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    const supabase = getClient();
    const payload = {
      name,
      email,
      school: school || null,
      message,
      source_page: sourcePage,
      status: "new",
    };

    const { error: insertError } = await supabase.from("sales_inquiries").insert(payload);
    if (insertError) {
      const setupHint = isMissingTableError(insertError.message)
        ? " Apply `supabase/sales_inquiries_patch.sql` in Supabase SQL Editor."
        : "";
      return NextResponse.json({ error: `${insertError.message}${setupHint}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to submit inquiry.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const auth = await requireAdmin(req);
    if ("error" in auth) return auth.error;

    const { data, error } = await auth.supabase
      .from("sales_inquiries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) {
      const setupHint = isMissingTableError(error.message)
        ? " Apply `supabase/sales_inquiries_patch.sql` in Supabase SQL Editor."
        : "";
      return NextResponse.json({ error: `${error.message}${setupHint}` }, { status: 500 });
    }

    return NextResponse.json({ inquiries: (data ?? []) as SalesInquiryRow[] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to fetch inquiries.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireAdmin(req);
    if ("error" in auth) return auth.error;

    const body = (await req.json().catch(() => ({}))) as { id?: string; status?: string };
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const status = typeof body.status === "string" ? body.status.trim().toLowerCase() : "";

    if (!id) {
      return NextResponse.json({ error: "Missing inquiry id" }, { status: 400 });
    }
    if (!ALLOWED_STATUSES.has(status)) {
      return NextResponse.json({ error: "Status must be new, reviewed, or closed" }, { status: 400 });
    }

    const { error } = await auth.supabase
      .from("sales_inquiries")
      .update({ status })
      .eq("id", id);

    if (error) {
      const setupHint = isMissingTableError(error.message)
        ? " Apply `supabase/sales_inquiries_patch.sql` in Supabase SQL Editor."
        : "";
      return NextResponse.json({ error: `${error.message}${setupHint}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to update inquiry.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
