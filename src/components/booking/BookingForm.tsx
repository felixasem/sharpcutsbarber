"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { addMinutes } from "date-fns";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Tag,
  User,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Service } from "@/types/database.types";
import { ServiceSelector } from "./ServiceSelector";
import { AddonSelector } from "./AddonSelector";
import { TimeSlotPicker } from "./TimeSlotPicker";

interface PriceSummaryProps {
  service: Service | null;
  selectedAddons: Service[];
  discount: number;
}

function PriceSummary({ service, selectedAddons, discount }: PriceSummaryProps) {
  if (!service) return null;
  const addonTotal = selectedAddons.reduce((s, a) => s + a.price, 0);
  const subtotal   = service.price + addonTotal;
  const total      = Math.max(0, subtotal - discount);

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-2 text-sm">
      <div className="flex justify-between text-zinc-600">
        <span>{service.name}</span>
        <span>R{service.price.toFixed(0)}</span>
      </div>
      {selectedAddons.map((a) => (
        <div key={a.id} className="flex justify-between text-zinc-500">
          <span>{a.name}</span>
          <span>+R{a.price.toFixed(0)}</span>
        </div>
      ))}
      {discount > 0 && (
        <div className="flex justify-between text-green-600 font-medium">
          <span>Promo discount</span>
          <span>-R{discount.toFixed(0)}</span>
        </div>
      )}
      <div className="border-t border-zinc-200 pt-2 flex justify-between font-bold text-zinc-900 text-base">
        <span>Total</span>
        <span>R{total.toFixed(0)}</span>
      </div>
    </div>
  );
}

