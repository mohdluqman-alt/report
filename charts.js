/**
 * charts.js
 * ---------------------------------------------------------------------------
 * Builds and refreshes the four dashboard charts using Chart.js:
 *   1. Warehouse-wise Stock
 *   2. Top 20 Products by Stock
 *   3. Low Stock Products
 *   4. Zero Stock Products (by warehouse)
 *
 * Exposes a single global: `ChartEngine`
 * ---------------------------------------------------------------------------
 */

const ChartEngine = (() => {

  let warehouseChart = null;
  let topProductsChart = null;
  let lowStockChart = null;
  let zeroStockChart = null;

  /** Read live theme colors from CSS custom properties so charts always
   *  match the active (light/dark) theme without hardcoding hex values. */
  function themeColor(varName) {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  }

  function getPalette() {
    return {
      accent: themeColor('--chart-accent'),
      accentSoft: themeColor('--chart-accent-soft'),
      warning: themeColor('--chart-warning'),
      warningSoft: themeColor('--chart-warning-soft'),
      danger: themeColor('--chart-danger'),
      dangerSoft: themeColor('--chart-danger-soft'),
      grid: themeColor('--chart-grid'),
      text: themeColor('--chart-text'),
      tooltipBg: themeColor('--chart-tooltip-bg'),
      tooltipText: themeColor('--chart-tooltip-text')
    };
  }

  function baseOptions(palette, indexAxis = 'y') {
    return {
      indexAxis,
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: palette.tooltipBg,
          titleColor: palette.tooltipText,
          bodyColor: palette.tooltipText,
          borderColor: palette.grid,
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
          displayColors: false,
          callbacks: {
            label: (ctx) => ` Stock: ${Number(ctx.raw).toLocaleString(CONFIG.CURRENCY_LOCALE)}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: palette.grid, drawBorder: false },
          ticks: { color: palette.text, font: { family: "'Inter', sans-serif", size: 11 } }
        },
        y: {
          grid: { display: indexAxis === 'x', color: palette.grid, drawBorder: false },
          ticks: { color: palette.text, font: { family: "'Inter', sans-serif", size: 11 } }
        }
      }
    };
  }

  function destroyAll() {
    [warehouseChart, topProductsChart, lowStockChart, zeroStockChart].forEach((c) => c && c.destroy());
    warehouseChart = topProductsChart = lowStockChart = zeroStockChart = null;
  }

  // ---- 1. Warehouse-wise Stock ------------------------------------------
  function renderWarehouseChart(warehouseTotals, palette) {
    const ctx = document.getElementById('chartWarehouseStock');
    const sorted = [...warehouseTotals].sort((a, b) => b.qty - a.qty);
    const labels = sorted.map((w) => w.name);
    const data = sorted.map((w) => w.qty);

    // Give the canvas enough height to breathe when there are many warehouses.
    ctx.parentElement.style.height = `${Math.max(320, sorted.length * 26)}px`;

    if (warehouseChart) {
      warehouseChart.data.labels = labels;
      warehouseChart.data.datasets[0].data = data;
      warehouseChart.update();
      return;
    }

    warehouseChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Stock',
          data,
          backgroundColor: palette.accentSoft,
          hoverBackgroundColor: palette.accent,
          borderRadius: 6,
          barThickness: 14,
          maxBarThickness: 18
        }]
      },
      options: baseOptions(palette, 'y')
    });
  }

  // ---- 2. Top N Products by Stock ----------------------------------------
  function renderTopProductsChart(products, palette) {
    const ctx = document.getElementById('chartTopProducts');
    const top = [...products]
      .sort((a, b) => b.focusQty - a.focusQty)
      .slice(0, CONFIG.TOP_PRODUCTS_COUNT);

    const labels = top.map((p) => (p.name.length > 28 ? p.name.slice(0, 26) + '…' : p.name));
    const data = top.map((p) => p.focusQty);

    if (topProductsChart) {
      topProductsChart.data.labels = labels;
      topProductsChart.data.datasets[0].data = data;
      topProductsChart.update();
      return;
    }

    topProductsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Stock',
          data,
          backgroundColor: palette.accentSoft,
          hoverBackgroundColor: palette.accent,
          borderRadius: 6,
          barThickness: 14,
          maxBarThickness: 18
        }]
      },
      options: baseOptions(palette, 'y')
    });
  }

  // ---- 3. Low Stock Products ----------------------------------------------
  function renderLowStockChart(products, palette) {
    const ctx = document.getElementById('chartLowStock');
    const low = products
      .filter((p) => p.focusQty > 0 && p.focusQty < CONFIG.LOW_STOCK_THRESHOLD)
      .sort((a, b) => a.focusQty - b.focusQty)
      .slice(0, CONFIG.LOW_STOCK_CHART_COUNT);

    const labels = low.map((p) => (p.name.length > 28 ? p.name.slice(0, 26) + '…' : p.name));
    const data = low.map((p) => p.focusQty);

    if (lowStockChart) {
      lowStockChart.data.labels = labels;
      lowStockChart.data.datasets[0].data = data;
      lowStockChart.update();
      return;
    }

    lowStockChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Stock',
          data,
          backgroundColor: palette.warningSoft,
          hoverBackgroundColor: palette.warning,
          borderRadius: 6,
          barThickness: 14,
          maxBarThickness: 18
        }]
      },
      options: baseOptions(palette, 'y')
    });
  }

  // ---- 4. Zero Stock Products (by warehouse) ------------------------------
  function renderZeroStockChart(products, warehouses, focusWarehouseCode, palette) {
    const ctx = document.getElementById('chartZeroStock');

    let labels, data;

    if (focusWarehouseCode === 'ALL') {
      // Count, per warehouse, how many products currently sit at zero stock.
      const counts = warehouses.map((wh) => {
        const zeroCount = products.filter((p) => (p.qtyByWarehouse[wh.code] ?? 0) === 0).length;
        return { name: wh.name, zeroCount };
      }).sort((a, b) => b.zeroCount - a.zeroCount)
        .slice(0, CONFIG.ZERO_STOCK_CHART_WAREHOUSE_COUNT);

      labels = counts.map((c) => c.name);
      data = counts.map((c) => c.zeroCount);
    } else {
      // A specific warehouse is focused — show the actual zero-stock products.
      const wh = warehouses.find((w) => w.code === focusWarehouseCode);
      const zeroProducts = products
        .filter((p) => p.focusQty === 0)
        .slice(0, CONFIG.ZERO_STOCK_CHART_WAREHOUSE_COUNT);

      labels = zeroProducts.map((p) => (p.name.length > 28 ? p.name.slice(0, 26) + '…' : p.name));
      data = zeroProducts.map(() => 1);
      ctx.setAttribute('data-context', wh ? wh.name : '');
    }

    if (zeroStockChart) {
      zeroStockChart.data.labels = labels;
      zeroStockChart.data.datasets[0].data = data;
      zeroStockChart.update();
      return;
    }

    zeroStockChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Zero Stock',
          data,
          backgroundColor: palette.dangerSoft,
          hoverBackgroundColor: palette.danger,
          borderRadius: 6,
          barThickness: 14,
          maxBarThickness: 18
        }]
      },
      options: baseOptions(palette, 'y')
    });
  }

  /**
   * Public entry point — recomputes and (re)renders all four charts.
   * @param {Object} params
   * @param {Array} params.filteredProducts - text-filtered products w/ focusQty
   * @param {Array} params.warehouses - full FG warehouse list
   * @param {string} params.warehouseCode - currently focused warehouse code ('ALL' or code)
   */
  function renderAll({ filteredProducts, warehouses, warehouseCode }) {
    const palette = getPalette();

    const warehouseTotals = warehouses.map((wh) => ({
      name: wh.name,
      qty: filteredProducts.reduce((sum, p) => sum + (p.qtyByWarehouse[wh.code] ?? 0), 0)
    }));

    renderWarehouseChart(warehouseTotals, palette);
    renderTopProductsChart(filteredProducts, palette);
    renderLowStockChart(filteredProducts, palette);
    renderZeroStockChart(filteredProducts, warehouses, warehouseCode, palette);
  }

  /** Force a full rebuild (used when the theme changes so colors refresh). */
  function refreshTheme(lastParams) {
    destroyAll();
    if (lastParams) renderAll(lastParams);
  }

  return { renderAll, refreshTheme, destroyAll };
})();
