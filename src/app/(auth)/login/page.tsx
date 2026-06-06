import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-bold">Log in</h1>
      <LoginForm />
      <p className="text-sm opacity-70">
        No account yet?{" "}
        <Link href="/register" className="underline">
          Register
        </Link>
      </p>
    </main>
  );
}
