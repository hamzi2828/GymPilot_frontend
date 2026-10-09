const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

// What the screen says when the request never got an answer. The browser's own
// wording for this is "Failed to fetch", which tells a person nothing they can
// act on.
const UNREACHABLE = "We can't reach the server right now. Check your internet connection and try again.";
const NO_ANSWER = "The server didn't answer properly. Please try again in a moment.";

/**
 * One POST to the API, answered with JSON. Throws an Error whose message is
 * fit to show as-is: the server's own sentence when it sent one, otherwise
 * `fallback` (or, for a network failure or a gateway error page, the two
 * sentences above).
 */
async function post<T>(path: string, body: unknown, fallback: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(UNREACHABLE);
  }

  // A proxy's error page is HTML, not JSON; it is not a message for people.
  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const message = (json && (json.message || json.error)) as string | undefined;
    throw new Error(typeof message === "string" && message ? message : res.status >= 500 ? NO_ANSWER : fallback);
  }
  if (!json || typeof json !== "object") throw new Error(NO_ANSWER);
  return json as T;
}

export interface SignUpPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export async function signUp(payload: SignUpPayload) {
  // `emailVerified` is false on a new account: the API emails a link to confirm the address.
  return post<{ message?: string; data?: { emailVerified?: boolean } }>("/user/signup", payload, "Sign up failed");
}

export interface LoginPayload {
  /** What was typed into "Email or username": the API accepts either. */
  email: string;
  password: string;
  /** "Remember me": the API issues a 30-day session instead of 7 days. */
  remember?: boolean;
}

export interface LoginResponse {
  message: string;
  token: string;
  /** Set when a second step is required; no token is issued yet. */
  requires2fa?: boolean;
  challengeId?: string;
  data: {
    _id: string;
    firstName: string;
    lastName: string;
    /** Absent for an account that signs in by username. */
    email?: string;
    /** The slug of the account's role: "user", "admin", or one the gym made. */
    role: string;
  };
}

// A sign-in answer is either a token or a second step. Anything else is the
// server not answering properly, and must not be stored as a session.
function checked(res: LoginResponse): LoginResponse {
  if (res.token || (res.requires2fa && res.challengeId)) return res;
  throw new Error(NO_ANSWER);
}

/** Second sign-in step: exchanges the emailed code for the token. */
export async function verifyTwoFactor(payload: { challengeId: string; code: string }): Promise<LoginResponse> {
  return checked(await post<LoginResponse>("/user/login/2fa", payload, "Could not verify the code"));
}

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  return checked(await post<LoginResponse>("/user/login", payload, "Login failed"));
}

/**
 * Step one of a password reset: ask the server to email a one-time link.
 *
 * The reply is deliberately the same whether or not the address has an
 * account — the server will not confirm who is a member — so the message it
 * returns is what should be shown to the user verbatim. Do not "improve" it
 * into "check your inbox", which would imply an email was definitely sent.
 */
export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  return post<{ message: string }>("/user/forgot-password", { email }, "Could not send the reset email");
}

/**
 * Step two: exchange the token from the emailed link for a new password.
 */
export async function resetPassword(payload: {
  token: string;
  password: string;
}): Promise<{ message: string }> {
  return post<{ message: string }>("/user/reset-password", payload, "Could not reset your password");
}
