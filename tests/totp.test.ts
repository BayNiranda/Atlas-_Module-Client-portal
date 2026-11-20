import { describe, expect, it } from "vitest";
import { totp } from "./totp";

describe("totp helper", () => {
  it("matches the RFC 6238 test vector", () => {
    // Secret "12345678901234567890", time 59s -> 94287082 (8 digits).
    expect(totp(Buffer.from("12345678901234567890"), 59_000, 8)).toBe("94287082");
  });
  it("decodes base32 secrets", () => {
    // Same secret in base32.
    expect(totp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 59_000, 8)).toBe("94287082");
  });
});
