"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { logPageView } from "@/lib/activityLogger";

export default function ActivityTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    const query = searchParams?.toString();
    const fullPath = query ? `${pathname}?${query}` : pathname;
    void logPageView();
  }, [pathname, searchParams]);

  return null;
}
