"use client";

import { useEffect, useState } from "react";
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
useEffect(() => {
  const checkRole = async () => {
    const allowed = await hasRole(["owner", "admin"]);

if (!allowed) {
  router.push("/dispatch");
}
  };

  checkRole();
}, [router]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "dispatcher",
  });

  const checkAccess = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      router.push("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", user.email)
      .single();

    if (profile?.role !== "owner" && profile?.role !== "admin") {
      alert("Only owner/admin can access user settings.");
      router.push("/dispatch");
    }
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return alert(error.message);

    setUsers(data || []);
  };

  useEffect(() => {
    checkAccess();
    fetchUsers();
  }, []);

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

    fetchUsers();

    alert(
      "User profile added. They still need to create an account using the same email on the login page."
    );
  };

  const updateRole = async (id: string, role: string) => {
    const { error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", id);

    if (error) return alert(error.message);

    fetchUsers();
  };

  const toggleActive = async (user: Profile) => {
    const { error } = await supabase
      .from("profiles")
      .update({ active: !user.active })
      .eq("id", user.id);

    if (error) return alert(error.message);

    fetchUsers();
  };

  return (
    <div className="min-h-screen bg-[#050A11] text-white p-3 sm:p-6">
      <Navbar />

      <p className="text-slate-400 mt-2">Settings / Users & Roles</p>

      <div className="mt-6 rounded-xl border border-slate-800 bg-[#07101A] p-5">
        <h2 className="text-xl font-bold">Add User</h2>

        <div className="mt-4 grid grid-cols-3 gap-3">
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