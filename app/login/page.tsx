import Link from "next/link";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const callbackUrlParam = searchParams.callbackUrl;
  const callbackUrl =
    typeof callbackUrlParam === "string" ? callbackUrlParam : undefined;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Log in
      </h1>
      <LoginForm callbackUrl={callbackUrl} />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        No account?{" "}
        <Link href="/register" className="underline">
          Register
        </Link>
      </p>
    </main>
  );
}
