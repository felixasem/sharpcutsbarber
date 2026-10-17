"use client";

import { useRef, type ReactNode, type ElementType, type ComponentPropsWithoutRef } from "react";
import gsap from "gsap";

type MagneticButtonProps<T extends ElementType> = {
  as?: T;
  children: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

export default function MagneticButton<T extends ElementType = "button">({
  as,
  children,
  className,
  ...props
}: MagneticButtonProps<T>) {
  const ref = useRef<HTMLElement>(null);
  const Component = (as || "button") as ElementType;

  const handleMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || window.matchMedia("(pointer: coarse)").matches) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    gsap.to(el, { x: x * 0.35, y: y * 0.35, duration: 0.4, ease: "power3.out" });
  };

  const handleLeave = () => {
    const el = ref.current;
    if (!el) return;
    gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: "elastic.out(1, 0.4)" });
  };

  return (
    <Component
      ref={ref}
      data-cursor-hover
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      className={className}
      {...props}
    >
      {children}
    </Component>
  );
}
