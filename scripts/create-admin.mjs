// Crea (o actualiza la contraseña de) un usuario administrador.
// Uso: node --env-file=.env.local scripts/create-admin.mjs <usuario> <contraseña>
import { createClient } from "@supabase/supabase-js";

const [username, password] = process.argv.slice(2);
if (!username || !password || password.length < 6) {
  console.error("Uso: node --env-file=.env.local scripts/create-admin.mjs <usuario> <contraseña (min 6)>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const domain = process.env.NEXT_PUBLIC_LOGIN_DOMAIN || "equipos.vfvpadel.app";
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY en .env.local");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const name = username.trim().toLowerCase();
const email = `${name}@${domain}`;

const { data: existing } = await db.from("profiles").select("id").eq("username", name).maybeSingle();
let userId = existing?.id;

if (userId) {
  const { error } = await db.auth.admin.updateUserById(userId, { password });
  if (error) throw error;
} else {
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  userId = data.user.id;
}

const { error } = await db.from("profiles").upsert({ id: userId, username: name, role: "admin", team_id: null });
if (error) throw error;

console.log(`Administrador "${name}" listo. Entra en la web con ese usuario y contraseña.`);
