"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, usernameToEmail } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { back, errorMessage } from "@/lib/flash";
import { getOpenPeriod, getRankings, loadRankingPeriod } from "@/lib/data";
import { formatResult, parseSets, validateSets, type SetScore } from "@/lib/sets";
import { computeStandings, hasBlockingTie } from "@/lib/standings";
import type { Group, Match } from "@/lib/types";

async function adminClient() {
  await requireAdmin();
  return createAdminClient();
}

function done(path: string, message: string): never {
  revalidatePath("/", "layout");
  back(path, "ok", message);
}

const str = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

// Los borrados piden marcar la casilla de <DeleteBox />
function requireConfirm(formData: FormData, path: string) {
  if (formData.get("confirm") !== "on") back(path, "error", "Marca la casilla para confirmar el borrado");
}

// ---------------------------------------------------------------- Fases

function readDates(formData: FormData, path: string) {
  const start = str(formData, "start_date");
  const end = str(formData, "end_date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) back(path, "error", "Indica las fechas de la fase");
  if (end < start) back(path, "error", "La fecha de fin no puede ser anterior a la de inicio");
  return { start, end };
}

export async function startPeriod(formData: FormData) {
  const db = await adminClient();
  const { start, end } = readDates(formData, "/admin");
  const { error } = await db.from("periods").insert({ start_date: start, end_date: end, status: "open" });
  if (error) back("/admin", "error", error.message);
  done("/admin", "Fase iniciada. Ahora asigna los equipos a sus grupos.");
}

// Crea una fase programada (o abierta, si se marca y no hay otra en juego)
export async function createPeriod(formData: FormData) {
  const db = await adminClient();
  const path = "/admin/fases";
  const { start, end } = readDates(formData, path);
  const openNow = formData.get("open_now") === "on";
  if (openNow && (await getOpenPeriod(db))) back(path, "error", "Ya hay una fase en juego: ciérrala antes de abrir otra");
  const { error } = await db.from("periods").insert({
    start_date: start,
    end_date: end,
    status: openNow ? "open" : "planned",
    visible: formData.get("visible") === "on",
  });
  if (error) back(path, "error", error.message);
  done(path, openNow ? "Fase creada y abierta" : "Fase programada");
}

export async function updatePeriod(periodId: string, formData: FormData) {
  const db = await adminClient();
  const path = "/admin/fases";
  const { start, end } = readDates(formData, path);
  const { error } = await db
    .from("periods")
    .update({ start_date: start, end_date: end, visible: formData.get("visible") === "on" })
    .eq("id", periodId);
  if (error) back(path, "error", error.message);
  done(path, "Fase guardada");
}

// Abre una fase programada cuando no hay ninguna en juego
export async function openPeriod(periodId: string) {
  const db = await adminClient();
  const path = "/admin/fases";
  if (await getOpenPeriod(db)) back(path, "error", "Ya hay una fase en juego");
  const { error } = await db.from("periods").update({ status: "open" }).eq("id", periodId).eq("status", "planned");
  if (error) back(path, "error", error.message);
  done(path, "Fase abierta. Asigna los equipos a sus grupos.");
}

// Borra la fase con sus grupos de ese periodo y sus partidos
export async function deletePeriod(periodId: string, formData: FormData) {
  const db = await adminClient();
  const path = "/admin/fases";
  requireConfirm(formData, path);
  const { error } = await db.from("periods").delete().eq("id", periodId);
  if (error) back(path, "error", error.message);
  done(path, "Fase borrada");
}

export async function saveTiebreaks(groupId: string, formData: FormData) {
  const db = await adminClient();
  const period = await getOpenPeriod(db);
  if (!period) back("/admin/mes", "error", "No hay fase abierta");
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("tb_")) continue;
    const v = String(value).trim();
    await db
      .from("group_entries")
      .update({ tiebreak: v === "" ? null : Number(v) })
      .eq("period_id", period.id)
      .eq("group_id", groupId)
      .eq("team_id", key.slice(3));
  }
  done("/admin/mes", "Desempate guardado");
}

