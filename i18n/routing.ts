import { defineRouting } from "next-intl/routing";

// Spec 0004 — i18n scaffold. Default locale is Ukrainian (`uk`), with
// English (`en`) as the secondary/fallback locale — see
// specs/active/0004-i18n-scaffold.md for the rationale and for how to add
// another locale later. `localePrefix: "always"` means every page lives
// under `/uk/...` or `/en/...`; visiting the bare `/` is redirected to the
// negotiated locale by the middleware.
export const routing = defineRouting({
  locales: ["uk", "en"],
  defaultLocale: "uk",
  localePrefix: "always",
});

export type AppLocale = (typeof routing.locales)[number];
