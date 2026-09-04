export const TABLE_MIN_HEIGHT = 320;
export const TABLE_BOTTOM_GAP = 0;
export const TABLE_MIN_CONTENT_HEIGHT = 160;
export const TABLE_ROW_HEIGHT = 34;
export const TABLE_HEADER_FALLBACK_HEIGHT = 119;
const TABLE_BORDER_HEIGHT = 2;

export function calculateTableMaxHeight(tableTop: number, viewportHeight: number): number {
  const availableHeight = Math.floor(viewportHeight - Math.max(0, tableTop) - TABLE_BOTTOM_GAP);
  return Math.max(TABLE_MIN_HEIGHT, availableHeight);
}

export function calculateLayoutViewportTop(element: HTMLElement, scrollY = window.scrollY): number {
  let layoutTop = 0;
  let current: HTMLElement | null = element;

  while (current) {
    layoutTop += current.offsetTop;
    current = current.offsetParent as HTMLElement | null;
  }

  return layoutTop - scrollY;
}

export function calculateTableHeight(
  tableTop: number,
  viewportHeight: number,
  rowCount: number,
  headerHeight = TABLE_HEADER_FALLBACK_HEIGHT,
): number {
  const viewportLimit = calculateTableMaxHeight(tableTop, viewportHeight);
  const contentHeight = Math.ceil(headerHeight) + Math.max(1, rowCount) * TABLE_ROW_HEIGHT + TABLE_BORDER_HEIGHT;
  return Math.min(viewportLimit, Math.max(TABLE_MIN_CONTENT_HEIGHT, contentHeight));
}