export async function closeMonth(formData: FormData) {
  const db = await adminClient();
  const period = await getOpenPeriod(db);
  if (!period) back("/admin/mes", "error", "No hay fase abierta");
  const nextChoice = str(formData, "next_id");
  if (nextChoice === "new") readDates(formData, "/admin/mes");
  else if (!nextChoice) back("/admin/mes", "error", "Elige la fase siguiente");
  await db.rpc("auto_confirm_expired");

  const { count } = await db
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("period_id", period.id)
    .in("status", ["pending", "reported", "disputed"]);
  if (count) back("/admin/mes", "error", `Quedan ${count} partido(s) sin resolver`);

  const results: { team_id: string; final_position: number; movement: string; next_group_id: string }[] = [];
  for (const ranking of await getRankings(db)) {
    const { groups, entries, teams, matches } = await loadRankingPeriod(db, ranking.id, period.id);
    const used = groups.filter((g) => entries.some((e) => e.group_id === g.id));
    for (const [idx, g] of used.entries()) {
      const rows = computeStandings(
        teams,
        entries.filter((e) => e.group_id === g.id),
        matches.filter((m) => m.group_id === g.id),
      );
      if (hasBlockingTie(rows)) {
        back("/admin/mes", "error", `Hay un empate sin resolver en ${ranking.name} · ${g.name}`);
      }
      rows.forEach((r, pos) => {
        let movement = "stay";
        let next = g.id;
        if (rows.length >= 2 && pos === 0 && idx > 0) {
          movement = "up";
          next = used[idx - 1].id;
        } else if (rows.length >= 2 && pos === rows.length - 1 && idx < used.length - 1) {
          movement = "down";
          next = used[idx + 1].id;
        }
        results.push({ team_id: r.team.id, final_position: pos + 1, movement, next_group_id: next });
      });
    }
  }

  // La siguiente fase: una ya programada o una nueva con las fechas del formulario
  let nextId = nextChoice;
  if (nextChoice === "new") {
    const { start, end } = readDates(formData, "/admin/mes");
    const { data: created, error: createError } = await db
      .from("periods")
      .insert({ start_date: start, end_date: end, status: "planned" })
      .select("id")
      .single();
    if (createError || !created) back("/admin/mes", "error", createError?.message ?? "No se pudo crear la fase");
    nextId = created.id;
  }

  const { error } = await db.rpc("close_period", { p_period: period.id, p_results: results, p_next: nextId });
  if (error) back("/admin/mes", "error", error.message);
  done("/admin", "Fase cerrada. Se ha abierto la siguiente con los ascensos y descensos.");
}

// ---------------------------------------------------------------- Grupos

