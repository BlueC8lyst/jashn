/** @vitest-environment jsdom */
import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import IdeasPage from "@/app/plan/ideas/page";
import { __resetStoreForTests, getSnapshot, startPlan } from "@/lib/client/store";
import { samplePlan } from "./helpers";

describe("IdeasPage", () => {
  beforeEach(() => {
    __resetStoreForTests();
    window.localStorage.clear();
    startPlan(samplePlan("wedding"));
  });

  it("renders the ideas page and directions", () => {
    render(<IdeasPage />);
    expect(screen.getByRole("heading", { name: "Personalised Celebration Ideas", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Explore Concepts", level: 2 })).toBeInTheDocument();
  });

  it("toggles the personalisation editor and saves preferences", () => {
    render(<IdeasPage />);
    const editBtn = screen.getByRole("button", { name: "Edit preferences" });
    fireEvent.click(editBtn);

    expect(screen.getByText("Desired atmosphere")).toBeInTheDocument();
    const interestsInput = screen.getByLabelText("Interests and themes");
    fireEvent.change(interestsInput, { target: { value: "Eco-friendly, live music" } });

    const saveBtn = screen.getByRole("button", { name: "Save preferences" });
    fireEvent.click(saveBtn);

    const plan = getSnapshot();
    expect(plan?.brief.personalisation.interests).toBe("Eco-friendly, live music");
  });
});
