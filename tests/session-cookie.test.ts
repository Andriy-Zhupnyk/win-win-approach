// @vitest-environment node
//
// Spec 0013: background RSC requests must not re-issue the session cookie.
import { describe, expect, it } from "vitest";
import {
  mayRefreshSessionCookie,
  stripSessionSetCookies,
} from "@/lib/session-cookie";

describe("mayRefreshSessionCookie", () => {
  it("is true only for browser page navigations", () => {
    expect(
      mayRefreshSessionCookie(new Headers({ "sec-fetch-mode": "navigate" })),
    ).toBe(true);
  });

  it("is false for router fetches, prefetches and unclassifiable requests", () => {
    for (const mode of ["cors", "same-origin", "no-cors"]) {
      expect(
        mayRefreshSessionCookie(new Headers({ "sec-fetch-mode": mode })),
      ).toBe(false);
    }
    expect(mayRefreshSessionCookie(new Headers())).toBe(false);
  });
});

describe("stripSessionSetCookies", () => {
  it("removes the session token, its secure variant and its chunks", () => {
    const headers = new Headers();
    headers.append("set-cookie", "authjs.session-token=a; Path=/; HttpOnly");
    headers.append(
      "set-cookie",
      "__Secure-authjs.session-token=b; Path=/; Secure",
    );
    headers.append("set-cookie", "authjs.session-token.1=c; Path=/");
    stripSessionSetCookies(headers);
    expect(headers.getSetCookie()).toEqual([]);
  });

  it("keeps unrelated cookies such as the locale cookie", () => {
    const headers = new Headers();
    headers.append("set-cookie", "NEXT_LOCALE=uk; Path=/");
    headers.append("set-cookie", "authjs.session-token=a; Path=/; HttpOnly");
    headers.append("set-cookie", "authjs.callback-url=%2F; Path=/");
    stripSessionSetCookies(headers);
    expect(headers.getSetCookie()).toEqual([
      "NEXT_LOCALE=uk; Path=/",
      "authjs.callback-url=%2F; Path=/",
    ]);
  });

  it("leaves headers without a session cookie untouched", () => {
    const headers = new Headers({ "content-type": "text/x-component" });
    stripSessionSetCookies(headers);
    expect(headers.get("content-type")).toBe("text/x-component");
    expect(headers.getSetCookie()).toEqual([]);
  });
});
