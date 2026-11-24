import { describe, expect, it } from "vitest";
import { parseDemoState } from "@/lib/demo-state";

describe("parseDemoState", () => {
  it("accepts each known state", () => {
    for (const id of ["default", "draft", "template", "error", "loading", "empty"]) expect(parseDemoState(id)).toBe(id);
  });
  it("ignores anything else", () => {
    for (const value of [undefined, "", "nope", ["draft"], "DRAFT"]) expect(parseDemoState(value as string)).toBeUndefined();
  });
});
