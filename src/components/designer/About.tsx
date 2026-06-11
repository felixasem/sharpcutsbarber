"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Reveal from "./Reveal";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const STATS = [
  { value: 11, suffix: "+", label: "Years of experience" },
  { value: 64, suffix: "", label: "Projects shipped" },
  { value: 12, suffix: "", label: "Industry awards" },
  { value: 28, suffix: "M", label: "Users reached" },
];

export default function About() {
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = statsRef.current;
    if (!root) return;

    const counters = root.querySelectorAll<HTMLElement>("[data-counter]");
    const ctx = gsap.context(() => {
      counters.forEach((el) => {
        const target = Number(el.dataset.counter);
        const counter = { value: 0 };
        gsap.to(counter, {
          value: target,
          duration: 1.6,
          ease: "power2.out",
          scrollTrigger: {
            trigger: root,
            start: "top 80%",
          },
          onUpdate: () => {
            el.textContent = Math.ceil(counter.value).toString();
          },
        });
      });
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <section id="about" className="bg-ink-900 px-6 py-28 sm:px-10">
      <div className="mx-auto grid max-w-7xl gap-16 lg:grid-cols-12">
        <Reveal className="lg:col-span-5">
          <p className="text-sm uppercase tracking-[0.3em] text-acid-400">
            About
          </p>
          <h2 className="mt-6 font-display text-4xl font-semibold uppercase tracking-tight text-[#f5f5f0] sm:text-5xl">
            Curiosity-led design, grounded in craft.
          </h2>
        </Reveal>

        <Reveal delay={0.1} className="flex flex-col gap-6 text-lg text-white/60 lg:col-span-4">
          <p>
            I&apos;m Maren — a product designer who started out building
            websites in a dorm room and now leads end-to-end design for
            funded startups across health, fintech and consumer tech.
          </p>
          <p>
            My process blends rigorous research with a deep love of
            typography, motion and detail. I sweat the 2px paddings so your
            users don&apos;t have to think about anything at all.
          </p>
          <p>
            When I&apos;m not in Figma, I&apos;m teaching a UX workshop,
            collecting vinyl, or chasing the best flat white in Berlin.
          </p>
        </Reveal>

        <Reveal delay={0.2} className="lg:col-span-3">
          <div ref={statsRef} className="grid grid-cols-2 gap-8">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <p className="font-display text-4xl font-semibold text-acid-400 sm:text-5xl">
                  <span data-counter={stat.value}>0</span>
                  {stat.suffix}
                </p>
                <p className="mt-2 text-sm text-white/50">{stat.label}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
