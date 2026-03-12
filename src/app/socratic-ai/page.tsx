"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import { logActivity } from "@/lib/activityLogger";

import { SOCRATIC_QUESTION_BANK } from "@/data/socraticQuestions";

// --- Types ---

export type ExamType = "JEE Mains" | "JEE Advanced" | "NEET";
export type Subject = "Physics" | "Chemistry" | "Mathematics" | "Biology";

export type Question = {
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

export type AiHint = {
  id: string;
  text: string;
  imageUrl: string;
  timestamp: number;
};

// --- Components ---

function SmartCanvas({ onSnapshot, isAnalyzing, viewingSnapshot }: { onSnapshot: (dataUrl: string) => void, isAnalyzing: boolean, viewingSnapshot?: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<"pencil" | "eraser">("pencil");
  const [color, setColor] = useState("#0f172a");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const saveToHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL();
    
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(dataUrl);
      if (newHistory.length > 20) {
        newHistory.shift();
        setHistoryIndex(19);
        return newHistory;
      }
      setHistoryIndex(newHistory.length - 1);
      return newHistory;
    });
  }, [historyIndex]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      const tempImage = canvas.toDataURL();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, rect.width, rect.height);
      const img = new Image();
      img.src = tempImage;
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    };

    resize();
    window.addEventListener("resize", resize);
    const dataUrl = canvas.toDataURL();
    setHistory([dataUrl]);
    setHistoryIndex(0);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const triggerSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
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
    ctx.lineWidth = tool === "eraser" ? 20 : 5;
    ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
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
    if (!isDrawing) return;
    setIsDrawing(false);
    saveToHistory();
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      triggerSnapshot();
    }, 3000);
  };

  const undo = () => {
    if (historyIndex <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const prevIndex = historyIndex - 1;
    const img = new (window as any).Image();
    img.src = history[prevIndex];
    img.onload = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.drawImage(img, 0, 0, rect.width, rect.height);
      setHistoryIndex(prevIndex);
    };
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const nextIndex = historyIndex + 1;
    const img = new (window as any).Image();
    img.src = history[nextIndex];
    img.onload = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.drawImage(img, 0, 0, rect.width, rect.height);
      setHistoryIndex(nextIndex);
    };
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    saveToHistory();
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  };

  const cursorStyle = useMemo(() => {
    if (tool === 'eraser') return { cursor: 'cell' };
    
    // Custom Pen SVG with dynamic color tip
    // Hotspot is at 2, 22 (the tip of the pen icon)
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" fill="white"/>
        <path d="m15 5 4 4"/>
        <path d="M2 22l3-1-2-2-1 3z" fill="${color.replace('#', '%23')}" stroke="none"/>
      </svg>
    `.trim();
    
    return {
      cursor: `url("data:image/svg+xml;utf8,${svg.replace(/</g, '%3C').replace(/>/g, '%3E')}") 2 22, crosshair`
    };
  }, [tool, color]);

  return (
    <div 
      className="relative w-full h-full bg-white/80 rounded-3xl border border-slate-200 overflow-hidden group shadow-xl backdrop-blur-md"
      style={cursorStyle}
    >
      <div className="absolute inset-0 pointer-events-none opacity-5 bg-[radial-gradient(#000000_1px,transparent_1px)] [background-size:24px_24px]" />
      
      <canvas 
        ref={canvasRef} 
        className={`w-full h-full touch-none block ${viewingSnapshot ? 'opacity-10 pointer-events-none' : 'opacity-100'} transition-opacity duration-300`} 
        onPointerDown={startDrawing} 
        onPointerMove={draw} 
        onPointerUp={stopDrawing} 
        onPointerCancel={stopDrawing} 
      />

      {viewingSnapshot && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10 p-2">
          <div className="relative w-full h-full rounded-2xl overflow-hidden border-[3px] border-amber-400 shadow-2xl bg-white/95 animate-in fade-in zoom-in-95 duration-300">
            <img src={viewingSnapshot} alt="Snapshot" className="w-full h-full object-contain" />
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-500 text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-md flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              AI Reviewed Scribble
            </div>
          </div>
        </div>
      )}

      {/* Floating Vertical Toolbar - Higher Z-Index and Last in DOM for safety */}
      <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-30 bg-white/90 backdrop-blur-md p-3 rounded-2xl border border-slate-200 shadow-xl">
        <div className="flex flex-col gap-2 pb-4 border-b border-slate-100">
          <button onClick={() => setTool("pencil")} className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all ${tool === "pencil" ? "bg-accent text-true-white shadow-glow" : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"}`} title="Pencil">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
          </button>
          <button onClick={() => setTool("eraser")} className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all ${tool === "eraser" ? "bg-slate-900 text-true-white shadow-lg" : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"}`} title="Eraser">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" /><path d="M22 21H7" /><path d="m5 11 9 9" /></svg>
          </button>
        </div>
        <div className="flex flex-col gap-3 pb-4 border-b border-slate-100 items-center">
          {[{ hex: "#0f172a", label: "Dark" }, { hex: "#2563eb", label: "Blue" }, { hex: "#dc2626", label: "Red" }, { hex: "#16a34a", label: "Green" }].map((c) => (
            <button key={c.hex} onClick={() => { setColor(c.hex); setTool("pencil"); }} className={`h-6 w-6 rounded-full border-2 transition-all ${color === c.hex && tool === "pencil" ? "border-slate-400 scale-125 shadow-sm" : "border-transparent hover:scale-110"}`} style={{ backgroundColor: c.hex }} title={c.label} />
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <button onClick={undo} disabled={historyIndex <= 0} className="h-10 w-10 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-600 disabled:opacity-20 transition-all" title="Undo">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5"><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" /></svg>
          </button>
          <button onClick={redo} disabled={historyIndex >= history.length - 1} className="h-10 w-10 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-600 disabled:opacity-20 transition-all" title="Redo">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5"><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13" /></svg>
          </button>
        </div>
      </div>

      <div className="absolute bottom-6 right-6 flex items-center gap-3 z-30">
        <button onClick={clear} className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-xs font-bold text-slate-500 hover:text-rose-600 transition-all border border-slate-200 shadow-sm flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
          Clear
        </button>
        <button onClick={triggerSnapshot} disabled={isAnalyzing} className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white transition-all shadow-md flex items-center gap-2 disabled:opacity-50">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></svg>
          Analyze Now
        </button>
        <div className={`flex items-center gap-2 px-6 py-2.5 rounded-xl border transition-all ${isAnalyzing ? "bg-amber-100 border-amber-200 text-amber-700" : "bg-white border-slate-200 text-slate-400"}`}>
          <span className={`h-2 w-2 rounded-full ${isAnalyzing ? "bg-amber-500 animate-ping" : "bg-slate-300"}`} />
          <span className="text-xs font-black uppercase tracking-widest">{isAnalyzing ? "AI Analyzing..." : "Monitoring"}</span>
        </div>
      </div>
    </div>
  );
}

export default function SocraticAIPage() {
  const router = useRouter();
  const [step, setStep] = useState<"select-exam" | "select-iitjee-part" | "select-details" | "workspace">("select-exam");
  const [exam, setExam] = useState<ExamType | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [year, setYear] = useState<number>(2024);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [aiHints, setAiHints] = useState<AiHint[]>([]);
  const [activeHintId, setActiveHintId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  useEffect(() => {
    if (step === "workspace" && exam && subject) {
      const filtered = SOCRATIC_QUESTION_BANK.filter(q => q.exam === exam && q.subject === subject && q.year === year);
      setQuestions(filtered);
      setCurrentQuestionIndex(0);
      resetQuestionState();
    }
  }, [step, exam, subject, year]);

  const activeQuestion = questions[currentQuestionIndex];

  useEffect(() => {
    if (activeQuestion) {
      const savedHints = localStorage.getItem(`socratic-hints-${activeQuestion.id}`);
      if (savedHints) { try { setAiHints(JSON.parse(savedHints)); } catch (e) { setAiHints([]); } }
      else { setAiHints([]); }
      setActiveHintId(null);
    }
  }, [activeQuestion]);

  const resetQuestionState = () => { setSelectedOption(null); setIsAnswered(false); setIsCorrect(null); };

  const addHint = useCallback((hintText: string, imageUrl: string) => {
    if (!activeQuestion) return;
    const newHint: AiHint = { id: Date.now().toString(), text: hintText, imageUrl, timestamp: Date.now() };
    setAiHints(prev => {
      const next = [newHint, ...prev];
      localStorage.setItem(`socratic-hints-${activeQuestion.id}`, JSON.stringify(next));
      return next;
    });
  }, [activeQuestion]);

  const handleCheckAnswer = async () => {
    if (!selectedOption || !activeQuestion) return;
    const correct = selectedOption === activeQuestion.correctAnswer;
    setIsCorrect(correct);
    setIsAnswered(true);
    await logActivity("socratic_question_attempt", { category: "assessment", metadata: { questionId: activeQuestion.id, exam, subject, year, selectedOption, isCorrect: correct } });
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) { setCurrentQuestionIndex(prev => prev + 1); resetQuestionState(); }
    else { alert("Excellent work! You've completed all available logic sequences for this paper."); setStep("select-details"); }
  };

  const handleAiAnalysis = async (dataUrl: string) => {
    if (!activeQuestion || isAnswered) return;
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/socratic-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: activeQuestion.text, context: activeQuestion.logicContext, canvasImage: dataUrl }) });
      const data = await res.json();
      if (res.ok) { addHint(data.hint, dataUrl); }
      else { addHint(`${data.error || "I'm having trouble seeing your work clearly."} Let's try continuing with the next logical step.`, dataUrl); }
    } catch (err) { addHint("Connection lost. Keep struggling through the logic, I'll be back shortly!", dataUrl); }
    finally { setIsAnalyzing(false); }
  };

  if (step === "select-exam") {
    return (
      <main className="section-padding min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none"><div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#2563eb_0%,transparent_50%)]" /></div>
        <div className="w-full max-w-5xl space-y-12 text-center relative z-10">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-[0.3em] mb-4 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              Socratic Engine Active
            </div>
            <h1 className="text-6xl font-black text-emerald-800 tracking-tight">Productive Struggle</h1>
            <p className="text-emerald-700 text-lg max-w-2xl mx-auto font-bold leading-relaxed">Our AI monitors your handwriting to identify exactly where your reasoning fails.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {[{ type: "IIT-JEE", desc: "Mains & Advanced Track", value: "IIT-JEE", icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-14 w-14 text-accent"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.77 3.77z" /><circle cx="12" cy="12" r="3" /></svg> },
              { type: "NEET", desc: "Biological Precision", value: "NEET", icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-14 w-14 text-accent"><path d="M3 12h18" /><path d="M12 3v18" /><path d="M4.8 2.3A.3.3 0 1 0 5 2.5a.3.3 0 0 0-.2-.2Z" /><path d="M3.3 7a4.6 4.6 0 0 0 4.5 4.4 4.6 4.6 0 0 0 4.5-4.4V4.5a3 3 0 0 0-6 0V7Z" /><path d="M8.3 11.4v4.3a4.3 4.3 0 0 0 8.6 0V11" /><circle cx="17" cy="9" r="2" /></svg> }].map((item) => (
              <button key={item.type} onClick={() => { if (item.value === "IIT-JEE") { setStep("select-iitjee-part"); } else { setExam("NEET"); setStep("select-details"); } }} className="group relative p-12 rounded-[2.5rem] bg-white border border-slate-200 hover:border-accent hover:shadow-[0_20px_50px_rgba(37,99,235,0.1)] transition-all duration-500 hover:-translate-y-3 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="h-24 w-24 rounded-3xl bg-accent/10 flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-transform duration-500">{item.icon}</div>
                <h3 className="text-3xl font-black text-slate-900 uppercase tracking-wider">{item.type}</h3>
                <p className="mt-2 text-sm text-slate-400 font-bold tracking-wide uppercase">{item.desc}</p>
              </button>
            ))}
          </div>
          <Link href="/customer" className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-accent transition-colors"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-4 w-4"><path d="m15 18-6-6 6-6" /></svg>Return to Dashboard</Link>
        </div>
      </main>
    );
  }

  if (step === "select-iitjee-part") {
    return (
      <main className="section-padding min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none"><div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#2563eb_0%,transparent_50%)]" /></div>
        <div className="w-full max-w-5xl space-y-12 text-center relative z-10">
          <div className="space-y-4">
             <button onClick={() => setStep("select-exam")} className="inline-flex items-center gap-2 text-xs font-black text-slate-400 hover:text-accent uppercase tracking-widest mb-4 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-4 w-4"><path d="m15 18-6-6 6-6" /></svg>Back to Track Selection</button>
            <h1 className="text-5xl font-black text-emerald-800 tracking-tight uppercase">IIT-JEE Pathway</h1>
            <p className="text-emerald-700 text-lg max-w-2xl mx-auto font-bold leading-relaxed uppercase tracking-wide">Select your specific target examination</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {[{ type: "JEE Mains", desc: "Foundation & Speed", value: "JEE Mains", icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10 text-accent"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> },
              { type: "JEE Advanced", desc: "Rigorous Depth", value: "JEE Advanced", icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10 text-accent"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg> }].map((item) => (
              <button key={item.type} onClick={() => { setExam(item.value as ExamType); setStep("select-details"); }} className="group relative p-12 rounded-[2.5rem] bg-white border border-slate-200 hover:border-accent hover:shadow-[0_20px_50px_rgba(37,99,235,0.1)] transition-all duration-500 hover:-translate-y-3 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="h-20 w-20 rounded-3xl bg-accent/10 flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-transform duration-500">{item.icon}</div>
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-wider">{item.type}</h3>
                <p className="mt-2 text-sm text-slate-400 font-bold tracking-wide uppercase">{item.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (step === "select-details") {
    return (
      <main className="section-padding min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-[3rem] p-12 space-y-10 shadow-[0_40px_80px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between">
            <div><p className="text-[10px] font-black text-accent uppercase tracking-[0.3em] mb-1">{exam} Configuration</p><h2 className="text-3xl font-black text-slate-900">Target Your Session</h2></div>
            <button onClick={() => setStep("select-exam")} className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-200 transition-all"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-5 w-5"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
          </div>
          <div className="space-y-8">
            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Academic Subject</span>
              <div className="grid grid-cols-2 gap-3">{(exam === "NEET" ? ["Physics", "Chemistry", "Biology"] : ["Physics", "Chemistry", "Mathematics"]).map((s) => (<button key={s} onClick={() => setSubject(s as Subject)} className={`py-4 rounded-2xl border-2 transition-all font-bold tracking-wide ${subject === s ? "bg-accent border-accent text-true-white shadow-glow" : "bg-slate-50 border-slate-100 text-slate-500 hover:border-slate-300"}`}>{s}</button>))}</div>
            </div>
            <label className="block space-y-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Historical Paper Year</span>
              <div className="relative">
                <select className="w-full rounded-2xl bg-slate-50 border-2 border-slate-100 px-6 py-5 text-slate-900 font-bold outline-none focus:border-accent transition-all appearance-none cursor-pointer" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                  {Array.from({ length: 5 }, (_, i) => 2024 - i).map(y => (<option key={y} value={y}>{y} Previous Paper</option>))}
                </select>
                <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-5 w-5"><path d="m6 9 6 6 6-6" /></svg></div>
              </div>
            </label>
            <button disabled={!subject} onClick={() => setStep("workspace")} className="group w-full py-6 rounded-3xl bg-accent text-true-white font-black uppercase tracking-[0.2em] shadow-[0_20px_40px_rgba(37,99,235,0.25)] hover:bg-accent-strong hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-3">
              Initialize Logic Board<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-5 w-5 group-hover:translate-x-1 transition-transform"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="fixed inset-0 z-[100] bg-[#f8fafc] overflow-hidden flex flex-col font-sans select-none">
      <div className="absolute inset-0 opacity-40 pointer-events-none"><div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-100 rounded-full blur-[120px]" /><div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-100 rounded-full blur-[120px]" /></div>
      <header className="flex-none px-10 py-5 border-b border-slate-200 bg-white/70 backdrop-blur-2xl flex items-center justify-between z-20 shadow-sm">
        <div className="flex items-center gap-8">
          <button onClick={() => setStep("select-details")} className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-all shadow-sm"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-5 w-5"><path d="m15 18-6-6 6-6" /></svg></button>
          <div className="space-y-0.5"><div className="flex items-center gap-2"><span className="px-2 py-0.5 rounded bg-accent text-true-white text-[9px] font-black uppercase tracking-wider">{exam}</span><span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{year} Series</span></div><h2 className="text-lg font-black text-slate-900 tracking-tight uppercase">{subject} Logical Mastery</h2></div>
        </div>
        <div className="flex items-center gap-6"><div className="flex items-center gap-3 px-5 py-2 rounded-2xl bg-white border border-slate-200 shadow-sm"><span className={`h-2.5 w-2.5 rounded-full ${isAnalyzing ? "bg-amber-400 animate-ping" : "bg-emerald-500"}`} /><span className="text-[11px] font-black text-slate-600 uppercase tracking-[0.15em]">{isAnalyzing ? "Analyzing Handwriting..." : "Socratic AI Active"}</span></div><button onClick={() => router.push("/customer")} className="px-6 py-2 rounded-xl bg-white border border-slate-200 text-slate-500 text-xs font-black uppercase tracking-widest hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm">Exit Roster</button></div>
      </header>
      <div className="flex-1 flex min-h-0 relative z-10">
        <section className="w-[500px] flex-none border-r border-slate-200 p-10 overflow-y-auto custom-scrollbar flex flex-col space-y-10 bg-white/40 backdrop-blur-md">
          {!activeQuestion ? (<div className="flex-1 flex flex-col items-center justify-center space-y-6 text-center"><div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-8 w-8"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" /><path d="m9 12 2 2 4-4" /></svg></div><div className="space-y-2"><h3 className="text-lg font-black text-slate-900">Sequence Pending</h3><p className="text-sm text-slate-500 font-medium leading-relaxed max-w-[280px]">No logic sequences found for {subject} ({year}). Try another year or subject to begin.</p></div><button onClick={() => setStep("select-details")} className="px-8 py-3 rounded-2xl bg-slate-900 text-true-white text-xs font-black uppercase tracking-widest hover:bg-accent transition-all shadow-lg">Change Filter</button></div>) : (
            <>
              <div className="space-y-6"><div className="flex items-center justify-between"><span className="px-4 py-1.5 rounded-full bg-accent/10 text-accent-strong text-[10px] font-black uppercase tracking-[0.2em] border border-accent/20">Active Question</span><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Question {currentQuestionIndex + 1} / {questions.length}</span></div><div className="space-y-4"><p className="text-2xl font-bold text-slate-900 leading-snug tracking-tight">{activeQuestion.text}</p>{activeQuestion.imageUrl && (<div className="relative aspect-video rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm"><Image src={activeQuestion.imageUrl} alt="Question Diagram" fill className="object-contain p-4" /></div>)}</div></div>
              <div className="grid gap-4">{activeQuestion.options.map((opt) => { const isSelected = selectedOption === opt.label; const showCorrect = isAnswered && opt.label === activeQuestion.correctAnswer; return (<button key={opt.label} disabled={isAnswered} onClick={() => setSelectedOption(opt.label)} className={`w-full text-left p-5 rounded-2xl border-2 transition-all duration-300 flex items-center gap-5 group shadow-sm ${isSelected ? isAnswered ? isCorrect ? "bg-emerald-500 border-emerald-500 shadow-emerald-200" : "bg-rose-500 border-rose-500 shadow-rose-200" : "bg-accent border-accent shadow-md" : showCorrect ? "bg-emerald-50 border-emerald-500 shadow-md" : "bg-white border-slate-100 hover:border-slate-300 hover:shadow-md"}`}><span className={`flex-none h-10 w-10 rounded-xl border-2 flex items-center justify-center text-sm font-black transition-colors ${isSelected ? "bg-white border-white/20 text-slate-900" : "border-slate-100 bg-slate-50 text-slate-400 group-hover:border-slate-300"}`}>{opt.label}</span><span className={`text-base font-bold transition-colors ${isSelected ? "text-true-white" : "text-slate-600 group-hover:text-slate-900"} ${showCorrect && !isSelected ? "text-emerald-700" : ""}`}>{opt.text}</span></button>); })}</div>
              <div className="mt-auto pt-10 border-t border-slate-200 space-y-4">{selectedOption && !isAnswered && (<button onClick={handleCheckAnswer} className="w-full py-5 rounded-2xl bg-emerald-600 text-true-white font-black uppercase tracking-widest hover:bg-emerald-700 hover:scale-[1.02] active:scale-95 transition-all shadow-glow-emerald">Check Logic Sequence</button>)}{isAnswered && (<div className={`p-6 rounded-[2rem] border-2 animate-in fade-in slide-in-from-bottom-4 duration-500 ${isCorrect ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"}`}><div className="flex items-center gap-3 mb-3"><span className={`flex h-8 w-8 items-center justify-center rounded-full text-true-white ${isCorrect ? "bg-emerald-500" : "bg-rose-500"}`}>{isCorrect ? (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="h-4 w-4"><path d="M20 6 9 17l-5-5" /></svg>) : (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="h-4 w-4"><path d="M18 6 6 18M6 6l12 12" /></svg>)}</span><p className={`text-xs font-black uppercase tracking-[0.2em] ${isCorrect ? "text-emerald-700" : "text-rose-700"}`}>{isCorrect ? "Mastery Achieved" : "Logic Gap Detected"}</p></div><div className="space-y-3"><p className="text-sm font-bold text-slate-700 leading-relaxed">{isCorrect ? "Your derivation matches the physical principles perfectly. Continue to the next challenge." : "There's a misalignment in your logic steps. Review the core derivation below."}</p><div className="pt-3 border-t border-slate-200/50"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Mastery Insight</p><p className="text-sm font-medium text-slate-600 italic leading-relaxed">{activeQuestion.logicContext}</p></div></div></div>)}
                {aiHints.length > 0 && !isAnswered && (<div className="space-y-3 max-h-[340px] overflow-y-auto custom-scrollbar pr-2 flex flex-col">{aiHints.map((hint, idx) => (<div key={hint.id} onMouseEnter={() => setActiveHintId(hint.id)} onMouseLeave={() => setActiveHintId(null)} className={`p-5 rounded-[2rem] border-2 transition-all duration-300 cursor-pointer ${idx === 0 ? "bg-amber-50 border-amber-200 shadow-sm" : "bg-white border-slate-100 hover:border-amber-100 hover:bg-amber-50/50"}`}><div className="flex items-center justify-between mb-3"><div className="flex items-center gap-3"><span className={`flex h-8 w-8 items-center justify-center rounded-full ${idx === 0 ? "bg-amber-500 text-true-white" : "bg-slate-100 text-slate-400"}`}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-4 w-4"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" /><path d="M12 16v-4M12 8h.01" /></svg></span><p className={`text-xs font-black uppercase tracking-[0.2em] ${idx === 0 ? "text-amber-700" : "text-slate-500"}`}>{idx === 0 ? "Latest Logic Nudge" : "Past Nudge"}</p></div><span className="text-[10px] font-bold text-slate-400">{new Date(hint.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div><p className={`text-sm font-bold leading-relaxed italic ${idx === 0 ? "text-slate-700" : "text-slate-500"}`}>&ldquo;{hint.text}&rdquo;</p></div>))}</div>)}
                <div className="grid grid-cols-2 gap-3"><button disabled={currentQuestionIndex === 0} onClick={() => { setCurrentQuestionIndex(prev => prev - 1); resetQuestionState(); }} className="py-4 rounded-2xl bg-white border border-slate-200 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 hover:text-slate-900 disabled:opacity-30 transition-all shadow-sm">Previous Sequence</button><button disabled={!isAnswered} onClick={handleNextQuestion} className="py-4 rounded-2xl bg-white border border-slate-200 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 hover:text-slate-900 disabled:opacity-30 transition-all shadow-sm">{currentQuestionIndex < questions.length - 1 ? "Next Logic" : "Finish Series"}</button></div>
              </div>
            </>
          )}
        </section>
        <section className="flex-1 p-10 bg-slate-50/50 flex flex-col space-y-6"><div className="flex items-center justify-between"><div className="space-y-1"><h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.3em]">Smart Logic Canvas</h3><p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">Scribble your derivation steps and free-body diagrams here.</p></div></div><div className="flex-1 relative"><SmartCanvas onSnapshot={handleAiAnalysis} isAnalyzing={isAnalyzing} viewingSnapshot={activeHintId ? aiHints.find(h => h.id === activeHintId)?.imageUrl : null} /></div></section>
      </div>
    </main>
  );
}
