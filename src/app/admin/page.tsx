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
import {
  dataUrlToFile,
  fetchCurriculumModules,
  fetchProducts,
  uploadFileToBucket,
} from "@/lib/supabaseData";
import { UploadCurriculumView } from "@/components/admin/UploadCurriculumView";
import { AdminQuestionsView } from "@/components/admin/AdminQuestionsView";
import { SIMULATION_LIBRARY_TOTAL, SimulationLibraryView } from "@/components/admin/SimulationLibraryView";
import { logActivity } from "@/lib/activityLogger";
import { GuidedTour, type GuidedTourStep } from "@/components/GuidedTour";
import { playUiClickTone } from "@/lib/uiTone";
import {
  isDesignTechnologySubject,
  normalizeVrSubjectKey,
  VR_SUBJECT_ORDER,
} from "@/lib/vrModules";
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
const ADMIN_TOUR_STORAGE_KEY = "admin_feature_tour_v1";
const ADMIN_TOUR_INITIAL_STEP_ID = "admin-header";
const ADMIN_TOUR_PALETTE = {
  accent: "#f97316",
  accentStrong: "#9a3412",
} as const;
const ADMIN_TOUR_BOOT_SELECTORS = [
  '[data-tour="admin-header"]',
  '[data-tour="admin-notification-bell"]',
  '[data-tour="admin-menu-trigger"]',
  '[data-tour="admin-stats"]',
  '[data-tour="admin-ribbon"]',
  '[data-tour="admin-drone-section"]',
] as const;

const gradeOptions = ["Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"];
const subjectOptions = ["Physics", "Mathematics", "Computer Science", "Environment System & Society (ESS)", "Design Technology"];

const isMissingTableSchemaCacheError = (message: string) =>
  message.toLowerCase().includes("schema cache") && message.toLowerCase().includes("could not find the table");

const formatPrice = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    value,
  );

const formatJoinedDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString() : "-");
const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString() : "-");
const sanitizeSegment = (value: string) =>
  value.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "item";
const decodeDataUrl = (url?: string) => {
  if (!url || !url.startsWith("data:")) return null;
  const commaIndex = url.indexOf(",");
  if (commaIndex === -1) return null;
  const meta = url.slice(0, commaIndex);
  const payload = url.slice(commaIndex + 1);
  try {
    if (meta.includes(";base64")) return decodeURIComponent(escape(atob(payload)));
    return decodeURIComponent(payload);
  } catch {
    return null;
  }
};
const encodeToBase64 = (text: string) => {
  try {
    return btoa(unescape(encodeURIComponent(text)));
  } catch {
    return btoa(text);
  }
};
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
const getTeacherRequestTypeMeta = (requestType?: string | null) => {
  const normalized = (requestType ?? "").trim().toLowerCase();
  if (!normalized || normalized.includes("vr") || normalized.includes("simulation")) {
    return {
      label: "VR",
      badgeClass: "bg-sky-600/80 border-sky-300 text-white",
    };
  }
  if (normalized.includes("drone")) {
    return {
      label: "Drone Activity",
      badgeClass: "bg-amber-600/80 border-amber-300 text-white",
    };
  }
  return {
    label: requestType?.replace(/[_-]+/g, " ").trim() || "Unknown",
    badgeClass: "bg-slate-600/80 border-slate-300 text-white",
  };
};

type SentimentFile = {
  moduleId: string;
  moduleTitle: string;
  studentLabel: string;
  fileName: string;
  path: string;
  url: string;
  createdAt?: string | null;
};

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

type SalesInquiry = {
  id: string;
  name: string;
  email: string;
  school?: string | null;
  message: string;
  status?: string | null;
  source_page?: string | null;
  created_at?: string | null;
};

type VrModuleRow = {
  id: string;
  subject: string;
  module_name: string;
  created_at?: string | null;
};

type TeacherModuleApiRow = {
  id: string;
  title: string;
  grade: string;
  subject: string;
  module: string;
  description: string | null;
  judging_logic?: string | null;
  asset_urls?: unknown;
  assets?: unknown;
  price_yearly?: number | null;
  published?: boolean | null;
};

const mapTeacherModuleRow = (row: TeacherModuleApiRow): CurriculumModule => {
  const assets = Array.isArray(row.asset_urls)
    ? (row.asset_urls as CurriculumModule["assets"])
    : Array.isArray(row.assets)
      ? (row.assets as CurriculumModule["assets"])
      : [];
  return {
    id: row.id,
    title: row.title,
    grade: row.grade,
    subject: row.subject,
    module: row.module,
    description: row.description ?? "",
    judgingLogic: row.judging_logic ?? "",
    assets,
    priceYearly: row.price_yearly ?? undefined,
    published: row.published ?? undefined,
  };
};

