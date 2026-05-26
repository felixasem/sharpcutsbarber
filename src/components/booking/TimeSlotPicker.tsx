"use client";

import { useEffect, useState, useCallback } from "react";
import { addMinutes, format, isToday, setHours, setMinutes, startOfDay } from "date-fns";
import { Loader2 } from "lucide-react";

interface TakenSlot {
  appointment_time: string;
  end_time: string;
}

interface Props {
  barberId: string | null;
  serviceDuration: number;
  selectedTime: Date | null;
  onSelect: (time: Date) => void;
}

const SHOP_OPEN_HOUR  = 8;
const SHOP_CLOSE_HOUR = 18;
const SLOT_INTERVAL   = 30;

function generateDaySlots(date: Date): Date[] {
  const slots: Date[] = [];
  let cursor = setMinutes(setHours(startOfDay(date), SHOP_OPEN_HOUR), 0);
  const end  = setMinutes(setHours(startOfDay(date), SHOP_CLOSE_HOUR), 0);
  while (cursor < end) {
    slots.push(new Date(cursor));
    cursor = addMinutes(cursor, SLOT_INTERVAL);
  }
  return slots;
}

function isSlotTaken(slot: Date, duration: number, taken: TakenSlot[]): boolean {
  const slotEnd = addMinutes(slot, duration);
  return taken.some((t) => {
    const ts = new Date(t.appointment_time);
    const te = new Date(t.end_time);
    return slot < te && slotEnd > ts;
  });
}

export function TimeSlotPicker({ barberId, serviceDuration, selectedTime, onSelect }: Props) {
  // null until client mounts — prevents SSR/hydration mismatch with new Date()
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dateRange,    setDateRange]    = useState<Date[]>([]);
  const [takenSlots,   setTakenSlots]  = useState<TakenSlot[]>([]);
  const [loading,      setLoading]     = useState(false);
  const [now,          setNow]         = useState<Date | null>(null);

  // Set all date-dependent state on the client only
  useEffect(() => {
    const today = startOfDay(new Date());
    const days  = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return startOfDay(d);
    });
    setSelectedDate(today);
    setDateRange(days);
    setNow(new Date());
  }, []);

  // Keep "now" updated so past-slot detection stays accurate
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const isPast = useCallback((slot: Date) => {
    if (!now) return false;
    return slot <= addMinutes(now, 30);
  }, [now]);

  const fetchTakenSlots = useCallback(async () => {
    if (!barberId || !selectedDate) return;
    setLoading(true);
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const res  = await fetch(`/api/bookings?barberId=${barberId}&date=${dateStr}`);
      const data = await res.json();
      setTakenSlots(data.takenSlots ?? []);
    } catch {
      setTakenSlots([]);
    } finally {
      setLoading(false);
    }
  }, [barberId, selectedDate]);

  useEffect(() => { fetchTakenSlots(); }, [fetchTakenSlots]);

  if (!barberId) {
    return (
      <p className="text-sm text-zinc-400 italic">
        Select a barber first to see available times.
      </p>
    );
  }

  // Show skeleton while client-side date state initialises
  if (!selectedDate || dateRange.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="font-semibold text-zinc-900">Pick a Date &amp; Time</h3>
        <div className="flex gap-2">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-16 w-14 rounded-xl bg-zinc-100 animate-pulse shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  const allSlots = generateDaySlots(selectedDate);

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-zinc-900">Pick a Date &amp; Time</h3>

      {/* Date strip */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {dateRange.map((day) => {
          const active = format(day, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd");
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => setSelectedDate(day)}
              className={[
                "flex shrink-0 flex-col items-center rounded-xl px-3 py-2 text-sm transition-all",
                active
                  ? "bg-amber-500 text-white shadow-md"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
              ].join(" ")}
            >
              <span className="text-xs font-medium uppercase tracking-wide">
                {isToday(day) ? "Today" : format(day, "EEE")}
              </span>
              <span className="text-lg font-bold leading-tight">{format(day, "d")}</span>
              <span className="text-xs opacity-80">{format(day, "MMM")}</span>
            </button>
          );
        })}
      </div>

      {/* Time grid */}
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {allSlots.map((slot) => {
            const taken    = isSlotTaken(slot, serviceDuration, takenSlots);
            const past     = isPast(slot);
            const disabled = taken || past;
            const active   =
              selectedTime &&
              format(selectedTime, "HH:mm")       === format(slot, "HH:mm") &&
              format(selectedTime, "yyyy-MM-dd")  === format(selectedDate, "yyyy-MM-dd");

            return (
              <button
                key={slot.toISOString()}
                type="button"
                disabled={disabled}
                onClick={() => {
                  const dt = new Date(selectedDate);
                  dt.setHours(slot.getHours(), slot.getMinutes(), 0, 0);
                  onSelect(dt);
                }}
                className={[
                  "rounded-lg py-2 text-sm font-medium transition-all",
                  disabled
                    ? "bg-zinc-100 text-zinc-300 cursor-not-allowed line-through"
                    : active
                    ? "bg-amber-500 text-white shadow-md ring-2 ring-amber-300 ring-offset-1"
                    : "bg-zinc-100 text-zinc-700 hover:bg-amber-100 hover:text-amber-700",
                ].join(" ")}
              >
                {format(slot, "HH:mm")}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
