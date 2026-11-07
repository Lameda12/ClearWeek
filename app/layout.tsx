import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClearWeek · Chloe’s schedule",
  description: "Review a scheduling conflict and create a follow-up task.",
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
