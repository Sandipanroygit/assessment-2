"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

const TABLE = "client_state";

export default function ClientStateSync() {
  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) return;

      // 1) Pull cloud -> local
      const { data: rows, error } = await supabase.from(TABLE).select("key,value");
      if (!cancelled && !error && rows) {
        rows.forEach((row) => {
          try {
            const val = typeof row.value === "string" ? row.value : JSON.stringify(row.value);
            if (val != null) {
              localStorage.setItem(row.key, val);
            }
          } catch {
            // ignore bad entries
          }
        });
      }

      // 2) Push local -> cloud (upsert)
      const entries: { user_id: string; key: string; value: unknown }[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key) continue;
        const raw = localStorage.getItem(key);
        if (raw == null) continue;
        let value: unknown = raw;
        try {
          value = JSON.parse(raw);
        } catch {
          // keep as string
        }
        entries.push({ user_id: user.id, key, value });
      }
      if (!entries.length || cancelled) return;
      await supabase.from(TABLE).upsert(entries, { onConflict: "user_id,key" });
    };

    void sync();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
