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

const title = "Lunar Mission - Tello Drone LEM Build";
const grade = "Grade 11";
const subject = "Design Technology";
const moduleName = "Drone Module";
const published = true;
const bucket = "curriculum-assets";
const missionRoot = path.resolve("eagle", "Lunar_Mission");
const stlDir = path.join(missionRoot, "files");
const sopPdfPath = path.join(missionRoot, "Lunar_Mission_SOP.pdf");

const judgingLogic = [
  "Assess the student submission as a Design Technology build report for the Lunar Mission LEM model.",
  "Score higher when the submission includes: clear assembly sequence, STL selection rationale, structural reinforcement choices, sensor visibility/safety checks for Tello, and print material tradeoff discussion.",
  "Award top marks for evidence-backed iterations, concise SOP adherence, and a stable final design aligned with mission constraints.",
].join(" ");

const description = [
  "Students build and evaluate a Tello-mounted Lunar Excursion Module (LEM) prototype using supplied STL parts.",
  "The activity focuses on CAD-to-print workflow, structural design decisions, drone payload integration, and safe assembly/testing practice.",
  "Learners document print settings, assembly order, fitment validation, and flight-readiness checks in a design SOP.",
].join(" ");

const sanitize = (name) => name.replace(/[^a-zA-Z0-9._-]+/g, "-");
const isMissingJudgingLogicColumn = (message) =>
  /judging_logic/i.test(message || "") && /(column|schema cache)/i.test(message || "");

async function uploadFile(localPath, objectPath, contentType) {
  const fileBuffer = await fs.readFile(localPath);
  const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, fileBuffer, {
    contentType,
    upsert: true,
  });
  if (uploadError) {
    throw new Error(`Upload failed for ${localPath}: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  if (!data?.publicUrl) {
    throw new Error(`Could not get public URL for ${objectPath}`);
  }
  return data.publicUrl;
}

async function collectAssets() {
  const entries = await fs.readdir(stlDir, { withFileTypes: true });
  const stlFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".stl"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }));

  if (stlFiles.length === 0) {
    throw new Error("No STL files found in eagle/Lunar_Mission/files");
  }

  const assetPrefix = "curriculum/lunar-mission";
  const assets = [];

  for (const stlName of stlFiles) {
    const localPath = path.join(stlDir, stlName);
    const objectPath = `${assetPrefix}/stl/${sanitize(stlName)}`;
    const url = await uploadFile(localPath, objectPath, "model/stl");
    assets.push({ type: "stl", url, label: stlName });
  }

  const sopObjectPath = `${assetPrefix}/docs/${sanitize(path.basename(sopPdfPath))}`;
  const sopUrl = await uploadFile(sopPdfPath, sopObjectPath, "application/pdf");
  assets.push({ type: "doc", url: sopUrl, label: "Lunar Mission SOP (Mission Format PDF)" });

  return assets;
}

async function upsertCurriculumModule(assetUrls) {
  const { data: existingRow, error: existingError } = await supabase
    .from("curriculum_modules")
    .select("id")
    .eq("title", title)
    .eq("grade", grade)
    .eq("subject", subject)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Unable to check existing module: ${existingError.message}`);
  }

  const payload = {
    title,
    grade,
    subject,
    module: moduleName,
    description,
    judging_logic: judgingLogic,
    asset_urls: assetUrls,
    published,
  };
  const payloadWithoutJudging = {
    title,
    grade,
    subject,
    module: moduleName,
    description,
    asset_urls: assetUrls,
    published,
  };

  if (existingRow?.id) {
    let { error: updateError } = await supabase.from("curriculum_modules").update(payload).eq("id", existingRow.id);
    if (updateError && isMissingJudgingLogicColumn(updateError.message)) {
      ({ error: updateError } = await supabase
        .from("curriculum_modules")
        .update(payloadWithoutJudging)
        .eq("id", existingRow.id));
    }
    if (updateError) {
      throw new Error(`Update failed: ${updateError.message}`);
    }
    return { id: existingRow.id, action: "updated" };
  }

  let { data: inserted, error: insertError } = await supabase
    .from("curriculum_modules")
    .insert(payload)
    .select("id")
    .single();

  if (insertError && isMissingJudgingLogicColumn(insertError.message)) {
    ({ data: inserted, error: insertError } = await supabase
      .from("curriculum_modules")
      .insert(payloadWithoutJudging)
      .select("id")
      .single());
  }

  if (insertError) {
    throw new Error(`Insert failed: ${insertError.message}`);
  }

  return { id: inserted.id, action: "inserted" };
}

async function verify(moduleId) {
  const { data, error } = await supabase
    .from("curriculum_modules")
    .select("id,title,grade,subject,published,asset_urls")
    .eq("id", moduleId)
    .single();

  if (error) {
    throw new Error(`Verify failed: ${error.message}`);
  }

  const assets = Array.isArray(data.asset_urls) ? data.asset_urls : [];
  const stlCount = assets.filter((asset) => asset?.type === "stl").length;
  const docCount = assets.filter((asset) => asset?.type === "doc").length;

  console.log(JSON.stringify({
    id: data.id,
    title: data.title,
    grade: data.grade,
    subject: data.subject,
    published: data.published,
    totalAssets: assets.length,
    stlCount,
    docCount,
  }, null, 2));
}

async function main() {
  const assets = await collectAssets();
  const result = await upsertCurriculumModule(assets);
  console.log(`${result.action} module id: ${result.id}`);
  await verify(result.id);
}

main().catch((error) => {
  console.error(error.message || String(error));
  process.exit(1);
});
