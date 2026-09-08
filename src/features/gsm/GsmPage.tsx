import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Fuel, Home, RefreshCw } from "lucide-react";

import { fetchGsmReport, updateGsmCorrection } from "../../api/gsmApi";
import type { CommonRow, GsmMode, GsmRowIdentity, GsmRowUpdate } from "../../api/types";
import { GsmRowDetails } from "./GsmRowDetails";
import { GsmDateRangePicker } from "./GsmDateRangePicker";
import { GsmSelect } from "./GsmSelect";
import { GsmTable } from "./GsmTable";
import { splitWaybillNumbers } from "./waybills";
import { lastSevenDays } from "./dateRanges";

function initialDates() {
  return lastSevenDays(new Date());
}

export function GsmPage() {
  const queryClient = useQueryClient();
  const pageRef = useRef<HTMLElement | null>(null);
  const toolbarRef = useRef<HTMLElement | null>(null);
  const initial = useMemo(initialDates, []);
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);
  const [farm, setFarm] = useState("");
  const [technic, setTechnic] = useState("");
  const [mode, setMode] = useState<GsmMode>("auto");
  const [editError, setEditError] = useState<string | null>(null);
  const [waybillNumber, setWaybillNumber] = useState<string | null>(null);
  const [detailsRow, setDetailsRow] = useState<CommonRow | null>(null);

  const handleModeChange = useCallback((nextMode: GsmMode) => {
    setMode(nextMode);
    setTechnic("");
  }, []);

  const reportQuery = useQuery({
    queryKey: ["gsm-report", dateFrom, dateTo, farm, technic, mode],
    queryFn: () => fetchGsmReport({ from: dateFrom, to: dateTo, farm, technic, mode }),
    enabled: Boolean(dateFrom && dateTo),
    placeholderData: keepPreviousData,
  });

  const report = reportQuery.data;
  const waybillNumbers = splitWaybillNumbers(waybillNumber);
  const hasWaybills = waybillNumbers.length > 0;

  const handleRowUpdate = useCallback(
    async (identity: GsmRowIdentity, update: GsmRowUpdate) => {
      setEditError(null);
      await updateGsmCorrection(identity, update);
      await queryClient.invalidateQueries({ queryKey: ["gsm-report"] });
    },
    [queryClient],
  );

  const handleUpdateError = useCallback((error: unknown) => {
    setEditError(error instanceof Error ? error.message : "Не удалось сохранить изменения");
  }, []);

  const handleWaybillChange = useCallback((value: string | null) => {
    setWaybillNumber(value);
  }, []);

  useEffect(() => {
    const page = pageRef.current;
    const toolbar = toolbarRef.current;
    if (!page || !toolbar) return;

    const updateToolbarHeight = () => {
      page.style.setProperty("--gsm-toolbar-height", `${toolbar.getBoundingClientRect().height}px`);
    };

    updateToolbarHeight();
    const resizeObserver = new ResizeObserver(updateToolbarHeight);
    resizeObserver.observe(toolbar);

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <main ref={pageRef} className="gsm-page">
      <header className="gsm-header">
        <div className="gsm-header-copy">
          <div className="gsm-brandline">
            <span className="gsm-brand-mark" aria-hidden="true">
              <Fuel size={18} strokeWidth={2.2} />
            </span>
            <p className="gsm-kicker">Операционный контроль</p>
          </div>
          <h1>
            ГСМ <span className="gsm-title-accent">·</span> техника
          </h1>
        </div>
        <div className="gsm-header-visual" aria-hidden="true">
          <span className="gsm-visual-grid" />
          <span className="gsm-visual-orbit gsm-visual-orbit-one" />
          <span className="gsm-visual-orbit gsm-visual-orbit-two" />
          <span className="gsm-visual-core">
            <Fuel size={25} strokeWidth={1.8} />
          </span>
          <span className="gsm-visual-dot gsm-visual-dot-one" />
          <span className="gsm-visual-dot gsm-visual-dot-two" />
          <span className="gsm-visual-bars">
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
      </header>

      <section ref={toolbarRef} className="gsm-toolbar" aria-label="Фильтры отчета">
        <GsmDateRangePicker from={dateFrom} to={dateTo} onChange={(from, to) => {
          setDateFrom(from);
          setDateTo(to);
        }} />
        <GsmSelect
          label="Хозяйство"
          value={farm}
          placeholder="Все хозяйства"
          options={report?.filters.farms ?? []}
          onChange={setFarm}
        />
        <GsmSelect
          label="Техника"
          value={technic}
          placeholder="Вся техника"
          options={report?.filters.technics ?? []}
          onChange={setTechnic}
        />
        <fieldset className="gsm-mode-control">
          <legend>Тип техники</legend>
          <div className="gsm-segmented" role="radiogroup" aria-label="Тип техники">
            <label className={mode === "auto" ? "is-active" : ""}>
              <input type="radio" name="gsm-mode" checked={mode === "auto"} onChange={() => handleModeChange("auto")} />
              Автотранспорт
            </label>
            <label className={mode === "agri" ? "is-active" : ""}>
              <input type="radio" name="gsm-mode" checked={mode === "agri"} onChange={() => handleModeChange("agri")} />
              Агротехника
            </label>
          </div>
        </fieldset>
        <div className={`gsm-toolbar-actions${hasWaybills ? " has-waybills" : ""}`} aria-label="Действия">
          <a
            className={`gsm-home-button${hasWaybills ? " is-hidden" : ""}`}
            href="http://10.90.25.243:5000/hub"
            aria-hidden={hasWaybills}
            tabIndex={hasWaybills ? -1 : 0}
          >
            <Home size={16} aria-hidden="true" />
            Главная
          </a>
          <div className={`gsm-toolbar-waybill-swap${hasWaybills ? " is-hidden" : ""}`} aria-hidden={hasWaybills}>
            <button
              className="gsm-refresh-button"
              type="button"
              onClick={() => void reportQuery.refetch()}
              disabled={reportQuery.isFetching}
              tabIndex={hasWaybills ? -1 : 0}
              title="Обновить данные отчёта"
            >
              <RefreshCw size={16} className={reportQuery.isFetching ? "gsm-spin" : ""} aria-hidden="true" />
              <span>Обновить</span>
            </button>
          </div>
          <div
            className={`gsm-waybill-display${hasWaybills ? " is-visible" : " is-hidden"}`}
            title={`Путевые листы: ${waybillNumbers.join(", ")}`}
            aria-live="polite"
            aria-hidden={!hasWaybills}
          >
            <span>Путевые листы</span>
            <div className="gsm-waybill-list">
              {waybillNumbers.map((number) => (
                <span className="gsm-waybill-chip" key={number}>
                  {number}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {reportQuery.isError ? (
        <div className="gsm-alert" role="alert">
          <AlertTriangle size={18} />
          <span>{reportQuery.error instanceof Error ? reportQuery.error.message : "Не удалось загрузить отчёт"}</span>
        </div>
      ) : null}

      {editError ? (
        <div className="gsm-alert" role="alert">
          <AlertTriangle size={18} />
          <span>{editError}</span>
        </div>
      ) : null}

      {reportQuery.isLoading ? <div className="gsm-loading">Загружаем данные отчёта…</div> : null}
      {report?.rows.some(row => row.matching?.status === "ambiguous") ? <div className="gsm-alert" role="alert">
        Есть неоднозначные связи ГВ и 1С. Итоги ГВ неполные — требуется проверить соответствие техники.
      </div> : null}
      {detailsRow ? <GsmRowDetails row={detailsRow} onClose={() => setDetailsRow(null)} onUpdate={handleRowUpdate} /> : null}
      {report ? (
        <GsmTable
          key={report.mode}
          report={report}
          mode={report.mode}
          onRowUpdate={handleRowUpdate}
          onUpdateError={handleUpdateError}
          onWaybillChange={handleWaybillChange}
          isFetching={reportQuery.isFetching}
          onDetails={setDetailsRow}
        />
      ) : null}
    </main>
  );
}
