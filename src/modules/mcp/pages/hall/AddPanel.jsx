import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/core/components/PageHeader';
import { Card, CardBody } from '@/core/components/Card';
import { Button } from '@/core/components/Button';
import { Input, Select, FormField } from '@/core/components/Input';
import { FileUpload } from '@/core/components/FileUpload';
import { Toggle } from '@/core/components/Toggle';
import { useAsyncData } from '@/core/hooks/useAsyncData';
import { useAuth } from '@/core/auth/AuthContext';
import { useToast } from '@/core/context/ToastContext';
// Halls/buyers are platform-wide, not MCS-specific data — reused
// read-only from mcs/api rather than duplicated (see the module
// boundary note in CLAUDE.md; the "don't touch modules/mcs" rule is
// about not modifying MCS, not about never reading its shared lookups).
import { listBuyers } from '@/core/lib/buyersApi';
import { createPanel, uploadPanelImage } from '@/modules/mcp/api/panelsApi';

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addMonthsToDate(dateStr, months) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setMonth(d.getMonth() + Number(months));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const EMPTY = {
  panelCode: '',
  panelName: '',
  panelRef: '',
  panelFinish: '',
  finishRecipe: '',
  collectionName: '',
  buyerId: '',
  isShared: false,
  signedBy: '',
  signedDate: '',
  validityMonths: '',
  expiryDate: '',
  dateAddedToHall: todayIso(),
};

export default function AddPanel() {
  const navigate = useNavigate();
  const toast = useToast();
  const { profile } = useAuth();
  const { data: buyers, loading: buyersLoading } = useAsyncData(listBuyers, []);

  const [form, setForm] = useState(EMPTY);
  const [image, setImage] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const expiryManuallySetRef = useRef(false);

  useEffect(() => {
    if (expiryManuallySetRef.current) return;
    if (!form.signedDate || !form.validityMonths) return;
    setForm((prev) => ({ ...prev, expiryDate: addMonthsToDate(form.signedDate, form.validityMonths) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.signedDate, form.validityMonths]);

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setExpiryDate(value) {
    expiryManuallySetRef.current = true;
    set('expiryDate', value);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.panelCode.trim() || !form.panelName.trim() || !form.buyerId) {
      setError('Panel code, panel name, and buyer are required.');
      return;
    }

    setSubmitting(true);
    try {
      let imageUrl = null;
      if (image instanceof File) {
        imageUrl = await uploadPanelImage(image);
      }

      const panel = await createPanel({
        buyerId: form.buyerId,
        hallId: profile.hall_id,
        panelCode: form.panelCode.trim(),
        panelName: form.panelName.trim(),
        panelRef: form.panelRef.trim(),
        panelFinish: form.panelFinish.trim(),
        finishRecipe: form.finishRecipe.trim(),
        collectionName: form.collectionName.trim(),
        isShared: form.isShared,
        imageUrl,
        signedBy: form.signedBy.trim(),
        signedDate: form.signedDate,
        validityMonths: form.validityMonths ? Number(form.validityMonths) : null,
        expiryDate: form.expiryDate,
        dateAddedToHall: form.dateAddedToHall,
      });

      toast.success(`${panel.panel_code} added to ${profile.hall?.name}`);
      navigate('/hall/mcp/panels');
    } catch (err) {
      setError(err.message?.includes('duplicate') ? 'A panel with this code already exists.' : err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Add Panel" description="Sign a new panel into your hall." />

      <Card>
        <CardBody>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Panel Code" htmlFor="panel-code" required>
                <Input id="panel-code" value={form.panelCode} onChange={(e) => set('panelCode', e.target.value)} autoFocus />
              </FormField>

              <FormField label="Panel Reference" htmlFor="panel-ref" hint="Optional">
                <Input id="panel-ref" value={form.panelRef} onChange={(e) => set('panelRef', e.target.value)} />
              </FormField>
            </div>

            <FormField label="Panel Name" htmlFor="panel-name" required>
              <Input id="panel-name" value={form.panelName} onChange={(e) => set('panelName', e.target.value)} />
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Panel Finish" htmlFor="panel-finish" hint="Optional">
                <Input id="panel-finish" value={form.panelFinish} onChange={(e) => set('panelFinish', e.target.value)} />
              </FormField>

              <FormField label="Finish Recipe" htmlFor="finish-recipe" hint="Optional">
                <Input id="finish-recipe" value={form.finishRecipe} onChange={(e) => set('finishRecipe', e.target.value)} />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Buyer" htmlFor="buyer" required>
                <Select id="buyer" value={form.buyerId} onChange={(e) => set('buyerId', e.target.value)} disabled={buyersLoading}>
                  <option value="">Select buyer</option>
                  {(buyers || []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Collection Name" htmlFor="collection-name" hint="Optional">
                <Input id="collection-name" value={form.collectionName} onChange={(e) => set('collectionName', e.target.value)} />
              </FormField>
            </div>

            <div className="rounded-control border border-border px-3.5 py-3">
              <Toggle
                checked={form.isShared}
                onChange={(v) => set('isShared', v)}
                label="Shared Panel"
                hint="Visible to more than one buyer"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Signed By" htmlFor="signed-by" hint="Optional">
                <Input id="signed-by" value={form.signedBy} onChange={(e) => set('signedBy', e.target.value)} />
              </FormField>

              <FormField label="Signed Date" htmlFor="signed-date" hint="Optional">
                <Input id="signed-date" type="date" value={form.signedDate} onChange={(e) => set('signedDate', e.target.value)} />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Validity (months)" htmlFor="validity-months" hint="Auto-calculates Expiry Date">
                <Input
                  id="validity-months"
                  type="number"
                  min="0"
                  value={form.validityMonths}
                  onChange={(e) => set('validityMonths', e.target.value)}
                />
              </FormField>

              <FormField label="Expiry Date" htmlFor="expiry-date" hint="Auto-calculated, or set manually">
                <Input id="expiry-date" type="date" value={form.expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
              </FormField>
            </div>

            <FormField label="Date Added to Hall" htmlFor="date-added" required>
              <Input
                id="date-added"
                type="date"
                value={form.dateAddedToHall}
                onChange={(e) => set('dateAddedToHall', e.target.value)}
              />
            </FormField>

            <FormField label="Panel Image" htmlFor="image" hint="Optional">
              <FileUpload value={image} onChange={setImage} />
            </FormField>

            {error && <p className="text-caption text-red-600">{error}</p>}

            <div className="flex items-center gap-2 pt-2">
              <Button type="submit" loading={submitting}>
                Add Panel
              </Button>
              <Button type="button" variant="secondary" onClick={() => navigate('/hall/mcp/panels')} disabled={submitting}>
                Cancel
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
