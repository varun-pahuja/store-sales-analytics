# Store Sales Analytics

A responsive **Next.js App Router + TypeScript** dashboard backed by the supplied **Store Order History, May to October 2025** CSV. All analytics use an intentionally fixed reference date of **2025-10-27**. The application reads the local CSV on the server; no database, account, or API keys are required.

## Dataset

- Location: `src/data/store-orders.csv` (a copy of the uploaded source).
- 28 line items, 19 columns; dates span **2025-05-06** to **2025-10-27**.
- 5 categories: Tops, Bottoms, Outerwear, Knitwear, Accessories.
- Each row is a **line item**, not necessarily an order. Multiple rows can share `order_id`.
- CSV dates use `YYYY-MM-DD`. Monetary values are numeric; the CSV does not specify currency. The UI **assumes USD for formatting only**.

## Getting started

Requires Node.js **22+** and npm, with internet access to install packages.

```bash
npm install
npm run dev
```

Open http://localhost:3000. The default period is **This month** (2025-10-01 through 2025-10-27).

```bash
npm test          # Node's built-in TypeScript test runner
npm run typecheck # TypeScript static checking
npm run lint      # ESLint
npm run build     # Production build
npm start         # Serve production build
```

> **Validation status:** The 9 analytics tests passed in the authoring environment. The original authoring environment could not reach `registry.npmjs.org`. Subsequently, the project owner ran a successful Next.js production build locally: compiled in 2.2 seconds, linting and type checks passed, page data collected, static pages generated (4/4), and optimization finalized. This confirms the production build succeeded on the owner's machine; it does not guarantee the application is free of runtime bugs.

## Date rules (inclusive)

All functions accept explicit `startDate` and `endDate` ISO strings, inclusive. `src/lib/dates.ts` provides the presets. Dates are computed in **UTC calendar arithmetic**, not the machine's local timezone, to avoid timezone and daylight-saving drift.

| Preset | Start | End |
| --- | --- | --- |
| Today | 2025-10-27 | 2025-10-27 |
| Yesterday | 2025-10-26 | 2025-10-26 |
| This week to date | 2025-10-27 | 2025-10-27 |
| Last week | 2025-10-20 | 2025-10-26 |
| Previous week | 2025-10-13 | 2025-10-19 |
| This month to date | 2025-10-01 | 2025-10-27 |
| Last month | 2025-09-01 | 2025-09-30 |

Weeks start **Monday** and end **Sunday**. The full calendar week containing October 27 is October 27–November 2 (`fullCalendarWeek()`); the **to-date** analytics range is capped at October 27, the fixed as-of date. Previous weeks are full Monday–Sunday weeks. Last month is the full preceding calendar month. `getPeriodRange(period, asOf?)` can be reused with another reference date.

## Metric API

All exported metric functions live in `src/lib/metrics.ts`. **Every metric accepts `(orders, startDate, endDate)`**, so the start and end date are explicit and testable. Pass the parsed dataset from `loadOrders()` or `parseOrders(csv)`.

| Function | Returns | Date attribution |
| --- | --- | --- |
| `repeatCustomers(orders, start, end)` | Distinct customer count with `is_repeat_customer=true` on any in-range line | `order_date` |
| `uniqueCustomers(orders, start, end)` | Distinct purchasing customers | `order_date` |
| `returnsByCategory(orders, start, end)` | Category, returned line count, returned units, refund amount | **`return_date`** |
| `dailySales(orders, start, end)` | Date, distinct order count, units, gross revenue; includes zero-sale dates | `order_date` |
| `unitsAndRevenueByProduct(orders, start, end)` | Product ID, title, units, gross revenue | `order_date` |
| `unitsAndRevenueByCategory(orders, start, end)` | Category, units, gross revenue | `order_date` |
| `salesSummary(orders, start, end)` | Orders, line items, units, gross revenue, unique and repeat customers | `order_date` |
| `netRevenue(orders, start, end)` | Gross revenue booked in range minus refunds dated in range | Order and return dates respectively |

Example:

