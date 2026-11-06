"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import Navbar from "../../components/Navbar";
import { hasRole } from "../../lib/getUserRole";


type Profile = {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
};

const roles = [
  "owner",
  "dispatcher",
  "driver",
  "manager",
  "safety",
  "payroll",
  "maintenance",
  "admin",
];

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<Profile[]>([]);
  const [authorized, setAuthorized] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "dispatcher",
  });

  const fetchUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,name,role,active")
      .order("created_at", { ascending: false });

    if (error) return alert(error.message);

    setUsers(data || []);
  }, []);

  useEffect(() => {
    let active = true;

    async function checkAccess() {
      const allowed = await hasRole(["owner", "admin"]);

      if (!active) return;

      if (!allowed) {
        router.replace("/dispatch");
        return;
      }

      setAuthorized(true);
      await fetchUsers();
    }

    void checkAccess();

    return () => {
      active = false;
    };
  }, [fetchUsers, router]);

  const addUser = async () => {
    if (!form.name || !form.email || !form.role) {
      alert("Name, email, and role are required");
      return;
    }

    const { error } = await supabase.from("profiles").insert([
      {
        name: form.name,
        email: form.email,
        role: form.role,
        active: true,
      },
    ]);

    if (error) return alert(error.message);

    setForm({
      name: "",
      email: "",
      role: "dispatcher",
    });

    await fetchUsers();

    alert(
      "User profile added. Account invitation setup is still required before a new user can sign in."
    );
  };

  const updateRole = async (id: string, role: string) => {
    const { error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", id);

    if (error) return alert(error.message);

    await fetchUsers();
  };

  const toggleActive = async (user: Profile) => {
    const { error } = await supabase
      .from("profiles")
      .update({ active: !user.active })
      .eq("id", user.id);

    if (error) return alert(error.message);

    await fetchUsers();
  };

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617] text-sm text-slate-400">
        Verifying access…
      </div>
    );
  }

  return (
  <div className="min-h-screen bg-[#020617] p-3 text-white sm:p-6">

    <Navbar />

    <div className="mb-4">
      <button
        onClick={() => router.back()}
        className="rounded-xl border border-slate-700 bg-[#07101A] px-4 py-2 text-sm text-slate-300 transition hover:border-[#00A3FF] hover:text-white"
      >
        ← Back
      </button>
    </div>

   
      

      <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-[#07101A] to-[#050A11] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#16BFFF]">
          Settings
        </p>
        <h1 className="mt-2 text-xl font-semibold">Users &amp; Roles</h1>
        <p className="mt-2 text-sm text-slate-400">
          Manage company access and choose what each team member can work with.
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-slate-800 bg-[#07101A] p-5">
        <h2 className="text-xl font-bold">Add User</h2>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <input
            placeholder="Full Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="bg-[#0B1522] p-2 rounded border border-slate-700"
          />

          <input
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="bg-[#0B1522] p-2 rounded border border-slate-700"
          />

          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="bg-[#0B1522] p-2 rounded border border-slate-700"
          >
            {roles.map((role) => (
              <option key={role} value={role}>
                {role.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={addUser}
          className="mt-4 w-full sm:w-auto bg-blue-600 px-4 py-2 rounded">
          + Add User
        </button>
      </div>

      <div className="mt-8 rounded-xl border border-slate-800 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#0B1522] text-slate-400">
            <tr>
              <th className="text-left p-4">Name</th>
              <th className="text-left p-4">Email</th>
              <th className="text-left p-4">Role</th>
              <th className="text-left p-4">Status</th>
              <th className="text-left p-4">Action</th>
            </tr>
          </thead>

          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-slate-800">
                <td className="p-4">{user.name}</td>
                <td className="p-4">{user.email}</td>

                <td className="p-4">
                  <select
                    value={user.role}
                    onChange={(e) => updateRole(user.id, e.target.value)}
                    className="bg-[#0B1522] p-2 rounded border border-slate-700"
                  >
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {role.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </td>

                <td className="p-4">
                  {user.active ? (
                    <span className="text-green-400">Active</span>
                  ) : (
                    <span className="text-red-400">Inactive</span>
                  )}
                </td>

                <td className="p-4">
                  <button
                    onClick={() => toggleActive(user)}
                    className="text-blue-400 underline"
                  >
                    {user.active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
