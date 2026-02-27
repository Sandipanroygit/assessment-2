
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { logActivity } from "@/lib/activityLogger";

type AuthMode = "login" | "signup" | "reset";
type UserRole = "admin" | "teacher" | "student";
type Profile = { full_name?: string; role?: string; grade?: string };
const TEACHER_HOME_TOUR_ENTRY_KEY = "teacher_home_tour_entry_pending_v1";
const TEACHER_TOUR_STORAGE_KEY = "teacher_feature_tour_v2";
const TEACHER_PROGRESS_TOUR_FORCE_KEY = "teacher_progress_tour_force_once_v2";
const TEACHER_PROGRESS_TOUR_CHAIN_KEY = "teacher_progress_tour_chain_meta_v2";
const TEACHER_STUDENTS_TOUR_FORCE_KEY = "teacher_students_tour_force_once_v2";
const TEACHER_STUDENTS_TOUR_CHAIN_KEY = "teacher_students_tour_chain_meta_v2";
const TEACHER_DASHBOARD_TOUR_RESUME_KEY = "teacher_dashboard_tour_resume_v2";
const TEACHER_TOUR_AUTOSTART_KEY = "teacher_dashboard_tour_autostart_v1";
const STUDENT_TOUR_STORAGE_KEY = "student_feature_tour_v2";
const STUDENT_ACTIVITY_TOUR_AUTOSTART_KEY = "student_activity_tour_autostart_v2";
const STUDENT_ACTIVITY_TOUR_CHAIN_KEY = "student_activity_tour_chain_meta_v2";
const STUDENT_DASHBOARD_TOUR_RESUME_KEY = "student_dashboard_tour_resume_v2";
const ADMIN_TOUR_STORAGE_KEY = "admin_feature_tour_v1";

const gradeOptions = ["Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"];
const subjectOptions = [
  "Physics",
  "Mathematics",
  "Computer Science",
  "Environment System & Society (ESS)",
  "Design Technology",
];