export async function createGroup(formData: FormData) {
  const db = await adminClient();
  const rankingId = Number(formData.get("ranking_id"));
  const name = str(formData, "name");
  if (!name) back("/admin/grupos", "error", "Pon un nombre al grupo");
  const { data: last } = await db
    .from("groups")
    .select("level")
    .eq("ranking_id", rankingId)
    .order("level", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await db.from("groups").insert({ ranking_id: rankingId, name, level: (last?.level ?? 0) + 1 });
  if (error) back("/admin/grupos", "error", error.message);
  done("/admin/grupos", "Grupo creado");
}

export async function renameGroup(groupId: string, formData: FormData) {
  const db = await adminClient();
  const { error } = await db.from("groups").update({ name: str(formData, "name") }).eq("id", groupId);
  if (error) back("/admin/grupos", "error", error.message);
  done("/admin/grupos", "Grupo renombrado");
}

// Borra el grupo con sus partidos y su historial en todas las fases, y recoloca los niveles
export async function deleteGroup(groupId: string, formData: FormData) {
  const db = await adminClient();
  const path = "/admin/grupos";
  requireConfirm(formData, path);
  const { data: g } = await db.from("groups").select("*").eq("id", groupId).single<Group>();
  if (!g) back(path, "error", "Grupo no encontrado");

  const { error: matchesError } = await db.from("matches").delete().eq("group_id", groupId);
  if (matchesError) back(path, "error", matchesError.message);
  const { error: entriesError } = await db.from("group_entries").delete().eq("group_id", groupId);
  if (entriesError) back(path, "error", entriesError.message);
  const { error } = await db.from("groups").delete().eq("id", groupId);
  if (error) back(path, "error", error.message);

  // Sube un nivel los grupos de debajo para no dejar huecos (de arriba abajo, por el unique)
  const { data: below } = await db
    .from("groups")
    .select("id, level")
    .eq("ranking_id", g.ranking_id)
    .gt("level", g.level)
    .order("level");
  for (const b of below ?? []) await db.from("groups").update({ level: b.level - 1 }).eq("id", b.id);

  done(path, `Grupo "${g.name}" borrado`);
}

// Intercambia el nivel con el grupo de arriba (-1) o de abajo (+1)
export async function moveGroup(groupId: string, dir: -1 | 1) {
  const db = await adminClient();
  const { data: g } = await db.from("groups").select("*").eq("id", groupId).single<Group>();
  if (!g) back("/admin/grupos", "error", "Grupo no encontrado");
  const { data: other } = await db
    .from("groups")
    .select("*")
    .eq("ranking_id", g.ranking_id)
    .eq("level", g.level + dir)
    .maybeSingle<Group>();
  if (!other) back("/admin/grupos", "error", "No hay grupo con el que intercambiar");
  await db.from("groups").update({ level: -1 }).eq("id", g.id);
  await db.from("groups").update({ level: g.level }).eq("id", other.id);
  await db.from("groups").update({ level: other.level }).eq("id", g.id);
  done("/admin/grupos", "Orden de grupos actualizado");
}

// ---------------------------------------------------------------- Equipos

async function assignGroup(db: ReturnType<typeof createAdminClient>, teamId: string, groupId: string | null) {
  const period = await getOpenPeriod(db);
  if (!period) throw new Error("No hay fase abierta: iníciala en el panel antes de asignar grupos");

  const { data: current } = await db
    .from("group_entries")
    .select("group_id")
    .eq("period_id", period.id)
    .eq("team_id", teamId)
    .maybeSingle();
  const oldGroup = current?.group_id ?? null;
  if (oldGroup === groupId) return;

  if (groupId) {
    const [{ data: team }, { data: group }] = await Promise.all([
      db.from("teams").select("ranking_id").eq("id", teamId).single(),
      db.from("groups").select("ranking_id").eq("id", groupId).single(),
    ]);
    if (team?.ranking_id !== group?.ranking_id) throw new Error("El grupo no es del mismo ranking que el equipo");
  }

  if (oldGroup) {
    await db.from("group_entries").delete().eq("period_id", period.id).eq("team_id", teamId);
    await db.rpc("sync_group_matches", { p_period: period.id, p_group: oldGroup });
  }
  if (groupId) {
    const { error } = await db.from("group_entries").insert({ period_id: period.id, group_id: groupId, team_id: teamId });
    if (error) throw error;
    const { error: syncError } = await db.rpc("sync_group_matches", { p_period: period.id, p_group: groupId });
    if (syncError) throw syncError;
  }
}

export async function createTeam(formData: FormData) {
  const db = await adminClient();
  const path = "/admin/equipos";
  const rankingId = Number(formData.get("ranking_id"));
  const name = str(formData, "name");
  const username = str(formData, "username").toLowerCase();
  const password = str(formData, "password");
  const groupId = str(formData, "group_id") || null;
  const players = [1, 2, 3].map((i) => str(formData, `player${i}`)).filter(Boolean);

  if (!name) back(path, "error", "Falta el nombre del equipo");
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
    back(path, "error", "Usuario no válido: 3-30 caracteres, solo letras minúsculas, números, punto, guion");
  }
  if (password.length < 6) back(path, "error", "La contraseña debe tener al menos 6 caracteres");

  const { data: team, error } = await db.from("teams").insert({ ranking_id: rankingId, name }).select("id").single();
  if (error || !team) back(path, "error", error?.message ?? "No se pudo crear el equipo");

  if (players.length) {
    await db.from("players").insert(players.map((p, i) => ({ team_id: team.id, name: p, position: i + 1 })));
  }

  const { data: user, error: userError } = await db.auth.admin.createUser({
    email: usernameToEmail(username),
    password,
    email_confirm: true,
  });
  if (userError || !user.user) {
    await db.from("teams").delete().eq("id", team.id);
    back(path, "error", `No se pudo crear el usuario: ${userError?.message}`);
  }
  await db.from("profiles").insert({ id: user.user.id, username, role: "team", team_id: team.id });

  if (groupId) {
    try {
      await assignGroup(db, team.id, groupId);
    } catch (e) {
      back(path, "error", `Equipo creado, pero no se pudo asignar el grupo: ${errorMessage(e)}`);
    }
  }
  done(path, `Equipo "${name}" creado con usuario ${username}`);
}

