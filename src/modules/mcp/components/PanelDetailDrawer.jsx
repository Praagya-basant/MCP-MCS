import { useEffect, useState } from 'react';
import { Drawer } from '@/shared/components/Drawer';
import { PanelStatusBadge, Badge, ValidityBadge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { CardListSkeleton } from '@/shared/components/Skeleton';
import { EmptyState } from '@/shared/components/EmptyState';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { PanelThumbnail } from '@/modules/mcp/components/PanelThumbnail';
import { IssuePanelModal } from '@/modules/mcp/components/IssuePanelModal';
import { ForwardPanelModal } from '@/modules/mcp/components/ForwardPanelModal';
import { RetirePanelModal } from '@/modules/mcp/admin/components/RetirePanelModal';
import { useAuth } from '@/shared/context/AuthContext';
import { useToast } from '@/shared/context/ToastContext';
import { listPanelMovementsForPanel, returnPanel } from '@/modules/mcp/api/panelMovementsApi';
import { getPanel } from '@/modules/mcp/api/panelsApi';
import { formatDateTime, formatDate, getPanelDisplayStatus } from '@/shared/utils/formatters';
import { PANEL_STATUS, ROLES } from '@/shared/utils/constants';
import { cn } from '@/shared/utils/cn';

const TABS = [
  { id: 'details', label: 'Details' },
  { id: 'history', label: 'Movement History' },
];

/**
 * Mirrors SampleDetailDrawer's shape (tabs, footer actions, journey
 * timeline) minus what panels don't have yet: no Comments tab (no
 * panel_comments table), no Manage Validity / Request Extension (the
 * backend RPCs already support item_type='panel' — see
 * admin_update_validity/review_validity_request in schema.sql — but
 * wiring the panel side of that UI is deferred to a later pass).
 */
export function PanelDetailDrawer({ open, onClose, panel, onChanged }) {
  const { profile, role } = useAuth();
  const toast = useToast();
  const [localPanel, setLocalPanel] = useState(panel);
  const [tab, setTab] = useState('details');
  const [movements, setMovements] = useState(null);
  const [loading, setLoading] = useState(true);
  const [issueOpen, setIssueOpen] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [returnConfirmOpen, setReturnConfirmOpen] = useState(false);
  const [returning, setReturning] = useState(false);
  const [retireOpen, setRetireOpen] = useState(false);

  const isAdmin = role === ROLES.SUPER_ADMIN;

  useEffect(() => {
    if (panel) setLocalPanel(panel);
  }, [panel]);

  useEffect(() => {
    if (!open || !panel) return;
    setTab('details');
    setLoading(true);
    listPanelMovementsForPanel(panel.id)
      .then(setMovements)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, panel?.id]);

  function reloadHistory() {
    return listPanelMovementsForPanel(localPanel.id).then(setMovements);
  }

  function handleIssueSuccess() {
    setLocalPanel((prev) => ({ ...prev, status: PANEL_STATUS.ISSUED }));
    reloadHistory();
    onChanged?.();
  }

  async function handleForwardSuccess() {
    const fresh = await getPanel(localPanel.id);
    setLocalPanel(fresh);
    reloadHistory();
    onChanged?.();
  }

  async function handleConfirmReturn() {
    setReturning(true);
    try {
      const movement = (movements || []).find((m) => m.status === 'out');
      if (!movement) throw new Error('No active issue found for this panel.');
      await returnPanel({ movement });
      setLocalPanel((prev) => ({ ...prev, status: PANEL_STATUS.IN_HALL }));
      toast.success(`${localPanel.panel_code} marked as returned`);
      setReturnConfirmOpen(false);
      reloadHistory();
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setReturning(false);
    }
  }

  if (!localPanel) return null;

  const openMovement = (movements || []).find((m) => m.status === 'out') || null;
  const displayStatus = getPanelDisplayStatus(localPanel.status, openMovement?.hop_number);

  const canIssueReturn = role === ROLES.HALL_MANAGER || role === ROLES.SUPER_ADMIN;
  const showIssue = canIssueReturn && localPanel.status === PANEL_STATUS.IN_HALL;
  const showReturn = canIssueReturn && localPanel.status === PANEL_STATUS.ISSUED;
  const showForward =
    canIssueReturn && localPanel.status === PANEL_STATUS.ISSUED && (isAdmin || profile?.hall_id === localPanel.hall_id);
  const showRetire = isAdmin && localPanel.status === PANEL_STATUS.IN_HALL;
  const hasFooterAction = showIssue || showReturn || showForward || showRetire;

  return (
    <>
      <Drawer open={open} onClose={onClose}>
        <div className="flex flex-col h-full min-h-0">
          <div className="relative shrink-0">
            <PanelThumbnail panel={localPanel} size="lg" />
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
              <p className="font-mono text-caption text-ink-secondary tracking-wide">{localPanel.panel_code}</p>
              <h3 className="mt-0.5 text-body-lg font-semibold text-ink">{localPanel.panel_name}</h3>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {localPanel.buyer?.name && <Badge>{localPanel.buyer.name}</Badge>}
                {localPanel.hall?.name && <Badge>{localPanel.hall.name}</Badge>}
                <PanelStatusBadge status={displayStatus} />
                <ValidityBadge expiryDate={localPanel.expiry_date} />
                {localPanel.is_shared && <Badge>Shared</Badge>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 border-b border-border px-6 shrink-0">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'interactive h-11 px-3 -mb-px text-body font-medium border-b-2 whitespace-nowrap',
                  tab === t.id ? 'border-ink text-ink' : 'border-transparent text-ink-secondary hover:text-ink'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5">
            {tab === 'details' && (
              <dl className="grid grid-cols-[140px_1fr] gap-y-3 text-body">
                <dt className="text-ink-secondary">Panel Code</dt>
                <dd className="text-ink font-mono">{localPanel.panel_code}</dd>
                <dt className="text-ink-secondary">Panel Reference</dt>
                <dd className="text-ink">{localPanel.panel_ref || '—'}</dd>
                <dt className="text-ink-secondary">Panel Name</dt>
                <dd className="text-ink">{localPanel.panel_name}</dd>
                <dt className="text-ink-secondary">Panel Finish</dt>
                <dd className="text-ink">{localPanel.panel_finish || '—'}</dd>
                <dt className="text-ink-secondary">Finish Recipe</dt>
                <dd className="text-ink">{localPanel.finish_recipe || '—'}</dd>
                <dt className="text-ink-secondary">Collection</dt>
                <dd className="text-ink">{localPanel.collection_name || '—'}</dd>
                <dt className="text-ink-secondary">Buyer</dt>
                <dd className="text-ink">{localPanel.buyer?.name || '—'}</dd>
                <dt className="text-ink-secondary">Hall</dt>
                <dd className="text-ink">{localPanel.hall?.name}</dd>
                <dt className="text-ink-secondary">Status</dt>
                <dd>
                  <PanelStatusBadge status={displayStatus} />
                </dd>
                <dt className="text-ink-secondary">Shared</dt>
                <dd className="text-ink">{localPanel.is_shared ? 'Yes' : 'No'}</dd>
                <dt className="text-ink-secondary">Signed By</dt>
                <dd className="text-ink">{localPanel.signed_by || '—'}</dd>
                <dt className="text-ink-secondary">Signed Date</dt>
                <dd className="text-ink">{localPanel.signed_date ? formatDate(localPanel.signed_date) : '—'}</dd>
                <dt className="text-ink-secondary">Validity</dt>
                <dd className="text-ink">
                  {localPanel.expiry_date ? (
                    <span className="flex items-center gap-2">
                      {formatDate(localPanel.expiry_date)}
                      <ValidityBadge expiryDate={localPanel.expiry_date} />
                    </span>
                  ) : (
                    '—'
                  )}
                </dd>
                <dt className="text-ink-secondary">Date Added to Hall</dt>
                <dd className="text-ink">
                  {localPanel.date_added_to_hall ? formatDate(localPanel.date_added_to_hall) : formatDate(localPanel.created_at)}
                </dd>
                {localPanel.status === PANEL_STATUS.RETIRED && (
                  <>
                    <dt className="text-ink-secondary">Retired</dt>
                    <dd className="text-ink">{localPanel.retired_at ? formatDateTime(localPanel.retired_at) : '—'}</dd>
                    <dt className="text-ink-secondary">Retired Reason</dt>
                    <dd className="text-ink">{localPanel.retired_reason || '—'}</dd>
                  </>
                )}
              </dl>
            )}

            {tab === 'history' &&
              (loading ? (
                <CardListSkeleton rows={3} />
              ) : !movements || movements.length === 0 ? (
                <EmptyState title="No movement yet" description="This panel hasn't left the hall." className="py-8" />
              ) : (
                <ul className="flex flex-col">
                  {movements.map((m, i) => {
                    const isReturned = m.status === 'returned';
                    const isLast = i === movements.length - 1;
                    return (
                      <li key={m.id} className={cn('relative pl-5', !isLast && 'pb-4')}>
                        <span
                          className={cn(
                            'absolute left-0 top-1 w-1.5 h-1.5 rounded-full',
                            isReturned ? 'bg-status-in-hall-text' : 'bg-status-checked-out-text'
                          )}
                        />
                        {!isLast && <span className="absolute left-[2.5px] top-3 bottom-0 w-px bg-border" />}

                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-body font-semibold text-ink">
                            {isReturned ? 'Returned' : m.hop_number > 1 ? 'Forwarded' : 'Issued'}
                          </span>
                          <span className="text-[12px] text-ink-muted shrink-0">{formatDateTime(m.picked_at)}</span>
                        </div>
                        <p className="mt-1 text-[13px] text-ink-secondary">
                          {m.from_hall?.name ? `From: ${m.from_hall.name} · ` : ''}To: {m.destination}
                        </p>
                        <p className="mt-0.5 text-[13px] text-ink-secondary">
                          Reason: {m.reason === 'Other' ? m.reason_other : m.reason}
                        </p>
                        {m.supplier_name && (
                          <p className="mt-0.5 text-[13px] text-ink-secondary">Supplier: {m.supplier_name}</p>
                        )}
                        {m.purchaser_name && (
                          <p className="mt-0.5 text-[13px] text-ink-secondary">Purchaser: {m.purchaser_name}</p>
                        )}
                        {isReturned && (
                          <p className="mt-0.5 text-[12px] text-status-in-hall-text">
                            Returned: {formatDateTime(m.returned_at)}
                          </p>
                        )}
                        {m.notes && <p className="mt-0.5 text-[13px] text-ink-muted">{m.notes}</p>}
                        {(m.photo_url || m.signature_url) && (
                          <div className="mt-2 flex items-center gap-2">
                            {m.photo_url && (
                              <a href={m.photo_url} target="_blank" rel="noreferrer" className="interactive">
                                <img src={m.photo_url} alt="Movement photo" className="w-14 h-14 rounded-control object-cover border border-border" />
                              </a>
                            )}
                            {m.signature_url && (
                              <a href={m.signature_url} target="_blank" rel="noreferrer" className="interactive">
                                <img
                                  src={m.signature_url}
                                  alt="Signature"
                                  className="w-14 h-14 rounded-control object-contain border border-border bg-white p-1"
                                />
                              </a>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ))}
          </div>

          {hasFooterAction && (
            <div className="px-6 py-4 border-t border-border flex items-center gap-2 shrink-0">
              {showIssue && (
                <Button variant="success" className="flex-1" onClick={() => setIssueOpen(true)}>
                  Issue
                </Button>
              )}
              {showReturn && (
                <Button variant="warning" className="flex-1" onClick={() => setReturnConfirmOpen(true)}>
                  Return
                </Button>
              )}
              {showForward && (
                <Button variant="secondary" className="flex-1" onClick={() => setForwardOpen(true)}>
                  Forward
                </Button>
              )}
              {showRetire && (
                <Button variant="danger" className="flex-1" onClick={() => setRetireOpen(true)}>
                  Retire
                </Button>
              )}
            </div>
          )}
        </div>
      </Drawer>

      <IssuePanelModal
        open={issueOpen}
        panel={localPanel}
        onClose={() => setIssueOpen(false)}
        onSuccess={handleIssueSuccess}
      />

      <ForwardPanelModal
        open={forwardOpen}
        panel={localPanel}
        movement={openMovement}
        onClose={() => setForwardOpen(false)}
        onSuccess={handleForwardSuccess}
      />

      <ConfirmDialog
        open={returnConfirmOpen}
        onClose={() => setReturnConfirmOpen(false)}
        onConfirm={handleConfirmReturn}
        title="Confirm Return"
        description={`Mark ${localPanel.panel_code} as returned to ${localPanel.hall?.name}? The return time is recorded automatically.`}
        confirmLabel="Confirm Return"
        loading={returning}
      />

      {isAdmin && (
        <RetirePanelModal
          open={retireOpen}
          panel={localPanel}
          onClose={() => setRetireOpen(false)}
          onSuccess={(retired) => {
            setRetireOpen(false);
            setLocalPanel(retired);
            onChanged?.();
          }}
        />
      )}
    </>
  );
}
