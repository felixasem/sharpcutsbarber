"use client";

import { useEffect, useState } from "react";
import { Menu, X, ArrowUpRight } from "lucide-react";
import MagneticButton from "./MagneticButton";

const LINKS = [
  { href: "#work", label: "Work" },
  { href: "#about", label: "About" },
  { href: "#process", label: "Process" },
  { href: "#contact", label: "Contact" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleNavClick = () => setOpen(false);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-500 ${
        scrolled ? "bg-ink-950/80 backdrop-blur-md border-b border-white/5" : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 sm:px-10">
        <a
          href="#top"
          data-cursor-hover
          className="font-display text-lg font-semibold tracking-tight text-[#f5f5f0]"
        >
          MAREN&nbsp;VOSS<span className="text-acid-400">.</span>
        </a>

        <div className="hidden items-center gap-10 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              data-cursor-hover
              className="text-sm uppercase tracking-widest text-white/60 transition-colors hover:text-acid-400"
            >
              {link.label}
            </a>
          ))}
        </div>

        <MagneticButton
          as="a"
          href="#contact"
          className="hidden items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-[#f5f5f0] transition-colors hover:border-acid-400 hover:text-acid-400 md:inline-flex"
        >
          Start a project
          <ArrowUpRight className="h-4 w-4" />
        </MagneticButton>

        <button
          type="button"
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
          className="text-[#f5f5f0] md:hidden"
        >
          {open ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-white/10 bg-ink-950 px-6 py-8 md:hidden">
          <div className="flex flex-col gap-6">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={handleNavClick}
                className="font-display text-3xl tracking-tight text-[#f5f5f0]"
              >
                {link.label}
              </a>
            ))}
            <a
              href="#contact"
              onClick={handleNavClick}
              className="mt-2 inline-flex w-fit items-center gap-2 rounded-full bg-acid-400 px-6 py-3 text-sm font-semibold text-ink-950"
            >
              Start a project
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
