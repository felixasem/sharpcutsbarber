"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

export default function Marquee({
  items,
  reverse = false,
}: {
  items: string[];
  reverse?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const distance = track.scrollWidth / 2;
    const tween = gsap.fromTo(
      track,
      { x: reverse ? -distance : 0 },
      {
        x: reverse ? 0 : -distance,
        duration: 32,
        ease: "none",
        repeat: -1,
      }
    );

    return () => {
      tween.kill();
    };
  }, [reverse]);

  return (
    <div className="overflow-hidden border-y border-white/10 bg-ink-900 py-5">
      <div ref={trackRef} className="flex w-max items-center gap-10 whitespace-nowrap will-change-transform">
        {[...items, ...items].map((item, i) => (
          <span
            key={i}
            className="flex items-center gap-10 font-display text-2xl sm:text-3xl uppercase tracking-tight text-white/70"
          >
            {item}
            <span className="text-acid-400">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
