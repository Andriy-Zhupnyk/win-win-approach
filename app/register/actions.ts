"use server";

import { hash } from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type RegisterState = { error?: string; success?: boolean };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

/**
 * Registers a new visitor as a `MEMBER` (spec 0003 — `visitor` is never a
 * stored role). Deliberately does not sign the user in: the spec's test
 * plan treats register and login as separate steps.
 */
export async function registerAction(
  _prevState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();

  if (!displayName) {
    return { error: "Enter a display name." };
  }
  if (!EMAIL_RE.test(email)) {
    return { error: "Enter a valid email address." };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with this email already exists." };
  }

  const passwordHash = await hash(password, 12);

  await prisma.user.create({
    data: {
      email,
      displayName,
      passwordHash,
      role: Role.MEMBER,
    },
  });

  return { success: true };
}
