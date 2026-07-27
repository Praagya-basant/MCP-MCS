import { useState } from 'react';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { Input, Textarea, FormField } from '@/shared/components/Input';
import { useAuth } from '@/shared/context/AuthContext';
import { useToast } from '@/shared/context/ToastContext';
import { submitFeedback } from '@/shared/lib/feedbackApi';
import { ROLE_LABELS } from '@/shared/utils/constants';

/** Manager/merchant "Send Feedback" — reached from the sidebar footer. */
export function SendFeedbackModal({ open, onClose }) {
  const { profile } = useAuth();
  const toast = useToast();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleClose() {
    setSubject('');
    setMessage('');
    setError('');
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
      await submitFeedback({
        senderId: profile.id,
        senderName: profile.full_name,
        senderRole: ROLE_LABELS[profile.role] || profile.role,
        subject: subject.trim(),
        message: message.trim(),
      });
      toast.success('Feedback sent successfully');
      handleClose();
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
      title="Send Feedback"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            Submit
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <FormField label="Subject" htmlFor="feedback-subject" required error={error}>
          <Input id="feedback-subject" value={subject} onChange={(e) => setSubject(e.target.value)} autoFocus />
        </FormField>

        <FormField label="Message" htmlFor="feedback-message" required>
          <Textarea id="feedback-message" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
        </FormField>
      </form>
    </Modal>
  );
}
