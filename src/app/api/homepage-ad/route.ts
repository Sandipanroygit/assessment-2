export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const HEADER_AD_STATE_KEY = "homepage_header_ad_config_v1";

const getClient = () => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Supabase server credentials are missing.");
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

const normalizeConfig = (value: unknown) => {
  if (!value || typeof value !== "object") return null;
  const obj = value as {
    imageUrl?: unknown;
    linkUrl?: unknown;
    layout?: unknown;
    enabled?: unknown;
  };

  const enabled = Boolean(obj.enabled);
  const imageUrl = typeof obj.imageUrl === "string" ? obj.imageUrl.trim() : "";
  const linkUrl = typeof obj.linkUrl === "string" ? obj.linkUrl.trim() : "";
  const layout = obj.layout && typeof obj.layout === "object" ? obj.layout : null;

  if (!enabled || !imageUrl) {
    return {
      imageUrl: null,
      linkUrl: null,
      layout: null,
    };
  }

  return {
    imageUrl,
    linkUrl: linkUrl || null,
    layout,
  };
};

export async function GET() {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("client_state")
      .select("value,updated_at")
      .eq("key", HEADER_AD_STATE_KEY)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ config: null });
    }

    return NextResponse.json({ config: normalizeConfig(data?.value ?? null) });
  } catch {
    return NextResponse.json({ config: null });
  }
}
