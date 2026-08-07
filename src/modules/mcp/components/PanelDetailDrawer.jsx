import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Drawer } from '@/core/components/Drawer';
import { PanelStatusBadge, Badge, ValidityBadge } from '@/core/components/Badge';
import { Button } from '@/core/components/Button';
import { CardListSkeleton } from '@/core/components/Skeleton';
import { EmptyState } from '@/core/components/EmptyState';
import { ConfirmDialog } from '@/core/components/ConfirmDialog';
import { PanelThumbnail } from '@/modules/mcp/components/PanelThumbnail';
import { IssuePanelModal } from '@/modules/mcp/components/IssuePanelModal';
import { ForwardPanelModal } from '@/modules/mcp/components/ForwardPanelModal';
import { RetirePanelModal } from '@/modules/mcp/pages/admin/components/RetirePanelModal';
import { ManageValidityModal } from '@/core/components/ManageValidityModal';
import { RequestValidityExtensionModal } from '@/core/components/RequestValidityExtensionModal';
import { PanelImageModal } from '@/modules/mcp/components/PanelImageModal';
import { useAuth } from '@/core/auth/AuthContext';
import { useToast } from '@/core/context/ToastContext';
import { listPanelMovementsForPanel, returnPanel } from '@/modules/mcp/api/panelMovementsApi';
import { getPanel } from '@/modules/mcp/api/panelsApi';
import { listValidityChanges } from '@/core/lib/validityApi';
import { formatDateTime, formatDate, getPanelDisplayStatus } from '@/core/utils/formatters';
import { PANEL_STATUS, ROLES } from '@/core/utils/constants';
import { cn } from '@/core/utils/cn';
import { safeFetch } from '@/core/utils/safeFetch';

const TABS = [
  { id: 'details', label: 'Details' },
  { id: 'history', label: 'Movement History' },
];

/**
 * Mirrors SampleDetailDrawer's shape (tabs, footer actions, journey
 * timeline, Manage Validity / Request Extension) minus what panels don't
 * have at all: no Comments tab (no panel_comments table).
 */
