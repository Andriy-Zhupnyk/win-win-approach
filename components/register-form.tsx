"use client";

import { useActionState } from "react";
import { registerAction, type RegisterState } from "@/app/register/actions";

const initialState: RegisterState = {};

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(
    registerAction,
    initialState,
  );

  if (state.success) {
    return (
      <p className="max-w-sm text-sm text-zinc-700 dark:text-zinc-300">
        Account created. You can now{" "}
        <a className="underline" href="/login">
          log in
        </a>
        .
      </p>
    );
  }

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Display name
        <input
          name="displayName"
          type="text"
          autoComplete="name"
          required
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-black"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-black"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-black"
        />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "Creating account…" : "Register"}
      </button>
    </form>
  );
}
