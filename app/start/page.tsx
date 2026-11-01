import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { Wizard } from "@/components/planner/Wizard";

export const metadata: Metadata = { title: "Plan your event" };

export default function StartPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="container narrow">
        <Wizard />
      </main>
    </>
  );
}
