import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  username: string;
  role: "admin" | "team";
  team_id: string | null;
};

// Los equipos entran con usuario; por debajo Supabase usa un email ficticio que nunca recibe correo
export function usernameToEmail(username: string) {
  const domain = process.env.NEXT_PUBLIC_LOGIN_DOMAIN || "equipos.vfvpadel.app";
  return `${username.trim().toLowerCase()}@${domain}`;
}

export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, username, role, team_id")
    .eq("id", user.id)
    .maybeSingle();
  return (data as Profile | null) ?? null;
});

export async function requireAdmin() {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") redirect("/login");
  return profile;
}
