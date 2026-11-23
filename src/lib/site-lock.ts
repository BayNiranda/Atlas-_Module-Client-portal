// Whole-site password while the website is not public yet (owner's request).
// The browser shows its own sign-in box; any username, this password.
// Remove SITE_PASSWORD (Vercel settings) to open the site to everyone.
export function siteLockAllows(authorization: string | null, password: string | undefined) {
  if (!password) return true; // no password set: site is public
  if (!authorization?.startsWith("Basic ")) return false;
  try {
    const decoded = atob(authorization.slice(6));
    return decoded.slice(decoded.indexOf(":") + 1) === password;
  } catch {
    return false; // not valid base64
  }
}
