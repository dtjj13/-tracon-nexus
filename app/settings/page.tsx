"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabase";
import { hasRole } from "../lib/getUserRole";

type Driver = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  carrier?: string;
  active: boolean;
  pay_type?: string;
  pay_rate?: number;
  truck_mpg?: number;
};

type CompanySettings = {
  id: string;
  company_name?: string;
  company_logo_url?: string;
};

type Profile = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
};

const roles = ["owner", "admin", "dispatcher", "manager", "driver"];

export default function SettingsPage() {
  const router = useRouter();

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [companyName, setCompanyName] = useState("Twelve 10 Logistics");

  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const [driverForm, setDriverForm] = useState({
    name: "",
    email: "",
    phone: "",
    carrier: "Twelve 10 Logistics",
    pay_type: "CPM",
    pay_rate: "",
    truck_mpg: "",
  });

  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    role: "dispatcher",
  });

  useEffect(() => {
    const checkRole = async () => {
      const allowed = await hasRole(["owner", "admin", "dispatcher", "manager"]);
      if (!allowed) router.push("/driver");
    };

    checkRole();
    fetchCompany();
    fetchDrivers();
    fetchUsers();

    const channel = supabase
      .channel("management-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "drivers" }, fetchDrivers)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, fetchUsers)
      .on("postgres_changes", { event: "*", schema: "public", table: "company_settings" }, fetchCompany)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const fetchCompany = async () => {
    const { data } = await supabase
      .from("company_settings")
      .select("*")
      .limit(1)
      .single();

    if (data) {
      setCompany(data);
      setCompanyName(data.company_name || "Twelve 10 Logistics");
    }
  };

  const saveCompanyName = async () => {
    if (!company) return alert("Company settings not found");

    const { error } = await supabase
      .from("company_settings")
      .update({ company_name: companyName })
      .eq("id", company.id);

    if (error) return alert(error.message);

    fetchCompany();
    alert("Company name saved");
  };

  const uploadCompanyLogo = async (file: File | null) => {
    if (!file || !company) return;

    const fileName = `company-logo-${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("branding")
      .upload(fileName, file, { upsert: true });

    if (uploadError) return alert(uploadError.message);

    const { data } = supabase.storage.from("branding").getPublicUrl(fileName);

    const { error } = await supabase
      .from("company_settings")
      .update({ company_logo_url: data.publicUrl })
      .eq("id", company.id);

    if (error) return alert(error.message);

    fetchCompany();
    alert("Company logo uploaded");
  };

  const removeCompanyLogo = async () => {
    if (!company) return;

    if (!confirm("Remove company logo?")) return;

    const { error } = await supabase
      .from("company_settings")
      .update({ company_logo_url: "" })
      .eq("id", company.id);

    if (error) return alert(error.message);

    fetchCompany();
  };

  const fetchDrivers = async () => {
    const { data, error } = await supabase
      .from("drivers")
      .select("*")
      .order("name");

    if (error) return alert(error.message);
    setDrivers(data || []);
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("name");

    if (error) return alert(error.message);
    setUsers(data || []);
  };

  const resetDriverForm = () => {
    setEditingDriverId(null);
    setDriverForm({
      name: "",
      email: "",
      phone: "",
      carrier: companyName || "Twelve 10 Logistics",
      pay_type: "CPM",
      pay_rate: "",
      truck_mpg: "",
    });
  };

  const startEditDriver = (driver: Driver) => {
    setEditingDriverId(driver.id);
    setDriverForm({
      name: driver.name || "",
      email: driver.email || "",
      phone: driver.phone || "",
      carrier: driver.carrier || companyName || "Twelve 10 Logistics",
      pay_type: driver.pay_type || "CPM",
      pay_rate: driver.pay_rate ? String(driver.pay_rate) : "",
      truck_mpg: driver.truck_mpg ? String(driver.truck_mpg) : "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveDriver = async () => {
    if (!driverForm.name || !driverForm.email) {
      alert("Driver name and email are required");
      return;
    }

    const payload = {
      name: driverForm.name,
      email: driverForm.email,
      phone: driverForm.phone,
      carrier: driverForm.carrier,
      pay_type: driverForm.pay_type,
      pay_rate: Number(driverForm.pay_rate || 0),
      truck_mpg: Number(driverForm.truck_mpg || 0),
    };

    if (editingDriverId) {
      const { error } = await supabase
        .from("drivers")
        .update(payload)
        .eq("id", editingDriverId);

      if (error) return alert(error.message);
    } else {
      const { error } = await supabase
        .from("drivers")
        .insert([{ ...payload, active: true }]);

      if (error) return alert(error.message);
    }

    resetDriverForm();
    fetchDrivers();
  };

  const toggleDriver = async (driver: Driver) => {
    const { error } = await supabase
      .from("drivers")
      .update({ active: !driver.active })
      .eq("id", driver.id);

    if (error) return alert(error.message);
    fetchDrivers();
  };

  const deleteDriver = async (driver: Driver) => {
    if (!confirm(`Delete driver ${driver.name}?`)) return;

    const { error } = await supabase.from("drivers").delete().eq("id", driver.id);

    if (error) return alert(error.message);
    fetchDrivers();
  };

  const resetUserForm = () => {
    setEditingUserId(null);
    setUserForm({
      name: "",
      email: "",
      role: "dispatcher",
    });
  };

  const startEditUser = (user: Profile) => {
    setEditingUserId(user.id);
    setUserForm({
      name: user.name || "",
      email: user.email || "",
      role: user.role || "dispatcher",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveUser = async () => {
    if (!userForm.name || !userForm.email) {
      alert("Name and email are required");
      return;
    }

    const payload = {
      name: userForm.name,
      email: userForm.email,
      role: userForm.role,
    };

    if (editingUserId) {
      const { error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", editingUserId);

      if (error) return alert(error.message);
    } else {
      const { error } = await supabase
        .from("profiles")
        .insert([{ ...payload, active: true }]);

      if (error) return alert(error.message);
    }

    resetUserForm();
    fetchUsers();
  };

  const updateUserRole = async (userId: string, role: string) => {
    const { error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", userId);

    if (error) return alert(error.message);
    fetchUsers();
  };

  const toggleUserActive = async (user: Profile) => {
    const { error } = await supabase
      .from("profiles")
      .update({ active: !user.active })
      .eq("id", user.id);

    if (error) return alert(error.message);
    fetchUsers();
  };

  const deleteUser = async (user: Profile) => {
    if (!confirm(`Delete user ${user.name}?`)) return;

    const { error } = await supabase.from("profiles").delete().eq("id", user.id);

    if (error) return alert(error.message);
    fetchUsers();
  };

  return (
    <div className="min-h-screen bg-[#020617] p-3 text-white sm:p-6">
      <div className="space-y-6">
        <Navbar />

        <Header />

        <CompanySection
          company={company}
          companyName={companyName}
          setCompanyName={setCompanyName}
          saveCompanyName={saveCompanyName}
          uploadCompanyLogo={uploadCompanyLogo}
          removeCompanyLogo={removeCompanyLogo}
        />

        <DriverSection
          editingDriverId={editingDriverId}
          driverForm={driverForm}
          setDriverForm={setDriverForm}
          saveDriver={saveDriver}
          resetDriverForm={resetDriverForm}
        />

        <DriverTable
          drivers={drivers}
          startEditDriver={startEditDriver}
          toggleDriver={toggleDriver}
          deleteDriver={deleteDriver}
        />

        <UsersSection
          users={users}
          userForm={userForm}
          setUserForm={setUserForm}
          editingUserId={editingUserId}
          saveUser={saveUser}
          resetUserForm={resetUserForm}
          startEditUser={startEditUser}
          updateUserRole={updateUserRole}
          toggleUserActive={toggleUserActive}
          deleteUser={deleteUser}
        />
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-[#07101A] to-[#050A11] p-5 shadow-[0_0_30px_rgba(0,0,0,0.45)]">
     <h1 className="text-xl font-semibold text-white">
  Settings
</h1>
      
    </div>
  );
}

function CompanySection({
  company,
  companyName,
  setCompanyName,
  saveCompanyName,
  uploadCompanyLogo,
  removeCompanyLogo,
}: {
  company: CompanySettings | null;
  companyName: string;
  setCompanyName: (value: string) => void;
  saveCompanyName: () => void;
  uploadCompanyLogo: (file: File | null) => void;
  removeCompanyLogo: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#07101A] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-white">Company Branding</h2>
          
        </div>

        {company?.company_logo_url && (
          <img
            src={company.company_logo_url}
            alt="Company Logo"
            className="h-14 w-auto rounded-lg border border-slate-800 bg-[#020617] p-2"
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Input
          placeholder="Company Name"
          value={companyName}
          onChange={setCompanyName}
        />

        <button
          onClick={saveCompanyName}
          className="rounded-xl border border-slate-700 bg-[#0B1522] px-4 py-2 text-sm"
        >
          Save Name
        </button>

        <label className="cursor-pointer rounded-xl bg-gradient-to-r from-[#1E6BFF] to-[#00A3FF] px-4 py-2 text-center text-sm font-semibold">
          Replace Logo
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => uploadCompanyLogo(e.target.files?.[0] || null)}
          />
        </label>

        <button
          onClick={removeCompanyLogo}
          className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300"
        >
          Remove Logo
        </button>
      </div>
    </div>
  );
}

function DriverSection({
  editingDriverId,
  driverForm,
  setDriverForm,
  saveDriver,
  resetDriverForm,
}: any) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#07101A] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-white">
            {editingDriverId ? "Edit Driver" : "Add Driver"}
          </h2>
          
        </div>

        {editingDriverId && (
          <button
            onClick={resetDriverForm}
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm"
          >
            Cancel Edit
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input placeholder="Driver Name" value={driverForm.name} onChange={(v) => setDriverForm({ ...driverForm, name: v })} />
        <Input placeholder="Driver Email" value={driverForm.email} onChange={(v) => setDriverForm({ ...driverForm, email: v })} />
        <Input placeholder="Phone" value={driverForm.phone} onChange={(v) => setDriverForm({ ...driverForm, phone: v })} />
        <Input placeholder="Carrier" value={driverForm.carrier} onChange={(v) => setDriverForm({ ...driverForm, carrier: v })} />

        <select
          value={driverForm.pay_type}
          onChange={(e) => setDriverForm({ ...driverForm, pay_type: e.target.value })}
          className="rounded-xl border border-slate-700 bg-[#0B1522] p-2 text-sm text-white"
        >
          <option value="CPM">CPM / Per Mile</option>
          <option value="Percentage">Percentage</option>
          <option value="Flat">Flat Rate</option>
        </select>

        <Input placeholder="Pay Rate" value={driverForm.pay_rate} onChange={(v) => setDriverForm({ ...driverForm, pay_rate: v })} />
        <Input placeholder="Truck MPG" value={driverForm.truck_mpg} onChange={(v) => setDriverForm({ ...driverForm, truck_mpg: v })} />

        <button
          onClick={saveDriver}
          className="rounded-xl bg-gradient-to-r from-[#1E6BFF] to-[#00A3FF] px-4 py-2 text-sm font-semibold"
        >
          {editingDriverId ? "Save Changes" : "+ Add Driver"}
        </button>
      </div>
    </div>
  );
}

function DriverTable({ drivers, startEditDriver, toggleDriver, deleteDriver }: any) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#07101A]">
      <table className="w-full min-w-[980px] text-sm">
        <thead className="bg-[#0B1522] text-slate-400">
          <tr>
            <th className="p-4 text-left">Driver</th>
            <th className="p-4 text-left">Contact</th>
            <th className="p-4 text-left">Carrier</th>
            <th className="p-4 text-left">Pay Type</th>
            <th className="p-4 text-left">Pay Rate</th>
            <th className="p-4 text-left">Truck MPG</th>
            <th className="p-4 text-left">Status</th>
            <th className="p-4 text-left">Actions</th>
          </tr>
        </thead>

        <tbody>
          {drivers.map((driver: Driver) => (
            <tr key={driver.id} className="border-t border-slate-800">
              <td className="p-4">
                <p className="font-semibold text-white">{driver.name}</p>
                <p className="text-xs text-slate-500">{driver.email}</p>
              </td>
              <td className="p-4">{driver.phone || "-"}</td>
              <td className="p-4">{driver.carrier || "-"}</td>
              <td className="p-4">{driver.pay_type || "-"}</td>
              <td className="p-4">{formatPay(driver.pay_type, driver.pay_rate)}</td>
              <td className="p-4">{driver.truck_mpg ? `${driver.truck_mpg} MPG` : "-"}</td>
              <td className="p-4">
                {driver.active ? (
                  <span className="text-green-400">Active</span>
                ) : (
                  <span className="text-red-400">Inactive</span>
                )}
              </td>
              <td className="p-4">
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => startEditDriver(driver)} className="text-[#00A3FF] underline">
                    Edit
                  </button>
                  <button onClick={() => toggleDriver(driver)} className={driver.active ? "text-red-400 underline" : "text-green-400 underline"}>
                    {driver.active ? "Deactivate" : "Activate"}
                  </button>
                  <button onClick={() => deleteDriver(driver)} className="text-red-400 underline">
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}

          {drivers.length === 0 && (
            <tr>
              <td colSpan={8} className="p-6 text-center text-slate-500">
                No drivers added yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function UsersSection({
  users,
  userForm,
  setUserForm,
  editingUserId,
  saveUser,
  resetUserForm,
  startEditUser,
  updateUserRole,
  toggleUserActive,
  deleteUser,
}: any) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#07101A] p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">
            {editingUserId ? "Edit User" : "Users & Roles"}
          </h2>
          
        </div>

        {editingUserId && (
          <button
            onClick={resetUserForm}
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm"
          >
            Cancel Edit
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input placeholder="Full Name" value={userForm.name} onChange={(v) => setUserForm({ ...userForm, name: v })} />
        <Input placeholder="Email" value={userForm.email} onChange={(v) => setUserForm({ ...userForm, email: v })} />

        <select
          value={userForm.role}
          onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
          className="rounded-xl border border-slate-700 bg-[#0B1522] p-2 text-sm text-white"
        >
          {roles.map((role) => (
            <option key={role} value={role}>
              {role.toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={saveUser}
        className="mt-4 w-full rounded-xl bg-gradient-to-r from-[#1E6BFF] to-[#00A3FF] px-4 py-2 font-semibold"
      >
        {editingUserId ? "Save User Changes" : "+ Add User"}
      </button>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full min-w-[840px] text-sm">
          <thead className="bg-[#0B1522] text-slate-400">
            <tr>
              <th className="p-4 text-left">Name</th>
              <th className="p-4 text-left">Email</th>
              <th className="p-4 text-left">Role</th>
              <th className="p-4 text-left">Status</th>
              <th className="p-4 text-left">Actions</th>
            </tr>
          </thead>

          <tbody>
            {users.map((user: Profile) => (
              <tr key={user.id} className="border-t border-slate-800">
                <td className="p-4">{user.name}</td>
                <td className="p-4">{user.email}</td>
                <td className="p-4">
                  <select
                    value={user.role}
                    onChange={(e) => updateUserRole(user.id, e.target.value)}
                    className="rounded-xl border border-slate-700 bg-[#0B1522] p-2 text-white"
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
                  <div className="flex flex-wrap gap-3">
                    <button onClick={() => startEditUser(user)} className="text-[#00A3FF] underline">
                      Edit
                    </button>
                    <button
                      onClick={() => toggleUserActive(user)}
                      className={user.active ? "text-red-400 underline" : "text-green-400 underline"}
                    >
                      {user.active ? "Deactivate" : "Activate"}
                    </button>
                    <button onClick={() => deleteUser(user)} className="text-red-400 underline">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-500">
                  No users added yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Input({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border border-slate-700 bg-[#0B1522] p-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-[#00A3FF]"
    />
  );
}

function formatPay(payType?: string, payRate?: number) {
  if (!payRate) return "-";
  if (payType === "CPM") return `$${payRate.toFixed(2)} / mi`;
  if (payType === "Percentage") return `${payRate}%`;
  if (payType === "Flat") return `$${payRate.toLocaleString()}`;
  return payRate;
}