export function BookingForm() {
  const router = useRouter();
  const supabase = createClient();

  // Data
  const [barbers, setBarbers]   = useState<Profile[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  // Selections
  const [selectedBarber,  setSelectedBarber]  = useState<Profile | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedAddons,  setSelectedAddons]  = useState<Service[]>([]);
  const [selectedTime,    setSelectedTime]    = useState<Date | null>(null);
  const [promoCode,       setPromoCode]       = useState("");
  const [promoDiscount,   setPromoDiscount]   = useState(0);
  const [promoStatus,     setPromoStatus]     = useState<"idle" | "valid" | "invalid">("idle");
  const [notes,           setNotes]           = useState("");

  // UI state
  const [submitting,   setSubmitting]   = useState(false);
  const [loadingData,  setLoadingData]  = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [success,      setSuccess]      = useState(false);
  const [step,         setStep]         = useState<1 | 2 | 3>(1);

  useEffect(() => {
    Promise.all([
      supabase.from("profiles").select("*").eq("role", "barber"),
      supabase.from("services").select("*").eq("is_active", true).order("sort_order"),
    ]).then(([{ data: b, error: be }, { data: s }]) => {
      if (be) console.error("Barber fetch error:", be.message);
      setBarbers(b ?? []);
      setServices(s ?? []);
      setLoadingData(false);
    });
  }, []);

  if (loadingData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        <p className="text-sm text-zinc-400">Loading available services...</p>
      </div>
    );
  }

  const totalDuration =
    (selectedService?.duration_minutes ?? 0) +
    selectedAddons.reduce((s, a) => s + a.duration_minutes, 0);

  const toggleAddon = (addon: Service) => {
    setSelectedAddons((prev) =>
      prev.find((a) => a.id === addon.id)
        ? prev.filter((a) => a.id !== addon.id)
        : [...prev, addon]
    );
  };

  const validatePromo = async () => {
    if (!promoCode.trim() || !selectedService) return;
    const { data: promo } = await supabase
      .from("promotions")
      .select("discount_percent, valid_until, max_uses, current_uses")
      .eq("code", promoCode.toUpperCase().trim())
      .eq("active", true)
      .single();

    if (!promo) {
      setPromoStatus("invalid");
      setPromoDiscount(0);
      return;
    }

    const expired   = promo.valid_until && new Date(promo.valid_until) < new Date();
    const exhausted = promo.max_uses !== null && promo.current_uses >= promo.max_uses;

    if (expired || exhausted) {
      setPromoStatus("invalid");
      setPromoDiscount(0);
    } else {
      const subtotal = selectedService.price +
        selectedAddons.reduce((s, a) => s + a.price, 0);
      setPromoDiscount((subtotal * promo.discount_percent) / 100);
      setPromoStatus("valid");
    }
  };

  const handleSubmit = async () => {
    if (!selectedBarber || !selectedService || !selectedTime) return;
    setSubmitting(true);
    setError(null);

    try {
      // Get Bearer token so the API route can auth the user
      // regardless of how cookies are forwarded in Next.js 16
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Your session has expired. Please log in again.");
        setSubmitting(false);
        router.push("/login?next=/booking");
        return;
      }

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          barberId:        selectedBarber.id,
          serviceId:       selectedService.id,
          addonIds:        selectedAddons.map((a) => a.id),
          appointmentTime: selectedTime.toISOString(),
          promoCode:       promoStatus === "valid" ? promoCode.toUpperCase().trim() : undefined,
          notes:           notes || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-zinc-900">Booking Confirmed!</h2>
        <p className="text-zinc-500 max-w-sm">
          A confirmation has been sent to your WhatsApp. We'll remind you 24 hours
          and 2 hours before your appointment.
        </p>
        <button
          onClick={() => router.push("/")}
          className="mt-4 rounded-xl bg-amber-500 px-6 py-3 font-semibold text-white hover:bg-amber-600 transition-colors"
        >
          Back to Home
        </button>
      </div>
    );
  }

  const addonServices = services.filter((s) => s.is_addon);

  return (
    <div className="mx-auto max-w-xl space-y-8 py-8 px-4">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">
          Book Your Cut ✂️
        </h1>
        <p className="mt-1 text-zinc-500">
          Choose your style, pick a time, and we'll send everything to WhatsApp.
        </p>
      </div>

      {/* Step 1: Barber + Service */}
      <div className="space-y-6">
        {/* Barber selector */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900">Choose Your Barber</h2>
          {barbers.length === 0 && (
            <p className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
              No barbers available right now. Please check back soon.
            </p>
          )}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
            {barbers.map((barber) => {
              const active = selectedBarber?.id === barber.id;
              return (
                <button
                  key={barber.id}
                  type="button"
                  onClick={() => setSelectedBarber(barber)}
                  className={[
                    "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all",
                    active
                      ? "border-amber-500 bg-amber-50 ring-2 ring-amber-300 ring-offset-1"
                      : "border-zinc-200 bg-white hover:border-amber-300",
                  ].join(" ")}
                >
                  {barber.avatar_url ? (
                    <img
                      src={barber.avatar_url}
                      alt={barber.full_name}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                      <User className="h-6 w-6 text-amber-600" />
                    </div>
                  )}
                  <span className="text-center text-sm font-medium text-zinc-800">
                    {barber.full_name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Service selector */}
        <ServiceSelector
          services={services}
          selectedId={selectedService?.id ?? null}
          onSelect={(svc) => {
            setSelectedService(svc);
            setPromoStatus("idle");
            setPromoDiscount(0);
          }}
        />

        {/* Add-ons (shown after service picked) */}
        {selectedService && (
          <AddonSelector
            addons={addonServices}
            selectedIds={selectedAddons.map((a) => a.id)}
            onToggle={toggleAddon}
          />
        )}
      </div>

      {/* Step 2: Time slot */}
      {selectedService && selectedBarber && (
        <TimeSlotPicker
          barberId={selectedBarber.id}
          serviceDuration={totalDuration}
          selectedTime={selectedTime}
          onSelect={setSelectedTime}
        />
      )}

      {/* Step 3: Promo + Notes + Confirm */}
      {selectedTime && selectedService && (
        <div className="space-y-5">
          {/* Promo code */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700">
              Promo Code (optional)
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => {
                    setPromoCode(e.target.value.toUpperCase());
                    setPromoStatus("idle");
                    setPromoDiscount(0);
                  }}
                  placeholder="SUMMER20"
                  className="w-full rounded-lg border border-zinc-300 py-2.5 pl-9 pr-3 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none"
                />
              </div>
              <button
                type="button"
                onClick={validatePromo}
                disabled={!promoCode.trim()}
                className="rounded-lg bg-zinc-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 transition-colors"
              >
                Apply
              </button>
            </div>
            {promoStatus === "valid" && (
              <p className="flex items-center gap-1.5 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Promo applied — R{promoDiscount.toFixed(0)} off!
              </p>
            )}
            {promoStatus === "invalid" && (
              <p className="flex items-center gap-1.5 text-sm text-red-500">
                <AlertCircle className="h-4 w-4" />
                Invalid or expired promo code.
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-700">
              Special requests (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any notes for your barber..."
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none resize-none"
            />
          </div>

          {/* Price summary */}
          <PriceSummary
            service={selectedService}
            selectedAddons={selectedAddons}
            discount={promoDiscount}
          />

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-3.5 text-base font-bold text-white shadow-lg hover:bg-amber-600 active:scale-[0.98] disabled:opacity-60 transition-all"
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                Confirm Booking
                <ChevronRight className="h-5 w-5" />
              </>
            )}
          </button>
          <p className="text-center text-xs text-zinc-400">
            Confirmation will be sent to your WhatsApp number
          </p>
        </div>
      )}
    </div>
  );
}
