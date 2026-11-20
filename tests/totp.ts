import { createHmac } from "node:crypto";

// Computes an authenticator-app code (RFC 6238) so tests can pass staff MFA.
function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of input.replace(/=+$/, "").toUpperCase()) {
    const v = alphabet.indexOf(ch);
    if (v < 0) throw new Error(`Invalid base32 character: ${ch}`);
    bits += v.toString(2).padStart(5, "0");
  }
  const bytes = bits.match(/.{8}/g) ?? [];
  return Buffer.from(bytes.map((b) => parseInt(b, 2)));
}

export function totp(secret: Buffer | string, timeMs = Date.now(), digits = 6): string {
  const key = typeof secret === "string" ? base32Decode(secret) : secret;
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(timeMs / 1000 / 30)));
  const hmac = createHmac("sha1", key).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits;
  return String(code).padStart(digits, "0");
}
