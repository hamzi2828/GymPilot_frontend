// src/helper/helper.ts

// JWT payload base fields
export interface JwtBasePayload {
    iat?: number;
    exp?: number;
  }
  
  // Payload we issued from the backend. Only `id` is always there: an account
  // the front desk created to sign in by username has no email, and its token
  // carries none.
  export interface UserPayload extends JwtBasePayload {
    id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    role?: string;
  }
  
  const TOKEN_KEY = 'auth_token';
  const ROLE_KEY = 'auth_role';
  
  function base64UrlDecode(input: string): string {
    // base64url -> base64
    const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
    // pad with =
    const pad = b64.length % 4 ? 4 - (b64.length % 4) : 0;
    const b64Padded = b64 + '='.repeat(pad);
    if (typeof window === 'undefined') {
      // SSR-safe
      return Buffer.from(b64Padded, 'base64').toString('utf8');
    }
    return decodeURIComponent(
      Array.prototype.map
        .call(atob(b64Padded), (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  }
  
  export function decodeJwt<T = unknown>(token: string): T | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payloadJson = base64UrlDecode(parts[1]);
      return JSON.parse(payloadJson) as T;
    } catch {
      return null;
    }
  }
  
  export function getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  }
  
  export function getUserFromToken(token: string): UserPayload | null {
    const payload = decodeJwt<UserPayload>(token);
    if (!payload) return null;
    // Check expiration if present
    if (payload.exp && Date.now() >= payload.exp * 1000) return null;
    // The id is what identifies a session. An email is optional (see
    // UserPayload), so requiring one here signed those accounts out.
    if (!payload.id) return null;
    return payload;
  }
  
  export function getCurrentUser(): UserPayload | null {
    const token = getAuthToken();
    if (!token) return null;
    return getUserFromToken(token);
  }
  
  export function isAuthenticated(): boolean {
    return !!getCurrentUser();
  }
  
  export function getAuthHeader(): Record<string, string> {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // The cookies live as long as the token itself (7 days, or 30 with "Remember
  // me"). As session cookies they vanished when the browser closed while the
  // token stayed in localStorage, so the middleware sent a still-signed-in
  // member back to the sign-in page.
  function cookieLifetime(token: string | null): string {
    const exp = token ? decodeJwt<JwtBasePayload>(token)?.exp : undefined;
    if (!exp) return '';
    const seconds = Math.floor(exp - Date.now() / 1000);
    return seconds > 0 ? `; max-age=${seconds}` : '';
  }

  // Shared by every cookie this file writes or clears. `secure` on https, so
  // the session cookie is never sent over a plain connection; left off on
  // http (local development), where a Secure cookie would not be stored.
  function cookieScope(): string {
    const secure = typeof window !== 'undefined' && window.location.protocol === 'https:';
    return `; path=/; samesite=lax${secure ? '; secure' : ''}`;
  }

  // Set token in localStorage and cookie so middleware can read it
  export function setToken(token: string) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TOKEN_KEY, token);
    try {
      document.cookie = `${TOKEN_KEY}=${encodeURIComponent(token)}${cookieScope()}${cookieLifetime(token)}`;
    } catch {}
  }

  // Remove token from both localStorage and cookie
  export function removeToken() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
    try {
      document.cookie = `${TOKEN_KEY}=; Max-Age=0${cookieScope()}`;
      document.cookie = `${ROLE_KEY}=; Max-Age=0${cookieScope()}`;
    } catch {}
  }

  /** Whether the cookie the route guard (src/middleware.ts) looks for is there. */
  export function hasSessionCookie(): boolean {
    if (typeof document === 'undefined') return false;
    try {
      return document.cookie.split(';').some((part) => part.trim().startsWith(`${TOKEN_KEY}=`) && part.trim().length > TOKEN_KEY.length + 1);
    } catch {
      return false;
    }
  }

  /**
   * Puts the session cookie back for someone who is still signed in but has
   * lost it -- a sign-in from before the cookie outlived the browser window,
   * or a browser that cleared cookies and kept localStorage. The route guard
   * only sees the cookie, so without this it would send a signed-in person to
   * the sign-in page. True only when a live session now has its cookie.
   */
  export function restoreSessionCookie(): boolean {
    const token = getAuthToken();
    const user = token ? getUserFromToken(token) : null;
    if (!token || !user) return false;
    if (hasSessionCookie()) return true;
    setToken(token);
    const role = getRole() || user.role;
    if (role) setRole(role);
    return hasSessionCookie();
  }

  /**
   * A `redirect` value that is safe to navigate to: a path on this site and
   * nothing else. Rejected: absolute and protocol-relative URLs, anything with
   * a backslash (browsers read "/\evil.com" as "//evil.com") or a control
   * character (dropped while parsing, turning "/<tab>/evil.com" into the
   * same), and the sign-in page itself.
   */
  export function safeRedirect(value: string | null | undefined): string | null {
    if (!value) return null;
    if (/[\\\u0000-\u001f\u007f]/.test(value)) return null;
    if (!value.startsWith('/') || value.startsWith('//')) return null;
    try {
      // Resolved against a made-up origin: whatever still has that origin is
      // a path of ours, on the server as much as in the browser.
      const base = 'http://same-site.invalid';
      const url = new URL(value, base);
      if (url.origin !== base) return null;
      // Dot segments are resolved by now, and "/..//evil.com" has become
      // "//evil.com" -- off this site again.
      if (url.pathname.startsWith('//')) return null;
      if (url.pathname === '/authentication' || url.pathname.startsWith('/authentication/')) return null;
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return null;
    }
  }

  /**
   * The sign-in page, set to bring the person back afterwards -- to `returnTo`,
   * or to the page the browser is on.
   */
  export function signInUrl(returnTo?: string): string {
    const here = typeof window === 'undefined' ? '' : `${window.location.pathname}${window.location.search}`;
    const back = safeRedirect(returnTo ?? here);
    return back && back !== '/' ? `/authentication?redirect=${encodeURIComponent(back)}` : '/authentication';
  }

  // Fetch with Authorization header when token is present
  export async function authorizedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
    const token = getAuthToken();
    const headers = new Headers(init.headers || {});
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  }

  // Role helpers for admin gating in frontend and middleware.
  //
  // A role is the slug of a Role document, so this is a string rather than a
  // union: a gym can create "night-manager" without a frontend release. The
  // two reserved slugs are 'user' (every gym member) and 'admin' (all access).
  export type UserRole = string;

  export function getRole(): UserRole | null {
    if (typeof window === 'undefined') return null;
    const role = localStorage.getItem(ROLE_KEY) as UserRole | null;
    return role ?? null;
  }

  export function setRole(role: UserRole) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(ROLE_KEY, role);
    try {
      // Same lifetime as the token set just before it (see cookieLifetime).
      document.cookie = `${ROLE_KEY}=${encodeURIComponent(role)}${cookieScope()}${cookieLifetime(getAuthToken())}`;
    } catch {}
  }

  export function removeRole() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(ROLE_KEY);
    try {
      document.cookie = `${ROLE_KEY}=; Max-Age=0${cookieScope()}`;
    } catch {}
  }