export async function updateTeam(teamId: string, formData: FormData) {
  const db = await adminClient();
  const path = `/admin/equipos/${teamId}`;
  const { error } = await db
    .from("teams")
    .update({ name: str(formData, "name"), active: formData.get("active") === "on" })
    .eq("id", teamId);
  if (error) back(path, "error", error.message);

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("player_")) continue;
    const playerId = key.slice(7);
    const playerName = String(value).trim();
    // Para quitar un jugador está deletePlayer, que avisa de sus partidos
    if (playerName) await db.from("players").update({ name: playerName }).eq("id", playerId).eq("team_id", teamId);
  }
  const newPlayer = str(formData, "new_player");
  if (newPlayer) await db.from("players").insert({ team_id: teamId, name: newPlayer, position: 9 });

  done(path, "Equipo guardado");
}

export async function setTeamGroup(teamId: string, formData: FormData) {
  const db = await adminClient();
  const path = String(formData.get("return_to") || `/admin/equipos/${teamId}`);
  try {
    await assignGroup(db, teamId, str(formData, "group_id") || null);
  } catch (e) {
    back(path, "error", errorMessage(e));
  }
  done(path, "Grupo actualizado y partidos generados");
}

export async function resetPassword(teamId: string, formData: FormData) {
  const db = await adminClient();
  const path = `/admin/equipos/${teamId}`;
  const password = str(formData, "password");
  if (password.length < 6) back(path, "error", "La contraseña debe tener al menos 6 caracteres");
  const { data: profile } = await db.from("profiles").select("id").eq("team_id", teamId).maybeSingle();
  if (!profile) back(path, "error", "Este equipo no tiene usuario");
  const { error } = await db.auth.admin.updateUserById(profile.id, { password });
  if (error) back(path, "error", error.message);
  done(path, "Contraseña cambiada");
}

