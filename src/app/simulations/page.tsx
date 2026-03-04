"use client";

import Link from "next/link";
import { SimulationLibraryView } from "@/components/admin/SimulationLibraryView";

export default function SimulationsPage() {
  return (
    <main className="min-h-screen section-padding space-y-6">
      <div className="glass-panel rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Library</p>
          <h1 className="text-2xl font-semibold text-slate-900">Simulations</h1>
        </div>
        <Link
          href="/customer"
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
        >
          Back to Dashboard
        </Link>
      </div>

      <SimulationLibraryView />
    </main>
  );
}
