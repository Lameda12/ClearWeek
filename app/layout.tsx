import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

// One family; the width axis separates headings from body. See docs/design-direction.md.
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });

export const metadata: Metadata = {
  title: "ClearWeek · Chloe’s schedule",
  description: "Review a scheduling conflict and create a follow-up task.",
};
export const viewport: Viewport = { themeColor: "#0c3a46" };

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={archivo.variable}><body>{children}</body></html>;
}
