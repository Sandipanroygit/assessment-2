type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

export type SimulationAssessmentQuestion = {
  id: string;
  question: string;
  options: string[];
  answerIndex: number;
  explanation?: string;
};

export type PublicSimulationAssessmentQuestion = Omit<SimulationAssessmentQuestion, "answerIndex" | "explanation">;

type AssessmentContext = {
  simulationTitle: string;
  subject?: string | null;
  targetGrade?: string | null;
  notes?: string | null;
};

export type GeneratedAssessment = {
  questions: SimulationAssessmentQuestion[];
  source: "ai" | "fallback";
  warning: string | null;
};

const QUESTION_COUNT = 20;

const rotate = <T,>(items: T[], steps: number) => {
  if (!items.length) return items;
  const shift = ((steps % items.length) + items.length) % items.length;
  if (!shift) return [...items];
  return [...items.slice(shift), ...items.slice(0, shift)];
};

const cleanText = (value: unknown, fallback: string) => {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed || fallback;
};

const normalizeOptions = (value: unknown) => {
  if (!Array.isArray(value)) return null;
  const options = value
    .map((option) => (typeof option === "string" ? option.trim() : ""))
    .filter((option) => option.length > 0);
  if (options.length < 2) return null;
  const deduped = Array.from(new Set(options));
  while (deduped.length < 4) {
    deduped.push(`Option ${deduped.length + 1}`);
  }
  return deduped.slice(0, 4);
};

const normalizeQuestions = (raw: unknown): SimulationAssessmentQuestion[] => {
  if (!Array.isArray(raw)) return [];
  const normalized: SimulationAssessmentQuestion[] = [];
  const usedIds = new Set<string>();

  raw.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const row = item as {
      id?: unknown;
      question?: unknown;
      options?: unknown;
      answerIndex?: unknown;
      explanation?: unknown;
    };
    const question = cleanText(
      row.question,
      `Which statement best applies to the simulation step ${index + 1}?`,
    );
    const options = normalizeOptions(row.options);
    if (!options) return;
    const answerIndexRaw = typeof row.answerIndex === "number" ? Math.floor(row.answerIndex) : 0;
    const answerIndex = answerIndexRaw >= 0 && answerIndexRaw < options.length ? answerIndexRaw : 0;
    const id = cleanText(row.id, `q${index + 1}`)
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "");
    const baseId = id || `q${index + 1}`;
    let finalId = baseId;
    let suffix = 2;
    while (usedIds.has(finalId)) {
      finalId = `${baseId}_${suffix}`;
      suffix += 1;
    }
    usedIds.add(finalId);
    const explanation =
      typeof row.explanation === "string" && row.explanation.trim().length > 0
        ? row.explanation.trim()
        : undefined;

    normalized.push({
      id: finalId,
      question,
      options,
      answerIndex,
      explanation,
    });
  });

  return normalized.slice(0, QUESTION_COUNT);
};

const assessmentFallbackPool = (context: AssessmentContext) => {
  const title = cleanText(context.simulationTitle, "this simulation");
  const subject = cleanText(context.subject, "STEM");
  const grade = cleanText(context.targetGrade, "student level");
  const notes = cleanText(context.notes, "Observe cause-effect, collect evidence, and justify conclusions.");

  const concepts = [
    "main objective",
    "input variable",
    "output variable",
    "safety expectation",
    "measurement method",
    "graph trend",
    "error source",
    "result interpretation",
    "real-world application",
    "best next step",
  ];

  const templates = concepts.flatMap((concept, conceptIndex) => [
    {
      question: `In "${title}", what is the best description of the ${concept}?`,
      correct: `${concept[0].toUpperCase()}${concept.slice(1)} aligned to ${subject} learning outcomes.`,
      wrong: [
        `An unrelated fact that does not affect ${title}.`,
        "A random observation without evidence.",
        "A result that ignores the simulation setup.",
      ],
      explanation: `This assessment checks whether students identify the ${concept} correctly from the simulation.`,
      index: conceptIndex,
    },
    {
      question: `For Grade ${grade}, which action most improves accuracy while doing "${title}"?`,
      correct: "Control one variable at a time and compare evidence before concluding.",
      wrong: [
        "Change all values at once and use first output only.",
        "Skip result checks and assume expected behavior.",
        "Use guesswork without recording observations.",
      ],
      explanation: "Reliable simulation work depends on controlled changes and recorded observations.",
      index: conceptIndex + 10,
    },
  ]);

  return templates.slice(0, QUESTION_COUNT).map((entry, index) => {
    const baseOptions = [entry.correct, ...entry.wrong].slice(0, 4);
    const options = rotate(baseOptions, index % baseOptions.length);
    const answerIndex = Math.max(options.indexOf(entry.correct), 0);
    return {
      id: `q${index + 1}`,
      question: entry.question,
      options,
      answerIndex,
      explanation: `${entry.explanation} Notes focus: ${notes}`,
    } satisfies SimulationAssessmentQuestion;
  });
};

