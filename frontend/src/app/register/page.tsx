"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { register } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const username = (form.elements.namedItem("username") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const confirm = (form.elements.namedItem("confirm") as HTMLInputElement).value;

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await register(username, password);
      router.push("/login?registered=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--surface)]">
      <div className="w-full max-w-sm rounded-3xl border-2 border-[var(--stroke)] bg-white p-8 shadow-[var(--shadow)]">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
          Project Management
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold text-[var(--navy-dark)]">
          Create account
        </h1>
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label
              htmlFor="username"
              className="block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]"
            >
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              minLength={3}
              className="mt-2 w-full rounded-xl border-2 border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              className="mt-2 w-full rounded-xl border-2 border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
            />
            <p className="mt-1 text-xs text-[var(--gray-text)]">At least 6 characters</p>
          </div>
          <div>
            <label
              htmlFor="confirm"
              className="block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]"
            >
              Confirm password
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              required
              className="mt-2 w-full rounded-xl border-2 border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
            />
          </div>
          {error && (
            <p className="text-sm font-medium text-red-500">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-[var(--secondary-purple)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-[var(--gray-text)]">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-[var(--primary-blue)] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
