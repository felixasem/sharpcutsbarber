"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Save } from "lucide-react";

export function AccountContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const nextUrl      = searchParams.get("next") ?? "/booking";
  const isSetup      = searchParams.get("setup") === "true";
  const supabase     = createClient();

  const [name,    setName]    = useState("");
  const [phone,   setPhone]   = useState("");
  const [optIn,   setOptIn]   = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        setName(data.full_name ?? "");
        setPhone(data.phone_whatsapp ?? "");
        setOptIn(data.whatsapp_opt_in ?? true);
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const phoneRegex = /^\+[1-9]\d{6,14}$/;
    if (!phoneRegex.test(phone)) {
      setError("Phone must be E.164 format, e.g. +27821234567");
      setSaving(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error: upErr } = await supabase
      .from("profiles")
      .update({ full_name: name.trim(), phone_whatsapp: phone.trim(), whatsapp_opt_in: optIn })
      .eq("id", user.id);

    if (upErr) {
      setError(upErr.message);
    } else {
      router.push(nextUrl);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </main>
    );
  }

  const inputCls =
    "w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none";

  return (
    <main className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-zinc-900">
            {isSetup ? "Complete your profile" : "My Account"}
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            {isSetup
              ? "We need your WhatsApp number to send booking confirmations."
              : "Update your contact details."}
          </p>
        </div>

        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">Full Name</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="John Doe" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">
              WhatsApp Number
            </label>
            <input
              required
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+27821234567"
              className={inputCls}
            />
            <p className="text-xs text-zinc-400">Include country code. E.g. +27 for South Africa.</p>
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={optIn}
              onChange={(e) => setOptIn(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-amber-500 focus:ring-amber-400"
            />
            <span className="text-sm text-zinc-600">
              Receive WhatsApp reminders &amp; promotions from SharpCuts
            </span>
          </label>

          {error && (
            <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 font-bold text-zinc-900 hover:bg-amber-400 disabled:opacity-60 transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save &amp; Continue
          </button>
        </form>
      </div>
    </main>
  );
}