type AdminRibbonSection =
  | "drone"
  | "vrModules"
  | "simulations"
  | "upload"
  | "questions"
  | "products"
  | "sentiment"
  | "users"
  | "orders";

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<string | null>(null);
  const [signingOut, startSignOut] = useTransition();
  const router = useRouter();
  const [fullName, setFullName] = useState("Admin");
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
  const curriculumCodeEditRef = useRef<HTMLDivElement | null>(null);
  const [dataStatus, setDataStatus] = useState<string | null>(null);
  const [sentimentStatus, setSentimentStatus] = useState<string | null>(null);
  const [teacherRequests, setTeacherRequests] = useState<TeacherRequest[]>([]);
  const [teacherRequestStatus, setTeacherRequestStatus] = useState<string | null>(null);
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);
  const [showTeacherRequests, setShowTeacherRequests] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const adminMenuRef = useRef<HTMLDivElement | null>(null);
  const [adminNotificationsOpen, setAdminNotificationsOpen] = useState(false);
  const adminNotificationsRef = useRef<HTMLDivElement | null>(null);
  const lastScrollYRef = useRef(0);
  const statsExpandGuardUntilRef = useRef(0);
  const [salesInquiries, setSalesInquiries] = useState<SalesInquiry[]>([]);
  const [salesInquiryStatus, setSalesInquiryStatus] = useState<string | null>(null);
  const [updatingSalesInquiryId, setUpdatingSalesInquiryId] = useState<string | null>(null);
  const [showSalesInquiries, setShowSalesInquiries] = useState(false);
  const [vrModuleRows, setVrModuleRows] = useState<VrModuleRow[]>([]);
  const [vrModuleStatus, setVrModuleStatus] = useState<string | null>(null);
  const [vrModuleDraftBySubject, setVrModuleDraftBySubject] = useState<Record<string, string>>({});
  const [savingVrSubject, setSavingVrSubject] = useState<string | null>(null);
  const [savingVrModuleId, setSavingVrModuleId] = useState<string | null>(null);
  const [deletingVrModuleId, setDeletingVrModuleId] = useState<string | null>(null);
  const [activeAdminSection, setActiveAdminSection] = useState<AdminRibbonSection>("drone");
  const [adminTourRun, setAdminTourRun] = useState(false);
  const [adminTourInitialized, setAdminTourInitialized] = useState(false);
  const [adminTourActiveStepId, setAdminTourActiveStepId] = useState<string | null>(null);
  const [adminTourLockedSteps, setAdminTourLockedSteps] = useState<GuidedTourStep[] | null>(null);
  const [adminTourPromptOpen, setAdminTourPromptOpen] = useState(false);
  const [adminTourUiReady, setAdminTourUiReady] = useState(false);
  const adminTourPromptOverlayRef = useRef<HTMLDivElement | null>(null);
  const adminTourPromptCardRef = useRef<HTMLDivElement | null>(null);
  const adminTourPromptButtonRef = useRef<HTMLButtonElement | null>(null);
  const [statsExpanded, setStatsExpanded] = useState(true);
  const [droneSearchInput, setDroneSearchInput] = useState("");
  const [droneSearchQuery, setDroneSearchQuery] = useState("");
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [userForm, setUserForm] = useState({ full_name: "", role: "student", grade: "", subject: "" });
  const [sopFile, setSopFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [codeFile, setCodeFile] = useState<File | null>(null);
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
    videoLabel: "",
    sopLabel: "",
    codeLabel: "",
    codeSnippet: "",
  });
  const unreadTeacherRequestItems = useMemo(
    () => teacherRequests.filter((req) => (req.status ?? "pending") !== "done"),
    [teacherRequests],
  );
  const unreadSalesInquiryItems = useMemo(
    () => salesInquiries.filter((item) => (item.status ?? "new") === "new"),
    [salesInquiries],
  );
  const unreadTeacherRequests = unreadTeacherRequestItems.length;
  const unreadSalesInquiries = unreadSalesInquiryItems.length;
  const unreadNotifications = useMemo(() => {
    const teacherItems = unreadTeacherRequestItems.map((req) => {
      const typeMeta = getTeacherRequestTypeMeta(req.request_type);
      return {
        key: `teacher-${req.id}`,
        kind: "teacher_request" as const,
        title: req.teacher_name ? `Teacher request from ${req.teacher_name}` : "Teacher request",
        detail: [typeMeta.label, req.subject, req.needed_by ? `Needed by ${formatJoinedDate(req.needed_by)}` : null]
          .filter(Boolean)
          .join(" | "),
        createdAt: req.created_at ?? null,
      };
    });
    const salesItems = unreadSalesInquiryItems.map((item) => ({
      key: `sales-${item.id}`,
      kind: "sales_query" as const,
      title: `Sales query from ${item.name}`,
      detail: item.email,
      createdAt: item.created_at ?? null,
    }));

    return [...teacherItems, ...salesItems].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [unreadTeacherRequestItems, unreadSalesInquiryItems]);
  const unreadNotificationCount = unreadNotifications.length;
  const vrSubjects = useMemo(() => {
    const values = new Set<string>(VR_SUBJECT_ORDER);
    vrModuleRows.forEach((row) => {
      const rawSubject = row.subject?.trim() ?? "";
      if (!rawSubject || isDesignTechnologySubject(rawSubject)) return;
      const normalized = normalizeVrSubjectKey(rawSubject) ?? rawSubject;
      if (normalized) values.add(normalized);
    });
    return Array.from(values).sort((a, b) => {
      const aIndex = VR_SUBJECT_ORDER.indexOf(a as (typeof VR_SUBJECT_ORDER)[number]);
      const bIndex = VR_SUBJECT_ORDER.indexOf(b as (typeof VR_SUBJECT_ORDER)[number]);
      const aRank = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
      const bRank = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
      if (aRank !== bRank) return aRank - bRank;
      return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
    });
  }, [vrModuleRows]);
  const vrModulesBySubject = useMemo(() => {
    const grouped: Record<string, VrModuleRow[]> = {};
    vrSubjects.forEach((subject) => {
      grouped[subject] = [];
    });
    vrModuleRows.forEach((row) => {
      const rawSubject = row.subject?.trim() ?? "";
      if (!rawSubject || isDesignTechnologySubject(rawSubject)) return;
      const subject = normalizeVrSubjectKey(rawSubject) ?? rawSubject;
      if (!subject) return;
      if (!grouped[subject]) grouped[subject] = [];
      grouped[subject].push(row);
    });
    Object.keys(grouped).forEach((subject) => {
      grouped[subject] = [...(grouped[subject] ?? [])].sort((a, b) =>
        (a.module_name ?? "").localeCompare(b.module_name ?? "", undefined, {
          sensitivity: "base",
          numeric: true,
        }),
      );
    });
    return grouped;
  }, [vrModuleRows, vrSubjects]);
  const isTeacher = role === "teacher";
  const canEditCurriculum = isAdmin || isTeacher;
  const dashboardRoleLabel = isAdmin ? "Admin" : isTeacher ? "Teacher" : "User";
  const ribbonSections: Array<{ id: AdminRibbonSection; label: string; adminOnly?: boolean }> = [
    { id: "drone", label: "Drone Activity" },
    { id: "vrModules", label: "VR Modules", adminOnly: true },
    { id: "simulations", label: "Simulations", adminOnly: true },
    { id: "upload", label: "Upload Content", adminOnly: true },
    { id: "questions", label: "Manage Questions" },
    { id: "sentiment", label: "Sentiment Summaries" },
    { id: "users", label: "Reg Users" },
    { id: "products", label: "Product Catalogue" },
    { id: "orders", label: "Orders" },
  ];
  const renderRibbonIcon = (sectionId: AdminRibbonSection) => {
    switch (sectionId) {
      case "drone":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-4 w-4">
            <path d="M12 10v4" />
            <path d="M10 12h4" />
            <path d="M5 5l4 4" />
            <path d="M19 5l-4 4" />
            <path d="M5 19l4-4" />
            <path d="M19 19l-4-4" />
            <circle cx="5" cy="5" r="2.5" />
            <circle cx="19" cy="5" r="2.5" />
            <circle cx="5" cy="19" r="2.5" />
            <circle cx="19" cy="19" r="2.5" />
          </svg>
        );
      case "vrModules":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-4 w-4">
            <rect x="2.5" y="8" width="19" height="8" rx="3" />
            <circle cx="8" cy="12" r="1.8" />
            <circle cx="16" cy="12" r="1.8" />
            <path d="M12 8v-2" />
            <path d="M8 6h8" />
          </svg>
        );
      case "upload":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-4 w-4">
            <path d="M12 16V4" />
            <path d="m7 9 5-5 5 5" />
            <path d="M4 20h16" />
          </svg>
        );
      case "simulations":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-4 w-4">
            <path d="M7 4h10" />
            <path d="M9 4v3l-4.5 8a3 3 0 0 0 2.6 4.5h10.8a3 3 0 0 0 2.6-4.5L16 7V4" />
            <path d="M8 13h8" />
            <path d="M10 16h4" />
          </svg>
        );
      case "questions":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-4 w-4">
            <path d="M12 18h.01" />
            <path d="M9.2 9.6a2.8 2.8 0 1 1 5.6 0c0 1.7-2.8 2.2-2.8 4.2" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        );
      case "products":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-4 w-4">
            <path d="M3 7h18l-2 11H5L3 7Z" />
            <path d="M8 7V5a4 4 0 0 1 8 0v2" />
          </svg>
        );
      case "sentiment":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-4 w-4">
            <path d="M4 20h16" />
            <path d="M6 16l3-4 3 2 4-6 2 2" />
          </svg>
        );
      case "users":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-4 w-4">
            <circle cx="9" cy="8" r="3" />
            <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
            <circle cx="17" cy="9" r="2.5" />
            <path d="M14.5 19a4 4 0 0 1 6 0" />
          </svg>
        );
      case "orders":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-4 w-4">
            <path d="M3 6h15l2 10H5L3 6Z" />
            <circle cx="9" cy="19" r="1.5" />
            <circle cx="17" cy="19" r="1.5" />
          </svg>
        );
      default:
        return null;
    }
  };
  const renderSectionRibbonButton = (section: { id: AdminRibbonSection; label: string; adminOnly?: boolean }) => {
    const isActive = activeAdminSection === section.id;
    const isDisabled = section.adminOnly && !isAdmin;
    const buttonClass = isDisabled
      ? "bg-stone-100/85 text-stone-400 border-stone-300/70 ring-black/5 cursor-not-allowed"
      : isActive
        ? "bg-amber-100 text-slate-900 border-amber-300 shadow-[0_8px_18px_rgba(120,113,108,0.18)] ring-black/20"
        : "bg-white/85 text-slate-700 border-stone-200 ring-black/10 hover:border-stone-400 hover:bg-white hover:ring-black/20";
    const iconClass = isDisabled
      ? "bg-stone-100 border-stone-300/80 text-stone-400"
      : isActive
        ? "bg-amber-200/70 border-amber-300 text-amber-900"
        : "bg-stone-100 border-stone-300/80 text-slate-700 group-hover:bg-stone-200";
    return (
      <button
        key={section.id}
        type="button"
        onClick={() => {
          if (isDisabled) return;
          setActiveAdminSection(section.id);
        }}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        className={`group relative shrink-0 inline-flex items-center gap-2 rounded-2xl border ring-1 ring-inset px-4 py-2.5 text-sm font-semibold transition-all ${buttonClass}`}
      >
        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border ${iconClass}`}>
          {renderRibbonIcon(section.id)}
        </span>
        {section.label}
      </button>
    );
  };
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

  const loadSalesInquiries = useCallback(async () => {
    if (!isAdmin) return;
    setSalesInquiryStatus("Loading sales queries...");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setSalesInquiryStatus("No active session; please sign in again.");
        return;
      }

      const response = await fetch("/api/sales-inquiries", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await response.json().catch(() => ({}))) as { inquiries?: SalesInquiry[]; error?: string };
      if (!response.ok) {
        setSalesInquiryStatus(body?.error ?? `Failed to load sales queries (status ${response.status}).`);
        setSalesInquiries([]);
        return;
      }

      setSalesInquiries(body.inquiries ?? []);
      setSalesInquiryStatus(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load sales queries";
      setSalesInquiryStatus(message);
      setSalesInquiries([]);
    }
  }, [isAdmin]);

  const loadVrModules = useCallback(async () => {
    if (!isAdmin) return;
    setVrModuleStatus("Loading VR modules...");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setVrModuleStatus("No active session; please sign in again.");
        setVrModuleRows([]);
        return;
      }

      const response = await fetch("/api/admin/vr-modules", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await response.json().catch(() => ({}))) as { modules?: VrModuleRow[]; error?: string };
      if (!response.ok) {
        setVrModuleStatus(body?.error ?? `Unable to load VR modules (status ${response.status}).`);
        setVrModuleRows([]);
        return;
      }

      setVrModuleRows(body.modules ?? []);
      setVrModuleStatus(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load VR modules";
      setVrModuleStatus(message);
      setVrModuleRows([]);
    }
  }, [isAdmin]);

  const addVrModuleForSubject = useCallback(
    async (subject: string) => {
      if (!isAdmin) return;
      const moduleName = (vrModuleDraftBySubject[subject] ?? "").trim();
      if (!moduleName) {
        setVrModuleStatus(`Enter a module name for ${subject}.`);
        return;
      }

      setSavingVrSubject(subject);
      setVrModuleStatus(`Uploading "${moduleName}"...`);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) {
          setVrModuleStatus("No active session; please sign in again.");
          return;
        }

        const response = await fetch("/api/admin/vr-modules", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ subject, moduleName }),
        });
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          setVrModuleStatus(body?.error ?? `Unable to upload module (status ${response.status}).`);
          return;
        }

        setVrModuleDraftBySubject((prev) => ({ ...prev, [subject]: "" }));
        await loadVrModules();
        setVrModuleStatus(`Uploaded "${moduleName}" under ${subject}.`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to upload module";
        setVrModuleStatus(message);
      } finally {
        setSavingVrSubject(null);
      }
    },
    [isAdmin, loadVrModules, vrModuleDraftBySubject],
  );

  const editVrModule = useCallback(
    async (row: VrModuleRow) => {
      if (!isAdmin) return;
      const currentModuleName = row.module_name?.trim() ?? "";
      const nextModuleNameRaw = window.prompt(`Edit VR module for ${row.subject}`, currentModuleName);
      if (nextModuleNameRaw === null) return;

      const nextModuleName = nextModuleNameRaw.trim();
      if (!nextModuleName) {
        setVrModuleStatus("Module name is required.");
        return;
      }
      if (nextModuleName === currentModuleName) return;

      setSavingVrModuleId(row.id);
      setVrModuleStatus(`Updating "${currentModuleName}"...`);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) {
          setVrModuleStatus("No active session; please sign in again.");
          return;
        }

        const response = await fetch("/api/admin/vr-modules", {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id: row.id, moduleName: nextModuleName }),
        });
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          setVrModuleStatus(body?.error ?? `Unable to update module (status ${response.status}).`);
          return;
        }

        await loadVrModules();
        setVrModuleStatus(`Updated module to "${nextModuleName}".`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to update module";
        setVrModuleStatus(message);
      } finally {
        setSavingVrModuleId(null);
      }
    },
    [isAdmin, loadVrModules],
  );

  const deleteVrModule = useCallback(
    async (row: VrModuleRow) => {
      if (!isAdmin) return;
      const shouldDelete = window.confirm(`Delete "${row.module_name}" from ${row.subject}?`);
      if (!shouldDelete) return;

      setDeletingVrModuleId(row.id);
      setVrModuleStatus(`Deleting "${row.module_name}"...`);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) {
          setVrModuleStatus("No active session; please sign in again.");
          return;
        }

        const response = await fetch("/api/admin/vr-modules", {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id: row.id }),
        });
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          setVrModuleStatus(body?.error ?? `Unable to delete module (status ${response.status}).`);
          return;
        }

        await loadVrModules();
        setVrModuleStatus(`Deleted "${row.module_name}".`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to delete module";
        setVrModuleStatus(message);
      } finally {
        setDeletingVrModuleId(null);
      }
    },
    [isAdmin, loadVrModules],
  );

  const updateTeacherRequestStatus = useCallback(
    async (id: string, nextStatus: string) => {
      if (!isAdmin) return;
      setUpdatingRequestId(id);
      try {
        const { error } = await supabase
          .from("teacher_requests")
          .update({ status: nextStatus })
          .eq("id", id);
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

  const updateSalesInquiryStatus = useCallback(
    async (id: string, nextStatus: "new" | "reviewed" | "closed") => {
      if (!isAdmin) return;
      setUpdatingSalesInquiryId(id);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) {
          setSalesInquiryStatus("No active session; please sign in again.");
          return;
        }

        const response = await fetch("/api/sales-inquiries", {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id, status: nextStatus }),
        });
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          setSalesInquiryStatus(body?.error ?? `Unable to update query (status ${response.status}).`);
          return;
        }

        setSalesInquiries((prev) => prev.map((item) => (item.id === id ? { ...item, status: nextStatus } : item)));
        setSalesInquiryStatus(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to update query";
        setSalesInquiryStatus(message);
      } finally {
        setUpdatingSalesInquiryId(null);
      }
    },
    [isAdmin],
  );
  const stats = useMemo(
    () => {
      const teacherUsersCount = userRows.filter((user) => mapRoleLabel(user.role) === "Teacher").length;
      const studentUsersCount = userRows.filter((user) => mapRoleLabel(user.role) === "Student").length;

      return [
        {
          label: "Active modules",
          value: "",
          delta: "",
          breakdown: [
            { label: "Drone", value: String(curriculumRows.length) },
            { label: "VR", value: String(vrModuleRows.length) },
          ],
        },
        { label: "SIMULATIONS LIVE", value: String(SIMULATION_LIBRARY_TOTAL), delta: "" },
        { label: "STEAM-H Project", value: "97", delta: "Student showcase entries" },
        {
          label: "Registered users",
          value: "",
          delta: "",
          breakdown: [
            { label: "Teacher", value: String(teacherUsersCount) },
            { label: "Student", value: String(studentUsersCount) },
          ],
        },
      ];
    },
    [curriculumRows.length, vrModuleRows.length, userRows],
  );

  const userLookup = useMemo(() => {
    const map = new Map<string, AdminUser>();
    userRows.forEach((u) => map.set(u.id, u));
    return map;
  }, [userRows]);

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

  const filteredCurriculumRows = useMemo(() => {
    const query = droneSearchQuery.trim().toLowerCase();
    if (!query) return curriculumRows;
    return curriculumRows.filter((item) => {
      const assetLabels = (item.assets ?? []).map((asset) => asset.label).join(" ");
      const haystack = [
        item.title,
        item.grade,
        item.subject,
        item.module,
        item.description,
        assetLabels,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [curriculumRows, droneSearchQuery]);
  const openCurriculumEditor = useCallback((item: CurriculumModule, focusCode = false) => {
    const docAsset = item.assets.find((a) => a.type === "doc") || null;
    const videoAsset = item.assets.find((a) => a.type === "video") || null;
    const codeAsset = item.assets.find((a) => a.type === "code") || null;
    const otherAssets = item.assets.filter((a) => a.type !== "doc" && a.type !== "video" && a.type !== "code");
    setEditingCurriculumId(item.id);
    setCurriculumForm({
      title: item.title,
      grade: item.grade,
      subject: item.subject,
      module: item.module,
      description: item.description,
      assets: otherAssets.map((a) => a.label).join(", "),
      videoLabel: videoAsset?.label ?? "",
      sopLabel: docAsset?.label ?? "",
      codeLabel: codeAsset?.label ?? "",
      codeSnippet: decodeDataUrl(codeAsset?.url) ?? "",
    });
    setSopFile(null);
    setVideoFile(null);
    setCodeFile(null);
    requestAnimationFrame(() => {
      curriculumEditRef.current?.scrollIntoView({ behavior: "smooth" });
      if (focusCode) {
        requestAnimationFrame(() => {
          curriculumCodeEditRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    });
  }, []);

  const runDroneSearch = useCallback(() => {
    setDroneSearchQuery(droneSearchInput.trim());
  }, [droneSearchInput]);

  const clearDroneSearch = useCallback(() => {
    setDroneSearchInput("");
    setDroneSearchQuery("");
  }, []);

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

  const loadData = useCallback(
    async (statusLabel = "Refreshing data...") => {
      if (!canEditCurriculum) return;
      setDataStatus(statusLabel);
      try {
        const curriculumPromise: Promise<CurriculumModule[]> = isTeacher
          ? (async () => {
              const { data: sessionData } = await supabase.auth.getSession();
              const token = sessionData.session?.access_token ?? null;
              if (!token) {
                return fetchCurriculumModules({ includeUnpublished: true });
              }
              const res = await fetch("/api/teacher/modules", {
                headers: { Authorization: `Bearer ${token}` },
              });
              const body = (await res.json().catch(() => ({}))) as {
                modules?: unknown;
                error?: string;
              };
              if (!res.ok) {
                throw new Error(body?.error ?? `Unable to load modules (status ${res.status})`);
              }
              const rows = Array.isArray(body.modules)
                ? (body.modules as TeacherModuleApiRow[])
                : [];
              return rows.map(mapTeacherModuleRow);
            })()
          : fetchCurriculumModules({ includeUnpublished: true });
        const [nextCurriculum, nextProducts] = await Promise.all([
          curriculumPromise,
          isAdmin ? fetchProducts() : Promise.resolve([] as Product[]),
        ]);

        setCurriculumRows(nextCurriculum);
        setProductRows(isAdmin ? nextProducts : []);
        if (isAdmin) {
          await reloadUsers();
          await loadTeacherRequests();
          await loadSalesInquiries();
          await loadVrModules();
        } else {
          setUserRows([]);
          setUserCount(null);
          setTeacherRequests([]);
          setTeacherRequestStatus(null);
          setSalesInquiries([]);
          setSalesInquiryStatus(null);
          setVrModuleRows([]);
          setVrModuleStatus(null);
        }
        setDataStatus(null);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : err && typeof err === "object" && "message" in err && typeof (err as { message?: unknown }).message === "string"
              ? (err as { message: string }).message
              : "Unable to load data";
        setCurriculumRows([]);
        setProductRows([]);
        setUserRows([]);
        setUserCount(null);
        setTeacherRequests([]);
        setTeacherRequestStatus(message);
        setSalesInquiries([]);
        setSalesInquiryStatus(message);
        setVrModuleRows([]);
        setVrModuleStatus(message);
        const setupHint = isMissingTableSchemaCacheError(message)
          ? " Apply `supabase/schema.sql` in your Supabase SQL editor, then retry."
          : "";
        setDataStatus(`Unable to load shared data (${message}).${setupHint}`);
      }
    },
    [canEditCurriculum, isAdmin, isTeacher, loadSalesInquiries, loadTeacherRequests, loadVrModules, reloadUsers],
  );

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
  }, [editingUser, reloadUsers, userForm.grade, userForm.full_name, userForm.role, userForm.subject]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
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
        setAuthStatus(`Unable to verify admin access: ${error.message}${setupHint ? ` Ã¢â‚¬â€ ${setupHint}` : ""}`);
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
      } catch {
        setAuthStatus("Unable to verify admin access right now. Check your internet and refresh.");
        setIsAdmin(false);
      }
    };
    void loadProfile();
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (cancelled) return;
      await loadData("Loading shared data...");
    })();
    return () => {
      cancelled = true;
    };
  }, [loadData]);

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

  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      if (!adminMenuOpen) return;
      const target = event.target as Node | null;
      if (adminMenuRef.current && target && !adminMenuRef.current.contains(target)) {
        setAdminMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [adminMenuOpen]);

  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      if (!adminNotificationsOpen) return;
      const target = event.target as Node | null;
      if (adminNotificationsRef.current && target && !adminNotificationsRef.current.contains(target)) {
        setAdminNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [adminNotificationsOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    lastScrollYRef.current = window.scrollY;
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (Date.now() < statsExpandGuardUntilRef.current) {
        lastScrollYRef.current = currentScrollY;
        return;
      }
      if (currentScrollY > lastScrollYRef.current + 4) {
        setStatsExpanded(false);
      }
      lastScrollYRef.current = currentScrollY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const openTeacherRequestsModal = () => {
    setShowTeacherRequests(true);
    void loadTeacherRequests();
    if (typeof window !== "undefined") {
      requestAnimationFrame(() => {
        document.getElementById("teacher-requests")?.scrollIntoView({ behavior: "smooth" });
      });
    }
  };

  const openSalesInquiriesModal = () => {
    setShowSalesInquiries(true);
    void loadSalesInquiries();
    if (typeof window !== "undefined") {
      requestAnimationFrame(() => {
        document.getElementById("sales-inquiries")?.scrollIntoView({ behavior: "smooth" });
      });
    }
  };

  const expandStatsCards = useCallback(() => {
    setStatsExpanded(true);
    if (typeof window !== "undefined") {
      lastScrollYRef.current = window.scrollY;
      statsExpandGuardUntilRef.current = Date.now() + 350;
    }
  }, []);

  useEffect(() => {
    if (activeAdminSection !== "products" && editingId) {
      setEditingId(null);
    }
    if (activeAdminSection !== "drone" && editingCurriculumId) {
      setEditingCurriculumId(null);
      setSopFile(null);
      setVideoFile(null);
    }
    if (activeAdminSection !== "users" && editingUser) {
      setEditingUser(null);
      setUserEditStatus(null);
      setUserPopover(null);
    }
  }, [activeAdminSection, editingCurriculumId, editingId, editingUser]);

  const adminTourComputedSteps = useMemo<GuidedTourStep[]>(() => {
    if (!isAdmin) return [];

    return [
      {
        id: "admin-header",
        target: '[data-tour="admin-header"]',
        title: "Admin Control Header",
        description: "This top bar gives you fast access to notifications, menu actions, and dashboard context.",
        placement: "bottom",
      },
      {
        id: "admin-stats",
        target: '[data-tour="admin-stats"]',
        title: "KPI Cards",
        description: "These cards summarize live platform metrics at a glance.",
        placement: "bottom",
        padding: 20,
        scrollBlock: "start",
        forcePageTop: true,
      },
      {
        id: "admin-ribbon",
        target: '[data-tour="admin-ribbon"]',
        title: "Section Ribbon",
        description: "Switch among drone activities, VR modules, users, products, and more from this ribbon.",
        placement: "bottom",
        padding: 24,
        scrollBlock: "start",
        forcePageTop: true,
      },
      {
        id: "admin-drone-section",
        target: '[data-tour="admin-drone-section"]',
        title: "Drone Activity Section",
        description: "Manage curriculum entries and activity metadata here.",
        placement: "bottom",
        padding: 24,
      },
      {
        id: "admin-vr-modules-section",
        target: '[data-tour="admin-vr-modules-section"]',
        title: "VR Modules Section",
        description: "Create, edit, and delete VR modules by subject in this workspace.",
        placement: "top",
      },
      {
        id: "admin-upload-section",
        target: '[data-tour="admin-upload-section"]',
        title: "Upload Content Section",
        description: "Upload and publish curriculum files from this section.",
        placement: "top",
      },
      {
        id: "admin-questions-section",
        target: '[data-tour="admin-questions-section"]',
        title: "Manage Questions Section",
        description: "Review and update assessment questions from this panel.",
        placement: "top",
      },
      {
        id: "admin-sentiment-section",
        target: '[data-tour="admin-sentiment-section"]',
        title: "Sentiment Summaries Section",
        description: "Track generated sentiment reports and open or remove files here.",
        placement: "top",
      },
      {
        id: "admin-users-section",
        target: '[data-tour="admin-users-section"]',
        title: "Registered Users Section",
        description: "Review and update user profiles, roles, and basic attributes.",
        placement: "top",
      },
      {
        id: "admin-products-section",
        target: '[data-tour="admin-products-section"]',
        title: "Product Catalogue Section",
        description: "Maintain product listings, pricing, and inventory details here.",
        placement: "top",
      },
      {
        id: "admin-orders-section",
        target: '[data-tour="admin-orders-section"]',
        title: "Orders Section",
        description: "Track order-related actions and monitor delivery status updates.",
        placement: "top",
      },
      {
        id: "admin-notification-bell",
        target: '[data-tour="admin-notification-bell"]',
        title: "Notification Bell",
        description: "Open this bell to monitor unread teacher requests and sales queries.",
        placement: "left",
        forcePageTop: true,
      },
      {
        id: "admin-notification-panel",
        target: '[data-tour="admin-notification-panel"]',
        title: "Notification Panel",
        description: "Unread operational alerts are grouped in this panel.",
        placement: "left",
        forcePageTop: true,
      },
      {
        id: "admin-menu-trigger",
        target: '[data-tour="admin-menu-trigger"]',
        title: "Admin Menu",
        description: "Open this menu for quick control-room workflows.",
        placement: "left",
        forcePageTop: true,
      },
      {
        id: "admin-menu-panel",
        target: '[data-tour="admin-menu-panel"]',
        title: "Admin Action Panel",
        description: "This panel centralizes requests, queries, analytics, and sign-out actions.",
        placement: "left",
        forcePageTop: true,
      },
      {
        id: "admin-menu-teacher-requests",
        target: '[data-tour="admin-menu-teacher-requests"]',
        title: "Teacher Requests Shortcut",
        description: "Jump into pending teacher content requests directly from here.",
        placement: "left",
      },
      {
        id: "admin-teacher-requests-modal",
        target: '[data-tour="admin-teacher-requests-modal"]',
        title: "Teacher Requests Workspace",
        description: "Review requested items, needed-by dates, and status updates in this workspace.",
        placement: "top",
      },
      {
        id: "admin-menu-sales-queries",
        target: '[data-tour="admin-menu-sales-queries"]',
        title: "Sales Queries Shortcut",
        description: "Open inbound sales conversations requiring follow-up.",
        placement: "left",
      },
      {
        id: "admin-sales-inquiries-modal",
        target: '[data-tour="admin-sales-inquiries-modal"]',
        title: "Sales Queries Workspace",
        description: "Track and update sales inquiry statuses from this modal.",
        placement: "top",
      },
      {
        id: "admin-menu-user-analytics",
        target: '[data-tour="admin-menu-user-analytics"]',
        title: "User Analytics",
        description: "Use this link to inspect login activity and engagement insights.",
        placement: "left",
      },
      {
        id: "admin-menu-signout",
        target: '[data-tour="admin-menu-signout"]',
        title: "Sign Out Safely",
        description: "End the current admin session securely from this action.",
        placement: "left",
      },
    ];
  }, [isAdmin]);

  const adminTourSteps = adminTourLockedSteps ?? adminTourComputedSteps;

  const isAdminTourUiReady = useCallback(() => {
    if (typeof window === "undefined") return false;
    if (dataStatus) return false;
    return ADMIN_TOUR_BOOT_SELECTORS.every((selector) => {
      const node = document.querySelector(selector) as HTMLElement | null;
      if (!node) return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
  }, [dataStatus]);

  const waitForAdminTourUi = useCallback(
    (onReady: () => void) => {
      if (typeof window === "undefined") {
        onReady();
        return;
      }
      let cancelled = false;
      let attempts = 0;
      let timerId: number | null = null;
      let rafA: number | null = null;
      let rafB: number | null = null;

      const run = () => {
        if (cancelled) return;
        attempts += 1;
        if (!isAdminTourUiReady()) {
          if (attempts >= 50) {
            onReady();
            return;
          }
          timerId = window.setTimeout(run, 120);
          return;
        }
        rafA = window.requestAnimationFrame(() => {
          rafB = window.requestAnimationFrame(() => {
            if (cancelled) return;
            onReady();
          });
        });
      };
      run();

      return () => {
        cancelled = true;
        if (timerId) window.clearTimeout(timerId);
        if (rafA) window.cancelAnimationFrame(rafA);
        if (rafB) window.cancelAnimationFrame(rafB);
      };
    },
    [isAdminTourUiReady],
  );

  const startAdminTour = useCallback(() => {
    setAdminMenuOpen(false);
    setAdminNotificationsOpen(false);
    setShowTeacherRequests(false);
    setShowSalesInquiries(false);
    setActiveAdminSection("drone");
    setAdminTourPromptOpen(false);
    const kickoff = () => {
      const preferredInitialStepIndex = adminTourComputedSteps.findIndex(
        (tourStep) => tourStep.id === ADMIN_TOUR_INITIAL_STEP_ID,
      );
      const orderedSteps =
        preferredInitialStepIndex > 0
          ? [...adminTourComputedSteps.slice(preferredInitialStepIndex), ...adminTourComputedSteps.slice(0, preferredInitialStepIndex)]
          : adminTourComputedSteps;
      setAdminTourLockedSteps(orderedSteps);
      setAdminTourActiveStepId(orderedSteps[0]?.id ?? null);
      setAdminTourRun(true);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(ADMIN_TOUR_STORAGE_KEY);
      }
    };
    const cleanup = waitForAdminTourUi(kickoff);
    return cleanup;
  }, [adminTourComputedSteps, waitForAdminTourUi]);

  const closeAdminTour = useCallback((completed: boolean) => {
    setAdminTourRun(false);
    setAdminTourActiveStepId(null);
    setAdminTourLockedSteps(null);
    setAdminTourPromptOpen(false);
    setAdminMenuOpen(false);
    setAdminNotificationsOpen(false);
    setShowTeacherRequests(false);
    setShowSalesInquiries(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ADMIN_TOUR_STORAGE_KEY, completed ? "done" : "skipped");
    }
  }, []);

  const adminTourCurrentStepIndex = useMemo(() => {
    if (!adminTourActiveStepId) return 0;
    const resolvedIndex = adminTourSteps.findIndex((tourStep) => tourStep.id === adminTourActiveStepId);
    return resolvedIndex >= 0 ? resolvedIndex : 0;
  }, [adminTourActiveStepId, adminTourSteps]);

  const handleAdminTourStepChange = useCallback(
    (nextStepIndex: number) => {
      if (nextStepIndex < 0) return;
      if (nextStepIndex >= adminTourSteps.length) {
        closeAdminTour(true);
        return;
      }
      const nextStepId = adminTourSteps[nextStepIndex]?.id;
      if (!nextStepId) {
        closeAdminTour(true);
        return;
      }
      setAdminTourActiveStepId(nextStepId);
    },
    [adminTourSteps, closeAdminTour],
  );

  useEffect(() => {
    if (!adminTourRun) return;
    const stepId = adminTourActiveStepId ?? adminTourSteps[adminTourCurrentStepIndex]?.id;
    if (!stepId) return;

    const menuStepIds = new Set([
      "admin-menu-panel",
      "admin-menu-teacher-requests",
      "admin-menu-sales-queries",
      "admin-menu-user-analytics",
      "admin-menu-signout",
    ]);
    const notificationStepIds = new Set(["admin-notification-panel"]);
    const openTeacherRequests = stepId === "admin-teacher-requests-modal";
    const openSalesInquiries = stepId === "admin-sales-inquiries-modal";

    setAdminMenuOpen(menuStepIds.has(stepId));
    setAdminNotificationsOpen(notificationStepIds.has(stepId));
    setShowTeacherRequests(openTeacherRequests);
    setShowSalesInquiries(openSalesInquiries);

    if (openTeacherRequests) {
      void loadTeacherRequests();
    }
    if (openSalesInquiries) {
      void loadSalesInquiries();
    }

    if (stepId === "admin-users-section") {
      setActiveAdminSection("users");
    } else if (stepId === "admin-products-section") {
      setActiveAdminSection("products");
    } else if (stepId === "admin-orders-section") {
      setActiveAdminSection("orders");
    } else if (stepId === "admin-vr-modules-section") {
      setActiveAdminSection("vrModules");
    } else if (stepId === "admin-upload-section") {
      setActiveAdminSection("upload");
    } else if (stepId === "admin-questions-section") {
      setActiveAdminSection("questions");
    } else if (stepId === "admin-sentiment-section") {
      setActiveAdminSection("sentiment");
    } else if (stepId === "admin-drone-section") {
      setActiveAdminSection("drone");
    }
  }, [
    adminTourActiveStepId,
    adminTourCurrentStepIndex,
    adminTourRun,
    adminTourSteps,
    loadSalesInquiries,
    loadTeacherRequests,
  ]);

  useEffect(() => {
    if (!adminTourRun) return;
    if (adminTourSteps.length === 0) {
      closeAdminTour(false);
      return;
    }
    const activeStepExists = !!adminTourActiveStepId && adminTourSteps.some((tourStep) => tourStep.id === adminTourActiveStepId);
    if (!activeStepExists) {
      setAdminTourActiveStepId(adminTourSteps[0]?.id ?? null);
    }
  }, [adminTourActiveStepId, adminTourRun, adminTourSteps, closeAdminTour]);

  useEffect(() => {
    if (!isAdmin) {
      setAdminTourUiReady(false);
      return;
    }
    const cleanup = waitForAdminTourUi(() => {
      setAdminTourUiReady(isAdminTourUiReady());
    });
    return cleanup;
  }, [isAdmin, isAdminTourUiReady, waitForAdminTourUi, dataStatus, activeAdminSection, statsExpanded, curriculumRows.length, productRows.length]);

  useEffect(() => {
    if (!isAdmin || adminTourInitialized) return;
    if (typeof window === "undefined") return;
    if (!adminTourUiReady) return;

    const adminTourStatus = window.localStorage.getItem(ADMIN_TOUR_STORAGE_KEY);
    const hasAdminTourPreference = adminTourStatus === "done" || adminTourStatus === "skipped";
    setAdminTourRun(false);
    setAdminTourPromptOpen(!hasAdminTourPreference);
    setAdminTourInitialized(true);
  }, [adminTourInitialized, isAdmin, adminTourUiReady]);

  useEffect(() => {
    if (!adminTourPromptOpen || adminTourRun) return;
    if (typeof window === "undefined") return;

    let cancelled = false;
    let timerId: number | null = null;
    let rafId: number | null = null;
    let smoothLockUntil = 0;
    const observedNode = adminTourPromptCardRef.current;
    const resizeObserver =
      typeof ResizeObserver !== "undefined" && observedNode
        ? new ResizeObserver(() => {
            scheduleEnsurePromptVisible();
          })
        : null;
    const rootResizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            scheduleEnsurePromptVisible();
          })
        : null;
    const mutationObserver =
      typeof MutationObserver !== "undefined"
        ? new MutationObserver(() => {
            scheduleEnsurePromptVisible();
          })
        : null;

    const ensurePromptVisible = () => {
      if (cancelled) return;
      const node = adminTourPromptCardRef.current;
      if (!node) return;

      const rect = node.getBoundingClientRect();
      const targetCenterY = window.innerHeight / 2;
      const cardCenterY = rect.top + rect.height / 2;
      const deltaY = cardCenterY - targetCenterY;
      if (Math.abs(deltaY) > 1) {
        const now = window.performance.now();
        if (now < smoothLockUntil) return;
        if (Math.abs(deltaY) < 6) return;
        const overlayNode = adminTourPromptOverlayRef.current;
        const canOverlayScroll =
          !!overlayNode && overlayNode.scrollHeight - overlayNode.clientHeight > 1;
        if (canOverlayScroll && overlayNode) {
          overlayNode.scrollBy({ top: deltaY, behavior: "smooth" });
        } else {
          window.scrollBy({ top: deltaY, behavior: "smooth" });
        }
        smoothLockUntil = now + 300;
      }
    };

    const scheduleEnsurePromptVisible = () => {
      if (cancelled) return;
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        ensurePromptVisible();
      });
    };

    ensurePromptVisible();
    timerId = window.setTimeout(scheduleEnsurePromptVisible, 160);
    window.addEventListener("resize", scheduleEnsurePromptVisible, { passive: true });
    document.addEventListener("transitionend", scheduleEnsurePromptVisible, true);
    if (observedNode) {
      resizeObserver?.observe(observedNode);
    }
    rootResizeObserver?.observe(document.documentElement);
    mutationObserver?.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "aria-expanded"],
    });

    return () => {
      cancelled = true;
      if (timerId) window.clearTimeout(timerId);
      if (rafId) window.cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      rootResizeObserver?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener("resize", scheduleEnsurePromptVisible);
      document.removeEventListener("transitionend", scheduleEnsurePromptVisible, true);
    };
  }, [adminTourPromptOpen, adminTourRun]);

  return (
    <main className="section-padding space-y-8">
      {isAdmin && (
        <GuidedTour
          run={adminTourRun}
          stepIndex={adminTourCurrentStepIndex}
          steps={adminTourSteps}
          onStepIndexChange={handleAdminTourStepChange}
          onClose={closeAdminTour}
          palette={ADMIN_TOUR_PALETTE}
        />
      )}

      {isAdmin && adminTourPromptOpen && !adminTourRun && adminTourUiReady && (
        <div
          ref={adminTourPromptOverlayRef}
          className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto px-4 py-4"
          style={{ background: "rgba(15, 23, 42, 0.14)" }}
        >
          <div
            ref={adminTourPromptCardRef}
            className="w-full max-w-lg rounded-2xl p-5 overflow-y-auto"
            style={{
              maxHeight: "calc(100dvh - 2rem)",
              border: `1px solid color-mix(in srgb, ${ADMIN_TOUR_PALETTE.accent} 28%, transparent)`,
              background: "var(--surface)",
              color: "var(--foreground)",
              boxShadow:
                `0 18px 42px rgba(15, 23, 42, 0.18), 0 0 0 1px color-mix(in srgb, ${ADMIN_TOUR_PALETTE.accent} 12%, transparent)`,
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                borderRadius: 999,
                border: `1px solid color-mix(in srgb, ${ADMIN_TOUR_PALETTE.accent} 40%, transparent)`,
                background: `color-mix(in srgb, ${ADMIN_TOUR_PALETTE.accent} 10%, #ffffff)`,
                padding: "2px 10px",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: ADMIN_TOUR_PALETTE.accentStrong,
              }}
            >
              Admin Walkthrough
            </span>
            <h3 className="mt-3 text-2xl font-semibold" style={{ color: ADMIN_TOUR_PALETTE.accentStrong }}>
              Take Tour
            </h3>
            <p className="mt-2 text-sm" style={{ color: "color-mix(in srgb, var(--foreground) 82%, #64748b)" }}>
              Start a guided walkthrough of all admin features from this dashboard.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                ref={adminTourPromptButtonRef}
                onClick={() => {
                  void playUiClickTone();
                  startAdminTour();
                }}
                disabled={!adminTourUiReady}
                style={{
                  borderRadius: 8,
                  border: `1px solid color-mix(in srgb, ${ADMIN_TOUR_PALETTE.accentStrong} 42%, transparent)`,
                  background: ADMIN_TOUR_PALETTE.accent,
                  color: "#ffffff",
                  padding: "8px 14px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: adminTourUiReady ? "pointer" : "not-allowed",
                  opacity: adminTourUiReady ? 1 : 0.65,
                }}
              >
                Take tour
              </button>
              <button
                type="button"
                onClick={() => {
                  void playUiClickTone();
                  closeAdminTour(false);
                }}
                style={{
                  borderRadius: 8,
                  border: `1px solid color-mix(in srgb, ${ADMIN_TOUR_PALETTE.accent} 32%, transparent)`,
                  background: "color-mix(in srgb, var(--background-2) 70%, #ffffff)",
                  color: ADMIN_TOUR_PALETTE.accentStrong,
                  padding: "8px 12px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className="sticky top-0 z-30 space-y-4 rounded-2xl border border-white/10 bg-surface/65 p-3 shadow-[0_10px_30px_rgba(0,0,0,0.2)] backdrop-blur-xl"
        data-tour={isAdmin ? "admin-header" : undefined}
      >
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-accent-strong uppercase text-xs tracking-[0.2em]">{dashboardRoleLabel}</p>
          <h1 className="text-3xl font-semibold text-white">Welcome {dashboardRoleLabel} to your Control Room</h1>
          <p className="text-slate-300 text-sm mt-2">
            {isAdmin
              ? ""
              : "You can update activity grade labels; admins handle the rest of the control room."}
          </p>
        </div>
        <div className="flex items-start gap-3">
          {isAdmin && (
            <div className="relative" ref={adminNotificationsRef}>
              <button
                type="button"
                onClick={() => {
                  setAdminMenuOpen(false);
                  setAdminNotificationsOpen((open) => !open);
                }}
                data-tour="admin-notification-bell"
                className="relative inline-flex items-center justify-center h-11 w-11 rounded-full border border-white/10 outline outline-1 outline-black/50 bg-white/5 hover:border-accent-strong"
                aria-label="Unread notifications"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="#facc15"
                  stroke="#111827"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`h-6 w-6 ${unreadNotificationCount > 0 ? "customer-bell-ring" : ""}`}
                >
                  <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.172V11a6 6 0 1 0-12 0v3.172a2 2 0 0 1-.6 1.428L4 17h5" />
                  <path d="M9 17a3 3 0 0 0 6 0" />
                </svg>
                {unreadNotificationCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-1 ring-slate-900"></span>
                )}
              </button>

              {adminNotificationsOpen && (
                <div
                  className="absolute right-0 mt-2 w-96 max-h-96 overflow-auto rounded-2xl border border-stone-300 bg-white shadow-2xl p-3 space-y-2 z-50 text-slate-900"
                  data-tour="admin-notification-panel"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">Notifications</span>
                    <span className="text-xs text-slate-500">{unreadNotificationCount} unread</span>
                  </div>
                  {unreadNotifications.length === 0 ? (
                    <div className="text-sm text-slate-500">No unread notifications.</div>
                  ) : (
                    <>
                      {unreadNotifications.slice(0, 12).map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          className="w-full text-left rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 p-3 transition"
                          onClick={() => {
                            setAdminNotificationsOpen(false);
                            if (item.kind === "teacher_request") {
                              openTeacherRequestsModal();
                              return;
                            }
                            openSalesInquiriesModal();
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                              {item.detail && <p className="text-xs text-slate-700">{item.detail}</p>}
                              <p className="text-[11px] text-slate-500">{formatDateTime(item.createdAt)}</p>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                item.kind === "teacher_request"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-sky-100 text-sky-800"
                              }`}
                            >
                              {item.kind === "teacher_request" ? "Teacher" : "Sales"}
                            </span>
                          </div>
                        </button>
                      ))}
                      {unreadNotifications.length > 12 && (
                        <div className="text-[11px] text-slate-500 text-center">
                          +{unreadNotifications.length - 12} more unread
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="relative" ref={adminMenuRef}>
            <button
              type="button"
              aria-expanded={adminMenuOpen}
              aria-haspopup="menu"
              data-tour="admin-menu-trigger"
              onClick={() => {
                setAdminNotificationsOpen(false);
                setAdminMenuOpen((open) => !open);
              }}
              className="group flex items-center gap-3 rounded-xl px-4 py-2 bg-emerald-800 hover:bg-emerald-700 text-white font-semibold shadow-md ring-1 ring-white/10 hover:-translate-y-0.5 transition-transform duration-150"
            >
              <span className="sr-only">Open admin menu</span>
              <span className="space-y-1.5">
                <span className="block h-0.5 w-5 rounded-full bg-white"></span>
                <span className="block h-0.5 w-5 rounded-full bg-white"></span>
                <span className="block h-0.5 w-5 rounded-full bg-white"></span>
              </span>
              <span className="text-sm font-semibold text-white/90">Menu</span>
            </button>

            {adminMenuOpen && (
              <div
                className="absolute right-0 mt-3 w-80 rounded-2xl bg-white border border-stone-300 outline outline-1 outline-black/5 shadow-2xl shadow-slate-900/15 ring-1 ring-black/5 p-4 space-y-3 z-40 transition"
                data-tour="admin-menu-panel"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.16em] text-accent-strong">{dashboardRoleLabel} actions</p>
                  <span className="text-[11px] text-slate-400">Quick access</span>
                </div>

                <div className="space-y-2">
                  <Link
                    href="/"
                    onClick={() => setAdminMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300/60 text-sm text-slate-800 transition"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 border border-emerald-300 text-true-white shadow-glow">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-5 w-5"
                      >
                        <path d="M3 11.5 12 4l9 7.5" />
                        <path d="M6 10v9h12v-9" />
                        <path d="M10 19v-5h4v5" />
                      </svg>
                    </span>
                    <div className="text-left">
                      <p className="font-semibold">Back to Home</p>
                        <p className="text-xs text-slate-500">Go to landing page</p>
                    </div>
                  </Link>

                  {isAdmin && (
                    <Link
                      href="/?adEditor=1"
                      onClick={() => setAdminMenuOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300/60 text-sm text-slate-800 transition"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500 border border-cyan-300 text-true-white shadow-glow">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-5 w-5"
                        >
                          <rect x="3" y="4" width="18" height="14" rx="2" />
                          <path d="M3 9h18" />
                          <path d="m8 15 3-3 2 2 3-3" />
                        </svg>
                      </span>
                      <p className="font-semibold">Post Adv</p>
                    </Link>
                  )}

                {isAdmin && (
                  <button
                    type="button"
                    data-tour="admin-menu-teacher-requests"
                    onClick={() => {
                      setAdminMenuOpen(false);
                      openTeacherRequestsModal();
                    }}
                    className="w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300/60 text-sm text-slate-800 transition"
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 border border-amber-300 text-true-white shadow-glow">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-5 w-5"
                        >
                          <path d="M10 6h10" />
                          <path d="M10 12h10" />
                          <path d="M10 18h10" />
                          <path d="m4 6 2 2 2-2" />
                          <path d="m4 12 2 2 2-2" />
                          <path d="m4 18 2 2 2-2" />
                        </svg>
                      </span>
                      <span className="text-left">
                        <span className="block font-semibold">Teacher Requests</span>
                        <span className="text-xs text-slate-500">Review pending content asks</span>
                      </span>
                    </span>
                    {unreadTeacherRequests > 0 && (
                      <span className="min-w-[22px] h-5 px-1.5 rounded-full bg-red-700 text-yellow-200 text-[11px] font-extrabold flex items-center justify-center leading-none shadow-lg">
                        {unreadTeacherRequests}
                      </span>
                    )}
                  </button>
                )}

                {isAdmin && (
                  <button
                    type="button"
                    data-tour="admin-menu-sales-queries"
                    onClick={() => {
                      setAdminMenuOpen(false);
                      openSalesInquiriesModal();
                    }}
                    className="w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300/60 text-sm text-slate-800 transition"
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500 border border-sky-300 text-true-white shadow-glow">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-5 w-5"
                        >
                          <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          <path d="M8 8h8" />
                          <path d="M8 12h5" />
                        </svg>
                      </span>
                      <span className="text-left">
                        <span className="block font-semibold">Sales Queries</span>
                        <span className="text-xs text-slate-500">Check talk-to-sales messages</span>
                      </span>
                    </span>
                    {unreadSalesInquiries > 0 && (
                      <span className="min-w-[22px] h-5 px-1.5 rounded-full bg-red-700 text-yellow-200 text-[11px] font-extrabold flex items-center justify-center leading-none shadow-lg">
                        {unreadSalesInquiries}
                      </span>
                    )}
                  </button>
                )}

                {isAdmin && (
                  <Link
                    href="/admin/user-activity"
                    data-tour="admin-menu-user-analytics"
                    onClick={() => setAdminMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300/60 text-sm text-slate-800 transition"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500 border border-purple-300 text-true-white shadow-glow">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-5 w-5"
                      >
                        <path d="M3 3v18h18" />
                        <path d="m7 14 3-3 3 2 4-5" />
                      </svg>
                    </span>
                    <div className="text-left">
                      <p className="font-semibold">User Analytics</p>
                        <p className="text-xs text-slate-500">Login logs and score analytics</p>
                    </div>
                  </Link>
                )}

                <button
                  type="button"
                  data-tour="admin-menu-signout"
                  onClick={() => {
                    setAdminMenuOpen(false);
                    startSignOut(async () => {
                      await logActivity("auth_logout", {
                        category: "auth",
                        metadata: { reason: "manual" },
                      });
                      await supabase.auth.signOut();
                      router.push("/login");
                    });
                  }}
                  className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-sm text-rose-700 transition disabled:opacity-60"
                  disabled={signingOut}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500 border border-rose-300 text-true-white shadow-glow">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5"
                    >
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                      <path d="m10 17 5-5-5-5" />
                      <path d="M15 12H3" />
                    </svg>
                  </span>
                  <div className="text-left">
                    <p className="font-semibold">{signingOut ? "Signing out..." : "Sign out"}</p>
                    <p className="text-xs text-rose-600">End current session</p>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
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

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4" data-tour={isAdmin ? "admin-stats" : undefined}>
        {stats.map((item) => (
          <div
            key={item.label}
            onClick={expandStatsCards}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                expandStatsCards();
              }
            }}
            role="button"
            tabIndex={0}
            className="glass-panel rounded-2xl p-4 cursor-pointer select-none"
          >
            <div className="flex items-center">
              <div className="rounded-lg bg-accent px-3 py-2 shadow-[inset_0_-1px_0_rgba(255,255,255,0.12)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-true-white">{item.label}</p>
              </div>
            </div>
            {statsExpanded && (
              <div className="mt-3 space-y-2">
                {Array.isArray(item.breakdown) ? (
                  <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-white/10 bg-white/5">
                    {item.breakdown.map((entry, index) => (
                      <div
                        key={`${item.label}-${entry.label}`}
                        className={`flex items-center justify-between px-3 py-2 ${
                          index > 0 ? "border-l-2 border-black/80" : ""
                        }`}
                      >
                        <p className="text-lg font-semibold text-white">{entry.label}</p>
                        <p className="text-lg font-semibold text-white">{entry.value}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <p className="text-2xl font-semibold text-white">{item.value}</p>
                    <p className="text-xs text-accent-strong">{item.delta}</p>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div
        className="relative rounded-3xl border border-stone-300/75 bg-gradient-to-r from-stone-100 via-amber-50/80 to-zinc-100/95 p-2.5 ring-1 ring-white/70 shadow-[0_20px_38px_rgba(120,113,108,0.22),inset_0_2px_0_rgba(255,255,255,0.88)]"
        data-tour={isAdmin ? "admin-ribbon" : undefined}
      >
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ribbonSections.map((section) => renderSectionRibbonButton(section))}
        </div>
      </div>
      </div>

      {isAdmin && showTeacherRequests && (
        <div
          id="teacher-requests"
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 pt-16"
          onClick={() => setShowTeacherRequests(false)}
        >
          <div
            className="w-full max-w-7xl max-h-[92vh] overflow-hidden glass-panel rounded-2xl p-8 space-y-6"
            role="dialog"
            aria-modal="true"
            data-tour="admin-teacher-requests-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-accent-strong">Teacher requests</p>
                <h2 className="text-lg font-semibold text-white">VR and Drone requests</h2>
              </div>
              <div className="flex gap-2">
                <button
                  className="text-sm px-3 py-2 rounded-lg bg-accent text-true-white font-semibold border border-emerald-300/70 hover:bg-accent-strong transition"
                  onClick={() => void loadTeacherRequests()}
                >
                  Refresh
                </button>
                <button
                  className="text-sm px-3 py-2 rounded-lg bg-accent text-true-white font-semibold border border-emerald-300/70 hover:bg-accent-strong transition"
                  onClick={() => setShowTeacherRequests(false)}
                >
                  Close
                </button>
              </div>
            </div>

            {teacherRequestStatus && (
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                {teacherRequestStatus}
              </div>
            )}

            <div className="overflow-auto rounded-xl border border-white/5 bg-white/5 max-h-[65vh]">
              <table className="table-v1">
                <thead className="bg-white/5">
                  <tr className="text-left text-slate-400 border-b border-white/10">
                    <th className="py-2 pr-3">Teacher</th>
                    <th className="py-2 pr-3">Subject</th>
                    <th className="py-2 pr-3">Type</th>
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
                      <td className="py-4 pr-3 text-slate-300 text-center" colSpan={8}>
                        No teacher requests yet.
                      </td>
                    </tr>
                  ) : (
                    teacherRequests.map((req) => {
                      const typeMeta = getTeacherRequestTypeMeta(req.request_type);
                      return (
                      <tr key={req.id} className="border-b border-white/5">
                        <td className="py-2 pr-3">
                          <div className="font-semibold text-white">{req.teacher_name ?? "Teacher"}</div>
                          {req.teacher_id && (
                            <div className="text-xs text-slate-400">{shortId(req.teacher_id)}</div>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-slate-300">{req.subject ?? "-"}</td>
                        <td className="py-2 pr-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${typeMeta.badgeClass}`}>
                            {typeMeta.label}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-slate-300">
                          <div className="space-y-1">
                            {(req.items ?? []).slice(0, 3).map((item) => (
                              <div key={item} className="text-xs font-semibold text-slate-200">
                                {item}
                              </div>
                            ))}
                            {req.items && req.items.length > 3 && (
                              <div className="text-[11px] text-slate-400">
                                +{req.items.length - 3} more
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-2 pr-3 text-slate-300">
                          {req.needed_by ? formatJoinedDate(req.needed_by) : "-"}
                        </td>
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
                        <td className="py-2 pr-3 text-slate-300">{req.notes ?? "â€”"}</td>
                        <td className="py-2 pr-3">
                          <div className="flex gap-2">
                            <button
                              className={`px-3 py-1 rounded-lg text-white text-xs font-semibold border outline outline-1 transition disabled:opacity-50 ${
                                (req.status ?? "pending") === "done"
                                  ? "bg-amber-600/20 border-amber-300 outline-amber-300/60 hover:bg-amber-600/30"
                                  : "bg-emerald-600/20 border-emerald-300 outline-emerald-300/60 hover:bg-emerald-600/30"
                              }`}
                              onClick={() => void updateTeacherRequestStatus(req.id, req.status === "done" ? "pending" : "done")}
                              disabled={updatingRequestId === req.id}
                            >
                              {updatingRequestId === req.id
                                ? "Saving..."
                                : req.status === "done"
                                  ? "Mark pending"
                                  : "Mark done"}
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
        </div>
      )}

      {isAdmin && showSalesInquiries && (
        <div
          id="sales-inquiries"
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 pt-16"
          onClick={() => setShowSalesInquiries(false)}
        >
          <div
            className="w-full max-w-7xl max-h-[92vh] overflow-hidden glass-panel rounded-2xl p-8 space-y-6"
            role="dialog"
            aria-modal="true"
            data-tour="admin-sales-inquiries-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-accent-strong">Sales queries</p>
                <h2 className="text-lg font-semibold text-white">Latest Queries</h2>
              </div>
              <div className="flex gap-2">
                <button
                  className="text-sm px-3 py-2 rounded-lg border border-black text-white hover:border-black cursor-pointer"
                  onClick={() => void loadSalesInquiries()}
                >
                  Refresh
                </button>
                <button
                  className="text-sm px-3 py-2 rounded-lg border border-black text-white hover:border-black cursor-pointer"
                  onClick={() => setShowSalesInquiries(false)}
                >
                  Close
                </button>
              </div>
            </div>

            {salesInquiryStatus && (
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                {salesInquiryStatus}
              </div>
            )}

            <div className="overflow-auto rounded-xl border border-white/5 bg-white/5 max-h-[65vh]">
              <table className="table-v1">
                <thead className="bg-white/5">
                  <tr className="text-left text-slate-400 border-b border-white/10">
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">Organization</th>
                    <th className="py-2 pr-3">Message</th>
                    <th className="py-2 pr-3">Submitted</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {salesInquiries.length === 0 ? (
                    <tr className="border-b border-white/5">
                      <td className="py-4 pr-3 text-slate-300 text-center" colSpan={7}>
                        No sales queries yet.
                      </td>
                    </tr>
                  ) : (
                    salesInquiries.map((item) => (
                      <tr key={item.id} className="border-b border-white/5">
                        <td className="py-2 pr-3 text-white font-semibold">{item.name}</td>
                        <td className="py-2 pr-3 text-slate-300">
                          <a href={`mailto:${item.email}`} className="underline decoration-dotted hover:text-white">
                            {item.email}
                          </a>
                        </td>
                        <td className="py-2 pr-3 text-slate-300">{item.school || "â€”"}</td>
                        <td className="py-2 pr-3 text-slate-300 max-w-xs">
                          <p className="whitespace-pre-wrap break-words">{item.message}</p>
                        </td>
                        <td className="py-2 pr-3 text-slate-300">{formatDateTime(item.created_at)}</td>
                        <td className="py-2 pr-3">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold border ${
                              (item.status ?? "new") === "closed"
                                ? "bg-emerald-600/80 border-emerald-300 text-white"
                                : (item.status ?? "new") === "reviewed"
                                  ? "bg-sky-600/80 border-sky-300 text-white"
                                  : "bg-amber-600/70 border-amber-300 text-white"
                            }`}
                          >
                            {item.status ?? "new"}
                          </span>
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex gap-2">
                            <button
                              className="px-3 py-1 rounded-lg bg-white/10 border border-white/15 text-white text-xs hover:border-accent-strong disabled:opacity-50"
                              onClick={() =>
                                void updateSalesInquiryStatus(
                                  item.id,
                                  item.status === "new" ? "reviewed" : item.status === "reviewed" ? "closed" : "new",
                                )
                              }
                              disabled={updatingSalesInquiryId === item.id}
                            >
                              {updatingSalesInquiryId === item.id
                                ? "Saving..."
                                : item.status === "new"
                                  ? "Mark reviewed"
                                  : item.status === "reviewed"
                                    ? "Mark closed"
                                    : "Reopen"}
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
        </div>
      )}

      {activeAdminSection === "drone" && (
      <div className="glass-panel rounded-2xl p-6 space-y-4" data-tour={isAdmin ? "admin-drone-section" : undefined}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Drone Activities</h2>
          <div className="flex w-full lg:w-auto items-center gap-2">
            <input
              type="text"
              value={droneSearchInput}
              onChange={(event) => setDroneSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  runDroneSearch();
                }
              }}
              placeholder="Search activities"
              className="w-full lg:w-72 rounded-lg border border-slate-400/70 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400/40"
            />
            <button
              type="button"
              className="px-3 py-2 rounded-lg bg-accent !text-true-white text-sm font-semibold hover:opacity-90"
              style={{ color: "#fff" }}
              onClick={runDroneSearch}
            >
              Search
            </button>
            {droneSearchQuery && (
              <button
                type="button"
                className="px-3 py-2 rounded-lg border border-white/20 text-white text-sm font-semibold hover:bg-white/10"
                onClick={clearDroneSearch}
              >
                Clear
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-slate-300">
          Showing {filteredCurriculumRows.length} of {curriculumRows.length} activities
        </p>
        {canEditCurriculum && !isAdmin && (
          <p className="text-sm text-slate-300">
            You can change the Grade field; other fields stay locked for teacher accounts.
          </p>
        )}
        <div className="overflow-auto">
          <table className="table-v1">
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
              {filteredCurriculumRows.length === 0 ? (
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-3 text-slate-300" colSpan={5}>
                    <span className="italic">No Module Found</span>
                  </td>
                </tr>
              ) : (
                filteredCurriculumRows.map((item) => (
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
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          className="px-3 py-1 rounded-lg border border-blue-500 text-blue-400 text-xs font-semibold hover:bg-blue-500/10 transition"
                          onClick={() => openCurriculumEditor(item)}
                        >
                          Edit
                        </button>
                        {isAdmin && (
                          <button
                            className="px-3 py-1 rounded-lg border border-emerald-500 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/10 transition"
                            onClick={() => openCurriculumEditor(item, true)}
                          >
                            Edit code
                          </button>
                        )}
                        <button
                          className="px-3 py-1 rounded-lg border border-red-600/70 text-red-400 text-xs font-semibold hover:bg-red-600/25 transition"
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
      )}

      {activeAdminSection === "vrModules" && (
      <div
        className="glass-panel rounded-2xl p-6 space-y-4"
        data-tour={isAdmin ? "admin-vr-modules-section" : undefined}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">VR Modules</h2>
          <button
            className="text-sm px-3 py-2 rounded-lg bg-accent text-true-white font-semibold border border-emerald-300/70 hover:bg-accent-strong transition disabled:opacity-60"
            onClick={() => void loadVrModules()}
            disabled={!isAdmin}
          >
            Refresh
          </button>
        </div>
        {vrModuleStatus && (
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
            {vrModuleStatus}
          </div>
        )}
        <div className="space-y-4">
          {vrSubjects.map((subject) => {
            const modules = vrModulesBySubject[subject] ?? [];
            const draftValue = vrModuleDraftBySubject[subject] ?? "";
            const isSaving = savingVrSubject === subject;

            return (
              <div key={subject} className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-base font-semibold text-white">{subject}</h3>
                  <div className="flex w-full sm:w-auto items-center gap-2">
                    <input
                      value={draftValue}
                      onChange={(event) =>
                        setVrModuleDraftBySubject((prev) => ({ ...prev, [subject]: event.target.value }))
                      }
                      className="w-full sm:w-64 rounded-lg border border-slate-400/60 bg-white/5 px-3 py-2 text-white text-sm focus:border-accent focus:outline-none disabled:opacity-60"
                      placeholder="Add VR module"
                      disabled={!isAdmin || isSaving}
                    />
                    <button
                      className="px-3 py-2 rounded-lg bg-accent text-true-white font-semibold border border-emerald-300/70 hover:bg-accent-strong transition disabled:opacity-60"
                      onClick={() => void addVrModuleForSubject(subject)}
                      disabled={!isAdmin || isSaving || !draftValue.trim()}
                    >
                      {isSaving ? "Adding..." : "Add"}
                    </button>
                  </div>
                </div>

                <div className="overflow-auto rounded-xl border border-white/10 bg-white/5">
                  <table className="table-v1 table-fixed">
                    <thead>
                      <tr className="text-left text-slate-400 border-b border-white/10">
                        <th className="py-2 pr-3">Available VR modules</th>
                        <th className="py-2 pr-3 w-44 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modules.length === 0 ? (
                        <tr className="border-b border-white/5">
                          <td className="py-3 pr-3 text-slate-400" colSpan={2}>
                            No modules available yet.
                          </td>
                        </tr>
                      ) : (
                        modules.map((moduleRow) => (
                          <tr key={moduleRow.id} className="border-b border-white/5">
                            <td className="py-3 pr-3 text-slate-200 break-words">{moduleRow.module_name}</td>
                            <td className="py-3 pr-3 align-middle">
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <button
                                  className="px-3 py-1 rounded-lg border border-blue-500 text-blue-400 text-xs font-semibold hover:bg-blue-500/10 transition disabled:opacity-50"
                                  onClick={() => void editVrModule(moduleRow)}
                                  disabled={!isAdmin || savingVrModuleId === moduleRow.id || deletingVrModuleId === moduleRow.id}
                                >
                                  {savingVrModuleId === moduleRow.id ? "Saving..." : "Edit"}
                                </button>
                                <button
                                  className="px-3 py-1 rounded-lg border border-red-600/70 text-red-400 text-xs font-semibold hover:bg-red-600/25 transition disabled:opacity-50"
                                  onClick={() => void deleteVrModule(moduleRow)}
                                  disabled={!isAdmin || savingVrModuleId === moduleRow.id || deletingVrModuleId === moduleRow.id}
                                >
                                  {deletingVrModuleId === moduleRow.id ? "Deleting..." : "Delete"}
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
            );
          })}
        </div>
      </div>
      )}

      {activeAdminSection === "upload" && (
        <div data-tour={isAdmin ? "admin-upload-section" : undefined}>
          <UploadCurriculumView
            embedded
            onDone={() => {
              setActiveAdminSection("drone");
              void loadData("Refreshing data...");
            }}
          />
        </div>
      )}

      {activeAdminSection === "simulations" && (
        <SimulationLibraryView />
      )}

      {activeAdminSection === "questions" && (
        <div data-tour={isAdmin ? "admin-questions-section" : undefined}>
          <AdminQuestionsView embedded />
        </div>
      )}

      {activeAdminSection === "products" && (
      <div className="glass-panel rounded-2xl p-6 space-y-4" data-tour={isAdmin ? "admin-products-section" : undefined}>
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
          <table className="table-v1">
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
      )}

      {activeAdminSection === "sentiment" && (
      <div
        className="glass-panel rounded-2xl p-6 space-y-4"
        data-tour={isAdmin ? "admin-sentiment-section" : undefined}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Sentiment summaries</h2>
          <span className="text-sm text-slate-400">{sentimentFiles.length} files</span>
        </div>
        {sentimentStatus && (
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">{sentimentStatus}</div>
        )}
        <div className="overflow-auto">
          <table className="table-v1">
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
      )}

      {activeAdminSection === "users" && (
      <div className="glass-panel rounded-2xl p-6 space-y-4" data-tour={isAdmin ? "admin-users-section" : undefined}>
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
              <span>{userSort.dir === "asc" ? "?" : "?"}</span>
              <span className="sr-only">Toggle sort</span>
            </button>
          </div>
        </div>
        <p className="text-sm text-slate-300">See everyone who has signed up for the platform.</p>
        <div className="overflow-auto">
          <table className="table-v1">
            <thead>
              <tr className="text-left text-slate-400 border-b border-white/10">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3">Grade</th>
                <th className="py-2 pr-3">Subject</th>
                <th className="py-2 pr-3">User ID</th>
                <th className="py-2 pr-3">Joined</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {userRows.length === 0 ? (
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-3 text-slate-300" colSpan={7}>
                    No users found yet. New accounts will appear here automatically after signup.
                  </td>
                </tr>
              ) : (
                sortedUsers.map((user) => (
                  <tr key={user.id} className="border-b border-white/5">
                    <td className="py-2 pr-3 font-semibold text-white">{user.full_name}</td>
                    <td className="py-2 pr-3 text-slate-300">{user.displayRole}</td>
                    <td className="py-2 pr-3 text-slate-300">{user.grade ?? "â€”"}</td>
                    <td className="py-2 pr-3 text-slate-300">
                      {user.role === "teacher" ? user.subject ?? "â€”" : "â€”"}
                    </td>
                    <td className="py-2 pr-3 text-slate-400">{shortId(user.id)}</td>
                    <td className="py-2 pr-3 text-slate-300">{formatJoinedDate(user.created_at)}</td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="px-3 py-1 rounded-lg border-2 border-blue-300/90 bg-blue-600 text-xs font-semibold text-true-white hover:bg-blue-500 hover:border-blue-200 transition"
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
      )}

      {activeAdminSection === "products" && editingId && (
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
              Price (Ã¢â€šÂ¹)
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

      {activeAdminSection === "drone" && editingCurriculumId && (
        <div className="glass-panel rounded-2xl p-6 space-y-4" ref={curriculumEditRef}>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Edit curriculum</h3>
            <button
              className="text-sm px-3 py-1 rounded-lg bg-emerald-500 text-white font-semibold shadow-glow hover:bg-emerald-400 transition"
              onClick={() => {
                setEditingCurriculumId(null);
                setSopFile(null);
                setVideoFile(null);
                setCodeFile(null);
              }}
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
          {(() => {
            if (!editingCurriculumId) return null;
            const video =
              curriculumRows
                .find((c) => c.id === editingCurriculumId)
                ?.assets.find((a) => a.type === "video") ?? null;
            if (!video) return null;
            return (
              <p className="text-xs text-slate-400">
                Current video:{" "}
                <a
                  href={video.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent underline underline-offset-4"
                >
                  {video.label || "Open video"}
                </a>
              </p>
            );
          })()}
          {(() => {
            if (!editingCurriculumId) return null;
            const doc =
              curriculumRows
                .find((c) => c.id === editingCurriculumId)
                ?.assets.find((a) => a.type === "doc") ?? null;
            if (!doc) return null;
            return (
              <p className="text-xs text-slate-400">
                Current SOP:{" "}
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent underline underline-offset-4"
                >
                  {doc.label || "Download"}
                </a>
              </p>
            );
          })()}
          {(() => {
            if (!editingCurriculumId) return null;
            const code =
              curriculumRows
                .find((c) => c.id === editingCurriculumId)
                ?.assets.find((a) => a.type === "code") ?? null;
            if (!code) return null;
            return (
              <p className="text-xs text-slate-400">
                Current code:{" "}
                <a
                  href={code.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent underline underline-offset-4"
                >
                  {code.label || "Open code file"}
                </a>
              </p>
            );
          })()}
          <label className="block text-sm text-slate-300 space-y-2">
            Video label
            <input
              value={curriculumForm.videoLabel ?? ""}
              onChange={(e) => setCurriculumForm((f) => ({ ...f, videoLabel: e.target.value }))}
              className="w-full rounded-xl border border-slate-400/60 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none"
              disabled={!isAdmin}
              placeholder="e.g., Flight demo video"
            />
          </label>
          <label className="block text-sm text-slate-300 space-y-2">
            Upload video (MP4)
            <input
              type="file"
              accept="video/mp4"
              onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-xl border border-slate-400/60 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none file-accent"
              disabled={!isAdmin}
            />
            {videoFile?.name && <p className="text-xs text-slate-400">Selected: {videoFile.name}</p>}
          </label>
          <label className="block text-sm text-slate-300 space-y-2">
            SOP label
            <input
              value={curriculumForm.sopLabel ?? ""}
              onChange={(e) => setCurriculumForm((f) => ({ ...f, sopLabel: e.target.value }))}
              className="w-full rounded-xl border border-slate-400/60 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none"
              disabled={!isAdmin}
              placeholder="e.g., Flight SOP v2"
            />
          </label>
          <label className="block text-sm text-slate-300 space-y-2">
            Upload SOP (PDF/PPT/DOC)
            <input
              type="file"
              accept=".pdf,.ppt,.pptx,.doc,.docx"
              onChange={(e) => setSopFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-xl border border-slate-400/60 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none file-accent"
              disabled={!isAdmin}
            />
            {sopFile?.name && <p className="text-xs text-slate-400">Selected: {sopFile.name}</p>}
          </label>
          <div ref={curriculumCodeEditRef} className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
            <p className="text-sm font-semibold text-white">Activity code editor</p>
            <label className="block text-sm text-slate-300 space-y-2">
              Code label
              <input
                value={curriculumForm.codeLabel ?? ""}
                onChange={(e) => setCurriculumForm((f) => ({ ...f, codeLabel: e.target.value }))}
                className="w-full rounded-xl border border-slate-400/60 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none"
                disabled={!isAdmin}
                placeholder="e.g., mission.py"
              />
            </label>
            <label className="block text-sm text-slate-300 space-y-2">
              Upload code file (.py/.txt/.ino)
              <input
                type="file"
                accept=".py,.txt,.ino"
                onChange={(e) => setCodeFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-xl border border-slate-400/60 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none file-accent"
                disabled={!isAdmin}
              />
              {codeFile?.name && <p className="text-xs text-slate-400">Selected: {codeFile.name}</p>}
            </label>
            <label className="block text-sm text-slate-300 space-y-2">
              Edit code directly
              <textarea
                value={curriculumForm.codeSnippet}
                onChange={(e) => setCurriculumForm((f) => ({ ...f, codeSnippet: e.target.value }))}
                className="w-full rounded-xl border border-slate-400/60 bg-black/40 px-3 py-2 font-mono text-sm text-slate-100 focus:border-accent focus:outline-none"
                rows={10}
                disabled={!isAdmin}
                placeholder="Paste or edit activity code here. Saving stores this as the module code snippet."
              />
            </label>
            <p className="text-xs text-slate-400">
              Tip: upload a file to replace the code asset, or edit/paste code above for quick inline updates.
            </p>
          </div>
          <label className="block text-sm text-slate-300 space-y-2">
            Other assets (comma separated labels, excluding code + video + SOP)
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

                    const otherAssets = (existing.assets ?? []).filter(
                      (a) => a.type !== "doc" && a.type !== "video" && a.type !== "code",
                    );
                    const relabeledOthers =
                      assetLabels.length === 0
                        ? otherAssets
                        : otherAssets.map((asset, idx) => ({
                            ...asset,
                            label: assetLabels[idx] ?? asset.label,
                          }));

                    let updatedCode = (existing.assets ?? []).find((a) => a.type === "code") ?? null;
                    if (codeFile) {
                      const url = await uploadFileToBucket({
                        bucket: "curriculum-assets",
                        file: codeFile,
                        pathPrefix: `code/${currentUserId ?? "admin"}`,
                      });
                      updatedCode = {
                        type: "code" as const,
                        url,
                        label: curriculumForm.codeLabel.trim() || codeFile.name || "Python code",
                      };
                    } else if (curriculumForm.codeSnippet.trim()) {
                      updatedCode = {
                        type: "code" as const,
                        url: `data:text/plain;base64,${encodeToBase64(curriculumForm.codeSnippet)}`,
                        label: curriculumForm.codeLabel.trim() || updatedCode?.label || "Python code",
                      };
                    } else if (curriculumForm.codeLabel.trim() && updatedCode) {
                      updatedCode = { ...updatedCode, label: curriculumForm.codeLabel.trim() };
                    }

                    let updatedVideo = (existing.assets ?? []).find((a) => a.type === "video") ?? null;
                    if (videoFile) {
                      const url = await uploadFileToBucket({
                        bucket: "curriculum-assets",
                        file: videoFile,
                        pathPrefix: `videos/${currentUserId ?? "admin"}`,
                      });
                      updatedVideo = { type: "video" as const, url, label: curriculumForm.videoLabel || videoFile.name };
                    } else if (curriculumForm.videoLabel.trim() && updatedVideo) {
                      updatedVideo = { ...updatedVideo, label: curriculumForm.videoLabel.trim() };
                    }

                    let updatedDoc = (existing.assets ?? []).find((a) => a.type === "doc") ?? null;
                    if (sopFile) {
                      const url = await uploadFileToBucket({
                        bucket: "curriculum-assets",
                        file: sopFile,
                        pathPrefix: `docs/${currentUserId ?? "admin"}`,
                      });
                      updatedDoc = { type: "doc" as const, url, label: curriculumForm.sopLabel || sopFile.name };
                    } else if (curriculumForm.sopLabel.trim() && updatedDoc) {
                      updatedDoc = { ...updatedDoc, label: curriculumForm.sopLabel.trim() };
                    }

                    nextAssets = [
                      ...relabeledOthers,
                      ...(updatedCode ? [updatedCode] : []),
                      ...(updatedVideo ? [updatedVideo] : []),
                      ...(updatedDoc ? [updatedDoc] : []),
                    ];

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
                    videoLabel: "",
                    sopLabel: "",
                    codeLabel: "",
                    codeSnippet: "",
                  });
                  setSopFile(null);
                  setVideoFile(null);
                  setCodeFile(null);
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
              onClick={() => {
                setEditingCurriculumId(null);
                setSopFile(null);
                setVideoFile(null);
                setCodeFile(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {activeAdminSection === "users" && editingUser && (
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
              className="text-sm px-3 py-1 rounded-lg border border-black text-white hover:border-black cursor-pointer"
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
                  value={editingUser.email ?? "â€”"}
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

      {activeAdminSection === "orders" && (
      <div
        className="glass-panel rounded-2xl p-6 space-y-3"
        data-tour={isAdmin ? "admin-orders-section" : undefined}
      >
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
      )}
    </main>
  );
}

