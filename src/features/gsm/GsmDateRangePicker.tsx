import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import {
  isFutureDate,
  isoDate,
  lastSevenDays,
  monthRange,
  parseIsoDate,
  quarterRange,
  yearRange,
} from "./dateRanges";

interface GsmDateRangePickerProps {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}

type PeriodMode = "seven" | "month" | "quarter" | "year" | "custom";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const PERIOD_MODES: Array<{ value: PeriodMode; label: string }> = [
  { value: "seven", label: "7 дней" },
  { value: "month", label: "Месяц" },
  { value: "quarter", label: "Квартал" },
  { value: "year", label: "Год" },
  { value: "custom", label: "Свой период" },
];
const QUARTERS = ["I квартал", "II квартал", "III квартал", "IV квартал"];

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function addDays(value: Date, amount: number) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate() + amount);
}

function formatShortDate(value: string, includeYear = false) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    ...(includeYear ? { year: "numeric" } : {}),
  }).format(parseIsoDate(value)).replace(".", "");
}

function formatRange(from: string, to: string) {
  if (!from) return "Выберите период";
  if (!to || from === to) return formatShortDate(from, true);
  const includeFromYear = from.slice(0, 4) !== to.slice(0, 4);
  return `${formatShortDate(from, includeFromYear)} — ${formatShortDate(to, true)}`;
}

