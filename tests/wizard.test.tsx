/** @vitest-environment jsdom */
import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Wizard } from "@/components/planner/Wizard";
import { __resetStoreForTests, getSnapshot } from "@/lib/client/store";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("Wizard", () => {
  beforeEach(() => {
    __resetStoreForTests();
    window.localStorage.clear();
    mockPush.mockClear();
  });

  it("completes the wizard and starts a new plan", () => {
    render(<Wizard />);
    expect(screen.getByRole("heading", { name: "Occasion", level: 2 })).toBeInTheDocument();

    const titleInput = screen.getByLabelText("Event name");
    const dateInput = screen.getByLabelText("Event date");
    fireEvent.change(titleInput, { target: { value: "Aarav's 1st Birthday" } });
    fireEvent.change(dateInput, { target: { value: "2027-05-15" } });

    const continueBtn = screen.getByRole("button", { name: "Continue" });
    fireEvent.click(continueBtn);

    // Step 1: Budget and guests
    expect(screen.getByRole("heading", { name: "Budget and guests", level: 2 })).toBeInTheDocument();
    const budgetInput = screen.getByLabelText("Total budget");
    const guestsInput = screen.getByLabelText("Number of guests");

    fireEvent.change(budgetInput, { target: { value: "150000" } });
    fireEvent.change(guestsInput, { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    // Step 2: What matters most
    expect(screen.getByRole("heading", { name: "What matters most", level: 2 })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    // Step 3: Personal touches
    expect(screen.getByRole("heading", { name: "Personal touches", level: 2 })).toBeInTheDocument();
    const createBtn = screen.getByRole("button", { name: "Create my plan" });
    fireEvent.click(createBtn);

    const plan = getSnapshot();
    expect(plan?.brief.title).toBe("Aarav's 1st Birthday");
    expect(plan?.brief.budget).toBe(150000);
    expect(plan?.brief.guests).toBe(50);
    expect(mockPush).toHaveBeenCalledWith("/plan");
  });
});