```ts
import { loadOrders } from './src/lib/orders.ts';
import { getPeriodRange } from './src/lib/dates.ts';
import {
  repeatCustomers, returnsByCategory, dailySales,
  unitsAndRevenueByProduct, unitsAndRevenueByCategory
} from './src/lib/metrics.ts';

const orders = loadOrders();
const { startDate, endDate } = getPeriodRange('lastWeek');
console.log(repeatCustomers(orders, startDate, endDate));
console.log(returnsByCategory(orders, startDate, endDate));
console.log(dailySales(orders, startDate, endDate));
console.log(unitsAndRevenueByProduct(orders, startDate, endDate));
console.log(unitsAndRevenueByCategory(orders, startDate, endDate));
```

### Important definitions

1. **Repeat customers:** the supplied `is_repeat_customer` flag is authoritative. A customer counts **once** in a selected period if any in-period line is flagged `true`. We do **not** infer a first purchase from the partial May–October history. This is a distinct-customer count, not a repeat purchase rate.
2. **Gross revenue:** sum of CSV `line_total` (already discounted), without subtracting refunds. Includes unfulfilled and partially fulfilled lines because the dataset has no cancellation/payment state and the requirement is sales by order date. The UI states this assumption.
3. **Net revenue:** gross booked revenue during the period **minus refunds processed during that same period**. Returns from earlier orders can therefore reduce this month's net amount. This is a date-based cash-flow-style view, not a cohort-specific net sales measure.
4. **Returns:** use `returned=true` and `return_date` inside the requested interval. `returnedUnits` counts the entire original line quantity because the CSV has no partial-return quantity field. `returnedLines` counts lines, not unique orders. `refund_amount` may differ from original line revenue.
5. **Orders:** distinct `order_id`; **units:** sum of `quantity`; **product grouping:** stable `product_id`; **category grouping:** `product_category`.
6. All filters use inclusive endpoints. Invalid or reversed dates throw an error in metric utilities. The dashboard falls back to its selected preset if custom dates are invalid/out of dataset range.
7. All revenue is rounded to two decimal places for output. No exchange rate conversion is performed.

## Dashboard

The home page provides preset links, a custom start/end date form, summary cards (gross, net, orders, units, repeat customers), daily sales bars, category sales, returns by category, and product sales. This is a **server-rendered dashboard**; the CSV is not uploaded to a third party. The daily chart shows zero-sale dates and hover details.

## Repository structure

