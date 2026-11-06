"use client";

import { useState } from "react";
import Image from "next/image";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const signIn = async () => {
    if (!email || !password) {
      setMessage("Enter your email and password.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setSubmitting(false);
      return;
    }

    const userEmail = data.user?.email;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role,active")
      .eq("email", userEmail)
      .eq("active", true)
      .single();

    if (profile?.role === "owner" || profile?.role === "admin") {
      router.push("/owner");
      return;
    }

    if (profile?.role === "dispatcher" || profile?.role === "manager") {
      router.push("/dispatch");
      return;
    }

    if (profile?.role === "safety") {
      router.push("/settings/safety");
      return;
    }

    if (profile?.role === "payroll") {
      router.push("/settings/pay");
      return;
    }

    if (profile?.role === "maintenance") {
      router.push("/settings/trucks");
      return;
    }

    if (profile?.role === "driver") {
      router.push("/driver");
      return;
    }

    const { data: driver } = await supabase
      .from("drivers")
      .select("id")
      .eq("email", userEmail)
      .eq("active", true)
      .single();

    if (driver) {
      router.push("/driver");
      return;
    }

    setMessage("No active company role is connected to this account.");
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-[#050A11] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-[#07101A] p-6">
        <Image
          src="/logo-wordmark.svg"
          alt="Tracon Nexus"
          width={240}
          height={66}
          className="mx-auto mb-6 h-auto w-[240px]"
          priority
        />

        <p className="mt-2 text-slate-400">Sign in to continue</p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void signIn();
          }}
          className="mt-6"
        >
          <label className="block text-sm font-medium text-slate-300" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full rounded border border-slate-700 bg-[#0B1522] p-3"
          />

          <label className="mt-4 block text-sm font-medium text-slate-300" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full rounded border border-slate-700 bg-[#0B1522] p-3"
          />

          {message && (
            <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300" role="alert">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-5 w-full rounded bg-blue-600 p-3 font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs leading-5 text-slate-500">
          Need access? Ask your company owner to add you to the team.
        </p>
      </div>
    </div>
  );
}