// Borra el equipo con sus jugadores, su usuario, sus partidos y su historial
export async function deleteTeam(teamId: string, formData: FormData) {
  const db = await adminClient();
  requireConfirm(formData, `/admin/equipos/${teamId}`);
  const path = "/admin/equipos";
  const { data: team } = await db.from("teams").select("name").eq("id", teamId).maybeSingle();
  if (!team) back(path, "error", "Equipo no encontrado");

  const { error: matchesError } = await db
    .from("matches")
    .delete()
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`);
  if (matchesError) back(path, "error", matchesError.message);
  const { error: entriesError } = await db.from("group_entries").delete().eq("team_id", teamId);
  if (entriesError) back(path, "error", entriesError.message);

  // Al borrar el usuario de Auth se borra su perfil
  const { data: profiles } = await db.from("profiles").select("id").eq("team_id", teamId);
  for (const p of profiles ?? []) {
    const { error } = await db.auth.admin.deleteUser(p.id);
    if (error) back(path, "error", `No se pudo borrar el usuario: ${error.message}`);
  }

  const { error } = await db.from("teams").delete().eq("id", teamId);
  if (error) back(path, "error", error.message);
  done(path, `Equipo "${team.name}" borrado`);
}

// Borra un jugador y lo quita de las alineaciones de los partidos en que salió
export async function deletePlayer(teamId: string, playerId: string, formData: FormData) {
  const db = await adminClient();
  const path = `/admin/equipos/${teamId}`;
  requireConfirm(formData, path);
  for (const side of ["home_players", "away_players"] as const) {
    const { data: rows } = await db.from("matches").select(`id, ${side}`).contains(side, [playerId]);
    for (const row of (rows ?? []) as Record<string, unknown>[]) {
      const list = ((row[side] as string[] | null) ?? []).filter((id) => id !== playerId);
      await db
        .from("matches")
        .update({ [side]: list.length ? list : null })
        .eq("id", row.id as string);
    }
  }
  const { error } = await db.from("players").delete().eq("id", playerId).eq("team_id", teamId);
  if (error) back(path, "error", error.message);
  done(path, "Jugador/a borrado");
}

// ---------------------------------------------------------------- Partidos

// Ojo: si luego se cambia algún equipo de ese grupo, el partido se vuelve a crear vacío
export async function deleteMatch(matchId: string, formData: FormData) {
  const db = await adminClient();
  requireConfirm(formData, `/admin/partidos/${matchId}`);
  const { error } = await db.from("matches").delete().eq("id", matchId);
  if (error) back(`/admin/partidos/${matchId}`, "error", error.message);
  done("/admin/partidos", "Partido borrado");
}

export async function setResult(matchId: string, formData: FormData) {
  const db = await adminClient();
  const path = `/admin/partidos/${matchId}`;
  const { data: m } = await db.from("matches").select("*").eq("id", matchId).single<Match>();
  if (!m) back(path, "error", "Partido no encontrado");

  const type = str(formData, "type");
  const playedOn = str(formData, "played_on") || null;
  let update: Partial<Match>;

  if (type === "pending") {
    update = {
      status: "pending",
      result_type: "normal",
      sets: null,
      winner_team_id: null,
      home_players: null,
      away_players: null,
      played_on: null,
      reported_by_team_id: null,
      reported_at: null,
      confirmed_at: null,
      dispute_reason: null,
    };
  } else if (type === "void") {
    update = { status: "resolved", result_type: "void", sets: null, winner_team_id: null, played_on: playedOn };
  } else if (type === "walkover") {
    const winner = str(formData, "winner");
    if (winner !== m.home_team_id && winner !== m.away_team_id) back(path, "error", "Elige qué equipo gana");
    update = { status: "resolved", result_type: "walkover", sets: null, winner_team_id: winner, played_on: playedOn };
  } else {
    let sets: SetScore[] = [];
    let side: "home" | "away" = "home";
    try {
      sets = parseSets(formData);
      side = validateSets(sets);
    } catch (e) {
      back(path, "error", errorMessage(e));
    }
    const hp = formData.getAll("home_players").map(String);
    const ap = formData.getAll("away_players").map(String);
    const badCount = (n: number) => n > 0 && (n < 2 || n > 3);
    if (badCount(hp.length) || badCount(ap.length)) {
      back(path, "error", "Si marcas jugadores, tienen que ser 2 o 3 por equipo");
    }
    update = {
      status: "resolved",
      result_type: "normal",
      sets,
      winner_team_id: side === "home" ? m.home_team_id : m.away_team_id,
      home_players: hp.length ? hp : null,
      away_players: ap.length ? ap : null,
      played_on: playedOn,
    };
  }

  const { error } = await db.from("matches").update(update).eq("id", matchId);
  if (error) back(path, "error", error.message);

  if (update.status === "resolved") {
    const { data: teams } = await db.from("teams").select("id, name").in("id", [m.home_team_id, m.away_team_id]);
    const name = (id: string) => teams?.find((t) => t.id === id)?.name ?? "¿?";
    const result =
      update.result_type === "normal"
        ? (update.sets ?? []).map(([h, a]) => `${h}-${a}`).join(" ")
        : formatResult({ result_type: update.result_type!, sets: null });
    const message = `El administrador ha puesto el resultado de ${name(m.home_team_id)} vs ${name(m.away_team_id)}: ${result}.`;
    await db.from("notifications").insert(
      [m.home_team_id, m.away_team_id].map((team_id) => ({ team_id, match_id: matchId, kind: "resolved", message })),
    );
  }
  done(path, "Resultado guardado");
}

// ---------------------------------------------------------------- Avisos

export async function createAnnouncement(formData: FormData) {
  const db = await adminClient();
  const title = str(formData, "title");
  if (!title) back("/admin/avisos", "error", "Falta el título");
  const { error } = await db
    .from("announcements")
    .insert({ title, body: str(formData, "body"), pinned: formData.get("pinned") === "on" });
  if (error) back("/admin/avisos", "error", error.message);
  done("/admin/avisos", "Aviso publicado");
}

export async function deleteAnnouncement(id: string) {
  const db = await adminClient();
  await db.from("announcements").delete().eq("id", id);
  done("/admin/avisos", "Aviso borrado");
}
