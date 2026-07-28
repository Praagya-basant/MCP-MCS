/**
 * Scrollable checkbox list of buyers — used by Edit User's "Assigned
 * Buyers" multi-select for merchant accounts (see merchant_buyers in
 * schema.sql). Mirrors MerchantContactsSelect's pattern exactly, just
 * with the roles of merchant/buyer swapped.
 */
export function BuyersMultiSelect({ buyers, selectedIds, onToggle }) {
  return (
    <div className="max-h-48 overflow-y-auto scrollbar-thin border border-border rounded-control divide-y divide-border">
      {!buyers ? (
        <p className="px-3 py-3 text-caption text-ink-muted">Loading buyers&hellip;</p>
      ) : buyers.length === 0 ? (
        <p className="px-3 py-3 text-caption text-ink-muted">No buyers yet.</p>
      ) : (
        buyers.map((b) => (
          <label
            key={b.id}
            className="interactive flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-sidebar"
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(b.id)}
              onChange={() => onToggle(b.id)}
              className="w-4 h-4 rounded border-border-strong accent-ink focus:ring-1 focus:ring-ink"
            />
            <p className="text-body text-ink truncate">{b.name}</p>
          </label>
        ))
      )}
    </div>
  );
}
