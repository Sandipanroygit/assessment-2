"use client";

/* eslint-disable @typescript-eslint/no-unused-vars */

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  DragEvent,
  useCallback,
  MouseEvent,
} from "react";
import { supabase } from "@/lib/supabaseClient";
import type { CurriculumModule, Product } from "@/types";
import { useRouter } from "next/navigation";
import { dataUrlToFile, fetchCurriculumModules, fetchProducts, uploadFileToBucket } from "@/lib/supabaseData";
type AdminUser = {
  id: string;
  full_name: string;
  role: string;
  displayRole: string;
  email?: string | null;
  grade?: string | null;
  subject?: string | null;
  created_at?: string | null;
};

const orderActions = ["Track status", "View receipts", "Export reports"];

const gradeOptions = ["Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"];
const subjectOptions = ["Physics", "Mathematics", "Computer Science", "Environment System & Society (ESS)", "Design Technology"];

const isMissingTableSchemaCacheError = (message: string) =>
  message.toLowerCase().includes("schema cache") && message.toLowerCase().includes("could not find the table");

const formatPrice = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    value,
  );

const formatJoinedDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString() : "-");
const sanitizeSegment = (value: string) =>
  value.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "item";
const studentLabelFromFile = (fileName: string) => {
  const base = fileName.replace(/\.json$/i, "");
  const parts = base.split("-");
  if (parts.length > 1 && /^\d+$/.test(parts[parts.length - 1])) parts.pop();
  const label = parts.join(" ").replace(/-+/g, " ").trim();
  return label || "Student";
};
const mapRoleLabel = (role?: string | null) => {
  const normalized = (role ?? "").trim().toLowerCase();
  if (normalized === "admin") return "Admin";
  if (normalized === "teacher") return "Teacher";
  if (normalized === "student") return "Student";
  if (normalized === "customer") return "Student"; // legacy role value
  return "Student";
};
const shortId = (id: string) => (id.length <= 8 ? id : `${id.slice(0, 6)}...${id.slice(-4)}`);

