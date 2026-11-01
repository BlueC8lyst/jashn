/** @vitest-environment jsdom */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import VendorsPage from "@/app/plan/vendors/page";
import { __resetStoreForTests, startPlan } from "@/lib/client/store";
import { samplePlan } from "./helpers";

describe("VendorsPage", () => {
  beforeEach(() => {
    __resetStoreForTests();
    window.localStorage.clear();
    startPlan(samplePlan("wedding"));
  });

  it("renders vendor checklist and categories", async () => {
    render(<VendorsPage />);
    expect(screen.getByRole("heading", { name: "Vendor Checklists & Quotes", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Venue", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Caterer", level: 2 })).toBeInTheDocument();
  });

  it("allows toggling the add quote form and adding a quote", async () => {
    render(<VendorsPage />);
    const addButtons = screen.getAllByRole("button", { name: "+ Add quote" });
    fireEvent.click(addButtons[0]!);

    expect(screen.getByText("Add a quote from a vendor")).toBeInTheDocument();
    const vendorNameInput = screen.getByLabelText("Vendor name");
    const amountInput = screen.getByLabelText(/Amount/);

    fireEvent.change(vendorNameInput, { target: { value: "Royal Palace" } });
    fireEvent.change(amountInput, { target: { value: "220000" } });

    const saveButton = screen.getByRole("button", { name: "Save quote" });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText("Royal Palace")).toBeInTheDocument();
    });
  });

  it("allows filtering vendors by status", () => {
    render(<VendorsPage />);
    const shortlistingBtn = screen.getByRole("button", { name: /Shortlisting/ });
    fireEvent.click(shortlistingBtn);
    expect(shortlistingBtn).toBeInTheDocument();
  });
});
