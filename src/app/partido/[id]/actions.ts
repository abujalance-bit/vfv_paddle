"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseSets, validateSets, type SetScore } from "@/lib/sets";
import { back, errorMessage } from "@/lib/flash";

async function rpc(path: string, fn: string, args: Record<string, unknown>, okMessage: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) back(path, "error", error.message);
  revalidatePath("/", "layout");
  back(path, "ok", okMessage);
}

export async function reportResult(matchId: string, formData: FormData) {
  const path = `/partido/${matchId}`;
  let sets: SetScore[] = [];
  try {
    sets = parseSets(formData);
    validateSets(sets);
  } catch (e) {
    back(path, "error", errorMessage(e));
  }
  await rpc(
    path,
    "report_result",
    {
      p_match: matchId,
      p_sets: sets,
      p_home_players: formData.getAll("home_players").map(String),
      p_away_players: formData.getAll("away_players").map(String),
      p_played_on: String(formData.get("played_on") || "") || null,
    },
    "Resultado enviado. El equipo rival tiene que confirmarlo.",
  );
}

export async function confirmResult(matchId: string) {
  await rpc(`/partido/${matchId}`, "confirm_result", { p_match: matchId }, "Resultado confirmado. ¡Gracias!");
}

export async function disputeResult(matchId: string, formData: FormData) {
  await rpc(
    `/partido/${matchId}`,
    "dispute_result",
    { p_match: matchId, p_reason: String(formData.get("reason") ?? "") },
    "Has rechazado el resultado. El administrador lo revisará.",
  );
}

export async function withdrawResult(matchId: string) {
  await rpc(`/partido/${matchId}`, "withdraw_result", { p_match: matchId }, "Resultado retirado.");
}
