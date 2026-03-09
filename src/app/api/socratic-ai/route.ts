import { NextResponse } from "next/server";

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
2. CONTINUOUS MONITORING: You are analyzing periodic snapshots of the student's handwritten work (Smart Canvas) along with the question.
3. MORALE BOOSTING (IMPORTANT): 
   - If the student is moving in the correct direction, APPRECIATE them immediately. 
   - Examples: "Excellent first step! Your free-body diagram is perfectly balanced.", "Great job identifying the core formula here. Keep deriving!", "I love how you've broken down this complex problem—continue with this logic!"
4. SOCRATIC NUDGING (FOR ERRORS):
   - If you detect a mistake (wrong sign, incorrect formula, calculation error), do not point it out directly. 
   - Ask a question that helps them spot it. 
   - Examples: "Take a closer look at the direction of your friction force. Is it opposing the motion correctly?", "I notice you used the constant acceleration formula—does that apply throughout this entire duration?"
5. MESSY HANDWRITING: If you genuinely cannot read a specific step, ask a Socratic question about the *intent* of that step instead of giving a technical error. (e.g., "I'm following your logic, but could you clarify the variable you just derived?")
6. BE CONCISE: Keep feedback to 2-3 sentences. Stay in the flow of their "Mock Test" mindset.

You are patient, high-energy, and expert-level in Physics, Chemistry, Math, and Biology.
`;

export async function POST(req: Request) {
  // Use the same robust key resolution as assessment generation
  const apiKey = [
    process.env.GOOGLE_API_KEY,
    process.env.GOOGLE_API_KEY_QUESTIONS,
    process.env.GOOGLE_API_KEY_FALLBACK,
    process.env.OPENAI_API_KEY, // project-specific: some google keys are stored here
    process.env.NEXT_PUBLIC_GOOGLE_API_KEY,
  ].find(k => k && k.trim().length > 0 && k.startsWith("AIza")); // Google keys start with AIza
  
  if (!apiKey) {
    return NextResponse.json({ error: "Socratic AI requires a valid Google API Key. Please configure GOOGLE_API_KEY in your dashboard." }, { status: 500 });
  }

  let body: SocraticRequest;
  try {
    body = (await req.json()) as SocraticRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { question, context, canvasImage } = body;
  
  // Prepare Gemini payload
  const model = "gemini-1.5-flash"; 
  
  const userParts: any[] = [
    { text: `Question: ${question}\n\nLogic Context: ${context || "None provided"}\n\nPlease analyze my current work and provide a Socratic hint.` }
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

  const payload = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [
      {
        role: "user",
        parts: userParts,
      },
    ],
    generationConfig: { temperature: 0.4, maxOutputTokens: 300 },
  };

  try {
    console.log("Socratic AI: Monitoring logic using Gemini Flash...");
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    const data = await geminiRes.json().catch(() => null);

    if (!geminiRes.ok) {
      console.error("Gemini Error Payload:", JSON.stringify(data, null, 2));
      const detail = data?.error?.message || "Failed to contact AI engine";
      return NextResponse.json({ error: `AI Logic Coach: ${detail}` }, { status: geminiRes.status });
    }

    const hint =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: any) => p.text ?? "")
        .join("") ?? "I'm watching your logic. Keep going!";

    return NextResponse.json({ hint });
  } catch (err) {
    console.error("Socratic AI: Internal Fetch Error:", err);
    return NextResponse.json({ error: "Internal Server Error during logic analysis" }, { status: 500 });
  }
}
