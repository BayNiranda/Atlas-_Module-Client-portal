import { describe, expect, it } from "vitest";
import { siteLockAllows } from "@/lib/site-lock";

const basic = (user: string, pass: string) => `Basic ${btoa(`${user}:${pass}`)}`;

describe("whole-site password", () => {
  it("lets everyone in when no password is set", () => {
    expect(siteLockAllows(null, undefined)).toBe(true);
    expect(siteLockAllows(null, "")).toBe(true);
  });

  it("asks for the password when one is set", () => {
    expect(siteLockAllows(null, "s3cret-pass")).toBe(false);
    expect(siteLockAllows("Bearer abc", "s3cret-pass")).toBe(false);
    expect(siteLockAllows("Basic not-base64!!", "s3cret-pass")).toBe(false);
    expect(siteLockAllows(basic("atlas", "wrong"), "s3cret-pass")).toBe(false);
  });

  it("accepts the right password with any username, even one with a colon in the password", () => {
    expect(siteLockAllows(basic("atlas", "s3cret-pass"), "s3cret-pass")).toBe(true);
    expect(siteLockAllows(basic("", "s3:cret"), "s3:cret")).toBe(true);
  });
});
