import { useEffect, useState } from 'react';
import { Drawer } from '@/shared/components/Drawer';
import { StatusBadge, Badge } from '@/shared/components/Badge';
import { Textarea } from '@/shared/components/Input';
import { Button } from '@/shared/components/Button';
import { CardListSkeleton } from '@/shared/components/Skeleton';
import { EmptyState } from '@/shared/components/EmptyState';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { SampleThumbnail } from '@/modules/mcs/components/SampleThumbnail';
import { IssueSampleModal } from '@/modules/mcs/components/IssueSampleModal';
import { RaiseRecallModal } from '@/modules/mcs/merchant/components/RaiseRecallModal';
import { useAuth } from '@/shared/context/AuthContext';
import { useToast } from '@/shared/context/ToastContext';
import { listMovementsForSample, getOpenMovementForSample, returnSample } from '@/modules/mcs/api/movementsApi';
import { listComments, addComment } from '@/modules/mcs/api/commentsApi';
import { formatDateTime, formatDate, initials } from '@/shared/utils/formatters';
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
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [returnConfirmOpen, setReturnConfirmOpen] = useState(false);
  const [returning, setReturning] = useState(false);
  const [recallOpen, setRecallOpen] = useState(false);

  useEffect(() => {
    if (sample) setLocalSample(sample);
  }, [sample]);

  useEffect(() => {
    if (!open || !sample) return;
    setTab('details');
    setLoading(true);
    Promise.all([listMovementsForSample(sample.id), listComments(sample.id)])
      .then(([m, c]) => {
        setMovements(m);
        setComments(c);
      })
      .finally(() => setLoading(false));
    // Intentionally keyed on the id, not the `sample` object reference —
    // refetch when a different sample opens, not on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sample?.id]);

  function reloadHistory() {
    return listMovementsForSample(localSample.id).then(setMovements);
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

  const canIssueReturn = role === ROLES.HALL_MANAGER || role === ROLES.SUPER_ADMIN;
  const isMerchant = role === ROLES.MERCHANT;
  const showIssue = canIssueReturn && localSample.status === SAMPLE_STATUS.IN_HALL;
  const showReturn = canIssueReturn && localSample.status === SAMPLE_STATUS.CHECKED_OUT;
  const showRecall = isMerchant && localSample.status === SAMPLE_STATUS.CHECKED_OUT;
  const hasFooterAction = showIssue || showReturn || showRecall;

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
                <StatusBadge status={localSample.status} />
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
              <dl className="grid grid-cols-[120px_1fr] gap-y-3 text-body">
                <dt className="text-ink-secondary">BT Code</dt>
                <dd className="text-ink font-mono">{localSample.bt_code}</dd>
                <dt className="text-ink-secondary">Product Ref</dt>
                <dd className="text-ink">{localSample.product_ref || '—'}</dd>
                <dt className="text-ink-secondary">Product Name</dt>
                <dd className="text-ink">{localSample.product_name}</dd>
                <dt className="text-ink-secondary">Buyer</dt>
                <dd className="text-ink">{localSample.buyer?.name || '—'}</dd>
                <dt className="text-ink-secondary">Hall</dt>
                <dd className="text-ink">{localSample.hall?.name}</dd>
                <dt className="text-ink-secondary">Status</dt>
                <dd>
                  <StatusBadge status={localSample.status} />
                </dd>
                <dt className="text-ink-secondary">Date Added</dt>
                <dd className="text-ink">{formatDate(localSample.created_at)}</dd>
              </dl>
            )}

            {tab === 'history' &&
              (loading ? (
                <CardListSkeleton rows={3} />
              ) : movements.length === 0 ? (
                <EmptyState title="No movement yet" description="This sample hasn't left the hall." className="py-8" />
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
                          <span className="text-body font-semibold text-ink">{isReturned ? 'Returned' : 'Issued'}</span>
                          <span className="text-[12px] text-ink-muted shrink-0">{formatDateTime(m.picked_at)}</span>
                        </div>
                        <p className="mt-1 text-[13px] text-ink-secondary">To: {m.destination}</p>
                        <p className="mt-0.5 text-[13px] text-ink-secondary">
                          Reason: {m.reason === 'Other' ? m.reason_other : m.reason}
                        </p>
                        {isReturned && (
                          <p className="mt-0.5 text-[12px] text-status-in-hall-text">
                            Returned: {formatDateTime(m.returned_at)}
                          </p>
                        )}
                        {m.notes && <p className="mt-0.5 text-[13px] text-ink-muted">{m.notes}</p>}
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
              {showRecall && (
                <Button variant="secondary" className="flex-1" onClick={() => setRecallOpen(true)}>
                  Raise Recall
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
    </>
  );
}