export function PanelDetailDrawer({ open, onClose, panel, onChanged }) {
  const { profile, role } = useAuth();
  const toast = useToast();
  const [localPanel, setLocalPanel] = useState(panel);
  const [tab, setTab] = useState('details');
  const [movements, setMovements] = useState(null);
  const [validityChanges, setValidityChanges] = useState(null);
  const [loading, setLoading] = useState(true);
  const [issueOpen, setIssueOpen] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [returnConfirmOpen, setReturnConfirmOpen] = useState(false);
  const [returning, setReturning] = useState(false);
  const [retireOpen, setRetireOpen] = useState(false);
  const [manageValidityOpen, setManageValidityOpen] = useState(false);
  const [requestExtensionOpen, setRequestExtensionOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);

  const isAdmin = role === ROLES.SUPER_ADMIN;
  const isMerchant = role === ROLES.MERCHANT;

  useEffect(() => {
    if (panel) setLocalPanel(panel);
  }, [panel]);

  useEffect(() => {
    if (!open || !panel) return;
    setTab('details');
    setLoading(true);
    Promise.all([
      safeFetch(listPanelMovementsForPanel(panel.id), []),
      isAdmin ? safeFetch(listValidityChanges(panel.id), []) : Promise.resolve(null),
    ])
      .then(([m, v]) => {
        setMovements(m);
        setValidityChanges(v);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, panel?.id, isAdmin]);

  function reloadHistory() {
    return safeFetch(listPanelMovementsForPanel(localPanel.id), []).then(setMovements);
  }

  function handleValidityUpdated(newExpiryDate) {
    setLocalPanel((prev) => ({ ...prev, expiry_date: newExpiryDate }));
    onChanged?.();
    listValidityChanges(localPanel.id).then(setValidityChanges);
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
      await returnPanel({ panel: localPanel, movement });
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
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card to-transparent" />
            <span className="absolute top-3 left-3">
              <PanelStatusBadge status={displayStatus} className="shadow-card backdrop-blur-sm" />
            </span>
            <button
              onClick={onClose}
              className="interactive absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center text-ink hover:bg-white shadow-card"
              aria-label="Close"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
            <div className="relative px-6 pt-2 pb-4 border-b border-border">
              <p className="font-mono text-caption text-ink-secondary tracking-wide">{localPanel.panel_code}</p>
              <h3 className="mt-0.5 text-heading font-bold text-ink">{localPanel.panel_name}</h3>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {localPanel.buyer?.name && <Badge>{localPanel.buyer.name}</Badge>}
                {localPanel.hall?.name && <Badge>{localPanel.hall.name}</Badge>}
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
                  'interactive relative h-11 px-3 text-body font-medium whitespace-nowrap',
                  tab === t.id ? 'text-ink' : 'text-ink-secondary hover:text-ink'
                )}
              >
                {t.label}
                {tab === t.id && (
                  <motion.span
                    layoutId="panelDrawerTabIndicator"
                    className="absolute left-0 right-0 -bottom-px h-[2px] bg-ink rounded-full"
                    transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                  />
                )}
              </button>
            ))}
          </div>

          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5"
          >
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

            {tab === 'details' && isAdmin && (
              <div className="mt-4">
                <Button variant="secondary" size="sm" onClick={() => setManageValidityOpen(true)}>
                  Manage Validity
                </Button>
              </div>
            )}
            {tab === 'details' && isMerchant && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => setRequestExtensionOpen(true)}>
                  Request Validity Extension
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setImageModalOpen(true)}>
                  {localPanel.image_url ? 'Replace Image' : 'Upload Image'}
                </Button>
              </div>
            )}

            {tab === 'details' && isAdmin && (
              <div className="mt-6 pt-4 border-t border-border">
                <p className="text-caption font-medium text-ink-secondary mb-3">Validity History</p>
                {loading ? (
                  <CardListSkeleton rows={2} />
                ) : !validityChanges || validityChanges.length === 0 ? (
                  <p className="text-caption text-ink-muted">No validity changes yet.</p>
                ) : (
                  <ul className="flex flex-col gap-2.5">
                    {validityChanges.map((v) => (
                      <li key={v.id} className="text-[13px]">
                        <p className="text-ink">
                          {v.old_expiry_date ? formatDate(v.old_expiry_date) : 'Not set'} →{' '}
                          <span className="font-medium">{formatDate(v.new_expiry_date)}</span>
                        </p>
                        <p className="text-ink-muted">
                          {v.changed_by_profile?.full_name} · {formatDateTime(v.created_at)}
                          {v.reason ? ` · ${v.reason}` : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
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
                      <motion.li
                        key={m.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.05 }}
                        className={cn('relative pl-5', !isLast && 'pb-4')}
                      >
                        <span
                          className={cn(
                            'absolute left-0 top-4 w-1.5 h-1.5 rounded-full',
                            isReturned ? 'bg-status-in-hall-text' : 'bg-status-checked-out-text'
                          )}
                        />
                        {!isLast && <span className="absolute left-[2.5px] top-6 bottom-0 w-px bg-border" />}

                        <div className="rounded-card border border-border bg-surface-subtle px-3.5 py-3">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-body font-semibold text-ink">
                              {isReturned ? 'Returned' : m.hop_number > 1 ? 'Forwarded' : 'Issued'}
                            </span>
                            <span className="text-[12px] text-ink-muted shrink-0">{formatDateTime(m.picked_at)}</span>
                          </div>
                          <p className="mt-1.5 text-[13px] text-ink-secondary flex items-center gap-1.5 flex-wrap">
                            {m.from_hall?.name && (
                              <>
                                <span>{m.from_hall.name}</span>
                                <span aria-hidden="true">&rarr;</span>
                              </>
                            )}
                            <span className="text-ink font-medium">{m.destination}</span>
                          </p>
                          {m.picked_by_name && (
                            <p className="mt-1 text-[13px] text-ink-secondary">Picked by {m.picked_by_name}</p>
                          )}
                          {m.quantity != null && (
                            <p className="mt-1 text-[13px] text-ink-secondary">Quantity: {m.quantity}</p>
                          )}
                          <div className="mt-1.5">
                            <Badge>{m.reason === 'Other' ? m.reason_other : m.reason}</Badge>
                          </div>
                          {m.supplier_name && (
                            <p className="mt-1.5 text-[13px] text-ink-secondary">Supplier: {m.supplier_name}</p>
                          )}
                          {m.purchaser_name && (
                            <p className="mt-0.5 text-[13px] text-ink-secondary">Purchaser: {m.purchaser_name}</p>
                          )}
                          {isReturned && (
                            <p className="mt-1.5 text-[12px] text-status-in-hall-text">
                              Returned: {formatDateTime(m.returned_at)}
                            </p>
                          )}
                          {m.notes && <p className="mt-1.5 text-[13px] text-ink-muted">{m.notes}</p>}
                          {(m.photo_url || m.signature_url) && (
                            <div className="mt-2.5 flex items-center gap-2">
                              {m.photo_url && (
                                <a href={m.photo_url} target="_blank" rel="noreferrer" className="interactive">
                                  <img src={m.photo_url} alt="Movement photo" className="w-14 h-14 rounded-control object-cover border border-border" loading="lazy" />
                                </a>
                              )}
                              {m.signature_url && (
                                <a href={m.signature_url} target="_blank" rel="noreferrer" className="interactive">
                                  <img
                                    src={m.signature_url}
                                    alt="Signature"
                                    className="w-14 h-14 rounded-control object-contain border border-border bg-white p-1"
                                    loading="lazy"
                                  />
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.li>
                    );
                  })}
                </ul>
              ))}
          </motion.div>

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

      {isMerchant && (
        <RequestValidityExtensionModal
          open={requestExtensionOpen}
          onClose={() => setRequestExtensionOpen(false)}
          item={{ ...localPanel, code: localPanel.panel_code, name: localPanel.panel_name }}
          itemType="panel"
          onCreated={() => setRequestExtensionOpen(false)}
        />
      )}

      {isAdmin && (
        <ManageValidityModal
          open={manageValidityOpen}
          onClose={() => setManageValidityOpen(false)}
          item={{ ...localPanel, code: localPanel.panel_code, name: localPanel.panel_name }}
          itemType="panel"
          onSuccess={(newExpiryDate) => {
            setManageValidityOpen(false);
            handleValidityUpdated(newExpiryDate);
          }}
        />
      )}

      {isMerchant && (
        <PanelImageModal
          open={imageModalOpen}
          panel={localPanel}
          onClose={() => setImageModalOpen(false)}
          onSaved={(updated) => {
            setImageModalOpen(false);
            setLocalPanel(updated);
            onChanged?.();
          }}
        />
      )}
    </>
  );
}
