"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { CurriculumModule } from "@/types";
import { fetchCurriculumModules } from "@/lib/supabaseData";

const normalizeSubject = (subject: string) =>
  subject?.toLowerCase() === "maths" ? "Mathematics" : subject;

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  status: string;
  created_at: string;
  module_id?: string | null;
  subject?: string | null;
};

const VR_SIMULATION_LIBRARY: Record<string, string[]> = {
  Physics: [
    "Electricity, Mechanics, Optics, Gravitation",
    "Factors Affecting Resistance of Conductor (Length, Area, Material)",
    "Resistance of Resistors (Series & Parallel)",
    "Understanding Resistance & Ohm's Law",
    "Heating Effect of Electric Current & Applications",
    "Understanding Refraction of Light",
    "Refractive Index & Snell's Law",
    "Understanding Mass & Weight",
    "Pressure in Solids, Liquids & Pressure at Work",
    "Classification of Forces (I, II)",
    "Newton's First Law of Motion",
    "Understanding Archimedes' Principle",
    "Understanding Kepler's Law",
  ],
  Chemistry: [
    "Understanding Ionic Compounds",
    "Properties of Ionic Compounds",
    "Structural Integrity and Thermal Stability",
    "Solubility",
    "Electrical Conductivity",
    "Physical Properties of Metals",
    "Hardness and Lustre",
    "Malleability and Ductility",
    "Conductivity",
    "Particle Nature of Matter (I, II)",
    "States of Matter (Solid, Liquid, Gas)",
    "Interconversion of States of Matter",
    "Fusion and Solidification",
    "Vaporisation and Condensation",
    "Atomic Number and Mass Number",
    "Isotopes and Isobars",
    "Atomic Models",
    "Rutherford",
    "J.J. Thomson",
    "Bohr",
    "Valency and VSEPR Theory (Concept and Applications I-III)",
    "Hybridisation",
    "sp, sp2, sp3, sp3d",
    "Conformational Isomers",
    "Ethane",
    "n-Butane",
    "Cyclohexane",
    "SN1 and SN2 Reaction Mechanisms",
    "Atoms, Elemental Molecules and Compounds",
    "Pure Substances and Mixtures",
    "Classification of Pure Substances and Mixtures",
  ],
  Mathematics: [
    "Understanding Coordinate Geometry",
    "Right Circular Cone",
    "Surface Area",
    "Volume (visualization)",
    "Visualizing the Volume of a Sphere",
  ],
  ESS: [
    "Traditional Water Conservation: Rainwater Harvesting",
    "Modern Water Conservation: Rainwater Harvesting",
    "Easter Island",
    "Indus Valley Civilization",
    "Cultural Legacy of the Indus Valley Civilization",
  ],
  Biology: [
    "Anatomy of Skeletal Muscle and Function",
    "Contractile Proteins and Sarcomere",
    "Mechanism of Muscle Contraction (Sliding Filament Theory)",
    "Structure of DNA (I and II)",
  ],
  "Design & Technology": [
    "Mission Chandrayaan",
    "India Gate and National War Memorial",
    "Stonehenge",
    "Sanchi Stupa",
    "Taj Mahal",
    "Lotus Temple",
  ],
};

const ANY_OTHER_OPTION = "Any other";

const resolveVrSubjectKey = (subject?: string | null) => {
  if (!subject) return null;
  const normalized = subject.trim().toLowerCase();
  if (normalized.includes("physics") || normalized === "phy") return "Physics";
  if (normalized.includes("chem")) return "Chemistry";
  if (normalized.includes("math")) return "Mathematics";
  if (normalized.includes("ess") || normalized.includes("environment")) return "ESS";
  if (normalized.includes("bio") || normalized.includes("life")) return "Biology";
  if (normalized.includes("design") || normalized.includes("tech") || normalized.includes("d&t")) {
    return "Design & Technology";
  }
  return null;
};

