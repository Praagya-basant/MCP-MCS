import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/shared/components/PageHeader';
import { Card, CardBody } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { Input, Select, FormField } from '@/shared/components/Input';
import { FileUpload } from '@/shared/components/FileUpload';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { useAuth } from '@/shared/context/AuthContext';
import { useToast } from '@/shared/context/ToastContext';
import { listBuyers } from '@/modules/mcs/api/buyersApi';
import { createSample, uploadSampleImage } from '@/modules/mcs/api/samplesApi';

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
  btCode: '',
  productRef: '',
  productName: '',
  buyerId: '',
  collectionName: '',
  signedBy: '',
  signedDate: '',
  validityMonths: '',
  expiryDate: '',
  dateAddedToHall: todayIso(),
};

export default function AddSample() {
  const navigate = useNavigate();
  const toast = useToast();
  const { profile } = useAuth();
  const { data: buyers, loading: buyersLoading } = useAsyncData(listBuyers, []);

  const [form, setForm] = useState(EMPTY);
  const [image, setImage] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Once the user edits Expiry Date directly, stop overwriting it from the
  // Signed Date + Validity Months auto-calc — manual entry always wins.
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

    if (!form.btCode.trim() || !form.productName.trim() || !form.buyerId) {
      setError('BT code, product name, and buyer are required.');
      return;
    }

    setSubmitting(true);
    try {
      let imageUrl = null;
      if (image instanceof File) {
        imageUrl = await uploadSampleImage(image);
      }

      const sample = await createSample({
        buyerId: form.buyerId,
        hallId: profile.hall_id,
        btCode: form.btCode.trim(),
        productRef: form.productRef.trim(),
        productName: form.productName.trim(),
        imageUrl,
        collectionName: form.collectionName.trim(),
        signedBy: form.signedBy.trim(),
        signedDate: form.signedDate,
        validityMonths: form.validityMonths ? Number(form.validityMonths) : null,
        expiryDate: form.expiryDate,
        dateAddedToHall: form.dateAddedToHall,
      });

      toast.success(`${sample.bt_code} added to ${profile.hall?.name}`);
      navigate('/hall/samples');
    } catch (err) {
      setError(err.message?.includes('duplicate') ? 'A sample with this BT code already exists.' : err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Add Sample" description="Sign a new sample into your hall." />

      <Card>
        <CardBody>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="BT Code" htmlFor="bt-code" required>
                <Input id="bt-code" value={form.btCode} onChange={(e) => set('btCode', e.target.value)} autoFocus />
              </FormField>

              <FormField label="Product Ref" htmlFor="product-ref" hint="Optional">
                <Input id="product-ref" value={form.productRef} onChange={(e) => set('productRef', e.target.value)} />
              </FormField>
            </div>

            <FormField label="Product Name" htmlFor="product-name" required>
              <Input id="product-name" value={form.productName} onChange={(e) => set('productName', e.target.value)} />
            </FormField>

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

            <FormField label="Sample Image" htmlFor="image" hint="Optional">
              <FileUpload value={image} onChange={setImage} />
            </FormField>

            {error && <p className="text-caption text-red-600">{error}</p>}

            <div className="flex items-center gap-2 pt-2">
              <Button type="submit" loading={submitting}>
                Add Sample
              </Button>
              <Button type="button" variant="secondary" onClick={() => navigate('/hall/samples')} disabled={submitting}>
                Cancel
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