function monthName(month: number) {
  const value = new Intl.DateTimeFormat("ru-RU", { month: "short" })
    .format(new Date(2026, month - 1, 1))
    .replace(".", "");
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function rangesEqual(from: string, to: string, range: { from: string; to: string }) {
  return from === range.from && to === range.to;
}

export function GsmDateRangePicker({ from, to, onChange }: GsmDateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [draftMode, setDraftMode] = useState<PeriodMode>("seven");
  const [lastAppliedMode, setLastAppliedMode] = useState<PeriodMode>("seven");
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(parseIsoDate(from)));
  const [periodYear, setPeriodYear] = useState(() => parseIsoDate(from).getFullYear());
  const [yearPageStart, setYearPageStart] = useState(() => new Date().getFullYear() - 11);
  const pickerRef = useRef<HTMLDivElement>(null);
  const today = new Date();
  const currentYear = today.getFullYear();

  useEffect(() => {
    if (!open) return;
    const appliedStart = parseIsoDate(from);
    setDraftFrom(from);
    setDraftTo(to);
    setDraftMode(lastAppliedMode);
    setMonthCursor(startOfMonth(appliedStart));
    setPeriodYear(Math.min(appliedStart.getFullYear(), currentYear));
    setYearPageStart(Math.min(appliedStart.getFullYear(), currentYear) - 11);
  }, [currentYear, from, lastAppliedMode, open, to]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const days = useMemo(() => {
    const first = startOfMonth(monthCursor);
    const mondayOffset = (first.getDay() + 6) % 7;
    const gridStart = addDays(first, -mondayOffset);
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  }, [monthCursor]);

  const monthLabel = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(monthCursor);
  const yearOptions = Array.from({ length: 12 }, (_, index) => yearPageStart + index);
  const canMoveCustomForward = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1)
    <= new Date(currentYear, today.getMonth(), 1);

  const setDraftRange = (range: { from: string; to: string }) => {
    setDraftFrom(range.from);
    setDraftTo(range.to);
  };

  const selectMode = (mode: PeriodMode) => {
    setDraftMode(mode);
    if (mode === "seven") setDraftRange(lastSevenDays(today));
  };

  const applyRange = () => {
    if (!draftFrom || !draftTo || isFutureDate(draftFrom, today) || isFutureDate(draftTo, today)) return;
    const normalizedFrom = draftFrom <= draftTo ? draftFrom : draftTo;
    const normalizedTo = draftFrom <= draftTo ? draftTo : draftFrom;
    onChange(normalizedFrom, normalizedTo);
    setLastAppliedMode(draftMode);
    setOpen(false);
  };

  const handleDayClick = (day: string) => {
    if (isFutureDate(day, today)) return;
    if (!draftFrom || draftTo) {
      setDraftFrom(day);
      setDraftTo("");
      return;
    }
    if (day < draftFrom) {
      setDraftTo(draftFrom);
      setDraftFrom(day);
    } else {
      setDraftTo(day);
    }
  };

  const changePeriodYear = (amount: number) => {
    setPeriodYear((value) => Math.min(currentYear, value + amount));
  };

  return (
    <div className="gsm-custom-control gsm-date-picker" ref={pickerRef}>
      <span className="gsm-control-label">Период</span>
      <button
        className={`gsm-date-trigger${open ? " is-open" : ""}`}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="gsm-date-trigger-icon"><CalendarDays size={17} aria-hidden="true" /></span>
        <span className="gsm-date-trigger-value">{formatRange(from, to)}</span>
        <ChevronDown className="gsm-date-trigger-chevron" size={17} aria-hidden="true" />
      </button>
      {open ? (
        <div className="gsm-date-popover" role="dialog" aria-label="Выбор периода">
          <div className="gsm-date-modes" role="tablist" aria-label="Тип периода">
            {PERIOD_MODES.map((mode) => (
              <button
                className={draftMode === mode.value ? "is-active" : ""}
                key={mode.value}
                type="button"
                role="tab"
                aria-selected={draftMode === mode.value}
                onClick={() => selectMode(mode.value)}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {draftMode === "seven" ? (
            <div className="gsm-period-summary">
              <CalendarDays size={24} aria-hidden="true" />
              <span>Последние 7 календарных дней</span>
              <strong>{formatRange(draftFrom, draftTo)}</strong>
            </div>
          ) : null}

          {draftMode === "month" ? (
            <div className="gsm-period-panel">
              <div className="gsm-period-navigation">
                <button className="gsm-icon-button" type="button" aria-label="Предыдущий год" onClick={() => changePeriodYear(-1)}>
                  <ChevronLeft size={17} aria-hidden="true" />
                </button>
                <strong>{periodYear}</strong>
                <button className="gsm-icon-button" type="button" aria-label="Следующий год" disabled={periodYear >= currentYear} onClick={() => changePeriodYear(1)}>
                  <ChevronRight size={17} aria-hidden="true" />
                </button>
              </div>
              <div className="gsm-month-grid">
                {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => {
                  const isFuture = isFutureDate(isoDate(new Date(periodYear, month - 1, 1)), today);
                  const range = monthRange(periodYear, month, today);
                  return (
                    <button
                      className={`gsm-period-option${rangesEqual(draftFrom, draftTo, range) ? " is-selected" : ""}`}
                      key={month}
                      type="button"
                      disabled={isFuture}
                      onClick={() => setDraftRange(range)}
                    >
                      {monthName(month)}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {draftMode === "quarter" ? (
            <div className="gsm-period-panel">
              <div className="gsm-period-navigation">
                <button className="gsm-icon-button" type="button" aria-label="Предыдущий год" onClick={() => changePeriodYear(-1)}>
                  <ChevronLeft size={17} aria-hidden="true" />
                </button>
                <strong>{periodYear}</strong>
                <button className="gsm-icon-button" type="button" aria-label="Следующий год" disabled={periodYear >= currentYear} onClick={() => changePeriodYear(1)}>
                  <ChevronRight size={17} aria-hidden="true" />
                </button>
              </div>
              <div className="gsm-quarter-grid">
                {QUARTERS.map((label, index) => {
                  const quarter = index + 1;
                  const isFuture = isFutureDate(isoDate(new Date(periodYear, index * 3, 1)), today);
                  const range = quarterRange(periodYear, quarter, today);
                  return (
                    <button
                      className={`gsm-period-option${rangesEqual(draftFrom, draftTo, range) ? " is-selected" : ""}`}
                      key={label}
                      type="button"
                      disabled={isFuture}
                      onClick={() => setDraftRange(range)}
                    >
                      <strong>{label}</strong>
                      <span>{formatRange(range.from, range.to)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {draftMode === "year" ? (
            <div className="gsm-period-panel">
              <div className="gsm-period-navigation">
                <button className="gsm-icon-button" type="button" aria-label="Предыдущие годы" onClick={() => setYearPageStart((value) => value - 12)}>
                  <ChevronLeft size={17} aria-hidden="true" />
                </button>
                <strong>{yearPageStart} — {Math.min(yearPageStart + 11, currentYear)}</strong>
                <button className="gsm-icon-button" type="button" aria-label="Следующие годы" disabled={yearPageStart + 12 > currentYear} onClick={() => setYearPageStart((value) => value + 12)}>
                  <ChevronRight size={17} aria-hidden="true" />
                </button>
              </div>
              <div className="gsm-year-grid">
                {yearOptions.map((year) => {
                  const isFuture = year > currentYear;
                  const range = yearRange(year, today);
                  return (
                    <button
                      className={`gsm-period-option${rangesEqual(draftFrom, draftTo, range) ? " is-selected" : ""}`}
                      key={year}
                      type="button"
                      disabled={isFuture}
                      onClick={() => setDraftRange(range)}
                    >
                      {year}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {draftMode === "custom" ? (
            <div className="gsm-custom-period-panel">
              <div className="gsm-date-popover-head">
                <button className="gsm-icon-button" type="button" aria-label="Предыдущий месяц" onClick={() => setMonthCursor((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))}>
                  <ChevronLeft size={17} aria-hidden="true" />
                </button>
                <strong>{monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</strong>
                <button className="gsm-icon-button" type="button" aria-label="Следующий месяц" disabled={!canMoveCustomForward} onClick={() => setMonthCursor((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))}>
                  <ChevronRight size={17} aria-hidden="true" />
                </button>
              </div>
              <div className="gsm-date-weekdays" aria-hidden="true">
                {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
              </div>
              <div className="gsm-date-grid">
                {days.map((date) => {
                  const day = isoDate(date);
                  const isCurrentMonth = date.getMonth() === monthCursor.getMonth() && date.getFullYear() === monthCursor.getFullYear();
                  const isSelected = day === draftFrom || day === draftTo;
                  const isInRange = Boolean(draftFrom && draftTo && day > draftFrom && day < draftTo);
                  const isStart = day === draftFrom;
                  const isEnd = day === draftTo;
                  const isFuture = isFutureDate(day, today);
                  return (
                    <button
                      className={`gsm-date-day${isCurrentMonth ? "" : " is-outside"}${isSelected ? " is-selected" : ""}${isInRange ? " is-in-range" : ""}${isStart ? " is-range-start" : ""}${isEnd ? " is-range-end" : ""}`}
                      key={day}
                      type="button"
                      aria-label={day}
                      aria-pressed={isSelected}
                      disabled={isFuture}
                      onClick={() => handleDayClick(day)}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="gsm-date-popover-foot">
            <div className="gsm-date-selection">
              <span>Выбрано</span>
              <strong>{draftFrom ? formatRange(draftFrom, draftTo) : "Начните с даты"}</strong>
            </div>
            <button className="gsm-date-apply" type="button" disabled={!draftFrom || !draftTo} onClick={applyRange}>
              <Check size={15} aria-hidden="true" />
              Применить
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
