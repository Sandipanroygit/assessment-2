import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase env vars. Check .env.local.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);
const bucket = "curriculum-assets";
const outputDir = path.resolve("docs", "generated_sop");

const sanitizeSegment = (value) =>
  String(value || "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "item";

const toAscii = (value) =>
  String(value || "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const parseAssets = (value) => (Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : []);
const hasSop = (assets) => assets.some((asset) => asset.type === "doc" && String(asset.url || "").trim());
const isMissingJudgingLogicColumn = (message) =>
  /judging_logic/i.test(message || "") && /(column|schema cache|does not exist)/i.test(message || "");

const decodeDataUrlText = (url) => {
  if (!url.startsWith("data:")) return null;
  const commaIndex = url.indexOf(",");
  if (commaIndex < 0) return null;
  const header = url.slice(0, commaIndex);
  const body = url.slice(commaIndex + 1);
  if (header.includes(";base64")) {
    return Buffer.from(body, "base64").toString("utf8");
  }
  return decodeURIComponent(body);
};

const shouldTryTextFetch = (url) => /\.(py|txt|ino|md|json|js|ts|csv)$/i.test(url);

const extractCodeOverview = (codeText) => {
  if (!codeText || typeof codeText !== "string") return [];
  const lines = codeText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("//"))
    .map((line) => line.replace(/\s+/g, " "))
    .map((line) => (line.length > 130 ? `${line.slice(0, 127)}...` : line))
    .map(toAscii)
    .filter(Boolean);

  if (!lines.length) return [];

  const keywordMatches = lines.filter((line) =>
    /\b(import|from|def|class|function|const|let|for|while|if|elif|return|setup|loop|takeoff|land)\b/i.test(line),
  );
  const chosen = keywordMatches.length ? keywordMatches : lines;
  return chosen.slice(0, 8);
};

const summarizeText = (value, limit) => {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= limit) return toAscii(normalized);
  return toAscii(`${normalized.slice(0, limit - 3)}...`);
};

async function readCodeTextFromAsset(asset) {
  if (!asset || typeof asset !== "object") return null;
  const rawUrl = String(asset.url || "").trim();
  if (!rawUrl) return null;

  if (rawUrl.startsWith("data:")) {
    const decoded = decodeDataUrlText(rawUrl);
    return decoded ? decoded.slice(0, 20000) : null;
  }

  if (!/^https?:\/\//i.test(rawUrl) || !shouldTryTextFetch(rawUrl)) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(rawUrl, { signal: controller.signal });
    if (!response.ok) return null;
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (!/text|json|javascript|python|octet-stream/i.test(contentType)) {
      return null;
    }
    const text = await response.text();
    if (!text.trim()) return null;
    return text.slice(0, 20000);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

const wrapText = (line, maxLen = 96) => {
  const normalized = toAscii(line);
  if (!normalized) return [];
  const words = normalized.split(" ");
  const out = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxLen) {
      current = candidate;
      continue;
    }
    if (current) out.push(current);
    current = word;
  }
  if (current) out.push(current);
  return out;
};

