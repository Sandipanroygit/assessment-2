"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";

// --- Types ---

type ExamType = "JEE Mains" | "JEE Advanced" | "NEET";
type Subject = "Physics" | "Chemistry" | "Mathematics" | "Biology";

type Question = {
  id: string;
  exam: ExamType;
  subject: Subject;
  year: number;
  text: string;
  imageUrl?: string;
  options: { label: string; text: string }[];
  correctAnswer: string;
  logicContext: string; // The step-by-step logic the AI should check for
};

// --- Real Sample Data (Past Paper Inspiration) ---

const SAMPLE_QUESTIONS: Question[] = [
  {
    id: "jee-p-2024-1",
    exam: "JEE Mains",
    subject: "Physics",
    year: 2024,
    text: "A particle of mass m is moving in a circle of radius r with a constant speed v. If the radius is doubled while keeping the centripetal force constant, what happens to the speed?",
    options: [
      { label: "A", text: "v becomes v√2" },
      { label: "B", text: "v becomes v/2" },
      { label: "C", text: "v becomes 2v" },
      { label: "D", text: "v remains constant" }
    ],
    correctAnswer: "A",
    logicContext: "Centripetal force F = mv²/r. If F is constant, v² ∝ r. Doubling r means v² doubles, so v becomes v√2."
  },
  {
    id: "neet-b-2023-1",
    exam: "NEET",
    subject: "Biology",
    year: 2023,
    text: "Identify the correct sequence of events during Prophase I of Meiosis:",
    options: [
      { label: "A", text: "Leptotene → Zygotene → Pachytene → Diplotene → Diakinesis" },
      { label: "B", text: "Zygotene → Leptotene → Pachytene → Diplotene → Diakinesis" },
      { label: "C", text: "Leptotene → Pachytene → Zygotene → Diplotene → Diakinesis" },
      { label: "D", text: "Leptotene → Zygotene → Diplotene → Pachytene → Diakinesis" }
    ],
    correctAnswer: "A",
    logicContext: "Prophase I stages: Leptotene (chromosomes visible), Zygotene (pairing), Pachytene (crossing over), Diplotene (chiasmata visible), Diakinesis (terminalization)."
  }
];

// --- Components ---

