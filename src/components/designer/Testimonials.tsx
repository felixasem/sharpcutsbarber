"use client";

import { Quote } from "lucide-react";
import Reveal from "./Reveal";

const TESTIMONIALS = [
  {
    quote:
      "Maren didn't just redesign our app — she rebuilt how our whole team thinks about product decisions. Activation jumped 40% in the first month post-launch.",
    name: "Sofia Marchetti",
    role: "CEO, Aurora Health",
  },
  {
    quote:
      "The most thorough, thoughtful designer we've worked with. Every screen came with a rationale, and every rationale was backed by real user data.",
    name: "Devon Park",
    role: "Head of Product, Fintra",
  },
  {
    quote:
      "Our new site doesn't just look better — it converts better. Maren's eye for motion and detail gave the brand a personality customers actually remember.",
    name: "Lior Adler",
    role: "Founder, Lumen Studio",
  },
];

export default function Testimonials() {
  return (
    <section className="bg-ink-900 px-6 py-28 sm:px-10">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <p className="text-sm uppercase tracking-[0.3em] text-acid-400">
            Kind words
          </p>
          <h2 className="mt-6 max-w-2xl font-display text-4xl font-semibold uppercase tracking-tight text-[#f5f5f0] sm:text-5xl">
            Trusted by founders &amp; product teams.
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {TESTIMONIALS.map((t, index) => (
            <Reveal key={t.name} delay={index * 0.08}>
              <figure className="flex h-full flex-col justify-between gap-10 rounded-3xl border border-white/10 bg-ink-950 p-8">
                <Quote className="h-8 w-8 text-acid-400" />
                <blockquote className="text-lg text-white/70">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption>
                  <p className="font-display font-semibold text-[#f5f5f0]">
                    {t.name}
                  </p>
                  <p className="text-sm text-white/40">{t.role}</p>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
