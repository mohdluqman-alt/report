/**
 * excel.js
 * ---------------------------------------------------------------------------
 * Responsible for everything related to reading the ERP .xlsm export and
 * turning it into a clean, dashboard-ready JavaScript data model.
 *
 * Exposes a single global: `ExcelEngine`
 * ---------------------------------------------------------------------------
 */

const ExcelEngine = (() => {

  /**
   * Fetch the raw workbook bytes from /data and return a parsed SheetJS
   * workbook object. Also attempts to read the Last-Modified HTTP header
   * so the dashboard can show a genuine "last updated" timestamp for the
   * underlying file rather than just the browser's load time.
   */
  async function fetchWorkbook() {
    const url = `${CONFIG.DATA_FILE_PATH}?_=${Date.now()}`; // cache-bust

    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(
        `Could not load "${CONFIG.DATA_FILE_PATH}" (HTTP ${response.status}). ` +
        `Make sure the ERP export has been placed in the /data folder.`
      );
    }

    let lastModified = response.headers.get('last-modified');
    lastModified = lastModified ? new Date(lastModified) : null;

    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: false });

    return { workbook, lastModified };
  }

  /**
   * Convert the target worksheet into an array-of-arrays (raw grid),
   * preserving blank cells as null so column alignment stays intact.
   */
  function sheetToGrid(workbook) {
    const sheetName = CONFIG.SHEET_NAME || workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" was not found in the workbook.`);
    }
    return XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      raw: true,
      blankrows: true
    });
  }

  /** Normalize whitespace (incl. non-breaking spaces) & case for comparisons. */
  function clean(str) {
    return String(str ?? '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Decide whether a given warehouse code/name pair represents a pure
   * Finished-Goods (FG) warehouse, per the business rules in CONFIG.
   */
  function isFgWarehouse(code, name) {
    const cleanCode = clean(code).toUpperCase();
    const cleanName = clean(name).toUpperCase();

    if (!cleanCode.endsWith(CONFIG.FG_CODE_SUFFIX.toUpperCase())) return false;

    return !CONFIG.EXCLUDED_NAME_KEYWORDS.some((kw) =>
      cleanName.includes(kw.toUpperCase())
    );
  }

  /**
   * Scan the two header rows and auto-detect every FG warehouse column.
   * Blank / unnamed warehouse columns are automatically skipped.
   */
  function detectFgWarehouses(grid) {
    const codeRow = grid[CONFIG.WAREHOUSE_CODE_ROW_INDEX] || [];
    const nameRow = grid[CONFIG.WAREHOUSE_NAME_ROW_INDEX] || [];
    const maxCols = Math.max(codeRow.length, nameRow.length);

    const warehouses = [];
    for (let c = CONFIG.WAREHOUSE_COL_SCAN_START_INDEX; c < maxCols; c++) {
      const code = clean(codeRow[c]);
      const name = clean(nameRow[c]);
      if (!code) continue; // blank warehouse column — ignore

      if (isFgWarehouse(code, name)) {
        warehouses.push({ code, name, colIndex: c });
      }
    }

    // Sort alphabetically by display name for a tidy dropdown / chart order.
    warehouses.sort((a, b) => a.name.localeCompare(b.name));
    return warehouses;
  }

  /**
   * Walk the data rows and build the product list, restricted to FG
   * warehouse columns only. Each product carries a per-warehouse qty map
   * plus a pre-computed total across all FG warehouses.
   */
  function buildProducts(grid, fgWarehouses) {
    const products = [];

    for (let r = CONFIG.DATA_START_ROW_INDEX; r < grid.length; r++) {
      const row = grid[r];
      if (!row) continue;

      const rawCode = row[CONFIG.PRODUCT_CODE_COL_INDEX];
      const code = clean(rawCode);
      if (!code) continue; // skip blank / spacer rows

      const name = clean(row[CONFIG.PRODUCT_NAME_COL_INDEX]) || '(Unnamed Product)';

      const qtyByWarehouse = {};
      let total = 0;

      for (const wh of fgWarehouses) {
        const raw = row[wh.colIndex];
        const qty = typeof raw === 'number' && !Number.isNaN(raw) ? raw : 0;
        qtyByWarehouse[wh.code] = qty;
        total += qty;
      }

      products.push({
        code,
        name,
        qtyByWarehouse,
        total
      });
    }

    return products;
  }

  /**
   * Public entry point: loads, parses and returns the full dashboard data
   * model in one call.
   *
   * @returns {Promise<{
   *   products: Array,
   *   warehouses: Array,
   *   lastModified: Date|null,
   *   loadedAt: Date
   * }>}
   */
  async function load() {
    const { workbook, lastModified } = await fetchWorkbook();
    const grid = sheetToGrid(workbook);
    const warehouses = detectFgWarehouses(grid);

    if (warehouses.length === 0) {
      throw new Error(
        'No FG Warehouse columns were detected. Please verify the ERP export format has not changed.'
      );
    }

    const products = buildProducts(grid, warehouses);

    return {
      products,
      warehouses,
      lastModified,
      loadedAt: new Date()
    };
  }

  return { load, isFgWarehouse, clean };
})();
