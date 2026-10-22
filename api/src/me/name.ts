// First choice is the display name from sign up, then the part of the email before @.
// The profiles check allows 1 to 40 characters, counted as characters, not UTF 16 units.
export function nameFor(user: { displayName: string | null; email: string | null }): string {
  const raw = user.displayName?.trim() || user.email?.split("@")[0]?.trim() || "lifter";
  return Array.from(raw).slice(0, 40).join("") || "lifter";
}
