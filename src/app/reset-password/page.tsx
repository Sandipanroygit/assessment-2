
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const prepare = async () => {
      const code = searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setStatus(error.message ?? "Reset link is invalid or has expired. Request a new one from the login page.");
          return;
        }
        setReady(true);
        return;
      }

      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setStatus("Could not validate reset link. Please request a new one from the login page.");
        return;
      }
      if (data.session) {
        setReady(true);
      } else {
        setStatus("Reset link is invalid or expired. Request a new one from the login page.");
      }
    };

    prepare();

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });
    return () => {
      data?.subscription.unsubscribe();
    };
  }, [searchParams]);

  const handleUpdatePassword = async () => {
    if (!ready) {
      setStatus("Reset link is not valid. Request a new one from the login page.");
      return;
    }
    if (!password.trim() || password.length < 6) {
      setStatus("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setStatus("Passwords do not match.");
      return;
    }
    setLoading(true);
    setStatus(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus(error.message ?? "Unable to update password. Request a new reset link.");
      setLoading(false);
      return;
    }
    await supabase.auth.signOut();
    setStatus("Password updated. Redirecting to login...");
    setLoading(false);
    setTimeout(() => router.replace("/login"), 900);
  };

  return (
    <main className="min-h-screen section-padding flex items-center justify-center">
      <div className="relative max-w-xl w-full">
        <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-accent/10 via-accent-strong/5 to-transparent blur-3xl" />
        <div className="rounded-3xl border border-white/12 bg-surface/90 shadow-glow p-8 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Password</p>
              <h2 className="text-2xl font-semibold text-white">Set a new password</h2>
            </div>
            <Link
              href="/login"
              className="text-xs px-3 py-1 rounded-full border border-white/10 text-slate-200 hover:border-accent-strong"
            >
              Back to login
            </Link>
          </div>

          <p className="text-sm text-slate-300">
            Use the link we emailed to reach this page. Choose a new password below.
          </p>

          <label className="block text-sm text-slate-300 space-y-2">
            New password
            <input
              type="password"
              className="w-full rounded-xl border border-slate-500/70 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          <label className="block text-sm text-slate-300 space-y-2">
            Confirm password
            <input
              type="password"
              className="w-full rounded-xl border border-slate-500/70 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </label>

          {status && (
            <div className="rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent-strong">
              {status}
            </div>
          )}

          <button
            onClick={handleUpdatePassword}
            disabled={loading || !ready}
            className="w-full py-3 rounded-xl bg-accent text-true-white font-semibold shadow-glow hover:translate-y-[-1px] transition-transform disabled:opacity-70"
          >
            {loading ? "Updating..." : "Update password"}
          </button>

          {!ready && (
            <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
              Waiting for a valid reset link. If this page was opened directly, go back and request a new link from the login page.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
