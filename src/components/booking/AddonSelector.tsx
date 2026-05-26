"use client";

import { CheckCircle2, Circle, Plus, Sparkles } from "lucide-react";
import type { Service } from "@/types/database.types";

interface Props {
  addons: Service[];
  selectedIds: string[];
  onToggle: (addon: Service) => void;
}

export function AddonSelector({ addons, selectedIds, onToggle }: Props) {
  const activeAddons = addons.filter((a) => a.is_active);
  if (activeAddons.length === 0) return null;

  const totalAddonPrice = activeAddons
    .filter((a) => selectedIds.includes(a.id))
    .reduce((sum, a) => sum + a.price, 0);

  return (
    <div className="space-y-3">
      {/* Upsell header */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-amber-500" />
        <h3 className="font-semibold text-zinc-900">
          Elevate your visit
          <span className="ml-2 text-sm font-normal text-zinc-500">
            (optional add-ons)
          </span>
        </h3>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {activeAddons.map((addon) => {
          const selected = selectedIds.includes(addon.id);
          return (
            <button
              key={addon.id}
              type="button"
              onClick={() => onToggle(addon)}
              className={[
                "flex items-start gap-3 rounded-xl border-2 p-3 text-left transition-all",
                selected
                  ? "border-amber-400 bg-amber-50"
                  : "border-zinc-200 bg-white hover:border-zinc-300",
              ].join(" ")}
            >
              <div className="mt-0.5 shrink-0">
                {selected ? (
                  <CheckCircle2 className="h-5 w-5 text-amber-500" />
                ) : (
                  <Circle className="h-5 w-5 text-zinc-300" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-zinc-900 text-sm">
                    {addon.name}
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-amber-600">
                    +R{addon.price.toFixed(0)}
                  </span>
                </div>
                {addon.description && (
                  <p className="mt-0.5 text-xs text-zinc-500 leading-snug">
                    {addon.description}
                  </p>
                )}
                <p className="mt-1 text-xs text-zinc-400">
                  +{addon.duration_minutes} min
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {selectedIds.length > 0 && (
        <p className="text-right text-sm font-medium text-amber-700">
          Add-ons subtotal: R{totalAddonPrice.toFixed(0)}
        </p>
      )}
    </div>
  );
}
