"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { format, startOfDay, endOfDay } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import {
  Calendar, CheckCircle2, Clock, Loader2,
  RefreshCw, User, XCircle,
} from "lucide-react";

interface AppointmentRow {
  id: string;
  appointment_time: string;
  end_time: string;
  status: string;
  total_price: number;
  customer: { full_name: string; phone_whatsapp: string } | null;
  barber:   { full_name: string } | null;
  service:  { name: string } | null;
  addons:   Array<{ service: { name: string } | null }>;
}

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-blue-100 text-blue-700",
  pending:   "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-zinc-100 text-zinc-500",
  no_show:   "bg-red-100 text-red-600",
};

export function AppointmentCalendar() {
  const supabase                              = createClient();
  const [appointments, setAppointments]       = useState<AppointmentRow[]>([]);
  const [loading,      setLoading]            = useState(true);
  const [refreshing,   setRefreshing]         = useState(false);
  // Initialise dates to null — set in useEffect to avoid SSR/client hydration mismatch
  const [selectedDate, setSelectedDate]       = useState<Date | null>(null);
  const [lastUpdated,  setLastUpdated]        = useState<Date | null>(null);
  const selectedDateRef                       = useRef<Date | null>(null);
  selectedDateRef.current                     = selectedDate;

  // Set today's date only on the client
  useEffect(() => {
    const today = new Date();
    setSelectedDate(today);
    setLastUpdated(today);
  }, []);

  // ── Core fetch ─────────────────────────────────────────────────────────────
  const fetchAppointments = useCallback(async (date: Date, silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    const { data, error } = await supabase
      .from("appointments")
      .select(`
        id, appointment_time, end_time, status, total_price,
        customer:profiles!appointments_customer_id_fkey (full_name, phone_whatsapp),
        barber:profiles!appointments_barber_id_fkey (full_name),
        service:services!appointments_service_id_fkey (name),
        addons:appointment_addons (
          service:services!appointment_addons_service_id_fkey (name)
        )
      `)
      .gte("appointment_time", startOfDay(date).toISOString())
      .lte("appointment_time", endOfDay(date).toISOString())
      .order("appointment_time");

    if (error) console.error("[AppointmentCalendar]", error.message);

    setAppointments((data ?? []) as unknown as AppointmentRow[]);
    setLastUpdated(new Date());
    setLoading(false);
    setRefreshing(false);
  }, []);

  // ── Initial load + date change (skip until client has set a date) ──────────
  useEffect(() => {
    if (selectedDate) fetchAppointments(selectedDate);
  }, [selectedDate, fetchAppointments]);

  // ── Supabase Realtime — live updates when any appointment changes ───────────
  useEffect(() => {
    const channel = supabase
      .channel("appointments-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        () => {
          // Re-fetch silently (no full spinner) when a change comes in
          if (selectedDateRef.current) fetchAppointments(selectedDateRef.current, true);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchAppointments]);

  // ── Status update ───────────────────────────────────────────────────────────
  const updateStatus = async (id: string, status: string) => {
    await supabase.from("appointments").update({ status }).eq("id", id);
    // Realtime will trigger a re-fetch automatically
  };

  const durationMins = (appt: AppointmentRow) =>
    Math.round(
      (new Date(appt.end_time).getTime() -
        new Date(appt.appointment_time).getTime()) / 60000
    );

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 border-b border-zinc-100 px-6 py-4 flex-wrap">
        <Calendar className="h-5 w-5 text-zinc-400 shrink-0" />
        <input
          type="date"
          value={selectedDate ? format(selectedDate, "yyyy-MM-dd") : ""}
          onChange={(e) => {
            const [y, m, d] = e.target.value.split("-").map(Number);
            setSelectedDate(new Date(y, m - 1, d));
          }}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm focus:border-amber-400 outline-none"
        />
        <span className="text-sm text-zinc-500">
          {loading ? "Loading…" : `${appointments.length} appointment${appointments.length !== 1 ? "s" : ""}`}
        </span>

        {/* Manual refresh */}
        <button
          onClick={() => selectedDate && fetchAppointments(selectedDate, true)}
          disabled={loading || refreshing || !selectedDate}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-50 disabled:opacity-40 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Live indicator */}
      <div className="flex items-center gap-1.5 px-6 py-2 bg-zinc-50 border-b border-zinc-100">
        <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-xs text-zinc-400">
          Live{lastUpdated ? ` · last updated ${format(lastUpdated, "HH:mm:ss")}` : ""}
        </span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-300" />
        </div>
      ) : appointments.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-400">
          No appointments for {selectedDate ? format(selectedDate, "d MMMM yyyy") : "today"}.
        </p>
      ) : (
        <div className="divide-y divide-zinc-100">
          {appointments.map((appt) => {
            const customer  = Array.isArray(appt.customer) ? appt.customer[0] : appt.customer;
            const barber    = Array.isArray(appt.barber)   ? appt.barber[0]   : appt.barber;
            const service   = Array.isArray(appt.service)  ? appt.service[0]  : appt.service;
            const addonNames = (appt.addons ?? [])
              .map((a) => (Array.isArray(a.service) ? a.service[0]?.name : a.service?.name))
              .filter(Boolean);

            return (
              <div
                key={appt.id}
                className="px-6 py-4 flex flex-col sm:flex-row sm:items-start gap-4 hover:bg-zinc-50/50 transition-colors"
              >
                {/* Time column */}
                <div className="shrink-0 w-16 text-center">
                  <p className="text-lg font-bold text-zinc-900 leading-tight">
                    {format(new Date(appt.appointment_time), "HH:mm")}
                  </p>
                  <p className="text-xs text-zinc-400">
                    –{format(new Date(appt.end_time), "HH:mm")}
                  </p>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-zinc-900">
                      {customer?.full_name ?? "Unknown Customer"}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[appt.status] ?? "bg-zinc-100 text-zinc-600"}`}>
                      {appt.status}
                    </span>
                  </div>

                  <p className="mt-0.5 text-sm text-zinc-600">
                    {service?.name ?? "—"}
                    {addonNames.length > 0 && (
                      <span className="text-zinc-400"> + {addonNames.join(", ")}</span>
                    )}
                  </p>

                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {barber?.full_name ?? "Unassigned"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {durationMins(appt)} min
                    </span>
                    <span className="font-medium text-zinc-600">
                      R{appt.total_price.toFixed(0)}
                    </span>
                    {customer?.phone_whatsapp && (
                      <span className="text-zinc-400">{customer.phone_whatsapp}</span>
                    )}
                  </div>
                </div>

                {/* Status actions */}
                {appt.status === "confirmed" || appt.status === "pending" ? (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => updateStatus(appt.id, "completed")}
                      className="flex items-center gap-1 rounded-lg bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-200 transition-colors"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Done
                    </button>
                    <button
                      onClick={() => updateStatus(appt.id, "no_show")}
                      className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      No-show
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
