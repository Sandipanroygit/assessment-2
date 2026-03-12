import { NextResponse } from "next/server";
import { GoogleGenerativeAI, Part } from "@google/generative-ai";

type SocraticRequest = {
  question: string;
  context?: string; // Correct answer or logic breakdown
  canvasImage?: string; // base64 data URL
};

const SYSTEM_PROMPT = `
You are the "Socratic AI Logic Coach" for a high-stakes STEM platform (JEE/NEET preparation).
Your goal is to be a supportive, "over-the-shoulder" mentor that guides students through "Productive Struggle."

CRITICAL RULES:
1. NEVER GIVE THE FINAL ANSWER. Even if the student asks for it.
2. CONTINUOUS MONITORING: You are analyzing periodic snapshots of the student's handwritten work (Smart Canvas).
3. BAN GENERIC PRAISE: Do not start with "Excellent start", "Great job", or "I see you're working hard." If the work is correct, simply state exactly what was identified and then nudge for the NEXT step.
4. STEP-BY-STEP TRACKING: Use the provided LOGIC CONTEXT to identify exactly which step (1, 2, or 3) the student is currently on. 
   - Identify the LAST successful logical step they completed on the canvas.
   - Then, ask a question or provide a hint that points towards the START of the very next step in the LOGIC CONTEXT.
5. SOCRATIC NUDGING (FOR ERRORS):
   - If you detect a mistake (wrong sign, incorrect formula, calculation error), do not point it out directly. 
   - Ask a question that helps them spot it. 
   - Example: "If the object is moving at a constant speed, what does that tell you about the net force according to Newton's First Law?"
6. BE HYPER-SPECIFIC: Mention specific variables (v, R, acceleration, etc.) and diagrams seen in the handwriting.
7. BE CONCISE: Keep feedback to 2 short sentences.

You are patient, high-energy, and expert-level in Physics, Chemistry, Math, and Biology.
`;

export async function POST(req: Request) {
  const apiKey = [
    process.env.GOOGLE_API_KEY,
    process.env.GOOGLE_API_KEY_QUESTIONS,
    process.env.GOOGLE_API_KEY_FALLBACK,
  ].find(k => k && k.trim().length > 0 && k.startsWith("AIza"));
  
  if (!apiKey) {
    return NextResponse.json({ error: "Socratic AI requires a valid Google API Key." }, { status: 500 });
  }

  let body: SocraticRequest;
  try {
    body = (await req.json()) as SocraticRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { question, context, canvasImage } = body;
  
  const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash"; // Use the latest flash model
  
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: "v1" });

    const userParts: Part[] = [
      { text: `
QUESTION: ${question}
STEP-BY-STEP LOGIC CONTEXT: ${context || "None provided"}

${SYSTEM_PROMPT}

ANALYSIS INSTRUCTION:
1. Look at the student's handwriting.
2. Identify the highest step number (from the LOGIC CONTEXT) they have correctly reached.
3. If they are midway through a step or have made an error, nudge them.
4. If they have completed a step, tell them what the NEXT thing to think about is (without giving the answer).
5. Be sharp, technical, and Socratic. No filler.
` }
    ];

    if (canvasImage && canvasImage.includes("base64,")) {
      const base64Data = canvasImage.split("base64,")[1];
      const mimeType = canvasImage.split(";")[0].split(":")[1];
      userParts.push({
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      });
    }

    console.log("Socratic AI: Monitoring logic using Gemini SDK...");
    const result = await model.generateContent({
      contents: [{ role: "user", parts: userParts }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 300 },
    });

    const hint = result.response.text() || "I'm watching your logic. Keep going!";
    return NextResponse.json({ hint });

  } catch (err) {
    const error = err as Error;
    console.error("Socratic AI Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
