import { shiftDays, validateRange } from './dates.ts';
import type { OrderLine } from './orders.ts';
export type MetricOptions = { orders?: OrderLine[] };
// No implicit global dataset: functions accept rows explicitly, making them pure and testable.
export type ProductMetric = { productId: string; productTitle: string; units: number; revenue: number };
export type CategoryMetric = { category: string; units: number; revenue: number };
export type DailyMetric = { date: string; orders: number; units: number; revenue: number };
export type ReturnMetric = { category: string; returnedLines: number; returnedUnits: number; refunds: number };
const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
function byOrderDate(orders: OrderLine[], startDate: string, endDate: string): OrderLine[] {
  validateRange(startDate, endDate);
  return orders.filter(row => row.order_date >= startDate && row.order_date <= endDate);
}
/** Count unique customers who have a repeat-customer flag on at least one order in range. */
export function repeatCustomers(orders: OrderLine[], startDate: string, endDate: string): number {
  return new Set(byOrderDate(orders, startDate, endDate).filter(x => x.is_repeat_customer).map(x => x.customer_id)).size;
}
/** Count distinct customers with any order in the selected range. */
export function uniqueCustomers(orders: OrderLine[], startDate: string, endDate: string): number {
  return new Set(byOrderDate(orders, startDate, endDate).map(x => x.customer_id)).size;
}
/** Return events are filtered by return_date, NOT original order_date. */
export function returnsByCategory(orders: OrderLine[], startDate: string, endDate: string): ReturnMetric[] {
  validateRange(startDate, endDate);
  const groups = new Map<string, ReturnMetric>();
  for (const row of orders) {
    if (!row.returned || !row.return_date || row.return_date < startDate || row.return_date > endDate) continue;
    const current = groups.get(row.product_category) ?? { category: row.product_category, returnedLines: 0, returnedUnits: 0, refunds: 0 };
    current.returnedLines++;
    current.returnedUnits += row.quantity;
    current.refunds = money(current.refunds + row.refund_amount);
    groups.set(row.product_category, current);
  }
  return [...groups.values()].sort((a,b) => b.refunds - a.refunds || a.category.localeCompare(b.category));
}
/** Gross sales (after discounts, before refunds) on order_date, including unfulfilled lines. */
export function dailySales(orders: OrderLine[], startDate: string, endDate: string): DailyMetric[] {
  const selected = byOrderDate(orders, startDate, endDate);
  const grouped = new Map<string, { units: number; revenue: number; ids: Set<string> }>();
  for (const row of selected) {
    const current = grouped.get(row.order_date) ?? { units: 0, revenue: 0, ids: new Set<string>() };
    current.ids.add(row.order_id);
    current.units += row.quantity;
    current.revenue = money(current.revenue + row.line_total);
    grouped.set(row.order_date, current);
  }
  const output: DailyMetric[] = [];
  for (let date = startDate; date <= endDate; date = shiftDays(date, 1)) {
    const item = grouped.get(date);
    output.push({ date, orders: item?.ids.size ?? 0, units: item?.units ?? 0, revenue: item?.revenue ?? 0 });
  }
  return output;
}
export function unitsAndRevenueByProduct(orders: OrderLine[], startDate: string, endDate: string): ProductMetric[] {
  const grouped = new Map<string, ProductMetric>();
  for (const row of byOrderDate(orders, startDate, endDate)) {
    const current = grouped.get(row.product_id) ?? { productId: row.product_id, productTitle: row.product_title, units: 0, revenue: 0 };
    current.units += row.quantity;
    current.revenue = money(current.revenue + row.line_total);
    grouped.set(row.product_id, current);
  }
  return [...grouped.values()].sort((a,b) => b.revenue - a.revenue || a.productId.localeCompare(b.productId));
}
export function unitsAndRevenueByCategory(orders: OrderLine[], startDate: string, endDate: string): CategoryMetric[] {
  const grouped = new Map<string, CategoryMetric>();
  for (const row of byOrderDate(orders, startDate, endDate)) {
    const current = grouped.get(row.product_category) ?? { category: row.product_category, units: 0, revenue: 0 };
    current.units += row.quantity;
    current.revenue = money(current.revenue + row.line_total);
    grouped.set(row.product_category, current);
  }
  return [...grouped.values()].sort((a,b) => b.revenue - a.revenue || a.category.localeCompare(b.category));
}
export function salesSummary(orders: OrderLine[], startDate: string, endDate: string) {
  const selected = byOrderDate(orders, startDate, endDate);
  return {
    orders: new Set(selected.map(x => x.order_id)).size,
    lineItems: selected.length,
    units: selected.reduce((sum,x) => sum + x.quantity, 0),
    revenue: money(selected.reduce((sum,x) => sum + x.line_total, 0)),
    uniqueCustomers: uniqueCustomers(orders, startDate, endDate),
    repeatCustomers: repeatCustomers(orders, startDate, endDate)
  };
}
/** Net cash view: sales booked in range less refunds processed in range. */
export function netRevenue(orders: OrderLine[], startDate: string, endDate: string): number {
  return money(salesSummary(orders, startDate, endDate).revenue - returnsByCategory(orders, startDate, endDate).reduce((sum,x) => sum + x.refunds, 0));
}
