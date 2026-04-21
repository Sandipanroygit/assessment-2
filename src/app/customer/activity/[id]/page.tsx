"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { fetchCurriculumModuleById, uploadFileToBucket } from "@/lib/supabaseData";
import type { CurriculumModule } from "@/types";
import { logActivity } from "@/lib/activityLogger";
import { GuidedTour, type GuidedTourPlacement, type GuidedTourStep } from "@/components/GuidedTour";
import {
  areGuidedToursEnabled,
  GUIDED_TOURS_ENABLED_KEY,
  GUIDED_TOURS_TOGGLE_EVENT,
} from "@/lib/tourControls";
import { isPressureAltitudeContext, pickRandomPressureAltitudeQuestions } from "@/data/pressureAltitudeQuestionBank";
import logo from "../../../../../image/logo.jpg";
import {
  AmbientLight,
  Box3,
  BufferGeometry,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const formatSubject = (subject: string) => (subject.toLowerCase() === "maths" ? "Mathematics" : subject);
const progressStorageKey = "activityProgress";
const submissionsBucket = "curriculum-assets";
const submissionPathPrefix = "activity-submissions";
const submissionHistoryKey = "activitySubmissionHistory";
const submissionHideKey = "activitySubmissionHide";
const STUDENT_ACTIVITY_TOUR_AUTOSTART_KEY = "student_activity_tour_autostart_v2";
const STUDENT_ACTIVITY_TOUR_CHAIN_KEY = "student_activity_tour_chain_meta_v2";
const STUDENT_DASHBOARD_TOUR_RESUME_KEY = "student_dashboard_tour_resume_v2";
const QUIZ_CORE_QUESTION_COUNT = 20;
const QUIZ_HUMANITY_QUESTION_COUNT = 0;
const QUIZ_QUESTION_COUNT = QUIZ_CORE_QUESTION_COUNT + QUIZ_HUMANITY_QUESTION_COUNT;
const QUIZ_TIME_PER_QUESTION_SECONDS = 60;
const QUIZ_DURATION_SECONDS = QUIZ_QUESTION_COUNT * QUIZ_TIME_PER_QUESTION_SECONDS;
const normalizeApprovalStatus = (value: unknown) =>
  typeof value === "string" && value.trim().toLowerCase() === "approved" ? "approved" : "pending";
const TEACHER_TOUR_PALETTE = {
  accent: "#2563eb",
  accentStrong: "#1e3a8a",
} as const;
const STUDENT_TOUR_PALETTE = {
  accent: "#f97316",
  accentStrong: "#9a3412",
} as const;

type UploadMeta = { name: string; size: number; type: string };
type ActivityProgressEntry = {
  completed?: boolean;
  score?: number;
  total?: number;
  completedAt?: string;
  uploads?: {
    logFile?: UploadMeta;
    plotFile?: UploadMeta;
    uploadedAt?: string;
  };
};
type ReportOverlayPoint = { x: number; y: number };
type PlotPoint = { x: number; y: number };
type AiReport = {
  summary: string;
  objectiveAlignment: string;
  trendAssessment: string;
  accuracyPercent: number | null;
  possibleErrors: string[];
  improvementTips: string[];
  logInsights: string[] | string;
  overlay?: { note: string; points: ReportOverlayPoint[] };
};

type SubmissionRow = {
  id: string;
  submission_number?: number | null;
  log_url?: string | null;
  log_name?: string | null;
  plot_url?: string | null;
  plot_name?: string | null;
  plot_type?: string | null;
  report_json?: AiReport | null;
  report_status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ActivitySubmission = {
  id: string;
  submissionNumber: number;
  logUrl: string;
  logName: string;
  plotUrl: string;
  plotName: string;
  plotType?: string | null;
  report: AiReport | null;
  reportStatus: string | null;
  createdAt: string;
};

type QuizQuestionKind = "core" | "humanity";
type QuizQuestion = {
  question: string;
  options: Array<{ label: string; text: string }>;
  answer: string;
  explanation?: string;
  kind: QuizQuestionKind;
};

const buildFileMeta = (file: File): UploadMeta => ({ name: file.name, size: file.size, type: file.type });
const ensureProfile = async (user: User) => {
  const { data: existing, error: fetchError } = await supabase
    .from("profiles")
    .select("full_name, role, grade, approval_status")
    .eq("id", user.id)
    .maybeSingle();
  if (!fetchError && existing) {
    return existing as { full_name?: string; role?: string; grade?: string; approval_status?: string | null };
  }
  if (fetchError) {
    console.warn("Profile fetch error", fetchError.message);
  }
  const payload: Record<string, string> = {
    id: user.id,
    full_name: (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "Student",
    role: (user.user_metadata?.role as string | undefined) ?? "customer",
    approval_status: normalizeApprovalStatus(user.user_metadata?.approval_status),
  };
  const grade = user.user_metadata?.grade as string | undefined;
  if (grade) payload.grade = grade;
  const { data: inserted, error: insertError } = await supabase
    .from("profiles")
    .insert(payload)
    .select("full_name, role, grade, approval_status")
    .single();
  if (insertError) {
    console.warn("Profile insert failed", insertError.message);
    return existing ?? null;
  }
  return inserted as { full_name?: string; role?: string; grade?: string; approval_status?: string | null };
};
const normalizeStringList = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string");
  }
  if (typeof value === "string" && value.trim()) {
    return [value];
  }
  return [];
};
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
const getErrorMessage = (err: unknown) => {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err && typeof (err as { message?: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err ?? "Unknown error");
  }
};
const normalizeRoleValue = (value: unknown) => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "admin" || normalized === "teacher" || normalized === "student" || normalized === "customer") {
    return normalized;
  }
  return null;
};

const sanitizeSegment = (value: string) =>
  value.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "item";
