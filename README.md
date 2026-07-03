# FG Warehouse Stock Dashboard

A production-ready, fully client-side dashboard for monitoring **Finished Goods (FG) warehouse stock** from your daily ERP export. No backend, no build step, no server-side code — it runs entirely in the browser and is ready to host on GitHub Pages (or any static file host).

---

## ✨ Features

- **Automatic ERP ingestion** — reads `data/StockAsOnCurrentDate.xlsm` directly in the browser using SheetJS. Replace the file daily and refresh; no code changes needed.
- **FG-only filtering** — automatically detects every Finished Goods warehouse column and ignores Business Partner, Employee, Service, Raw Material, Shop Floor, Scrap, R&D, Line Reject, On Hold, Purchase Reject, **AMAZON FG**, **FLIPKART FG**, **FG FAULTY**, and **FG (Export)** warehouses.
- **KPIs** — Total FG Stock, Total Products, Total FG Warehouses, Last Updated timestamp.
- **Filters** — Warehouse dropdown, Product Code search, Product Name search (instant, debounced).
- **Charts** (Chart.js) — Warehouse-wise Stock, Top 20 Products by Stock, Low Stock Products, Zero Stock Products — all update live as you change filters.
- **Data table** (DataTables) — sortable, searchable, paginated, with Export to Excel, Export to CSV, and Print.
- **Modern UI** — glassmorphism cards, dark/light mode toggle, smooth animations, fully responsive/mobile-friendly.
- **Performance** — built to comfortably handle 20,000+ product rows (deferred rendering, indexed search, minimal DOM writes).

---

## 📁 Project Structure

```
/
├── index.html                       # Main dashboard page
├── css/
│   └── style.css                    # Full design system (dark/light themes, layout, animations)
├── js/
│   ├── config.js                    # All tunable settings (paths, thresholds, column layout)
│   ├── excel.js                     # Loads & parses the .xlsm file into a clean data model
│   ├── charts.js                    # Builds/updates the 4 Chart.js visualizations
│   ├── filters.js                   # Filter state + derived/filtered data helpers
│   └── app.js                       # Main orchestration: KPIs, table, exports, dark mode, events
├── data/
│   └── StockAsOnCurrentDate.xlsm    # <-- Replace this file daily with the new ERP export
├── assets/
│   └── icons/                       # (reserved for any custom icon assets)
└── README.md
```

---

## 🔄 Daily Update Process

1. Export the latest stock report from your ERP as `StockAsOnCurrentDate.xlsm` (same format as always).
2. Replace the file at `data/StockAsOnCurrentDate.xlsm` with the new export (keep the exact same filename).
3. Refresh the dashboard in the browser.

That's it — no code changes, no rebuild, no redeploy required for data updates.

> The dashboard fetches the file with cache-busting and reads the HTTP `Last-Modified` header when available to show a genuine "Last Updated" timestamp. If your host doesn't return that header, it falls back to the moment the dashboard loaded the file.

---

## 🧠 How FG Warehouses Are Detected

Your ERP export has two header rows above the product data:

- **Row 1** — Warehouse *code* (e.g. `AS02FG`)
- **Row 2** — Warehouse *name* (e.g. `GUWAHATI FG`)

A column is treated as an **FG Warehouse** when:

1. Its code ends with `FG`, **and**
2. Its name does **not** contain `AMAZON`, `FLIPKART`, `FAULTY`, or `EXPORT`.

This automatically excludes Business Partner (`BP`), Employee (`EM`), Service (`SP`), Raw Material (`RM`), Shop Floor (`SF`), Scrap (`SR`), R&D (`AD`), Line Reject (`LR`), On Hold (`OH`), Purchase Reject (`PR`) warehouses, along with AMAZON FG, FLIPKART FG, FG FAULTY and FG (Export) variants — exactly as required. Blank/unnamed warehouse columns are skipped automatically.

If your ERP ever introduces a new warehouse type that should be excluded, add the keyword to `EXCLUDED_NAME_KEYWORDS` in `js/config.js` — no other code changes are needed.

---

## ⚙️ Configuration

All tunable values live in `js/config.js`:

| Setting | Purpose |
|---|---|
| `DATA_FILE_PATH` | Path to the ERP export file |
| `LOW_STOCK_THRESHOLD` | Quantity below which a product is flagged "Low Stock" (default: 10) |
| `EXCLUDED_NAME_KEYWORDS` | Warehouse name keywords to exclude from FG classification |
| `TOP_PRODUCTS_COUNT` | Number of products shown in the "Top Products" chart |
| `TABLE_PAGE_LENGTH` | Default rows-per-page in the data table |

The row/column layout constants (`WAREHOUSE_CODE_ROW_INDEX`, `PRODUCT_CODE_COL_INDEX`, etc.) match the current ERP export layout. Only change these if the ERP report's structure itself changes.

---

## 🚀 Deployment to GitHub Pages

1. **Create a repository** (or use an existing one) and push this entire project folder to it:

   ```bash
   git init
   git add .
   git commit -m "Initial commit: FG Warehouse Stock Dashboard"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```

2. **Enable GitHub Pages**:
   - Go to your repository on GitHub → **Settings** → **Pages**.
   - Under **Build and deployment → Source**, choose **Deploy from a branch**.
   - Select branch `main` and folder `/ (root)`, then **Save**.

3. **Wait a minute**, then visit:
   ```
   https://<your-username>.github.io/<your-repo>/
   ```

4. **Update data going forward**: replace `data/StockAsOnCurrentDate.xlsm` in the repo (commit + push) whenever you have a new ERP export. GitHub Pages will serve the new file automatically.

> No build step, no `npm install`, no server — this is a 100% static site.

---

## 🖥️ Running Locally

Because the dashboard uses `fetch()` to load the Excel file, opening `index.html` directly via `file://` will be blocked by the browser's CORS policy. Serve the folder with any simple local web server instead, for example:

```bash
# Python 3
python -m http.server 8080

# Node (if you have npx available)
npx serve .
```

Then open `http://localhost:8080` in your browser.

---

## 🛠️ Technology Stack

- HTML5, CSS3, Vanilla JavaScript (ES6)
- [Chart.js](https://www.chartjs.org/) — charts
- [SheetJS (xlsx)](https://sheetjs.com/) — reads the `.xlsm` ERP export in-browser
- [DataTables](https://datatables.net/) (+ jQuery, a DataTables dependency) — sortable/searchable/paginated product table

No React, Angular, Vue, Node.js, PHP, or Python is used at runtime — everything executes client-side in the browser.

---

## 🔒 Notes & Limitations

- The `.xlsm` file's VBA macros are **not** executed by the dashboard — only the worksheet data is read. This is intentional and safe: the browser never runs spreadsheet macros.
- The dashboard expects the **same report layout every day** (same header rows, same column order for warehouses). If the ERP export format changes structurally, update the relevant constants in `js/config.js`.
- Charts and the "Selected Warehouse Qty" table column respond to the Warehouse filter; the Product Code/Name search fields filter the product list itself and are reflected across KPIs, charts, and the table simultaneously.
