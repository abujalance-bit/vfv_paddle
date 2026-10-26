// Campos start_date / end_date de una fase
export function PeriodDates({ start, end }: { start: string; end: string }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="label" htmlFor="start_date">Empieza</label>
        <input id="start_date" name="start_date" type="date" className="input" defaultValue={start} required />
      </div>
      <div>
        <label className="label" htmlFor="end_date">Termina</label>
        <input id="end_date" name="end_date" type="date" className="input" defaultValue={end} required />
      </div>
    </div>
  );
}
