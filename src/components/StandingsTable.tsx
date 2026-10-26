import type { StandingRow } from "@/lib/standings";
import type { GroupEntry } from "@/lib/types";

type Props = {
  rows: StandingRow[];
  highlightTeamId?: string | null;
  // Si el mes está cerrado, se muestra el movimiento real; si está abierto, la previsión
  closedEntries?: GroupEntry[];
  canGoUp: boolean;
  canGoDown: boolean;
  // Marca los empates pendientes de desempate manual (solo en el panel de cierre)
  showTies?: boolean;
};

export function StandingsTable({ rows, highlightTeamId, closedEntries, canGoUp, canGoDown, showTies }: Props) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs uppercase text-gray-500">
          <th className="w-6 py-1">#</th>
          <th className="py-1">Equipo</th>
          <th className="w-8 py-1 text-center">PJ</th>
          <th className="w-8 py-1 text-center">G</th>
          <th className="w-8 py-1 text-center">P</th>
          <th className="w-10 py-1 text-center">Sets</th>
          <th className="w-10 py-1 text-center font-bold">Pts</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          let movement: "up" | "down" | "stay" | null = null;
          if (closedEntries) {
            movement = closedEntries.find((e) => e.team_id === r.team.id)?.movement ?? null;
          } else if (rows.length >= 2 && rows.some((x) => x.played > 0)) {
            if (i === 0 && canGoUp) movement = "up";
            if (i === rows.length - 1 && canGoDown) movement = "down";
          }
          const setsDiff = r.setsFor - r.setsAgainst;
          return (
            <tr
              key={r.team.id}
              className={`border-t border-gray-100 ${r.team.id === highlightTeamId ? "bg-brand-50 font-semibold" : ""}`}
            >
              <td className="py-2 text-gray-500">{i + 1}</td>
              <td className="py-2">
                <span className="mr-1">
                  {movement === "up" && <span className="text-brand-600">▲</span>}
                  {movement === "down" && <span className="text-red-600">▼</span>}
                </span>
                {r.team.name}
                {r.unresolvedTie && showTies && (
                  <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-800">empate</span>
                )}
              </td>
              <td className="py-2 text-center">{r.played}</td>
              <td className="py-2 text-center">{r.won}</td>
              <td className="py-2 text-center">{r.lost}</td>
              <td className="py-2 text-center text-gray-600">{setsDiff > 0 ? `+${setsDiff}` : setsDiff}</td>
              <td className="py-2 text-center font-bold">{r.points}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
