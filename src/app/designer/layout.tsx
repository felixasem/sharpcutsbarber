import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Maren Voss — Product & UI/UX Designer",
  description:
    "Portfolio of Maren Voss, a product & UI/UX designer crafting bold, tactile digital experiences for ambitious brands.",
};

export default function DesignerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={`${display.variable} font-sans`}>{children}</div>;
}
