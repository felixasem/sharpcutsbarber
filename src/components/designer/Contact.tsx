"use client";

import { ArrowUpRight } from "lucide-react";
import Reveal from "./Reveal";
import MagneticButton from "./MagneticButton";

const SOCIALS = [
  { label: "LinkedIn", href: "#" },
  { label: "Dribbble", href: "#" },
  { label: "Instagram", href: "#" },
  { label: "Read.cv", href: "#" },
];

export default function Contact() {
  return (
    <section id="contact" className="relative overflow-hidden bg-ink-950 px-6 py-28 sm:px-10">
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[40rem] w-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-acid-400/10 blur-[120px]" />

      <div className="mx-auto max-w-7xl text-center">
        <Reveal>
          <p className="text-sm uppercase tracking-[0.3em] text-acid-400">
            Let&apos;s work together
          </p>
          <h2 className="mx-auto mt-6 max-w-4xl font-display text-5xl font-semibold uppercase leading-[1.05] tracking-tight text-[#f5f5f0] sm:text-7xl">
            Got a product that needs a great interface?
          </h2>
        </Reveal>

        <Reveal delay={0.1}>
          <MagneticButton
            as="a"
            href="mailto:hello@marenvoss.design"
            className="mt-12 inline-flex items-center gap-3 rounded-full bg-acid-400 px-10 py-5 text-lg font-semibold text-ink-950 shadow-[0_0_60px_-15px_rgba(214,255,63,0.7)]"
          >
            hello@marenvoss.design
            <ArrowUpRight className="h-5 w-5" />
          </MagneticButton>
        </Reveal>

        <Reveal delay={0.2}>
          <div className="mt-16 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {SOCIALS.map((social) => (
              <a
                key={social.label}
                href={social.href}
                data-cursor-hover
                className="text-sm uppercase tracking-widest text-white/50 transition-colors hover:text-acid-400"
              >
                {social.label}
              </a>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
