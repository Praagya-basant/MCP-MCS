import { useEffect, useState } from 'react';
import { Drawer } from '@/shared/components/Drawer';
import { StatusBadge } from '@/shared/components/Badge';
import { Textarea } from '@/shared/components/Input';
import { Button } from '@/shared/components/Button';
import { CardListSkeleton } from '@/shared/components/Skeleton';
import { EmptyState } from '@/shared/components/EmptyState';
import { useAuth } from '@/shared/context/AuthContext';
import { useToast } from '@/shared/context/ToastContext';
import { listMovementsForSample } from '@/modules/mcs/api/movementsApi';
import { listComments, addComment } from '@/modules/mcs/api/commentsApi';
import { formatDateTime, initials } from '@/shared/utils/formatters';

export function SampleDetailDrawer({ open, onClose, sample }) {
  const { profile } = useAuth();
  const toast = useToast();
  const [movements, setMovements] = useState(null);
  const [comments, setComments] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!open || !sample) return;
    setLoading(true);
    Promise.all([listMovementsForSample(sample.id), listComments(sample.id)])
      .then(([m, c]) => {
        setMovements(m);
        setComments(c);
      })
      .finally(() => setLoading(false));
  }, [open, sample]);

  async function handlePostComment() {
    if (!newComment.trim()) return;
    setPosting(true);
    try {
      const comment = await addComment({ sampleId: sample.id, authorId: profile.id, comment: newComment.trim() });
      setComments((prev) => [...(prev || []), comment]);
      setNewComment('');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPosting(false);
    }
  }

  if (!sample) return null;

  return (
    <Drawer open={open} onClose={onClose} title={sample.bt_code}>
      <div className="flex flex-col gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <StatusBadge status={sample.status} />
            <span className="text-caption text-ink-secondary">Hall {sample.hall?.hall_number}</span>
          </div>
          <h3 className="text-body-lg font-semibold text-ink">{sample.product_name}</h3>
          {sample.product_ref && <p className="text-caption text-ink-secondary">Ref: {sample.product_ref}</p>}
          {sample.image_url && (
            <img
              src={sample.image_url}
              alt={sample.product_name}
              className="mt-3 w-full max-h-64 object-cover rounded-control border border-border"
            />
          )}
        </div>

        <div>
          <h4 className="text-body font-semibold text-ink mb-3">Movement History</h4>
          {loading ? (
            <CardListSkeleton rows={3} />
          ) : movements.length === 0 ? (
            <EmptyState title="No movement yet" description="This sample hasn't left the hall." className="py-8" />
          ) : (
            <ul className="flex flex-col gap-3">
              {movements.map((m) => (
                <li key={m.id} className="border border-border rounded-control px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-body font-medium text-ink">
                      {m.status === 'out' ? 'Checked out' : 'Returned'}
                    </span>
                    <span className="text-caption text-ink-muted">
                      {formatDateTime(m.status === 'out' ? m.picked_at : m.returned_at)}
                    </span>
                  </div>
                  <p className="text-caption text-ink-secondary mt-1">
                    {m.picked_by_name} · {m.destination} · {m.reason === 'Other' ? m.reason_other : m.reason}
                  </p>
                  {m.notes && <p className="text-caption text-ink-muted mt-1">{m.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h4 className="text-body font-semibold text-ink mb-3">Comments</h4>
          {loading ? (
            <CardListSkeleton rows={2} />
          ) : comments.length === 0 ? (
            <p className="text-caption text-ink-muted mb-3">No comments yet.</p>
          ) : (
            <ul className="flex flex-col gap-3 mb-3">
              {comments.map((c) => (
                <li key={c.id} className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-surface-subtle text-ink-secondary flex items-center justify-center text-caption font-medium shrink-0">
                    {initials(c.author?.full_name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-caption text-ink-secondary">
                      <span className="font-medium text-ink">{c.author?.full_name}</span> · {formatDateTime(c.created_at)}
                    </p>
                    <p className="text-body text-ink">{c.comment}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col gap-2">
            <Textarea
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={2}
            />
            <Button size="sm" className="self-end" onClick={handlePostComment} loading={posting} disabled={!newComment.trim()}>
              Post Comment
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
