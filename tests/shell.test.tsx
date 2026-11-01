/** @vitest-environment jsdom */
import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlannerShell } from "@/components/planner/PlannerShell";
import { __resetStoreForTests, startPlan } from "@/lib/client/store";
import { samplePlan } from "./helpers";

vi.mock("next/navigation", () => ({
  usePathname: () => "/plan",
}));

describe("PlannerShell", () => {
  beforeEach(() => {
    __resetStoreForTests();
    window.localStorage.clear();
  });

  it("shows empty state when no plan exists", () => {
    render(<PlannerShell><div>Content</div></PlannerShell>);
    expect(screen.getByRole("heading", { name: "No plan yet", level: 1 })).toBeInTheDocument();
  });

  it("renders navigation and child content when a plan is loaded", () => {
    startPlan(samplePlan("wedding"));
    render(<PlannerShell><div>Plan Child View</div></PlannerShell>);

    expect(screen.getByText("Plan Child View")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Budget" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Timeline" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Vendors" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ideas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change the plan" })).toBeInTheDocument();
  });

  it("opens change plan dialog when clicking Change the plan", () => {
    startPlan(samplePlan("wedding"));
    render(<PlannerShell><div>Plan Child View</div></PlannerShell>);

    const changeBtn = screen.getByRole("button", { name: "Change the plan" });
    fireEvent.click(changeBtn);

    expect(screen.getByRole("heading", { name: "Change the plan", level: 2 })).toBeInTheDocument();
  });
});
