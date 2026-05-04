import { supabase } from "./supabase";

export type UserRole =
  | "owner"
  | "admin"
  | "dispatcher"
  | "driver"
  | "manager"
  | "safety"
  | "payroll"
  | "maintenance";

export const getUserProfile = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", user.email)
    .eq("active", true)
    .maybeSingle();

  if (profile) return profile;

  const { data: driver } = await supabase
    .from("drivers")
    .select("*")
    .eq("email", user.email)
    .eq("active", true)
    .maybeSingle();

  if (driver) {
    return {
      email: driver.email,
      name: driver.name,
      role: "driver",
      active: true,
    };
  }

  return null;
};

export const getUserRole = async () => {
  const profile = await getUserProfile();
  return profile?.role || null;
};

export const hasRole = async (allowedRoles: UserRole[]) => {
  const role = await getUserRole();
  return role ? allowedRoles.includes(role as UserRole) : false;
};