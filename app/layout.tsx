import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Jashn: plan the celebration, not just the ideas", template: "%s | Jashn" },
  description:
    "A GenAI celebration planner that turns a wedding, birthday or community event into a budget, a timeline and a vendor checklist, and re-plans when things change.",
  applicationName: "Jashn",
};

export const viewport: Viewport = { themeColor: "#7a1f4d", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Opts every page into per-request rendering so the CSP nonce set in proxy.ts
  // can be applied to Next.js's own scripts and styles. The pages are small
  // shells (the planner itself runs in the browser), so this costs very little.
  await connection();
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to main content
        </a>
        <div id="status" role="status" aria-live="polite" className="sr-only" />
        {children}
      </body>
    </html>
  );
}
