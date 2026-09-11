export interface AgingCalculationInput {
  stockedAt: string | Date;
  currentInstant?: string | Date;
  timeZone?: string;
}

export interface AgingResult {
  inventoryAgeDays: number;
  isAging: boolean;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseDateParts(date: Date, timeZone: string): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  const parts = formatter.formatToParts(date);
  let year = 0;
  let month = 0;
  let day = 0;

  for (const part of parts) {
    if (part.type === 'year') year = parseInt(part.value, 10);
    if (part.type === 'month') month = parseInt(part.value, 10);
    if (part.type === 'day') day = parseInt(part.value, 10);
  }

  return { year, month, day };
}

/**
 * Dealership-timezone-aware aging policy.
 * Calculates literal calendar-day difference between stockedAt and current instant in the dealership's timezone.
 * Classifies a vehicle as aging strictly when inventoryAgeDays > 90 (AGE-001, System Design 4.3).
 */
export function calculateAging(input: AgingCalculationInput): AgingResult {
  const stockedAtRaw = input.stockedAt;
  const currentInstantRaw = input.currentInstant ?? new Date();
  const timeZone = input.timeZone ?? 'UTC';

  const stockedDate = typeof stockedAtRaw === 'string' ? new Date(stockedAtRaw) : stockedAtRaw;
  const currentDate = typeof currentInstantRaw === 'string' ? new Date(currentInstantRaw) : currentInstantRaw;

  const p1 = parseDateParts(stockedDate, timeZone);
  const p2 = parseDateParts(currentDate, timeZone);

  const utcStocked = Date.UTC(p1.year, p1.month - 1, p1.day);
  const utcCurrent = Date.UTC(p2.year, p2.month - 1, p2.day);

  const inventoryAgeDays = Math.max(0, Math.round((utcCurrent - utcStocked) / MS_PER_DAY));
  const isAging = inventoryAgeDays > 90;

  return {
    inventoryAgeDays,
    isAging,
  };
}
