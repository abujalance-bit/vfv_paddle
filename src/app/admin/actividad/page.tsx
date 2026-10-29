import { createAdminClient } from "@/lib/supabase/admin";
import type { Team } from "@/lib/types";

type Activity = {
  id: string;
  username: string;
  role: "admin" | "team";
  team_id: string | null;
  login_count: number;
  last_login_at: string | null;
  visit_count: number;
  last_seen_at: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "Nunca";
  return new Date(value).toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  });
}

export default async function ActivityPage() {
  const db = createAdminClient();
  const [{ data: profilesData }, { data: teamsData }] = await Promise.all([
    db
      .from("profiles")
      .select("id, username, role, team_id, login_count, last_login_at, visit_count, last_seen_at")
      .order("last_seen_at", { ascending: false, nullsFirst: false }),
    db.from("teams").select("id, name"),
  ]);
  const profiles = (profilesData ?? []) as Activity[];
  const teams = (teamsData ?? []) as Pick<Team, "id" | "name">[];
  const neverIn = profiles.filter((p) => p.login_count === 0).length;

  return (
    <div className="space-y-4">
      <h1 className="h1">Actividad</h1>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Usuarios" value={profiles.length} />
        <Stat label="Entradas" value={profiles.reduce((s, p) => s + p.login_count, 0)} />
        <Stat label="Nunca han entrado" value={neverIn} />
      </div>

      <p className="text-sm text-muted">
        Una visita cuenta cada vez que alguien abre la app después de 30 minutos sin usarla. Al iniciar sesión se
        queda dentro, así que puede haber muchas visitas con pocas entradas.
      </p>

      <section className="card p-0">
        {profiles.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-0">
            <div className="min-w-0">
              <div className="truncate font-semibold">
                {p.role === "admin" ? "Admin" : (teams.find((t) => t.id === p.team_id)?.name ?? "Sin equipo")}
              </div>
              <div className="text-xs text-muted">@{p.username}</div>
              <div className="mt-1 text-xs text-muted">
                Última entrada: {formatDate(p.last_login_at)} · Última visita: {formatDate(p.last_seen_at)}
              </div>
            </div>
            <div className="flex shrink-0 gap-3 text-center">
              <div>
                <div className="text-lg font-bold">{p.login_count}</div>
                <div className="text-xs text-muted">entradas</div>
              </div>
              <div>
                <div className="text-lg font-bold">{p.visit_count}</div>
                <div className="text-xs text-muted">visitas</div>
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card text-center">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