const shuffleArray = <T,>(values: T[]) => {
  const next = [...values];
  for (let idx = next.length - 1; idx > 0; idx -= 1) {
    const swapWith = Math.floor(Math.random() * (idx + 1));
    [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
  }
  return next;
};

const buildReportHtml = ({
  logoSrc,
  activityTitle,
  activityDescription,
  accuracyOverride,
  subject,
  grade,
  studentName,
  submissionTime,
  logFileName,
  plotFileName,
  report,
}: {
  logoSrc: string | null;
  activityTitle: string;
  activityDescription: string;
  accuracyOverride?: number;
  subject: string;
  grade: string;
  studentName: string;
  submissionTime: string;
  logFileName: string;
  plotFileName: string;
  report: AiReport;
}) => {
  const detailsRows = [
    ["Activity", activityTitle],
    ["Subject", subject || "-"],
    ["Grade", grade || "-"],
    ["Student", studentName || "-"],
    ["Submission time", submissionTime || "-"],
    ["Log file", logFileName || "-"],
    ["Plot file", plotFileName || "-"],
  ];
  const rawAccuracy = typeof accuracyOverride === "number" ? accuracyOverride : report.accuracyPercent;
  const accuracyValue = typeof rawAccuracy === "number" && Number.isFinite(rawAccuracy) ? Math.round(rawAccuracy) : null;
  const metricRows = [
    ["Accuracy", accuracyValue === null ? "Not enough data" : `${accuracyValue}%`],
    ["Objective alignment", report.objectiveAlignment || "-"],
    ["Trend assessment", report.trendAssessment || "-"],
  ];
  const listToHtml = (items: string[]) =>
    items.length ? items.map((item) => `<li>${escapeHtml(item)}</li>`).join("") : "<li>-</li>";
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>AerohawX Activity Report</title>
    <style>
      body { font-family: Inter, Arial, sans-serif; color: #0f172a; padding: 24px; }
      .header { display: block; margin-bottom: 10px; }
      .logo { width: 140px; height: 60px; object-fit: contain; }
      h1 { font-size: 20px; margin: 10px 0 6px 0; color: #0f4c81; }
      .subtitle { color: #475569; font-size: 12px; margin-top: 2px; }
      .section { margin-bottom: 18px; }
      .objective-text { margin: 0 0 18px 0; font-size: 12px; color: #334155; }
      .section-title { font-weight: bold; font-size: 12px; margin-bottom: 6px; color: #0f4c81; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      td, th { border: 1px solid #e2e8f0; padding: 6px; vertical-align: top; }
      th { background: #e0f2fe; text-align: left; color: #0f4c81; }
      .accent-bar { height: 6px; width: 100%; background: linear-gradient(90deg, #0ea5e9, #38bdf8); margin: 6px 0 14px 0; }
      .label { font-weight: bold; color: #334155; width: 180px; }
      .muted { color: #64748b; }
      ul { margin: 0; padding-left: 18px; }
    </style>
  </head>
  <body>
    <div class="header">
      ${logoSrc ? `<img class="logo" src="${logoSrc}" alt="AerohawX logo" />` : ""}
    </div>
    <div class="accent-bar"></div>
    <h1>Activity Objective</h1>
    <div class="objective-text">${escapeHtml(activityDescription || activityTitle)}</div>

    <div class="section">
      <div class="section-title">Submission details</div>
      <table>
        <tbody>
          ${detailsRows
            .map(
              (row) =>
                `<tr><td class="label">${escapeHtml(row[0])}</td><td class="muted">${escapeHtml(row[1])}</td></tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>

    <div class="section">
      <div class="section-title">Summary</div>
      <div class="muted">${escapeHtml(report.summary || "-")}</div>
    </div>

    <div class="section">
      <div class="section-title">Key metrics</div>
      <table>
        <tbody>
          ${metricRows
            .map(
              (row) =>
                `<tr><td class="label">${escapeHtml(row[0])}</td><td class="muted">${escapeHtml(row[1])}</td></tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>

    <div class="section">
      <div class="section-title">Possible errors</div>
      <ul>${listToHtml(normalizeStringList(report.possibleErrors))}</ul>
    </div>

    <div class="section">
      <div class="section-title">Suggestions</div>
      <ul>${listToHtml(normalizeStringList(report.improvementTips))}</ul>
    </div>

    <div class="section">
      <div class="section-title">Log insights</div>
      <ul>${listToHtml(normalizeStringList(report.logInsights))}</ul>
    </div>

    ${report.overlay?.note ? `<div class="section"><div class="section-title">ISA note</div><div class="muted">${escapeHtml(report.overlay.note)}</div></div>` : ""}
  </body>
</html>`;
};

const mapSubmissionRow = (row: SubmissionRow, idx: number): ActivitySubmission => ({
  id: row.id,
  submissionNumber: row.submission_number ?? idx + 1,
  logUrl: row.log_url ?? "",
  logName: row.log_name ?? "",
  plotUrl: row.plot_url ?? "",
  plotName: row.plot_name ?? "",
  plotType: row.plot_type ?? null,
  report: typeof row.report_json === "object" && row.report_json !== null ? (row.report_json as AiReport) : null,
  reportStatus: row.report_status ?? null,
  createdAt: row.created_at ?? row.updated_at ?? new Date().toISOString(),
});

const extractStoragePath = (url: string) => {
  const marker = "/storage/v1/object/public/";
  try {
    const parsed = new URL(url);
    const idx = parsed.pathname.indexOf(marker);
    if (idx === -1) return null;
    return parsed.pathname.slice(idx + marker.length);
  } catch {
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return url.slice(idx + marker.length);
  }
};

const bucketPathsFromUrls = (urls: string[]) => {
  const byBucket: Record<string, string[]> = {};
  urls.forEach((url) => {
    const path = extractStoragePath(url);
    if (!path) return;
    const [bucket, ...rest] = path.split("/");
    if (!bucket || rest.length === 0) return;
    byBucket[bucket] = [...(byBucket[bucket] ?? []), rest.join("/")];
  });
  return byBucket;
};

const readLocalSubmissionHistory = (moduleId: string): ActivitySubmission[] => {
  try {
    const stored = localStorage.getItem(submissionHistoryKey);
    const parsed = stored ? JSON.parse(stored) : {};
    const entries = Array.isArray(parsed[moduleId]) ? (parsed[moduleId] as ActivitySubmission[]) : [];
    return entries.map((entry, idx) => ({
      ...entry,
      id: entry.id || `local-${moduleId}-${idx + 1}`,
      submissionNumber: entry.submissionNumber ?? idx + 1,
      createdAt: entry.createdAt ?? new Date().toISOString(),
    }));
  } catch {
    return [];
  }
};

const writeLocalSubmissionHistory = (moduleId: string, submissions: ActivitySubmission[]) => {
  try {
    const stored = localStorage.getItem(submissionHistoryKey);
    const parsed = stored ? JSON.parse(stored) : {};
    parsed[moduleId] = submissions.map((entry, idx) => ({
      ...entry,
      id: entry.id || `local-${moduleId}-${idx + 1}`,
      submissionNumber: entry.submissionNumber ?? idx + 1,
      createdAt: entry.createdAt ?? new Date().toISOString(),
    }));
    localStorage.setItem(submissionHistoryKey, JSON.stringify(parsed));
  } catch {
    // ignore storage failures
  }
};

const readHiddenSubmissions = (moduleId: string): string[] => {
  try {
    const stored = localStorage.getItem(submissionHideKey);
    const parsed = stored ? JSON.parse(stored) : {};
    return Array.isArray(parsed[moduleId]) ? (parsed[moduleId] as string[]) : [];
  } catch {
    return [];
  }
};

const writeHiddenSubmissions = (moduleId: string, ids: string[]) => {
  try {
    const stored = localStorage.getItem(submissionHideKey);
    const parsed = stored ? JSON.parse(stored) : {};
    parsed[moduleId] = Array.from(new Set(ids));
    localStorage.setItem(submissionHideKey, JSON.stringify(parsed));
  } catch {
    // ignore storage failures
  }
};

const triggerDownload = (url: string, fileName: string) => {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener noreferrer";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
};

const OFFICE_PREVIEW_EXTENSIONS = new Set(["doc", "docx", "ppt", "pptx", "xls", "xlsx"]);

const getFileExtension = (value?: string | null) => {
  if (!value) return "";
  const withoutQuery = value.split("#")[0]?.split("?")[0] ?? value;
  const lastSegment = withoutQuery.split("/").pop() ?? withoutQuery;
  const parts = lastSegment.split(".");
  if (parts.length < 2) return "";
  return (parts.pop() ?? "").trim().toLowerCase();
};

const toAbsoluteAssetUrl = (rawUrl?: string | null) => {
  const value = (rawUrl ?? "").trim();
  if (!value) return "";
  if (/^(https?:|data:|blob:)/i.test(value)) return value;

  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  if (!base) return value;

  if (value.startsWith("/storage/v1/object/public/")) return `${base}${value}`;
  if (value.startsWith("storage/v1/object/public/")) return `${base}/${value}`;
  if (value.startsWith("curriculum-assets/")) return `${base}/storage/v1/object/public/${value}`;
  return value;
};

const buildSopPreviewUrl = (rawUrl?: string | null, label?: string | null) => {
  const assetUrl = toAbsoluteAssetUrl(rawUrl);
  if (!assetUrl) return "";

  const ext = getFileExtension(label) || getFileExtension(assetUrl);
  if (OFFICE_PREVIEW_EXTENSIONS.has(ext)) {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(assetUrl)}`;
  }

  return assetUrl;
};

export default function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [module, setModule] = useState<CurriculumModule | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [codeDisplay, setCodeDisplay] = useState("Loading code...");
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [quizStatus, setQuizStatus] = useState<string | null>(null);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selections, setSelections] = useState<Record<number, string>>({});
  const [quizComplete, setQuizComplete] = useState(false);
  const [quizPanelOpen, setQuizPanelOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(QUIZ_DURATION_SECONDS);
  const quizAttemptLoggedRef = useRef(false);
  const [logFile, setLogFile] = useState<File | null>(null);
  const [plotFile, setPlotFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [savingUploads, setSavingUploads] = useState(false);
  const [storedUploads, setStoredUploads] = useState<ActivityProgressEntry["uploads"] | null>(null);
  const [, setMarkedDone] = useState(false);
  const [submissions, setSubmissions] = useState<ActivitySubmission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [codeExpanded, setCodeExpanded] = useState(false);
  const [sopExpanded, setSopExpanded] = useState(false);
  const [reportStatus, setReportStatus] = useState<string | null>(null);
  const [, setReportLoading] = useState(false);
  const [report, setReport] = useState<AiReport | null>(null);
  const [logPlotPoints, setLogPlotPoints] = useState<PlotPoint[]>([]);
  const [studentName, setStudentName] = useState("Student");
  const [pdfLogoSrc, setPdfLogoSrc] = useState<string | null>(null);
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [activityTourRun, setActivityTourRun] = useState(false);
  const [activityTourInitialized, setActivityTourInitialized] = useState(false);
  const [activityTourDisplayOffset, setActivityTourDisplayOffset] = useState(0);
  const [activityTourDisplayTotalOverride, setActivityTourDisplayTotalOverride] = useState<number | null>(null);
  const [returnToDashboardAfterTour, setReturnToDashboardAfterTour] = useState(false);
  const [dashboardResumeStepId, setDashboardResumeStepId] = useState("student-menu-signout");
  const [activityTourActiveStepId, setActivityTourActiveStepId] = useState<string | null>(null);
  const [guidedToursEnabled, setGuidedToursEnabled] = useState(true);
  const activityTourPalette = useMemo(
    () => (role === "teacher" ? TEACHER_TOUR_PALETTE : STUDENT_TOUR_PALETTE),
    [role],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => setGuidedToursEnabled(areGuidedToursEnabled());
    sync();
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === GUIDED_TOURS_ENABLED_KEY) sync();
    };
    const onToggle = () => sync();
    window.addEventListener("storage", onStorage);
    window.addEventListener(GUIDED_TOURS_TOGGLE_EVENT, onToggle as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(GUIDED_TOURS_TOGGLE_EVENT, onToggle as EventListener);
    };
  }, []);

  const isDesignTech = useMemo(() => (module?.subject ?? "").toLowerCase().includes("design"), [module?.subject]);
  const isAuroraActivity = useMemo(() => (module?.title ?? "").toLowerCase().includes("aurora"), [module?.title]);
  const stlAssets = useMemo(() => (module?.assets ?? []).filter((a) => a.type === "stl"), [module]);
  const stlModels = useMemo(
    () =>
      stlAssets
        .map((asset, idx) => {
          const name = asset.label || `Model ${idx + 1}`;
          const fileName = name.toLowerCase().endsWith(".stl") ? name : `${name}.stl`;
          return { name, fileName, url: toAbsoluteAssetUrl(asset.url) };
        })
        .filter((asset) => Boolean(asset.url)),
    [stlAssets],
  );
  const [selectedStlUrl, setSelectedStlUrl] = useState("");
  const selectedStlModel = useMemo(
    () => stlModels.find((asset) => asset.url === selectedStlUrl) ?? stlModels[0] ?? null,
    [selectedStlUrl, stlModels],
  );
  useEffect(() => {
    if (!stlModels.length) {
      if (selectedStlUrl) setSelectedStlUrl("");
      return;
    }
    if (!selectedStlUrl || !stlModels.some((asset) => asset.url === selectedStlUrl)) {
      setSelectedStlUrl(stlModels[0]?.url ?? "");
    }
  }, [selectedStlUrl, stlModels]);
  const videoAsset = useMemo(() => (module?.assets ?? []).find((a) => a.type === "video") ?? null, [module]);
  const videoUrl = useMemo(() => toAbsoluteAssetUrl(videoAsset?.url), [videoAsset?.url]);
  const sopAsset = useMemo(() => (module?.assets ?? []).find((a) => a.type === "doc") ?? null, [module]);
  const sopPreviewUrl = useMemo(() => buildSopPreviewUrl(sopAsset?.url, sopAsset?.label), [sopAsset?.label, sopAsset?.url]);
  const sopDownloadUrl = useMemo(() => toAbsoluteAssetUrl(sopAsset?.url), [sopAsset?.url]);
  const activityTourSteps = useMemo<GuidedTourStep[]>(() => {
    if (!module) return [];

    const steps: GuidedTourStep[] = [
      {
        id: "activity-nav",
        target: '[data-tour="activity-nav"]',
        title: "Activity Navigation",
        description: "Use this strip to return to dashboard or jump to the self-assessment section.",
        placement: "bottom",
      },
      {
        id: "activity-back-link",
        target: '[data-tour="activity-back-link"]',
        title: "Back to Activities",
        description: "Return to your activity list from here at any time.",
        placement: "left",
      },
      {
        id: "activity-self-assessment-link",
        target: '[data-tour="activity-self-assessment-link"]',
        title: "Self Assessment Shortcut",
        description: "This takes you directly to the quiz section below.",
        placement: "left",
      },
      {
        id: "activity-overview",
        target: '[data-tour="activity-overview"]',
        title: "Activity Overview",
        description: "This area shows the class, topic, title, and objective of the module.",
        placement: "bottom",
      },
    ];

    steps.push(
      isDesignTech
        ? {
            id: "activity-stl-panel",
            target: '[data-tour="activity-stl-panel"]',
            title: "3D Model Workspace",
            description: "Download and preview STL models uploaded for this activity.",
            placement: "right",
          }
        : {
            id: "activity-code-panel",
            target: '[data-tour="activity-code-panel"]',
            title: "Code Workspace",
            description: "Run, expand, and review the activity code from this panel.",
            placement: "right",
          },
    );

    steps.push(
      {
        id: "activity-sop-panel",
        target: '[data-tour="activity-sop-panel"]',
        title: "SOP Viewer",
        description: "Access instructions, read the SOP, and download it from here.",
        placement: "left",
      },
      {
        id: "activity-submission-panel",
        target: '[data-tour="activity-submission-heading"]',
        title: "Submission Area",
        description: "This section is where you upload files and save your submission.",
        placement: "bottom",
        forcePageTop: false,
        scrollBlock: "center",
        adjacentOnly: true,
      },
      ...(isDesignTech
        ? [
            {
              id: "activity-upload-design-doc",
              target: '[data-tour="activity-upload-design-doc"]',
              title: "Upload Design Document",
              description: "Select your PDF/DOC/TXT report file here.",
              placement: "bottom" as GuidedTourPlacement,
              forcePageTop: false,
              scrollBlock: "center" as const,
              adjacentOnly: true,
            },
          ]
        : [
            {
              id: "activity-upload-log-file",
              target: '[data-tour="activity-upload-log-file"]',
              title: "Upload Log File",
              description: "Choose your activity log file first (.log or .txt).",
              placement: "bottom" as GuidedTourPlacement,
              padding: 160,
              forcePageTop: false,
              scrollBlock: "center" as const,
              adjacentOnly: true,
            },
            ...(isAuroraActivity
              ? []
              : [
                  {
                    id: "activity-upload-plot-file",
                    target: '[data-tour="activity-upload-plot-file"]',
                    title: "Upload Plot File",
                    description: "Then upload your plot image/PDF file.",
                    placement: "bottom" as GuidedTourPlacement,
                    padding: 160,
                    forcePageTop: false,
                    scrollBlock: "center" as const,
                    adjacentOnly: true,
                  },
                ]),
          ]),
      {
        id: "activity-save-button",
        target: '[data-tour="activity-save-button"]',
        title: "Save Submission",
        description: "After selecting required files, click here to save and start report processing.",
        placement: "bottom",
        padding: 300,
        forcePageTop: false,
        scrollBlock: "center",
        adjacentOnly: true,
      },
      {
        id: "activity-submissions-list",
        target: '[data-tour="activity-submissions-list"]',
        title: "Saved Submissions",
        description: "Review, switch, or delete previous submissions in this list.",
        placement: "bottom",
        padding: 360,
        forcePageTop: false,
        scrollBlock: "center",
        adjacentOnly: true,
      },
      {
        id: "activity-report-panel",
        target: '[data-tour="activity-report-panel"]',
        title: "Submission Analysis",
        description: "Review student vs expected overlay and AI metrics, then download the report from here.",
        placement: "bottom",
        forcePageTop: false,
        scrollBlock: "center",
        adjacentOnly: true,
      },
      {
        id: "activity-assessment-panel",
        target: '[data-tour="activity-assessment-panel"]',
        title: "Quiz Assessment",
        description: "Generate practice MCQs and test your understanding here.",
        placement: "bottom",
        padding: 220,
        forcePageTop: false,
        scrollBlock: "center",
        adjacentOnly: true,
      },
    );

    return steps;
  }, [isAuroraActivity, isDesignTech, module]);

  const activityTourCurrentStepIndex = useMemo(() => {
    if (!activityTourActiveStepId) return 0;
    const resolvedIndex = activityTourSteps.findIndex((tourStep) => tourStep.id === activityTourActiveStepId);
    return resolvedIndex >= 0 ? resolvedIndex : 0;
  }, [activityTourActiveStepId, activityTourSteps]);

  const activityTourDisplayTotal = useMemo(
    () =>
      activityTourDisplayTotalOverride ??
      (activityTourDisplayOffset > 0
        ? activityTourDisplayOffset + activityTourSteps.length + (returnToDashboardAfterTour ? 1 : 0)
        : undefined),
    [activityTourDisplayOffset, activityTourDisplayTotalOverride, activityTourSteps.length, returnToDashboardAfterTour],
  );

  const closeActivityTour = useCallback((completed: boolean) => {
    setActivityTourRun(false);
    setActivityTourActiveStepId(null);
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(STUDENT_ACTIVITY_TOUR_AUTOSTART_KEY);
    }
    if (returnToDashboardAfterTour && completed) {
      if (typeof window !== "undefined") {
        const displayTotal =
          activityTourDisplayTotalOverride ??
          (activityTourDisplayOffset > 0
            ? activityTourDisplayOffset + activityTourSteps.length + 1
            : undefined);
        window.localStorage.setItem(
          STUDENT_DASHBOARD_TOUR_RESUME_KEY,
          JSON.stringify({
            stepId: dashboardResumeStepId,
            displayOffset: activityTourDisplayOffset + activityTourSteps.length,
            displayTotal,
          }),
        );
        window.localStorage.removeItem(STUDENT_ACTIVITY_TOUR_CHAIN_KEY);
      }
      setReturnToDashboardAfterTour(false);
      setDashboardResumeStepId("student-menu-signout");
      setActivityTourDisplayOffset(0);
      setActivityTourDisplayTotalOverride(null);
      router.push("/customer");
      return;
    }
    setReturnToDashboardAfterTour(false);
    setDashboardResumeStepId("student-menu-signout");
    setActivityTourDisplayOffset(0);
    setActivityTourDisplayTotalOverride(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STUDENT_ACTIVITY_TOUR_CHAIN_KEY);
    }
  }, [
    activityTourDisplayOffset,
    activityTourDisplayTotalOverride,
    activityTourSteps.length,
    dashboardResumeStepId,
    returnToDashboardAfterTour,
    router,
  ]);

  const handleActivityTourStepChange = useCallback(
    (nextStepIndex: number) => {
      if (nextStepIndex < 0) return;
      if (nextStepIndex >= activityTourSteps.length) {
        closeActivityTour(true);
        return;
      }
      const nextStepId = activityTourSteps[nextStepIndex]?.id;
      if (!nextStepId) {
        closeActivityTour(true);
        return;
      }
      setActivityTourActiveStepId(nextStepId);
    },
    [activityTourSteps, closeActivityTour],
  );

  useEffect(() => {
    if (!activityTourRun) return;
    if (activityTourSteps.length === 0) {
      closeActivityTour(false);
      return;
    }
    const activeStepExists =
      !!activityTourActiveStepId && activityTourSteps.some((tourStep) => tourStep.id === activityTourActiveStepId);
    if (!activeStepExists) {
      setActivityTourActiveStepId(activityTourSteps[0]?.id ?? null);
    }
  }, [activityTourActiveStepId, activityTourRun, activityTourSteps, closeActivityTour]);

  useEffect(() => {
    if (activityTourInitialized || !authChecked || !isAuthenticated || !module) return;
    if (typeof window === "undefined") return;
    if (!guidedToursEnabled) {
      setActivityTourRun(false);
      setActivityTourInitialized(true);
      return;
    }

    const autoStart = window.sessionStorage.getItem(STUDENT_ACTIVITY_TOUR_AUTOSTART_KEY) === "1";
    if (autoStart) {
      window.sessionStorage.removeItem(STUDENT_ACTIVITY_TOUR_AUTOSTART_KEY);
      const rawMeta = window.localStorage.getItem(STUDENT_ACTIVITY_TOUR_CHAIN_KEY);
      if (rawMeta) {
        try {
          const meta = JSON.parse(rawMeta) as {
            offset?: unknown;
            returnToDashboard?: unknown;
            resumeStepId?: unknown;
            total?: unknown;
          };
          if (typeof meta.offset === "number" && Number.isFinite(meta.offset) && meta.offset > 0) {
            setActivityTourDisplayOffset(meta.offset);
          }
          setReturnToDashboardAfterTour(meta.returnToDashboard === true);
          if (typeof meta.resumeStepId === "string" && meta.resumeStepId.trim().length > 0) {
            setDashboardResumeStepId(meta.resumeStepId);
          }
          if (typeof meta.total === "number" && Number.isFinite(meta.total) && meta.total > 0) {
            setActivityTourDisplayTotalOverride(meta.total);
          } else {
            setActivityTourDisplayTotalOverride(null);
          }
        } catch {
          setActivityTourDisplayOffset(0);
          setActivityTourDisplayTotalOverride(null);
          setReturnToDashboardAfterTour(false);
          setDashboardResumeStepId("student-menu-signout");
        }
      }
      setActivityTourActiveStepId(activityTourSteps[0]?.id ?? null);
      setActivityTourRun(true);
    }
    setActivityTourInitialized(true);
  }, [activityTourInitialized, activityTourSteps, authChecked, guidedToursEnabled, isAuthenticated, module]);

  useEffect(() => {
    if (guidedToursEnabled) return;
    setActivityTourRun(false);
  }, [guidedToursEnabled]);

  const StlPreview = ({ url, name }: { url: string; name: string }) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      let frameId = 0;
      let mounted = true;

      const scene = new Scene();
      scene.background = new Color("#ffffff");

      const renderer = new WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(window.devicePixelRatio || 1);
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.shadowMap.enabled = true;
      container.appendChild(renderer.domElement);

      const camera = new PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
      camera.position.set(80, 80, 120);

      const ambient = new AmbientLight(0xffffff, 0.6);
      const dir = new DirectionalLight(0xffffff, 0.9);
      dir.position.set(60, 100, 80);
      dir.castShadow = true;
      scene.add(ambient);
      scene.add(dir);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;

      const loader = new STLLoader();
      loader.load(
        url,
        (geometry: BufferGeometry) => {
          if (!mounted) return;
          geometry.computeBoundingBox();
          const box = geometry.boundingBox ?? new Box3();
          const size = new Vector3();
          box.getSize(size);
          const center = new Vector3();
          box.getCenter(center);
          geometry.center();

          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          const scale = 80 / maxDim;
          geometry.scale(scale, scale, scale);

          camera.position.set(0, 0, 150);
          controls.target.set(0, 0, 0);
          controls.update();

          const material = new MeshStandardMaterial({ color: 0x16a34a, metalness: 0.15, roughness: 0.55 });
          const mesh = new Mesh(geometry, material);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          scene.add(mesh);
        },
        undefined,
        (err: unknown) => {
          console.error("STL load failed", err);
          setError("Unable to preview this STL. You can still download it.");
        },
      );

      const handleResize = () => {
        if (!container) return;
        const { clientWidth, clientHeight } = container;
        renderer.setSize(clientWidth, clientHeight);
        camera.aspect = clientWidth / clientHeight;
        camera.updateProjectionMatrix();
      };
      const observer = new ResizeObserver(handleResize);
      observer.observe(container);

      const animate = () => {
        controls.update();
        renderer.render(scene, camera);
        frameId = requestAnimationFrame(animate);
      };
      animate();

      return () => {
        mounted = false;
        cancelAnimationFrame(frameId);
        observer.disconnect();
        renderer.dispose();
        scene.clear();
        container.innerHTML = "";
      };
    }, [url]);

    return (
      <div className="rounded-lg border border-white/10 bg-slate-950/70 h-64 overflow-hidden" ref={containerRef}>
        {error && <p className="text-xs text-amber-300 p-2">{error}</p>}
        <span className="sr-only">3D preview of {name}</span>
      </div>
    );
  };

  const applyQuizQuestions = (questions: QuizQuestion[]) => {
    if (!questions.length) return false;
    setQuizQuestions(questions);
    setCurrentQuestion(0);
    setSelections({});
    setQuizComplete(false);
    setTimeLeft(QUIZ_DURATION_SECONDS);
    setQuizStatus(null);
    return true;
  };

  const activityContextText = useMemo(
    () => `${module?.title ?? ""} ${module?.description ?? ""} ${module?.judgingLogic ?? ""}`.toLowerCase(),
    [module?.description, module?.judgingLogic, module?.title],
  );

  const resolveOverlayAxes = useCallback((codeText: string, plotType: string, activityText: string) => {
    const normalizedPlotType = plotType.toLowerCase();
    const normalizedCode = codeText.toLowerCase();
    const normalizedActivity = activityText.toLowerCase();
    const axisLabelMap: Record<string, string> = {
      altitude: "Altitude (m)",
      distance: "Distance (m)",
      height: "Height (m)",
      pressure: "Pressure",
      temperature: "Temperature",
      time: "Time",
      x: "X Position (m)",
      y: "Y Position (m)",
    };
    const cleanToken = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const baseToken = (value: string) => cleanToken(value).split(" ")[0] ?? "";
    const formatAxisLabel = (value: string) => {
      const key = baseToken(value);
      if (axisLabelMap[key]) return axisLabelMap[key];
      const cleaned = cleanToken(value);
      if (!cleaned) return "Value";
      return cleaned
        .split(" ")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
    };

    const isAuroraMission =
      normalizedActivity.includes("aurora") ||
      normalizedCode.includes("target_x") ||
      normalizedCode.includes("target y") ||
      (normalizedCode.includes("vector") && normalizedCode.includes("path efficiency"));
    if (isAuroraMission) {
      return { xKey: "x", yKey: "y", xLabel: "X Position (m)", yLabel: "Y Position (m)" };
    }

    if (normalizedPlotType.includes("vs")) {
      const parts = normalizedPlotType.split("vs").map((part) => part.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const yToken = baseToken(parts[0]) || "y";
        const xToken = baseToken(parts[1]) || "x";
        return {
          xKey: xToken,
          yKey: yToken,
          xLabel: formatAxisLabel(parts[1]),
          yLabel: formatAxisLabel(parts[0]),
        };
      }
    }

    if (normalizedCode.includes("pressure") && (normalizedCode.includes("height") || normalizedCode.includes("altitude"))) {
      const xKey = normalizedCode.includes("altitude") ? "altitude" : "height";
      return {
        xKey,
        yKey: "pressure",
        xLabel: formatAxisLabel(xKey),
        yLabel: formatAxisLabel("pressure"),
      };
    }

    if (normalizedCode.includes("time") && normalizedCode.includes("pressure")) {
      return { xKey: "time", yKey: "pressure", xLabel: formatAxisLabel("time"), yLabel: formatAxisLabel("pressure") };
    }

    if (normalizedCode.includes("time") && normalizedCode.includes("temperature")) {
      return { xKey: "time", yKey: "temperature", xLabel: formatAxisLabel("time"), yLabel: formatAxisLabel("temperature") };
    }

    return { xKey: "x", yKey: "y", xLabel: "X-axis", yLabel: "Y-axis" };
  }, []);

  const isAuroraMission = useMemo(() => {
    return (
      activityContextText.includes("aurora") ||
      codeDisplay.toLowerCase().includes("target_x") ||
      codeDisplay.toLowerCase().includes("mission success")
    );
  }, [activityContextText, codeDisplay]);

  const auroraTarget = useMemo(() => {
    const combined = `${codeDisplay}\n${module?.description ?? ""}\n${module?.judgingLogic ?? ""}\n${module?.title ?? ""}`;
    const patterns = [
      /target_x\s*,\s*target_y\s*=\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i,
      /target_x\s*=\s*(-?\d+(?:\.\d+)?)[\s\S]{0,180}?target_y\s*=\s*(-?\d+(?:\.\d+)?)/i,
      /reach\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/i,
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(combined);
      if (!match) continue;
      const x = Number.parseFloat(match[1]);
      const y = Number.parseFloat(match[2]);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        return { x, y };
      }
    }
    return null;
  }, [codeDisplay, module?.description, module?.judgingLogic, module?.title]);

  const activePlotHint = useMemo(() => {
    return (
      storedUploads?.plotFile?.type ||
      storedUploads?.plotFile?.name ||
      plotFile?.type ||
      plotFile?.name ||
      ""
    );
  }, [plotFile?.name, plotFile?.type, storedUploads?.plotFile?.name, storedUploads?.plotFile?.type]);

  const overlayAxes = useMemo(
    () => resolveOverlayAxes(codeDisplay, activePlotHint, activityContextText),
    [activityContextText, activePlotHint, codeDisplay, resolveOverlayAxes],
  );

  const computeAccuracy = (points: PlotPoint[]) => {
    if (points.length < 2) return null;
    const sorted = [...points].sort((a, b) => a.x - b.x);
    const start = sorted[0];
    const end = sorted[sorted.length - 1];
    const spanX = end.x - start.x;
    const minY = Math.min(...points.map((p) => p.y));
    const maxY = Math.max(...points.map((p) => p.y));
    const spanY = maxY - minY;
    if (!Number.isFinite(spanX) || !Number.isFinite(spanY) || spanX === 0 || spanY === 0) {
      return null;
    }
    const slope = (end.y - start.y) / spanX;
    const expectedAt = (x: number) => start.y + slope * (x - start.x);
    const avgError = points.reduce((acc, point) => acc + Math.abs(point.y - expectedAt(point.x)), 0) / points.length;
    const normalized = avgError / spanY;
    return clamp(100 - normalized * 100, 0, 100);
  };

  const computedAccuracy = useMemo(() => computeAccuracy(logPlotPoints), [logPlotPoints]);

  const nextSubmissionNumber = useMemo(
    () => (submissions[submissions.length - 1]?.submissionNumber ?? 0) + 1,
    [submissions],
  );

  const generateQuiz = async () => {
    if (!module) return;
    setQuizPanelOpen(true);
    setGeneratingQuiz(true);
    setQuizStatus("Loading questions from this activity...");

    const buildQuestion = (
      question: string,
      options: string[],
      answerIndex: number,
      explanation: string,
      kind: QuizQuestionKind,
    ): QuizQuestion => ({
      question,
      options: options.slice(0, 4).map((text, idx) => ({ label: "ABCD".charAt(idx), text })),
      answer: "ABCD".charAt(Math.max(0, Math.min(3, answerIndex))),
      explanation,
      kind,
    });

    const contextText = [module.title, module.description, module.judgingLogic, module.subject]
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .join(" ")
      .toLowerCase();
    const contextKeywordPool = Array.from(
      new Set(
        contextText
          .split(/[^a-z0-9]+/g)
          .map((token) => token.trim())
          .filter((token) => token.length >= 4)
          .filter(
            (token) =>
              ![
                "this",
                "that",
                "with",
                "from",
                "activity",
                "module",
                "using",
                "should",
                "steps",
                "student",
                "students",
                "through",
                "which",
                "where",
                "when",
                "what",
                "into",
                "your",
                "their",
              ].includes(token),
          ),
      ),
    ).slice(0, 16);
    const strictKeywords = contextKeywordPool.length > 0 ? contextKeywordPool : [sanitizeSegment(module.title)];
    const strictKeywordLine = strictKeywords.join(", ");
    const isPressureActivity = isPressureAltitudeContext(contextText);
    const strictQuestionFilter = (questions: QuizQuestion[]) => {
      const banned = /(community|ethic|opinion|personal|society|privacy|accessibility|value judgement|open ended)/i;
      const technical = /(unit|law|formula|relation|proportional|increase|decrease|pressure|temperature|volume|density|altitude|height|sensor|reading|pascal|kpa|bar|gauge|absolute|trend|calculate|interpret|graph|data)/i;
      return questions
        .filter((q) => {
          const blob = `${q.question} ${q.options.map((o) => o.text).join(" ")} ${q.explanation ?? ""}`.toLowerCase();
          if (banned.test(blob)) return false;
          if (!technical.test(blob)) return false;
          return strictKeywords.some((key) => blob.includes(key));
        })
        .slice(0, QUIZ_CORE_QUESTION_COUNT);
    };

    const buildCoreFallbackQuestions = () => {
      const activityName = module.title || "this activity";
      const descriptionText = (module.description || "").trim() || "the description text of this activity";
      if (isPressureActivity) {
        return pickRandomPressureAltitudeQuestions(QUIZ_CORE_QUESTION_COUNT).map((item, index) =>
          buildQuestion(`${item.question} (Q${index + 1})`, item.options, item.answerIndex, item.explanation, "core"),
        );
      }
      const focus = strictKeywords[0] || "the main measured variable";
      const secondary = strictKeywords[1] || "another variable from the description";
      const tertiary = strictKeywords[2] || "the observed output";
      const templates = [
        [`In ${activityName}, which statement best describes ${focus}?`, [`${focus} is treated as a measurable variable in this activity context.`, `${focus} is unrelated to this activity.`, `${focus} is only a UI term with no data meaning.`, `${focus} is ignored after setup.`], 0],
        [`For ${activityName}, what is the best interpretation when ${focus} increases while ${secondary} is unchanged?`, [`It indicates a trend that must be interpreted from the activity data.`, `It proves data quality is invalid.`, `It means the sensor was not used.`, `It means the SOP should be skipped.`], 0],
        [`Which unit should be checked first for ${focus} readings in ${activityName}?`, [`The unit specified in the activity description or SOP.`, `Any convenient unit without conversion.`, `Only percentage, regardless of variable.`, `No unit check is needed.`], 0],
        [`In ${activityName}, what is the correct first step if ${focus} data looks inconsistent?`, [`Verify setup and measurement steps from SOP before re-running.`, `Delete inconsistent data immediately.`, `Change objective to fit the output.`, `Ignore and continue.`], 0],
        [`How should ${tertiary} be analyzed in ${activityName}?`, [`Using the described relation among activity variables.`, `Using an unrelated chapter formula.`, `Using only visual guesswork.`, `Without referencing description.`], 0],
      ] as Array<[string, string[], number]>;
      const generated: QuizQuestion[] = [];
      for (let i = 0; generated.length < QUIZ_CORE_QUESTION_COUNT; i += 1) {
        const [q, opts, answerIndex] = templates[i % templates.length];
        generated.push(
          buildQuestion(
            `${q} (Q${i + 1})`,
            opts,
            answerIndex,
            `Based only on activity description/SOP context: ${descriptionText.slice(0, 220)}.`,
            "core",
          ),
        );
      }
      return generated;
    };

    const loadFromQuestionBank = async () => {
      const gradeSegment = sanitizeSegment(module.grade);
      const moduleSegments = Array.from(
        new Set([sanitizeSegment(module.module || module.title), sanitizeSegment(module.title), sanitizeSegment(module.module || "")].filter(Boolean)),
      );
      const bucket = supabase.storage.from("curriculum-assets");
      for (const moduleSegment of moduleSegments) {
        const prefix = `question-banks/${gradeSegment}/${moduleSegment}`;
        const { data: listed, error } = await bucket.list(prefix, {
          limit: 100,
          offset: 0,
          sortBy: { column: "name", order: "desc" },
        });
        if (error || !listed?.length) continue;
        const candidates = listed
          .filter((item) => item.name.toLowerCase().endsWith(".json"))
          .sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || "") || b.name.localeCompare(a.name));
        if (!candidates.length) continue;

        const filePath = `${prefix}/${candidates[0].name}`;
        const { data: urlData } = bucket.getPublicUrl(filePath);
        const res = await fetch(urlData.publicUrl);
        if (!res.ok) continue;
        const payload = await res.text();
        const parsed = parseQuestionBankPayload(payload);
        if (parsed.length) return strictQuestionFilter(parsed).slice(0, QUIZ_CORE_QUESTION_COUNT);
      }
      return [] as QuizQuestion[];
    };

    const requestAiQuestions = async ({
      message,
      kind,
      limit,
      statusMessage,
    }: {
      message: string;
      kind: QuizQuestionKind;
      limit: number;
      statusMessage: string;
    }) => {
      setQuizStatus(statusMessage);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            context: {
              title: module.title,
              subject: module.subject,
              grade: module.grade,
              description: module.description,
              code: codeDisplay,
              sop: module.judgingLogic,
            },
          }),
        });
        if (!res.ok) {
          setQuizStatus("AI service unavailable. Please try again shortly.");
          return [] as QuizQuestion[];
        }
        const data = (await res.json()) as { reply?: string; fallback?: boolean; detail?: string };
        const reply = (data?.reply || "").trim();
        const parsed = reply ? parseQuiz(reply, kind, limit) : [];

        if (data?.fallback) {
          if (parsed.length) return kind === "core" ? strictQuestionFilter(parsed) : parsed;
          setQuizStatus(data.detail || reply || "AI service unavailable.");
          return [] as QuizQuestion[];
        }

        if (!reply) {
          setQuizStatus("No quiz returned by AI. Please retry.");
          return [] as QuizQuestion[];
        }

        const finalParsed = kind === "core" ? strictQuestionFilter(parsed) : parsed;
        if (!finalParsed.length) {
          setQuizStatus("AI replied but no valid MCQs were parsed.");
          return [] as QuizQuestion[];
        }
        return finalParsed;
      } catch (err) {
        console.error("AI quiz generation failed", err);
        setQuizStatus(getErrorMessage(err));
        return [] as QuizQuestion[];
      }
    };

    const generateAiQuiz = async () =>
      requestAiQuestions({
        message:
          `Create exactly ${QUIZ_CORE_QUESTION_COUNT} standard conceptual/factual MCQs (A-D) for "${module.title}". `
          + "Use only facts and concepts inferable from this activity description, SOP, and code context. "
          + `Mandatory topic focus keywords: ${strictKeywordLine}. `
          + "Questions must test variable relationships, laws/formulas, units, interpretation of trends, and parameter effects. "
          + "For pressure/altitude activities, include questions like: unit of pressure, meaning of PSI, definition of pressure, trend with altitude up/down, and gravity effect on pressure. "
          + "Do not include ethics, society, opinion, generic pedagogy, or vague motivational content. "
          + "Return in the format: Q1. question\\nA) option\\nB) option\\nC) option\\nD) option\\nAnswer: A\\nExplanation: ...",
        kind: "core",
        limit: QUIZ_CORE_QUESTION_COUNT,
        statusMessage: "Generating core activity questions...",
      });

    try {
      const bankQuestions = await loadFromQuestionBank();
      let coreQuestions = isPressureActivity
        ? buildCoreFallbackQuestions()
        : bankQuestions.slice(0, QUIZ_CORE_QUESTION_COUNT);
      let usedCoreFallback = false;

      if (!isPressureActivity && coreQuestions.length < QUIZ_CORE_QUESTION_COUNT) {
        const aiCoreQuestions = await generateAiQuiz();
        if (aiCoreQuestions.length) {
          coreQuestions = [...coreQuestions, ...aiCoreQuestions].slice(0, QUIZ_CORE_QUESTION_COUNT);
        }
      }

      if (coreQuestions.length < QUIZ_CORE_QUESTION_COUNT) {
        const fallbackCoreQuestions = buildCoreFallbackQuestions();
        if (fallbackCoreQuestions.length) {
          coreQuestions = [...coreQuestions, ...fallbackCoreQuestions].slice(0, QUIZ_CORE_QUESTION_COUNT);
          usedCoreFallback = true;
        }
      }

      if (coreQuestions.length < QUIZ_CORE_QUESTION_COUNT) {
        setQuizStatus("Unable to generate enough activity questions right now. Please try again.");
        return;
      }

      const mixedQuestions = shuffleArray([...coreQuestions]).slice(0, QUIZ_QUESTION_COUNT);
      if (applyQuizQuestions(mixedQuestions)) {
        if (usedCoreFallback) {
          setQuizStatus("Loaded fallback core questions from this activity context.");
        } else {
          setQuizStatus(null);
        }
        return;
      }

      setQuizStatus((prev) => prev ?? "Unable to generate quiz right now. Please try again in a bit.");
    } catch (err) {
      console.error("Quiz generation failed", err);
      setQuizStatus(getErrorMessage(err));
    } finally {
      setGeneratingQuiz(false);
    }
  };

  const parseQuiz = (text: string, kind: QuizQuestionKind = "core", limit = QUIZ_QUESTION_COUNT) => {
    const blocks = text.split(/Q\d+\./i).filter(Boolean);
    const questions: QuizQuestion[] = [];
    const answerRegex = /Answer:\s*([A-D])/i;
    blocks.forEach((block) => {
      const lines = block.trim().split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) return;
      const question = lines[0];
      const opts = lines
        .slice(1)
        .filter((l) => /^[A-D][).]/i.test(l))
        .map((l) => {
          const label = l.slice(0, 1).toUpperCase();
          const text = l.replace(/^[A-D][).]\s*/, "");
          return { label, text };
        })
        .slice(0, 4);
      const answerLine = lines.find((l) => answerRegex.test(l));
      const answerMatch = answerLine ? answerLine.match(answerRegex) : null;
      const answer = answerMatch ? answerMatch[1].toUpperCase() : "";
      const explanationLine = lines.find((l) => /^Explanation:/i.test(l));
      const explanation = explanationLine ? explanationLine.replace(/^Explanation:\s*/i, "").trim() : "";
      if (question && opts.length === 4 && /^[A-D]$/.test(answer)) {
        questions.push({ question, options: opts, answer, explanation: explanation || undefined, kind });
      }
    });
    return questions.slice(0, limit);
  };

  const parseQuestionBankPayload = (raw: string) => {
    const safeOptions = (options: unknown): Array<{ label: string; text: string }> => {
      if (Array.isArray(options)) {
        return options
          .slice(0, 4)
          .map((opt, idx) => {
            const normalizedLabel = "ABCD".charAt(idx);
            if (typeof opt === "string") return { label: normalizedLabel, text: opt };
            if (opt && typeof opt === "object" && "text" in opt) {
              const text = String((opt as { text?: unknown }).text ?? "");
              return { label: normalizedLabel, text };
            }
            return null;
          })
          .filter(Boolean) as Array<{ label: string; text: string }>;
      }
      return [];
    };

    const normalizeAnswer = (answerRaw: string) => {
      const normalized = answerRaw.trim().toUpperCase();
      if (/^[A-D]$/.test(normalized)) return normalized;
      if (/^[1-4]$/.test(normalized)) return "ABCD".charAt(Number.parseInt(normalized, 10) - 1);
      return "";
    };

    const normalizeArray = (items: unknown[]): QuizQuestion[] => {
      return items
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const q = (item as { q?: string; question?: string }).question || (item as { q?: string }).q || "";
          const opts = safeOptions((item as { options?: unknown }).options);
          const ans = normalizeAnswer((item as { answer?: string }).answer || "");
          const explanation =
            typeof (item as { explanation?: string }).explanation === "string"
              ? (item as { explanation?: string }).explanation
              : undefined;
          if (!q || opts.length !== 4 || !ans) return null;
          return { question: q, options: opts, answer: ans, explanation, kind: "core" as const };
        })
        .filter(Boolean) as QuizQuestion[];
    };

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return normalizeArray(parsed).slice(0, QUIZ_CORE_QUESTION_COUNT);
      }
      if (parsed && typeof parsed === "object") {
        const questionsField = (parsed as { questions?: unknown }).questions;
        if (typeof questionsField === "string") {
          try {
            const nested = JSON.parse(questionsField);
            if (Array.isArray(nested)) return normalizeArray(nested).slice(0, QUIZ_CORE_QUESTION_COUNT);
          } catch {
            // fall through to parse as text
            const viaText = parseQuiz(questionsField, "core", QUIZ_CORE_QUESTION_COUNT);
            if (viaText.length) return viaText;
          }
        }
        if (Array.isArray(questionsField)) return normalizeArray(questionsField).slice(0, QUIZ_CORE_QUESTION_COUNT);
      }
    } catch {
      // not JSON, try text parsing
    }
    const fallback = parseQuiz(raw, "core", QUIZ_CORE_QUESTION_COUNT);
    return fallback;
  };

  useEffect(() => {
    if (quizComplete || quizQuestions.length === 0) return;
    setTimeLeft(QUIZ_DURATION_SECONDS);
    const id = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          setQuizComplete(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [quizQuestions.length, quizComplete]);

  useEffect(() => {
    if (!quizPanelOpen) return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [quizPanelOpen]);

  const answeredCount = useMemo(() => Object.keys(selections).length, [selections]);
  const score = useMemo(() => {
    if (!quizComplete) return null;
    return quizQuestions.reduce((acc, q, idx) => (selections[idx] === q.answer ? acc + 1 : acc), 0);
  }, [quizComplete, quizQuestions, selections]);

  useEffect(() => {
    if (!module || !quizComplete || score === null || quizQuestions.length === 0) return;
    try {
      const stored = localStorage.getItem(progressStorageKey);
      const parsed = stored ? JSON.parse(stored) : {};
      const previous = parsed[String(module.id)] ?? {};
      parsed[String(module.id)] = {
        ...previous,
        completed: true,
        score,
        total: quizQuestions.length,
        completedAt: new Date().toISOString(),
      };
      localStorage.setItem(progressStorageKey, JSON.stringify(parsed));
      setMarkedDone(true);
    } catch {
      // ignore storage errors
    }
  }, [module, quizComplete, score, quizQuestions.length]);

  useEffect(() => {
    if (!quizComplete) {
      quizAttemptLoggedRef.current = false;
      return;
    }
    if (quizAttemptLoggedRef.current) return;
    if (!module || score === null || quizQuestions.length === 0) return;

    const normalizedRole = (role ?? "").toLowerCase();
    if (normalizedRole !== "student" && normalizedRole !== "customer") return;

    quizAttemptLoggedRef.current = true;
    void logActivity("student_quiz_attempt", {
      category: "assessment",
      metadata: {
        module_id: module.id,
        module_title: module.title,
        score,
        total: quizQuestions.length,
        percentage: Math.round((score / quizQuestions.length) * 100),
      },
    });
  }, [module, quizComplete, quizQuestions.length, role, score]);

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

  const parseLogPoints = useCallback((text: string, codeText: string, plotType: string, activityText: string) => {
    const points: PlotPoint[] = [];
    const lines = text.split(/\r?\n/);
    const axisLabels = resolveOverlayAxes(codeText, plotType, activityText);
    const normalizeToken = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const axisAliases = (key: string) => {
      const normalized = normalizeToken(key);
      if (normalized === "x") return ["x", "xm", "xpos", "xcoordinate", "xcoord"];
      if (normalized === "y") return ["y", "ym", "ypos", "ycoordinate", "ycoord"];
      if (normalized === "height") return ["height", "heightm", "heightcm", "altitude", "z", "zm"];
      if (normalized === "altitude") return ["altitude", "height", "z", "zm"];
      if (normalized === "pressure") return ["pressure", "press", "pressurekpa"];
      if (normalized === "temperature") return ["temperature", "temp", "temperaturec"];
      if (normalized === "time") return ["time", "elapsed", "elapseds", "timestamp"];
      return [normalized];
    };
    const headerLine = lines.find((line) => {
      const trimmed = line.trim();
      return trimmed && /[a-zA-Z]/.test(trimmed) && !/^-?\d/.test(trimmed);
    });
    let headerColumns: string[] | null = null;
    if (headerLine) {
      const raw = headerLine.replace(/[#;]/g, " ").trim();
      const split =
        raw.includes(",") ? raw.split(",") : raw.includes("\t") ? raw.split("\t") : raw.split(/\s+/);
      headerColumns = split.map((col) => col.trim().toLowerCase()).filter(Boolean);
    }
    const findColumnIndex = (label: string) => {
      if (!headerColumns) return -1;
      const candidates = axisAliases(label);
      return headerColumns.findIndex((col) => {
        const normalizedCol = normalizeToken(col);
        return candidates.some((candidate) => normalizedCol === candidate || normalizedCol.includes(candidate));
      });
    };
    const pickMapValue = (map: Record<string, number>, axisKey: string) => {
      for (const candidate of axisAliases(axisKey)) {
        if (map[candidate] !== undefined) {
          return map[candidate];
        }
      }
      return undefined;
    };
    const xIndex = findColumnIndex(axisLabels.xKey);
    const yIndex = findColumnIndex(axisLabels.yKey);
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      if (trimmed.includes("=")) {
        const pairs = trimmed.split(/[,\s]+/);
        const map: Record<string, number> = {};
        pairs.forEach((pair) => {
          const [key, value] = pair.split("=");
          if (!key || value === undefined) return;
          const parsed = Number.parseFloat(value);
          if (Number.isFinite(parsed)) {
            map[normalizeToken(key.trim().toLowerCase())] = parsed;
          }
        });
        const xValue = pickMapValue(map, axisLabels.xKey);
        const yValue = pickMapValue(map, axisLabels.yKey);
        if (xValue !== undefined && yValue !== undefined) {
          points.push({ x: xValue, y: yValue });
        }
        return;
      }
      const cols = trimmed.includes(",")
        ? trimmed.split(",")
        : trimmed.includes("\t")
          ? trimmed.split("\t")
          : trimmed.split(/\s+/);
      if (xIndex >= 0 && yIndex >= 0 && cols[xIndex] !== undefined && cols[yIndex] !== undefined) {
        const x = Number.parseFloat(cols[xIndex]);
        const y = Number.parseFloat(cols[yIndex]);
        if (Number.isFinite(x) && Number.isFinite(y)) {
          points.push({ x, y });
        }
        return;
      }
      const values = cols.map((value) => Number.parseFloat(value)).filter((value) => Number.isFinite(value));
      if (values.length < 2) return;
      points.push({ x: values[0], y: values[1] });
    });
    return points;
  }, [resolveOverlayAxes]);

  useEffect(() => {
    if (!authChecked || !isAuthenticated) return;
    let cancelled = false;
    const load = async () => {
      try {
        setStatus("Loading activity...");
        const ensureAssets = (row: { assets?: unknown; asset_urls?: unknown }): CurriculumModule["assets"] =>
          Array.isArray(row?.assets)
            ? (row.assets as CurriculumModule["assets"])
            : Array.isArray(row?.asset_urls)
              ? (row.asset_urls as CurriculumModule["assets"])
              : [];

        const row = await fetchCurriculumModuleById(id, { includeUnpublished: true });
        if (cancelled) return;
        if (row) {
          const normalized = {
            ...row,
            assets: ensureAssets(row),
          };
          setModule(normalized);
          setStatus(null);
          return;
        }

        if (role === "teacher") {
          const liveToken =
            sessionToken ??
            (await supabase.auth.getSession()).data.session?.access_token ??
            null;
          if (liveToken && liveToken !== sessionToken) {
            setSessionToken(liveToken);
          }
          if (liveToken) {
            const res = await fetch("/api/teacher/modules", {
              headers: { Authorization: `Bearer ${liveToken}` },
            });
            const body = await res.json().catch(() => ({}));
            if (res.ok && Array.isArray(body.modules)) {
              const found = (body.modules as CurriculumModule[]).find((m) => m.id === id);
              if (found) {
                const normalized = {
                  ...found,
                  assets: ensureAssets(found),
                };
                setModule(normalized);
                setStatus(null);
                return;
              }
            }
          }
        }

        setStatus("Activity not found.");
      } catch {
        if (cancelled) return;
        setStatus("Unable to load this activity.");
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [authChecked, isAuthenticated, id, role, sessionToken]);

  useEffect(() => {
    if (!module) return;
    const local = readLocalSubmissionHistory(module.id);
    if (local.length) {
      setSubmissions(local);
      setSelectedSubmissionId(local[local.length - 1].id);
      setMarkedDone(true);
      setStoredUploads({
        logFile: local[local.length - 1].logName ? { name: local[local.length - 1].logName, size: 0, type: "" } : undefined,
        plotFile: local[local.length - 1].plotName ? { name: local[local.length - 1].plotName, size: 0, type: "" } : undefined,
        uploadedAt: local[local.length - 1].createdAt,
      });
    }
  }, [module]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const { data: sessionData } = await supabase.auth.getSession();
        const user = data.user;
        if (!user) {
          setIsAuthenticated(false);
          setAuthChecked(true);
          setStatus("Redirecting to login...");
          router.replace("/login");
          return;
        }
        setIsAuthenticated(true);
        setAuthChecked(true);
        setUserId(user.id);
        const profile = await ensureProfile(user);
        if (normalizeApprovalStatus(profile?.approval_status ?? user.user_metadata?.approval_status) !== "approved") {
          await supabase.auth.signOut();
          setIsAuthenticated(false);
          setStatus("Account verification is pending admin approval.");
          router.replace("/login?reason=pending");
          return;
        }
        setStudentName(profile?.full_name ?? user.user_metadata.full_name ?? user.email ?? "Student");
        const roleFromMeta = normalizeRoleValue(user.user_metadata?.role);
        const roleFromProfile = normalizeRoleValue(profile?.role);
        const derivedRole = roleFromMeta ?? roleFromProfile ?? "customer";
        setRole(derivedRole);
        if (!profile || roleFromProfile !== derivedRole) {
          await supabase.from("profiles").upsert({
            id: user.id,
            full_name: user.user_metadata?.full_name || user.email || "User",
            role: derivedRole,
            grade: profile?.grade ?? undefined,
          });
        }
        setSessionToken(sessionData.session?.access_token ?? null);
      } catch {
        setIsAuthenticated(false);
        setAuthChecked(true);
        setUserId(null);
        setStatus("Redirecting to login...");
        router.replace("/login");
      }
    };
    loadProfile();
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    const loadLogo = async () => {
      const logoSrc = typeof logo === "string" ? logo : logo.src;
      try {
        const res = await fetch(logoSrc);
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onload = () => {
          if (cancelled) return;
          if (typeof reader.result === "string") {
            setPdfLogoSrc(reader.result);
          }
        };
        reader.readAsDataURL(blob);
      } catch {
        if (!cancelled) setPdfLogoSrc(null);
      }
    };
    loadLogo();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const loadCode = async () => {
      if (!module) {
        setCodeDisplay("Loading code...");
        return;
      }
      if (isDesignTech) {
        setCodeDisplay("No code required for Design Technology. View STL models above.");
        return;
      }
      if (module.codeSnippet) {
        setCodeDisplay(module.codeSnippet);
        return;
      }
      const codeAsset = Array.isArray(module.assets)
        ? module.assets.find((a) => a.type === "code")
        : undefined;
      if (codeAsset?.url) {
        const decoded = decodeDataUrl(codeAsset.url);
        if (decoded) {
          setCodeDisplay(decoded);
          return;
        }
        const canFetch =
          codeAsset.url.startsWith("http://") ||
          codeAsset.url.startsWith("https://") ||
          codeAsset.url.startsWith("data:") ||
          codeAsset.url.startsWith("blob:");
        if (canFetch) {
          try {
            const res = await fetch(codeAsset.url);
            const txt = await res.text();
            setCodeDisplay(txt || "Code file is empty.");
            return;
          } catch {
            setCodeDisplay("Unable to load code file.");
            return;
          }
        }
        setCodeDisplay(codeAsset.label || "Code file available.");
        return;
      }
      setCodeDisplay("No code snippet available.");
    };
    loadCode();
  }, [module, decodeDataUrl, isDesignTech]);

  const loadSubmissions = useCallback(async () => {
    if (!module) return;
    setSubmissionsLoading(true);
    try {
      let mapped: ActivitySubmission[] = [];
      if (userId) {
        const { data, error } = await supabase
          .from("activity_submissions")
          .select(
            "id,submission_number,log_url,log_name,plot_url,plot_name,plot_type,report_json,report_status,created_at,updated_at",
          )
          .eq("module_id", module.id)
          .eq("user_id", userId)
          .order("submission_number", { ascending: true })
          .order("created_at", { ascending: true });
        if (error) throw error;
        mapped = (data ?? []).map((row, idx) => mapSubmissionRow(row as SubmissionRow, idx));
        if (mapped.length) {
          writeLocalSubmissionHistory(module.id, mapped);
        }
      }
      if (!mapped.length) {
        mapped = readLocalSubmissionHistory(module.id);
      }
      const hidden = readHiddenSubmissions(module.id);
      if (hidden.length) {
        mapped = mapped.filter((item) => !hidden.includes(item.id));
      }
      setSubmissions(mapped);
      if (mapped.length) {
        const latest = mapped[mapped.length - 1];
        setSelectedSubmissionId(latest.id);
        setMarkedDone(true);
      }
    } catch {
      const fallback = readLocalSubmissionHistory(module.id);
      setSubmissions(fallback);
    } finally {
      setSubmissionsLoading(false);
    }
  }, [module, userId]);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

  const openCodeInEditor = async () => {
    if (!module) return;
    const ensurePyExtension = (name: string) => (name.toLowerCase().endsWith(".py") ? name : `${name}.py`);
    const fallbackName = ensurePyExtension(module.title.replace(/\s+/g, "-").toLowerCase() || "code");
    const nav = navigator as Navigator & { msSaveOrOpenBlob?: (blob: Blob, defaultName?: string) => boolean };
    const launchBlob = (blob: Blob, fileName: string) => {
      if (nav?.msSaveOrOpenBlob) {
        nav.msSaveOrOpenBlob(blob, fileName);
        return;
      }
      const url = URL.createObjectURL(blob);
      triggerDownload(url, fileName);
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    };

    if (module.codeSnippet) {
      launchBlob(new Blob([module.codeSnippet], { type: "text/x-python" }), fallbackName);
      return;
    }

    const codeAsset = module.assets.find((a) => a.type === "code");
    if (codeAsset?.url) {
      const fileName = ensurePyExtension(codeAsset.label || fallbackName);
      try {
        const res = await fetch(codeAsset.url);
        if (!res.ok) throw new Error("Failed to fetch code file.");
        const blob = await res.blob();
        launchBlob(blob, fileName);
      } catch (err) {
        console.warn("Unable to fetch code blob; downloading file directly.", err);
        triggerDownload(codeAsset.url, fileName);
      }
      return;
    }

    console.warn("No code file available to open in editor.");
  };

  const openDocInViewer = async () => {
    if (!module) return;
    if (sopAsset?.url) {
      const nav = navigator as Navigator & { msSaveOrOpenBlob?: (blob: Blob, defaultName?: string) => boolean };
      const fileName = (sopAsset.label || "document").trim() || "document";
      const docUrl = sopDownloadUrl;
      if (!docUrl) {
        console.warn("No SOP file URL available to open.");
        return;
      }
      const triggerDownload = (url: string, name: string) => {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = name;
        anchor.rel = "noopener noreferrer";
        anchor.style.display = "none";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      };
      try {
        const res = await fetch(docUrl);
        if (!res.ok) throw new Error("Failed to fetch doc file.");
        const blob = await res.blob();
        if (nav?.msSaveOrOpenBlob) {
          nav.msSaveOrOpenBlob(blob, fileName);
          return;
        }
        const url = URL.createObjectURL(blob);
        triggerDownload(url, fileName);
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      } catch (err) {
        console.warn("Unable to fetch doc blob; downloading file directly.", err);
        triggerDownload(docUrl, fileName);
      }
    } else {
      console.warn("No SOP file available to open.");
    }
  };

  useEffect(() => {
    if (!module || submissions.length > 0) return;
    try {
      const stored = localStorage.getItem(progressStorageKey);
      const parsed = stored ? JSON.parse(stored) : {};
      const entry = parsed[String(module.id)] as ActivityProgressEntry | undefined;
      setStoredUploads(entry?.uploads ?? null);
      setMarkedDone(Boolean(entry?.completed));
    } catch {
      setStoredUploads(null);
      setMarkedDone(false);
    }
  }, [module, submissions.length]);

  useEffect(() => {
    const active = selectedSubmissionId
      ? submissions.find((submission) => submission.id === selectedSubmissionId) ?? submissions[submissions.length - 1]
      : submissions[submissions.length - 1];
    if (!active) {
      setStoredUploads(null);
      setReport(null);
      setReportStatus(null);
      setLogPlotPoints([]);
      return;
    }
    setStoredUploads({
      logFile: active.logName ? { name: active.logName, size: 0, type: "" } : undefined,
      plotFile: active.plotName ? { name: active.plotName, size: 0, type: "" } : undefined,
      uploadedAt: active.createdAt,
    });
    setReport(active.report ?? null);
    setReportStatus(
      active.report ? `Showing report from submission ${active.submissionNumber}.` : active.reportStatus ?? "Report pending.",
    );
    const loadLog = async () => {
      if (!active.logUrl) {
        setLogPlotPoints([]);
        return;
      }
      try {
        const res = await fetch(active.logUrl);
        const text = await res.text();
        const parsedPoints = parseLogPoints(
          text,
          codeDisplay,
          active.plotType || active.plotName || "",
          activityContextText,
        );
        setLogPlotPoints(parsedPoints);
      } catch {
        setLogPlotPoints([]);
      }
    };
    loadLog();
  }, [selectedSubmissionId, submissions, parseLogPoints, codeDisplay, activityContextText]);

  const generateReport = useCallback(
    async (source: { log: File; plot?: File | null }) => {
      if (!module) return null;
      let nextReport: AiReport | null = null;
      setReportLoading(true);
      setReportStatus("Generating AI report...");
      try {
        const logText = await source.log.text();
        const parsedPoints = parseLogPoints(
          logText,
          codeDisplay,
          source.plot?.type || source.plot?.name || "",
          activityContextText,
        );
        const accuracyHint = computeAccuracy(parsedPoints);
        setLogPlotPoints(parsedPoints);
        const sopAsset = module.assets.find((a) => a.type === "doc");
        const res = await fetch("/api/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: module.title,
            subject: module.subject,
            grade: module.grade,
            description: module.description,
            judgingLogic: module.judgingLogic,
            codeText: codeDisplay,
            sopUrl: sopAsset?.url,
            logText,
            plotType: source.plot?.type || source.plot?.name || "",
            parsedPoints: parsedPoints.slice(0, 500),
            accuracyHint: typeof accuracyHint === "number" ? accuracyHint : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data?.report) {
          const detail = (data as { detail?: string; error?: string })?.detail ?? (data as { error?: string })?.error;
          throw new Error(detail || "AI report unavailable.");
        }
        nextReport = data.report as AiReport;
        setReport(nextReport);
        setReportStatus(
          data?.fallback
            ? (data as { detail?: string })?.detail
              ? `AI offline; showing heuristic analysis. Detail: ${(data as { detail?: string }).detail}`
              : "AI offline; showing heuristic analysis."
            : null,
        );
        setPdfStatus(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to generate AI report right now.";
        setReportStatus(message);
        if (!nextReport) {
          setReport(null);
        }
        nextReport = null;
      } finally {
        setReportLoading(false);
      }
      return nextReport;
    },
    [module, codeDisplay, parseLogPoints, activityContextText],
  );

  const downloadReportPdf = useCallback(async () => {
    if (!module || !report) return;
    setDownloadingPdf(true);
    setPdfStatus(null);
    try {
      const html = buildReportHtml({
        logoSrc: pdfLogoSrc,
        activityTitle: module.title,
        activityDescription: module.description,
        accuracyOverride: computedAccuracy ?? undefined,
        subject: module.subject,
        grade: module.grade,
        studentName,
        submissionTime: storedUploads?.uploadedAt ?? "Not recorded",
        logFileName: storedUploads?.logFile?.name ?? logFile?.name ?? "",
        plotFileName: storedUploads?.plotFile?.name ?? plotFile?.name ?? "",
        report,
      });
      const printWindow = window.open("", "_blank", "width=900,height=1200");
      if (!printWindow) {
        throw new Error("Unable to open print window.");
      }
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    } catch {
      setPdfStatus("Unable to generate PDF right now.");
    } finally {
      setDownloadingPdf(false);
    }
  }, [module, report, pdfLogoSrc, studentName, storedUploads, logFile, plotFile, computedAccuracy]);

  const formatError = (err: unknown) => {
    if (err instanceof Error) return err.message;
    if (err && typeof err === "object" && "message" in err && typeof (err as { message?: unknown }).message === "string") {
      return (err as { message: string }).message;
    }
    try {
      return JSON.stringify(err);
    } catch {
      return String(err ?? "Unknown error");
    }
  };

  const deleteSubmission = async (submissionId: string) => {
    if (!userId) {
      setUploadStatus("Sign in to delete a submission.");
      return;
    }
    const submission = submissions.find((item) => item.id === submissionId);
    if (!submission) return;
    setSavingUploads(true);
    setUploadStatus("Deleting submission...");
    let serverDeleted = false;
    try {
      if (!submission.id.startsWith("local-")) {
        let deleteQuery = supabase
          .from("activity_submissions")
          .delete()
          .eq("id", submissionId)
          .eq("user_id", userId);
        if (module?.id) {
          deleteQuery = deleteQuery.eq("module_id", module.id);
        }

        const execDelete = async () => {
          const { data, error } = await deleteQuery.select("id");
          if (error) throw error;
          return (Array.isArray(data) ? data.length : 0) ?? 0;
        };

        let deletedCount = await execDelete();
        if (deletedCount === 0 && module?.id) {
          // Fallback without module filter in case the stored row lacks module_id
          const fallbackDelete = supabase.from("activity_submissions").delete().eq("id", submissionId).eq("user_id", userId);
          const { data, error } = await fallbackDelete.select("id");
          if (error) throw error;
          deletedCount = (Array.isArray(data) ? data.length : 0) ?? 0;
        }

        if (deletedCount === 0) throw new Error("Delete blocked (no matching submission)");
        serverDeleted = true;
        const byBucket = bucketPathsFromUrls([submission.logUrl, submission.plotUrl]);
        await Promise.all(
          Object.entries(byBucket).map(async ([bucket, paths]) => {
            if (!paths.length) return;
            try {
              await supabase.storage.from(bucket).remove(paths);
            } catch {
              // Best effort delete; ignore storage errors
            }
          }),
        );
      }
      setSubmissions((prev) => {
        const remaining = prev.filter((item) => item.id !== submissionId);
        if (module) {
          writeLocalSubmissionHistory(module.id, remaining);
          writeHiddenSubmissions(module.id, readHiddenSubmissions(module.id).filter((id) => id !== submissionId));
        }
        const nextActive = remaining[remaining.length - 1] ?? null;
        setSelectedSubmissionId(nextActive?.id ?? null);
        setMarkedDone(Boolean(nextActive));
        if (!nextActive) {
          setReport(null);
          setReportStatus(null);
          setStoredUploads(null);
          setLogPlotPoints([]);
        } else {
          setStoredUploads({
            logFile: nextActive.logName ? { name: nextActive.logName, size: 0, type: "" } : undefined,
            plotFile: nextActive.plotName ? { name: nextActive.plotName, size: 0, type: "" } : undefined,
            uploadedAt: nextActive.createdAt,
          });
        }
        return remaining;
      });
      setUploadStatus(serverDeleted ? "Submission deleted." : "Removed locally; server delete failed.");
    } catch (err) {
      const message = formatError(err);
      // Hide locally so it doesn't reappear after refresh; surface message for transparency
      setSubmissions((prev) => {
        const remaining = prev.filter((item) => item.id !== submissionId);
        if (module) {
          const hidden = readHiddenSubmissions(module.id);
          writeHiddenSubmissions(module.id, [...hidden, submissionId]);
          writeLocalSubmissionHistory(module.id, remaining);
        }
        const nextActive = remaining[remaining.length - 1] ?? null;
        setSelectedSubmissionId(nextActive?.id ?? null);
        setMarkedDone(Boolean(nextActive));
        if (!nextActive) {
          setReport(null);
          setReportStatus(null);
          setStoredUploads(null);
          setLogPlotPoints([]);
        } else {
          setStoredUploads({
            logFile: nextActive.logName ? { name: nextActive.logName, size: 0, type: "" } : undefined,
            plotFile: nextActive.plotName ? { name: nextActive.plotName, size: 0, type: "" } : undefined,
            uploadedAt: nextActive.createdAt,
          });
        }
        return remaining;
      });
      setUploadStatus(`Removed locally; could not delete on server: ${message}`);
    } finally {
      setSavingUploads(false);
    }
  };

  const handleMarkDone = async () => {
    if (!module) return;
    if (!userId) {
      setUploadStatus("Sign in to upload your submission.");
      return;
    }

    // Design Technology: single document upload
    if (isDesignTech) {
      if (!plotFile) {
        setUploadStatus("Upload a document (PDF/DOC/TXT) to mark this activity as done.");
        return;
      }
      setSavingUploads(true);
      setUploadStatus("Generating AI report...");
      try {
        const textContent = await plotFile.text();
        const sopAsset = module.assets.find((a) => a.type === "doc");
        const res = await fetch("/api/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: module.title,
            subject: module.subject,
            grade: module.grade,
            description: module.description,
            judgingLogic: module.judgingLogic,
            sopUrl: sopAsset?.url,
            logText: textContent,
            parsedPoints: [],
          }),
        });
        const data = await res.json().catch(() => ({}));
        const nextReport = res.ok && data?.report ? (data.report as AiReport) : null;
        if (!nextReport) {
          setReportStatus("AI report unavailable for this upload.");
        } else {
          setReport(nextReport);
          setReportStatus(null);
        }

        setUploadStatus("Uploading file...");
        const pathPrefix = `${submissionPathPrefix}/${userId}/${module.id}`;
        const fileUrl = await uploadFileToBucket({ bucket: submissionsBucket, file: plotFile, pathPrefix });
        const submissionNumber = nextSubmissionNumber;
        const fallbackSubmission: ActivitySubmission = {
          id: `local-${module.id}-${submissionNumber}-${Date.now()}`,
          submissionNumber,
          logUrl: fileUrl,
          logName: plotFile.name,
          plotUrl: "",
          plotName: "",
          plotType: plotFile.type || plotFile.name,
          report: nextReport,
          reportStatus: nextReport ? "Report ready" : "Uploaded; report pending",
          createdAt: new Date().toISOString(),
        };
        setSubmissions((prev) => [...prev, fallbackSubmission]);
        setSelectedSubmissionId(fallbackSubmission.id);
        setStoredUploads({
          logFile: { name: plotFile.name, size: plotFile.size, type: plotFile.type },
          uploadedAt: fallbackSubmission.createdAt,
        });
        writeLocalSubmissionHistory(module.id, [...submissions, fallbackSubmission]);
        setMarkedDone(true);
        setUploadStatus("Saved and analyzed.");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to process submission.";
        setUploadStatus(message);
      } finally {
        setSavingUploads(false);
      }
      return;
    }

    const requiresPlotUpload = !isAuroraActivity;
    if (!logFile || (requiresPlotUpload && !plotFile)) {
      setUploadStatus(
        requiresPlotUpload
          ? "Add both the log file and plots to mark this activity as done."
          : "Add your log file to mark this activity as done.",
      );
      return;
    }

    const selectedPlot = requiresPlotUpload ? plotFile : null;
    setSavingUploads(true);
    setUploadStatus("Generating AI report...");
    const reportResult = await generateReport({ log: logFile, plot: selectedPlot });
    setUploadStatus(requiresPlotUpload ? "Uploading files..." : "Uploading log...");
    try {
      const pathPrefix = `${submissionPathPrefix}/${userId}/${module.id}`;
      const logUrl = await uploadFileToBucket({ bucket: submissionsBucket, file: logFile, pathPrefix });
      const plotUrl = selectedPlot
        ? await uploadFileToBucket({ bucket: submissionsBucket, file: selectedPlot, pathPrefix })
        : "";
      const submissionNumber = nextSubmissionNumber;
      const fallbackSubmission: ActivitySubmission = {
        id: `local-${module.id}-${submissionNumber}-${Date.now()}`,
        submissionNumber,
        logUrl,
        logName: logFile.name,
        plotUrl,
        plotName: selectedPlot?.name || "",
        plotType: selectedPlot ? selectedPlot.type || selectedPlot.name : null,
        report: reportResult,
        reportStatus: reportResult ? "Report ready" : "Report not generated",
        createdAt: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from("activity_submissions")
        .insert({
          user_id: userId,
          module_id: module.id,
          submission_number: submissionNumber,
          log_url: logUrl,
          log_name: logFile.name,
          plot_url: plotUrl,
          plot_name: selectedPlot?.name || "",
          plot_type: selectedPlot ? selectedPlot.type || selectedPlot.name : "",
          report_json: reportResult ?? null,
          report_status: reportResult ? "Report ready" : "Report not generated",
        })
        .select()
        .single();
      if (error) throw error;
      const saved = mapSubmissionRow(data as SubmissionRow, submissions.length);
      const uploads = {
        logFile: buildFileMeta(logFile),
        ...(selectedPlot ? { plotFile: buildFileMeta(selectedPlot) } : {}),
        uploadedAt: saved.createdAt,
      };
      setSubmissions((prev) => [...prev.filter((item) => item.id !== fallbackSubmission.id), saved]);
      setSelectedSubmissionId(saved.id);
      setStoredUploads(uploads);
      writeLocalSubmissionHistory(module.id, [...submissions.filter((item) => item.id !== fallbackSubmission.id), saved]);
      try {
        const stored = localStorage.getItem(progressStorageKey);
        const parsed = stored ? JSON.parse(stored) : {};
        const previous = parsed[String(module.id)] ?? {};
        parsed[String(module.id)] = {
          ...previous,
          completed: true,
          completedAt: previous.completedAt ?? uploads.uploadedAt,
          uploads,
        };
        localStorage.setItem(progressStorageKey, JSON.stringify(parsed));
      } catch {
        // ignore storage errors
      }
      setMarkedDone(true);
      setUploadStatus(`Submission ${saved.submissionNumber} saved.`);
    } catch (err) {
      console.error("Submission save failed", err);
      const reason = getErrorMessage(err);
      const submissionNumber = nextSubmissionNumber;
      const uploads = {
        logFile: buildFileMeta(logFile),
        ...(selectedPlot ? { plotFile: buildFileMeta(selectedPlot) } : {}),
        uploadedAt: new Date().toISOString(),
      };
      const finalReport = reportResult ?? null;
      const finalStatus = finalReport ? "Report ready (saved locally)" : "Saved locally (offline)";
      const fallback: ActivitySubmission = {
        id: `local-${module.id}-${submissionNumber}-${Date.now()}`,
        submissionNumber,
        logUrl: "",
        logName: logFile.name,
        plotUrl: "",
        plotName: selectedPlot?.name || "",
        plotType: selectedPlot ? selectedPlot.type || selectedPlot.name : null,
        report: finalReport,
        reportStatus: finalStatus,
        createdAt: uploads.uploadedAt,
      };
      setSubmissions((prev) => [...prev, fallback]);
      setSelectedSubmissionId(fallback.id);
      setStoredUploads(uploads);
      writeLocalSubmissionHistory(module.id, [...submissions, fallback]);
      setMarkedDone(true);
      setReport(finalReport);
      setReportStatus(finalStatus);
      setUploadStatus(`Saved locally. Unable to sync with server right now. (${reason})`);
    } finally {
      setSavingUploads(false);
    }
  };

  return (
    <main className="section-padding space-y-8">
      {guidedToursEnabled && (
        <GuidedTour
          run={activityTourRun}
          stepIndex={activityTourCurrentStepIndex}
          steps={activityTourSteps}
          onStepIndexChange={handleActivityTourStepChange}
          onClose={closeActivityTour}
          displayStepOffset={activityTourDisplayOffset > 0 ? activityTourDisplayOffset : undefined}
          displayStepTotal={activityTourDisplayTotal}
          palette={activityTourPalette}
        />
      )}

      <div
        className="glass-panel rounded-2xl border border-white/10 p-4 flex flex-wrap items-center justify-between gap-3"
        data-tour="activity-nav"
      >
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-accent-strong">Navigation</p>
          <h2 className="text-lg font-semibold text-white">Activity workspace</h2>
          <p className="text-sm text-slate-400 break-all">Activity ID: {id}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/customer"
            data-tour="activity-back-link"
            className="px-3 py-2 rounded-xl border border-white/10 text-sm text-slate-200 hover:border-accent-strong"
            style={{ outline: "2px solid var(--accent-strong)", outlineOffset: "2px" }}
          >
            Back to activities
          </Link>
          <a
            href="#assessment"
            data-tour="activity-self-assessment-link"
            className="px-3 py-2 rounded-xl bg-accent text-true-white text-sm font-semibold shadow-glow"
          >
            Self Assessment
          </a>
        </div>
      </div>

      {status && <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">{status}</div>}

      {module && (
        <section className="space-y-4">
          <div className="space-y-2" data-tour="activity-overview">
            <p className="text-xs uppercase tracking-[0.2em] font-semibold text-accent-strong">
              Grade {module.grade} • <span className="text-emerald-800">{formatSubject(module.subject)}</span>
            </p>
            <h1 className="text-3xl font-semibold text-white leading-tight">{module.title}</h1>
            <p className="text-slate-300 text-base">{module.description}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {isDesignTech ? (
              <div
                className="glass-panel rounded-2xl p-4 border border-white/10 h-full flex flex-col space-y-3"
                data-tour="activity-stl-panel"
              >
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <h3 className="text-lg font-semibold text-white">3D Models</h3>
                    <p className="text-xs text-slate-400">
                      {stlModels.length ? `${stlModels.length} STL file${stlModels.length > 1 ? "s" : ""}` : "Upload STL files in admin panel."}
                    </p>
                  </div>
                </div>
                {stlModels.length ? (
                  <div className="space-y-3">
                    <label className="block text-xs text-slate-300 space-y-2">
                      Select model
                      <select
                        value={selectedStlModel?.url ?? ""}
                        onChange={(event) => setSelectedStlUrl(event.target.value)}
                        className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
                      >
                        {stlModels.map((asset) => (
                          <option key={asset.url} value={asset.url} className="text-black">
                            {asset.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white truncate" title={selectedStlModel?.name ?? ""}>
                          {selectedStlModel?.name ?? "Selected model"}
                        </p>
                        <button
                          type="button"
                          className="px-3 py-1.5 rounded-lg bg-accent text-true-white text-xs font-semibold shadow-glow hover:opacity-90 border border-accent/60 disabled:opacity-40"
                          onClick={() => {
                            if (!selectedStlModel) return;
                            triggerDownload(selectedStlModel.url, selectedStlModel.fileName);
                          }}
                          disabled={!selectedStlModel}
                        >
                          Download selected
                        </button>
                      </div>
                      {selectedStlModel ? <StlPreview url={selectedStlModel.url} name={selectedStlModel.name} /> : null}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-white/15 bg-white/5 text-sm text-slate-300">
                    No STL models uploaded yet.
                  </div>
                )}
              </div>
            ) : (
              <div className="glass-panel rounded-2xl p-4 border border-white/10 h-full flex flex-col" data-tour="activity-code-panel">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Code</h3>
                    <p className="text-xs text-slate-400">
                      {Array.isArray(module.assets)
                        ? module.assets.find((a) => a.type === "code")?.label || "Python file"
                        : "Python file"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="px-3 py-2 rounded-lg bg-emerald-500 text-true-white text-sm font-semibold shadow-glow disabled:opacity-40 disabled:bg-emerald-500/60"
                      onClick={openCodeInEditor}
                      disabled={
                        !module.codeSnippet &&
                        (!Array.isArray(module.assets) || !module.assets.find((a) => a.type === "code"))
                      }
                      title="Open in your default editor (e.g. VS Code)"
                    >
                      Run
                    </button>
                    <button
                      type="button"
                      className="text-xs text-slate-200 underline"
                      onClick={() => setCodeExpanded((prev) => !prev)}
                    >
                      {codeExpanded ? "Collapse" : "Expand"}
                    </button>
                  </div>
                </div>
                <div
                  className={`bg-black rounded-xl border border-white/15 shadow-inner overflow-hidden ${codeExpanded ? "h-[70vh]" : "h-[320px]"}`}
                >
                  <pre className="p-4 text-sm text-true-white overflow-auto h-full whitespace-pre-wrap">
                    <code>{codeDisplay}</code>
                  </pre>
                </div>
              </div>
            )}

            <div className="glass-panel rounded-2xl p-4 border border-white/10 h-full flex flex-col" data-tour="activity-sop-panel">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-lg font-semibold text-white">SOP</h3>
                  <p className="text-xs text-slate-400">
                    {sopAsset?.label || "Document"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="px-3 py-2 rounded-lg bg-emerald-500 text-true-white text-sm font-semibold shadow-glow disabled:opacity-40 disabled:bg-emerald-500/60"
                    onClick={openDocInViewer}
                    disabled={!sopDownloadUrl}
                    title="Open in your default viewer"
                  >
                    Download
                  </button>
                  <button
                    type="button"
                    className="text-xs text-slate-200 underline"
                    onClick={() => setSopExpanded((prev) => !prev)}
                  >
                    {sopExpanded ? "Collapse" : "Expand"}
                  </button>
                </div>
              </div>
              <div
                className={`bg-black/20 rounded-xl border border-white/10 shadow-inner overflow-hidden ${sopExpanded ? "h-[70vh]" : "h-[320px]"}`}
              >
                {sopAsset?.url ? (
                  sopPreviewUrl ? (
                  <iframe
                    src={sopPreviewUrl}
                    title={sopAsset?.label || "SOP preview"}
                    className="w-full h-full"
                  />
                  ) : (
                    <div className="p-4 text-sm text-slate-300">Preview unavailable for this document. Click Download to open it.</div>
                  )
                ) : (
                  <div className="p-4 text-sm text-slate-300">No documents available.</div>
                )}
              </div>
            </div>

            {videoUrl && (
              <div className="glass-panel rounded-2xl p-4 border border-white/10 h-full flex flex-col space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Video Demo</h3>
                    <p className="text-xs text-slate-400">{videoAsset?.label || "Activity video"}</p>
                  </div>
                  <button
                    type="button"
                    className="px-3 py-2 rounded-lg bg-emerald-500 text-true-white text-sm font-semibold shadow-glow disabled:opacity-40 disabled:bg-emerald-500/60"
                    onClick={() => triggerDownload(videoUrl, videoAsset?.label || "activity-video.mp4")}
                    disabled={!videoUrl}
                  >
                    Download
                  </button>
                </div>
                <div className="bg-black/30 rounded-xl border border-white/10 p-2 h-[320px] overflow-hidden">
                  <video className="w-full h-full rounded-lg bg-black object-contain" controls preload="metadata" src={videoUrl}>
                    Your browser does not support HTML5 video. Use download instead.
                  </video>
                </div>
              </div>
            )}
          </div>

        <div className="glass-panel rounded-2xl p-4 border border-white/10 space-y-3" data-tour="activity-submission-panel">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-accent-strong">Submission</p>
              <h3 className="text-lg font-semibold text-white" data-tour="activity-submission-heading">
                {isDesignTech ? "Upload design report" : isAuroraActivity ? "Upload log file" : "Upload log + plots"}
              </h3>
              <p className="text-sm text-slate-400">
                {isDesignTech
                  ? "Upload a PDF/DOC/TXT with your design work."
                  : isAuroraActivity
                    ? "Add your activity log file, then mark this activity as done."
                    : "Add your activity log file and plots, then mark this activity as done."}
              </p>
            </div>
          </div>

          {isDesignTech ? (
            <div className="grid md:grid-cols-2 gap-4">
              <label className="block text-sm text-slate-300 space-y-2" data-tour="activity-upload-design-doc">
                Upload design document
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setPlotFile(file); // reuse plotFile slot
                    if (file) setUploadStatus(null);
                    setReport(null);
                    setReportStatus(null);
                  }}
                  className="w-full rounded-xl border border-slate-400/60 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none file-accent"
                />
                {plotFile?.name && <p className="text-xs text-slate-400">Selected: {plotFile.name}</p>}
              </label>
            </div>
          ) : (
            <div className={`grid gap-4 ${isAuroraActivity ? "md:grid-cols-1" : "md:grid-cols-2"}`}>
              <label className="block text-sm text-slate-300 space-y-2" data-tour="activity-upload-log-file">
                Upload log file
                <input
                  type="file"
                  accept=".log,.txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setLogFile(file);
                    if (file) setUploadStatus(null);
                    setReport(null);
                    setReportStatus(null);
                    setLogPlotPoints([]);
                  }}
                  className="w-full rounded-xl border border-slate-400/60 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none file-accent"
                />
                {logFile?.name && <p className="text-xs text-slate-400">Selected: {logFile.name}</p>}
                {!logFile?.name && storedUploads?.logFile?.name && (
                  <p className="text-xs text-slate-400">Previously uploaded: {storedUploads.logFile.name}</p>
                )}
              </label>
              {!isAuroraActivity ? (
                <label className="block text-sm text-slate-300 space-y-2" data-tour="activity-upload-plot-file">
                  Upload plots
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setPlotFile(file);
                      if (file) setUploadStatus(null);
                      setReport(null);
                      setReportStatus(null);
                      setLogPlotPoints([]);
                    }}
                    className="w-full rounded-xl border border-slate-400/60 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none file-accent"
                  />
                  {plotFile?.name && <p className="text-xs text-slate-400">Selected: {plotFile.name}</p>}
                  {!plotFile?.name && storedUploads?.plotFile?.name && (
                    <p className="text-xs text-slate-400">Previously uploaded: {storedUploads.plotFile.name}</p>
                  )}
                </label>
              ) : null}
            </div>
          )}

          {uploadStatus && <div className="text-sm text-slate-300">{uploadStatus}</div>}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              data-tour="activity-save-button"
              className="px-4 py-2 rounded-xl bg-accent text-true-white text-sm font-semibold shadow-glow disabled:opacity-50"
              onClick={handleMarkDone}
              disabled={
                savingUploads ||
                (!isDesignTech && (!logFile || (!isAuroraActivity && !plotFile))) ||
                (isDesignTech && !plotFile)
              }
            >
              {savingUploads ? "Saving..." : `Save submission #${nextSubmissionNumber}`}
            </button>
            <button
              type="button"
              className="px-3 py-2 rounded-xl border border-black text-xs text-slate-200 hover:border-accent-strong disabled:opacity-60 outline outline-1 outline-transparent focus:outline-black focus-visible:outline-black"
              onClick={() => void loadSubmissions()}
              disabled={submissionsLoading || savingUploads}
            >
              {submissionsLoading ? "Refreshing..." : "Refresh saved files"}
            </button>
          </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-3" data-tour="activity-submissions-list">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-accent-strong" data-tour="activity-submissions-list-heading">Saved submissions</p>
                </div>
              </div>
              {submissionsLoading ? (
                <div className="text-sm text-slate-300">Loading submissions...</div>
              ) : submissions.length === 0 ? (
                <div className="text-sm text-slate-300">
                  {isDesignTech
                    ? "No submissions yet. Upload your first design report."
                    : isAuroraActivity
                      ? "No submissions yet. Upload your first log file."
                      : "No submissions yet. Upload your first log and plot."}
                </div>
              ) : (
                <div className="space-y-2">
                  {submissions.map((submission) => {
                    const isSelected =
                      submission.id === selectedSubmissionId ||
                      (!selectedSubmissionId && submission.id === submissions[submissions.length - 1]?.id);
                    return (
                      <div
                        key={submission.id}
                        className={`rounded-xl border px-3 py-2 flex flex-wrap items-center justify-between gap-2 ${
                          isSelected ? "border-accent/70 bg-accent/10" : "border-white/10 bg-black/20"
                        }`}
                      >
                        <div>
                          <p className="text-sm font-semibold text-white">Submission #{submission.submissionNumber}</p>
                          <p className="text-xs text-black">
                            {submission.logName || "Log"} • {submission.plotName || "Plot"} •{" "}
                            {new Date(submission.createdAt).toLocaleString()}
                          </p>
                          {submission.reportStatus && <p className="text-xs text-black">{submission.reportStatus}</p>}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold text-true-white disabled:opacity-50 disabled:cursor-not-allowed ${
                              isSelected
                                ? "border-emerald-300 bg-emerald-600 hover:bg-emerald-500"
                                : "border-blue-300 bg-blue-700 hover:bg-blue-600"
                            }`}
                            onClick={() => setSelectedSubmissionId(submission.id)}
                            disabled={savingUploads}
                          >
                            {isSelected ? "Viewing" : "View"}
                          </button>
                          <button
                            type="button"
                            className="px-3 py-1.5 rounded-lg border border-rose-300 bg-rose-600 text-xs font-semibold text-true-white hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => deleteSubmission(submission.id)}
                            disabled={savingUploads}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-4 border border-white/10 space-y-4" data-tour="activity-report-panel">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-accent-strong">AI Report</p>
                <h3 className="text-lg font-semibold text-white" data-tour="activity-report-heading">Student submission analysis</h3>
              </div>
            </div>
            {reportStatus && !reportStatus.startsWith("Showing report from submission") && (
              <div className="text-sm text-slate-300">{reportStatus}</div>
            )}
            {pdfStatus && <div className="text-sm text-slate-300">{pdfStatus}</div>}
            {report && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <button
                    type="button"
                    className="px-5 py-2.5 rounded-xl bg-accent text-true-white text-base font-semibold shadow-glow disabled:opacity-50"
                    onClick={downloadReportPdf}
                    disabled={downloadingPdf || !report}
                  >
                    {downloadingPdf ? "Preparing report..." : "Download AI Report"}
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Accuracy</p>
                    <p className="text-2xl font-semibold text-white">
                      {(() => {
                        const value = computedAccuracy ?? report.accuracyPercent;
                        return typeof value === "number" && Number.isFinite(value) ? `${Math.round(value)}%` : "N/A";
                      })()}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 md:col-span-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Summary</p>
                    <p className="text-sm text-slate-200">{report.summary}</p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Objective alignment</p>
                    <p className="text-sm text-slate-200">{report.objectiveAlignment}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Trend assessment</p>
                    <p className="text-sm text-slate-200">{report.trendAssessment}</p>
                  </div>
                </div>

                {!isAuroraActivity ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                  <p className="text-sm font-semibold text-white">Plot overlay (student vs activity standard)</p>
                  {logPlotPoints.length > 1 ? (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                        <svg viewBox="0 0 100 100" className="w-full h-[28rem]" aria-label="Plot overlay">
                          <rect x="0" y="0" width="100" height="100" fill="#ffffff" />
                          {(() => {
                            const studentXs = logPlotPoints.map((p) => p.x);
                            const studentYs = logPlotPoints.map((p) => p.y);
                            const minStudentX = Math.min(...studentXs);
                            const maxStudentX = Math.max(...studentXs);
                            const minStudentY = Math.min(...studentYs);
                            const maxStudentY = Math.max(...studentYs);
                            const studentSpanX = maxStudentX - minStudentX || 1;
                            const studentSpanY = maxStudentY - minStudentY || 1;
                            const reportOverlayPoints = (report.overlay?.points ?? [])
                              .filter(
                                (point) =>
                                  Number.isFinite(point.x) &&
                                  Number.isFinite(point.y) &&
                                  point.x >= 0 &&
                                  point.x <= 1 &&
                                  point.y >= 0 &&
                                  point.y <= 1,
                              )
                              .sort((a, b) => a.x - b.x)
                              .map((point) => ({
                                x: minStudentX + point.x * studentSpanX,
                                y: minStudentY + point.y * studentSpanY,
                              }));
                            const expectedPoints: PlotPoint[] =
                              isAuroraMission && auroraTarget
                                ? [
                                    { x: 0, y: 0 },
                                    { x: auroraTarget.x, y: auroraTarget.y },
                                  ]
                                : reportOverlayPoints.length > 1
                                  ? reportOverlayPoints
                                  : (() => {
                                      const sortedByX = [...logPlotPoints].sort((a, b) => a.x - b.x);
                                      const startPoint = sortedByX[0];
                                      const endPoint = sortedByX[sortedByX.length - 1];
                                      return startPoint && endPoint ? [startPoint, endPoint] : [];
                                    })();
                            const allPoints = [...logPlotPoints, ...expectedPoints];
                            const xs = allPoints.map((p) => p.x);
                            const ys = allPoints.map((p) => p.y);
                            const minX = Math.min(...xs);
                            const maxX = Math.max(...xs);
                            const minY = Math.min(...ys);
                            const maxY = Math.max(...ys);
                            const spanX = maxX - minX || 1;
                            const spanY = maxY - minY || 1;
                            const ticks = [0, 2, 4];
                            const plotLeft = 14;
                            const plotTop = 8;
                            const plotWidth = 78;
                            const plotHeight = 78;
                            const plotRight = plotLeft + plotWidth;
                            const plotBottom = plotTop + plotHeight;
                            const expectedLabel = isAuroraMission ? "Ideal path (Mission AURORA)" : "Expected path (activity)";
                            const formatTick = (value: number, span: number) => {
                              if (span >= 50) return Math.round(value).toString();
                              if (span >= 10) return value.toFixed(1);
                              return value.toFixed(2);
                            };
                            const toSvg = (point: PlotPoint) => {
                              const x = plotLeft + ((point.x - minX) / spanX) * plotWidth;
                              const y = plotTop + (1 - (point.y - minY) / spanY) * plotHeight;
                              return `${x},${y}`;
                            };
                            const studentPath = logPlotPoints.map(toSvg).join(" ");
                            const expectedPath = expectedPoints.length > 1 ? expectedPoints.map(toSvg).join(" ") : "";
                            const pointMarkers = logPlotPoints.slice(0, 300).map((point, idx) => {
                              const coords = toSvg(point).split(",");
                              return (
                                <circle
                                  key={`pt-${idx}`}
                                  cx={Number.parseFloat(coords[0])}
                                  cy={Number.parseFloat(coords[1])}
                                  r="0.8"
                                  fill="#93c5fd"
                                />
                              );
                            });
                            return (
                              <>
                                {ticks.map((t) => {
                                  const x = plotLeft + (t / 4) * plotWidth;
                                  const y = plotTop + (t / 4) * plotHeight;
                                  return (
                                    <g key={`grid-${t}`}>
                                      <line x1={x} y1={plotTop} x2={x} y2={plotBottom} stroke="rgba(15,23,42,0.15)" strokeWidth="0.4" />
                                      <line x1={plotLeft} y1={y} x2={plotRight} y2={y} stroke="rgba(15,23,42,0.15)" strokeWidth="0.4" />
                                    </g>
                                  );
                                })}
                                <polyline points={studentPath} fill="none" stroke="#2563eb" strokeWidth="1.2" />
                                {pointMarkers}
                                {expectedPath ? (
                                  <polyline points={expectedPath} fill="none" stroke="#dc2626" strokeWidth="1.2" strokeDasharray="2 2" />
                                ) : null}
                                {ticks.map((t) => {
                                  const valueX = minX + (t / 4) * spanX;
                                  const valueY = maxY - (t / 4) * spanY;
                                  return (
                                    <g key={`tick-${t}`}>
                                      <text
                                        x={plotLeft + (t / 4) * plotWidth}
                                        y={plotBottom + 6}
                                        textAnchor="middle"
                                        fill="rgba(15,23,42,0.7)"
                                        fontSize="2.2"
                                      >
                                        {formatTick(valueX, spanX)}
                                      </text>
                                      <text
                                        x="10"
                                        y={plotTop + 2 + (t / 4) * plotHeight}
                                        textAnchor="end"
                                        fill="rgba(15,23,42,0.7)"
                                        fontSize="2.2"
                                      >
                                        {formatTick(valueY, spanY)}
                                      </text>
                                    </g>
                                  );
                                })}
                                <text x={(plotLeft + plotRight) / 2} y="99" textAnchor="middle" fill="rgba(15,23,42,0.9)" fontSize="3">
                                  {overlayAxes.xLabel}
                                </text>
                                <text
                                  x="3.5"
                                  y="50"
                                  textAnchor="middle"
                                  fill="rgba(15,23,42,0.9)"
                                  fontSize="2.8"
                                  transform="rotate(-90 3.5 50)"
                                >
                                  {overlayAxes.yLabel}
                                </text>
                                <g>
                                  <rect x="57" y="10" width="33" height="12" rx="2" fill="rgba(255,255,255,0.9)" stroke="none" />
                                  <line x1="59" y1="14" x2="65" y2="14" stroke="#2563eb" strokeWidth="1.2" />
                                  <text x="67" y="15.2" fill="rgba(15,23,42,0.9)" fontSize="2.4">Student log</text>
                                  <line x1="59" y1="19" x2="65" y2="19" stroke="#dc2626" strokeWidth="1.2" strokeDasharray="2 2" />
                                  <text x="67" y="20.2" fill="#dc2626" fontSize="2.4">{expectedLabel}</text>
                                </g>
                              </>
                            );
                          })()}
                          <rect x="14" y="8" width="78" height="78" fill="none" stroke="rgba(15,23,42,0.35)" />
                        </svg>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-slate-300">
                        <span className="flex items-center gap-2">
                          <span className="inline-block h-2 w-2 rounded-full bg-blue-300" /> Student (from log)
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="inline-block h-2 w-2 rounded-full bg-rose-300" />
                          {isAuroraMission ? "Ideal path to Mission target" : "Expected activity path"}
                        </span>
                      </div>
                      {isAuroraMission && auroraTarget ? (
                        <p className="text-xs text-slate-400">
                          Mission standard uses straight vector path from base (0, 0) to target ({auroraTarget.x}, {auroraTarget.y}).
                        </p>
                      ) : null}
                      {report.overlay?.note && <p className="text-xs text-slate-400">{report.overlay.note}</p>}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-300">Upload a log with at least two numeric columns to view the overlay.</p>
                  )}
                  </div>
                ) : null}

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Possible errors</p>
                    <ul className="text-sm text-slate-200 space-y-1">
                      {normalizeStringList(report.possibleErrors).map((err, idx) => (
                        <li key={idx}>- {err}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Suggestions</p>
                    <ul className="text-sm text-slate-200 space-y-1">
                      {normalizeStringList(report.improvementTips).map((tip, idx) => (
                        <li key={idx}>- {tip}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Log insights</p>
                  <ul className="text-sm text-slate-200 space-y-1">
                    {normalizeStringList(report.logInsights).map((insight, idx) => (
                      <li key={idx}>- {insight}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          <div id="assessment" className="glass-panel rounded-2xl p-4 border border-white/10 space-y-3" data-tour="activity-assessment-panel">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-accent-strong">AI Assessment</p>
                <h3 className="text-lg font-semibold text-white" data-tour="activity-assessment-heading">Generate practice MCQs</h3>
              </div>
              <div className="flex items-center gap-2">
                {quizQuestions.length > 0 && (
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-lg border border-white/15 bg-white/5 text-white text-sm font-semibold hover:bg-white/10"
                    onClick={() => setQuizPanelOpen(true)}
                  >
                    Open quiz panel
                  </button>
                )}
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg bg-accent text-true-white text-sm font-semibold disabled:opacity-50"
                  onClick={generateQuiz}
                  disabled={generatingQuiz}
                >
                  {generatingQuiz ? "Generating..." : "Generate quiz"}
                </button>
              </div>
            </div>
            {quizStatus && <div className="text-sm text-slate-600">{quizStatus}</div>}
          </div>

          {quizPanelOpen && (
            <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 pb-10 pt-12 md:pt-16 bg-slate-900/70 backdrop-blur-sm">
              <div className="w-full max-w-4xl rounded-2xl bg-white border border-stone-300 shadow-2xl p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.2em] text-accent-strong">AI Assessment</p>
                    <h3 className="text-2xl font-semibold text-slate-900">Practice MCQ Quiz</h3>
                    {module && (
                      <p className="text-sm text-slate-600">
                        {module.title} | {formatSubject(module.subject)} | {module.grade}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="text-sm px-3 py-1 rounded-lg border border-accent bg-accent text-true-white hover:opacity-90 disabled:opacity-60"
                      onClick={generateQuiz}
                      disabled={generatingQuiz}
                    >
                      {generatingQuiz ? "Generating..." : "Regenerate"}
                    </button>
                    <button
                      type="button"
                      className="text-sm px-3 py-1 rounded-lg border border-rose-400 bg-rose-700 text-true-white hover:bg-rose-600 hover:border-rose-300"
                      onClick={() => setQuizPanelOpen(false)}
                    >
                      Close
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  {quizStatus && <div className="text-sm text-slate-700">{quizStatus}</div>}

                  {quizQuestions.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-700">
                      {generatingQuiz ? "Preparing quiz..." : "Click Regenerate to fetch questions for this activity."}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm text-slate-700">
                        <div className="flex gap-2 flex-wrap">
                          <span className="px-2 py-1 rounded-md bg-white border border-slate-200 text-slate-700">
                            Time left: {Math.floor(timeLeft / 60)}:{`${timeLeft % 60}`.padStart(2, "0")}
                          </span>
                          <span className="px-2 py-1 rounded-md bg-white border border-slate-200 text-slate-700">
                            Answered: {answeredCount}/{quizQuestions.length}
                          </span>
                        </div>
                        {quizComplete && score !== null && (
                          <span className="text-accent-strong font-semibold">Score: {score}/{quizQuestions.length}</span>
                        )}
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        {quizQuestions.map((item, idx) => {
                          const isHumanityQuestion = item.kind === "humanity";
                          const isActive = idx === currentQuestion;
                          return (
                            <button
                              key={idx}
                              type="button"
                              className={`w-10 h-10 rounded-full border text-sm font-semibold ${
                                isHumanityQuestion
                                  ? isActive
                                    ? "border-orange-500 text-orange-700 bg-orange-50"
                                    : "border-orange-400 text-slate-700 bg-white"
                                  : isActive
                                    ? "border-accent text-accent-strong bg-accent/10"
                                    : "border-slate-300 text-slate-700 bg-white"
                              }`}
                              onClick={() => setCurrentQuestion(idx)}
                            >
                              {idx + 1}
                            </button>
                          );
                        })}
                      </div>

                      {!quizComplete && (
                        <div className="space-y-3">
                          <p className="text-sm text-slate-700 font-semibold">Question {currentQuestion + 1} of {quizQuestions.length}</p>
                          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
                            <p className="text-slate-900 text-base leading-relaxed font-semibold">{quizQuestions[currentQuestion].question}</p>
                            <div className="space-y-2">
                              {quizQuestions[currentQuestion].options.map((opt) => {
                                const selected = selections[currentQuestion] === opt.label;
                                return (
                                  <button
                                    key={opt.label}
                                    type="button"
                                    className={`w-full text-left px-3 py-2 rounded-lg border ${
                                      selected
                                        ? "border-accent bg-accent/10 text-slate-900"
                                        : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                                    }`}
                                    onClick={() => setSelections((prev) => ({ ...prev, [currentQuestion]: opt.label }))}
                                  >
                                    <span className="font-semibold mr-2">{opt.label})</span>
                                    {opt.text}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="flex gap-2 justify-between">
                              <button
                                type="button"
                                className="h-10 px-4 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-50 disabled:opacity-40"
                                disabled={currentQuestion === 0}
                                onClick={() => setCurrentQuestion((idx) => Math.max(0, idx - 1))}
                              >
                                Prev
                              </button>
                              <button
                                type="button"
                                className="h-10 px-4 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-50 disabled:opacity-40"
                                disabled={currentQuestion === quizQuestions.length - 1}
                                onClick={() => setCurrentQuestion((idx) => Math.min(quizQuestions.length - 1, idx + 1))}
                              >
                                Next
                              </button>
                              <button
                                type="button"
                                className="h-10 px-5 rounded-lg bg-accent text-true-white font-semibold shadow-glow disabled:opacity-40"
                                onClick={() => setQuizComplete(true)}
                                disabled={quizComplete}
                              >
                                Submit
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {quizComplete && score !== null && (
                        <div className="rounded-xl border border-accent/30 bg-white p-3 text-slate-900 space-y-3">
                          <p className="text-lg font-semibold">Assessment complete</p>
                          <p className="text-sm">Score: {score}/{quizQuestions.length}</p>
                          {quizQuestions[currentQuestion] && (() => {
                            const q = quizQuestions[currentQuestion];
                            const selected = selections[currentQuestion] ?? "";
                            const selectedOption = q.options.find((opt) => opt.label === selected);
                            const correctOption = q.options.find((opt) => opt.label === q.answer);
                            const isCorrect = selected === q.answer;
                            return (
                              <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 space-y-3">
                                <p className="text-lg font-semibold text-slate-900">
                                  Q{currentQuestion + 1}. {q.question}
                                </p>
                                <p
                                  className={`text-base font-semibold ${
                                    isCorrect
                                      ? "text-emerald-700"
                                      : "text-rose-400 bg-rose-500/15 border border-rose-400/30 px-2 py-1 rounded-md inline-block"
                                  }`}
                                >
                                  Your answer: {selected ? `${selected}) ${selectedOption?.text ?? ""}` : "Not answered"}
                                </p>
                                <p className="text-base text-slate-700">
                                  Correct answer: {q.answer}) {correctOption?.text ?? ""}
                                </p>
                                {q.explanation && <p className="text-base text-slate-700">Explanation: {q.explanation}</p>}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

