"use client";

import Cursor from "./Cursor";
import Nav from "./Nav";
import Hero from "./Hero";
import Marquee from "./Marquee";
import Work from "./Work";
import About from "./About";
import Process from "./Process";
import Testimonials from "./Testimonials";
import Contact from "./Contact";
import Footer from "./Footer";

const SKILLS = [
  "UX Research",
  "Interaction Design",
  "Design Systems",
  "Prototyping",
  "Figma",
  "Branding",
  "Motion Design",
  "Accessibility",
];

const RECOGNITION = [
  "Awwwards — Site of the Day",
  "CSS Design Awards — Best UI",
  "FWA — Mobile Excellence",
  "Webby Honoree",
  "Dribbble — Featured Shot",
];

export default function Portfolio() {
  return (
    <div className="designer-page bg-ink-950 font-sans text-[#f5f5f0]">
      <Cursor />
      <Nav />
      <main>
        <Hero />
        <Marquee items={SKILLS} />
        <Work />
        <About />
        <Process />
        <Marquee items={RECOGNITION} reverse />
        <Testimonials />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
