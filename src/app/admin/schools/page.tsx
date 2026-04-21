"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";

type SchoolRow = {
  id: string;
  network_name: string;
  branch_name: string;
  display_name: string;
  sort_order: number;
  active: boolean;
  created_at?: string | null;
};
type AdminUser = {
  id: string;
  full_name: string;
  role: string;
  email?: string | null;
  grade?: string | null;
  subject?: string | null;
  school_name?: string | null;
  approval_status?: "pending" | "approved" | string | null;
  created_at?: string | null;
};
type UserEditForm = {
  full_name: string;
  role: string;
  grade: string;
  subject: string;
  school_name: string;
  approval_status: "pending" | "approved";
};
const DEFAULT_LEGACY_SCHOOL_NAME = "10X International School, Bangalore";
const subjectOptions = ["Physics", "Mathematics", "Computer Science", "Environment System & Society (ESS)", "Design Technology"];

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString() : "-");
const mapRoleLabel = (role?: string | null) => {
  const normalized = (role ?? "").trim().toLowerCase();
  if (normalized === "admin") return "Admin";
  if (normalized === "teacher") return "Teacher";
  if (normalized === "student" || normalized === "customer") return "Student";
  return "User";
};
const mapApprovalLabel = (value?: string | null) =>
  (value ?? "").trim().toLowerCase() === "approved" ? "Approved" : "Pending";

