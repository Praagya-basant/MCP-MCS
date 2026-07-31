import { useEffect, useState } from 'react';
import { Drawer } from '@/shared/components/Drawer';
import { StatusBadge, Badge, ValidityBadge } from '@/shared/components/Badge';
import { Textarea } from '@/shared/components/Input';
import { Button } from '@/shared/components/Button';
import { CardListSkeleton } from '@/shared/components/Skeleton';
import { EmptyState } from '@/shared/components/EmptyState';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { SampleThumbnail } from '@/modules/mcs/components/SampleThumbnail';
import { IssueSampleModal } from '@/modules/mcs/components/IssueSampleModal';
import { ForwardSampleModal } from '@/modules/mcs/components/ForwardSampleModal';
import { ManageValidityModal } from '@/shared/components/ManageValidityModal';
import { RaiseRecallModal } from '@/modules/mcs/merchant/components/RaiseRecallModal';
import { RequestValidityExtensionModal } from '@/shared/components/RequestValidityExtensionModal';
import { RaiseShiftRequestModal } from '@/modules/mcs/components/RaiseShiftRequestModal';
import { useAuth } from '@/shared/context/AuthContext';
import { useToast } from '@/shared/context/ToastContext';
import { listMovementsForSample, getOpenMovementForSample, returnSample } from '@/modules/mcs/api/movementsApi';
import { getSample } from '@/modules/mcs/api/samplesApi';
import { listComments, addComment } from '@/modules/mcs/api/commentsApi';
import { listValidityChanges } from '@/shared/lib/validityApi';
import { formatDateTime, formatDate, initials, getSampleDisplayStatus } from '@/shared/utils/formatters';
import { SAMPLE_STATUS, ROLES } from '@/shared/utils/constants';
import { cn } from '@/shared/utils/cn';

const TABS = [
  { id: 'details', label: 'Details' },
  { id: 'history', label: 'Movement History' },
  { id: 'comments', label: 'Comments' },
];

/**
 * Shared across all three MCS roles (see /admin/samples, /hall/samples,
 * /merchant/samples) — clicking any sample row opens this. Footer actions
 * are role-gated: hall managers and admins get Issue/Return, merchants
 * get Raise Recall. Holds a local copy of the sample so status flips
 * (and the footer swaps Issue<->Return) the instant an action succeeds,
 * without waiting on the parent list's refetch round-trip.
 */
