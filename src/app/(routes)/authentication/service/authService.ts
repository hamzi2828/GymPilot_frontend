const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export interface SignUpPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export async function signUp(payload: SignUpPayload) {
    console.log("payload", payload);

  const res = await fetch(`${API_BASE_URL}/user/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let msg = "Sign up failed";
    try {
      const err = await res.json();
      msg = err?.message || err?.error || msg;
    } catch {}
    throw new Error(msg);
  }

  return res.json();
}

export interface LoginPayload {
  email: string;
  password: string;
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
    email: string;
    role: 'user' | 'admin' | 'moderator';
  };
}

/** Second sign-in step: exchanges the emailed code for the token. */
export async function verifyTwoFactor(payload: { challengeId: string; code: string }): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE_URL}/user/login/2fa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || json?.error || 'Could not verify the code');
  return json;
}

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE_URL}/user/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let msg = 'Login failed';
    try {
      const err = await res.json();
      msg = err?.message || err?.error || msg;
    } catch {}
    throw new Error(msg);
  }

  return res.json();
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
  const res = await fetch(`${API_BASE_URL}/user/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(body?.message || body?.error || 'Could not send the reset email');
  }

  return body;
}

/**
 * Step two: exchange the token from the emailed link for a new password.
 */
export async function resetPassword(payload: {
  token: string;
  password: string;
}): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/user/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(body?.message || body?.error || 'Could not reset your password');
  }

  return body;
}
