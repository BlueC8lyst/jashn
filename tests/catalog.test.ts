import { describe, expect, it } from "vitest";
import { CATEGORIES, CONTINGENCY_ID, categoryDef } from "@/lib/domain/catalog/categories";
import { TASKS } from "@/lib/domain/catalog/tasks";
import { VENDOR_TYPES, vendorTypeDef } from "@/lib/domain/catalog/vendors";
import { computeSchedule } from "@/lib/domain/schedule";
import { EVENT_TYPES } from "@/lib/domain/types";

describe.each(EVENT_TYPES)("catalogue integrity: %s", (type) => {
  const categories = CATEGORIES[type];
  const tasks = TASKS[type];
  const vendors = VENDOR_TYPES[type];

  it("category shares add up to exactly 100", () => {
    expect(categories.reduce((sum, def) => sum + def.share, 0)).toBe(100);
  });

  it("has unique category ids, a contingency buffer and sane sensitivities", () => {
    const ids = categories.map((def) => def.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(CONTINGENCY_ID);
    for (const def of categories) {
      expect(def.guestSensitivity).toBeGreaterThanOrEqual(0);
      expect(def.guestSensitivity).toBeLessThanOrEqual(1);
    }
  });

  it("has unique task ids and every dependency exists", () => {
    const ids = new Set(tasks.map((task) => task.id));
    expect(ids.size).toBe(tasks.length);
    for (const task of tasks) for (const dep of task.dependsOn) expect(ids.has(dep)).toBe(true);
  });

  it("task links point at real categories and vendor types", () => {
    const categoryIds = new Set(categories.map((def) => def.id));
    const vendorIds = new Set(vendors.map((def) => def.id));
    for (const task of tasks) {
      if (task.categoryId) expect(categoryIds.has(task.categoryId)).toBe(true);
      if (task.vendorTypeId) expect(vendorIds.has(task.vendorTypeId)).toBe(true);
    }
    for (const vendor of vendors) expect(categoryIds.has(vendor.categoryId)).toBe(true);
  });

  it("the graph is acyclic and its recommended lead times respect dependencies", () => {
    // computeSchedule throws on cycles; with plenty of time nothing may be at risk or overdue.
    const schedule = computeSchedule(tasks, { eventDate: "2027-12-31", today: "2026-10-27", progress: {} });
    expect(schedule.atRisk).toHaveLength(0);
    expect(schedule.overdue).toHaveLength(0);
    expect(schedule.compressed).toBe(false);
  });

  it("every vendor type has things to define and questions to ask", () => {
    for (const vendor of vendors) {
      expect(vendor.define.length).toBeGreaterThan(0);
      expect(vendor.ask.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("lookups return the right definitions and undefined for unknown ids", () => {
    expect(categoryDef(type, CONTINGENCY_ID)?.id).toBe(CONTINGENCY_ID);
    expect(categoryDef(type, "nope")).toBeUndefined();
    expect(vendorTypeDef(type, vendors[0]!.id)?.id).toBe(vendors[0]!.id);
    expect(vendorTypeDef(type, "nope")).toBeUndefined();
  });
});
