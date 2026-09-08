import type { GsmQuery, GsmReportResponse, GsmRowIdentity, GsmRowUpdate } from "./types";

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) throw new Error("Сервер вернул пустой ответ");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Сервер вернул некорректный ответ. Обновите страницу и повторите попытку.");
  }
}

export interface CorrectionHistoryEntry {
  id: number;
  changed_at: string;
  changed_by: string | null;
  reason: string | null;
  before_values: Record<string, unknown> | null;
  after_values: Record<string, unknown>;
}

export async function fetchCorrectionHistory(identity: GsmRowIdentity): Promise<CorrectionHistoryEntry[]> {
  const params = new URLSearchParams({ date: identity.date, equipment_number: identity.equipment_number });
  const response = await fetch(`/api/gsm/v1/corrections/history?${params}`, { headers: { Accept: "application/json" } });
  const payload = await readJson(response);
  if (!response.ok) throw new Error(errorMessage(payload, "Не удалось загрузить историю"));
  return (payload as { history: CorrectionHistoryEntry[] }).history;
}

function errorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "object" && payload !== null) {
    const candidate = payload as { message?: unknown; error?: unknown };
    if (typeof candidate.message === "string" && candidate.message) return candidate.message;
    if (typeof candidate.error === "string" && candidate.error) return candidate.error;
  }
  return fallback;
}

export async function fetchGsmReport(query: GsmQuery): Promise<GsmReportResponse> {
  const params = new URLSearchParams({
    from: query.from,
    to: query.to,
    mode: query.mode,
  });
  if (query.farm) params.set("farm", query.farm);
  if (query.technic) params.set("technic", query.technic);

  const response = await fetch(`/api/gsm/v1/report?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(errorMessage(payload, "Не удалось загрузить отчёт ГСМ"));
  }
  return payload as GsmReportResponse;
}

export async function updateGsmRow(rowId: number, update: GsmRowUpdate): Promise<void> {
  const response = await fetch(`/api/gsm/v1/rows/${rowId}`, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(update),
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(errorMessage(payload, "Не удалось сохранить настройки ГСМ"));
  }
}

export async function updateGsmCorrection(identity: GsmRowIdentity, update: GsmRowUpdate): Promise<void> {
  const response = await fetch("/api/gsm/v1/corrections", {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...identity, ...update }),
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(errorMessage(payload, "Не удалось сохранить ручную корректировку ГСМ"));
  }
}