export const buildFallbackSimulationAssessment = (context: AssessmentContext) =>
  assessmentFallbackPool(context);

const pickGeminiApiKey = () => {
  const keys = [
    process.env.GOOGLE_API_KEY,
    process.env.GOOGLE_API_KEY_QUESTIONS,
    process.env.GOOGLE_API_KEY_FALLBACK,
    process.env.NEXT_PUBLIC_GOOGLE_API_KEY,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

  const isMasked = (value: string) => value.includes("*");
  const looksValid = (value: string) => /^AIza[0-9A-Za-z_-]{20,}/.test(value) && !isMasked(value);
  return keys.find((key) => looksValid(key)) ?? keys.find((key) => !isMasked(key)) ?? null;
};

const extractGeminiText = (payload: GeminiResponse | null) =>
  payload?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("")?.trim() ?? "";

const parseQuestionPayload = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const generateSimulationAssessment = async (
  context: AssessmentContext,
): Promise<GeneratedAssessment> => {
  const apiKey = pickGeminiApiKey();
  if (!apiKey) {
    return {
      questions: buildFallbackSimulationAssessment(context),
      source: "fallback",
      warning: "Gemini API key not configured; generated fallback assessment.",
    };
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const title = cleanText(context.simulationTitle, "this simulation");
  const subject = cleanText(context.subject, "STEM");
  const grade = cleanText(context.targetGrade, "student level");
  const notes = cleanText(context.notes, "No additional teacher notes.");

  const prompt = [
    "Generate exactly 20 multiple-choice questions for a school simulation assessment.",
    "Return strict JSON only with this shape:",
    '{"questions":[{"id":"q1","question":"...","options":["...","...","...","..."],"answerIndex":0,"explanation":"..."}]}',
    "Rules:",
    "- Each question must have exactly 4 options.",
    "- answerIndex must be an integer from 0 to 3.",
    "- Keep language clear for school learners.",
    "- Cover concept understanding, procedure, interpretation, and application.",
    "",
    `Simulation title: ${title}`,
    `Subject: ${subject}`,
    `Target grade: ${grade}`,
    `Teacher notes: ${notes}`,
  ].join("\n");

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.35,
            responseMimeType: "application/json",
          },
          systemInstruction: {
            parts: [
              {
                text:
                  "You create reliable academic assessments for K-12 STEM simulations. Output only valid JSON and no markdown.",
              },
            ],
          },
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        questions: buildFallbackSimulationAssessment(context),
        source: "fallback",
        warning: detail ? `Gemini generation failed: ${detail}` : "Gemini generation failed.",
      };
    }

    const payload = (await response.json().catch(() => null)) as GeminiResponse | null;
    const rawText = extractGeminiText(payload);
    const parsed = parseQuestionPayload(rawText) as { questions?: unknown } | null;
    const normalized = normalizeQuestions(parsed?.questions);

    if (normalized.length === QUESTION_COUNT) {
      return { questions: normalized, source: "ai", warning: null };
    }

    return {
      questions: buildFallbackSimulationAssessment(context),
      source: "fallback",
      warning: "AI generated invalid assessment format; fallback questions were used.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown AI generation error.";
    return {
      questions: buildFallbackSimulationAssessment(context),
      source: "fallback",
      warning: `AI generation error: ${message}`,
    };
  }
};

export const normalizeStoredSimulationAssessment = (raw: unknown): SimulationAssessmentQuestion[] =>
  normalizeQuestions(raw);

export const toPublicSimulationAssessment = (
  questions: SimulationAssessmentQuestion[],
): PublicSimulationAssessmentQuestion[] =>
  questions.map((question) => ({
    id: question.id,
    question: question.question,
    options: question.options,
  }));

export const scoreSimulationAssessment = (
  questions: SimulationAssessmentQuestion[],
  rawAnswers: unknown,
) => {
  const answersRecord =
    rawAnswers && typeof rawAnswers === "object"
      ? (rawAnswers as Record<string, unknown>)
      : {};

  const normalizedAnswers: Record<string, number> = {};
  let score = 0;

  questions.forEach((question, index) => {
    const key = question.id;
    const fallbackKey = `q${index + 1}`;
    const rawAnswer =
      answersRecord[key] ??
      answersRecord[fallbackKey] ??
      answersRecord[String(index)] ??
      null;
    const selected =
      typeof rawAnswer === "number" && Number.isFinite(rawAnswer)
        ? Math.floor(rawAnswer)
        : typeof rawAnswer === "string" && rawAnswer.trim().length > 0
          ? Number(rawAnswer)
          : -1;
    const answerIndex = selected >= 0 && selected < question.options.length ? selected : -1;
    normalizedAnswers[key] = answerIndex;
    if (answerIndex === question.answerIndex) {
      score += 1;
    }
  });

  return {
    score,
    total: questions.length,
    normalizedAnswers,
  };
};
