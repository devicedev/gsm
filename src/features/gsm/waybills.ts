const WAYBILL_SEPARATOR = /[,;\n]+/;

export function splitWaybillNumbers(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];

  return Array.from(
    new Set(
      value
        .split(WAYBILL_SEPARATOR)
        .map((number) => number.trim())
        .filter(Boolean),
    ),
  );
}
