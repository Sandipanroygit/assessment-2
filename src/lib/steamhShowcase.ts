import type { SteamhProject } from "@/types";

const GUIDE_SECTION_BREAK = /\n{1,2}(?:Materials|Build Steps|Learning Focus|Original Activity):/i;
const META_TRAIL_BREAK = /\s-\s(?:What|Where|Why|When|Concepts?|Time|Cost|Materials|Tools)\s*:/i;
const TEMPLATE_CHALLENGE = /^build and demonstrate/i;
const TEMPLATE_SOLUTION = /(guided activity flow|prototype quickly|iterate until|build works reliably)/i;

const GENERIC_TAGS = new Set([
  "instructables",
  "steam",
  "stem",
  "classroom",
  "education",
  "diy",
  "activity",
  "project",
  "student",
  "students",
]);

const INSTRUCTABLES_SAMPLE_PREFIX = "sample-instructables-";
const INSTRUCTABLES_SAMPLE_STUDENT = "the oakland toy lab";
const INSTRUCTABLES_SAMPLE_SCHOOL = "instructables educator collection";
const INSTRUCTABLES_SAMPLE_PUBLISHED_AT = "2026-01-01T09:00:00.0000000Z";

const INSTRUCTABLES_SAMPLE_STUDENT_NAMES = [
  "Aarav Mehta",
  "Ananya Rao",
  "Dev Patel",
  "Ishita Sharma",
  "Kabir Singh",
  "Kiara Nair",
  "Rohan Gupta",
  "Saanvi Iyer",
  "Arjun Verma",
  "Mira Joshi",
  "Vivaan Kapoor",
  "Diya Banerjee",
];

const INSTRUCTABLES_SAMPLE_GRADE_POOL = ["9", "10", "11", "12"];

const normalizeWhitespace = (value: string) =>
  value
    .replace(/\u00e2\u20ac\u00a6/g, "...")
    .replace(/\uFFFD/g, "")
    .replace(/\s+/g, " ")
    .trim();

const toFirstPersonShowcaseText = (value: string) => {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return "";

  return normalized
    .replace(/^The student identified\s+/i, "I identified ")
    .replace(/^The student needed to\s+/i, "I needed to ")
    .replace(/^The project presents\s+/i, "I created ")
    .replace(/\bthe student\b/gi, "I")
    .replace(/\bthe project\b/gi, "my project")
    .replace(/\bhe or she\b/gi, "I")
    .replace(/\bhis or her\b/gi, "my")
    .replace(/\bhis\/her\b/gi, "my");
};

const isInstructablesSampleProject = (project: SteamhProject) => {
  const studentName = project.studentName.trim().toLowerCase();
  const schoolName = project.schoolName.trim().toLowerCase();
  return (
    project.id.startsWith(INSTRUCTABLES_SAMPLE_PREFIX) ||
    (project.studentId === null &&
      studentName === INSTRUCTABLES_SAMPLE_STUDENT &&
      schoolName === INSTRUCTABLES_SAMPLE_SCHOOL)
  );
};

export const stripGuideSections = (raw: string) => {
  const normalized = raw.replace(/\r\n/g, "\n").trim();
  if (!normalized) return "";
  const [head] = normalized.split(GUIDE_SECTION_BREAK);
  return head?.trim() ?? "";
};

export const truncateText = (value: string, maxLength = 160) => {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};

