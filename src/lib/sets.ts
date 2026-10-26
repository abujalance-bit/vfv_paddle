import type { Match } from "@/lib/types";

export type SetScore = [number, number];

// Lee los campos s1h/s1a ... s3h/s3a del formulario. Los sets vacíos se ignoran.
export function parseSets(formData: FormData): SetScore[] {
  const sets: SetScore[] = [];
  for (let i = 1; i <= 3; i++) {
    const h = String(formData.get(`s${i}h`) ?? "").trim();
    const a = String(formData.get(`s${i}a`) ?? "").trim();
    if (h === "" && a === "") continue;
    if (h === "" || a === "") throw new Error(`Falta un marcador en el set ${i}`);
    sets.push([Number(h), Number(a)]);
  }
  return sets;
}

// Misma regla que validate_sets() en la base de datos. Devuelve quién gana.
export function validateSets(sets: SetScore[]): "home" | "away" {
  if (sets.length < 2 || sets.length > 3) throw new Error("Hay que indicar 2 o 3 sets");
  let hw = 0;
  let aw = 0;
  sets.forEach(([h, a], i) => {
    if (hw === 2 || aw === 2) throw new Error("Sobra el tercer set: el partido ya estaba decidido");
    if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0 || h > 99 || a > 99 || h === a) {
      throw new Error(`El set ${i + 1} no es válido`);
    }
    if (h > a) hw++;
    else aw++;
  });
  if (hw < 2 && aw < 2) throw new Error("Nadie ha ganado 2 sets");
  return hw > aw ? "home" : "away";
}

export function formatResult(m: Pick<Match, "result_type" | "sets">) {
  if (m.result_type === "void") return "Anulado (0 pts)";
  if (m.result_type === "walkover") return "No presentado";
  return (m.sets ?? []).map(([h, a]) => `${h}-${a}`).join("  ");
}
