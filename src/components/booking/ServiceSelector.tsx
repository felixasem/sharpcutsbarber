"use client";

import { Clock, DollarSign } from "lucide-react";
import type { Service } from "@/types/database.types";

interface Props {
  services: Service[];
  selectedId: string | null;
  onSelect: (service: Service) => void;
}

export function ServiceSelector({ services, selectedId, onSelect }: Props) {
  const coreServices = services.filter((s) => !s.is_addon && s.is_active);

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-zinc-900">Choose a Service</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {coreServices.map((service) => {
          const selected = selectedId === service.id;
          return (
            <button
              key={service.id}
              type="button"
              onClick={() => onSelect(service)}
              className={[
                "group flex flex-col gap-2 rounded-xl border-2 p-4 text-left transition-all",
                selected
                  ? "border-amber-500 bg-amber-50 ring-2 ring-amber-300 ring-offset-1"
                  : "border-zinc-200 bg-white hover:border-amber-300 hover:bg-amber-50/50",
              ].join(" ")}
            >
              <span className="font-medium text-zinc-900">{service.name}</span>
              {service.description && (
                <span className="text-sm text-zinc-500 leading-snug">
                  {service.description}
                </span>
              )}
              <div className="mt-auto flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1 font-semibold text-amber-600">
                  <DollarSign className="h-3.5 w-3.5" />
                  R{service.price.toFixed(0)}
                </span>
                <span className="flex items-center gap-1 text-zinc-400">
                  <Clock className="h-3.5 w-3.5" />
                  {service.duration_minutes} min
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
