import { createNavigation } from "next-intl/navigation";
import { routing } from "@/i18n/routing";

// Locale-aware drop-ins for next/navigation's Link/redirect/usePathname/
// useRouter, scoped to `routing` above. Using these (instead of next/link,
// next/navigation) is what keeps the active locale in every internal link
// and redirect across the app — see components/site-nav.tsx,
// components/locale-switcher.tsx and lib/rbac.ts.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
