"use client";

import { ArrowUpRight } from "lucide-react";
import Reveal from "./Reveal";

const PROJECTS = [
  {
    title: "Aurora Health",
    category: "Telehealth · Mobile App",
    year: "2025",
    description:
      "A calmer way to manage chronic care — redesigned onboarding and care-team chat lifted retention by 38%.",
    gradient: "from-[#d6ff3f] via-[#7ee0b8] to-[#0b0c10]",
  },
  {
    title: "Fintra",
    category: "Banking · Web Platform",
    year: "2024",
    description:
      "A unified dashboard for SME finance teams, turning fragmented spreadsheets into a single source of truth.",
    gradient: "from-[#6d6dff] via-[#a78bfa] to-[#0b0c10]",
  },
  {
    title: "Lumen Studio",
    category: "E-commerce · Web",
    year: "2024",
    description:
      "A tactile shopping experience for an indie lighting brand — 3D product configurators and buttery transitions.",
    gradient: "from-[#ff8a3f] via-[#ff5f9e] to-[#0b0c10]",
  },
  {
    title: "Pulse",
    category: "Wearables · Mobile App",
    year: "2023",
    description:
      "Companion app for a fitness wearable, distilling dense biometric data into glanceable, motivating insights.",
    gradient: "from-[#3fe0ff] via-[#3f8aff] to-[#0b0c10]",
  },
  {
    title: "Northwind Analytics",
    category: "SaaS · Brand & UI System",
    year: "2023",
    description:
      "Full rebrand and design system overhaul for a B2B analytics platform used by 4,000+ teams worldwide.",
    gradient: "from-[#f5f5f0] via-[#d6ff3f] to-[#0b0c10]",
  },
];

export default function Work() {
  return (
    <section id="work" className="bg-ink-950 px-6 py-28 sm:px-10">
      <div className="mx-auto max-w-7xl">
        <Reveal className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="font-display text-4xl font-semibold uppercase tracking-tight text-[#f5f5f0] sm:text-6xl">
            Selected
            <br />
            Work
          </h2>
          <p className="max-w-sm text-white/50">
            A handful of recent collaborations spanning health, finance,
            commerce and consumer hardware — from 0&rarr;1 products to
            large-scale design systems.
          </p>
        </Reveal>

        <div className="mt-16 flex flex-col">
          {PROJECTS.map((project, index) => (
            <Reveal key={project.title} delay={index * 0.05}>
              <a
                href="#contact"
                data-cursor-hover
                className="group grid grid-cols-1 items-center gap-6 border-t border-white/10 py-8 last:border-b sm:grid-cols-12 sm:gap-8 sm:py-10"
              >
                <span className="font-display text-sm text-white/30 sm:col-span-1">
                  0{index + 1}
                </span>

                <div className="sm:col-span-4">
                  <h3 className="font-display text-3xl font-semibold tracking-tight text-[#f5f5f0] transition-colors group-hover:text-acid-400 sm:text-4xl">
                    {project.title}
                  </h3>
                  <p className="mt-2 text-sm uppercase tracking-widest text-white/40">
                    {project.category}
                  </p>
                </div>

                <p className="text-white/50 sm:col-span-5">
                  {project.description}
                </p>

                <div className="flex items-center justify-between sm:col-span-2 sm:justify-end sm:gap-6">
                  <span className="text-sm text-white/40">{project.year}</span>
                  <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 text-[#f5f5f0] transition-all duration-300 group-hover:rotate-45 group-hover:border-acid-400 group-hover:bg-acid-400 group-hover:text-ink-950">
                    <ArrowUpRight className="h-5 w-5" />
                  </span>
                </div>

                {/* Reveal gradient bar on hover */}
                <div
                  className={`pointer-events-none col-span-full h-0 overflow-hidden rounded-2xl bg-gradient-to-br opacity-0 transition-all duration-500 ease-out group-hover:mt-4 group-hover:h-40 group-hover:opacity-100 sm:group-hover:h-56 ${project.gradient}`}
                />
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