export const toStudentInitials = (name: string) => {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "SP";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const hashString = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const resolveInstructablesSampleIdentity = (project: SteamhProject) => {
  const seedSource = project.id || project.title || "sample-project";
  const seed = hashString(seedSource);
  const studentName = INSTRUCTABLES_SAMPLE_STUDENT_NAMES[seed % INSTRUCTABLES_SAMPLE_STUDENT_NAMES.length];
  const grade = INSTRUCTABLES_SAMPLE_GRADE_POOL[Math.floor(seed / 7) % INSTRUCTABLES_SAMPLE_GRADE_POOL.length];

  return {
    studentName,
    grade,
    initials: toStudentInitials(studentName),
  };
};

export const resolveShowcaseProjectMeta = (project: SteamhProject) => {
  if (isInstructablesSampleProject(project)) {
    const sampleIdentity = resolveInstructablesSampleIdentity(project);
    return {
      initials: sampleIdentity.initials,
      studentName: sampleIdentity.studentName,
      schoolName: "Instructables Educator Collection",
      grade: sampleIdentity.grade,
      publishedAt: INSTRUCTABLES_SAMPLE_PUBLISHED_AT,
    };
  }

  const studentName = project.studentName.trim() || "Student";
  return {
    initials: toStudentInitials(studentName),
    studentName,
    schoolName: project.schoolName.trim() || "Open public showcase",
    grade: project.grade.trim(),
    publishedAt: project.createdAt,
  };
};

export const toGradeSortValue = (grade: string) => {
  const match = grade.match(/\d+/);
  return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
};

export const toFocusTerms = (project: SteamhProject, maxItems = 6) => {
  const terms: string[] = [];
  const seen = new Set<string>();

  for (const tag of project.tags) {
    const normalized = tag.trim().toLowerCase();
    if (!normalized || GENERIC_TAGS.has(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    terms.push(tag.trim());
    if (terms.length >= maxItems) return terms;
  }

  for (const subjectPart of project.subject.split(/[,&/]/)) {
    const normalized = subjectPart.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    terms.push(subjectPart.trim());
    if (terms.length >= maxItems) return terms;
  }

  return terms;
};

export const toShowcaseDetails = (description: string, summary: string) => {
  const stripped = stripGuideSections(description);
  const withoutOverview = stripped.replace(/^overview:\s*/i, "");
  const [withoutMetaTrail] = withoutOverview.split(META_TRAIL_BREAK);
  const normalizedDetails = normalizeWhitespace(withoutMetaTrail ?? "");
  const normalizedSummary = normalizeWhitespace(summary);

  if (normalizedDetails.length >= 80) return toFirstPersonShowcaseText(normalizedDetails);
  if (normalizedDetails) return toFirstPersonShowcaseText(normalizedDetails);
  return toFirstPersonShowcaseText(normalizedSummary);
};

export const toShowcaseChallenge = (project: SteamhProject) => {
  const normalizedChallenge = normalizeWhitespace(project.challenge);

  if (!normalizedChallenge || TEMPLATE_CHALLENGE.test(normalizedChallenge)) {
    const focusTerms = toFocusTerms(project, 3);
    const focusText = focusTerms.length > 0 ? focusTerms.join(", ") : project.subject.trim() || "the core concept";
    return `I noticed a practical gap and built this project to make ${focusText} easier to understand in a live showcase setting.`;
  }

  const keyIdeasMatch = normalizedChallenge.match(/key ideas behind (.+)$/i);
  if (keyIdeasMatch?.[1]) {
    return `I wanted to explain ${keyIdeasMatch[1].replace(/[.]+$/, "")} clearly so other students could understand the concept quickly.`;
  }

  return toFirstPersonShowcaseText(normalizedChallenge);
};

export const toShowcaseSolution = (project: SteamhProject) => {
  const normalizedSolution = normalizeWhitespace(project.solution);

  if (!normalizedSolution || TEMPLATE_SOLUTION.test(normalizedSolution)) {
    const focusTerms = toFocusTerms(project, 3);
    const focusText = focusTerms.length > 0 ? focusTerms.join(", ") : project.subject.trim() || "the concept";
    return `I turned ${focusText} into an exhibit-style demonstration so viewers could observe it, discuss it, and understand it quickly.`;
  }

  return toFirstPersonShowcaseText(normalizedSolution);
};

export const toNarrativeParagraphs = (text: string, maxParagraphs = 3) => {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const blocks = normalized
    .split(/\n{2,}/)
    .map((block) => normalizeWhitespace(block))
    .filter(Boolean);

  if (blocks.length > 1) {
    return blocks.slice(0, maxParagraphs);
  }

  const sentences =
    normalized
      .match(/[^.!?]+[.!?]?/g)
      ?.map((sentence) => normalizeWhitespace(sentence))
      .filter(Boolean) ?? [];

  if (sentences.length <= 2) {
    return [normalizeWhitespace(normalized)];
  }

  const chunkSize = Math.max(1, Math.ceil(sentences.length / maxParagraphs));
  const paragraphs: string[] = [];
  for (let index = 0; index < sentences.length; index += chunkSize) {
    paragraphs.push(sentences.slice(index, index + chunkSize).join(" "));
    if (paragraphs.length >= maxParagraphs) break;
  }
  return paragraphs;
};
