"use client";

import Reveal from "./Reveal";

const STEPS = [
  {
    number: "01",
    title: "Discover",
    description:
      "Stakeholder interviews, user research and competitive audits to uncover the real problem worth solving.",
  },
  {
    number: "02",
    title: "Define",
    description:
      "Information architecture, user flows and journey maps that turn insight into a clear, shared direction.",
  },
  {
    number: "03",
    title: "Design",
    description:
      "High-fidelity UI, interactive prototypes and design systems — refined through rapid rounds of testing.",
  },
  {
    number: "04",
    title: "Deliver",
    description:
      "Pixel-accurate handoff, motion specs and close collaboration with engineering through to launch.",
  },
];

export default function Process() {
  return (
    <section id="process" className="bg-ink-950 px-6 py-28 sm:px-10">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <p className="text-sm uppercase tracking-[0.3em] text-acid-400">
            How I work
          </p>
          <h2 className="mt-6 max-w-2xl font-display text-4xl font-semibold uppercase tracking-tight text-[#f5f5f0] sm:text-5xl">
            A process built for clarity, not just deliverables.
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-px overflow-hidden rounded-3xl bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <Reveal key={step.number} delay={index * 0.08}>
              <div className="group relative flex h-full flex-col justify-between gap-12 bg-ink-900 p-8 transition-colors duration-300 hover:bg-ink-800">
                <span className="font-display text-sm text-white/30 transition-colors group-hover:text-acid-400">
                  {step.number}
                </span>
                <div>
                  <h3 className="font-display text-2xl font-semibold tracking-tight text-[#f5f5f0]">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm text-white/50">
                    {step.description}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
