"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

/**
 * Custom dot + ring cursor that grows over interactive elements.
 * Hidden automatically on touch devices via CSS.
 */
export default function Cursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    if (window.matchMedia("(pointer: coarse)").matches) return;

    const moveDot = gsap.quickTo(dot, "x", { duration: 0.1, ease: "power3.out" });
    const moveDotY = gsap.quickTo(dot, "y", { duration: 0.1, ease: "power3.out" });
    const moveRing = gsap.quickTo(ring, "x", { duration: 0.4, ease: "power3.out" });
    const moveRingY = gsap.quickTo(ring, "y", { duration: 0.4, ease: "power3.out" });

    const handleMove = (e: PointerEvent) => {
      moveDot(e.clientX);
      moveDotY(e.clientY);
      moveRing(e.clientX);
      moveRingY(e.clientY);
    };

    const handleEnter = () => {
      gsap.to(ring, { scale: 2.4, opacity: 0.5, duration: 0.3, ease: "power2.out" });
      gsap.to(dot, { scale: 0, duration: 0.3, ease: "power2.out" });
    };
    const handleLeave = () => {
      gsap.to(ring, { scale: 1, opacity: 1, duration: 0.3, ease: "power2.out" });
      gsap.to(dot, { scale: 1, duration: 0.3, ease: "power2.out" });
    };

    window.addEventListener("pointermove", handleMove);

    const interactiveEls = document.querySelectorAll<HTMLElement>("[data-cursor-hover]");
    interactiveEls.forEach((el) => {
      el.addEventListener("mouseenter", handleEnter);
      el.addEventListener("mouseleave", handleLeave);
    });

    return () => {
      window.removeEventListener("pointermove", handleMove);
      interactiveEls.forEach((el) => {
        el.removeEventListener("mouseenter", handleEnter);
        el.removeEventListener("mouseleave", handleLeave);
      });
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] hidden md:block">
      <div
        ref={ringRef}
        className="fixed left-0 top-0 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border border-acid-400/70 mix-blend-difference"
      />
      <div
        ref={dotRef}
        className="fixed left-0 top-0 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-acid-400 mix-blend-difference"
      />
    </div>
  );
}
