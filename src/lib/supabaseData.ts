import { supabase } from "@/lib/supabaseClient";
import type { CurriculumModule, Product } from "@/types";

type CurriculumRow = {
  id: string;
  title: string;
  grade: string;
  subject: string;
  module: string;
  description: string | null;
  judging_logic?: string | null;
  asset_urls: unknown;
  price_yearly: number | null;
  published: boolean | null;
};

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  gallery_urls?: unknown;
  price: number;
  stock: number | null;
  delivery_eta: string | null;
  featured: boolean | null;
};

const safeArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const encodeStoragePath = (path: string) => path.split("/").map(encodeURIComponent).join("/");
const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return "";
};
const isMissingGalleryColumn = (error: unknown) =>
  /gallery_urls/i.test(getErrorMessage(error)) && /column/i.test(getErrorMessage(error));
const isMissingJudgingLogicColumn = (error: unknown) =>
  /judging_logic/i.test(getErrorMessage(error)) && /(column|schema cache)/i.test(getErrorMessage(error));
const isBadRequest = (error: unknown) => (error as { status?: number } | null)?.status === 400;
const toError = (error: unknown, fallbackMessage: string) => {
  if (error instanceof Error) return error;
  if (typeof error === "string" && error.trim()) return new Error(error);
  if (error && typeof error === "object") {
    const message = getErrorMessage(error) || null;
    const code =
      "code" in error && typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : null;
    if (message && message.trim()) {
      return new Error(code ? `${message} (${code})` : message);
    }
  }
  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== "{}") return new Error(serialized);
  } catch {
    // ignore serialization failures
  }
  return new Error(fallbackMessage);
};

export const mapCurriculumRow = (row: CurriculumRow): CurriculumModule => {
  const assets = safeArray<CurriculumModule["assets"][number]>(row.asset_urls);
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

export const mapProductRow = (row: ProductRow): Product => {
  const image = row.image_url ?? "";
  const gallery = safeArray<string>(row.gallery_urls);
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    image,
    gallery,
    price: row.price,
    deliveryEta: row.delivery_eta ?? "3-5 days",
    expectedDelivery: "",
    stock: row.stock ?? 0,
    sku: `SKU-${row.id.slice(0, 8)}`,
    highlights: [],
    featured: row.featured ?? undefined,
  };
};

export async function fetchCurriculumModules(options?: { includeUnpublished?: boolean; subject?: string }) {
  const includeUnpublished = options?.includeUnpublished ?? false;
  const subjectFilter = options?.subject ?? null;
  const isDesignTech = subjectFilter ? subjectFilter.toLowerCase().includes("design") : false;
  const buildQuery = (includeJudgingLogic: boolean) => {
    let query = supabase
      .from("curriculum_modules")
      .select(
        includeJudgingLogic
          ? "id,title,grade,subject,module,description,judging_logic,asset_urls,price_yearly,published,created_at"
          : "id,title,grade,subject,module,description,asset_urls,price_yearly,published,created_at",
      )
      .order("created_at", { ascending: false });

    if (subjectFilter) {
      query = query.eq("subject", subjectFilter);
    }

    if (!includeUnpublished) {
      if (isDesignTech) {
        // allow unpublished Design Technology modules
        // no published filter
      } else if (!subjectFilter) {
        // show all published modules, plus any Design Technology modules even if unpublished
        query = query.or("published.eq.true,subject.eq.Design Technology,subject.eq.Design & Technology");
      } else {
        query = query.eq("published", true);
      }
    }

    return query;
  };

  const withJudging = await buildQuery(true);
  let data: unknown = withJudging.data;
  let error = withJudging.error;
  if (error && isMissingJudgingLogicColumn(error)) {
    const withoutJudging = await buildQuery(false);
    data = withoutJudging.data;
    error = withoutJudging.error;
  }
  if (error) throw toError(error, "Unable to load curriculum modules.");
  return ((data as CurriculumRow[] | null) ?? []).map(mapCurriculumRow);
}

