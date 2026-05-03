"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const signUp = async () => {
    if (!email || !password) {
      alert("Enter email and password");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: email,
      password: password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Account created. Now click Sign In.");
  };

  const signIn = async () => {
    if (!email || !password) {
      alert("Enter email and password");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    router.push("/dispatch");
  };

  return (
    <div className="min-h-screen bg-[#050A11] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-[#07101A] p-6">
        <h1 className="text-3xl font-bold">
          TRACON <span className="text-blue-500 font-light">NEXUS</span>
        </h1>

        <p className="text-slate-400 mt-2">Sign in to continue</p>

        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-6 w-full bg-[#0B1522] p-3 rounded border border-slate-700"
        />

        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-3 w-full bg-[#0B1522] p-3 rounded border border-slate-700"
        />

        <button
          onClick={signIn}
          className="mt-5 w-full bg-blue-600 p-3 rounded hover:bg-blue-500"
        >
          Sign In
        </button>

        <button
          onClick={signUp}
          className="mt-3 w-full bg-slate-800 p-3 rounded hover:bg-slate-700"
        >
          Create Account
        </button>
      </div>
    </div>
  );
}