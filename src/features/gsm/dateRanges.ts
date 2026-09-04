export interface DateRange {
  from: string;
  to: string;
}

export function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function isoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localDate(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function clampedRange(from: Date, naturalTo: Date, today: Date): DateRange {
  const normalizedToday = localDate(today);
  const to = naturalTo > normalizedToday ? normalizedToday : naturalTo;
  return { from: isoDate(from), to: isoDate(to) };
}

export function lastSevenDays(today: Date): DateRange {
  const to = localDate(today);
  const from = new Date(to.getFullYear(), to.getMonth(), to.getDate() - 6);
  return { from: isoDate(from), to: isoDate(to) };
}

export function monthRange(year: number, month: number, today: Date): DateRange {
  return clampedRange(new Date(year, month - 1, 1), new Date(year, month, 0), today);
}

export function quarterRange(year: number, quarter: number, today: Date): DateRange {
  const startMonth = (quarter - 1) * 3;
  return clampedRange(new Date(year, startMonth, 1), new Date(year, startMonth + 3, 0), today);
}

export function yearRange(year: number, today: Date): DateRange {
  return clampedRange(new Date(year, 0, 1), new Date(year, 11, 31), today);
}

export function isFutureDate(value: string, today: Date): boolean {
  return parseIsoDate(value) > localDate(today);
}
