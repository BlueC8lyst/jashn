/** @vitest-environment jsdom */
import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import BudgetPage from "@/app/plan/budget/page";
import { __resetStoreForTests, getSnapshot, startPlan } from "@/lib/client/store";
import { samplePlan } from "./helpers";

describe("BudgetPage", () => {
  beforeEach(() => {
    __resetStoreForTests();
    window.localStorage.clear();
    startPlan(samplePlan("wedding"));
  });

  it("renders budget allocation table and headroom", () => {
    render(<BudgetPage />);
    expect(screen.getByRole("heading", { name: "Budget", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Budget by category")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What if…?", level: 2 })).toBeInTheDocument();
  });

  it("allows changing category priority and rebalancing", () => {
    render(<BudgetPage />);
    const selects = screen.getAllByRole("combobox");
    expect(selects.length).toBeGreaterThan(0);

    fireEvent.change(selects[0]!, { target: { value: "flexible" } });
    const plan = getSnapshot();
    expect(plan?.allocations[0]!.priority).toBe("flexible");
  });
});
