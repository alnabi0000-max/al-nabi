import { describe, expect, it } from "vitest";
import { DEV_GUEST_EMAIL, isGuestEmail, isRealUserSession } from "@/lib/auth/guest";
import { isAuthExemptPath } from "@/lib/auth/public-pages";

describe("guest identity", () => {
  it("treats missing email and the dev guest address as guests", () => {
    expect(isGuestEmail(null)).toBe(true);
    expect(isGuestEmail("")).toBe(true);
    expect(isGuestEmail(DEV_GUEST_EMAIL)).toBe(true);
    expect(isGuestEmail("  DEV@alnabiy.local  ")).toBe(true);
    expect(isGuestEmail("creator@alnabiy.app")).toBe(false);
  });

  it("rejects guest and unauthenticated API payloads", () => {
    expect(
      isRealUserSession({ authenticated: true, guest: true, email: DEV_GUEST_EMAIL })
    ).toBe(false);
    expect(isRealUserSession({ authenticated: false, email: "a@b.co" })).toBe(
      false
    );
    expect(
      isRealUserSession({ authenticated: true, email: "creator@alnabiy.app" })
    ).toBe(true);
  });
});

describe("auth-exempt public pages", () => {
  it("allows legal and auth routes, not the studio", () => {
    expect(isAuthExemptPath("/privacy")).toBe(true);
    expect(isAuthExemptPath("/terms/")).toBe(true);
    expect(isAuthExemptPath("/refund-policy")).toBe(true);
    expect(isAuthExemptPath("/auth/reset")).toBe(true);
    expect(isAuthExemptPath("/admin/users")).toBe(true);
    expect(isAuthExemptPath("/")).toBe(false);
    expect(isAuthExemptPath("/generate")).toBe(false);
    expect(isAuthExemptPath("/pricing")).toBe(false);
  });
});
