import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let cachedClient: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient | null => {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  if (cachedClient) return cachedClient;
  // Use a loose cast to avoid TypeScript DOM lib issues in server builds
  const storage =
    typeof window !== "undefined"
      ? (window as any).localStorage ?? (window as any).sessionStorage
      : undefined;
  cachedClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return cachedClient;
};

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error(
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment.",
      );
    }
    return (client as unknown as Record<PropertyKey, unknown>)[prop];
  },
});
