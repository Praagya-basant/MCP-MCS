import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/core/components/PageHeader';
import { Card, CardHeader, CardBody } from '@/core/components/Card';
import { Button } from '@/core/components/Button';
import { Input, FormField } from '@/core/components/Input';
import { Toggle } from '@/core/components/Toggle';
import { FileUpload } from '@/core/components/FileUpload';
import { Badge } from '@/core/components/Badge';
import { useAsyncData } from '@/core/hooks/useAsyncData';
import { useToast } from '@/core/context/ToastContext';
import { listMovements } from '@/modules/mcs/api/movementsApi';
import { getAppSettings, updateAppSettings, uploadAppLogo, triggerRedeploy } from '@/core/lib/appSettingsApi';
import { logAuditEvent } from '@/core/lib/auditLog';
import { IconTrash, IconHistory } from '@/core/components/icons';
import { ClearMovementHistoryDialog } from '@/admin/components/ClearMovementHistoryDialog';

const NOTIFICATION_EVENTS = [
  { key: 'sample_issued', label: 'Sample Issued' },
  { key: 'sample_returned', label: 'Sample Returned' },
  { key: 'validity_expiring', label: 'Validity Expiring' },
  { key: 'shift_requested', label: 'Hall Shift Requested' },
  { key: 'recall_raised', label: 'Recall Raised' },
];

/**
 * Home for dangerous/irreversible admin actions plus general platform
 * configuration — kept together so there's exactly one place admins look
 * for both.
 */
