import { describe, expect, it } from "vitest";
import {
  isAlreadyRegistered,
  isEmailNotConfirmed,
  isInvalidCredentials,
  localizeAuthError,
  publicAuthMessageKey,
  PUBLIC_AUTH_ERRORS,
  publicPasswordAuthError,
} from "@/lib/auth/password-errors";

describe("password auth error mapping", () => {
  it("detects unconfirmed email from GoTrue", () => {
    expect(
      isEmailNotConfirmed({ code: "email_not_confirmed", message: "Email not confirmed" })
    ).toBe(true);
    expect(isEmailNotConfirmed({ message: "Invalid login credentials" })).toBe(
      false
    );
  });

  it("detects duplicate sign-up without leaking internals", () => {
    expect(
      isAlreadyRegistered({ message: "User already registered" })
    ).toBe(true);
    expect(publicPasswordAuthError({ message: "User already registered" })).toBe(
      PUBLIC_AUTH_ERRORS.taken
    );
  });

  it("maps invalid credentials to a generic public message", () => {
    expect(
      isInvalidCredentials({ message: "Invalid login credentials" })
    ).toBe(true);
    expect(
      publicPasswordAuthError({ message: "Invalid login credentials" })
    ).toBe(PUBLIC_AUTH_ERRORS.invalid);
  });

  it("never echoes raw GoTrue internals", () => {
    expect(
      publicPasswordAuthError({
        message: "Database error querying schema",
        code: "unexpected_failure",
      })
    ).toBe(PUBLIC_AUTH_ERRORS.failed);
  });

  it("maps public API strings onto locale keys", () => {
    expect(publicAuthMessageKey(PUBLIC_AUTH_ERRORS.taken)).toBe(
      "auth_email_taken"
    );
    expect(publicAuthMessageKey(PUBLIC_AUTH_ERRORS.invalid)).toBe(
      "auth_invalid_credentials"
    );
    expect(publicAuthMessageKey(PUBLIC_AUTH_ERRORS.rateLimited)).toBe(
      "auth_rate_limited"
    );
    expect(publicAuthMessageKey("ACCOUNT PERMANENTLY BANNED")).toBe(
      "bannedTitle"
    );
    expect(localizeAuthError(PUBLIC_AUTH_ERRORS.taken, (k) => `T:${k}`)).toBe(
      "T:auth_email_taken"
    );
  });
});
