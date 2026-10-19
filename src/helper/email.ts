// src/helper/email.ts
//
// Whether a typed address looks like an email address -- the API's own rule
// for contact enquiries and newsletter sign-ups, checked here first so the
// visitor is told beside the box. Deliberately loose: something before one
// "@", a domain after it, and a last part of two or more letters, so
// "jane@gym.info" and "sam@club.fitness" pass (the old check stopped at three
// letters). The mailbox itself is the real test. No backtracking pattern: a
// long string cannot stall it.

/** The longest address the mail standards allow. */
export const MAX_EMAIL_LENGTH = 254;

export function looksLikeEmail(value: string | null | undefined): boolean {
  const email = String(value ?? "").trim();
  if (!email || email.length > MAX_EMAIL_LENGTH) return false;
  if (/\s/.test(email)) return false;
  const at = email.indexOf("@");
  if (at < 1 || at !== email.lastIndexOf("@")) return false;
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf(".");
  // Something before the last dot, and two or more letters after it.
  if (dot < 1) return false;
  return /^[A-Za-z]{2,}$/.test(domain.slice(dot + 1));
}