export default function AdminSettings() {
  const navigate = useNavigate();
  const toast = useToast();
  const { data: movements, loading, reload } = useAsyncData(listMovements, []);
  const [clearOpen, setClearOpen] = useState(false);

  const { data: settings, loading: settingsLoading, setData: setSettings } = useAsyncData(getAppSettings, []);
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [deployHookUrl, setDeployHookUrl] = useState('');
  const [prefs, setPrefs] = useState({});
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [savingDeployHook, setSavingDeployHook] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setSenderName(settings.sender_name || '');
    setSenderEmail(settings.sender_email || '');
    setDeployHookUrl(settings.deploy_hook_url || '');
    setPrefs(settings.notification_prefs || {});
  }, [settings]);

  async function handleSaveIdentity() {
    setSavingIdentity(true);
    try {
      const updated = await updateAppSettings({ sender_name: senderName.trim(), sender_email: senderEmail.trim() });
      setSettings(updated);
      logAuditEvent('settings.update', { field: 'sender_identity' });
      toast.success('Sender identity saved');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingIdentity(false);
    }
  }

  async function handleTogglePref(key, value) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try {
      const updated = await updateAppSettings({ notification_prefs: next });
      setSettings(updated);
    } catch (err) {
      setPrefs(prefs);
      toast.error(err.message);
    }
  }

  async function handleSaveDeployHook() {
    setSavingDeployHook(true);
    try {
      const updated = await updateAppSettings({ deploy_hook_url: deployHookUrl.trim() || null });
      setSettings(updated);
      logAuditEvent('settings.update', { field: 'deploy_hook_url' });
      toast.success('Deploy hook saved');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingDeployHook(false);
    }
  }

  async function handleTriggerRedeploy() {
    setDeploying(true);
    try {
      await triggerRedeploy(settings?.deploy_hook_url);
      logAuditEvent('settings.trigger_redeploy', {});
      toast.success('Redeploy triggered');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeploying(false);
    }
  }

  async function handleUploadLogo() {
    if (!(logoFile instanceof File)) return;
    setUploadingLogo(true);
    try {
      const updated = await uploadAppLogo(logoFile);
      setSettings(updated);
      setLogoFile(null);
      logAuditEvent('settings.update', { field: 'logo_url' });
      toast.success('Logo uploaded');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploadingLogo(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        description="Platform configuration and maintenance."
        actions={
          <Button variant="secondary" onClick={() => navigate('/admin/audit-log')}>
            <IconHistory className="w-4 h-4" />
            Audit Log
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <h2 className="text-body-lg font-semibold text-ink">Email Sender Identity</h2>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-4 max-w-xl">
            <FormField label="Sender Name" htmlFor="sender-name">
              <Input id="sender-name" value={senderName} onChange={(e) => setSenderName(e.target.value)} disabled={settingsLoading} />
            </FormField>
            <FormField label="Sender Address" htmlFor="sender-email">
              <Input id="sender-email" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} disabled={settingsLoading} />
            </FormField>
          </div>
          <Button className="mt-4" onClick={handleSaveIdentity} loading={savingIdentity} disabled={settingsLoading}>
            Save
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-body-lg font-semibold text-ink">Notification Preferences</h2>
          <p className="mt-0.5 text-caption text-ink-secondary">Turn off an event to stop it from notifying anyone platform-wide.</p>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          {NOTIFICATION_EVENTS.map((e) => (
            <Toggle
              key={e.key}
              label={e.label}
              checked={prefs[e.key] !== false}
              onChange={(v) => handleTogglePref(e.key, v)}
              disabled={settingsLoading}
            />
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-body-lg font-semibold text-ink">API Keys</h2>
          <p className="mt-0.5 text-caption text-ink-secondary">
            Real keys are never stored here — they live as Supabase Edge Function secrets and are only shown as configured/not configured.
          </p>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-body text-ink">Resend (Email)</span>
            <Badge className="bg-status-in-hall-bg text-status-in-hall-text">Configured</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-body text-ink">WhatsApp</span>
            <Badge>Not configured — stub ready</Badge>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-body-lg font-semibold text-ink">Deployment</h2>
        </CardHeader>
        <CardBody>
          <FormField label="Vercel Deploy Hook URL" htmlFor="deploy-hook" hint="Project Settings -> Git -> Deploy Hooks in Vercel">
            <Input
              id="deploy-hook"
              value={deployHookUrl}
              onChange={(e) => setDeployHookUrl(e.target.value)}
              placeholder="https://api.vercel.com/v1/integrations/deploy/..."
              disabled={settingsLoading}
            />
          </FormField>
          <div className="mt-4 flex items-center gap-2">
            <Button variant="secondary" onClick={handleSaveDeployHook} loading={savingDeployHook} disabled={settingsLoading}>
              Save Deploy Hook
            </Button>
            <Button onClick={handleTriggerRedeploy} loading={deploying} disabled={!settings?.deploy_hook_url}>
              Trigger Redeploy
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-body-lg font-semibold text-ink">App Logo</h2>
        </CardHeader>
        <CardBody>
          <div className="flex items-center gap-4">
            {settings?.logo_url && <img src={settings.logo_url} alt="Current logo" className="h-10 object-contain" />}
            <FileUpload value={logoFile} onChange={setLogoFile} accept="image/*" className="max-w-xs" />
          </div>
          <Button className="mt-4" onClick={handleUploadLogo} loading={uploadingLogo} disabled={!logoFile}>
            Upload Logo
          </Button>
        </CardBody>
      </Card>

      <div className="bg-card border border-error/25 rounded-card shadow-card px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-error shrink-0">
            <IconTrash className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-body-lg font-semibold text-ink">Clear Test Data</h2>
            <p className="mt-0.5 text-body text-ink-secondary max-w-md">
              Permanently deletes every movement record across every hall and buyer. Use this to
              wipe test movements before going live — it cannot be undone.
            </p>
          </div>
        </div>
        <Button variant="danger" onClick={() => setClearOpen(true)} disabled={loading || (movements || []).length === 0}>
          Clear Test Data
        </Button>
      </div>

      <ClearMovementHistoryDialog open={clearOpen} onClose={() => setClearOpen(false)} onCleared={reload} />
    </div>
  );
}
