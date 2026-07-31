import { useMemo, useState } from 'react';

/**
 * Type-to-search merchant picker for Edit Buyer — the only surface that
 * assigns merchants to a buyer. Selected merchants render as removable
 * tags above the search input; matches are filtered by name/email as the
 * admin types, always excluding merchants already selected. Purely
 * controlled — `onChange` receives the full next id array on every
 * add/remove, callers own persistence (see buyersApi.syncMerchantContacts).
 */
export function MerchantSearchSelect({ merchants, selectedIds, onChange }) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const selected = useMemo(
    () => (merchants || []).filter((m) => selectedIds.includes(m.id)),
    [merchants, selectedIds]
  );

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (merchants || [])
      .filter((m) => !selectedIds.includes(m.id))
      .filter((m) => !q || m.full_name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q))
      .slice(0, 8);
  }, [merchants, selectedIds, query]);

  function addMerchant(id) {
    onChange([...selectedIds, id]);
    setQuery('');
  }

  function removeMerchant(id) {
    onChange(selectedIds.filter((x) => x !== id));
  }

  return (
    <div className="flex flex-col gap-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((m) => (
            <span
              key={m.id}
              className="interactive inline-flex items-center gap-1.5 rounded-pill bg-surface-subtle pl-2.5 pr-1.5 py-1 text-caption text-ink"
            >
              {m.full_name}
              <button
                type="button"
                onClick={() => removeMerchant(m.id)}
                aria-label={`Remove ${m.full_name}`}
                className="interactive w-4 h-4 rounded-full flex items-center justify-center text-ink-muted hover:text-ink hover:bg-border-strong"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Search merchants by name or email..."
          className="interactive w-full h-9 rounded-control border border-border bg-card px-3 text-body text-ink placeholder:text-ink-muted focus:outline-none focus:ring-[1.5px] focus:ring-ink focus:border-ink"
        />

        {focused && (
          <div className="absolute z-10 mt-1 w-full max-h-[264px] overflow-y-auto scrollbar-thin bg-card border border-border rounded-control shadow-lg">
            {!merchants ? (
              <p className="px-3 py-2.5 text-caption text-ink-muted">Loading merchants&hellip;</p>
            ) : suggestions.length === 0 ? (
              <p className="px-3 py-2.5 text-caption text-ink-muted">
                {query.trim()
                  ? 'No matching merchants.'
                  : merchants.length === 0
                    ? 'No merchant users yet.'
                    : 'All merchants already selected.'}
              </p>
            ) : (
              suggestions.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addMerchant(m.id)}
                  className="interactive w-full text-left px-3 py-2 hover:bg-sidebar flex flex-col"
                >
                  <span className="text-body text-ink truncate">{m.full_name}</span>
                  <span className="text-caption text-ink-muted truncate">{m.email}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
