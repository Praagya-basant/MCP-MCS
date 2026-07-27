/**
 * Scrollable checkbox list of merchant profiles — shared by Add Buyer
 * (nothing pre-checked) and Edit Buyer (pre-checked from that buyer's
 * existing contacts). Purely controlled; callers own the selection state
 * and what happens with it (see buyersApi.syncMerchantContacts).
 */
export function MerchantContactsSelect({ merchants, selectedIds, onToggle }) {
  return (
    <div className="max-h-48 overflow-y-auto scrollbar-thin border border-border rounded-control divide-y divide-border">
      {!merchants ? (
        <p className="px-3 py-3 text-caption text-ink-muted">Loading merchants&hellip;</p>
      ) : merchants.length === 0 ? (
        <p className="px-3 py-3 text-caption text-ink-muted">No merchant users yet.</p>
      ) : (
        merchants.map((m) => (
          <label
            key={m.id}
            className="interactive flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-sidebar"
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(m.id)}
              onChange={() => onToggle(m.id)}
              className="w-4 h-4 rounded border-border-strong accent-ink focus:ring-1 focus:ring-ink"
            />
            <div className="min-w-0">
              <p className="text-body text-ink truncate">{m.full_name}</p>
              <p className="text-caption text-ink-muted truncate">{m.email}</p>
            </div>
          </label>
        ))
      )}
    </div>
  );
}
