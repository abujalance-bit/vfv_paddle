import type { Player, Team } from "@/lib/types";

// Campos de marcador por sets: s1h/s1a, s2h/s2a, s3h/s3a
export function SetsInputs({
  home,
  away,
  initial,
  showTieBreakHint = false,
}: {
  home: Team;
  away: Team;
  initial?: [number, number][] | null;
  // La aclaración del super tie-break solo la ve el admin
  showTieBreakHint?: boolean;
}) {
  return (
    <div>
      <div className="grid grid-cols-[1fr_repeat(3,3.5rem)] items-center gap-2 text-sm">
        <span />
        {[1, 2, 3].map((i) => (
          <span key={i} className="text-center text-xs font-medium text-muted">
            Set {i}
          </span>
        ))}
        {[home, away].map((team, side) => (
          <div key={team.id} className="contents">
            <span className="truncate font-medium">{team.name}</span>
            {[1, 2, 3].map((i) => (
              <input
                key={i}
                name={`s${i}${side === 0 ? "h" : "a"}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={99}
                defaultValue={initial?.[i - 1]?.[side] ?? ""}
                className="input px-1 text-center"
                aria-label={`${team.name} set ${i}`}
              />
            ))}
          </div>
        ))}
      </div>
      {showTieBreakHint && (
        <p className="mt-1 text-xs text-muted">El tercer set solo si hizo falta (vale también un super tie-break, p. ej. 10-8).</p>
      )}
    </div>
  );
}

export function PlayerPicker({
  team,
  players,
  name,
  selected,
}: {
  team: Team;
  players: Player[];
  name: string;
  selected?: string[] | null;
}) {
  return (
    <fieldset>
      <legend className="label">Jugaron por {team.name} (2 o 3)</legend>
      <div className="flex flex-wrap gap-2">
        {players.map((p, i) => (
          <label
            key={p.id}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm ring-1 ring-line has-[:checked]:bg-lime/10 has-[:checked]:ring-lime"
          >
            <input type="checkbox" name={name} value={p.id} defaultChecked={selected?.includes(p.id)} className="accent-lime" />
            {p.name}
            {i === 0 && (
              <span className="rounded bg-lime/15 px-1 text-[10px] font-black text-lime" title="Capitán/a">
                C
              </span>
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