```text
store-sales-analytics/
├── src/
│   ├── app/
│   │   ├── globals.css          # Responsive dark theme
│   │   ├── layout.tsx           # Metadata and root layout
│   │   └── page.tsx             # Server-rendered dashboard
│   ├── data/
│   │   └── store-orders.csv     # Original uploaded records
│   └── lib/
│       ├── dates.ts             # Fixed as-of date and date presets
│       ├── metrics.ts           # Independent date-range metric functions
│       └── orders.ts            # CSV parser, validation, loader
├── tests/
│   └── analytics.test.ts        # Node test runner assertions
├── eslint.config.mjs
├── next-env.d.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Tests

`npm test` verifies the 28-row load, escaped/quoted CSV fields, invalid date handling, date presets and year boundaries, order deduplication, repeat customer deduplication, return-date filtering (including earlier-month orders), zero-sales dates, and revenue/unit reconciliation across breakdowns.

## GitHub repository and submission

The project repository is live at **https://github.com/varun-pahuja/store-sales-analytics** on the `main` branch. The owner approved publishing. Submit that repository URL using the course's **Submit** button; this README update does not itself submit the assignment.

## Last-week metrics: actual terminal output

Run from the project root using Node.js 22+ (the built-in TypeScript stripping feature is experimental):

```bash
node --experimental-strip-types --input-type=module -e "import {loadOrders} from './src/lib/orders.ts'; import {getPeriodRange} from './src/lib/dates.ts'; import * as m from './src/lib/metrics.ts'; const orders=loadOrders(); const {startDate,endDate}=getPeriodRange('lastWeek'); console.log(JSON.stringify({period:[startDate,endDate],summary:m.salesSummary(orders,startDate,endDate),returnsByCategory:m.returnsByCategory(orders,startDate,endDate),dailySales:m.dailySales(orders,startDate,endDate),products:m.unitsAndRevenueByProduct(orders,startDate,endDate),categories:m.unitsAndRevenueByCategory(orders,startDate,endDate),netRevenue:m.netRevenue(orders,startDate,endDate)},null,2))"
```

Actual output (captured from the supplied CSV):

```json
{
  "period": [
    "2025-10-20",
    "2025-10-26"
  ],
  "summary": {
    "orders": 4,
    "lineItems": 5,
    "units": 7,
    "revenue": 543.5,
    "uniqueCustomers": 4,
    "repeatCustomers": 2
  },
  "returnsByCategory": [
    {
      "category": "Outerwear",
      "returnedLines": 4,
      "returnedUnits": 4,
      "refunds": 792.15
    }
  ],
  "dailySales": [
    {
      "date": "2025-10-20",
      "orders": 0,
      "units": 0,
      "revenue": 0
    },
    {
      "date": "2025-10-21",
      "orders": 1,
      "units": 1,
      "revenue": 159
    },
    {
      "date": "2025-10-22",
      "orders": 0,
      "units": 0,
      "revenue": 0
    },
    {
      "date": "2025-10-23",
      "orders": 1,
      "units": 2,
      "revenue": 238.5
    },
    {
      "date": "2025-10-24",
      "orders": 0,
      "units": 0,
      "revenue": 0
    },
    {
      "date": "2025-10-25",
      "orders": 1,
      "units": 3,
      "revenue": 72
    },
    {
      "date": "2025-10-26",
      "orders": 1,
      "units": 1,
      "revenue": 74
    }
  ],
  "products": [
    {
      "productId": "P-1001",
      "productTitle": "Alpine Down Parka",
      "units": 1,
      "revenue": 197.1
    },
    {
      "productId": "P-1002",
      "productTitle": "Northridge Insulated Jacket",
      "units": 1,
      "revenue": 159
    },
    {
      "productId": "P-1009",
      "productTitle": "Utility Chino",
      "units": 1,
      "revenue": 74
    },
    {
      "productId": "P-1010",
      "productTitle": "Wool Beanie",
      "units": 3,
      "revenue": 72
    },
    {
      "productId": "P-1011",
      "productTitle": "Leather Gloves",
      "units": 1,
      "revenue": 41.4
    }
  ],
  "categories": [
    {
      "category": "Outerwear",
      "units": 2,
      "revenue": 356.1
    },
    {
      "category": "Accessories",
      "units": 4,
      "revenue": 113.4
    },
    {
      "category": "Bottoms",
      "units": 1,
      "revenue": 74
    }
  ],
  "netRevenue": -248.65
}
```

The returns total is attributed to **return_date**, so refunds can exceed the gross sales booked during this particular week.

## AI-assisted development and verification

**Original Claude Code prompt:** Not available in the provided conversation. Do not represent the following as a verbatim Claude Code transcript. The documented project specification was: create a Next.js TypeScript repository, load the May–October 2025 Store Order History CSV, implement independent metrics with explicit start/end dates, and fix the as-of date at October 27, 2025 with Monday–Sunday weeks.

**Checks and changes:** Verified last week resolves to October 20–26, 2025; confirmed returns use `return_date` instead of `order_date`; ran the metrics against the CSV and recorded the results above. The analytics test suite previously passed 9/9. The project owner subsequently provided terminal output confirming a successful Next.js production build (compilation, lint/type checks, and static page generation).

## Limitations and possible extensions

- The supplied dataset is small and historical, not a live store feed.
- Currency is not provided in the CSV; USD display is a configurable assumption.
- Returns cannot distinguish partial quantities without additional data.
- Repeat-customer flags are supplied rather than inferred from full purchase history.
- Gross sales include orders with `unfulfilled` status; add payment/cancellation fields to compute recognized sales.
- No backend database, authentication, deployment configuration, or live refresh is included.
