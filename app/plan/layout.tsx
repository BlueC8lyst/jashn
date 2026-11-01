import type { ReactNode } from "react";
import { PlannerShell } from "@/components/planner/PlannerShell";

export default function PlanLayout({ children }: { children: ReactNode }) {
  return <PlannerShell>{children}</PlannerShell>;
}
