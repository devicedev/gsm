import type { CellComponent, ColumnDefinition, EmptyCallback, ValueBooleanCallback, ValueVoidCallback } from "tabulator-tables";

import type { CommonRow, GsmInstrument, GsmMode, GsmRowIdentity, GsmRowUpdate, ReportSummary } from "../../api/types";

function formatNumber(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return number.toLocaleString("ru-RU", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

export function normalizeEquipmentNumber(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim().toLocaleUpperCase("ru-RU");
}

function markNumberCell(cell: CellComponent) {
  cell.getElement().classList.add("gsm-number-cell");
}

function numberFormatter(cell: CellComponent) {
  markNumberCell(cell);
  return formatNumber(cell.getValue());
}

type SummaryGetter = (() => ReportSummary | null) | undefined;
type SummarySelector = (summary: ReportSummary) => unknown;

function withTopCalculation(
  column: ColumnDefinition,
  getSummary: SummaryGetter,
  select: SummarySelector,
  formatter: ColumnDefinition["formatter"] = numberFormatter,
): ColumnDefinition {
  if (!getSummary) return column;
  return {
    ...column,
    topCalc: () => {
      const summary = getSummary();
      return summary ? select(summary) : null;
    },
    topCalcFormatter: formatter,
  };
}

type TankAlertLevel = "none" | "warning" | "critical";

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function getTankAlertLevel(balanceEnd: unknown, capacity: unknown): TankAlertLevel {
  const end = finiteNumber(balanceEnd);
  const tankCapacity = finiteNumber(capacity);
  if (end === null || tankCapacity === null || tankCapacity <= 0 || end <= tankCapacity) return "none";
  return end > tankCapacity * 1.5 ? "critical" : "warning";
}

function tankBalanceEndFormatter(cell: CellComponent) {
  const element = cell.getElement();
  markNumberCell(cell);
  const row = cell.getRow().getData() as { tank?: { capacity?: unknown } };
  const alertLevel = getTankAlertLevel(cell.getValue(), row.tank?.capacity);

  element.classList.toggle("gsm-tank-over-capacity", alertLevel !== "none");
  element.classList.toggle("gsm-tank-critical", alertLevel === "critical");
  element.title =
    alertLevel === "critical"
      ? "Критическое превышение объёма бака"
      : alertLevel === "warning"
        ? "Остаток превышает объём бака"
        : "";

  return formatNumber(cell.getValue());
}

const editGlyph = '<svg class="gsm-editable-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="m13.7 3.2 3.1 3.1M4.1 15.9l.8-3.4L13.7 3.7a1.5 1.5 0 0 1 2.1 0l.5.5a1.5 1.5 0 0 1 0 2.1l-8.8 8.8-3.4.8Z"/><path d="M11.9 5.5 14.5 8"/></svg>';

function editableInstrumentFormatter(cell: CellComponent) {
  const element = cell.getElement();
  const isEditable = editableRow(cell);
  element.classList.toggle("gsm-editable-cell", isEditable);
  element.title = isEditable ? "Нажмите, чтобы выбрать прибор учета" : "";
  const value = String(cell.getValue() || "Не выбран");
  return `<span class="gsm-editable-value"><span>${value}</span>${isEditable ? editGlyph : ""}</span>`;
}

function editableNumberFormatter(cell: CellComponent) {
  const element = cell.getElement();
  markNumberCell(cell);
  const isEditable = editableRow(cell);
  element.classList.toggle("gsm-editable-cell", isEditable);
  const labels: Record<string, string> = {
    "engine_hours.gv": "моточасы по GV",
    "fueling.gv": "заправку по GV",
    "tank.capacity": "объем бака",
  };
  const label = labels[String(cell.getField())] || "значение";
  element.title = isEditable ? `Нажмите, чтобы изменить ${label}` : "";
  const value = formatNumber(cell.getValue()) || "—";
  return `<span class="gsm-editable-value"><span>${value}</span>${isEditable ? editGlyph : ""}</span>`;
}

type DifferenceMetric = "mileage" | "engine_hours" | "fueling" | "spent";
type DifferenceTone = "good" | "bad" | "neutral";

export function getDifferenceTone(value: unknown): DifferenceTone {
  const difference = finiteNumber(value);
  if (difference === null) return "neutral";
  return difference > 0 ? "bad" : "good";
}

function formatDifference(cell: CellComponent) {
  const value = finiteNumber(cell.getValue());
  const element = cell.getElement();
  markNumberCell(cell);
  element.classList.add("gsm-difference-cell");
  if (value === null) {
    element.classList.remove("gsm-negative", "gsm-positive");
    return "";
  }
  const tone = getDifferenceTone(value);
  element.classList.toggle("gsm-negative", tone === "bad");
  element.classList.toggle("gsm-positive", tone === "good");
  return formatNumber(value);
}

function rowDifferenceFormatter(_metric: DifferenceMetric) {
  return formatDifference;
}

function summaryDifferenceFormatter(_metric: DifferenceMetric, _getSummary: SummaryGetter) {
  return formatDifference;
}

function provedFormatter(cell: CellComponent) {
  const element = cell.getElement();
  const value = cell.getValue();
  const proved = value === true || value === 1 || value === "1" || value === "true";

  element.classList.toggle("gsm-status-proved", value !== null && value !== undefined && value !== "" && proved);
  element.classList.toggle("gsm-status-unproved", value !== null && value !== undefined && value !== "" && !proved);
  element.title = proved ? "Путевой лист проведён" : value === null || value === undefined || value === "" ? "" : "Путевой лист не проведён";

  if (value === null || value === undefined || value === "") return "";
  const path = proved
    ? '<path d="M3.5 10.1 8 14.5 16.5 5.8" />'
    : '<path d="m5 5 10 10M15 5 5 15" />';
  return `<span class="gsm-status-icon" aria-label="${proved ? "Проведен" : "Не проведен"}"><svg viewBox="0 0 20 20" aria-hidden="true">${path}</svg></span>`;
}

function equipmentNumberFormatter(cell: CellComponent) {
  cell.getElement().classList.add("gsm-equipment-number");
  return normalizeEquipmentNumber(cell.getValue());
}

const numeric = (field: string, title: string, difference?: DifferenceMetric): ColumnDefinition => ({
  field,
  title,
  hozAlign: "right",
  formatter: difference ? rowDifferenceFormatter(difference) : numberFormatter,
  headerSort: false,
  minWidth: 58,
  widthGrow: 1,
  responsive: 1,
  headerWordWrap: true,
});

function summaryNumeric(
  getSummary: SummaryGetter,
  field: string,
  title: string,
  select: SummarySelector,
  difference?: DifferenceMetric,
): ColumnDefinition {
  return withTopCalculation(
    numeric(field, title, difference),
    getSummary,
    select,
    difference ? summaryDifferenceFormatter(difference, getSummary) : numberFormatter,
  );
}

function editableMetricColumn(
  field: string,
  title: string,
  label: string,
  update: (value: number) => GsmRowUpdate,
  onRowUpdate: RowUpdateHandler,
  onUpdateError: UpdateErrorHandler,
): ColumnDefinition {
  return {
    ...numeric(field, title),
    formatter: editableNumberFormatter,
    headerTooltip: `Можно редактировать: ${label}`,
    editor: "number",
    editorParams: { min: 0, step: 0.01 },
    editable: editableRow,
    cellEdited: (cell) => {
      const value = Number(cell.getValue());
      if (!Number.isFinite(value) || value < 0) {
        cell.setValue(cell.getOldValue(), true);
        onUpdateError(new Error(`${label} должно быть неотрицательным числом`));
        return;
      }
      saveCell(cell, update(value), onRowUpdate, onUpdateError);
    },
  };
}

type RowUpdateHandler = (identity: GsmRowIdentity, update: GsmRowUpdate) => Promise<void>;
type UpdateErrorHandler = (error: unknown) => void;

function editableRow(cell: CellComponent): boolean {
  const row = cell.getRow().getData() as { date?: unknown; equipment_number?: unknown };
  return typeof row.date === "string" && Boolean(row.date) && typeof row.equipment_number === "string" && Boolean(row.equipment_number);
}

function rowIdentity(cell: CellComponent): GsmRowIdentity | null {
  const row = cell.getRow().getData() as { date?: unknown; equipment_number?: unknown; gv_equipment?: unknown };
  if (typeof row.date !== "string" || !row.date || typeof row.equipment_number !== "string" || !row.equipment_number) return null;
  return {
    date: row.date,
    equipment_number: row.equipment_number,
    gv_equipment: typeof row.gv_equipment === "string" && row.gv_equipment ? row.gv_equipment : null,
  };
}

function saveCell(
  cell: CellComponent,
  update: GsmRowUpdate,
  onRowUpdate: RowUpdateHandler,
  onUpdateError: UpdateErrorHandler,
) {
  const identity = rowIdentity(cell);
  if (identity === null) return;
  const previousValue = cell.getOldValue();
  void onRowUpdate(identity, update).catch((error: unknown) => {
    cell.setValue(previousValue, true);
    cell.getRow().reformat();
    onUpdateError(error);
  });
}

function instrumentEditor(
  cell: CellComponent,
  onRendered: EmptyCallback,
  success: ValueBooleanCallback,
  cancel: ValueVoidCallback,
  _editorParams: Record<string, unknown>,
): HTMLElement {
  const editor = document.createElement("div");
  editor.className = "gsm-inline-picker";
  editor.setAttribute("role", "listbox");
  editor.setAttribute("aria-label", "Прибор учета");

  let closed = false;
  const finishCancel = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener("pointerdown", handleOutsidePointerDown, true);
    cancel(undefined);
  };
  const finishSuccess = (value: GsmInstrument) => {
    if (closed) return;
    closed = true;
    document.removeEventListener("pointerdown", handleOutsidePointerDown, true);
    success(value);
  };
  const handleOutsidePointerDown = (event: PointerEvent) => {
    if (!editor.contains(event.target as Node)) finishCancel();
  };

  (["ДУТ", "ДАРТ"] as GsmInstrument[]).forEach((option) => {
    const button = document.createElement("button");
    button.className = "gsm-inline-picker-option";
    button.type = "button";
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(cell.getValue() === option));
    button.textContent = option;
    button.addEventListener("click", () => finishSuccess(option));
    editor.append(button);
  });

  document.addEventListener("pointerdown", handleOutsidePointerDown, true);

  editor.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      finishCancel();
    }
  });

  onRendered(() => editor.querySelector<HTMLButtonElement>("button")?.focus());
  return editor;
}

