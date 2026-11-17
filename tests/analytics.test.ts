import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getPeriodRange, fullCalendarWeek, parseDate } from '../src/lib/dates.ts';
import { parseCsv, parseOrders } from '../src/lib/orders.ts';
import { dailySales, repeatCustomers, returnsByCategory, salesSummary, unitsAndRevenueByCategory, unitsAndRevenueByProduct, netRevenue } from '../src/lib/metrics.ts';
const orders = parseOrders(readFileSync(new URL('../src/data/store-orders.csv', import.meta.url), 'utf8'));
test('loads all 28 rows and validates data', () => { assert.equal(orders.length, 28); assert.equal(new Set(orders.map(x => x.line_item_id)).size, 28); });
test('CSV supports quoted commas, escaped quotes and CRLF', () => { assert.deepEqual(parseCsv('a,b\r\n"hello, ""world""",2\r\n'), [['a','b'],['hello, "world"','2']]); });
test('invalid dates are rejected', () => { assert.throws(() => parseDate('2025-02-30')); assert.throws(() => dailySales(orders,'2025-10-28','2025-10-27')); });
test('fixed reference and Monday-Sunday weeks', () => {
  assert.deepEqual(getPeriodRange('today'), { startDate:'2025-10-27',endDate:'2025-10-27' });
  assert.deepEqual(getPeriodRange('thisWeek'), { startDate:'2025-10-27',endDate:'2025-10-27' });
  assert.deepEqual(fullCalendarWeek(), { startDate:'2025-10-27',endDate:'2025-11-02' });
  assert.deepEqual(getPeriodRange('lastWeek'), { startDate:'2025-10-20',endDate:'2025-10-26' });
  assert.deepEqual(getPeriodRange('previousWeek'), { startDate:'2025-10-13',endDate:'2025-10-19' });
  assert.deepEqual(getPeriodRange('thisMonth'), { startDate:'2025-10-01',endDate:'2025-10-27' });
  assert.deepEqual(getPeriodRange('lastMonth'), { startDate:'2025-09-01',endDate:'2025-09-30' });
  assert.deepEqual(getPeriodRange('lastMonth','2025-01-15'), { startDate:'2024-12-01',endDate:'2024-12-31' });
  assert.deepEqual(getPeriodRange('lastWeek','2025-11-02'), { startDate:'2025-10-20',endDate:'2025-10-26' });
});
test('October aggregates use distinct order ids, not line items', () => {
  const s = salesSummary(orders,'2025-10-01','2025-10-27');
  assert.equal(s.lineItems,18); assert.equal(s.orders,13);
  assert.equal(s.repeatCustomers,4);
});
test('repeat customers are unique even when multiple items or orders', () => {
  assert.equal(repeatCustomers(orders,'2025-05-01','2025-10-27'), 7);
});
test('returns use return date (including returns on prior-month orders)', () => {
  const oct = returnsByCategory(orders,'2025-10-01','2025-10-27');
  assert.equal(oct.find(x => x.category === 'Outerwear')?.returnedLines, 5);
  assert.equal(oct.find(x => x.category === 'Bottoms')?.refunds, 74);
  assert.equal(returnsByCategory(orders,'2025-07-01','2025-07-31').find(x=>x.category==='Outerwear')?.refunds,94);
});
test('daily series includes zero days and revenue matches summary', () => {
  const days = dailySales(orders,'2025-10-20','2025-10-26');
  assert.equal(days.length,7); assert.equal(days[1].date,'2025-10-21');
  assert.equal(days[2].revenue,0);
  assert.equal(days.reduce((s,d)=>s+d.revenue,0),salesSummary(orders,'2025-10-20','2025-10-26').revenue);
});
test('product and category totals reconcile with summary', () => {
  const start='2025-05-01', end='2025-10-27', s=salesSummary(orders,start,end);
  for (const metrics of [unitsAndRevenueByProduct(orders,start,end),unitsAndRevenueByCategory(orders,start,end)]) {
    assert.equal(metrics.reduce((sum,x)=>sum+x.units,0),s.units);
    assert.ok(Math.abs(metrics.reduce((sum,x)=>sum+x.revenue,0)-s.revenue)<0.001);
  }
  const refunds=returnsByCategory(orders,start,end).reduce((sum,x)=>sum+x.refunds,0);
  assert.ok(Math.abs(netRevenue(orders,start,end)-(s.revenue-refunds))<0.001);
});
