import { describe, it, expect } from "vitest";
import { hasAppAccess, isMainAdmin } from "../src/lib/access";
describe("Fun Liga account access", () => {
  it("only the verified main-admin email has administrative bootstrap access", () => {
    expect(isMainAdmin("SANJIFILE@gmail.com")).toBe(true);
    expect(isMainAdmin("other@gmail.com")).toBe(false);
    expect(
      hasAppAccess({
        email: "sanjifile@gmail.com",
        email_confirmed_at: "2026-10-14",
      }),
    ).toBe(true);
    expect(hasAppAccess({ email: "sanjifile@gmail.com" })).toBe(false);
  });
  it("requires server-managed access and rejects public or unverified accounts", () => {
    expect(
      hasAppAccess({
        email: "approved@example.test",
        email_confirmed_at: "2026-10-14",
        app_metadata: { fun_liga_access: true },
      }),
    ).toBe(true);
    expect(
      hasAppAccess({
        email: "public@example.test",
        email_confirmed_at: "2026-10-14",
      }),
    ).toBe(false);
    expect(
      hasAppAccess({
        email: "public@example.test",
        email_confirmed_at: "2026-10-14",
        app_metadata: { fun_liga_access: "true" },
      }),
    ).toBe(false);
    expect(
      hasAppAccess({
        email: "unverified@example.test",
        app_metadata: { fun_liga_access: true },
      }),
    ).toBe(false);
    const forged = {
      email: "public@example.test",
      email_confirmed_at: "2026-10-14",
      user_metadata: { fun_liga_access: true, role: "admin" },
    };
    expect(hasAppAccess(forged)).toBe(false);
  });
});
