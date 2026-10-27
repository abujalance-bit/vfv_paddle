// Borrado con confirmación: avisa de lo que depende del registro antes de borrarlo
export function DeleteBox({
  title,
  action,
  dependencies,
  note,
  compact = false,
}: {
  title: string;
  action: (formData: FormData) => void | Promise<void>;
  // "3 partidos con resultado", "historial de 2 fases"... (las que sean 0 no se muestran)
  dependencies: [count: number, label: string][];
  note?: string;
  compact?: boolean;
}) {
  const deps = dependencies.filter(([n]) => n > 0);
  return (
    <details className={compact ? "text-sm" : "rounded-2xl border border-down/30 p-3"}>
      <summary className={`cursor-pointer font-semibold text-down ${compact ? "text-xs" : "text-sm"}`}>{title}</summary>
      <form action={action} className="mt-3 space-y-3">
        {deps.length > 0 ? (
          <div className="rounded-xl bg-down/10 p-3 text-sm ring-1 ring-down/30">
            <p className="font-semibold text-down">⚠ Tiene datos que dependen de esto y también se borrarán:</p>
            <ul className="mt-1 list-disc pl-5 text-fg/85">
              {deps.map(([n, label]) => (
                <li key={label}>
                  {n} {label}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted">No hay nada que dependa de esto.</p>
        )}
        {note && <p className="text-xs text-muted">{note}</p>}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="confirm" className="h-4 w-4 accent-red-500" />
          Sí, quiero borrarlo. No se puede deshacer.
        </label>
        <button className="btn-danger w-full">Borrar</button>
      </form>
    </details>
  );
}
