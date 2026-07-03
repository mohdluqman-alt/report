/**
 * app.js
 * ---------------------------------------------------------------------------
 * Main application orchestration for the FG Warehouse Stock Dashboard.
 * Ties together excel.js (data), filters.js (state), charts.js (viz) and
 * the DataTables-powered product table.
 * ---------------------------------------------------------------------------
 */

(() => {
  'use strict';

  // ---- App-wide state -------------------------------------------------
  let dataModel = null;     // { products, warehouses, lastModified, loadedAt }
  let dataTable = null;     // DataTables instance
  let refreshTimer = null;

  // ---- DOM shortcuts ----------------------------------------------------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const el = {
    loader: $('#loadingOverlay'),
    errorBanner: $('#errorBanner'),
    errorMessage: $('#errorMessage'),
    retryBtn: $('#retryLoadBtn'),

    kpiTotalStock: $('#kpiTotalStock'),
    kpiTotalProducts: $('#kpiTotalProducts'),
    kpiTotalWarehouses: $('#kpiTotalWarehouses'),
    kpiLastUpdated: $('#kpiLastUpdated'),
    liveDot: $('#liveDot'),

    warehouseSelect: $('#warehouseSelect'),
    codeSearch: $('#codeSearchInput'),
    nameSearch: $('#nameSearchInput'),
    clearFiltersBtn: $('#clearFiltersBtn'),

    selectedWarehouseHeader: $('#selectedWarehouseHeader'),
    selectedWarehouseBadge: $('#selectedWarehouseBadge'),

    darkModeToggle: $('#darkModeToggle'),

    exportExcelBtn: $('#exportExcelBtn'),
    exportCsvBtn: $('#exportCsvBtn'),
    printBtn: $('#printBtn'),

    tableBody: $('#productTable tbody'),

    zeroStockTitle: $('#zeroStockTitle'),

    visibleRowCount: $('#visibleRowCount')
  };

  // ---- Utilities ----------------------------------------------------------
  function debounce(fn, delay = 250) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  }

  function formatNumber(n) {
    return Number(n || 0).toLocaleString(CONFIG.CURRENCY_LOCALE);
  }

  function formatDateTime(date) {
    if (!date || Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat(CONFIG.CURRENCY_LOCALE, {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    }).format(date);
  }

  function showLoader(message) {
    el.loader.classList.add('is-visible');
    if (message) el.loader.querySelector('.loader-text').textContent = message;
  }

  function hideLoader() {
    el.loader.classList.remove('is-visible');
  }

  function showError(message) {
    el.errorMessage.textContent = message;
    el.errorBanner.classList.add('is-visible');
  }

  function hideError() {
    el.errorBanner.classList.remove('is-visible');
  }

  // ---- Dark mode ------------------------------------------------------
  function initDarkMode() {
    const saved = localStorage.getItem('fgDashboardTheme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    applyTheme(theme);

    el.darkModeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      localStorage.setItem('fgDashboardTheme', next);
      // Charts read CSS vars — rebuild them so colors follow the new theme.
      if (dataModel) ChartEngine.refreshTheme(getChartParams());
    });
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    el.darkModeToggle.setAttribute('aria-pressed', theme === 'dark');
  }

  // ---- KPI rendering ------------------------------------------------------
  function renderKpis(filteredProducts) {
    const totalStock = filteredProducts.reduce((sum, p) => sum + p.focusQty, 0);
    el.kpiTotalStock.textContent = formatNumber(totalStock);
    el.kpiTotalProducts.textContent = formatNumber(filteredProducts.length);
    el.kpiTotalWarehouses.textContent = formatNumber(dataModel.warehouses.length);

    const stamp = dataModel.lastModified || dataModel.loadedAt;
    el.kpiLastUpdated.textContent = formatDateTime(stamp);
  }

  // ---- Warehouse dropdown ------------------------------------------------
  function populateWarehouseDropdown() {
    const frag = document.createDocumentFragment();

    const allOpt = document.createElement('option');
    allOpt.value = 'ALL';
    allOpt.textContent = `All FG Warehouses (${dataModel.warehouses.length})`;
    frag.appendChild(allOpt);

    dataModel.warehouses.forEach((wh) => {
      const opt = document.createElement('option');
      opt.value = wh.code;
      opt.textContent = `${wh.name} (${wh.code})`;
      frag.appendChild(opt);
    });

    el.warehouseSelect.innerHTML = '';
    el.warehouseSelect.appendChild(frag);
  }

  function updateSelectedWarehouseUI() {
    const state = FilterEngine.getState();
    let headerLabel;
    if (state.warehouseCode === 'ALL') {
      headerLabel = 'Total FG Stock';
      el.selectedWarehouseHeader.textContent = 'Total FG Stock';
      el.selectedWarehouseBadge.textContent = 'All Warehouses';
      el.zeroStockTitle.textContent = 'Zero Stock Products — Top Warehouses';
    } else {
      const wh = dataModel.warehouses.find((w) => w.code === state.warehouseCode);
      headerLabel = wh ? wh.name : state.warehouseCode;
      el.selectedWarehouseHeader.textContent = headerLabel;
      el.selectedWarehouseBadge.textContent = headerLabel;
      el.zeroStockTitle.textContent = `Zero Stock Products — ${headerLabel}`;
    }

    // Keep the table's 3rd column header in sync with the focused warehouse.
    const thirdHeader = document.querySelector('#productTable thead th:nth-child(3)');
    if (thirdHeader) thirdHeader.textContent = `${headerLabel} Qty`;
  }

  // ---- DataTable ------------------------------------------------------
  function buildRowData(filteredProducts) {
    return filteredProducts.map((p) => [p.code, p.name, p.focusQty, p.total]);
  }

  function initDataTable(filteredProducts) {
    dataTable = $('#productTable').DataTable({
      data: buildRowData(filteredProducts),
      deferRender: true,
      pageLength: CONFIG.TABLE_PAGE_LENGTH,
      lengthMenu: [10, 25, 50, 100, 250],
      order: [[3, 'desc']],
      columns: [
        { title: 'Product Code' },
        { title: 'Product Name' },
        {
          title: 'Selected Warehouse Qty',
          className: 'text-right',
          render: (data) => formatNumber(data)
        },
        {
          title: 'Total FG Stock',
          className: 'text-right',
          render: (data) => formatNumber(data)
        }
      ],
      createdRow: (row, rowData) => {
        const focusQty = rowData[2];
        if (focusQty === 0) row.classList.add('row-zero-stock');
        else if (focusQty < CONFIG.LOW_STOCK_THRESHOLD) row.classList.add('row-low-stock');
      },
      language: {
        search: '',
        searchPlaceholder: 'Quick search this table…',
        emptyTable: 'No products match the current filters.',
        info: 'Showing _START_ to _END_ of _TOTAL_ products',
        infoEmpty: 'No products to show',
        infoFiltered: '(filtered from _MAX_ total)',
        lengthMenu: 'Show _MENU_ products',
        paginate: { previous: '‹', next: '›' }
      },
      dom:
        "<'dt-toolbar'<'dt-toolbar-left'l><'dt-toolbar-right'f>>" +
        "rt" +
        "<'dt-footer'<'dt-footer-left'i><'dt-footer-right'p>>",
      drawCallback: updateVisibleRowCount
    });
  }

  function refreshDataTable(filteredProducts) {
    if (!dataTable) {
      initDataTable(filteredProducts);
      return;
    }
    dataTable.clear();
    dataTable.rows.add(buildRowData(filteredProducts));
    dataTable.draw();
  }

  function updateVisibleRowCount() {
    if (!dataTable) return;
    const info = dataTable.page.info();
    el.visibleRowCount.textContent =
      `${formatNumber(info.recordsDisplay)} of ${formatNumber(info.recordsTotal)} products`;
  }

  // ---- Chart params helper ------------------------------------------------
  function getChartParams() {
    const filteredProducts = FilterEngine.getFilteredProducts(dataModel.products);
    return {
      filteredProducts,
      warehouses: dataModel.warehouses,
      warehouseCode: FilterEngine.getState().warehouseCode
    };
  }

  // ---- Master refresh ------------------------------------------------
  function refreshDashboard() {
    const filteredProducts = FilterEngine.getFilteredProducts(dataModel.products);
    renderKpis(filteredProducts);
    refreshDataTable(filteredProducts);
    updateSelectedWarehouseUI();
    ChartEngine.renderAll(getChartParams());
  }

  // ---- Export helpers ------------------------------------------------
  function getCurrentTableRows() {
    // All rows matching current DataTables search state (not just current page).
    const rows = dataTable.rows({ search: 'applied' }).data().toArray();
    return rows.map((r) => ({
      'Product Code': r[0],
      'Product Name': r[1],
      [el.selectedWarehouseHeader.textContent]: r[2],
      'Total FG Stock': r[3]
    }));
  }

  function exportToExcel() {
    const rows = getCurrentTableRows();
    if (rows.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 18 }, { wch: 42 }, { wch: 22 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'FG Stock');
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `FG_Stock_Export_${stamp}.xlsx`);
  }

  function exportToCsv() {
    const rows = getCurrentTableRows();
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csvLines = [
      headers.join(','),
      ...rows.map((r) => headers.map((h) => `"${String(r[h]).replace(/"/g, '""')}"`).join(','))
    ];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `FG_Stock_Export_${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function printTable() {
    document.body.classList.add('printing');
    window.print();
    setTimeout(() => document.body.classList.remove('printing'), 500);
  }

  // ---- Event wiring ------------------------------------------------
  function wireEvents() {
    el.warehouseSelect.addEventListener('change', (e) => {
      FilterEngine.setWarehouse(e.target.value);
      refreshDashboard();
    });

    el.codeSearch.addEventListener('input', debounce((e) => {
      FilterEngine.setCodeSearch(e.target.value);
      refreshDashboard();
    }, 200));

    el.nameSearch.addEventListener('input', debounce((e) => {
      FilterEngine.setNameSearch(e.target.value);
      refreshDashboard();
    }, 200));

    el.clearFiltersBtn.addEventListener('click', () => {
      FilterEngine.setWarehouse('ALL');
      FilterEngine.setCodeSearch('');
      FilterEngine.setNameSearch('');
      el.warehouseSelect.value = 'ALL';
      el.codeSearch.value = '';
      el.nameSearch.value = '';
      refreshDashboard();
    });

    el.retryBtn.addEventListener('click', () => bootstrap());

    el.exportExcelBtn.addEventListener('click', exportToExcel);
    el.exportCsvBtn.addEventListener('click', exportToCsv);
    el.printBtn.addEventListener('click', printTable);

    // Collapsible mobile filter panel
    const filterToggle = $('#filterToggleBtn');
    const filterPanel = $('#filterPanel');
    if (filterToggle && filterPanel) {
      filterToggle.addEventListener('click', () => {
        filterPanel.classList.toggle('is-open');
      });
    }
  }

  // ---- Bootstrap ------------------------------------------------
  async function bootstrap() {
    hideError();
    showLoader('Reading ERP stock report…');
    el.liveDot.classList.remove('is-live');

    try {
      dataModel = await ExcelEngine.load();
      populateWarehouseDropdown();
      FilterEngine.setWarehouse('ALL');
      refreshDashboard();
      el.liveDot.classList.add('is-live');
    } catch (err) {
      console.error(err);
      showError(err.message || 'Something went wrong while loading the stock report.');
    } finally {
      hideLoader();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initDarkMode();
    wireEvents();
    bootstrap();
  });
})();
