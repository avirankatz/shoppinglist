import { describe, it, expect } from "vitest";
import { createInviteCode } from "../hooks/useListSync";

describe("createInviteCode", () => {
  it("returns a string", () => {
    expect(typeof createInviteCode()).toBe("string");
  });

  it("matches the XXX-XXX-XXX format (3 groups of 4 uppercase alphanumeric chars)", () => {
    const code = createInviteCode();
    expect(code).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  });

  it("generates unique codes on each call", () => {
    const codes = new Set(
      Array.from({ length: 100 }, () => createInviteCode()),
    );
    // Extremely unlikely to get a collision in 100 attempts
    expect(codes.size).toBe(100);
  });

  it("always produces uppercase output", () => {
    for (let i = 0; i < 20; i++) {
      const code = createInviteCode();
      expect(code).toBe(code.toUpperCase());
    }
  });
});
