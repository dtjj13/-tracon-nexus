import { supabase } from "./supabase";

export const getUserRole = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("email", user.email)
    .single();

  return data?.role || null;
};