/**
 * config.js
 * ---------------------------------------------------------------------------
 * Central configuration for the FG Warehouse Stock Dashboard.
 * Change values here if the ERP export layout ever changes — no other
 * file should need to be touched for structural tweaks.
 * ---------------------------------------------------------------------------
 */

const CONFIG = {
  // Path to the ERP export. Replace the file at this path daily; the
  // dashboard will automatically pick up the new data on refresh.
  DATA_FILE_PATH: 'data/StockAsOnCurrentDate.xlsm',

  // If the workbook has multiple sheets, set a specific name here.
  // Leave as null to automatically use the first sheet.
  SHEET_NAME: null,

  // ---- Row layout (0-based indexes as delivered by SheetJS) -------------
  // Row 1 (index 0): Warehouse CODE header (e.g. "AS02FG")
  // Row 2 (index 1): Warehouse NAME header (e.g. "GUWAHATI FG")
  // Row 3+ (index 2+): Product data rows
  WAREHOUSE_CODE_ROW_INDEX: 0,
  WAREHOUSE_NAME_ROW_INDEX: 1,
  DATA_START_ROW_INDEX: 2,

  // ---- Column layout (0-based) ------------------------------------------
  PRODUCT_CODE_COL_INDEX: 0,
  PRODUCT_NAME_COL_INDEX: 2,
  // Warehouse quantity columns begin here and continue to the last
  // populated column in the header rows. Detected automatically, this is
  // just the earliest possible starting point to scan from.
  WAREHOUSE_COL_SCAN_START_INDEX: 4,

  // ---- FG Warehouse detection rules --------------------------------------
  // A column is treated as an "FG Warehouse" when its warehouse CODE ends
  // with this suffix AND its NAME does not contain any excluded keyword.
  // This automatically ignores Business Partner / Employee / Service /
  // Raw Material / Shop Floor / Scrap / R&D / Line Reject / On Hold /
  // Purchase Reject warehouses, plus explicitly excluded FG variants.
  FG_CODE_SUFFIX: 'FG',
  EXCLUDED_NAME_KEYWORDS: ['AMAZON', 'FLIPKART', 'FAULTY', 'EXPORT'],

  // ---- Stock thresholds ---------------------------------------------------
  LOW_STOCK_THRESHOLD: 10, // qty > 0 and < this value is "Low Stock"

  // ---- Chart / table defaults --------------------------------------------
  TOP_PRODUCTS_COUNT: 20,
  LOW_STOCK_CHART_COUNT: 20,
  ZERO_STOCK_CHART_WAREHOUSE_COUNT: 15,
  WAREHOUSE_CHART_MAX_BARS: 50,
  TABLE_PAGE_LENGTH: 25,

  // ---- Misc ---------------------------------------------------------------
  APP_NAME: 'FG Warehouse Stock Dashboard',
  CURRENCY_LOCALE: 'en-IN'
};

// Freeze to avoid accidental mutation elsewhere in the app.
Object.freeze(CONFIG);
Object.freeze(CONFIG.EXCLUDED_NAME_KEYWORDS);