const escapePdfText = (value) => String(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

function buildSopLineModel(payload) {
  const title = toAscii(payload.title || "Activity");
  const grade = toAscii(payload.grade || "Grade");
  const subject = toAscii(payload.subject || "Subject");
  const moduleName = toAscii(payload.module || "Module");
  const description = summarizeText(payload.description, 420) || "No description provided.";
  const judgingLogic = summarizeText(payload.judgingLogic, 420) || "Use evidence-based technical judgment.";
  const codeLabel = toAscii(payload.codeLabel || "No named code asset");
  const codeOverview = Array.isArray(payload.codeOverview) && payload.codeOverview.length
    ? payload.codeOverview.map((line) => toAscii(line))
    : ["Code preview unavailable. Use module code asset as primary reference."];

  const isSimulation = `${title} ${description}`.toLowerCase().includes("simulation");
  const steps = isSimulation
    ? [
        "Review mission objective and expected output behavior before execution.",
        "Inspect code structure, parameters, and required runtime dependencies.",
        "Run simulation in controlled trials and capture output logs or plots.",
        "Compare output trends with expected mission behavior and locate mismatches.",
        "Iterate parameters or logic and rerun with clear change tracking.",
        "Finalize the best run and summarize technical reasoning and outcomes.",
      ]
    : [
        "Review mission objective, safety checks, and execution constraints.",
        "Inspect code flow and map commands to each mission phase.",
        "Prepare physical setup or materials and validate pre-run conditions.",
        "Execute in controlled stages while collecting logs and observations.",
        "Apply evidence-based fixes and rerun until stable behavior is achieved.",
        "Validate completion criteria and record final technical conclusions.",
      ];

  const lines = [];
  lines.push({ text: `Mission SOP: ${title}`, font: "F2", size: 18, spacing: 22 });
  lines.push({ text: `${grade} | ${subject} | ${moduleName} | Mission Format`, font: "F2", size: 11, spacing: 16 });
  lines.push({ text: "", font: "F1", size: 10, spacing: 10 });
  lines.push({ text: "Mission Context", font: "F2", size: 13, spacing: 16 });
  for (const segment of wrapText(description)) lines.push({ text: segment, font: "F1", size: 10, spacing: 13 });
  lines.push({ text: "", font: "F1", size: 10, spacing: 9 });
  lines.push({ text: "Mission Control Directive", font: "F2", size: 13, spacing: 16 });
  for (const segment of wrapText(judgingLogic)) lines.push({ text: segment, font: "F1", size: 10, spacing: 13 });
  lines.push({ text: "", font: "F1", size: 10, spacing: 9 });
  lines.push({ text: "Code Basis Snapshot", font: "F2", size: 13, spacing: 16 });
  lines.push({ text: `Primary code asset: ${codeLabel}`, font: "F1", size: 10, spacing: 13 });
  codeOverview.forEach((entry, idx) => {
    for (const segment of wrapText(`${idx + 1}. ${entry}`)) lines.push({ text: segment, font: "F1", size: 10, spacing: 13 });
  });
  lines.push({ text: "", font: "F1", size: 10, spacing: 9 });
  lines.push({ text: "Standard Operating Procedure", font: "F2", size: 13, spacing: 16 });
  steps.forEach((step, idx) => {
    for (const segment of wrapText(`${idx + 1}. ${step}`)) lines.push({ text: segment, font: "F1", size: 10, spacing: 13 });
  });
  lines.push({ text: "", font: "F1", size: 10, spacing: 9 });
  lines.push({ text: "Evidence Checklist", font: "F2", size: 13, spacing: 16 });
  for (const segment of wrapText("1. Setup complete: Environment, safety, and configuration are documented.")) {
    lines.push({ text: segment, font: "F1", size: 10, spacing: 13 });
  }
  for (const segment of wrapText("2. Code alignment: Run behavior matches intended mission logic.")) {
    lines.push({ text: segment, font: "F1", size: 10, spacing: 13 });
  }
  for (const segment of wrapText("3. Execution proof: Logs, plots, photos, or outputs are captured with timestamps.")) {
    lines.push({ text: segment, font: "F1", size: 10, spacing: 13 });
  }
  for (const segment of wrapText("4. Iteration quality: At least one issue-response-improvement loop is explained.")) {
    lines.push({ text: segment, font: "F1", size: 10, spacing: 13 });
  }
  for (const segment of wrapText("5. Final validation: Outcome is compared to mission objective with clear conclusion.")) {
    lines.push({ text: segment, font: "F1", size: 10, spacing: 13 });
  }
  lines.push({ text: "", font: "F1", size: 10, spacing: 9 });
  lines.push({ text: "Submission", font: "F2", size: 13, spacing: 16 });
  for (const segment of wrapText("Submit a PDF report with execution evidence, observed issues, and final technical conclusions.")) {
    lines.push({ text: segment, font: "F1", size: 10, spacing: 13 });
  }
  lines.push({ text: "", font: "F1", size: 10, spacing: 9 });
  lines.push({ text: "Mission Rule: Evidence-Driven Decisions = Mission Success", font: "F2", size: 11, spacing: 14 });
  return lines;
}

function createPdfBuffer(lineModel) {
  const pageWidth = 595;
  const pageHeight = 842;
  const marginX = 42;
  const topY = 800;
  const bottomY = 52;

  const pages = [];
  let currentCommands = [];
  let y = topY;

  const flushPage = () => {
    if (!currentCommands.length) return;
    pages.push(currentCommands.join("\n"));
    currentCommands = [];
    y = topY;
  };

  for (const line of lineModel) {
    const spacing = Number(line.spacing || 13);
    if (y - spacing < bottomY) {
      flushPage();
    }
    if (line.text) {
      const font = line.font === "F2" ? "F2" : "F1";
      const size = Number(line.size || 10);
      currentCommands.push(`BT /${font} ${size} Tf ${marginX} ${y} Td (${escapePdfText(line.text)}) Tj ET`);
    }
    y -= spacing;
  }
  flushPage();
  if (!pages.length) {
    pages.push("BT /F1 10 Tf 42 800 Td (Mission SOP) Tj ET");
  }

  const objects = [];
  const addObject = (body) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesRootId = 2;
  const fontRegularId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBoldId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  const pageIds = [];
  for (const content of pages) {
    const contentStream = `${content}\n`;
    const contentLength = Buffer.byteLength(contentStream, "utf8");
    const contentObjId = addObject(`<< /Length ${contentLength} >>\nstream\n${contentStream}endstream`);
    const pageObjId = addObject(
      `<< /Type /Page /Parent ${pagesRootId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentObjId} 0 R >>`,
    );
    pageIds.push(pageObjId);
  }

  objects[pagesRootId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesRootId} 0 R >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) {
    const id = i + 1;
    offsets[id] = Buffer.byteLength(pdf, "utf8");
    pdf += `${id} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(pdf, "utf8");
}

async function uploadPdf(pdfBuffer, moduleId, title) {
  const safeTitle = sanitizeSegment(title);
  const objectPath = `curriculum/backfill-sop/${moduleId}/${Date.now()}-${safeTitle}-sop.pdf`;
  const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, pdfBuffer, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  if (!data?.publicUrl) throw new Error("Public URL generation failed");
  return data.publicUrl;
}

async function updateModuleAssets(moduleId, nextAssets) {
  const { error } = await supabase.from("curriculum_modules").update({ asset_urls: nextAssets }).eq("id", moduleId);
  if (error) throw new Error(`Update failed: ${error.message}`);
}

async function main() {
  const selectWithJudging = "id,title,grade,subject,module,description,judging_logic,asset_urls,published,created_at";
  const selectWithoutJudging = "id,title,grade,subject,module,description,asset_urls,published,created_at";

  let { data, error } = await supabase
    .from("curriculum_modules")
    .select(selectWithJudging)
    .order("created_at", { ascending: false });

  if (error && isMissingJudgingLogicColumn(error.message)) {
    ({ data, error } = await supabase
      .from("curriculum_modules")
      .select(selectWithoutJudging)
      .order("created_at", { ascending: false }));
  }

  if (error) {
    throw new Error(`Unable to load modules: ${error.message}`);
  }

  const rows = data ?? [];
  const targets = rows.filter((row) => !hasSop(parseAssets(row.asset_urls)));
  console.log(`Total modules: ${rows.length}`);
  console.log(`Missing SOP modules: ${targets.length}`);

  await fs.mkdir(outputDir, { recursive: true });

  let success = 0;
  let failed = 0;
  const failures = [];

  for (const row of targets) {
    const assets = parseAssets(row.asset_urls);
    const codeAsset = assets.find((asset) => asset.type === "code") ?? null;
    const codeLabel = codeAsset ? String(codeAsset.label || "").trim() : "";
    try {
      const codeText = await readCodeTextFromAsset(codeAsset);
      const codeOverview = extractCodeOverview(codeText);
      const lineModel = buildSopLineModel({
        title: row.title,
        grade: row.grade,
        subject: row.subject,
        module: row.module,
        description: summarizeText(row.description, 420),
        judgingLogic: summarizeText(row.judging_logic, 420),
        codeLabel: codeLabel || "No named code asset",
        codeOverview,
      });
      const pdfBuffer = createPdfBuffer(lineModel);

      const fileBase = `${sanitizeSegment(row.title)}-${row.id.slice(0, 8)}-sop.pdf`;
      const localPath = path.join(outputDir, fileBase);
      await fs.writeFile(localPath, pdfBuffer);

      const sopUrl = await uploadPdf(pdfBuffer, row.id, row.title);
      const nextAssets = [
        ...assets,
        {
          type: "doc",
          url: sopUrl,
          label: `${row.title} SOP (Mission Format PDF)`,
        },
      ];

      await updateModuleAssets(row.id, nextAssets);
      success += 1;
      console.log(`Added SOP: ${row.title} (${row.id})`);
    } catch (moduleError) {
      failed += 1;
      const message = moduleError instanceof Error ? moduleError.message : String(moduleError);
      failures.push({ id: row.id, title: row.title, error: message });
      console.error(`Failed SOP backfill: ${row.title} (${row.id}) -> ${message}`);
    }
  }

  const { data: verifyRows, error: verifyError } = await supabase.from("curriculum_modules").select("id,asset_urls");
  if (verifyError) {
    throw new Error(`Verification query failed: ${verifyError.message}`);
  }
  const stillMissing = (verifyRows ?? []).filter((row) => !hasSop(parseAssets(row.asset_urls))).length;

  console.log("\nBackfill summary");
  console.log(JSON.stringify({ success, failed, stillMissing }, null, 2));
  if (failures.length) {
    console.log("Failures:");
    console.log(JSON.stringify(failures, null, 2));
  }
}

main().catch((error) => {
  console.error(error.message || String(error));
  process.exit(1);
});