function SmartCanvas({ onSnapshot, isAnalyzing }: { onSnapshot: (dataUrl: string) => void, isAnalyzing: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      
      // Initialize with white background for AI visibility
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, rect.width, rect.height);
      
      ctx.lineCap = "round";
      ctx.lineWidth = 5; // Bold ink for better AI recognition
      ctx.strokeStyle = "#0f172a"; 
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const triggerSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Create a temporary canvas to ensure solid white background
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;
    
    tempCtx.fillStyle = "#ffffff";
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.drawImage(canvas, 0, 0);
    
    onSnapshot(tempCanvas.toDataURL("image/png"));
  }, [onSnapshot]);

  const startDrawing = (e: React.PointerEvent) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    // Auto-analyze after 3 seconds of inactivity
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      triggerSnapshot();
    }, 3000);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  };

  return (
    <div className="relative w-full h-full bg-white/80 rounded-3xl border border-slate-200 overflow-hidden cursor-crosshair group shadow-xl backdrop-blur-md">
      <div className="absolute inset-0 pointer-events-none opacity-5 bg-[radial-gradient(#000000_1px,transparent_1px)] [background-size:24px_24px]" />
      <canvas
        ref={canvasRef}
        className="w-full h-full touch-none"
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerCancel={stopDrawing}
      />
      
      <div className="absolute bottom-6 right-6 flex items-center gap-3">
        <button
          onClick={clear}
          className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-xs font-bold text-slate-500 hover:text-rose-600 transition-all border border-slate-200 shadow-sm"
        >
          Clear Board
        </button>
        <div
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl border transition-all ${
            isAnalyzing ? "bg-amber-100 border-amber-200 text-amber-700" : "bg-white border-slate-200 text-slate-400"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${isAnalyzing ? "bg-amber-500 animate-ping" : "bg-slate-300"}`} />
          <span className="text-xs font-black uppercase tracking-widest">
            {isAnalyzing ? "AI Analyzing Logic..." : "AI Monitoring"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function SocraticAIPage() {
  const router = useRouter();
  const [step, setStep] = useState<"select-exam" | "select-details" | "workspace">("select-exam");
  const [exam, setExam] = useState<ExamType | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [year, setYear] = useState<number>(2024);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [aiHint, setAiHint] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  useEffect(() => {
    if (step === "workspace" && exam && subject) {
      const filtered = SAMPLE_QUESTIONS.filter(q => q.exam === exam && q.subject === subject);
      setQuestions(filtered.length > 0 ? filtered : SAMPLE_QUESTIONS);
      setCurrentQuestionIndex(0);
      setAiHint(null);
      setSelectedOption(null);
    }
  }, [step, exam, subject]);

  const activeQuestion = questions[currentQuestionIndex];

  const handleAiAnalysis = async (dataUrl: string) => {
    if (!activeQuestion) return;
    setIsAnalyzing(true);
    setAiHint(null);

    try {
      const res = await fetch("/api/socratic-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: activeQuestion.text,
          context: activeQuestion.logicContext,
          canvasImage: dataUrl
        })
      });
      const data = await res.json();
      if (res.ok) {
        setAiHint(data.hint);
      } else {
        // Show actual error from API
        const errorMsg = data.error || "I'm having trouble seeing your work clearly.";
        setAiHint(`${errorMsg} Let's try continuing with the next logical step.`);
      }
    } catch (err) {
      setAiHint("Connection lost. Keep struggling through the logic, I'll be back shortly!");
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (step === "select-exam") {
    return (
      <main className="section-padding min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#2563eb_0%,transparent_50%)]" />
        </div>

        <div className="w-full max-w-5xl space-y-12 text-center relative z-10">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-[0.3em] mb-4 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              Socratic Engine Active
            </div>
            <h1 className="text-6xl font-black text-emerald-800 tracking-tight">Productive Struggle</h1>
            <p className="text-emerald-700 text-lg max-w-2xl mx-auto font-bold leading-relaxed">
              Our AI monitors your handwriting to identify exactly where your reasoning fails.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { type: "JEE Mains", desc: "Foundation & Speed" },
              { type: "JEE Advanced", desc: "Rigorous Depth" },
              { type: "NEET", desc: "Biological Precision" }
            ].map((item) => (
              <button
                key={item.type}
                onClick={() => {
                  setExam(item.type as ExamType);
                  setStep("select-details");
                }}
                className="group relative p-10 rounded-[2.5rem] bg-white border border-slate-200 hover:border-accent hover:shadow-[0_20px_50px_rgba(37,99,235,0.1)] transition-all duration-500 hover:-translate-y-3 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="h-20 w-20 rounded-3xl bg-accent/10 flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-transform duration-500">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-10 w-10 text-accent">
                    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
                    <path d="M12 6v4l3 2" />
                  </svg>
                </div>
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-wider">{item.type}</h3>
                <p className="mt-2 text-sm text-slate-400 font-bold tracking-wide uppercase">{item.desc}</p>
              </button>
            ))}
          </div>
          
          <Link href="/customer" className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-accent transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-4 w-4">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Return to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  if (step === "select-details") {
    return (
      <main className="section-padding min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-[3rem] p-12 space-y-10 shadow-[0_40px_80px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-accent uppercase tracking-[0.3em] mb-1">{exam} Configuration</p>
              <h2 className="text-3xl font-black text-slate-900">Target Your Session</h2>
            </div>
            <button onClick={() => setStep("select-exam")} className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-200 transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-5 w-5">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-8">
            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Academic Subject</span>
              <div className="grid grid-cols-2 gap-3">
                {(exam === "NEET" ? ["Physics", "Chemistry", "Biology"] : ["Physics", "Chemistry", "Mathematics"]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSubject(s as Subject)}
                    className={`py-4 rounded-2xl border-2 transition-all font-bold tracking-wide ${
                      subject === s 
                        ? "bg-accent border-accent text-true-white shadow-glow" 
                        : "bg-slate-50 border-slate-100 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <label className="block space-y-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Historical Paper Year</span>
              <div className="relative">
                <select 
                  className="w-full rounded-2xl bg-slate-50 border-2 border-slate-100 px-6 py-5 text-slate-900 font-bold outline-none focus:border-accent transition-all appearance-none cursor-pointer"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                >
                  {Array.from({ length: 20 }, (_, i) => 2024 - i).map(y => (
                    <option key={y} value={y}>{y} Previous Paper</option>
                  ))}
                </select>
                <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-5 w-5">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </div>
              </div>
            </label>

            <button
              disabled={!subject}
              onClick={() => setStep("workspace")}
              className="group w-full py-6 rounded-3xl bg-accent text-true-white font-black uppercase tracking-[0.2em] shadow-[0_20px_40px_rgba(37,99,235,0.25)] hover:bg-accent-strong hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
            >
              Initialize Logic Board
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-5 w-5 group-hover:translate-x-1 transition-transform">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="fixed inset-0 z-[100] bg-[#f8fafc] overflow-hidden flex flex-col font-sans select-none">
      <div className="absolute inset-0 opacity-40 pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-100 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-100 rounded-full blur-[120px]" />
      </div>

      <header className="flex-none px-10 py-5 border-b border-slate-200 bg-white/70 backdrop-blur-2xl flex items-center justify-between z-20 shadow-sm">
        <div className="flex items-center gap-8">
          <button 
            onClick={() => setStep("select-details")} 
            className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-all shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-5 w-5">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-accent text-true-white text-[9px] font-black uppercase tracking-wider">{exam}</span>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{year} Series</span>
            </div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight uppercase">{subject} Logical Mastery</h2>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 px-5 py-2 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <span className={`h-2.5 w-2.5 rounded-full ${isAnalyzing ? "bg-amber-400 animate-ping" : "bg-emerald-500"}`} />
            <span className="text-[11px] font-black text-slate-600 uppercase tracking-[0.15em]">
              {isAnalyzing ? "Analyzing Handwriting..." : "Socratic AI Active"}
            </span>
          </div>
          <button 
            onClick={() => router.push("/customer")} 
            className="px-6 py-2 rounded-xl bg-white border border-slate-200 text-slate-500 text-xs font-black uppercase tracking-widest hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm"
          >
            Exit Roster
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0 relative z-10">
        <section className="w-[500px] flex-none border-r border-slate-200 p-10 overflow-y-auto custom-scrollbar flex flex-col space-y-10 bg-white/40 backdrop-blur-md">
          {!activeQuestion ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 font-bold italic">
              Loading logic sequences...
            </div>
          ) : (
            <>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="px-4 py-1.5 rounded-full bg-accent/10 text-accent-strong text-[10px] font-black uppercase tracking-[0.2em] border border-accent/20">Active Question</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Question {currentQuestionIndex + 1} / {questions.length}</span>
                </div>
                <div className="space-y-4">
                  <p className="text-2xl font-bold text-slate-900 leading-snug tracking-tight">
                    {activeQuestion.text}
                  </p>
                  {activeQuestion.imageUrl && (
                    <div className="relative aspect-video rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">
                      <Image src={activeQuestion.imageUrl} alt="Question Diagram" fill className="object-contain p-4" />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-4">
                {activeQuestion.options.map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => setSelectedOption(opt.label)}
                    className={`w-full text-left p-5 rounded-2xl border-2 transition-all duration-300 flex items-center gap-5 group shadow-sm ${
                      selectedOption === opt.label 
                        ? "bg-accent border-accent shadow-md" 
                        : "bg-white border-slate-100 hover:border-slate-300 hover:shadow-md"
                    }`}
                  >
                    <span className={`flex-none h-10 w-10 rounded-xl border-2 flex items-center justify-center text-sm font-black transition-colors ${
                      selectedOption === opt.label 
                        ? "bg-white border-white/20 text-accent" 
                        : "border-slate-100 bg-slate-50 text-slate-400 group-hover:border-slate-300"
                    }`}>
                      {opt.label}
                    </span>
                    <span className={`text-base font-bold transition-colors ${
                      selectedOption === opt.label ? "text-true-white" : "text-slate-600 group-hover:text-slate-900"
                    }`}>
                      {opt.text}
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-auto pt-10 border-t border-slate-200 space-y-4">
                {aiHint && (
                  <div className="p-6 rounded-[2rem] bg-emerald-50 border-2 border-emerald-100 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-true-white">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-4 w-4">
                          <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
                          <path d="M12 16v-4M12 8h.01" />
                        </svg>
                      </span>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">AI Logic Nudge</p>
                    </div>
                    <p className="text-sm font-bold text-slate-700 leading-relaxed italic">
                      &ldquo;{aiHint}&rdquo;
                    </p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-3">
                   <button
                    disabled={currentQuestionIndex === 0}
                    onClick={() => {
                      setCurrentQuestionIndex(prev => prev - 1);
                      setAiHint(null);
                      setSelectedOption(null);
                    }}
                    className="py-4 rounded-2xl bg-white border border-slate-200 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 hover:text-slate-900 disabled:opacity-30 transition-all shadow-sm"
                  >
                    Previous Sequence
                  </button>
                  <button
                    disabled={currentQuestionIndex === questions.length - 1}
                    onClick={() => {
                      setCurrentQuestionIndex(prev => prev + 1);
                      setAiHint(null);
                      setSelectedOption(null);
                    }}
                    className="py-4 rounded-2xl bg-white border border-slate-200 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 hover:text-slate-900 disabled:opacity-30 transition-all shadow-sm"
                  >
                    Next Logic
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        <section className="flex-1 p-10 bg-slate-50/50 flex flex-col space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.3em]">Smart Logic Canvas</h3>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">Scribble your derivation steps and free-body diagrams here.</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 shadow-sm">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Tool</span>
                <span className="h-2 w-2 rounded-full bg-slate-900 animate-pulse" />
                <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Ink / Stylus</span>
              </div>
            </div>
          </div>
          <div className="flex-1 relative">
            <SmartCanvas onSnapshot={handleAiAnalysis} isAnalyzing={isAnalyzing} />
          </div>
        </section>
      </div>
    </main>
  );
}