export function SampleDetailDrawer({ open, onClose, sample, onChanged }) {
  const { profile, role } = useAuth();
  const toast = useToast();
  const [localSample, setLocalSample] = useState(sample);
  const [tab, setTab] = useState('details');
  const [movements, setMovements] = useState(null);
  const [comments, setComments] = useState(null);
  const [validityChanges, setValidityChanges] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [returnConfirmOpen, setReturnConfirmOpen] = useState(false);
  const [returning, setReturning] = useState(false);
  const [recallOpen, setRecallOpen] = useState(false);
  const [manageValidityOpen, setManageValidityOpen] = useState(false);
  const [requestExtensionOpen, setRequestExtensionOpen] = useState(false);
  const [shiftRequestOpen, setShiftRequestOpen] = useState(false);

  const isAdmin = role === ROLES.SUPER_ADMIN;
  const isMerchant = role === ROLES.MERCHANT;

  useEffect(() => {
    if (sample) setLocalSample(sample);
  }, [sample]);

  useEffect(() => {
    if (!open || !sample) return;
    setTab('details');
    setLoading(true);
    Promise.all([
      listMovementsForSample(sample.id),
      listComments(sample.id),
      isAdmin ? listValidityChanges(sample.id) : Promise.resolve(null),
    ])
      .then(([m, c, v]) => {
        setMovements(m);
        setComments(c);
        setValidityChanges(v);
      })
      .finally(() => setLoading(false));
    // Intentionally keyed on the id, not the `sample` object reference —
    // refetch when a different sample opens, not on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sample?.id, isAdmin]);

  function reloadHistory() {
    return listMovementsForSample(localSample.id).then(setMovements);
  }

  async function handleForwardSuccess() {
    const fresh = await getSample(localSample.id);
    setLocalSample(fresh);
    reloadHistory();
    onChanged?.();
  }

  function handleValidityUpdated(newExpiryDate) {
    setLocalSample((prev) => ({ ...prev, expiry_date: newExpiryDate }));
    onChanged?.();
    listValidityChanges(localSample.id).then(setValidityChanges);
  }

  async function handlePostComment() {
    if (!newComment.trim()) return;
    setPosting(true);
    try {
      const comment = await addComment({ sampleId: localSample.id, authorId: profile.id, comment: newComment.trim() });
      setComments((prev) => [...(prev || []), comment]);
      setNewComment('');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPosting(false);
    }
  }

  function handleIssueSuccess() {
    setLocalSample((prev) => ({ ...prev, status: SAMPLE_STATUS.CHECKED_OUT }));
    reloadHistory();
    onChanged?.();
  }

  async function handleConfirmReturn() {
    setReturning(true);
    try {
      const movement = await getOpenMovementForSample(localSample.id);
      if (!movement) throw new Error('No active issue found for this sample.');
      await returnSample({ movement, sample: localSample });
      setLocalSample((prev) => ({ ...prev, status: SAMPLE_STATUS.IN_HALL }));
      toast.success(`${localSample.bt_code} marked as returned`);
      setReturnConfirmOpen(false);
      reloadHistory();
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setReturning(false);
    }
  }

  if (!localSample) return null;

  const openMovement = (movements || []).find((m) => m.status === 'out') || null;
  const displayStatus = getSampleDisplayStatus(localSample.status, openMovement?.hop_number);

  const canIssueReturn = role === ROLES.HALL_MANAGER || role === ROLES.SUPER_ADMIN;
  const showIssue = canIssueReturn && localSample.status === SAMPLE_STATUS.IN_HALL;
  const showReturn = canIssueReturn && localSample.status === SAMPLE_STATUS.CHECKED_OUT;
  // Mirrors forward_sample()'s own authorization check server-side: admin,
  // or the hall_manager whose hall currently "has" the sample.
  const showForward =
    canIssueReturn &&
    localSample.status === SAMPLE_STATUS.CHECKED_OUT &&
    (isAdmin || profile?.hall_id === localSample.hall_id);
  const showRecall = isMerchant && localSample.status === SAMPLE_STATUS.CHECKED_OUT;
  // Mirrors shift_requests_insert's own RLS check: the current hall's
  // manager, or the sample's own merchant, and only while it's sitting
  // in_hall (a checked-out sample moves via Forward instead). Admin
  // already has direct hall reassignment via Edit Sample Hall, so no
  // approval-request path is offered here for admin.
  const showShiftRequest =
    localSample.status === SAMPLE_STATUS.IN_HALL &&
    ((role === ROLES.HALL_MANAGER && profile?.hall_id === localSample.hall_id) || isMerchant);
  const hasFooterAction = showIssue || showReturn || showForward || showRecall || showShiftRequest;

  return (
    <>
      <Drawer open={open} onClose={onClose}>
        <div className="flex flex-col h-full min-h-0">
          <div className="relative shrink-0">
            <SampleThumbnail sample={localSample} size="lg" />
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
              <p className="font-mono text-caption text-ink-secondary tracking-wide">{localSample.bt_code}</p>
              <h3 className="mt-0.5 text-body-lg font-semibold text-ink">{localSample.product_name}</h3>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {localSample.buyer?.name && <Badge>{localSample.buyer.name}</Badge>}
                {localSample.hall?.name && <Badge>{localSample.hall.name}</Badge>}
                <StatusBadge status={displayStatus} />
                <ValidityBadge expiryDate={localSample.expiry_date} />
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
              <>
                <dl className="grid grid-cols-[140px_1fr] gap-y-3 text-body">
                  <dt className="text-ink-secondary">BT Code</dt>
                  <dd className="text-ink font-mono">{localSample.bt_code}</dd>
                  <dt className="text-ink-secondary">Product Ref</dt>
                  <dd className="text-ink">{localSample.product_ref || '—'}</dd>
                  <dt className="text-ink-secondary">Product Name</dt>
                  <dd className="text-ink">{localSample.product_name}</dd>
                  <dt className="text-ink-secondary">Collection</dt>
                  <dd className="text-ink">{localSample.collection_name || '—'}</dd>
                  <dt className="text-ink-secondary">Buyer</dt>
                  <dd className="text-ink">{localSample.buyer?.name || '—'}</dd>
                  <dt className="text-ink-secondary">Hall</dt>
                  <dd className="text-ink">{localSample.hall?.name}</dd>
                  <dt className="text-ink-secondary">Status</dt>
                  <dd>
                    <StatusBadge status={displayStatus} />
                  </dd>
                  <dt className="text-ink-secondary">Signed By</dt>
                  <dd className="text-ink">{localSample.signed_by || '—'}</dd>
                  <dt className="text-ink-secondary">Signed Date</dt>
                  <dd className="text-ink">{localSample.signed_date ? formatDate(localSample.signed_date) : '—'}</dd>
                  <dt className="text-ink-secondary">Validity</dt>
                  <dd className="text-ink">
                    {localSample.expiry_date ? (
                      <span className="flex items-center gap-2">
                        {formatDate(localSample.expiry_date)}
                        <ValidityBadge expiryDate={localSample.expiry_date} />
                      </span>
                    ) : (
                      '—'
                    )}
                  </dd>
                  <dt className="text-ink-secondary">Date Added to Hall</dt>
                  <dd className="text-ink">
                    {localSample.date_added_to_hall ? formatDate(localSample.date_added_to_hall) : formatDate(localSample.created_at)}
                  </dd>
                </dl>

                {isAdmin && (
                  <div className="mt-4">
                    <Button variant="secondary" size="sm" onClick={() => setManageValidityOpen(true)}>
                      Manage Validity
                    </Button>
                  </div>
                )}
                {isMerchant && (
                  <div className="mt-4">
                    <Button variant="secondary" size="sm" onClick={() => setRequestExtensionOpen(true)}>
                      Request Validity Extension
                    </Button>
                  </div>
                )}

                {isAdmin && (
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
              </>
            )}

            {tab === 'history' &&
              (loading ? (
                <CardListSkeleton rows={3} />
              ) : movements.length === 0 ? (
                <EmptyState title="No movement yet" description="This sample hasn't left the hall." className="py-8" />
              ) : (
                <ul className="flex flex-col">
                  {movements.map((m, i) => {
                    const isShift = m.reason === 'Hall Shift';
                    const isReturned = m.status === 'returned';
                    const isLast = i === movements.length - 1;
                    return (
                      <li key={m.id} className={cn('relative pl-5', !isLast && 'pb-4')}>
                        <span
                          className={cn(
                            'absolute left-0 top-1 w-1.5 h-1.5 rounded-full',
                            isShift ? 'bg-status-in-transit-text' : isReturned ? 'bg-status-in-hall-text' : 'bg-status-checked-out-text'
                          )}
                        />
                        {!isLast && <span className="absolute left-[2.5px] top-3 bottom-0 w-px bg-border" />}

                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-body font-semibold text-ink">
                            {isShift ? 'Hall Shift' : isReturned ? 'Returned' : m.hop_number > 1 ? 'Forwarded' : 'Issued'}
                          </span>
                          <span className="text-[12px] text-ink-muted shrink-0">{formatDateTime(m.picked_at)}</span>
                        </div>
                        <p className="mt-1 text-[13px] text-ink-secondary">
                          {m.from_hall?.name ? `From: ${m.from_hall.name} · ` : ''}To: {m.destination}
                        </p>
                        {!isShift && (
                          <p className="mt-0.5 text-[13px] text-ink-secondary">
                            Reason: {m.reason === 'Other' ? m.reason_other : m.reason}
                          </p>
                        )}
                        {m.supplier_name && (
                          <p className="mt-0.5 text-[13px] text-ink-secondary">Supplier: {m.supplier_name}</p>
                        )}
                        {m.purchaser_name && (
                          <p className="mt-0.5 text-[13px] text-ink-secondary">Purchaser: {m.purchaser_name}</p>
                        )}
                        {isReturned && !isShift && (
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

            {tab === 'comments' && (
              <div className="flex flex-col gap-4">
                {loading ? (
                  <CardListSkeleton rows={2} />
                ) : comments.length === 0 ? (
                  <p className="text-caption text-ink-muted">No comments yet.</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {comments.map((c) => (
                      <li key={c.id} className="flex gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-surface-subtle text-ink-secondary flex items-center justify-center text-caption font-medium shrink-0">
                          {initials(c.author?.full_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-caption text-ink-secondary">
                            <span className="font-medium text-ink">{c.author?.full_name}</span> ·{' '}
                            {formatDateTime(c.created_at)}
                          </p>
                          <p className="text-body text-ink">{c.comment}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {isMerchant && (
                  <div className="flex flex-col gap-2 pt-2 border-t border-border">
                    <Textarea
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      rows={2}
                    />
                    <Button
                      size="sm"
                      className="self-end"
                      onClick={handlePostComment}
                      loading={posting}
                      disabled={!newComment.trim()}
                    >
                      Post Comment
                    </Button>
                  </div>
                )}
              </div>
            )}
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
              {showRecall && (
                <Button variant="secondary" className="flex-1" onClick={() => setRecallOpen(true)}>
                  Raise Recall
                </Button>
              )}
              {showShiftRequest && (
                <Button variant="secondary" className="flex-1" onClick={() => setShiftRequestOpen(true)}>
                  Request Hall Shift
                </Button>
              )}
            </div>
          )}
        </div>
      </Drawer>

      <IssueSampleModal
        open={issueOpen}
        sample={localSample}
        onClose={() => setIssueOpen(false)}
        onSuccess={handleIssueSuccess}
      />

      <ForwardSampleModal
        open={forwardOpen}
        sample={localSample}
        movement={openMovement}
        onClose={() => setForwardOpen(false)}
        onSuccess={handleForwardSuccess}
      />

      <ConfirmDialog
        open={returnConfirmOpen}
        onClose={() => setReturnConfirmOpen(false)}
        onConfirm={handleConfirmReturn}
        title="Confirm Return"
        description={`Mark ${localSample.bt_code} as returned to ${localSample.hall?.name}? The return time is recorded automatically.`}
        confirmLabel="Confirm Return"
        loading={returning}
      />

      {isMerchant && (
        <RaiseRecallModal
          open={recallOpen}
          onClose={() => setRecallOpen(false)}
          sample={localSample}
          onCreated={() => setRecallOpen(false)}
        />
      )}

      {isMerchant && (
        <RequestValidityExtensionModal
          open={requestExtensionOpen}
          onClose={() => setRequestExtensionOpen(false)}
          item={{ ...localSample, code: localSample.bt_code, name: localSample.product_name }}
          itemType="sample"
          onCreated={() => setRequestExtensionOpen(false)}
        />
      )}

      {showShiftRequest && (
        <RaiseShiftRequestModal
          open={shiftRequestOpen}
          onClose={() => setShiftRequestOpen(false)}
          sample={localSample}
          onCreated={() => setShiftRequestOpen(false)}
        />
      )}

      {isAdmin && (
        <ManageValidityModal
          open={manageValidityOpen}
          onClose={() => setManageValidityOpen(false)}
          item={{ ...localSample, code: localSample.bt_code, name: localSample.product_name }}
          itemType="sample"
          onSuccess={(newExpiryDate) => {
            setManageValidityOpen(false);
            handleValidityUpdated(newExpiryDate);
          }}
        />
      )}
    </>
  );
}