export async function fetchCurriculumModuleById(id: string, options?: { includeUnpublished?: boolean }) {
  const includeUnpublished = options?.includeUnpublished ?? false;
  const withJudging = () =>
    supabase
      .from("curriculum_modules")
      .select("id,title,grade,subject,module,description,judging_logic,asset_urls,price_yearly,published,created_at")
      .eq("id", id)
      .maybeSingle();
  const withoutJudging = () =>
    supabase
      .from("curriculum_modules")
      .select("id,title,grade,subject,module,description,asset_urls,price_yearly,published,created_at")
      .eq("id", id)
      .maybeSingle();

  const withJudgingResult = await withJudging();
  let data: unknown = withJudgingResult.data;
  let error = withJudgingResult.error;
  if (error && isMissingJudgingLogicColumn(error)) {
    const withoutJudgingResult = await withoutJudging();
    data = withoutJudgingResult.data;
    error = withoutJudgingResult.error;
  }
  if (error) throw toError(error, "Unable to load curriculum module.");
  if (!data) return null;
  const mapped = mapCurriculumRow(data as CurriculumRow);
  if (includeUnpublished) return mapped;
  if (mapped.published === true) return mapped;
  if ((mapped.subject ?? "").toLowerCase().includes("design")) return mapped;
  return null;
}

export async function fetchProducts() {
  const query = () =>
    supabase
      .from("products")
      .select("id,name,description,image_url,gallery_urls,price,stock,delivery_eta,featured,created_at")
      .order("created_at", { ascending: false });
  const fallbackQuery = () =>
    supabase
      .from("products")
      .select("id,name,description,image_url,price,stock,delivery_eta,featured,created_at")
      .order("created_at", { ascending: false });

  const { data, error } = await query();
  if (error) {
    if (isMissingGalleryColumn(error) || isBadRequest(error)) {
      const { data: fallbackData, error: fallbackError } = await fallbackQuery();
      if (fallbackError) throw toError(fallbackError, "Unable to load products.");
      return (fallbackData as ProductRow[]).map(mapProductRow);
    }
    throw toError(error, "Unable to load products.");
  }
  return (data as ProductRow[]).map(mapProductRow);
}

export async function fetchProductById(id: string) {
  const query = () =>
    supabase
      .from("products")
      .select("id,name,description,image_url,gallery_urls,price,stock,delivery_eta,featured,created_at")
      .eq("id", id)
      .maybeSingle();
  const fallbackQuery = () =>
    supabase
      .from("products")
      .select("id,name,description,image_url,price,stock,delivery_eta,featured,created_at")
      .eq("id", id)
      .maybeSingle();

  const { data, error } = await query();
  if (error) {
    if (isMissingGalleryColumn(error) || isBadRequest(error)) {
      const { data: fallbackData, error: fallbackError } = await fallbackQuery();
      if (fallbackError) throw toError(fallbackError, "Unable to load product details.");
      if (!fallbackData) return null;
      return mapProductRow(fallbackData as ProductRow);
    }
    throw toError(error, "Unable to load product details.");
  }
  if (!data) return null;
  return mapProductRow(data as ProductRow);
}

export async function uploadFileToBucket(params: {
  bucket: string;
  file: File;
  pathPrefix: string;
  fileName?: string;
}) {
  const safeName = (params.fileName || params.file.name || "file").replace(/[^\w.\-]+/g, "-");
  const path = `${params.pathPrefix}/${Date.now()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from(params.bucket)
    .upload(path, params.file, { contentType: params.file.type || undefined, upsert: true });
  if (uploadError) throw toError(uploadError, "Unable to upload file.");
  const { data } = supabase.storage.from(params.bucket).getPublicUrl(path);
  const publicUrl = data?.publicUrl ?? "";
  if (publicUrl.includes("/storage/v1/object/public/")) return publicUrl;

  const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  if (!baseUrl) return publicUrl;
  return `${baseUrl}/storage/v1/object/public/${params.bucket}/${encodeStoragePath(path)}`;
}

export function dataUrlToFile(dataUrl: string, fileName: string) {
  const [header, base64] = dataUrl.split(",");
  if (!header || !base64) {
    throw new Error("Invalid data URL.");
  }
  const mime = header.match(/data:(.*);base64/)?.[1] || "application/octet-stream";
  const bytes = atob(base64);
  const buf = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) buf[i] = bytes.charCodeAt(i);
  return new File([buf], fileName, { type: mime });
}

export type AnalyticsEventRow = {
  id: number;
  user_id: string | null;
  event_type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
};

export async function fetchAnalyticsEvents(limit = 200) {
  const { data, error } = await supabase
    .from("analytics_events")
    .select("id,user_id,event_type,payload,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw toError(error, "Unable to load analytics events.");
  return (data as AnalyticsEventRow[]) ?? [];
}

export type PageViewRow = {
  id: number;
  page: string;
  created_at: string;
};

export async function fetchPageViews(limit = 200) {
  const { data, error } = await supabase
    .from("page_views")
    .select("id,page,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw toError(error, "Unable to load page views.");
  return (data as PageViewRow[]) ?? [];
}
