export default function ForbiddenPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Forbidden
      </h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        You do not have permission to view this page.
      </p>
    </main>
  );
}