export default function AdminSchoolsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const schoolFromQuery = (searchParams.get("school") ?? "").trim();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authStatus, setAuthStatus] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [userEditForm, setUserEditForm] = useState<UserEditForm>({
    full_name: "",
    role: "student",
    grade: "",
    subject: subjectOptions[0],
    school_name: DEFAULT_LEGACY_SCHOOL_NAME,
    approval_status: "pending",
  });
  const [selectedSchoolName, setSelectedSchoolName] = useState<string>(
    schoolFromQuery || DEFAULT_LEGACY_SCHOOL_NAME,
  );
  const [newSchool, setNewSchool] = useState({
    network_name: "Indus International Schools",
    branch_name: "",
    display_name: "",
    active: true,
  });

  const loadProfileFromSession = useCallback(
    async (session: Session | null) => {
      setCheckingAuth(true);
      if (!session) {
        setAuthStatus("Please sign in to access schools.");
        setSessionToken(null);
        setIsAdmin(false);
        setCheckingAuth(false);
        return;
      }

      setSessionToken(session.access_token);
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

      const nextIsAdmin = (profileData?.role ?? "").toLowerCase() === "admin";
      setIsAdmin(nextIsAdmin);
      setAuthStatus(nextIsAdmin ? null : "Admin access is required.");
      if (!nextIsAdmin) router.push("/admin");
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
    return () => data.subscription.unsubscribe();
  }, [loadProfileFromSession]);

  const loadSchools = useCallback(async () => {
    if (!sessionToken) return;
    setLoading(true);
    setStatus("Loading schools...");
    try {
      const response = await fetch("/api/admin/schools", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        cache: "no-store",
      });
      const body = (await response.json().catch(() => ({}))) as { schools?: SchoolRow[]; error?: string };
      if (!response.ok) {
        setStatus(body.error ?? "Unable to load schools.");
        setSchools([]);
        return;
      }
      const nextSchools = Array.isArray(body.schools) ? body.schools : [];
      setSchools(nextSchools);
      if (nextSchools.length > 0) {
        const desired = selectedSchoolName || schoolFromQuery;
        const hasDesired = nextSchools.some((school) => school.display_name === desired);
        if (hasDesired) {
          setSelectedSchoolName(desired);
        } else {
          setSelectedSchoolName(nextSchools[0].display_name);
        }
      }
      setStatus(null);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Unable to load schools.");
      setSchools([]);
    } finally {
      setLoading(false);
    }
  }, [schoolFromQuery, selectedSchoolName, sessionToken]);

  const loadUsers = useCallback(async () => {
    if (!sessionToken) return;
    try {
      const response = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      const body = (await response.json().catch(() => ({}))) as { users?: AdminUser[]; error?: string };
      if (!response.ok) {
        setStatus(body.error ?? "Unable to load users.");
        setUsers([]);
        return;
      }
      const normalized = (body.users ?? []).map((user) => ({
        ...user,
        school_name:
          user.school_name
          ?? (["teacher", "student", "customer"].includes((user.role ?? "").toLowerCase())
            ? DEFAULT_LEGACY_SCHOOL_NAME
            : null),
      }));
      setUsers(normalized);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Unable to load users.");
      setUsers([]);
    }
  }, [sessionToken]);

  useEffect(() => {
    if (!isAdmin || !sessionToken) return;
    void loadSchools();
    void loadUsers();
  }, [isAdmin, sessionToken, loadSchools, loadUsers]);

  const usersForSelectedSchool = useMemo(() => {
    const normalizedSchool = selectedSchoolName.trim().toLowerCase();
    if (!normalizedSchool) return [] as AdminUser[];
    return users.filter((user) => {
      const role = (user.role ?? "").toLowerCase();
      if (role !== "teacher" && role !== "student" && role !== "customer") return false;
      return (user.school_name ?? DEFAULT_LEGACY_SCHOOL_NAME).trim().toLowerCase() === normalizedSchool;
    });
  }, [selectedSchoolName, users]);

  const updateUserApproval = useCallback(
    async (user: AdminUser, nextApprovalStatus: "pending" | "approved") => {
      if (!sessionToken) return;
      setUpdatingUserId(user.id);
      try {
        const response = await fetch("/api/admin/users", {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: user.id,
            full_name: (user.full_name ?? "").trim(),
            role: (user.role ?? "student").toLowerCase(),
            grade: (user.role ?? "").toLowerCase() === "student" ? (user.grade ?? null) : null,
            subject: (user.role ?? "").toLowerCase() === "teacher" ? (user.subject ?? null) : null,
            school_name: user.school_name ?? null,
            approval_status: nextApprovalStatus,
          }),
        });
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          setStatus(body.error ?? `Unable to update approval (status ${response.status}).`);
          return;
        }

        setUsers((prev) =>
          prev.map((row) =>
            row.id === user.id ? { ...row, approval_status: nextApprovalStatus } : row,
          ),
        );
        setStatus(null);
      } catch (err) {
        setStatus(err instanceof Error ? err.message : "Unable to update approval.");
      } finally {
        setUpdatingUserId(null);
      }
    },
    [sessionToken],
  );

  const openEditUser = useCallback((user: AdminUser) => {
    setEditingUser(user);
    setUserEditForm({
      full_name: user.full_name ?? "",
      role: (user.role ?? "student").toLowerCase(),
      grade: user.grade ?? "",
      subject: user.subject ?? subjectOptions[0],
      school_name: user.school_name ?? DEFAULT_LEGACY_SCHOOL_NAME,
      approval_status: (user.approval_status ?? "pending").toLowerCase() === "approved" ? "approved" : "pending",
    });
  }, []);

  const saveUserProfile = useCallback(async () => {
    if (!sessionToken || !editingUser) return;
    setUpdatingUserId(editingUser.id);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editingUser.id,
          full_name: userEditForm.full_name.trim(),
          role: userEditForm.role,
          grade: userEditForm.role === "student" ? userEditForm.grade.trim() || null : null,
          subject: userEditForm.role === "teacher" ? userEditForm.subject.trim() || subjectOptions[0] : null,
          school_name: userEditForm.school_name.trim() || DEFAULT_LEGACY_SCHOOL_NAME,
          approval_status: userEditForm.approval_status,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setStatus(body.error ?? `Unable to save profile (status ${response.status}).`);
        return;
      }

      setUsers((prev) =>
        prev.map((user) =>
          user.id === editingUser.id
            ? {
                ...user,
                full_name: userEditForm.full_name.trim(),
                role: userEditForm.role,
                grade: userEditForm.role === "student" ? userEditForm.grade.trim() || null : null,
                subject: userEditForm.role === "teacher" ? userEditForm.subject.trim() || subjectOptions[0] : null,
                school_name: userEditForm.school_name.trim() || DEFAULT_LEGACY_SCHOOL_NAME,
                approval_status: userEditForm.approval_status,
              }
            : user,
        ),
      );
      setStatus(null);
      setEditingUser(null);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Unable to save profile.");
    } finally {
      setUpdatingUserId(null);
    }
  }, [editingUser, sessionToken, userEditForm]);

  const handleCreate = useCallback(async () => {
    if (!sessionToken) return;
    if (!newSchool.network_name.trim() || !newSchool.branch_name.trim() || !newSchool.display_name.trim()) {
      setStatus("Network, branch, and display name are required.");
      return;
    }
    setSavingId("new");
    setStatus("Adding school...");
    try {
      const response = await fetch("/api/admin/schools", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          networkName: newSchool.network_name,
          branchName: newSchool.branch_name,
          displayName: newSchool.display_name,
          sortOrder: 100,
          active: newSchool.active,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as { school?: SchoolRow; error?: string };
      if (!response.ok || !body.school) {
        setStatus(body.error ?? "Unable to add school.");
        return;
      }
      const createdSchool = body.school;
      setSchools((prev) =>
        [...prev, createdSchool].sort(
          (a, b) => a.sort_order - b.sort_order || a.display_name.localeCompare(b.display_name),
        ),
      );
      setNewSchool((prev) => ({ ...prev, branch_name: "", display_name: "" }));
      setStatus("School added.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Unable to add school.");
    } finally {
      setSavingId(null);
    }
  }, [newSchool, sessionToken]);

  const toggleActive = useCallback(
    async (school: SchoolRow) => {
      if (!sessionToken) return;
      setSavingId(school.id);
      try {
        const response = await fetch("/api/admin/schools", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({ id: school.id, active: !school.active }),
        });
        const body = (await response.json().catch(() => ({}))) as { school?: SchoolRow; error?: string };
        if (!response.ok || !body.school) {
          setStatus(body.error ?? "Unable to update school.");
          return;
        }
        const updatedSchool = body.school;
        setSchools((prev) => prev.map((item) => (item.id === school.id ? updatedSchool : item)));
        setStatus(null);
      } catch (err) {
        setStatus(err instanceof Error ? err.message : "Unable to update school.");
      } finally {
        setSavingId(null);
      }
    },
    [sessionToken],
  );

  const removeSchool = useCallback(
    async (school: SchoolRow) => {
      if (!sessionToken) return;
      setSavingId(school.id);
      try {
        const response = await fetch("/api/admin/schools", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({ id: school.id }),
        });
        const body = (await response.json().catch(() => ({}))) as { success?: boolean; error?: string };
        if (!response.ok || !body.success) {
          setStatus(body.error ?? "Unable to delete school.");
          return;
        }
        setSchools((prev) => prev.filter((item) => item.id !== school.id));
        setStatus(null);
      } catch (err) {
        setStatus(err instanceof Error ? err.message : "Unable to delete school.");
      } finally {
        setSavingId(null);
      }
    },
    [sessionToken],
  );

  return (
    <main className="section-padding space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-accent-strong uppercase text-xs tracking-[0.2em]">Admin</p>
          <h1 className="text-3xl font-semibold text-white">Schools</h1>
          <p className="text-slate-300 text-sm mt-2">
            Manage all branches used in signup and school-wise student/teacher separation.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin"
            className="px-4 py-2 rounded-xl border border-emerald-300 bg-emerald-700 text-sm text-true-white hover:bg-emerald-600"
          >
            Back to Dashboard
          </Link>
          <button
            className="text-sm px-3 py-2 rounded-lg border border-emerald-300 bg-emerald-700 text-true-white hover:bg-emerald-600 disabled:opacity-60"
            onClick={() => {
              void loadSchools();
              void loadUsers();
            }}
            disabled={!isAdmin || loading}
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
        <>
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <p className="text-xs uppercase tracking-[0.16em] text-accent-strong">Add school</p>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <label className="block text-sm text-slate-300 space-y-2">
                Network
                <select
                  value={newSchool.network_name}
                  onChange={(e) => setNewSchool((prev) => ({ ...prev, network_name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-400/60 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none"
                >
                  <option value="Indus International Schools" className="text-black">
                    Indus International Schools
                  </option>
                  <option value="10X International Schools" className="text-black">
                    10X International Schools
                  </option>
                </select>
              </label>
              <label className="block text-sm text-slate-300 space-y-2">
                Branch
                <input
                  value={newSchool.branch_name}
                  onChange={(e) => setNewSchool((prev) => ({ ...prev, branch_name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-400/60 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none"
                />
              </label>
              <label className="block text-sm text-slate-300 space-y-2 lg:col-span-2">
                Display name
                <input
                  value={newSchool.display_name}
                  onChange={(e) => setNewSchool((prev) => ({ ...prev, display_name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-400/60 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none"
                />
              </label>
            </div>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={newSchool.active}
                  onChange={(e) => setNewSchool((prev) => ({ ...prev, active: e.target.checked }))}
                />
                Active
              </label>
              <button
                className="px-4 py-2 rounded-xl bg-accent text-true-white font-semibold shadow-glow hover:translate-y-[-1px] transition-transform disabled:opacity-60"
                onClick={() => void handleCreate()}
                disabled={savingId === "new"}
              >
                {savingId === "new" ? "Adding..." : "Add School"}
              </button>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.16em] text-accent-strong">All schools</p>
              <p className="text-xs text-slate-400">{schools.length} total</p>
            </div>
            {status && (
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                {status}
              </div>
            )}
            <div className="overflow-auto">
              <table className="table-v1">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-white/10">
                    <th className="py-2 pr-3">Network</th>
                    <th className="py-2 pr-3">Branch</th>
                    <th className="py-2 pr-3">Display name</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Created</th>
                    <th className="py-2 pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {schools.length === 0 ? (
                    <tr className="border-b border-white/5">
                      <td className="py-2 pr-3 text-slate-300" colSpan={7}>
                        No schools configured yet.
                      </td>
                    </tr>
                  ) : (
                    schools.map((school) => (
                      <tr key={school.id} className="border-b border-white/5">
                        <td className="py-2 pr-3 text-slate-200">{school.network_name}</td>
                        <td className="py-2 pr-3 text-slate-200">{school.branch_name}</td>
                        <td className="py-2 pr-3 text-slate-200">{school.display_name}</td>
                        <td className="py-2 pr-3">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold border ${
                              school.active
                                ? "bg-emerald-600/80 border-emerald-300 text-white"
                                : "bg-slate-600/70 border-slate-300 text-white"
                            }`}
                          >
                            {school.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-slate-300">{formatDate(school.created_at)}</td>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          <div className="flex flex-nowrap gap-2">
                            <button
                              className={`shrink-0 px-3 py-1 rounded-lg text-xs font-semibold border text-true-white disabled:opacity-60 ${
                                school.active
                                  ? "border-amber-300 bg-amber-700 hover:bg-amber-600"
                                  : "border-emerald-300 bg-emerald-700 hover:bg-emerald-600"
                              }`}
                              onClick={() => void toggleActive(school)}
                              disabled={savingId === school.id}
                            >
                              {savingId === school.id ? "Saving..." : school.active ? "Disable" : "Enable"}
                            </button>
                            <button
                              className="shrink-0 px-3 py-1 rounded-lg text-xs font-semibold border border-rose-300 bg-rose-700 text-true-white hover:bg-rose-600 disabled:opacity-60"
                              onClick={() => void removeSchool(school)}
                              disabled={savingId === school.id}
                            >
                              Delete
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

          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-lg font-semibold text-white">Registered Users by School</h2>
              <label className="text-sm text-slate-300 flex items-center gap-2">
                School
                <select
                  value={selectedSchoolName}
                  onChange={(e) => setSelectedSchoolName(e.target.value)}
                  className="rounded-xl border border-slate-400/60 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none"
                >
                  {schools.map((school) => (
                    <option key={school.id} value={school.display_name} className="text-black">
                      {school.display_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="text-xs text-slate-300">
              Teachers: {usersForSelectedSchool.filter((user) => (user.role ?? "").toLowerCase() === "teacher").length}
              {" · "}
              Students: {usersForSelectedSchool.filter((user) => ["student", "customer"].includes((user.role ?? "").toLowerCase())).length}
            </div>
            <div className="overflow-auto">
              <table className="table-v1">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-white/10">
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Role</th>
                    <th className="py-2 pr-3">Approval</th>
                    <th className="py-2 pr-3">Grade</th>
                    <th className="py-2 pr-3">Subject</th>
                    <th className="py-2 pr-3">Joined</th>
                    <th className="py-2 pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {usersForSelectedSchool.length === 0 ? (
                    <tr className="border-b border-white/5">
                      <td className="py-2 pr-3 text-slate-300" colSpan={7}>
                        No registered users found for this school.
                      </td>
                    </tr>
                  ) : (
                    usersForSelectedSchool.map((user) => {
                      const isTeacher = (user.role ?? "").toLowerCase() === "teacher";
                      return (
                      <tr
                        key={user.id}
                        className={`border-b border-white/5 ${isTeacher ? "!bg-sky-300/30" : ""}`}
                      >
                        <td className="py-2 pr-3 text-slate-200">{user.full_name}</td>
                        <td className="py-2 pr-3 text-slate-300">{mapRoleLabel(user.role)}</td>
                        <td className="py-2 pr-3 text-slate-300">{mapApprovalLabel(user.approval_status)}</td>
                        <td className="py-2 pr-3 text-slate-300">{user.grade ?? "—"}</td>
                        <td className="py-2 pr-3 text-slate-300">{user.subject ?? "—"}</td>
                        <td className="py-2 pr-3 text-slate-300">{formatDate(user.created_at)}</td>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          <div className="flex flex-nowrap gap-2">
                            <button
                              className={`min-w-[92px] px-3 py-1 rounded-lg text-xs font-semibold border text-true-white disabled:opacity-60 ${
                                (user.approval_status ?? "").toLowerCase() === "approved"
                                  ? "border-amber-300 bg-amber-700 hover:bg-amber-600"
                                  : "border-emerald-300 bg-emerald-700 hover:bg-emerald-600"
                              }`}
                              onClick={() =>
                                void updateUserApproval(
                                  user,
                                  (user.approval_status ?? "").toLowerCase() === "approved" ? "pending" : "approved",
                                )
                              }
                              disabled={updatingUserId === user.id}
                            >
                              {updatingUserId === user.id
                                ? "Saving..."
                                : (user.approval_status ?? "").toLowerCase() === "approved"
                                  ? "Undo"
                                  : "Approve"}
                            </button>
                            <button
                              className="min-w-[92px] px-3 py-1 rounded-lg text-xs font-semibold border border-rose-300 bg-rose-700 text-true-white hover:bg-rose-600 disabled:opacity-60"
                              onClick={() => void updateUserApproval(user, "pending")}
                              disabled={updatingUserId === user.id}
                            >
                              Reject
                            </button>
                            <button
                              className="min-w-[92px] px-3 py-1 rounded-lg text-xs font-semibold border border-sky-300 bg-sky-700 text-true-white hover:bg-sky-600 disabled:opacity-60"
                              onClick={() => openEditUser(user)}
                              disabled={updatingUserId === user.id}
                            >
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {isAdmin && editingUser && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setEditingUser(null)} />
          <div className="absolute left-1/2 top-1/2 w-[520px] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Edit user profile</h3>
              <button
                className="px-3 py-1 rounded-lg border border-white/15 text-white hover:border-accent-strong"
                onClick={() => setEditingUser(null)}
              >
                Close
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <label className="block text-sm text-slate-300 space-y-2 md:col-span-2">
                Full name
                <input
                  value={userEditForm.full_name}
                  onChange={(e) => setUserEditForm((prev) => ({ ...prev, full_name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-400/60 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none"
                />
              </label>
              <label className="block text-sm text-slate-300 space-y-2">
                Role
                <select
                  value={userEditForm.role}
                  onChange={(e) => setUserEditForm((prev) => ({ ...prev, role: e.target.value }))}
                  className="w-full rounded-xl border border-slate-400/60 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none"
                >
                  <option value="teacher" className="text-black">Teacher</option>
                  <option value="student" className="text-black">Student</option>
                  <option value="customer" className="text-black">Customer (legacy)</option>
                  <option value="admin" className="text-black">Admin</option>
                </select>
              </label>
              <label className="block text-sm text-slate-300 space-y-2">
                Approval
                <select
                  value={userEditForm.approval_status}
                  onChange={(e) => setUserEditForm((prev) => ({ ...prev, approval_status: e.target.value as "pending" | "approved" }))}
                  className="w-full rounded-xl border border-slate-400/60 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none"
                >
                  <option value="pending" className="text-black">Pending</option>
                  <option value="approved" className="text-black">Approved</option>
                </select>
              </label>
              <label className="block text-sm text-slate-300 space-y-2">
                Grade
                <input
                  value={userEditForm.grade}
                  onChange={(e) => setUserEditForm((prev) => ({ ...prev, grade: e.target.value }))}
                  disabled={userEditForm.role !== "student"}
                  className="w-full rounded-xl border border-slate-400/60 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none disabled:opacity-50"
                />
              </label>
              <label className="block text-sm text-slate-300 space-y-2">
                Subject
                <select
                  value={userEditForm.subject}
                  onChange={(e) => setUserEditForm((prev) => ({ ...prev, subject: e.target.value }))}
                  disabled={userEditForm.role !== "teacher"}
                  className="w-full rounded-xl border border-slate-400/60 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none disabled:opacity-50"
                >
                  {subjectOptions.map((option) => (
                    <option key={option} value={option} className="text-black">
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-slate-300 space-y-2 md:col-span-2">
                School
                <select
                  value={userEditForm.school_name}
                  onChange={(e) => setUserEditForm((prev) => ({ ...prev, school_name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-400/60 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none"
                >
                  {schools.map((school) => (
                    <option key={school.id} value={school.display_name} className="text-black">
                      {school.display_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                className="px-4 py-2 rounded-xl border border-emerald-300 bg-emerald-700 text-true-white hover:bg-emerald-600 disabled:opacity-60"
                onClick={() => void saveUserProfile()}
                disabled={updatingUserId === editingUser.id}
              >
                {updatingUserId === editingUser.id ? "Saving..." : "Save changes"}
              </button>
              <button
                className="px-4 py-2 rounded-xl border border-white/15 text-white hover:border-accent-strong"
                onClick={() => setEditingUser(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