const resolveAuthNetworkStatus = (error: unknown, fallback: string) => {
  if (error instanceof TypeError && error.message.toLowerCase().includes("failed to fetch")) {
    return "Unable to reach Supabase Auth. Check internet, VPN/proxy, ad-blocker, and then retry.";
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof window !== "undefined" ? window.location.origin : undefined);
  const defaultAdminEmail = process.env.NEXT_PUBLIC_DEFAULT_ADMIN_EMAIL ?? "";
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("teacher");
  const [grade, setGrade] = useState(gradeOptions[0]);
  const [subject, setSubject] = useState<string>(subjectOptions[0]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isEmailNotConfirmed = (status ?? "").toLowerCase().includes("email not confirmed");
  const statusClassName = isEmailNotConfirmed
    ? "rounded-xl border border-rose-300/70 bg-rose-50/90 px-3 py-2 text-sm font-medium text-rose-700"
    : "rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent-strong";

  const nextPath = useMemo(() => {
    const raw = searchParams.get("next");
    if (!raw) return null;
    try {
      const decoded = decodeURIComponent(raw);
      if (!decoded.startsWith("/") || decoded.startsWith("//")) return null;
      return decoded;
    } catch {
      return null;
    }
  }, [searchParams]);

  useEffect(() => {
    setStatus(null);
  }, [mode]);

  const ensureProfile = useCallback(
    async (user: User): Promise<Profile | null> => {
      const { data: existing, error: fetchError } = await supabase
        .from("profiles")
        .select("full_name, role, grade")
        .eq("id", user.id)
        .maybeSingle();
      if (!fetchError && existing) return existing as Profile;
      if (fetchError) {
        console.warn("Profile fetch error", fetchError.message);
      }

      const roleFromMeta = (user.user_metadata?.role as string | undefined)?.toLowerCase() ?? "student";
      const payload: Record<string, string> = {
        id: user.id,
        full_name: (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "Customer",
        role: roleFromMeta,
      };
      const gradeFromMeta = user.user_metadata?.grade as string | undefined;
      if (gradeFromMeta) {
        payload.grade = gradeFromMeta;
      }

      const { data, error } = await supabase
        .from("profiles")
        .insert(payload)
        .select("full_name, role, grade")
        .single();
      if (error) {
        console.warn("Profile insert failed", error.message);
        return existing ?? null;
      }
      return data as Profile;
    },
    []
  );

  const routeByRole = useCallback(
    (roleValue?: string, emailOverride?: string | null, fromLogin = false, forcedPath?: string | null) => {
      if (forcedPath) {
        router.push(forcedPath);
        return;
      }

      const isDefaultAdmin = (emailOverride ?? email).toLowerCase() === defaultAdminEmail.toLowerCase();
      const computedRole = roleValue ?? (isDefaultAdmin ? "admin" : undefined);
      if (computedRole === "admin" || isDefaultAdmin) {
        router.push("/admin");
      } else if (computedRole === "teacher") {
        if (fromLogin && typeof window !== "undefined") {
          window.sessionStorage.setItem(TEACHER_HOME_TOUR_ENTRY_KEY, "1");
        }
        router.push("/");
      } else {
        router.push("/customer");
      }
    },
    [defaultAdminEmail, email, router]
  );

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data.user;
        if (user) {
          const profile = await ensureProfile(user);
          routeByRole(profile?.role ?? user.user_metadata.role, user.email, false, nextPath);
        }
      } catch {
        // Ignore transient network issues during session bootstrap.
      }
    };
    void checkSession();
  }, [ensureProfile, nextPath, routeByRole]);

  const handleRoleChange = (nextRole: UserRole) => {
    setRole(nextRole);
    setEmail("");
    setPassword("");
    if (nextRole === "student" && !grade) {
      setGrade(gradeOptions[0]);
    }
    if (nextRole === "teacher" && !subject) {
      setSubject(subjectOptions[0]);
    }
  };

  const handleLogin = async () => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setStatus("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }
    if (!email.trim() || !password.trim()) {
      setStatus("Email and password are required.");
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error || !data.user) {
        setStatus(error?.message ?? "Unable to sign in. Check credentials.");
        return;
      }
      const profile = await ensureProfile(data.user);
      const resolvedRole = (profile?.role ?? (data.user.user_metadata?.role as string | undefined) ?? "student").toLowerCase();
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(TEACHER_TOUR_STORAGE_KEY);
        window.localStorage.removeItem(TEACHER_DASHBOARD_TOUR_RESUME_KEY);
        window.localStorage.removeItem(TEACHER_PROGRESS_TOUR_FORCE_KEY);
        window.localStorage.removeItem(TEACHER_PROGRESS_TOUR_CHAIN_KEY);
        window.localStorage.removeItem(TEACHER_STUDENTS_TOUR_FORCE_KEY);
        window.localStorage.removeItem(TEACHER_STUDENTS_TOUR_CHAIN_KEY);
        window.localStorage.removeItem(STUDENT_TOUR_STORAGE_KEY);
        window.localStorage.removeItem(STUDENT_DASHBOARD_TOUR_RESUME_KEY);
        window.localStorage.removeItem(STUDENT_ACTIVITY_TOUR_CHAIN_KEY);
        window.localStorage.removeItem(ADMIN_TOUR_STORAGE_KEY);
        window.sessionStorage.removeItem(TEACHER_HOME_TOUR_ENTRY_KEY);
        window.sessionStorage.removeItem(TEACHER_TOUR_AUTOSTART_KEY);
        window.sessionStorage.removeItem(STUDENT_ACTIVITY_TOUR_AUTOSTART_KEY);
      }
      void logActivity("auth_login", {
        category: "auth",
        metadata: { role: resolvedRole, source: "login_page" },
      });
      setStatus(`Hi ${profile?.full_name ?? data.user.email}! Redirecting...`);
      routeByRole(profile?.role ?? data.user.user_metadata.role, data.user.email, true, nextPath);
    } catch (err) {
      setStatus(resolveAuthNetworkStatus(err, "Unable to sign in. Check credentials."));
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setStatus("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }
    setLoading(true);
    setStatus(null);
    if (!email.trim() || !password.trim()) {
      setStatus("Email and password are required.");
      setLoading(false);
      return;
    }
    if (password.length < 6) {
      setStatus("Password must be at least 6 characters.");
      setLoading(false);
      return;
    }
    if (role === "student" && !grade) {
      setStatus("Please select your grade to continue.");
      setLoading(false);
      return;
    }
    const metadata: Record<string, string> = { full_name: fullName, role: role.toLowerCase() };
    if (role === "teacher") {
      metadata.subject = subject;
    }
    if (role === "student") {
      metadata.grade = grade;
    }
    const redirectTo = siteUrl ? `${siteUrl}/login` : undefined;
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: metadata,
          emailRedirectTo: redirectTo,
        },
      });
      if (error || !data.user) {
        setStatus(error?.message ?? "Unable to sign up.");
        return;
      }
      setStatus("Account created. Check your email to confirm, then sign in.");
      setMode("login");
    } catch (err) {
      setStatus(resolveAuthNetworkStatus(err, "Unable to sign up."));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setStatus("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }
    if (!email.trim()) {
      setStatus("Enter the email you use to sign in.");
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: siteUrl ? `${siteUrl}/reset-password` : undefined,
      });
      if (error) {
        setStatus(error.message ?? "Unable to send password reset email.");
        return;
      }
      setStatus("Password reset link sent. Check your email (and spam).");
    } catch (err) {
      setStatus(resolveAuthNetworkStatus(err, "Unable to send password reset email."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen section-padding flex items-center justify-center">
      <div className="relative max-w-3xl w-full">
        <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-accent/10 via-accent-strong/5 to-transparent blur-3xl" />
        <div className="rounded-3xl border border-white/12 bg-surface/90 shadow-glow p-8 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Access</p>
              <h2 className="text-2xl font-semibold text-white">Login or create account</h2>
            </div>
            <Link
              href="/"
              className="text-xs px-3 py-1 rounded-full border border-slate-700/50 outline outline-1 outline-slate-500/35 text-slate-900 hover:border-slate-700/70"
            >
              Back to home
            </Link>
          </div>

          <div className="flex gap-2 bg-white/5 p-1 rounded-xl">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                mode === "login" ? "bg-accent text-true-white shadow-glow" : "text-white"
              }`}
            >
              Log In
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                mode === "signup" ? "bg-accent text-true-white shadow-glow" : "text-white"
              }`}
            >
              Sign Up
            </button>
          </div>

          {mode === "reset" ? (
            <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-slate-200">
                Enter your account email and we will email you a link to choose a new password.
              </p>
              <label className="block text-sm text-slate-300 space-y-2">
                Email
                <input
                  type="email"
                  className="w-full rounded-xl border border-slate-500/70 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              {status && (
                <div className={statusClassName}>
                  {status}
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handlePasswordReset}
                  disabled={loading}
                  className="flex-1 py-3 rounded-xl bg-accent text-true-white font-semibold shadow-glow hover:translate-y-[-1px] transition-transform disabled:opacity-70"
                >
                  {loading ? "Sending..." : "Send reset link"}
                </button>
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="px-4 py-3 rounded-xl border border-white/15 text-slate-200 hover:border-accent-strong"
                >
                  Back to login
                </button>
              </div>
              <p className="text-xs text-slate-400">Links expire quickly; request a new one if it stops working.</p>
            </div>
          ) : (
            <>
              {mode === "signup" && (
                <label className="block text-sm text-slate-300 space-y-2">
                  Role
                  <select
                    className="w-full rounded-xl border border-slate-500/70 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none"
                    value={role}
                    onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                  >
                    <option value="teacher" className="text-black">
                      Teacher
                    </option>
                    <option value="student" className="text-black">
                      Student
                    </option>
                  </select>
                </label>
              )}

              {mode === "signup" && (
                <label className="block text-sm text-slate-300 space-y-2">
                  Full name
                  <input
                    type="text"
                    className="w-full rounded-xl border border-slate-500/70 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none"
                    placeholder="Your name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </label>
              )}

              {role === "student" && mode === "signup" && (
                <label className="block text-sm text-slate-300 space-y-2">
                  Grade
                  <select
                    className="w-full rounded-xl border border-slate-500/70 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                  >
                    {gradeOptions.map((option) => (
                      <option key={option} value={option} className="text-black">
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {role === "teacher" && mode === "signup" && (
                <label className="block text-sm text-slate-300 space-y-2">
                  Subject
                  <select
                    className="w-full rounded-xl border border-slate-500/70 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  >
                    {subjectOptions.map((option) => (
                      <option key={option} value={option} className="text-black">
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="block text-sm text-slate-300 space-y-2">
                Email
                <input
                  type="email"
                  className="w-full rounded-xl border border-slate-500/70 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>

              <label className="block text-sm text-slate-300 space-y-2">
                Password
                <input
                  type="password"
                  className="w-full rounded-xl border border-slate-500/70 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>

              {mode === "login" && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setMode("reset")}
                    className="text-xs text-accent-strong hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {status && (
                <div className={statusClassName}>
                  {status}
                </div>
              )}

              <button
                onClick={mode === "login" ? handleLogin : handleSignup}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-accent text-true-white font-semibold shadow-glow hover:translate-y-[-1px] transition-transform disabled:opacity-70"
              >
                {loading ? "Please wait..." : mode === "login" ? "Log In" : "Create account"}
              </button>

            </>
          )}
        </div>
      </div>
    </main>
  );
}
