import { useCallback, useEffect, useRef, useState } from "react";
import type { ColumnDefinition, Tabulator as TabulatorType } from "tabulator-tables";

import type { GsmMode, GsmReportResponse, GsmRowIdentity, GsmRowUpdate } from "../../api/types";
import { buildColumns } from "./columns";
import {
  calculateLayoutViewportTop,
  calculateTableHeight,
  TABLE_HEADER_FALLBACK_HEIGHT,
} from "./tableViewport";

const tabulatorModulePromise = import("tabulator-tables");
const COMPACT_VIEWPORT_QUERY = "(max-width: 1280px)";
const NARROW_VIEWPORT_QUERY = "(max-width: 760px)";
const NARROW_RESPONSIVE_FIELDS = new Set(["gv_equipment", "instrument"]);

const responsiveCollapseColumn: ColumnDefinition = {
  title: "",
  formatter: "responsiveCollapse",
  width: 28,
  minWidth: 28,
  maxWidth: 28,
  frozen: true,
  hozAlign: "center",
  headerSort: false,
  responsive: 0,
};

function prioritizeNarrowColumns(columns: ColumnDefinition[]): ColumnDefinition[] {
  return columns.map((column) => {
    const nestedColumns = column.columns ? prioritizeNarrowColumns(column.columns) : undefined;
    const field = typeof column.field === "string" ? column.field : "";
    const nextColumn = nestedColumns ? { ...column, columns: nestedColumns } : column;

    return NARROW_RESPONSIVE_FIELDS.has(field) ? { ...nextColumn, responsive: 2 } : nextColumn;
  });
}

function responsiveLayoutCollapseFormatter(data: Array<{ title: string; value: unknown }>): HTMLElement | "" {
  if (!data.length) return "";

  const details = document.createElement("div");
  details.className = "gsm-responsive-details";

  data.forEach(({ title, value }) => {
    const item = document.createElement("div");
    item.className = "gsm-responsive-detail-item";

    const label = document.createElement("span");
    label.className = "gsm-responsive-detail-label";
    label.textContent = title.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, "").trim();

    const content = document.createElement("strong");
    content.className = "gsm-responsive-detail-value";
    content.textContent = value instanceof Node ? value.textContent || "—" : String(value ?? "—");

    item.append(label, content);
    details.append(item);
  });

  return details;
}

interface GsmTableProps {
  report: GsmReportResponse;
  mode: GsmMode;
  onRowUpdate: (identity: GsmRowIdentity, update: GsmRowUpdate) => Promise<void>;
  onUpdateError: (error: unknown) => void;
  onWaybillChange: (waybillNumber: string | null) => void;
  isFetching?: boolean;
}

