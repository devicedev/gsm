import { useEffect, useRef, useState } from "react";
import { fetchCorrectionHistory, type CorrectionHistoryEntry } from "../../api/gsmApi";
import type { CommonRow, GsmRowIdentity, GsmRowUpdate } from "../../api/types";

export const correctionLabels: Record<string, string> = {
  operating_hours: "Моточасы", fueling: "Заправлено", dut: "Расход ДУТ", dart: "Расход ДАРТ",
  balance_start: "Остаток на начало", balance_end: "Остаток на конец", mileage: "Пробег",
  instrument: "Прибор учёта",
  tank_capacity: "Объём бака",
};

export function GsmRowDetails({ row, onClose, onUpdate }: {
  row: CommonRow;
  onClose: () => void;
  onUpdate: (identity: GsmRowIdentity, update: GsmRowUpdate) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [history, setHistory] = useState<CorrectionHistoryEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    dialog.current?.showModal();
    let active = true;
    if (row.date && row.equipment_number) {
      void fetchCorrectionHistory({ date: row.date, equipment_number: row.equipment_number, gv_equipment: row.gv_equipment })
        .then((items) => { if (active) setHistory(items); })
        .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "История недоступна"); })
        .finally(() => { if (active) setLoaded(true); });
    }
    return () => { active = false; };
  }, [row]);

  async function reset(field: string) {
    if (!row.date || !row.equipment_number) return;
    setBusy(true);
    setError("");
    try {
      await onUpdate({ date: row.date, equipment_number: row.equipment_number, gv_equipment: row.gv_equipment }, { reset_fields: [field] });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось отменить правку");
    } finally { setBusy(false); }
  }

  return <dialog ref={dialog} className="gsm-details-dialog" aria-labelledby="gsm-details-title" onCancel={onClose}>
    <h2 id="gsm-details-title">{row.equipment_number} · {row.date}</h2>
    <button type="button" onClick={onClose} disabled={busy}>Закрыть</button>
    {row.matching?.status === "ambiguous" ? <>
      <p role="alert">Несколько записей ГВ на одну машину и дату. Показатели ГВ без ручных правок не включены в итоги. Требуется проверка соответствия.</p>
      <div className="gsm-details-scroll"><table><thead><tr><th>Техника ГВ</th><th>Пробег</th><th>Моточасы</th><th>Заправка</th><th>ДУТ</th><th>ДАРТ</th></tr></thead><tbody>
        {row.matching.sources.map((source, index) => <tr key={String(source.id ?? index)}>
          {["technic", "mileage", "operating_hours", "fueling", "dut", "dart"].map(field => <td key={field}>{String(source[field] ?? "—")}</td>)}
        </tr>)}
      </tbody></table></div>
    </> : <p>{row.matching?.status === "one_c_only" ? "За этот день нет данных ГВ." : row.matching?.status === "gv_only" ? "За этот день нет данных 1С." : "Данные ГВ и 1С сопоставлены по машине и дате."}</p>}
    <h3>Действующие правки</h3>
    {Object.keys(row.corrections ?? {}).length === 0 ? <p>Ручных правок нет.</p> : <ul>
      {Object.entries(row.corrections ?? {}).map(([field, value]) => <li key={field}>
        {correctionLabels[field] ?? field}: {value} (исходное ГВ: {row.source_values?.[field] ?? "нет однозначных данных"}) <button type="button" disabled={busy} onClick={() => void reset(field)}>Вернуть данные ГВ</button>
      </li>)}
    </ul>}
    <h3>История правок</h3>
    {error ? <p role="alert">{error}</p> : null}
    {!loaded ? <p role="status">Загружаем историю…</p> : history.length === 0 ? <p>Записей в истории нет.</p> : <ol>
      {history.map(entry => <li key={entry.id}>
        <p>{new Date(entry.changed_at).toLocaleString("ru-RU")} · {entry.changed_by ?? "Автор не записан"}</p>
        <p>{entry.reason || "Причина не указана"}</p>
        {entry.after_values.scope === "equipment" ? <p>Настройка техники {String(entry.after_values.gv_equipment ?? "")}, действует на всех датах.</p> : null}
        <ul>{Object.keys(correctionLabels).filter(field => entry.after_values[field] !== entry.before_values?.[field] && (entry.after_values[field] != null || entry.before_values?.[field] != null)).map(field => <li key={field}>
          {correctionLabels[field]}: {String(entry.before_values?.[field] ?? (entry.after_values.scope === "equipment" ? "Не задано" : "Данные ГВ"))} → {String(entry.after_values[field] ?? (entry.after_values.scope === "equipment" ? "Не задано" : "Данные ГВ"))}
        </li>)}</ul>
        {Array.isArray(entry.after_values.source_rows) && entry.after_values.source_rows.length > 0 ? <details>
          <summary>Исходные данные ГВ на момент правки</summary>
          {entry.after_values.source_rows.map((source: Record<string, unknown>, index: number) => <div key={String(source.id ?? index)}>
            <p>{String(source.technic ?? "ГВ")}</p>
            <ul>{Object.keys(correctionLabels).filter(field => source[field] !== undefined && source[field] !== null).map(field => <li key={field}>{correctionLabels[field]}: {String(source[field])}</li>)}</ul>
          </div>)}
        </details> : null}
      </li>)}
    </ol>}
  </dialog>;
}
