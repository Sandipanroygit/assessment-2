"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";

type TeacherRequest = {
  id: string;
  teacher_id?: string | null;
  teacher_name?: string | null;
  subject?: string | null;
  items?: string[] | null;
  needed_by?: string | null;
  notes?: string | null;
  status?: string | null;
  request_type?: string | null;
  created_at?: string | null;
};

const formatJoinedDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString() : "-");
const shortId = (id: string) => (id.length <= 8 ? id : `${id.slice(0, 6)}...${id.slice(-4)}`);

export default function AdminTeacherRequestsPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authStatus, setAuthStatus] = useState<string | null>(null);
  const [teacherRequests, setTeacherRequests] = useState<TeacherRequest[]>([]);
  const [teacherRequestStatus, setTeacherRequestStatus] = useState<string | null>(null);
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);

  const loadProfileFromSession = useCallback(
    async (session: Session | null) => {
      setCheckingAuth(true);
      if (!session) {
        setAuthStatus("Please sign in to access teacher requests.");
        setIsAdmin(false);
        setCheckingAuth(false);
        return;
      }
      const user = session.user;
      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (error) {
        setAuthStatus(`Unable to verify admin access: ${error.message}`);
        setIsAdmin(false);
        setCheckingAuth(false);
        return;
      }
      const roleFromProfile = profileData?.role ?? "customer";
      const nextIsAdmin = roleFromProfile === "admin";
      setIsAdmin(nextIsAdmin);
      setAuthStatus(
        nextIsAdmin
          ? null
          : "Admin access is required. Ask an admin to upgrade your role or run `npm run seed:admin` to create an admin account.",
      );
      if (!nextIsAdmin) {
        router.push("/admin");
      }
      setCheckingAuth(false);
    },
    [router],
  );

  useEffect(() => {
    const prime = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setAuthStatus(`Unable to verify session: ${error.message}`);
        setIsAdmin(false);
        setCheckingAuth(false);
        return;
      }
      await loadProfileFromSession(data.session);
    };
    void prime();
  }, [loadProfileFromSession]);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadProfileFromSession(session);
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, [loadProfileFromSession]);

  const loadTeacherRequests = useCallback(async () => {
    if (!isAdmin) return;
    setTeacherRequestStatus("Loading teacher requests...");
    try {
      const { data, error } = await supabase
        .from("teacher_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) {
        setTeacherRequestStatus(error.message);
        setTeacherRequests([]);
        return;
      }
      setTeacherRequests(data ?? []);
      setTeacherRequestStatus(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load teacher requests";
      setTeacherRequestStatus(message);
      setTeacherRequests([]);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    void loadTeacherRequests();
  }, [isAdmin, loadTeacherRequests]);

  const updateTeacherRequestStatus = useCallback(
    async (id: string, nextStatus: string) => {
      if (!isAdmin) return;
      setUpdatingRequestId(id);
      try {
        const { error } = await supabase.from("teacher_requests").update({ status: nextStatus }).eq("id", id);
        if (error) {
          setTeacherRequestStatus(error.message);
          return;
        }
        setTeacherRequests((prev) => prev.map((req) => (req.id === id ? { ...req, status: nextStatus } : req)));
        setTeacherRequestStatus(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to update request";
        setTeacherRequestStatus(message);
      } finally {
        setUpdatingRequestId(null);
      }
    },
    [isAdmin],
  );

  return (
    <main className="section-padding space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-accent-strong uppercase text-xs tracking-[0.2em]">Admin</p>
          <h1 className="text-3xl font-semibold text-white">Teacher Requests</h1>
          <p className="text-slate-300 text-sm mt-2">
            Review and action teacher VR simulation requests without leaving the control room.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin"
            className="px-4 py-2 rounded-xl border border-white/10 text-sm text-slate-900 hover:border-accent-strong"
          >
            Back to Dashboard
          </Link>
          <button
            className="text-sm px-3 py-2 rounded-lg border border-white/15 text-white hover:border-accent-strong"
            onClick={() => void loadTeacherRequests()}
            disabled={!isAdmin}
          >
            Refresh
          </button>
        </div>
      </div>

      {authStatus && !checkingAuth && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {authStatus}
        </div>
      )}

      {isAdmin && (
        <div className="glass-panel rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-accent-strong">Teacher requests</p>
              <h2 className="text-lg font-semibold text-white">VR simulations and add-ons</h2>
            </div>
          </div>

          {teacherRequestStatus && (
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
              {teacherRequestStatus}
            </div>
          )}

          <div className="overflow-auto">
            <table className="min-w-full text-sm text-slate-200">
              <thead>
                <tr className="text-left text-slate-400 border-b border-white/10">
                  <th className="py-2 pr-3">Teacher</th>
                  <th className="py-2 pr-3">Subject</th>
                  <th className="py-2 pr-3">Requested items</th>
                  <th className="py-2 pr-3">Needed by</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Notes</th>
                  <th className="py-2 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {teacherRequests.length === 0 ? (
                  <tr className="border-b border-white/5">
                    <td className="py-2 pr-3 text-slate-300" colSpan={7}>
                      No teacher requests yet.
                    </td>
                  </tr>
                ) : (
                  teacherRequests.map((req) => (
                    <tr key={req.id} className="border-b border-white/5">
                      <td className="py-2 pr-3">
                        <div className="font-semibold text-white">{req.teacher_name ?? "Teacher"}</div>
                        {req.teacher_id && <div className="text-xs text-slate-400">{shortId(req.teacher_id)}</div>}
                      </td>
                      <td className="py-2 pr-3 text-slate-300">{req.subject ?? "-"}</td>
                      <td className="py-2 pr-3 text-slate-300">
                        <div className="space-y-1">
                          {(req.items ?? []).slice(0, 3).map((item) => (
                            <div key={item} className="text-xs text-slate-200">
                              {item}
                            </div>
                          ))}
                          {req.items && req.items.length > 3 && (
                            <div className="text-[11px] text-slate-400">+{req.items.length - 3} more</div>
                          )}
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-slate-300">{req.needed_by ? formatJoinedDate(req.needed_by) : "-"}</td>
                      <td className="py-2 pr-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold border ${
                            (req.status ?? "pending") === "done"
                              ? "bg-emerald-600/80 border-emerald-300 text-white"
                              : "bg-amber-600/70 border-amber-300 text-white"
                          }`}
                        >
                          {req.status ?? "pending"}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-slate-300">{req.notes ?? "—"}</td>
                      <td className="py-2 pr-3">
                        <div className="flex gap-2">
                          <button
                            className="px-3 py-1 rounded-lg bg-white/10 border border-white/15 text-white text-xs hover:border-accent-strong disabled:opacity-50"
                            onClick={() => void updateTeacherRequestStatus(req.id, req.status === "done" ? "pending" : "done")}
                            disabled={updatingRequestId === req.id}
                          >
                            {updatingRequestId === req.id ? "Saving..." : req.status === "done" ? "Mark pending" : "Mark done"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
