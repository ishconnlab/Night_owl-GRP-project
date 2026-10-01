import { CheckCircle2, Package, Truck } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import PageHeader from '../../components/common/PageHeader';
import {
  EmptyState,
  ErrorState,
  LoadingSpinner,
} from '../../components/common/Feedback';
import { FormField, Input, Textarea } from '../../components/common/FormField';
import { useAsync } from '../../hooks/useAsync';
import { catalogService, reservationsService } from '../../services/catalogService';
import { formatDate, formatMoney } from '../../utils/format';
import { AvailabilityBadge } from './CatalogPage';

const EMPTY_FORM = {
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  quantity: 1,
  note: '',
};

export default function MedicineDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmation, setConfirmation] = useState(null);

  const { data: medicine, error, isLoading, reload } = useAsync(
    () => catalogService.getMedicine(id),
    [id],
  );

  const update = (key) => (event) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const validate = () => {
    const errors = {};
    if (!form.customerName.trim()) errors.customerName = 'Enter your name.';
    if (form.customerPhone.trim().length < 7)
      errors.customerPhone = 'Enter a valid phone number.';
    if (form.customerEmail && !/^\S+@\S+\.\S+$/.test(form.customerEmail))
      errors.customerEmail = 'Enter a valid email address.';
    if (!Number(form.quantity) || Number(form.quantity) < 1)
      errors.quantity = 'Minimum quantity is 1.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    setSubmitError(null);
    if (!validate()) return;

    setIsSaving(true);
    try {
      const result = await reservationsService.create({
        medicineId: medicine.id,
        quantity: Number(form.quantity),
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        customerEmail: form.customerEmail || undefined,
        note: form.note || undefined,
      });
      setIsOpen(false);
      setForm(EMPTY_FORM);
      setConfirmation(result);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <LoadingSpinner label="Loading medicine…" />;
  if (error) {
    if (error.toLowerCase().includes('not available'))
      return <EmptyState title="Medicine not found" description={error} />;
    return <ErrorState message={error} onRetry={reload} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title={medicine.name} description="Availability and details" />

      {confirmation && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4"
        >
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-emerald-600" />
          <div>
            <p className="text-sm font-medium text-emerald-900">
              Reservation request received
            </p>
            <p className="mt-0.5 text-sm text-emerald-800">
              Reference{' '}
              <span className="font-semibold">{confirmation.reference}</span> for{' '}
              {confirmation.quantity} × {confirmation.medicineName}. The pharmacy
              will confirm by phone.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-3">
            <AvailabilityBadge availability={medicine.availability} />
            <span className="text-sm text-slate-500">
              {medicine.availability === 'in_stock'
                ? `${medicine.unitsAvailable} unit(s) available`
                : 'Currently unavailable'}
            </span>
          </div>

          <p className="mt-4 text-2xl font-semibold tabular-nums text-slate-900">
            {formatMoney(medicine.unitPrice)}
          </p>

          <dl className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">
                Batch number
              </dt>
              <dd className="mt-0.5 text-sm text-slate-800">
                {medicine.batchNumber ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">
                Expiration date
              </dt>
              <dd className="mt-0.5 text-sm text-slate-800">
                {medicine.expirationDate ? formatDate(medicine.expirationDate) : '—'}
              </dd>
            </div>
          </dl>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <Button
              onClick={() => setIsOpen(true)}
              disabled={medicine.availability !== 'in_stock'}
            >
              <Package aria-hidden="true" className="size-4" />
              Request a reservation
            </Button>
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Back to catalogue
            </Button>
          </div>

          <p className="mt-3 flex items-start gap-2 text-xs text-slate-500">
            <Truck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            A reservation request does not remove stock. Staff confirm it
            before collection.
          </p>
        </section>

        <aside className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-slate-900">How it works</h2>
          <ol className="mt-3 space-y-3 text-sm text-slate-600">
            <li className="flex gap-2">
              <span className="font-medium text-slate-800">1.</span>
              Send your contact details and the quantity you need.
            </li>
            <li className="flex gap-2">
              <span className="font-medium text-slate-800">2.</span>
              The pharmacy calls you to confirm availability.
            </li>
            <li className="flex gap-2">
              <span className="font-medium text-slate-800">3.</span>
              Collect at the counter within 24 hours.
            </li>
          </ol>
          <Link
            to="/contact"
            className="mt-4 block text-sm font-medium text-brand-700 hover:underline"
          >
            Need help instead?
          </Link>
        </aside>
      </div>

      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title={`Reserve ${medicine.name}`}
      >
        <form onSubmit={submit} noValidate className="space-y-4">
          <p className="text-sm text-slate-600">
            {formatMoney(medicine.unitPrice)} per unit —{' '}
            {medicine.unitsAvailable} in stock.
          </p>

          <FormField
            label="Full name"
            htmlFor="customerName"
            error={fieldErrors.customerName}
            required
          >
            <Input
              id="customerName"
              value={form.customerName}
              onChange={update('customerName')}
              invalid={Boolean(fieldErrors.customerName)}
              autoComplete="name"
            />
          </FormField>

          <FormField
            label="Phone number"
            htmlFor="customerPhone"
            error={fieldErrors.customerPhone}
            required
          >
            <Input
              id="customerPhone"
              type="tel"
              value={form.customerPhone}
              onChange={update('customerPhone')}
              invalid={Boolean(fieldErrors.customerPhone)}
              autoComplete="tel"
            />
          </FormField>

          <FormField
            label="Email"
            htmlFor="customerEmail"
            error={fieldErrors.customerEmail}
            hint="Optional"
          >
            <Input
              id="customerEmail"
              type="email"
              value={form.customerEmail}
              onChange={update('customerEmail')}
              invalid={Boolean(fieldErrors.customerEmail)}
              autoComplete="email"
            />
          </FormField>

          <FormField
            label="Quantity"
            htmlFor="quantity"
            error={fieldErrors.quantity}
            required
          >
            <Input
              id="quantity"
              type="number"
              min="1"
              max={medicine.unitsAvailable}
              value={form.quantity}
              onChange={update('quantity')}
              invalid={Boolean(fieldErrors.quantity)}
            />
          </FormField>

          <FormField label="Note" htmlFor="note" hint="Optional">
            <Textarea id="note" value={form.note} onChange={update('note')} />
          </FormField>

          {submitError && (
            <p role="alert" className="text-sm text-red-600">
              {submitError}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSaving}>
              Send request
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