export function GsmTable({ report, mode, onRowUpdate, onUpdateError, onWaybillChange, isFetching = false }: GsmTableProps) {
  const tableElement = useRef<HTMLDivElement>(null);
  const tableInstance = useRef<TabulatorType | null>(null);
  const rowsRef = useRef(report.rows);
  const summaryRef = useRef(report.summary);
  const [isCompactViewport, setIsCompactViewport] = useState(
    () => typeof window !== "undefined" && window.matchMedia(COMPACT_VIEWPORT_QUERY).matches,
  );
  const [isNarrowViewport, setIsNarrowViewport] = useState(
    () => typeof window !== "undefined" && window.matchMedia(NARROW_VIEWPORT_QUERY).matches,
  );

  rowsRef.current = report.rows;
  summaryRef.current = report.summary;

  const getTableHeight = useCallback((rowCount = rowsRef.current.length) => {
    const tableTop = tableElement.current
      ? calculateLayoutViewportTop(tableElement.current)
      : 0;
    const headerHeight = tableElement.current
      ?.querySelector<HTMLElement>(".tabulator-header")
      ?.getBoundingClientRect().height ?? TABLE_HEADER_FALLBACK_HEIGHT;
    return calculateTableHeight(tableTop, window.innerHeight, rowCount, headerHeight);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia(COMPACT_VIEWPORT_QUERY);
    const handleViewportChange = (event: MediaQueryListEvent) => setIsCompactViewport(event.matches);
    mediaQuery.addEventListener("change", handleViewportChange);
    return () => mediaQuery.removeEventListener("change", handleViewportChange);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia(NARROW_VIEWPORT_QUERY);
    const handleViewportChange = (event: MediaQueryListEvent) => setIsNarrowViewport(event.matches);
    mediaQuery.addEventListener("change", handleViewportChange);
    return () => mediaQuery.removeEventListener("change", handleViewportChange);
  }, []);

  useEffect(() => {
    if (!tableElement.current) return;
    let disposed = false;
    let handleTableViewportResize: (() => void) | null = null;
    tableInstance.current?.destroy();
    async function createTable() {
      const { TabulatorFull } = await tabulatorModulePromise;
      if (disposed || !tableElement.current) return;
      const baseColumns = buildColumns(mode, onRowUpdate, onUpdateError, () => summaryRef.current) as ColumnDefinition[];
      const responsiveColumns = isNarrowViewport ? prioritizeNarrowColumns(baseColumns) : baseColumns;
      const columns = isCompactViewport
        ? [responsiveColumns[0], responsiveCollapseColumn, ...responsiveColumns.slice(1)]
        : responsiveColumns;
      tableInstance.current = new TabulatorFull(tableElement.current, {
        data: rowsRef.current,
        columns,
        layout: "fitColumns",
        responsiveLayout: isCompactViewport ? "collapse" : false,
        responsiveLayoutCollapseStartOpen: false,
        responsiveLayoutCollapseUseFormatters: false,
        responsiveLayoutCollapseFormatter,
        layoutColumnsOnNewData: false,
        height: getTableHeight(),
        renderVertical: "virtual",
        movableColumns: false,
        resizableRows: false,
        columnDefaults: {
          headerWordWrap: true,
          headerSort: false,
          resizable: false,
        },
        placeholder: "Нет данных за выбранный период",
        rowHeight: 34,
        rowFormatter(row) {
          const element = row.getElement();
          const data = row.getData();
          element.classList.toggle("gsm-row-editable", typeof data.id === "number");
          if (element.dataset.gsmWaybillBound !== "true") {
            element.addEventListener("mouseenter", () => {
              const waybillNumber = row.getData().waybill_number;
              onWaybillChange(typeof waybillNumber === "string" && waybillNumber.trim() ? waybillNumber.trim() : null);
            });
            element.addEventListener("mouseleave", () => onWaybillChange(null));
            element.dataset.gsmWaybillBound = "true";
          }
        },
      });
      handleTableViewportResize = () => {
        tableInstance.current?.setHeight(getTableHeight());
      };
      window.addEventListener("resize", handleTableViewportResize);
      window.visualViewport?.addEventListener("resize", handleTableViewportResize);
    }
    void createTable();
    return () => {
      disposed = true;
      if (handleTableViewportResize) {
        window.removeEventListener("resize", handleTableViewportResize);
        window.visualViewport?.removeEventListener("resize", handleTableViewportResize);
      }
      tableInstance.current?.destroy();
      tableInstance.current = null;
      onWaybillChange(null);
    };
  }, [getTableHeight, isCompactViewport, isNarrowViewport, mode, onRowUpdate, onUpdateError, onWaybillChange]);

  useEffect(() => {
    if (!tableInstance.current) return;
    const table = tableInstance.current;
    void table.replaceData(report.rows).then(() => {
      if (tableInstance.current === table) table.setHeight(getTableHeight(report.rows.length));
    });
  }, [getTableHeight, report.rows]);

  return (
    <section className={`gsm-table-shell${isFetching ? " is-refreshing" : ""}`} aria-busy={isFetching} aria-label="Отчет ГСМ">
      <div ref={tableElement} className="gsm-table" />
    </section>
  );
}
