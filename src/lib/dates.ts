/** Analytics are intentionally frozen at the latest day in the supplied dataset. */
export const AS_OF_DATE = '2025-10-27';
export type DateRange = { startDate: string; endDate: string };
export type Period = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'previousWeek' | 'thisMonth' | 'lastMonth';

export function parseDate(date: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Invalid ISO date: ${date}`);
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`Invalid calendar date: ${date}`);
  }
  return parsed;
}
export function isoDate(date: Date): string { return date.toISOString().slice(0, 10); }
export function shiftDays(date: string, days: number): string {
  const result = parseDate(date);
  result.setUTCDate(result.getUTCDate() + days);
  return isoDate(result);
}
export function mondayOf(date: string): string {
  const day = parseDate(date).getUTCDay();
  return shiftDays(date, -(day === 0 ? 6 : day - 1));
}
export function validateRange(startDate: string, endDate: string): void {
  parseDate(startDate); parseDate(endDate);
  if (startDate > endDate) throw new Error('startDate must not be after endDate');
}
export function getPeriodRange(period: Period, asOf: string = AS_OF_DATE): DateRange {
  const date = parseDate(asOf);
  const weekStart = mondayOf(asOf);
  const monthStart = `${asOf.slice(0, 7)}-01`;
  switch (period) {
    case 'today': return { startDate: asOf, endDate: asOf };
    case 'yesterday': { const d = shiftDays(asOf, -1); return { startDate: d, endDate: d }; }
    case 'thisWeek': return { startDate: weekStart, endDate: asOf };
    case 'lastWeek': return { startDate: shiftDays(weekStart, -7), endDate: shiftDays(weekStart, -1) };
    case 'previousWeek': return { startDate: shiftDays(weekStart, -14), endDate: shiftDays(weekStart, -8) };
    case 'thisMonth': return { startDate: monthStart, endDate: asOf };
    case 'lastMonth': {
      date.setUTCDate(0);
      return { startDate: `${isoDate(date).slice(0, 7)}-01`, endDate: isoDate(date) };
    }
  }
}
export function fullCalendarWeek(asOf: string = AS_OF_DATE): DateRange {
  const startDate = mondayOf(asOf);
  return { startDate, endDate: shiftDays(startDate, 6) };
}
