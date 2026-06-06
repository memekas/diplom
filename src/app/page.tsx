import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Padel Tournaments</h1>
        <p className="mt-3 text-sm opacity-70">
          Register as a pair, play, and follow the bracket.
        </p>
      </div>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="rounded-md border border-current px-5 py-2 text-sm font-medium hover:opacity-80"
        >
          Log in
        </Link>
        <Link
          href="/register"
          className="rounded-md bg-foreground px-5 py-2 text-sm font-medium text-background hover:opacity-80"
        >
          Register
        </Link>
      </div>
    </main>
  );
}
