"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Scissors, Loader2, Eye, EyeOff } from "lucide-react";

export function LoginContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const nextUrl      = searchParams.get("next") ?? "/booking";
  const supabase     = createClient();

  const [mode,     setMode]     = useState<"login" | "signup">("login");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [name,     setName]     = useState("");
  const [phone,    setPhone]    = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [success,  setSuccess]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (mode === "signup") {
      const phoneRegex = /^\+[1-9]\d{6,14}$/;
      if (!phoneRegex.test(phone)) {
        setError("Phone must be in E.164 format, e.g. +27821234567");
        setLoading(false);
        return;
      }

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name, phone_whatsapp: phone },
        },
      });

      if (signUpError) setError(signUpError.message);
      else setSuccess(true);
    } else {
      const { data: signInData, error: loginError } =
        await supabase.auth.signInWithPassword({ email, password });

      if (loginError) {
        setError(loginError.message);
      } else {
        // Check role — staff go straight to /admin
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", signInData.user!.id)
          .single();

        const destination =
          profile?.role === "admin" || profile?.role === "barber"
            ? "/admin"
            : nextUrl;

        router.push(destination);
        router.refresh();
      }
    }
    setLoading(false);
  };

  const inputCls =
    "w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition";

  if (success) {
    return (
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-zinc-900">Check your email</h2>
          <p className="text-zinc-500 text-sm">
            We sent a confirmation link to <strong>{email}</strong>. Click it to
            activate your account, then come back to log in.
          </p>
          <button onClick={() => setMode("login")} className="text-amber-600 text-sm font-medium hover:underline">
            Back to login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-900 mb-4">
            <Scissors className="h-7 w-7 text-amber-400" />
          </div>
          <h1 className="text-2xl font-extrabold text-zinc-900">SharpCuts</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {mode === "login" ? "Sign in to your account" : "Create your account"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
          {mode === "signup" && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">Full Name</label>
                <input required type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">WhatsApp Number</label>
                <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+27821234567" className={inputCls} />
                <p className="text-xs text-zinc-400">Include country code, e.g. +27 for South Africa</p>
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">Email</label>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">Password</label>
            <div className="relative">
              <input required type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" minLength={6} className={inputCls + " pr-11"} />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 font-bold text-zinc-900 hover:bg-amber-400 disabled:opacity-60 transition-colors">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-500">
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <button type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); }} className="text-amber-600 font-semibold hover:underline">
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </main>
  );
}