export default function CustomerPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("Customer");
  const [role, setRole] = useState<string>("customer");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [userGrade, setUserGrade] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [teacherSubject, setTeacherSubject] = useState<string | null>(null);
  const [modules, setModules] = useState<CurriculumModule[]>([]);
  const [signingOut, startSignOut] = useTransition();
  const [dataStatus, setDataStatus] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [progressMap, setProgressMap] = useState<Record<string, { completed?: boolean; score?: number; total?: number; completedAt?: string }>>({});
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [studentRows, setStudentRows] = useState<Array<{ id: string; full_name: string; email?: string | null; grade?: string | null; subject?: string | null }>>([]);
  const [studentSortDir, setStudentSortDir] = useState<"asc" | "desc">("asc");
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [notificationStatus, setNotificationStatus] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const unreadCount = useMemo(
    () => notifications.filter((n) => n.status === "unread").length,
    [notifications],
  );
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestMode, setRequestMode] = useState<"vr" | "drone">("vr");
  const [requestItems, setRequestItems] = useState<string[]>([]);
  const [droneConcept, setDroneConcept] = useState("");
  const [requestDate, setRequestDate] = useState("");
  const [requestNotes, setRequestNotes] = useState("");
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [seenModules, setSeenModules] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadProgress = () => {
      try {
        const stored = localStorage.getItem("activityProgress");
        if (!stored) {
          setProgressMap({});
          return;
        }
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object") {
          setProgressMap(parsed);
        } else {
          setProgressMap({});
        }
      } catch {
        setProgressMap({});
      }
    };
    loadProgress();
    const onStorage = (event: StorageEvent) => {
      if (event.key === "activityProgress") {
        loadProgress();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!notificationsOpen) return;
      const target = event.target as Node | null;
      if (notificationsRef.current && target && !notificationsRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notificationsOpen]);

  useEffect(() => {
    if (role !== "teacher") return;
    try {
      const raw = localStorage.getItem("teacherModuleSeen");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setSeenModules(new Set(parsed.filter((id) => typeof id === "string")));
      }
    } catch {
      // ignore errors reading localStorage
    }
  }, [role]);

  const decodeDataUrl = useCallback((url?: string) => {
    if (!url || !url.startsWith("data:")) return null;
    const commaIndex = url.indexOf(",");
    if (commaIndex === -1) return null;
    try {
      const base64 = url.slice(commaIndex + 1);
      return atob(base64);
    } catch {
      return null;
    }
  }, []);

  const encodeToBase64 = useCallback((text: string) => {
    if (typeof window === "undefined") {
      return Buffer.from(text, "utf-8").toString("base64");
    }
    try {
      return btoa(unescape(encodeURIComponent(text)));
    } catch {
      return btoa(text);
    }
  }, []);

  const enhanceModule = useCallback((module: CurriculumModule): CurriculumModule => {
    let codeSnippet = module.codeSnippet;
    let assets = module.assets ?? [];
    const codeIndex = assets.findIndex((a) => a.type === "code");
    const codeAsset = codeIndex >= 0 ? assets[codeIndex] : undefined;

    if (!codeSnippet && codeAsset?.url) {
      const decoded = decodeDataUrl(codeAsset.url);
      if (decoded) codeSnippet = decoded;
    }

    if (codeSnippet) {
      const dataUrl = `data:text/plain;base64,${encodeToBase64(codeSnippet)}`;
      if (codeIndex >= 0) {
        assets = assets.map((a, i) => (i === codeIndex ? { ...a, url: dataUrl } : a));
      } else {
        assets = [...assets, { type: "code", url: dataUrl, label: codeAsset?.label || "Python code" }];
      }
    }

    return { ...module, codeSnippet, assets };
  }, [decodeDataUrl, encodeToBase64]);

  useEffect(() => {
    const loadProfile = async () => {
      // Refresh to pick up latest user_metadata (e.g., subject updates from admin)
      const refreshed = await supabase.auth.refreshSession();
      const latestUser =
        refreshed.data.session?.user ?? (await supabase.auth.getUser()).data.user ?? null;
      const latestToken = refreshed.data.session?.access_token ?? null;
      setSessionToken(latestToken);
      if (!latestUser) {
        setIsAuthenticated(false);
        setAuthChecked(true);
        router.replace("/login");
        return;
      }
      setIsAuthenticated(true);

      // Profile fetch is best-effort; fall back to metadata even if it fails.
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, role, grade")
        .eq("id", latestUser.id)
        .maybeSingle();

      const derivedRole = profileData?.role ?? latestUser.user_metadata.role ?? "customer";
      setRole(derivedRole);
      setFullName(profileData?.full_name ?? latestUser.user_metadata.full_name ?? latestUser.email ?? "Customer");

      const gradeFromMeta =
        (profileData as { grade?: string } | null)?.grade ??
        (latestUser.user_metadata?.grade as string | undefined) ??
        null;
      if (gradeFromMeta) {
        setGradeFilter(gradeFromMeta);
        setUserGrade(gradeFromMeta);
      }

      const subjectFromMeta = (latestUser.user_metadata?.subject as string | undefined) ?? null;
      if (derivedRole === "teacher" && subjectFromMeta) {
        const normalized = normalizeSubject(subjectFromMeta);
        setSubjectFilter(normalized);
        setTeacherSubject(normalized);
      }

      // Ensure profile exists with correct role for RLS (teachers need role=teacher in profiles).
      const needsProfileUpsert =
        !profileData || (profileData.role ?? "").toLowerCase() !== derivedRole.toLowerCase();
      if (needsProfileUpsert) {
        await supabase.from("profiles").upsert({
          id: latestUser.id,
          full_name: latestUser.user_metadata?.full_name || latestUser.email || "User",
          role: derivedRole,
          grade: gradeFromMeta ?? undefined,
        });
      }

      setAuthChecked(true);

      // If an admin somehow lands here, redirect to the admin control room.
      if (derivedRole === "admin") {
        router.replace("/admin");
      }
    };
    loadProfile();
  }, [router]);

  useEffect(() => {
    if (!authChecked || !isAuthenticated) return;
    let cancelled = false;

    const loadCurriculum = async () => {
      try {
        setDataStatus("Loading activities...");
        let rows: CurriculumModule[] = [];
        if (role === "teacher" && sessionToken) {
          const res = await fetch("/api/teacher/modules", {
            headers: { Authorization: `Bearer ${sessionToken}` },
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(body?.error || "Unable to load modules");
          }
          rows = (body.modules ?? []) as CurriculumModule[];
        } else {
          rows = await fetchCurriculumModules({
            includeUnpublished: false,
            subject: role === "teacher" && teacherSubject ? teacherSubject : undefined,
          });
        }
        if (cancelled) return;
        setModules(rows.map((m) => enhanceModule(m)));
        setDataStatus(null);
      } catch {
        if (cancelled) return;
        setModules([]);
        setDataStatus("Database not reachable. No activities available.");
      }
    };

    loadCurriculum();
    return () => {
      cancelled = true;
    };
  }, [authChecked, isAuthenticated, enhanceModule, role, teacherSubject, sessionToken]);

  const markModuleSeen = useCallback((id: string) => {
    setSeenModules((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem("teacherModuleSeen", JSON.stringify(Array.from(next)));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!authChecked || !isAuthenticated || role === "teacher") return;
    let cancelled = false;

    const loadNotifications = async () => {
      try {
        setNotificationStatus("Loading notifications...");
        const { data, error } = await supabase
          .from("notifications")
          .select("id,title,message,status,created_at,module_id,subject")
          .order("created_at", { ascending: false })
          .limit(20);
        if (error) {
          throw error;
        }
        if (!cancelled) {
          setNotifications(data ?? []);
          setNotificationStatus(null);
        }
      } catch {
        if (!cancelled) {
          setNotifications([]);
          setNotificationStatus("Notifications unavailable");
        }
      }
    };

    void loadNotifications();
    return () => {
      cancelled = true;
    };
  }, [authChecked, isAuthenticated, role]);

  const markNotificationRead = useCallback(
    async (id: string) => {
      try {
        setMarkingId(id);
        const { error } = await supabase.from("notifications").update({ status: "read" }).eq("id", id);
        if (error) {
          throw error;
        }
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, status: "read" } : n)));
      } catch {
        setNotificationStatus("Could not update notification");
      } finally {
        setMarkingId(null);
      }
    },
    [],
  );

  useEffect(() => {
    if (role !== "teacher" || !sessionToken) return;
    let cancelled = false;
    const loadStudents = async () => {
      try {
        const res = await fetch("/api/teacher/students", {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setDataStatus(body?.error ?? "Unable to load students");
          return;
        }
        if (cancelled) return;
        setStudentRows(body.students ?? []);
      } catch (err) {
        if (!cancelled) setDataStatus(err instanceof Error ? err.message : "Unable to load students");
      }
    };
    void loadStudents();
    return () => {
      cancelled = true;
    };
  }, [role, sessionToken]);

  const gradeOptions = useMemo(() => {
    if (userGrade) return [userGrade];
    const uniqueGrades = Array.from(new Set(modules.map((m) => m.grade)));
    return ["all", ...uniqueGrades];
  }, [modules, userGrade]);

  const filteredModules = useMemo(() => {
    return modules.filter((m) => {
      const effectiveGrade = userGrade ?? gradeFilter;
      const gradeMatch = effectiveGrade === "all" || m.grade === effectiveGrade;
      const normalizedSubject = normalizeSubject(m.subject);
      const subjectMatch = subjectFilter === "all" || normalizedSubject === subjectFilter;
      const isDesignTech = normalizedSubject === "Design & Technology" || normalizedSubject === "Design Technology";
      const publishedMatch = role === "teacher" ? true : m.published !== false || isDesignTech;
      return gradeMatch && subjectMatch && publishedMatch;
    });
  }, [gradeFilter, subjectFilter, modules, role, userGrade]);

  const vrSubjectKey = useMemo(
    () => resolveVrSubjectKey(teacherSubject ?? subjectFilter),
    [subjectFilter, teacherSubject],
  );

  const vrItems = useMemo(() => (vrSubjectKey ? VR_SIMULATION_LIBRARY[vrSubjectKey] ?? [] : []), [vrSubjectKey]);

  const sortedStudentRows = useMemo(() => {
    const copy = [...studentRows];
    copy.sort((a, b) => {
      const aGrade = (a.grade ?? "").toLowerCase();
      const bGrade = (b.grade ?? "").toLowerCase();
      if (!aGrade && !bGrade) return 0;
      if (!aGrade) return 1;
      if (!bGrade) return -1;
      return studentSortDir === "asc" ? aGrade.localeCompare(bGrade) : bGrade.localeCompare(aGrade);
    });
    return copy;
  }, [studentRows, studentSortDir]);

  const requestMinDate = useMemo(() => {
    const today = new Date();
    const hasAnyOther = requestItems.includes(ANY_OTHER_OPTION);
    const offsetDays = requestMode === "vr" ? (hasAnyOther ? 25 : 3) : 8; // extend lead time when "Any other" is selected
    const minDate = new Date(today);
    minDate.setDate(today.getDate() + offsetDays);
    return minDate.toISOString().split("T")[0];
  }, [requestItems, requestMode]);

  const anyOtherSelected = requestItems.includes(ANY_OTHER_OPTION);
  const dateHelpText =
    requestMode === "vr"
      ? anyOtherSelected
        ? "Select a date at least 25 days from today (custom VR requests need more lead time)."
        : "Select a date at least 3 days from today (next 2 days are blocked)."
      : "Select a date at least 8 days from today; require 7 days for R&D to draft and test.";

  useEffect(() => {
    // If switching modes makes the previously selected date invalid, clear it.
    if (requestDate && requestDate < requestMinDate) {
      setRequestDate("");
    }
  }, [requestDate, requestMinDate]);

  const togglePublish = async (moduleId: string, nextPublished: boolean) => {
    if (!sessionToken) {
      setDataStatus("Missing session. Please re-login.");
      return;
    }
    try {
      setPublishingId(moduleId);
      const res = await fetch("/api/teacher/publish", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ moduleId, published: nextPublished }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDataStatus(body?.error ?? "Publish failed");
        return;
      }
      setModules((prev) =>
        prev.map((m) => (m.id === moduleId ? { ...m, published: nextPublished } : m)),
      );
      setDataStatus(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Publish failed";
      setDataStatus(message);
    } finally {
      setPublishingId(null);
    }
  };

  const toggleRequestItem = (item: string) => {
    setRequestItems((prev) => {
      const isAnyOther = item === ANY_OTHER_OPTION;
      const prevHasAnyOther = prev.includes(ANY_OTHER_OPTION);

      if (isAnyOther) {
        return prevHasAnyOther ? [] : [ANY_OTHER_OPTION];
      }

      if (prevHasAnyOther) {
        return [item];
      }

      return prev.includes(item) ? prev.filter((v) => v !== item) : [...prev, item];
    });
  };

  const resetRequestForm = () => {
    setRequestMode("vr");
    setRequestItems([]);
    setDroneConcept("");
    setRequestDate("");
    setRequestNotes("");
  };

  const closeRequestModal = () => {
    setRequestOpen(false);
    setRequestStatus(null);
  };

  const submitVrRequest = async () => {
    if (!sessionToken) {
      setRequestStatus("Missing session. Please re-login.");
      return;
    }
    if (role !== "teacher") {
      setRequestStatus("Only teachers can send requests.");
      return;
    }
    if (!vrSubjectKey) {
      setRequestStatus("Your subject is not set. Ask an admin to add your subject.");
      return;
    }
    if (requestMode === "vr" && requestItems.length === 0) {
      setRequestStatus("Select at least one VR simulation.");
      return;
    }
    if (requestMode === "vr" && anyOtherSelected && !requestNotes.trim()) {
      setRequestStatus("Describe the VR module you require in Extra notes.");
      return;
    }
    if (requestMode === "drone" && !droneConcept.trim()) {
      setRequestStatus("Describe the drone activity concept you need.");
      return;
    }
    if (!requestDate) {
      setRequestStatus("Pick the date when you need this content.");
      return;
    }
    const selectedDate = new Date(requestDate);
    const minSelectableDate = new Date(requestMinDate);
    if (selectedDate < minSelectableDate) {
      setRequestStatus(
        requestMode === "vr" && anyOtherSelected
          ? "For 'Any other' requests, pick a date at least 25 days from today."
          : "Date is earlier than the allowed window.",
      );
      return;
    }

    setSendingRequest(true);
    setRequestStatus("Sending request...");
    try {
      const res = await fetch("/api/teacher/requests", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject: vrSubjectKey,
          items: requestMode === "vr" ? requestItems : [droneConcept.trim()],
          neededBy: requestDate,
          notes: requestNotes.trim() || null,
          requestType: requestMode === "vr" ? "vr_simulation" : "drone_activity",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRequestStatus(body?.error ?? `Request failed (status ${res.status})`);
        return;
      }
      setRequestStatus("Request sent to admin.");
      resetRequestForm();
      setRequestOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to send request";
      setRequestStatus(message);
    } finally {
      setSendingRequest(false);
    }
  };

  const formatSubject = (subject: string) => normalizeSubject(subject);

  const roleLabel = role === "teacher" ? "Teacher" : "Student";
  const roleSubline = "Browse activities for your grade. View code and download files.";

  return (
    <main className="section-padding space-y-8">
      {dataStatus && (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
          {dataStatus}
        </div>
      )}

      {requestOpen && role === "teacher" && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 pb-10 pt-12 md:pt-16 bg-slate-900/70 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl bg-slate-900 border border-white/10 shadow-2xl p-6 space-y-4 glass-panel">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-accent-strong">Teacher Request</p>
                <h3 className="text-2xl font-semibold text-white">Request content</h3>
                <p className="text-sm text-slate-300">
                  {vrSubjectKey
                    ? "Pick what you need."
                    : "Add your subject in your profile to request content."}
                </p>
              </div>
              <button
                className="text-sm px-3 py-1 rounded-lg border border-black text-white hover:border-black cursor-pointer"
                onClick={() => {
                  closeRequestModal();
                  resetRequestForm();
                }}
              >
                Close
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <button
                type="button"
                className={`w-full text-left rounded-xl border px-4 py-3 transition ${
                  requestMode === "vr"
                    ? "border-accent bg-accent text-true-white font-semibold shadow-glow"
                    : "border-black/60 bg-white/5 text-slate-900 hover:border-accent"
                }`}
                onClick={() => setRequestMode("vr")}
              >
                <p
                  className={`text-sm font-semibold ${
                    requestMode === "vr" ? "text-true-white" : "text-slate-900"
                  }`}
                >
                  VR simulations
                </p>
                <p
                  className={`text-xs mt-1 ${
                    requestMode === "vr" ? "text-true-white/90" : "text-slate-900/80"
                  }`}
                >
                  Select ready-made VR labs by topic.
                </p>
              </button>
              <button
                type="button"
                className={`w-full text-left rounded-xl border px-4 py-3 transition ${
                  requestMode === "drone"
                    ? "border-accent bg-accent text-true-white font-semibold shadow-glow"
                    : "border-black/60 bg-white/5 text-slate-900 hover-border-accent"
                }`}
                onClick={() => setRequestMode("drone")}
              >
                <p
                  className={`text-sm font-semibold ${
                    requestMode === "drone" ? "text-true-white" : "text-slate-900"
                  }`}
                >
                  Drone activity
                </p>
                <p
                  className={`text-xs mt-1 ${
                    requestMode === "drone" ? "text-true-white/90" : "text-slate-900/80"
                  }`}
                >
                  Describe a concept to deliver with drones.
                </p>
              </button>
            </div>

            {requestMode === "vr" ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-200">VR simulations</p>
                {vrItems.length === 0 && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                    {vrSubjectKey
                      ? "No VR simulations listed for this subject yet. You can still request a custom one."
                      : "Subject not set; ask an admin to assign your subject."}
                  </div>
                )}
                <div className="grid sm:grid-cols-2 gap-2 max-h-72 overflow-auto pr-1">
                  {vrItems.map((item) => (
                    <label
                      key={item}
                      className={`flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 hover:border-accent-strong ${
                        anyOtherSelected ? "opacity-60" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 rounded border-slate-400/70 bg-slate-900"
                        checked={requestItems.includes(item)}
                        onChange={() => toggleRequestItem(item)}
                        disabled={anyOtherSelected}
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                  <label className="flex items-start gap-2 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-slate-100 hover:border-accent-strong">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-slate-400/70 bg-slate-900"
                      checked={anyOtherSelected}
                      onChange={() => toggleRequestItem(ANY_OTHER_OPTION)}
                    />
                    <span className="font-semibold">Any other</span>
                  </label>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-200">Drone activity concept</p>
                <textarea
                  value={droneConcept}
                  onChange={(e) => setDroneConcept(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-400/60 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none"
                  placeholder="Describe the concept or outcome you want to deliver with the drone activity."
                />
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-sm text-slate-200 space-y-2">
                Needed by
                <input
                  type="date"
                  value={requestDate}
                  onChange={(e) => setRequestDate(e.target.value)}
                  min={requestMinDate}
                  title={dateHelpText}
                  className="w-full rounded-xl border border-slate-400/60 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none"
                />
                <p className={`text-xs text-slate-400 ${requestMode === "drone" ? "font-semibold" : ""}`}>
                  {dateHelpText}
                </p>
              </label>
              <label className="text-sm text-slate-200 space-y-2">
                <span className="flex items-center gap-2">
                  <span>Extra notes</span>
                  {requestMode === "vr" && anyOtherSelected && <span className="text-rose-400">*</span>}
                  <span className="text-xs text-slate-400">
                    {requestMode === "vr" && anyOtherSelected ? "" : "(optional)"}
                  </span>
                </span>
                <textarea
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-400/60 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none"
                  placeholder={
                    requestMode === "vr" && anyOtherSelected
                      ? "Describe the VR module you require."
                      : "Describe what you need added or any context for admin."
                  }
                  aria-required={requestMode === "vr" && anyOtherSelected}
                  required={requestMode === "vr" && anyOtherSelected}
                />
              </label>
            </div>

            {requestStatus && (
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                {requestStatus}
              </div>
            )}

            <div className="flex flex-wrap gap-3 justify-end">
              <button
                className="px-4 py-2 rounded-xl border border-white/10 text-white hover:border-accent-strong"
                onClick={() => {
                  closeRequestModal();
                  resetRequestForm();
                }}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-xl bg-accent text-true-white font-semibold shadow-glow disabled:opacity-60"
                onClick={() => void submitVrRequest()}
                disabled={sendingRequest}
              >
                {sendingRequest ? "Sending..." : "Send to Admin"}
              </button>
            </div>
          </div>
        </div>
      )}


      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-accent-strong uppercase text-xs tracking-[0.2em]">{roleLabel}</p>
          <h1 className="text-3xl font-semibold text-white leading-tight">Hi {fullName}</h1>
          <p className="text-slate-300 text-sm">{roleSubline}</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/"
            className="px-4 py-2 rounded-xl border border-black/70 text-sm text-slate-900 text-center hover:border-accent-strong"
          >
            Back to Home
          </Link>
          {role === "teacher" && (
            <button
              className="px-4 py-2 rounded-xl bg-accent text-true-white font-semibold shadow-glow disabled:opacity-60"
              onClick={() => {
                setRequestStatus(null);
                setRequestOpen(true);
              }}
            >
              Raise a Request
            </button>
          )}
          {role === "teacher" && (
            <Link
              href="/teacher/progress"
              className="px-4 py-2 rounded-xl bg-accent text-true-white font-semibold shadow-glow disabled:opacity-60"
            >
              Student Progress
            </Link>
          )}
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

      {role !== "teacher" && (
        <section className="space-y-3">
          <div className="flex items-center justify-end">
            <div className="relative" ref={notificationsRef}>
              <button
                type="button"
                onClick={() => setNotificationsOpen((open) => !open)}
                className="relative inline-flex items-center justify-center h-11 w-11 rounded-full border border-white/10 bg-white/5 hover:border-accent-strong"
                aria-label="Notifications"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-6 w-6 text-white"
                >
                  <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.172V11a6 6 0 1 0-12 0v3.172a2 2 0 0 1-.6 1.428L4 17h5" />
                  <path d="M9 17a3 3 0 0 0 6 0" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-slate-900"></span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-2xl p-3 space-y-2 z-50 text-slate-900">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">Notifications</span>
                    <span className="text-xs text-slate-500">{unreadCount} unread</span>
                  </div>
                  {notificationStatus ? (
                    <div className="text-sm text-slate-600">{notificationStatus}</div>
                  ) : notifications.length === 0 ? (
                    <div className="text-sm text-slate-500">No notifications yet.</div>
                  ) : (
                    notifications.map((note) => (
                      <div
                        key={note.id}
                        className={`rounded-xl border p-3 space-y-1 ${
                          note.status === "unread"
                            ? "bg-emerald-50 border-emerald-200"
                            : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-slate-900">{note.title}</p>
                            <p className="text-xs text-slate-700">{note.message}</p>
                            <p className="text-[11px] text-slate-500">
                              {new Date(note.created_at).toLocaleString()}
                              {note.subject ? ` | ${note.subject}` : ""}
                            </p>
                          </div>
                          {note.status !== "read" && (
                            <button
                              className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-500 disabled:opacity-50"
                              onClick={() => void markNotificationRead(note.id)}
                              disabled={markingId === note.id}
                            >
                              {markingId === note.id ? "Marking..." : "Mark read"}
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-white">Browse activities</h2>
        <div className="glass-panel rounded-2xl p-4 grid sm:grid-cols-3 gap-3">
          <label className="text-sm text-slate-200 space-y-1">
            Grade
            <select
              className="w-full rounded-lg bg-white/5 border border-slate-400/60 px-3 py-2"
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              disabled={!!userGrade}
            >
              {gradeOptions.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-200 space-y-1">
            Subject
            <select
              className="w-full rounded-lg bg-white/5 border border-slate-400/60 px-3 py-2"
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              disabled={!!teacherSubject}
            >
              {teacherSubject ? (
                <option value={teacherSubject}>{formatSubject(teacherSubject)}</option>
              ) : (
                <>
                  <option value="all">All</option>
                  {Array.from(new Set(modules.map((m) => normalizeSubject(m.subject)))).map((s) => (
                    <option key={s} value={s}>
                      {formatSubject(s)}
                    </option>
                  ))}
                </>
              )}
            </select>
          </label>
          <div className="flex items-end">
            <div className="w-full rounded-xl border border-white/10 p-3 bg-white/5 text-sm text-slate-300">
              Filter activities by grade and subject; pick one to view and download code.
            </div>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">System requirements</h2>
        <div className="glass-panel rounded-2xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-base font-semibold text-slate-100">
              For first-time users, it is recommended to install all dependencies using the "<span className="underline">Download Installer</span>" before performing the activity.
            </p>
            <a
              href="https://1drv.ms/u/c/d5c868b4d9600368/IQCspO91wHTLQINVFln61jdhAaeVZC9a_i_Tl8Xd-bU4AW4?e=gqzZN6"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-true-white underline shadow-glow hover:opacity-90"
              download
            >
              Download Installer
            </a>
          </div>
        </div>
      </section>

      <section id="curriculum" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Activities</h2>
          <p className="text-sm text-slate-400">Showing {filteredModules.length} modules</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {filteredModules.map((module) => (
            <div key={module.id} className="glass-panel rounded-2xl p-5 space-y-3 hover:border-accent-strong">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] font-semibold text-accent-strong">
                <span>Grade {module.grade}</span>
                <span className="text-emerald-800">{formatSubject(module.subject)}</span>
              </div>
              {role === "teacher" && !seenModules.has(module.id) && (
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-700 text-white text-[11px] font-bold animate-pulse border border-rose-400/70 shadow-glow">
                  NEWLY ADDED
                </span>
              )}
              <h3 className="text-lg font-semibold text-white">{module.title}</h3>
              {role === "teacher" && (
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={`px-2 py-1 rounded-full font-semibold border ${
                      module.published
                        ? "bg-emerald-600 text-white border-emerald-300"
                        : "bg-amber-600 text-white border-amber-300"
                    }`}
                  >
                    {module.published ? "Published" : "Hidden from students"}
                  </span>
                  <button
                    className="px-3 py-1 rounded-lg bg-emerald-500 text-white font-semibold border border-emerald-300 shadow-glow hover:bg-emerald-400 disabled:opacity-50"
                    onClick={() => void togglePublish(module.id, !module.published)}
                    disabled={publishingId === module.id}
                  >
                    {publishingId === module.id
                      ? "Saving..."
                      : module.published
                        ? "Unpublish"
                        : "Publish"}
                  </button>
                </div>
              )}
              {progressMap[String(module.id)]?.completed ? (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-emerald-700 font-semibold">Completed</span>
                  {typeof progressMap[String(module.id)].score === "number" && (
                    <span className="px-2 py-1 rounded-full bg-white/10 text-slate-200 border border-white/15">
                      Score {progressMap[String(module.id)].score}/{progressMap[String(module.id)].total || 5}
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400">Not completed</p>
              )}
              <Link
                href={`/customer/activity/${module.id}`}
                className="block w-full text-center mt-2 py-2 rounded-lg bg-accent text-true-white font-semibold"
                onClick={() => markModuleSeen(module.id)}
              >
                Show activity/code
              </Link>
            </div>
          ))}
        </div>
      </section>

      {role === "teacher" && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Students (subject-matched)</h2>
            <div className="flex items-center gap-3">
              <p className="text-sm text-slate-400">{sortedStudentRows.length} visible</p>
              <button
                className="px-3 py-1 rounded-lg border border-white/10 text-white text-xs hover:border-accent-strong"
                onClick={() => setStudentSortDir((prev) => (prev === "asc" ? "desc" : "asc"))}
              >
                Sort by Grade ({studentSortDir === "asc" ? "A→Z" : "Z→A"})
              </button>
            </div>
          </div>
          <div className="glass-panel rounded-2xl p-4 overflow-auto">
            <table className="min-w-full text-sm text-slate-200">
              <thead>
                <tr className="text-left text-slate-400 border-b border-white/10">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Grade</th>
                </tr>
              </thead>
              <tbody>
                {sortedStudentRows.length === 0 ? (
                  <tr>
                    <td className="py-2 pr-3 text-slate-300" colSpan={3}>
                      No students found for this subject yet.
                    </td>
                  </tr>
                ) : (
                  sortedStudentRows.map((student) => (
                    <tr key={student.id} className="border-b border-white/5">
                      <td className="py-2 pr-3 font-semibold text-white">{student.full_name}</td>
                      <td className="py-2 pr-3 text-slate-300">{student.email ?? "—"}</td>
                      <td className="py-2 pr-3 text-slate-300">{student.grade ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

    </main>
  );
}









