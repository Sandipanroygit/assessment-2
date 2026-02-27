import { supabase } from "@/lib/supabaseClient";
import type { SteamhProject, SteamhProjectLink } from "@/types";

export const STEAMH_PROJECTS_BUCKET = "curriculum-assets";
export const STEAMH_PROJECTS_PATH_PREFIX = "steamh-projects";
export const MAX_STEAMH_IMAGES = 6;
export const MAX_STEAMH_VIDEOS = 2;
export const MAX_STEAMH_ATTACHMENTS = 4;
export const MAX_STEAMH_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_STEAMH_VIDEO_SIZE_BYTES = 80 * 1024 * 1024;
export const MAX_STEAMH_ATTACHMENT_SIZE_BYTES = 15 * 1024 * 1024;
const HIDDEN_SAMPLE_PROJECT_IDS = new Set([
  "5d0f14a2-1f8d-4d31-8fdf-1ec9f0010001",
  "5d0f14a2-1f8d-4d31-8fdf-1ec9f0010002",
  "5d0f14a2-1f8d-4d31-8fdf-1ec9f0010003",
]);

type SteamhProjectRow = {
  id: string;
  student_id: string | null;
  student_name: string;
  school_name: string | null;
  grade: string | null;
  subject: string | null;
  title: string;
  summary: string;
  description: string;
  challenge: string | null;
  solution: string | null;
  tools_used: unknown;
  tags: unknown;
  image_urls: unknown;
  video_urls: unknown;
  attachment_urls: unknown;
  external_links: unknown;
  published: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

type FetchSteamhProjectsOptions = {
  includeUnpublished?: boolean;
  studentId?: string;
  limit?: number;
};

type FetchSteamhProjectByIdOptions = {
  includeUnpublished?: boolean;
};

const STEAMH_PROJECT_SELECT_COLUMNS =
  "id,student_id,student_name,school_name,grade,subject,title,summary,description,challenge,solution,tools_used,tags,image_urls,video_urls,attachment_urls,external_links,published,created_at,updated_at";

const parseStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return [];
};

const parseExternalLinks = (value: unknown): SteamhProjectLink[] => {
  if (!Array.isArray(value)) return [];
  const links: SteamhProjectLink[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const url = "url" in item && typeof item.url === "string" ? item.url.trim() : "";
    const label = "label" in item && typeof item.label === "string" ? item.label.trim() : "";
    if (!url) continue;
    links.push({ url, label: label || undefined });
  }
  return links;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return "";
};

const toError = (error: unknown, fallbackMessage: string) => {
  if (error instanceof Error) return error;
  const message = getErrorMessage(error);
  if (message.trim()) return new Error(message);
  return new Error(fallbackMessage);
};

const normalizePublished = (value: boolean | null) => value !== false;
const normalizeDate = (value: string | null) => value ?? new Date().toISOString();

export const mapSteamhProjectRow = (row: SteamhProjectRow): SteamhProject => {
  const rawTags = parseStringArray(row.tags);

  return {
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name,
    schoolName: row.school_name ?? "",
    grade: row.grade ?? "",
    subject: row.subject ?? "",
    title: row.title,
    summary: row.summary,
    description: row.description,
    challenge: row.challenge ?? "",
    solution: row.solution ?? "",
    toolsUsed: parseStringArray(row.tools_used),
    tags: rawTags,
    imageUrls: parseStringArray(row.image_urls),
    videoUrls: parseStringArray(row.video_urls),
    attachmentUrls: parseStringArray(row.attachment_urls),
    externalLinks: parseExternalLinks(row.external_links),
    published: normalizePublished(row.published),
    createdAt: normalizeDate(row.created_at),
    updatedAt: normalizeDate(row.updated_at),
  };
};

export const splitCsvValues = (raw: string, maxItems = 12) =>
  Array.from(
    new Set(
      raw
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ).slice(0, maxItems);

export const splitMultilineUrls = (raw: string, maxItems = 8) => {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const urls: string[] = [];
  for (const line of lines) {
    if (urls.length >= maxItems) break;
    try {
      const parsed = new URL(line);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        urls.push(parsed.toString());
      }
    } catch {
      // ignore invalid URL lines
    }
  }
  return urls;
};

export async function fetchSteamhProjects(options?: FetchSteamhProjectsOptions) {
  const includeUnpublished = options?.includeUnpublished ?? false;
  const studentId = options?.studentId ?? null;
  const limit = options?.limit ?? null;
  let query = supabase
    .from("steamh_projects")
    .select(STEAMH_PROJECT_SELECT_COLUMNS)
    .order("created_at", { ascending: false });

  if (!includeUnpublished) {
    query = query.eq("published", true);
  }
  if (studentId) {
    query = query.eq("student_id", studentId);
  }
  if (limit && Number.isFinite(limit) && limit > 0) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) throw toError(error, "Unable to load STEAM-H projects.");
  return ((data as SteamhProjectRow[] | null) ?? [])
    .map(mapSteamhProjectRow)
    .filter((project) => !HIDDEN_SAMPLE_PROJECT_IDS.has(project.id));
}

export async function fetchSteamhProjectById(id: string, options?: FetchSteamhProjectByIdOptions) {
  const projectId = typeof id === "string" ? id.trim() : "";
  if (!projectId) return null;

  const includeUnpublished = options?.includeUnpublished ?? false;
  let query = supabase
    .from("steamh_projects")
    .select(STEAMH_PROJECT_SELECT_COLUMNS)
    .eq("id", projectId)
    .limit(1);

  if (!includeUnpublished) {
    query = query.eq("published", true);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw toError(error, "Unable to load STEAM-H project.");
  if (!data) return null;

  const project = mapSteamhProjectRow(data as SteamhProjectRow);
  if (HIDDEN_SAMPLE_PROJECT_IDS.has(project.id)) return null;
  return project;
}
