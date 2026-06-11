"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import HeroScene from "./HeroScene";
import MagneticButton from "./MagneticButton";

const HEADLINE = ["Designing", "interfaces", "people", "remember."];

export default function Hero() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power4.out" } });

      tl.fromTo(
        ".hero-eyebrow",
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.8 }
      )
        .fromTo(
          ".hero-word",
          { opacity: 0, y: "100%" },
          { opacity: 1, y: "0%", duration: 1, stagger: 0.12 },
          "-=0.4"
        )
        .fromTo(
          ".hero-sub, .hero-cta, .hero-meta",
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, duration: 0.8, stagger: 0.1 },
          "-=0.5"
        );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="top"
      ref={containerRef}
      className="relative flex min-h-[100svh] flex-col justify-between overflow-hidden bg-ink-950 px-6 pb-10 pt-32 sm:px-10"
    >
      <HeroScene />

      {/* Gradient veil for legibility */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-ink-950/10 via-ink-950/40 to-ink-950" />

      <div className="mx-auto w-full max-w-7xl">
        <p className="hero-eyebrow flex items-center gap-3 text-sm uppercase tracking-[0.3em] text-white/50">
          <span className="h-px w-8 bg-acid-400" />
          Product &amp; UI/UX Designer — Based in Berlin
        </p>

        <h1 className="mt-6 font-display text-[14vw] font-semibold uppercase leading-[0.95] tracking-tight text-[#f5f5f0] sm:text-[8vw] lg:text-[6.5vw]">
          {HEADLINE.map((word, i) => (
            <span className="block overflow-hidden" key={word}>
              <span
                className={`hero-word inline-block ${
                  i === 1 ? "text-acid-400" : ""
                }`}
              >
                {word}
              </span>
            </span>
          ))}
        </h1>

        <div className="mt-10 flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-end">
          <p className="hero-sub max-w-md text-lg text-white/60">
            I help startups and scale-ups turn ambitious ideas into
            interfaces that feel inevitable — research-driven, pixel-perfect,
            and built to convert.
          </p>

          <MagneticButton
            as="a"
            href="#work"
            className="hero-cta inline-flex items-center gap-3 rounded-full bg-acid-400 px-8 py-4 text-base font-semibold text-ink-950 shadow-[0_0_40px_-10px_rgba(214,255,63,0.6)] transition-transform"
          >
            View Selected Work
            <ArrowUpRight className="h-5 w-5" />
          </MagneticButton>
        </div>
      </div>

      <div className="hero-meta mx-auto mt-16 flex w-full max-w-7xl items-center justify-between text-xs uppercase tracking-[0.3em] text-white/40">
        <span>Scroll to explore</span>
        <ArrowDown className="h-4 w-4 animate-bounce text-acid-400" />
        <span className="hidden sm:inline">2014 — 2026</span>
      </div>
    </section>
  );
}
