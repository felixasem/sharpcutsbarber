export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-ink-950 px-6 py-8 sm:px-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-xs uppercase tracking-[0.3em] text-white/30 sm:flex-row">
        <p>© {new Date().getFullYear()} Maren Voss. All rights reserved.</p>
        <p>Designed &amp; built with Next.js, GSAP &amp; Three.js</p>
      </div>
    </footer>
  );
}