type SentimentFile = {
  moduleId: string;
  moduleTitle: string;
  studentLabel: string;
  fileName: string;
  path: string;
  url: string;
  createdAt?: string | null;
};

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<string | null>(null);
  const [signingOut, startSignOut] = useTransition();
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [curriculumRows, setCurriculumRows] = useState<CurriculumModule[]>([]);
  const [productRows, setProductRows] = useState<Product[]>([]);
  const [userRows, setUserRows] = useState<AdminUser[]>([]);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [userSort, setUserSort] = useState<{ field: "name" | "role" | "subject" | "grade"; dir: "asc" | "desc" }>({
    field: "role",
    dir: "asc",
  });
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [sentimentFiles, setSentimentFiles] = useState<SentimentFile[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCurriculumId, setEditingCurriculumId] = useState<string | null>(null);
  const [deletingSentimentPath, setDeletingSentimentPath] = useState<string | null>(null);
  const curriculumEditRef = useRef<HTMLDivElement | null>(null);
  const [dataStatus, setDataStatus] = useState<string | null>(null);
  const [sentimentStatus, setSentimentStatus] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [userForm, setUserForm] = useState({ full_name: "", role: "student", grade: "", subject: "" });
  const [userEditStatus, setUserEditStatus] = useState<string | null>(null);
  const [userPopover, setUserPopover] = useState<{ top: number; left: number } | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    price: "",
    deliveryEta: "",
    expectedDelivery: "",
    stock: "",
    imageData: "",
    imageName: "",
    removeImage: false,
    galleryData: [] as string[],
    galleryNames: [] as string[],
  });
  const [curriculumForm, setCurriculumForm] = useState({
    title: "",
    grade: "",
    subject: "",
    module: "",
    description: "",
    assets: "",
  });
  const isTeacher = role === "teacher";
  const canEditCurriculum = isAdmin || isTeacher;
  const dashboardRoleLabel = isAdmin ? "Admin" : isTeacher ? "Teacher" : "User";
  const reloadUsers = useCallback(async () => {
    if (!isAdmin) return;
    setDataStatus("Refreshing users...");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setDataStatus("No active session; please sign in again.");
        return;
      }

      const response = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const message = errorBody?.error ?? `Failed to load users (status ${response.status})`;
        setDataStatus(message);
        return;
      }

      const body = (await response.json()) as { total: number; users: AdminUser[] };
        const users = (body.users ?? []).map((user) => ({
          ...user,
          full_name: user.full_name?.trim() ? user.full_name : user.email ?? "Unnamed user",
          displayRole: mapRoleLabel(user.role),
          subject: user.subject ?? null,
        }));

      setUserRows(users);
      setUserCount(body.total ?? users.length);
      setDataStatus(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to refresh users";
      setDataStatus(message);
    }
  }, [isAdmin]);
  const stats = useMemo(
    () => [
      { label: "Active modules", value: String(curriculumRows.length), delta: "Manage drone modules" },
      { label: "Products live", value: String(productRows.length), delta: "Ready in shop" },
      { label: "Orders this week", value: "0", delta: "No orders yet" },
      { label: "Registered users", value: String(userCount ?? userRows.length), delta: "Total signups to date" },
    ],
    [curriculumRows.length, productRows.length, userRows.length, userCount],
  );

  const sortedUsers = useMemo(() => {
    const copy = [...userRows];
    copy.sort((a, b) => {
      switch (userSort.field) {
        case "name": {
          const an = (a.full_name || "").toLowerCase();
          const bn = (b.full_name || "").toLowerCase();
          if (an === bn) return 0;
          return userSort.dir === "asc" ? an.localeCompare(bn) : bn.localeCompare(an);
        }
        case "role": {
          const ar = (a.displayRole || "").toLowerCase();
          const br = (b.displayRole || "").toLowerCase();
          if (ar === br) return 0;
          return userSort.dir === "asc" ? ar.localeCompare(br) : br.localeCompare(ar);
        }
        case "subject": {
          const asub = (a.subject || "").toLowerCase();
          const bsub = (b.subject || "").toLowerCase();
          if (asub === bsub) return 0;
          return userSort.dir === "asc" ? asub.localeCompare(bsub) : bsub.localeCompare(asub);
        }
        case "grade": {
          const ag = (a.grade || "").toLowerCase();
          const bg = (b.grade || "").toLowerCase();
          if (ag === bg) return 0;
          return userSort.dir === "asc" ? ag.localeCompare(bg) : bg.localeCompare(ag);
        }
        default:
          return 0;
      }
    });
    return copy;
  }, [userRows, userSort]);

  const reorderCurriculum = (sourceId: string, targetId: string) => {
    setCurriculumRows((prev) => {
      const from = prev.findIndex((item) => item.id === sourceId);
      const to = prev.findIndex((item) => item.id === targetId);
      if (from === -1 || to === -1 || from === to) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const handleDragStart = (id: string) => setDraggingId(id);
  const handleDragEnd = () => setDraggingId(null);
  const handleDragOver = (event: DragEvent<HTMLTableRowElement>) => event.preventDefault();
  const handleDropOn = (targetId: string) => {
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      return;
    }
    reorderCurriculum(draggingId, targetId);
    setDraggingId(null);
  };

  const openUserEditor = (user: AdminUser, event?: MouseEvent<HTMLButtonElement>) => {
    if (event?.currentTarget && typeof window !== "undefined") {
      const rect = event.currentTarget.getBoundingClientRect();
      const panelWidth = 420;
      const viewportWidth = window.innerWidth;
      const margin = Math.max(12, Math.min(96, (viewportWidth - panelWidth) / 5));
      const biasLeft = 140; // stronger left bias to avoid hugging right edge
      const proposedLeft = rect.left + window.scrollX + rect.width / 2 - panelWidth / 2 - biasLeft;
      const left = Math.min(
        Math.max(margin, proposedLeft),
        Math.max(margin, viewportWidth - panelWidth - margin),
      );
      const top = rect.top + window.scrollY + rect.height + 12;
      setUserPopover({ top, left });
    } else {
      setUserPopover(null);
    }
    setEditingUser(user);
    setUserForm({
      full_name: user.full_name ?? "",
      role: (user.role ?? "student").toLowerCase(),
      grade: user.grade ?? "",
      subject: user.subject ?? "",
    });
    setUserEditStatus(null);
  };

  const handleSaveUser = useCallback(async () => {
    if (!editingUser) return;
    setUserEditStatus("Saving profile...");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setUserEditStatus("No active session; please sign in again.");
        return;
      }

      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editingUser.id,
          full_name: userForm.full_name.trim(),
          role: userForm.role,
          grade: userForm.role === "student" ? userForm.grade.trim() || null : null,
          subject:
            userForm.role === "teacher"
              ? (userForm.subject.trim() || subjectOptions[0] || null)
              : null,
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = body?.error ?? `Save failed (status ${response.status})`;
        setUserEditStatus(message);
        return;
      }

      const warning = body?.profileWarning as string | null | undefined;
      if (warning) {
        setDataStatus(`Profile saved, but profile table update warned: ${warning}`);
      } else {
        setDataStatus("Profile saved.");
      }
      await reloadUsers();
      setEditingUser(null);
      setUserForm({ full_name: "", role: "student", grade: "", subject: "" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save user";
      setUserEditStatus(message);
    }
  }, [editingUser, reloadUsers, userForm.full_name, userForm.grade, userForm.role, userForm.subject]);

  useEffect(() => {
    const loadProfile = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        setAuthStatus("Please sign in to access the admin dashboard.");
        setIsAdmin(false);
        router.push("/login");
        return;
      }
      setCurrentUserId(user.id);
      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .maybeSingle();
      if (error) {
        const setupHint = isMissingTableSchemaCacheError(error.message)
          ? "Supabase tables are not created yet. Apply `supabase/schema.sql` in your Supabase SQL editor, then retry."
          : null;
        setAuthStatus(`Unable to verify admin access: ${error.message}${setupHint ? ` â€” ${setupHint}` : ""}`);
        setIsAdmin(false);
        return;
      }
      const roleFromProfile = profileData?.role ?? "customer";
      setRole(roleFromProfile);
      const nextIsAdmin = roleFromProfile === "admin";
      const nextCanEditCurriculum = nextIsAdmin || roleFromProfile === "teacher";
      setIsAdmin(nextIsAdmin);
      setAuthStatus(
        nextCanEditCurriculum
          ? null
          : "Admin or teacher access is required. Ask an admin to upgrade your role or run `npm run seed:admin` to create an admin account.",
      );
    };
    loadProfile();
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      if (!canEditCurriculum) return;
      setDataStatus("Loading shared data...");
      try {
        const [nextCurriculum, nextProducts] = await Promise.all([
          fetchCurriculumModules({ includeUnpublished: true }),
          isAdmin ? fetchProducts() : Promise.resolve([] as Product[]),
        ]);
        if (cancelled) return;

        setCurriculumRows(nextCurriculum);
        setProductRows(isAdmin ? nextProducts : []);
        if (isAdmin) {
          await reloadUsers();
        } else {
            setUserRows([]);
            setUserCount(null);
            setDataStatus(null);
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Unable to load data";
        setCurriculumRows([]);
        setProductRows([]);
        setUserRows([]);
        setUserCount(null);
        setDataStatus(`Database not reachable (${message}).`);
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, [canEditCurriculum, isAdmin, reloadUsers]);

  useEffect(() => {
    if (!isAdmin) return;

    const channel = supabase
      .channel("profiles-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        (payload) => {
          setUserRows((prev) => {
            if (payload.eventType === "DELETE") {
              const removedId = (payload.old as { id?: string })?.id;
              if (!removedId) return prev;
              setUserCount((c) => (typeof c === "number" ? Math.max(0, c - 1) : c));
              return prev.filter((u) => u.id !== removedId);
            }

            const next = payload.new as {
              id?: string;
              full_name?: string | null;
              role?: string | null;
              created_at?: string | null;
            };
            if (!next?.id) return prev;

            const entry: AdminUser = {
              id: next.id,
              full_name: next.full_name ?? "Unnamed user",
              role: next.role ?? "customer",
              displayRole: mapRoleLabel(next.role),
              created_at: next.created_at ?? null,
            };

            const existingIndex = prev.findIndex((u) => u.id === entry.id);
            if (existingIndex >= 0) {
              const copy = [...prev];
              copy[existingIndex] = { ...copy[existingIndex], ...entry };
              return copy;
            }

            setUserCount((c) => (typeof c === "number" ? c + 1 : c));
            const merged = [entry, ...prev];
            return merged.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  const handleDeleteUser = async (user: AdminUser) => {
    if (!isAdmin) {
      setDataStatus("Admin access is required to delete users.");
      return;
    }
    if (currentUserId && user.id === currentUserId) {
      setDataStatus("You cannot delete your own admin account.");
      return;
    }
    const confirmed = window.confirm(`Delete user "${user.full_name}"? This cannot be undone.`);
    if (!confirmed) return;

    setDataStatus(`Deleting ${user.full_name}...`);
    const { error } = await supabase.from("profiles").delete().eq("id", user.id);
    if (error) {
      setDataStatus(`Delete failed: ${error.message}`);
      return;
    }
    setUserRows((prev) => prev.filter((u) => u.id !== user.id));
    if (editingUser && editingUser.id === user.id) {
      setEditingUser(null);
      setUserForm({ full_name: "", role: "student", grade: "", subject: "" });
    }
    setDataStatus(null);
  };

  useEffect(() => {
    let cancelled = false;
    const loadSentiment = async () => {
      if (!isAdmin) return;
      if (curriculumRows.length === 0) {
        setSentimentFiles([]);
        setSentimentStatus("No activities found yet.");
        return;
      }
      setSentimentStatus("Loading sentiment summaries...");
      try {
        const bucket = supabase.storage.from("curriculum-assets");
        const collected: SentimentFile[] = [];
        // Fetch sentiment files per activity folder
        for (const mod of curriculumRows) {
          const folder = `sentiment-metrics/${sanitizeSegment(mod.title)}-${sanitizeSegment(mod.id)}`;
          const { data, error } = await bucket.list(folder, { limit: 100, offset: 0, sortBy: { column: "name", order: "desc" } });
          if (error || !data) continue;
          data
            .filter((item) => item.name.toLowerCase().endsWith(".json"))
            .forEach((item) => {
              const path = `${folder}/${item.name}`;
              const { data: publicUrl } = bucket.getPublicUrl(path);
              collected.push({
                moduleId: mod.id,
                moduleTitle: mod.title,
                studentLabel: studentLabelFromFile(item.name),
                fileName: item.name,
                path,
                url: publicUrl.publicUrl,
                createdAt: (item as { created_at?: string; updated_at?: string }).created_at || (item as { updated_at?: string }).updated_at,
              });
            });
        }
        if (cancelled) return;
        const sorted = collected.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
        setSentimentFiles(sorted);
        setSentimentStatus(sorted.length ? null : "No sentiment summaries yet.");
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Unable to load sentiment files";
        setSentimentFiles([]);
        setSentimentStatus(message);
      }
    };
    void loadSentiment();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, curriculumRows]);

  const handleDeleteSentimentFile = async (file: SentimentFile) => {
    if (deletingSentimentPath) return;
    setDeletingSentimentPath(file.path);
    setSentimentStatus(`Deleting ${file.fileName}...`);
    try {
      const { error } = await supabase.storage.from("curriculum-assets").remove([file.path]);
      if (error) throw error;
      setSentimentFiles((prev) => prev.filter((item) => item.path !== file.path));
      setSentimentStatus(`Deleted ${file.fileName}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to delete file";
      setSentimentStatus(`Delete failed: ${message}`);
    } finally {
      setDeletingSentimentPath(null);
    }
  };

  return (
    <main className="section-padding space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-accent-strong uppercase text-xs tracking-[0.2em]">{dashboardRoleLabel}</p>
          <h1 className="text-3xl font-semibold text-white">Welcome {dashboardRoleLabel} to your Control Room</h1>
          <p className="text-slate-300 text-sm mt-2">
            {isAdmin
              ? "Manage curriculum, products, orders, and promotions in one dashboard."
              : "You can update activity grade labels; admins handle the rest of the control room."}
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/"
            className="px-4 py-2 rounded-xl border border-white/10 text-sm text-slate-900 hover:border-accent-strong"
          >
            Back to Home
          </Link>
          <button
            onClick={() =>
              startSignOut(async () => {
                await supabase.auth.signOut();
                router.push("/login");
              })
            }
            className="px-4 py-2 rounded-xl bg-accent text-true-white font-semibold shadow-glow disabled:opacity-60"
            disabled={signingOut}
          >
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </div>

      {dataStatus && (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
          {dataStatus}
        </div>
      )}
      {authStatus && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {authStatus}
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((item) => (
          <div key={item.label} className="glass-panel rounded-2xl p-4 space-y-2">
            <p className="text-sm text-slate-400">{item.label}</p>
            <p className="text-2xl font-semibold text-white">{item.value}</p>
            <p className="text-xs text-accent-strong">{item.delta}</p>
          </div>
        ))}
      </div>

      <div className="glass-panel rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Drone Activities</h2>
          <div className="flex gap-2">
            <Link
              href="/admin/questions"
              className="text-sm px-3 py-2 rounded-lg font-semibold border border-accent/40 text-accent-strong hover:border-accent hover:text-true-white transition"
            >
              Manage questions
            </Link>
            <Link
              href="/admin/upload"
              className={`text-sm px-3 py-2 rounded-lg font-semibold shadow-glow ${
                isAdmin ? "bg-accent text-true-white" : "bg-white/5 text-slate-400 pointer-events-none"
              }`}
            >
              Upload content
            </Link>
          </div>
        </div>
        <p className="text-sm text-slate-300">
          List every drone activity with grade and subject before publishing to students.
          {canEditCurriculum && !isAdmin
            ? " You can change the Grade field; other fields stay locked for teacher accounts."
            : ""}
        </p>
        <div className="overflow-auto">
          <table className="min-w-full text-sm text-slate-200">
            <thead>
              <tr className="text-left text-slate-400 border-b border-white/10">
                <th className="py-2 pr-3">Title</th>
                <th className="py-2 pr-3">Grade</th>
                <th className="py-2 pr-3">Subject</th>
                <th className="py-2 pr-3">Assets</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {curriculumRows.length === 0 ? (
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-3 text-slate-300" colSpan={5}>
                    No curriculum uploaded yet. Click â€œUpload contentâ€ to add your first drone activity.
                  </td>
                </tr>
              ) : (
                curriculumRows.map((item) => (
                  <tr
                    key={item.id}
                    className={`border-b border-white/5 ${draggingId === item.id ? "opacity-60" : ""}`}
                    draggable
                    onDragStart={() => handleDragStart(item.id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(event) => handleDragOver(event)}
                    onDrop={() => handleDropOn(item.id)}
                  >
                    <td className="py-2 pr-3 font-semibold text-white">{item.title}</td>
                    <td className="py-2 pr-3 text-slate-300">{item.grade}</td>
                    <td className="py-2 pr-3 text-slate-300">{item.subject}</td>
                    <td className="py-2 pr-3 text-slate-300">
                      {item.assets.map((asset) => asset.label).join(", ")}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="px-3 py-1 rounded-lg bg-white/10 border border-white/15 text-white text-xs"
                          onClick={() => {
                            setEditingCurriculumId(item.id);
                            setCurriculumForm({
                              title: item.title,
                              grade: item.grade,
                              subject: item.subject,
                              module: item.module,
                              description: item.description,
                              assets: item.assets.map((a) => a.label).join(", "),
                            });
                            requestAnimationFrame(() => {
                              curriculumEditRef.current?.scrollIntoView({ behavior: "smooth" });
                            });
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="px-3 py-1 rounded-lg border border-red-600/70 text-red-400 text-xs hover:bg-red-600/25 transition"
                          onClick={async () => {
                            try {
                              if (!isAdmin) {
                                setDataStatus("Admin access is required to delete curriculum.");
                                return;
                              }
                              setDataStatus("Deleting curriculum item...");
                              const { error } = await supabase.from("curriculum_modules").delete().eq("id", item.id);
                              if (error) {
                                setDataStatus(`Delete failed: ${error.message}`);
                                return;
                              }
                              setCurriculumRows((prev) => prev.filter((c) => c.id !== item.id));
                              setDataStatus(null);
                            } catch (err) {
                              const message = err instanceof Error ? err.message : "Unknown error";
                              setDataStatus(`Delete failed: ${message}`);
                            }
                          }}
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
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Product catalogue</h2>
          <Link href="/shop" className="text-sm text-accent-strong hover:underline">
            View shop
          </Link>
        </div>
        <p className="text-sm text-slate-300">
          List every shop item and trigger edit or delete actions directly from the control room.
        </p>
        <div className="flex justify-end">
          <Link
            href="/admin/products/new"
            className={`text-sm px-3 py-2 rounded-lg font-semibold shadow-glow ${
              isAdmin ? "bg-accent text-true-white" : "bg-white/5 text-slate-400 pointer-events-none"
            }`}
          >
            List new product
          </Link>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm text-slate-200">
            <thead>
              <tr className="text-left text-slate-400 border-b border-white/10">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">SKU</th>
                <th className="py-2 pr-3">Price</th>
                <th className="py-2 pr-3">Delivery</th>
                <th className="py-2 pr-3">Expected</th>
                <th className="py-2 pr-3">Stock</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {productRows.map((product) => (
                <tr key={product.id} className="border-b border-white/5">
                  <td className="py-2 pr-3 font-semibold text-white">{product.name}</td>
                  <td className="py-2 pr-3 text-slate-300">{product.sku}</td>
                  <td className="py-2 pr-3">{formatPrice(product.price)}</td>
                  <td className="py-2 pr-3">{product.deliveryEta}</td>
                  <td className="py-2 pr-3">{product.expectedDelivery}</td>
                  <td className="py-2 pr-3">{product.stock}</td>
                  <td className="py-2 pr-3">
                    <div className="flex gap-2">
                      <Link
                        href={`/shop/${product.id}`}
                className="px-3 py-1 rounded-lg border border-white/15 text-white text-xs hover:border-accent-strong"
              >
                View
              </Link>
              <button
                className="px-3 py-1 rounded-lg bg-white/10 border border-white/15 text-white text-xs"
                onClick={() => {
                  setEditingId(product.id);
                  setEditForm({
                    name: product.name,
                    price: String(product.price),
                            deliveryEta: product.deliveryEta,
                            expectedDelivery: product.expectedDelivery,
                            stock: String(product.stock),
                            imageData: "",
                            imageName: "",
                            removeImage: false,
                            galleryData:
                              product.galleryData ??
                              product.gallery ??
                              (product.imageData ? [product.imageData] : product.image ? [product.image] : []),
                            galleryNames:
                              product.galleryData?.map((_, idx) => `Image ${idx + 1}`) ??
                              product.gallery?.map((_, idx) => `Image ${idx + 1}`) ??
                              (product.image ? ["Image 1"] : []),
                          });
                        }}
                      >
                        Edit
                      </button>
              <button
                        className="px-3 py-1 rounded-lg border border-red-600/70 text-red-400 text-xs hover:bg-red-600/25 transition"
                        onClick={async () => {
                          try {
                            if (!isAdmin) {
                              setDataStatus("Admin access is required to delete products.");
                              return;
                            }
                            setDataStatus("Deleting product...");
                            const { error } = await supabase.from("products").delete().eq("id", product.id);
                            if (error) {
                              // If DB delete fails, fall back to local removal so the UI remains usable.
                              setDataStatus(`Delete failed (using local fallback): ${error.message}`);
                            } else {
                              setDataStatus(null);
                            }
                            setProductRows((prev) => prev.filter((p) => p.id !== product.id));
                            if (editingId === product.id) {
                              setEditingId(null);
                            }
                          } catch (err) {
                            const message = err instanceof Error ? err.message : "Unknown error";
                            // Last-resort fallback: remove locally so the button isn't a no-op.
                            setProductRows((prev) => prev.filter((p) => p.id !== product.id));
                            if (editingId === product.id) {
                              setEditingId(null);
                            }
                            setDataStatus(`Delete failed (local fallback applied): ${message}`);
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Sentiment summaries</h2>
          <span className="text-sm text-slate-400">{sentimentFiles.length} files</span>
        </div>
        <p className="text-sm text-slate-300">JSON summaries from MoodAI guided questions, grouped by activity.</p>
        {sentimentStatus && (
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">{sentimentStatus}</div>
        )}
        <div className="overflow-auto">
          <table className="min-w-full text-sm text-slate-200">
            <thead>
              <tr className="text-left text-slate-400 border-b border-white/10">
                <th className="py-2 pr-3">Activity</th>
                <th className="py-2 pr-3">Student</th>
                <th className="py-2 pr-3">File</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sentimentFiles.length === 0 ? (
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-3 text-slate-300" colSpan={4}>
                    No sentiment summaries yet.
                  </td>
                </tr>
              ) : (
                sentimentFiles.map((file) => (
                  <tr key={file.path} className="border-b border-white/5">
                    <td className="py-2 pr-3 font-semibold text-white">{file.moduleTitle}</td>
                    <td className="py-2 pr-3 text-slate-300">{file.studentLabel}</td>
                    <td className="py-2 pr-3 text-slate-300">{file.fileName}</td>
                    <td className="py-2 pr-3">
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1 rounded-lg bg-emerald-500 text-slate-900 font-semibold text-xs border border-emerald-400 hover:bg-emerald-400 hover:border-emerald-300"
                      >
                        Open
                      </a>
                      <button
                        type="button"
                        onClick={() => void handleDeleteSentimentFile(file)}
                        disabled={deletingSentimentPath === file.path}
                        className="ml-2 px-3 py-1 rounded-lg bg-rose-600 text-true-white font-semibold text-xs border border-rose-500 hover:bg-rose-500 hover:border-rose-400 disabled:opacity-50"
                      >
                        {deletingSentimentPath === file.path ? "Deleting..." : "Delete"}
                      </button>
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
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-white">Registered users</h2>
            <span className="text-sm text-slate-400">{userCount ?? userRows.length} total</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs text-slate-300 flex items-center gap-1">
              Sort by
              <select
                className="rounded-lg bg-white/5 border border-emerald-600/70 px-2 py-1 text-slate-100 text-xs"
                value={userSort.field}
                onChange={(e) =>
                  setUserSort((prev) => ({ ...prev, field: e.target.value as (typeof prev)["field"] }))
                }
              >
                <option value="name">Name</option>
                <option value="role">Role</option>
                <option value="grade">Grade</option>
                <option value="subject">Subject</option>
              </select>
            </label>
            <button
              className="text-xs px-3 py-1 rounded-lg bg-emerald-500 text-white font-semibold border border-emerald-300 shadow-glow hover:bg-emerald-400 transition flex items-center gap-1"
              aria-label="Toggle sort direction"
              onClick={() =>
                setUserSort((prev) => ({ ...prev, dir: prev.dir === "asc" ? "desc" : "asc" }))
              }
            >
              <span>{userSort.dir === "asc" ? "↑" : "↓"}</span>
              <span className="sr-only">Toggle sort</span>
            </button>
          </div>
        </div>
        <p className="text-sm text-slate-300">See everyone who has signed up for the platform.</p>
        <div className="overflow-auto">
          <table className="min-w-full text-sm text-slate-200">
            <thead>
              <tr className="text-left text-slate-400 border-b border-white/10">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3">Grade</th>
                <th className="py-2 pr-3">Subject</th>
                <th className="py-2 pr-3">User ID</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {userRows.length === 0 ? (
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-3 text-slate-300" colSpan={5}>
                    No users found yet. New accounts will appear here automatically after signup.
                  </td>
                </tr>
              ) : (
                sortedUsers.map((user) => (
                  <tr key={user.id} className="border-b border-white/5">
                    <td className="py-2 pr-3 font-semibold text-white">{user.full_name}</td>
                    <td className="py-2 pr-3 text-slate-300">{user.displayRole}</td>
                    <td className="py-2 pr-3 text-slate-300">{user.grade ?? "—"}</td>
                    <td className="py-2 pr-3 text-slate-300">
                      {user.role === "teacher" ? user.subject ?? "—" : "—"}
                    </td>
                    <td className="py-2 pr-3 text-slate-400 font-mono">{shortId(user.id)}</td>
                    <td className="py-2 pr-3 text-slate-300">{formatJoinedDate(user.created_at)}</td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="px-3 py-1 rounded-lg border border-white/15 text-xs text-slate-100 hover:border-accent-strong transition"
                          onClick={(e) => openUserEditor(user, e)}
                        >
                          Edit
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

      {editingId && (
        <div className="glass-panel rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Edit product</h3>
            <button
              className="text-sm px-3 py-1 rounded-lg bg-emerald-500 text-white font-semibold shadow-glow hover:bg-emerald-400 transition"
              onClick={() => setEditingId(null)}
            >
              Cancel
            </button>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <label className="block text-sm text-slate-300 space-y-2">
              Name
              <input
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-xl border border-slate-400/60 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none"
              />
            </label>
            <label className="block text-sm text-slate-300 space-y-2">
              Price (â‚¹)
              <input
                type="number"
                value={editForm.price}
                onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))}
                className="w-full rounded-xl border border-slate-400/60 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none"
              />
            </label>
            <label className="block text-sm text-slate-300 space-y-2">
              Delivery window
              <input
                value={editForm.deliveryEta}
                onChange={(e) => setEditForm((f) => ({ ...f, deliveryEta: e.target.value }))}
                className="w-full rounded-xl border border-slate-400/60 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none"
              />
            </label>
            <label className="block text-sm text-slate-300 space-y-2">
              Expected delivery
              <input
                value={editForm.expectedDelivery}
                onChange={(e) => setEditForm((f) => ({ ...f, expectedDelivery: e.target.value }))}
                className="w-full rounded-xl border border-slate-400/60 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none"
              />
            </label>
            <label className="block text-sm text-slate-300 space-y-2">
              Stock
              <input
                type="number"
                value={editForm.stock}
                onChange={(e) => setEditForm((f) => ({ ...f, stock: e.target.value }))}
                className="w-full rounded-xl border border-slate-400/60 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none"
              />
            </label>
            <label className="block text-sm text-slate-300 space-y-2">
              Replace images (up to 3)
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  const files = e.target.files ? Array.from(e.target.files).slice(0, 3) : [];
                  if (!files.length) {
                    setEditForm((f) => ({
                      ...f,
                      imageData: "",
                      imageName: "",
                      galleryData: [],
                      galleryNames: [],
                      removeImage: false,
                    }));
                    return;
                  }
                  const readers = files.map(
                    (file) =>
                      new Promise<string>((resolve) => {
                        const r = new FileReader();
                        r.onload = () => resolve(typeof r.result === "string" ? r.result : "");
                        r.readAsDataURL(file);
                      }),
                  );
                  Promise.all(readers).then((dataUrls) => {
                    setEditForm((f) => ({
                      ...f,
                      imageData: dataUrls[0] ?? "",
                      imageName: files[0]?.name ?? "",
                      galleryData: dataUrls,
                      galleryNames: files.map((f) => f.name),
                      removeImage: false,
                    }));
                  });
                }}
                className="w-full rounded-xl border border-slate-400/60 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none file-accent"
              />
              {editForm.galleryNames.length > 0 && (
                <p className="text-xs text-slate-400">
                  Selected ({editForm.galleryNames.length}/3): {editForm.galleryNames.join(", ")}
                </p>
              )}
              {editForm.galleryData.length > 0 && (
                <div className="flex gap-2 mt-2">
                  {editForm.galleryData.map((img, idx) => (
                    <div key={idx} className="relative h-14 w-14 rounded-lg overflow-hidden border border-white/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt={`Preview ${idx + 1}`} className="object-cover h-full w-full" />
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                className="text-xs text-red-200 underline"
                onClick={() =>
                  setEditForm((f) => ({
                    ...f,
                    imageData: "",
                    imageName: "",
                    galleryData: [],
                    galleryNames: [],
                    removeImage: true,
                  }))
                }
              >
                Remove image(s)
              </button>
            </label>
          </div>
          <div className="flex gap-3">
            <button
              className="px-4 py-2 rounded-xl bg-accent text-slate-900 font-semibold shadow-glow hover:translate-y-[-1px] transition-transform"
              onClick={async () => {
                if (!editingId) return;
                try {
                  if (!isAdmin) {
                    setDataStatus("Admin access is required to edit products.");
                    return;
                  }
                  setDataStatus("Saving product changes...");

                  const payload: Record<string, unknown> = {
                    name: editForm.name,
                    price: Number(editForm.price) || 0,
                    delivery_eta: editForm.deliveryEta,
                    stock: Number(editForm.stock) || 0,
                  };

                  let nextImageUrl: string | null | undefined = undefined;
                  let nextGalleryUrls: string[] | undefined = undefined;
                  const hasNewImages = editForm.galleryData.length > 0;

                  if (editForm.removeImage) {
                    nextImageUrl = null;
                    nextGalleryUrls = [];
                  } else if (hasNewImages) {
                    const { data: authData } = await supabase.auth.getUser();
                    const userId = authData.user?.id ?? "anonymous";
                    const files = editForm.galleryData.slice(0, 3).map((dataUrl, idx) => {
                      const name = editForm.galleryNames[idx] || editForm.galleryNames[0] || editForm.imageName || `product-image-${idx + 1}.jpg`;
                      return dataUrlToFile(dataUrl, name);
                    });
                    const uploaded = await Promise.all(
                      files.map((file) =>
                        uploadFileToBucket({
                          bucket: "product-images",
                          file,
                          pathPrefix: userId,
                          fileName: file.name,
                        }),
                      ),
                    );
                    nextGalleryUrls = uploaded;
                    nextImageUrl = uploaded[0] ?? "";
                  }

                  if (typeof nextImageUrl !== "undefined") {
                    payload.image_url = nextImageUrl;
                  }
                  if (typeof nextGalleryUrls !== "undefined") {
                    payload.gallery_urls = nextGalleryUrls;
                  }

                  const { error } = await supabase.from("products").update(payload).eq("id", editingId);
                  if (error) {
                    const isGalleryErr = /gallery_urls/i.test(error.message || "");
                    const isBadReq = (error as { status?: number })?.status === 400;
                    if (isGalleryErr || isBadReq) {
                      const retryPayload = { ...payload };
                      delete (retryPayload as Record<string, unknown>).gallery_urls;
                      const { error: retryError } = await supabase.from("products").update(retryPayload).eq("id", editingId);
                      if (retryError) {
                        // fallback to local update so the UI responds even if DB rejects
                        setDataStatus(`Save failed (local update only): ${retryError.message}`);
                      }
                    } else {
                      setDataStatus(`Save failed (local update only): ${error.message}`);
                    }
                  }

                  setProductRows((prev) =>
                    prev.map((p) => {
                      if (p.id !== editingId) return p;
                      const nextImage = nextImageUrl === null ? "" : nextImageUrl || p.image;
                      const nextGallery = nextGalleryUrls ?? p.gallery ?? [];
                      return {
                        ...p,
                        name: editForm.name,
                        price: Number(editForm.price) || 0,
                        deliveryEta: editForm.deliveryEta,
                        expectedDelivery: editForm.expectedDelivery,
                        stock: Number(editForm.stock) || 0,
                        image: nextImage,
                        gallery: nextGallery,
                        galleryData: nextGallery,
                      };
                    }),
                  );

                  setEditingId(null);
                  setEditForm({
                    name: "",
                    price: "",
                    deliveryEta: "",
                    expectedDelivery: "",
                    stock: "",
                    imageData: "",
                    imageName: "",
                    removeImage: false,
                    galleryData: [],
                    galleryNames: [],
                  });
                  setDataStatus(null);
                } catch (err) {
                  const message = err instanceof Error ? err.message : "Unknown error";
                  setDataStatus(`Save failed: ${message}`);
                }
              }}
            >
              Save changes
            </button>
            <button
              className="px-4 py-2 rounded-xl bg-emerald-500 text-white font-semibold shadow-glow hover:bg-emerald-400 transition"
              onClick={() => setEditingId(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {editingCurriculumId && (
        <div className="glass-panel rounded-2xl p-6 space-y-4" ref={curriculumEditRef}>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Edit curriculum</h3>
            <button
              className="text-sm px-3 py-1 rounded-lg bg-emerald-500 text-white font-semibold shadow-glow hover:bg-emerald-400 transition"
              onClick={() => setEditingCurriculumId(null)}
            >
              Cancel
            </button>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <label className="block text-sm text-slate-300 space-y-2">
              Title
              <input
                value={curriculumForm.title}
                onChange={(e) => setCurriculumForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full rounded-xl border border-slate-400/60 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none"
                disabled={!isAdmin}
              />
            </label>
            <label className="block text-sm text-slate-300 space-y-2">
              Grade
              <select
                value={curriculumForm.grade}
                onChange={(e) => setCurriculumForm((f) => ({ ...f, grade: e.target.value }))}
                className="w-full rounded-xl border border-slate-400/60 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none"
              >
                {gradeOptions.map((g) => (
                  <option key={g} value={g} className="text-black">
                    {g}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-slate-300 space-y-2">
              Subject
              <select
                value={curriculumForm.subject}
                onChange={(e) => setCurriculumForm((f) => ({ ...f, subject: e.target.value }))}
                className="w-full rounded-xl border border-slate-400/60 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none"
                disabled={!isAdmin}
              >
                {subjectOptions.map((s) => (
                  <option key={s} value={s} className="text-black">
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-slate-300 space-y-2">
              Module
              <input
                value={curriculumForm.module}
                onChange={(e) => setCurriculumForm((f) => ({ ...f, module: e.target.value }))}
                className="w-full rounded-xl border border-slate-400/60 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none"
                disabled={!isAdmin}
              />
            </label>
          </div>
          <label className="block text-sm text-slate-300 space-y-2">
            Description
            <textarea
              value={curriculumForm.description}
              onChange={(e) => setCurriculumForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full rounded-xl border border-slate-400/60 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none"
              rows={3}
              disabled={!isAdmin}
            />
          </label>
          <label className="block text-sm text-slate-300 space-y-2">
            Assets (comma separated labels)
            <input
              value={curriculumForm.assets}
              onChange={(e) => setCurriculumForm((f) => ({ ...f, assets: e.target.value }))}
              className="w-full rounded-xl border border-slate-400/60 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none"
              disabled={!isAdmin}
            />
          </label>
          <div className="flex gap-3">
            <button
              className="px-4 py-2 rounded-xl bg-accent text-slate-900 font-semibold shadow-glow hover:translate-y-[-1px] transition-transform"
              onClick={async () => {
                if (!editingCurriculumId) return;
                try {
                  if (!canEditCurriculum) {
                    setDataStatus("Admin or teacher access is required to edit curriculum.");
                    return;
                  }
                  const existing = curriculumRows.find((c) => c.id === editingCurriculumId);
                  if (!existing) {
                    setDataStatus("Could not find that activity to update.");
                    return;
                  }
                  setDataStatus(isAdmin ? "Saving curriculum changes..." : "Updating activity grade...");

                  let nextAssets = existing.assets;
                  let updatePayload: Record<string, unknown> = { grade: curriculumForm.grade };

                  if (isAdmin) {
                    const assetLabels = curriculumForm.assets
                      .split(",")
                      .map((a) => a.trim())
                      .filter(Boolean);

                    nextAssets =
                      assetLabels.length === 0
                        ? existing.assets ?? []
                        : (existing.assets?.length ?? 0) > 0
                          ? (existing.assets ?? []).map((asset, idx) => ({
                              ...asset,
                              label: assetLabels[idx] ?? asset.label,
                            }))
                          : assetLabels.map((label) => ({ type: "doc" as const, url: label, label }));

                    updatePayload = {
                      title: curriculumForm.title,
                      grade: curriculumForm.grade,
                      subject: curriculumForm.subject,
                      module: curriculumForm.module,
                      description: curriculumForm.description,
                      asset_urls: nextAssets,
                    };
                  }

                  const { error } = await supabase
                    .from("curriculum_modules")
                    .update(updatePayload)
                    .eq("id", editingCurriculumId);

                  if (error) {
                    setDataStatus(`Save failed: ${error.message}`);
                    return;
                  }

                  setCurriculumRows((prev) =>
                    prev.map((c) =>
                      c.id === editingCurriculumId
                        ? {
                            ...c,
                            ...(isAdmin
                              ? {
                                  title: curriculumForm.title,
                                  grade: curriculumForm.grade,
                                  subject: curriculumForm.subject,
                                  module: curriculumForm.module,
                                  description: curriculumForm.description,
                                  assets: nextAssets,
                                }
                              : { grade: curriculumForm.grade }),
                          }
                        : c,
                    ),
                  );

                  setEditingCurriculumId(null);
                  setCurriculumForm({
                    title: "",
                    grade: "",
                    subject: "",
                    module: "",
                    description: "",
                    assets: "",
                  });
                  setDataStatus(null);
                } catch (err) {
                  const message = err instanceof Error ? err.message : "Unknown error";
                  setDataStatus(`Save failed: ${message}`);
                }
              }}
            >
              Save changes
            </button>
            <button
              className="px-4 py-2 rounded-xl border border-white/10 text-white hover:border-accent-strong"
              onClick={() => setEditingCurriculumId(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            onClick={() => {
              setEditingUser(null);
              setUserEditStatus(null);
              setUserPopover(null);
            }}
          />
          <div
            className="absolute w-[420px] max-w-[92vw] glass-panel rounded-3xl border border-white/12 bg-surface p-6 space-y-4 shadow-2xl"
            style={{
              top: userPopover?.top ?? 120,
              left:
                userPopover?.left ??
                Math.max(12, (typeof window !== "undefined" ? window.innerWidth / 2 - 250 : 80)),
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Profile</p>
                <h3 className="text-xl font-semibold text-white">Edit user</h3>
              </div>
            <button
              className="text-sm px-3 py-1 rounded-lg border border-white/10 text-white hover:border-accent-strong"
              onClick={() => {
                setEditingUser(null);
                setUserEditStatus(null);
                setUserPopover(null);
              }}
            >
              Close
            </button>
          </div>

            {userEditStatus && (
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                {userEditStatus}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <label className="block text-sm text-slate-300 space-y-2">
                Full name
                <input
                  value={userForm.full_name}
                  onChange={(e) => setUserForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-400/60 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none"
                  placeholder="Enter full name"
                />
              </label>
              <label className="block text-sm text-slate-300 space-y-2">
                Role
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full rounded-xl border border-slate-400/60 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none"
                >
                  <option value="admin" className="text-black">
                    Admin
                  </option>
                  <option value="teacher" className="text-black">
                    Teacher
                  </option>
                  <option value="student" className="text-black">
                    Student
                  </option>
                  <option value="customer" className="text-black">
                    Customer (legacy)
                  </option>
                </select>
              </label>
              <label className="block text-sm text-slate-300 space-y-2">
                Grade (students only)
                <input
                  value={userForm.grade}
                  onChange={(e) => setUserForm((f) => ({ ...f, grade: e.target.value }))}
                  className="w-full rounded-xl border border-slate-400/60 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none disabled:opacity-40"
                  list="grade-options"
                  placeholder="e.g., Grade 7"
                  disabled={userForm.role !== "student"}
                />
                <datalist id="grade-options">
                  {gradeOptions.map((grade) => (
                    <option value={grade} key={grade} />
                  ))}
                </datalist>
              </label>
              <label className="block text-sm text-slate-300 space-y-2">
                Subject (teachers only)
                <select
                  value={userForm.subject || subjectOptions[0]}
                  onChange={(e) => setUserForm((f) => ({ ...f, subject: e.target.value }))}
                  className="w-full rounded-xl border border-slate-400/60 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none disabled:opacity-40"
                  disabled={userForm.role !== "teacher"}
                >
                  {subjectOptions.map((subj) => (
                    <option key={subj} value={subj} className="text-black">
                      {subj}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-slate-300 space-y-2">
                Email (read-only)
                <input
                  value={editingUser.email ?? "—"}
                  readOnly
                  className="w-full rounded-xl border border-slate-400/60 bg-white/5 px-3 py-2 text-slate-400 focus:outline-none cursor-not-allowed"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                className="px-4 py-2 rounded-xl bg-accent text-white font-semibold shadow-glow hover:translate-y-[-1px] transition-transform"
                onClick={() => void handleSaveUser()}
              >
                Save changes
              </button>
              <button
              className="px-4 py-2 rounded-xl border border-white/10 text-white hover:border-accent-strong"
              onClick={() => {
                setEditingUser(null);
                setUserEditStatus(null);
                setUserPopover(null);
              }}
            >
              Cancel
            </button>
              <button
                className="px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold border border-rose-500 hover:bg-rose-500 transition"
                onClick={() => editingUser && void handleDeleteUser(editingUser)}
                disabled={!!currentUserId && editingUser?.id === currentUserId}
              >
                {currentUserId && editingUser?.id === currentUserId ? "Can't delete self" : "Delete user"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="glass-panel rounded-2xl p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Orders</h2>
          <button className="text-sm px-3 py-1 rounded-lg bg-white/10 border border-white/15 text-white">
            View all
          </button>
        </div>
        <ul className="list-disc list-inside text-sm text-slate-200 space-y-1">
          {orderActions.map((action) => (
            <li key={action}>{action}</li>
          ))}
        </ul>
        <div className="rounded-xl border border-white/10 p-3 text-sm text-slate-300">
          Live status: 0 pending, 0 processing, 0 delivered.
        </div>
      </div>
    </main>
  );
}

