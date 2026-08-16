import { afterEach, describe, expect, it, vi } from "vitest";
import { isAdminUiPath } from "@/lib/admin/gate-path";
import {
  issueAdminGateToken,
  readAdminGateToken,
  verifyAdminGateToken,
} from "@/lib/admin/gate-token";
import { hashPasscode, verifyPasscodeHash } from "@/lib/admin/passcode-hash";
import { requiresSessionToken } from "@/lib/auth/protected-routes";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("hidden admin UI paths", () => {
  it("matches only the /admin page tree", () => {
    expect(isAdminUiPath("/admin")).toBe(true);
    expect(isAdminUiPath("/admin/")).toBe(true);
    expect(isAdminUiPath("/admin/settings")).toBe(true);
    expect(isAdminUiPath("/admin/models")).toBe(true);
    expect(isAdminUiPath("/")).toBe(false);
    expect(isAdminUiPath("/profile")).toBe(false);
    expect(isAdminUiPath("/administrator")).toBe(false);
    expect(isAdminUiPath("/api/admin/unlock")).toBe(false);
  });
});

describe("admin API session policy", () => {
  it("keeps unlock and gate anonymous and passcode session-gated", () => {
    expect(requiresSessionToken("/api/admin/unlock")).toBe(false);
    expect(requiresSessionToken("/api/admin/gate")).toBe(false);
    expect(requiresSessionToken("/api/admin/passcode")).toBe(true);
    expect(requiresSessionToken("/api/admin/analytics")).toBe(true);
  });
});

describe("encrypted admin gate token", () => {
  it("round-trips a payload and rejects garbage", async () => {
    vi.stubEnv("AUTH_SECRET", "test-admin-gate-secret-32chars-min");
    const token = await issueAdminGateToken(3);
    const payload = await readAdminGateToken(token);
    expect(payload?.v).toBe(3);
    expect(await verifyAdminGateToken(token)).toBe(true);
    expect(await verifyAdminGateToken("ag1.not-valid")).toBe(false);
    expect(await verifyAdminGateToken(undefined)).toBe(false);
  });
});

describe("master passcode hashing", () => {
  it("verifies bcrypt hashes and rejects misses", async () => {
    const hashed = await hashPasscode("correct-horse-battery");
    expect(hashed.startsWith("$2")).toBe(true);
    expect(await verifyPasscodeHash("correct-horse-battery", hashed)).toBe(true);
    expect(await verifyPasscodeHash("wrong-passcode", hashed)).toBe(false);
    expect(await verifyPasscodeHash("correct-horse-battery", null)).toBe(false);
  });
});
