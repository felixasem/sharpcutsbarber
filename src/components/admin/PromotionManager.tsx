"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Promotion, WhatsAppMessageLog } from "@/types/database.types";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Megaphone,
  Plus,
  Send,
  Tag,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";

// ── Create Promotion Form ─────────────────────────────────────────────────────

interface CreatePromoFormProps {
  onCreated: () => void;
}

function CreatePromoForm({ onCreated }: CreatePromoFormProps) {
  const supabase = createClient();
  const [form, setForm] = useState({
    code:             "",
    description:      "",
    discount_percent: 10,
    valid_until:      "",
    max_uses:         "",
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("promotions").insert({
      code:             form.code.toUpperCase().trim(),
      description:      form.description.trim(),
      discount_percent: Number(form.discount_percent),
      valid_until:      form.valid_until || null,
      max_uses:         form.max_uses ? Number(form.max_uses) : null,
      created_by:       user?.id,
    });

    setSaving(false);

    if (error) {
      setErr(error.message);
    } else {
      setForm({ code: "", description: "", discount_percent: 10, valid_until: "", max_uses: "" });
      onCreated();
    }
  };

  const inputCls =
    "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="font-semibold text-zinc-800 flex items-center gap-2">
        <Plus className="h-4 w-4" />
        New Promotion
      </h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-600 uppercase tracking-wide">
            Code *
          </label>
          <input
            required
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            placeholder="SUMMER25"
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-600 uppercase tracking-wide">
            Discount % *
          </label>
          <input
            required
            type="number"
            min={1}
            max={100}
            value={form.discount_percent}
            onChange={(e) => setForm({ ...form, discount_percent: Number(e.target.value) })}
            className={inputCls}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-600 uppercase tracking-wide">
          Description *
        </label>
        <input
          required
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Summer holiday special — 25% off all cuts"
          className={inputCls}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-600 uppercase tracking-wide">
            Expires (optional)
          </label>
          <input
            type="date"
            value={form.valid_until}
            onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-600 uppercase tracking-wide">
            Max Uses (optional)
          </label>
          <input
            type="number"
            min={1}
            value={form.max_uses}
            onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
            placeholder="Unlimited"
            className={inputCls}
          />
        </div>
      </div>

      {err && (
        <p className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" /> {err}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Create Promotion
      </button>
    </form>
  );
}

// ── Blast Confirmation Modal ───────────────────────────────────────────────────

interface BlastModalProps {
  promotion: Promotion;
  optInCount: number;
  onConfirm: () => void;
  onCancel: () => void;
  blasting: boolean;
}

function BlastModal({ promotion, optInCount, onConfirm, onCancel, blasting }: BlastModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
            <Megaphone className="h-5 w-5 text-amber-600" />
          </div>
          <h3 className="font-bold text-zinc-900">Confirm WhatsApp Blast</h3>
        </div>

        <p className="text-sm text-zinc-600">
          You are about to send the{" "}
          <strong className="text-amber-600">{promotion.code}</strong> promotion
          ({promotion.discount_percent}% off) to{" "}
          <strong>{optInCount} opted-in customers</strong> via WhatsApp.
        </p>

        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
          <p className="font-medium">Message preview</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-700">
            "Hey [Customer]! 🎉 Get <strong>{promotion.discount_percent}% OFF</strong> your
            next visit. Use code: <strong>{promotion.code}</strong>. Reply STOP to unsubscribe."
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={blasting}
            className="flex-1 rounded-xl border border-zinc-300 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={blasting}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-60 transition-colors"
          >
            {blasting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send Blast
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function PromotionManager() {
  const supabase = createClient();
  const [promotions,   setPromotions]   = useState<Promotion[]>([]);
  const [optInCount,   setOptInCount]   = useState(0);
  const [blastTarget,  setBlastTarget]  = useState<Promotion | null>(null);
  const [blasting,     setBlasting]     = useState(false);
  const [blastResult,  setBlastResult]  = useState<{ sent: number; failed: number } | null>(null);
  const [loadingPromos, setLoadingPromos] = useState(true);

  const fetchData = async () => {
    setLoadingPromos(true);
    const [{ data: promos }, { count }] = await Promise.all([
      supabase
        .from("promotions")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "customer")
        .eq("whatsapp_opt_in", true),
    ]);
    setPromotions(promos ?? []);
    setOptInCount(count ?? 0);
    setLoadingPromos(false);
  };

  useEffect(() => { fetchData(); }, []);

  const toggleActive = async (promo: Promotion) => {
    await supabase
      .from("promotions")
      .update({ active: !promo.active })
      .eq("id", promo.id);
    fetchData();
  };

  const deletePromo = async (id: string) => {
    if (!confirm("Delete this promotion? This cannot be undone.")) return;
    await supabase.from("promotions").delete().eq("id", id);
    fetchData();
  };

  const executeBlast = async () => {
    if (!blastTarget) return;
    setBlasting(true);
    setBlastResult(null);

    const { data: { session } } = await supabase.auth.getSession();

    const res = await fetch("/api/promotions/blast", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ promotionId: blastTarget.id }),
    });

    const data = await res.json();
    setBlasting(false);
    setBlastTarget(null);
    setBlastResult(data);
  };

  return (
    <div className="space-y-8">
      {/* Blast result toast */}
      {blastResult && (
        <div className="flex items-center gap-3 rounded-xl bg-green-50 border border-green-200 p-4">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
          <p className="text-sm text-green-800">
            Blast complete — <strong>{blastResult.sent}</strong> sent,{" "}
            <strong>{blastResult.failed}</strong> failed.
          </p>
          <button
            onClick={() => setBlastResult(null)}
            className="ml-auto text-green-600 hover:text-green-800"
          >
            ×
          </button>
        </div>
      )}

      {/* Create form */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <CreatePromoForm onCreated={fetchData} />
      </div>

      {/* Promotions list */}
      <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
        <div className="border-b border-zinc-100 px-6 py-4 flex items-center justify-between">
          <h3 className="font-semibold text-zinc-900 flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Active Promotions
          </h3>
          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
            {optInCount} opted-in customers
          </span>
        </div>

        {loadingPromos ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-300" />
          </div>
        ) : promotions.length === 0 ? (
          <p className="py-10 text-center text-sm text-zinc-400">
            No promotions yet. Create one above.
          </p>
        ) : (
          <div className="divide-y divide-zinc-100">
            {promotions.map((promo) => (
              <div
                key={promo.id}
                className="flex items-center gap-4 px-6 py-4 hover:bg-zinc-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-zinc-900">
                      {promo.code}
                    </span>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                      {promo.discount_percent}% off
                    </span>
                    <span
                      className={[
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        promo.active
                          ? "bg-green-100 text-green-700"
                          : "bg-zinc-100 text-zinc-500",
                      ].join(" ")}
                    >
                      {promo.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-zinc-500 truncate">
                    {promo.description}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    Used {promo.current_uses}
                    {promo.max_uses ? ` / ${promo.max_uses}` : ""} times
                    {promo.valid_until
                      ? ` · Expires ${format(new Date(promo.valid_until), "d MMM yyyy")}`
                      : ""}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Blast button */}
                  <button
                    onClick={() => {
                      setBlastResult(null);
                      setBlastTarget(promo);
                    }}
                    disabled={!promo.active}
                    title="Send WhatsApp blast"
                    className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-30 transition-colors"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Blast
                  </button>

                  {/* Toggle active */}
                  <button
                    onClick={() => toggleActive(promo)}
                    className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 transition-colors"
                  >
                    {promo.active ? "Disable" : "Enable"}
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => deletePromo(promo.id)}
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Blast confirmation modal */}
      {blastTarget && (
        <BlastModal
          promotion={blastTarget}
          optInCount={optInCount}
          onConfirm={executeBlast}
          onCancel={() => setBlastTarget(null)}
          blasting={blasting}
        />
      )}
    </div>
  );
}
