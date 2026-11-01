// Spec 0013. Edge-safe helpers (used from middleware.ts) that keep background
// requests from re-issuing the session cookie.
//
// Auth.js' `auth()` middleware wrapper copies the `Set-Cookie` of its session
// check (a refreshed JWT with a new expiry) onto EVERY response it handles.
// Next's client router fires requests in the background (link prefetches,
// router refreshes) that are rendered with the session as it was when they
// started. If "Log out" clears the cookie while one is still in flight, its
// late response writes the old session back and the user is signed in again.
// Such requests must never write the session cookie; the next page load
// still refreshes it as before.
//
// Next strips its own flight headers (`RSC`, `Next-Router-Prefetch`) and the
// `_rsc` query parameter before middleware runs, so a prefetch cannot be
// recognised by them there. The browser's `Sec-Fetch-Mode` header survives
// and tells a page navigation (`navigate`) apart from a script `fetch()`
// (`cors`/`same-origin`), which is what every router request is.

const SESSION_COOKIE_NAME =
  /^\s*(?:__Secure-)?authjs\.session-token(?:\.\d+)?=/;

// Only a browser page navigation may refresh the session cookie. Anything
// else, including requests that carry no `Sec-Fetch-Mode` (non-browser
// clients), does not.
export function mayRefreshSessionCookie(headers: Headers): boolean {
  return headers.get("sec-fetch-mode") === "navigate";
}

// Removes session-cookie `Set-Cookie` headers (the token and its chunks),
// keeping every other cookie (e.g. next-intl's locale cookie) intact.
export function stripSessionSetCookies(headers: Headers): void {
  const setCookies = headers.getSetCookie();
  if (!setCookies.some((cookie) => SESSION_COOKIE_NAME.test(cookie))) {
    return;
  }
  headers.delete("set-cookie");
  for (const cookie of setCookies) {
    if (!SESSION_COOKIE_NAME.test(cookie)) {
      headers.append("set-cookie", cookie);
    }
  }
}
