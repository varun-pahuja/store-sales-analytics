import { AS_OF_DATE, getPeriodRange, type Period } from '@/lib/dates.ts';
import { loadOrders } from '@/lib/orders.ts';
import { dailySales, netRevenue, returnsByCategory, salesSummary, unitsAndRevenueByCategory, unitsAndRevenueByProduct } from '@/lib/metrics.ts';

const periods: { value: Period; label: string }[] = [
  { value: 'today', label: 'Today' }, { value: 'yesterday', label: 'Yesterday' },
  { value: 'thisWeek', label: 'This week' }, { value: 'lastWeek', label: 'Last week' },
  { value: 'previousWeek', label: 'Previous week' }, { value: 'thisMonth', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' }
];
const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
export default async function Home({ searchParams }: { searchParams: Promise<{ period?: string; start?: string; end?: string }> }) {
  const params = await searchParams;
  const selected = periods.find(p => p.value === params.period)?.value ?? 'thisMonth';
  const predefined = getPeriodRange(selected);
  const isCustom = typeof params.start === 'string' && typeof params.end === 'string';
  let startDate = isCustom ? params.start! : predefined.startDate;
  let endDate = isCustom ? params.end! : predefined.endDate;
  // Reject invalid ranges safely rather than rendering a server error.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startDate > endDate || endDate > AS_OF_DATE || startDate < '2025-05-01') {
    startDate = predefined.startDate; endDate = predefined.endDate;
  }
  const orders = loadOrders();
  let summary;
  try { summary = salesSummary(orders, startDate, endDate); }
  catch { startDate = predefined.startDate; endDate = predefined.endDate; summary = salesSummary(orders, startDate, endDate); }
  const days = dailySales(orders, startDate, endDate);
  const categories = unitsAndRevenueByCategory(orders, startDate, endDate);
  const products = unitsAndRevenueByProduct(orders, startDate, endDate);
  const returns = returnsByCategory(orders, startDate, endDate);
  const net = netRevenue(orders, startDate, endDate);
  const max = Math.max(1, ...days.map(d => d.revenue));
  return <main className="container">
    <header><div className="eyebrow">STORE INTELLIGENCE / 2025</div><h1>Sales analytics</h1><p>Order and return trends from the uploaded store history. Data as of <strong>October 27, 2025</strong>.</p></header>
    <nav className="periods" aria-label="Date presets">{periods.map(p => <a key={p.value} className={!isCustom && selected === p.value ? 'active' : ''} href={`/?period=${p.value}`}>{p.label}</a>)}</nav>
    <form className="filters" method="get"><label>From <input type="date" name="start" min="2025-05-01" max={AS_OF_DATE} defaultValue={startDate} required /></label><label>To <input type="date" name="end" min="2025-05-01" max={AS_OF_DATE} defaultValue={endDate} required /></label><button type="submit">Apply range</button><span>{startDate} → {endDate}</span></form>
    <section className="stats" aria-label="Summary metrics">
      <article><small>Gross revenue</small><strong>{money(summary.revenue)}</strong></article>
      <article><small>Net after refunds</small><strong>{money(net)}</strong></article>
      <article><small>Orders</small><strong>{summary.orders}</strong></article>
      <article><small>Units sold</small><strong>{summary.units}</strong></article>
      <article><small>Repeat customers</small><strong>{summary.repeatCustomers}</strong><em>of {summary.uniqueCustomers} unique</em></article>
    </section>
    <section className="panel"><h2>Daily sales</h2><p>Gross revenue by order date. Zero-sales dates are shown.</p><div className="bars" role="img" aria-label="Daily revenue bar chart">{days.map(d => <div className="barSlot" key={d.date} title={`${d.date}: ${money(d.revenue)} (${d.orders} orders)`}><div className="bar" style={{ height: `${Math.max(2, d.revenue / max * 100)}%`, opacity: d.revenue ? 1 : 0.15 }} /></div>)}</div><div className="chartDates"><span>{startDate}</span><span>{endDate}</span></div></section>
    <div className="columns"><section className="panel"><h2>Product categories</h2><table><thead><tr><th>Category</th><th>Units</th><th>Revenue</th></tr></thead><tbody>{categories.map(c => <tr key={c.category}><td>{c.category}</td><td>{c.units}</td><td>{money(c.revenue)}</td></tr>)}</tbody></table>{!categories.length && <p>No sales in this range.</p>}</section>
    <section className="panel"><h2>Returns by category</h2><p>Based on return date, not original order date.</p><table><thead><tr><th>Category</th><th>Lines</th><th>Refunds</th></tr></thead><tbody>{returns.map(r => <tr key={r.category}><td>{r.category}</td><td>{r.returnedLines}</td><td>{money(r.refunds)}</td></tr>)}</tbody></table>{!returns.length && <p>No returns in this range.</p>}</section></div>
    <section className="panel"><h2>Products</h2><table><thead><tr><th>Product</th><th>Units</th><th>Revenue</th></tr></thead><tbody>{products.map(p => <tr key={p.productId}><td>{p.productTitle}<small className="id">{p.productId}</small></td><td>{p.units}</td><td>{money(p.revenue)}</td></tr>)}</tbody></table>{!products.length && <p>No sales in this range.</p>}</section>
    <footer>Gross sales include all fulfillment statuses. Refunds are attributed to the date they were processed. Currency assumed USD; source CSV does not specify a currency.</footer>
  </main>;
}
