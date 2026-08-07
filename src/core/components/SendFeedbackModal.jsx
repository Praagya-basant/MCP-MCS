import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Modal } from '@/core/components/Modal';
import { Button } from '@/core/components/Button';
import { Input, Textarea, FormField } from '@/core/components/Input';
import { IconMessage } from '@/core/components/icons';
import { useAuth } from '@/core/auth/AuthContext';
import { submitFeedback } from '@/core/lib/feedbackApi';
import { ROLE_LABELS } from '@/core/utils/constants';
import { formatDateTime } from '@/core/utils/formatters';

/** Manager/merchant "Support" — reached from the Sidebar's account dropdown. */
export function SendFeedbackModal({ open, onClose }) {
  const { profile } = useAuth();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(null);

  function reset() {
    setSubject('');
    setMessage('');
    setError('');
    setSent(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      setError('Fill in both fields.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const created = await submitFeedback({
        senderId: profile.id,
        senderName: profile.full_name,
        senderRole: ROLE_LABELS[profile.role] || profile.role,
        subject: subject.trim(),
        message: message.trim(),
      });
      setSent(created);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Support"
      footer={
        sent ? (
          <Button onClick={handleClose}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={submitting}>
              Send Message
            </Button>
          </>
        )
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        {sent ? (
          <motion.div
            key="confirmation"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col items-center text-center py-4"
          >
            <span className="w-14 h-14 rounded-full bg-status-in-hall-bg text-status-in-hall-text flex items-center justify-center">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-7 h-7">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
            <p className="mt-4 text-body-lg font-semibold text-ink">Your message has been received.</p>
            <p className="mt-1 text-body text-ink-secondary">We'll get back to you shortly.</p>
            <div className="mt-5 w-full rounded-control bg-surface-subtle px-4 py-3 text-left">
              <p className="text-caption font-medium text-ink truncate">{sent.subject}</p>
              <p className="mt-2 text-[11px] text-ink-muted">
                Sent by {profile?.full_name} &middot; {formatDateTime(sent.created_at)}
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onSubmit={handleSubmit}
            className="flex flex-col gap-4"
            noValidate
          >
            <div className="-mt-1 mb-1 flex items-start gap-3 pb-4 border-b border-border">
              <span className="w-9 h-9 rounded-full bg-accent/12 text-accent flex items-center justify-center shrink-0">
                <IconMessage className="w-4 h-4" />
              </span>
              <div>
                <p className="text-body font-medium text-ink">Talk to the BASANT team</p>
                <p className="text-caption text-ink-secondary">We typically respond within one business day.</p>
              </div>
            </div>

            <FormField label="Subject" htmlFor="feedback-subject" required error={error}>
              <Input id="feedback-subject" value={subject} onChange={(e) => setSubject(e.target.value)} autoFocus />
            </FormField>

            <FormField label="Message" htmlFor="feedback-message" required>
              <Textarea
                id="feedback-message"
                rows={5}
                placeholder="What's going on?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </FormField>
          </motion.form>
        )}
      </AnimatePresence>
    </Modal>
  );
}
