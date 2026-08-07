import { useMemo, useState } from 'react';
import { PAGE_SIZE } from '@/core/utils/constants';

/**
 * Generic client-side search + filter + sort + pagination for a data set.
 * Data volumes in SSM are modest (thousands of rows scoped by RLS), so
 * fetching the RLS-scoped rows once and slicing them here keeps every
 * table's search/filter/sort/pagination behavior consistent and simple.
 *
 * @param {object[]} rows
 * @param {{ searchFields?: string[], initialSort?: { key: string, dir: 'asc'|'desc' }, initialFilters?: object }} options
 */
export function useTableControls(rows, { searchFields = [], initialSort = null, initialFilters = {} } = {}) {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let result = rows || [];

    if (search.trim() && searchFields.length) {
      const q = search.trim().toLowerCase();
      result = result.filter((row) =>
        searchFields.some((field) => String(row[field] ?? '').toLowerCase().includes(q))
      );
    }

    Object.entries(filters).forEach(([key, value]) => {
      if (value === '' || value === null || value === undefined || value === 'all') return;
      result = result.filter((row) => String(row[key]) === String(value));
    });

    if (sort?.key) {
      result = [...result].sort((a, b) => {
        const av = a[sort.key];
        const bv = b[sort.key];
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === 'number' && typeof bv === 'number') {
          return sort.dir === 'asc' ? av - bv : bv - av;
        }
        return sort.dir === 'asc'
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      });
    }

    return result;
  }, [rows, search, filters, sort, searchFields]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function updateFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  function updateSearch(value) {
    setSearch(value);
    setPage(1);
  }

  function toggleSort(key) {
    setSort((prev) => {
      if (prev?.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });
  }

  return {
    search,
    setSearch: updateSearch,
    filters,
    setFilter: updateFilter,
    sort,
    toggleSort,
    page: safePage,
    setPage,
    totalPages,
    totalCount: filtered.length,
    pageRows,
    filteredRows: filtered,
  };
}
