"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";

export type LoginState = { error?: string };

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const callbackUrlRaw = String(formData.get("callbackUrl") ?? "");
  // Only ever a same-origin, app-relative path (set by middleware.ts or
  // defaulted below) — never follow an absolute/external redirect target.
  const callbackUrl =
    callbackUrlRaw.startsWith("/") && !callbackUrlRaw.startsWith("//")
      ? callbackUrlRaw
      : "/";

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: callbackUrl,
    });
    return {};
  } catch (error) {
    // `signIn` throws Next's internal redirect signal on success, which is
    // not an AuthError — let it propagate so the redirect actually happens.
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    throw error;
  }
}
