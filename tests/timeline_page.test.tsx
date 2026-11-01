/** @vitest-environment jsdom */
import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import TimelinePage from "@/app/plan/timeline/page";
import { __resetStoreForTests, getSnapshot, startPlan } from "@/lib/client/store";
import { samplePlan } from "./helpers";

describe("TimelinePage", () => {
  beforeEach(() => {
    __resetStoreForTests();
    window.localStorage.clear();
    startPlan(samplePlan("wedding"));
  });

  it("renders scheduled timeline tasks grouped by status", () => {
    render(<TimelinePage />);
    expect(screen.getByRole("heading", { name: "Timeline", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Coming up in the next 30 days")).toBeInTheDocument();
  });

  it("allows marking a task as done", () => {
    render(<TimelinePage />);
    const doneButtons = screen.getAllByRole("button", { name: /^Mark done/ });
    expect(doneButtons.length).toBeGreaterThan(0);

    fireEvent.click(doneButtons[0]!);

    const plan = getSnapshot();
    const doneTasks = Object.values(plan?.progress ?? {}).filter((p) => p.status === "done");
    expect(doneTasks.length).toBe(1);
  });
});
