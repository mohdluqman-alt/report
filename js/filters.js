/**
 * filters.js
 * ---------------------------------------------------------------------------
 * Owns the current filter state (selected warehouse, code search, name
 * search) and provides pure functions to derive filtered product lists and
 * "focus quantity" values from it.
 *
 * Exposes a single global: `FilterEngine`
 * ---------------------------------------------------------------------------
 */

const FilterEngine = (() => {

  const state = {
    warehouseCode: 'ALL', // 'ALL' or a specific warehouse code
    codeSearch: '',
    nameSearch: ''
  };

  function setWarehouse(code) {
    state.warehouseCode = code || 'ALL';
  }

  function setCodeSearch(value) {
    state.codeSearch = (value || '').trim().toLowerCase();
  }

  function setNameSearch(value) {
    state.nameSearch = (value || '').trim().toLowerCase();
  }

  function getState() {
    return { ...state };
  }

  function isAllWarehouses() {
    return state.warehouseCode === 'ALL';
  }

  /**
   * The "focus quantity" is the number the whole dashboard revolves around:
   * the Total FG Stock when "All Warehouses" is selected, or the quantity
   * in the specifically selected warehouse otherwise.
   */
  function getFocusQty(product) {
    if (isAllWarehouses()) return product.total;
    return product.qtyByWarehouse[state.warehouseCode] ?? 0;
  }

  /**
   * Apply the current text-search filters (code + name) to the full
   * product list. Warehouse selection does NOT remove products from the
   * list — it only changes which quantity is highlighted/used — so users
   * can still see a product's total even if it holds zero stock in the
   * focused warehouse.
   */
  function applyTextFilters(products) {
    if (!state.codeSearch && !state.nameSearch) return products;

    return products.filter((p) => {
      const codeMatch = !state.codeSearch || p.code.toLowerCase().includes(state.codeSearch);
      const nameMatch = !state.nameSearch || p.name.toLowerCase().includes(state.nameSearch);
      return codeMatch && nameMatch;
    });
  }

  /** Convenience: text-filtered products, each annotated with focusQty. */
  function getFilteredProducts(products) {
    const filtered = applyTextFilters(products);
    return filtered.map((p) => ({ ...p, focusQty: getFocusQty(p) }));
  }

  return {
    setWarehouse,
    setCodeSearch,
    setNameSearch,
    getState,
    isAllWarehouses,
    getFocusQty,
    applyTextFilters,
    getFilteredProducts
  };
})();
