import { Drawer } from '@/shared/components/Drawer';
import { PanelStatusBadge, Badge, ValidityBadge } from '@/shared/components/Badge';
import { PanelThumbnail } from '@/modules/mcp/components/PanelThumbnail';
import { formatDate } from '@/shared/utils/formatters';

/**
 * Details-only for now — Movement History and issue/return/forward/
 * retire actions land once the panel movement chain is built (mirrors
 * SampleDetailDrawer's shape, which this will grow into).
 */
export function PanelDetailDrawer({ open, onClose, panel }) {
  if (!panel) return null;

  return (
    <Drawer open={open} onClose={onClose}>
      <div className="flex flex-col h-full min-h-0">
        <div className="relative shrink-0">
          <PanelThumbnail panel={panel} size="lg" />
          <button
            onClick={onClose}
            className="interactive absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center text-ink hover:bg-white shadow-card"
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
          <div className="px-6 pt-4 pb-4 border-b border-border">
            <p className="font-mono text-caption text-ink-secondary tracking-wide">{panel.panel_code}</p>
            <h3 className="mt-0.5 text-body-lg font-semibold text-ink">{panel.panel_name}</h3>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {panel.buyer?.name && <Badge>{panel.buyer.name}</Badge>}
              {panel.hall?.name && <Badge>{panel.hall.name}</Badge>}
              <PanelStatusBadge status={panel.status} />
              <ValidityBadge expiryDate={panel.expiry_date} />
              {panel.is_shared && <Badge>Shared</Badge>}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5">
          <dl className="grid grid-cols-[140px_1fr] gap-y-3 text-body">
            <dt className="text-ink-secondary">Panel Code</dt>
            <dd className="text-ink font-mono">{panel.panel_code}</dd>
            <dt className="text-ink-secondary">Panel Reference</dt>
            <dd className="text-ink">{panel.panel_ref || '—'}</dd>
            <dt className="text-ink-secondary">Panel Name</dt>
            <dd className="text-ink">{panel.panel_name}</dd>
            <dt className="text-ink-secondary">Panel Finish</dt>
            <dd className="text-ink">{panel.panel_finish || '—'}</dd>
            <dt className="text-ink-secondary">Finish Recipe</dt>
            <dd className="text-ink">{panel.finish_recipe || '—'}</dd>
            <dt className="text-ink-secondary">Collection</dt>
            <dd className="text-ink">{panel.collection_name || '—'}</dd>
            <dt className="text-ink-secondary">Buyer</dt>
            <dd className="text-ink">{panel.buyer?.name || '—'}</dd>
            <dt className="text-ink-secondary">Hall</dt>
            <dd className="text-ink">{panel.hall?.name}</dd>
            <dt className="text-ink-secondary">Status</dt>
            <dd>
              <PanelStatusBadge status={panel.status} />
            </dd>
            <dt className="text-ink-secondary">Shared</dt>
            <dd className="text-ink">{panel.is_shared ? 'Yes' : 'No'}</dd>
            <dt className="text-ink-secondary">Signed By</dt>
            <dd className="text-ink">{panel.signed_by || '—'}</dd>
            <dt className="text-ink-secondary">Signed Date</dt>
            <dd className="text-ink">{panel.signed_date ? formatDate(panel.signed_date) : '—'}</dd>
            <dt className="text-ink-secondary">Validity</dt>
            <dd className="text-ink">
              {panel.expiry_date ? (
                <span className="flex items-center gap-2">
                  {formatDate(panel.expiry_date)}
                  <ValidityBadge expiryDate={panel.expiry_date} />
                </span>
              ) : (
                '—'
              )}
            </dd>
            <dt className="text-ink-secondary">Date Added to Hall</dt>
            <dd className="text-ink">
              {panel.date_added_to_hall ? formatDate(panel.date_added_to_hall) : formatDate(panel.created_at)}
            </dd>
          </dl>
        </div>
      </div>
    </Drawer>
  );
}
