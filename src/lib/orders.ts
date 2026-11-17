import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseDate } from './dates.ts';

export type OrderLine = {
  order_id: string; line_item_id: string; order_date: string; customer_id: string;
  is_repeat_customer: boolean; product_id: string; product_title: string;
  product_category: string; variant: string; quantity: number; unit_price: number;
  discount_amount: number; line_total: number; sales_channel: string;
  fulfillment_status: string; returned: boolean; return_date: string | null;
  return_reason: string | null; refund_amount: number;
};

/** RFC-4180-style quoted CSV parser (commas, escaped quotes, CRLF, final newline). */
export function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (char === '"') {
      if (quoted && csv[i + 1] === '"') { field += '"'; i++; }
      else if (quoted || field.length === 0) quoted = !quoted;
      else throw new Error('Unexpected quote in CSV field');
    } else if (char === ',' && !quoted) { row.push(field); field = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && csv[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else { field += char; }
  }
  if (quoted) throw new Error('Unterminated quoted CSV field');
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}
const columns: (keyof OrderLine)[] = [
  'order_id','line_item_id','order_date','customer_id','is_repeat_customer',
  'product_id','product_title','product_category','variant','quantity','unit_price',
  'discount_amount','line_total','sales_channel','fulfillment_status','returned',
  'return_date','return_reason','refund_amount'
];
function numberField(value: string, field: string, allowBlank = false): number {
  if (value.trim() === '' && allowBlank) return 0;
  if (value.trim() === '' || !Number.isFinite(Number(value))) throw new Error(`Invalid ${field}: ${value}`);
  return Number(value);
}
function booleanField(value: string): boolean {
  if (value === 'True' || value === 'true') return true;
  if (value === 'False' || value === 'false') return false;
  throw new Error(`Invalid boolean: ${value}`);
}
export function parseOrders(csv: string): OrderLine[] {
  const [header, ...rows] = parseCsv(csv.replace(/^\uFEFF/, ''));
  if (!header || header.join('|') !== columns.join('|')) throw new Error('CSV column names or order do not match expected schema');
  const seen = new Set<string>();
  return rows.map((values, index) => {
    if (values.length !== columns.length) throw new Error(`Wrong column count at CSV row ${index + 2}`);
    const raw = Object.fromEntries(columns.map((column, i) => [column, values[i]])) as Record<keyof OrderLine, string>;
    parseDate(raw.order_date);
    if (raw.return_date) parseDate(raw.return_date);
    if (seen.has(raw.line_item_id)) throw new Error(`Duplicate line item: ${raw.line_item_id}`);
    seen.add(raw.line_item_id);
    const returned = booleanField(raw.returned);
    if (returned && !raw.return_date) throw new Error(`Missing return date: ${raw.line_item_id}`);
    const quantity = numberField(raw.quantity, 'quantity');
    if (!Number.isInteger(quantity) || quantity < 0) throw new Error(`Invalid quantity: ${quantity}`);
    return {
      ...raw, quantity, returned,
      is_repeat_customer: booleanField(raw.is_repeat_customer),
      unit_price: numberField(raw.unit_price, 'unit_price'),
      discount_amount: numberField(raw.discount_amount, 'discount_amount'),
      line_total: numberField(raw.line_total, 'line_total'),
      refund_amount: numberField(raw.refund_amount, 'refund_amount', true),
      return_date: raw.return_date || null,
      return_reason: raw.return_reason || null
    };
  });
}
export function loadOrders(): OrderLine[] {
  return parseOrders(readFileSync(join(process.cwd(), 'src/data/store-orders.csv'), 'utf8'));
}
