import { describe, expect, it } from "vitest";
import {
  isAlreadyRegistered,
  isEmailNotConfirmed,
  isInvalidCredentials,
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
      "Email already registered"
    );
  });

  it("maps invalid credentials to a generic public message", () => {
    expect(
      isInvalidCredentials({ message: "Invalid login credentials" })
    ).toBe(true);
    expect(
      publicPasswordAuthError({ message: "Invalid login credentials" })
    ).toBe("Invalid email or password");
  });
});
