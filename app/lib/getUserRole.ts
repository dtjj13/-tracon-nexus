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

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", user.email)
    .eq("active", true)
    .single();

  if (error) return null;

  return data;
};

export const getUserRole = async () => {
  const profile = await getUserProfile();
  return profile?.role || null;
};

export const hasRole = async (allowedRoles: UserRole[]) => {
  const role = await getUserRole();
  return role ? allowedRoles.includes(role as UserRole) : false;
};