"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const signUp = async () => {
    if (!email || !password) return alert("Enter email and password");

    const { error } = await supabase.auth.signUp({ email, password });

    if (error) return alert(error.message);

    alert("Account created. Now click Sign In.");
  };

  const signIn = async () => {
    if (!email || !password) return alert("Enter email and password");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) return alert(error.message);

    const userEmail = data.user?.email;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", userEmail)
      .single();

    if (profile?.role === "dispatcher" || profile?.role === "owner") {
      router.push("/dispatch");
      return;
    }

    const { data: driver } = await supabase
      .from("drivers")
      .select("*")
      .eq("email", userEmail)
      .eq("active", true)
      .single();

    if (driver) {
      router.push("/driver");
      return;
    }

    alert("No role found for this account.");
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

        <button onClick={signIn} className="mt-5 w-full bg-blue-600 p-3 rounded">
          Sign In
        </button>

        <button onClick={signUp} className="mt-3 w-full bg-slate-800 p-3 rounded">
          Create Account
        </button>
      </div>
    </div>
  );
}