export function buildColumns(
  mode: GsmMode,
  onRowUpdate: RowUpdateHandler,
  onUpdateError: UpdateErrorHandler,
  getSummary?: SummaryGetter,
  onDetails?: (row: CommonRow) => void,
): ColumnDefinition[] {
  const editableEngineHours = editableMetricColumn(
    "engine_hours.gv",
    "По GV",
    "моточасы по GV",
    (value) => ({ engine_hours_gv: value }),
    onRowUpdate,
    onUpdateError,
  );
  const editableFueling = editableMetricColumn(
    "fueling.gv",
    "По GV",
    "заправку по GV",
    (value) => ({ fueling_gv: value }),
    onRowUpdate,
    onUpdateError,
  );
  const totalEngineHours = withTopCalculation(editableEngineHours, getSummary, (summary) => summary.engine_hours.gv);
  const totalFueling = withTopCalculation(editableFueling, getSummary, (summary) => summary.fueling.gv);

  const common: ColumnDefinition[] = [
    {
      title: "",
      field: "proved",
      frozen: true,
      formatter: provedFormatter,
      hozAlign: "center",
      headerSort: false,
      minWidth: 32,
      width: 32,
      maxWidth: 32,
      responsive: 0,
    },
    {
      title: "Дата",
      field: "date",
      frozen: true,
      headerSort: false,
      minWidth: 72,
      widthGrow: 1.1,
      responsive: 0,
    },
    withTopCalculation(
      {
        title: "Номер техники",
        field: "equipment_number",
        frozen: true,
        formatter: equipmentNumberFormatter,
        headerSort: false,
        minWidth: 68,
        widthGrow: 1.3,
        responsive: 0,
        headerWordWrap: true,
      },
      getSummary,
      () => "Итого",
      "plaintext",
    ),
    {
      title: "Техника GV",
      field: "gv_equipment",
      headerSort: false,
      minWidth: 140,
      widthGrow: 3.7,
      responsive: 0,
      headerWordWrap: true,
    },
    {
      title: "Прибор учета",
      field: "instrument",
      formatter: editableInstrumentFormatter,
      editor: instrumentEditor,
      editable: editableRow,
      cellEdited: (cell) => {
        saveCell(cell, { instrument: cell.getValue() as GsmInstrument }, onRowUpdate, onUpdateError);
      },
      headerSort: false,
      minWidth: 80,
      widthGrow: 1.3,
      responsive: 0,
      headerWordWrap: true,
    },
  ];

  const measurementColumns: ColumnDefinition[] =
    mode === "auto"
      ? [
          {
            title: "Пробег",
            columns: [
              summaryNumeric(getSummary, "mileage.one_c", "По 1С", (summary) => summary.mileage?.one_c ?? null),
              summaryNumeric(getSummary, "mileage.gv_plus_3", "По GV+3%", (summary) => summary.mileage?.gv_plus_3 ?? null),
              withTopCalculation(editableMetricColumn("mileage.gv", "По GV", "пробег по GV", value => ({ mileage_gv: value }), onRowUpdate, onUpdateError), getSummary, summary => summary.mileage?.gv ?? null),
              summaryNumeric(getSummary, "mileage.difference", "Разность", (summary) => summary.mileage?.difference ?? null, "mileage"),
            ],
          },
        ]
      : [
          {
            title: "Объем работ по 1С",
            columns: [
              summaryNumeric(getSummary, "work_volume.tn", "ТН", (summary) => summary.work_volume?.tn ?? null),
              summaryNumeric(getSummary, "work_volume.cn", "ЦН", (summary) => summary.work_volume?.cn ?? null),
              summaryNumeric(getSummary, "work_volume.ga", "ГА", (summary) => summary.work_volume?.ga ?? null),
            ],
          },
        ];

  const engineHoursSection: ColumnDefinition = {
    title: "Моточасы",
    columns: [
      summaryNumeric(getSummary, "engine_hours.one_c", "По 1С", (summary) => summary.engine_hours.one_c),
      totalEngineHours,
      summaryNumeric(getSummary, "engine_hours.difference", "Разность", (summary) => summary.engine_hours.difference, "engine_hours"),
    ],
  };

  return [
    ...common,
    ...measurementColumns,
    ...(mode === "auto" ? [] : [engineHoursSection]),
    {
      title: "Заправлено",
      columns:
        mode === "auto"
          ? [
              summaryNumeric(getSummary, "fueling.one_c", "По 1С", (summary) => summary.fueling.one_c),
              summaryNumeric(getSummary, "fueling.gv_plus_5", "По GV+5%", (summary) => summary.fueling.gv_plus_5),
              totalFueling,
              summaryNumeric(getSummary, "fueling.difference", "Разность", (summary) => summary.fueling.difference, "fueling"),
            ]
          : [
              summaryNumeric(getSummary, "fueling.one_c", "По 1С", (summary) => summary.fueling.one_c),
              summaryNumeric(getSummary, "fueling.gv_plus_5", "По GV+5%", (summary) => summary.fueling.gv_plus_5),
              totalFueling,
              summaryNumeric(getSummary, "fueling.difference", "Разность", (summary) => summary.fueling.difference, "fueling"),
            ],
    },
    {
      title: "Списано",
      columns: [
        summaryNumeric(getSummary, "spent.one_c", "По 1С", (summary) => summary.spent.one_c),
        withTopCalculation(editableMetricColumn("spent.gv", "По GV", "расход по GV", value => ({ spent_gv: value }), onRowUpdate, onUpdateError), getSummary, summary => summary.spent.gv),
        summaryNumeric(getSummary, "spent.difference", "Разность", (summary) => summary.spent.difference, "spent"),
      ],
    },
    {
      title: "Бак",
      columns: [
        editableMetricColumn("tank.balance_start", "Остаток<br>на начало<br>дня", "остаток на начало", value => ({ balance_start_gv: value }), onRowUpdate, onUpdateError),
        {
          ...editableMetricColumn("tank.balance_end", "Остаток<br>на конец<br>дня", "остаток на конец", value => ({ balance_end_gv: value }), onRowUpdate, onUpdateError),
          formatter: tankBalanceEndFormatter,
        },
        {
          ...numeric("tank.capacity", "Объем"),
          formatter: editableNumberFormatter,
          editor: "number",
          editorParams: { min: 0, step: 0.01 },
          editable: editableRow,
          cellEdited: (cell) => {
            const value = Number(cell.getValue());
            if (!Number.isFinite(value) || value < 0) return;
            cell.getRow().reformat();
            saveCell(cell, { tank_capacity: value }, onRowUpdate, onUpdateError);
          },
        },
      ],
    },
  ];
}

export { formatNumber };
