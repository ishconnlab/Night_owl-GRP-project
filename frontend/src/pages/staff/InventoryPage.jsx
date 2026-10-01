import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Package,
  PackageMinus,
  PackagePlus,
  Pencil,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import Button from '../../components/common/Button';
import StatusBadge, {
  EmptyState,
  ErrorState,
  LoadingSpinner,
} from '../../components/common/Feedback';
import { FormField, Input, Select } from '../../components/common/FormField';
import Modal from '../../components/common/Modal';
import PageHeader from '../../components/common/PageHeader';
import Pagination from '../../components/common/Pagination';
import SearchInput from '../../components/common/SearchInput';
import { useAsync } from '../../hooks/useAsync';
import { inventoryService } from '../../services/inventoryService';
import { formatDate, formatMoney, formatNumber } from '../../utils/format';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Any stock level' },
  { value: 'in_stock', label: 'In stock' },
  { value: 'low_stock', label: 'At or below reorder level' },
  { value: 'out_of_stock', label: 'Out of stock' },
];

const EXPIRY_OPTIONS = [
  { value: 'all', label: 'Any expiry' },
  { value: '30', label: 'Expiring within 30 days' },
  { value: '14', label: 'Expiring within 14 days' },
  { value: '7', label: 'Expiring within 7 days' },
  { value: '1', label: 'Expiring today' },
  { value: 'expired', label: 'Already expired' },
];

const SORT_OPTIONS = [
  { value: 'name_asc', label: 'Name (A–Z)' },
  { value: 'name_desc', label: 'Name (Z–A)' },
  { value: 'price_asc', label: 'Price (low to high)' },
  { value: 'price_desc', label: 'Price (high to low)' },
  { value: 'stock_asc', label: 'Stock (low to high)' },
  { value: 'stock_desc', label: 'Stock (high to low)' },
  { value: 'expiry_asc', label: 'Expiry (soonest first)' },
];

const EMPTY_FORM = {
  name: '',
  quantityInStock: 0,
  unitPrice: '',
  expirationDate: '',
  batchNumber: '',
  supplierName: '',
  minStockLevel: 0,
};

function StockBadge({ status }) {
  if (status === 'out_of_stock') {
    return (
      <StatusBadge tone="danger" icon={XCircle}>
        Out of stock
      </StatusBadge>
    );
  }
  if (status === 'low_stock') {
    return (
      <StatusBadge tone="warning" icon={AlertTriangle}>
        Low
      </StatusBadge>
    );
  }
  return (
    <StatusBadge tone="success" icon={CheckCircle2}>
      In stock
    </StatusBadge>
  );
}

/** Expiry is the field staff misread most often, so it carries its own tone. */
function ExpiryCell({ medicine }) {
  const days = medicine.daysToExpiry;

  if (days === null || days === undefined) {
    return <span className="text-slate-400">No date</span>;
  }
  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-red-700">
        <AlertTriangle aria-hidden="true" className="size-3.5" />
        Expired {formatDate(medicine.expirationDate)}
      </span>
    );
  }

  return (
    <span className="flex flex-col">
      <span>{formatDate(medicine.expirationDate)}</span>
      <span
        className={`text-xs ${
          days <= 7 ? 'font-medium text-red-600' : 'text-slate-500'
        }`}
      >
        {days === 0 ? 'Expires today' : `${days} day(s) left`}
      </span>
    </span>
  );
}

export default function InventoryPage() {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState('all');
  const [expiringWithin, setExpiringWithin] = useState('all');
  const [sort, setSort] = useState('name_asc');
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [stockTarget, setStockTarget] = useState(null);
  const [stockChange, setStockChange] = useState('');
  const [stockReason, setStockReason] = useState('');
  const [stockError, setStockError] = useState(null);
  const [isAdjusting, setIsAdjusting] = useState(false);

  const [retireTarget, setRetireTarget] = useState(null);
  const [isRetiring, setIsRetiring] = useState(false);

  const { data, error, isLoading, reload } = useAsync(
    () =>
      inventoryService.listMedicines({
        search: debounced,
        status,
        expiringWithin,
        sort,
        page,
        limit: 20,
      }),
    [debounced, status, expiringWithin, sort, page],
  );

  const submitSearch = (value) => {
    setSearch(value);
    clearTimeout(submitSearch.timer);
    submitSearch.timer = setTimeout(() => {
      setDebounced(value);
      setPage(1);
    }, 300);
  };

  const update = (key) => (event) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const openCreate = () => {
    setEditing('new');
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setFormError(null);
  };

  const openEdit = (medicine) => {
    setEditing(medicine);
    setForm({
      name: medicine.name,
      quantityInStock: medicine.quantityInStock,
      unitPrice: medicine.unitPrice,
      expirationDate: medicine.expirationDate ?? '',
      batchNumber: medicine.batchNumber ?? '',
      supplierName: medicine.supplierName ?? '',
      minStockLevel: medicine.minStockLevel,
    });
    setFieldErrors({});
    setFormError(null);
  };

  const validate = () => {
    const errors = {};
    if (form.name.trim().length < 2) errors.name = 'Enter the medicine name.';
    if (Number(form.unitPrice) < 0 || form.unitPrice === '') {
      errors.unitPrice = 'Enter a price of 0 or more.';
    }
    if (editing === 'new' && Number(form.quantityInStock) < 0) {
      errors.quantityInStock = 'Enter a quantity of 0 or more.';
    }
    if (Number(form.minStockLevel) < 0) {
      errors.minStockLevel = 'Enter a reorder level of 0 or more.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setIsSaving(true);
    try {
      if (editing === 'new') {
        await inventoryService.create({
          name: form.name.trim(),
          quantityInStock: Number(form.quantityInStock),
          unitPrice: Number(form.unitPrice),
          expirationDate: form.expirationDate || undefined,
          batchNumber: form.batchNumber || undefined,
          supplierName: form.supplierName || undefined,
          minStockLevel: Number(form.minStockLevel),
        });
      } else {
        // Quantity is deliberately absent: stock only moves through a sale or a
        // stock adjustment, so it can never be overwritten by a typo here.
        await inventoryService.update(editing.id, {
          name: form.name.trim(),
          unitPrice: Number(form.unitPrice),
          expirationDate: form.expirationDate || undefined,
          batchNumber: form.batchNumber || undefined,
          supplierName: form.supplierName || undefined,
          minStockLevel: Number(form.minStockLevel),
        });
      }
      setEditing(null);
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const submitStock = async (event) => {
    event.preventDefault();
    setStockError(null);

    const change = Number(stockChange);
    if (!Number.isInteger(change) || change === 0) {
      setStockError('Enter a whole number, for example 50 or -3.');
      return;
    }

    setIsAdjusting(true);
    try {
      await inventoryService.adjustStock(
        stockTarget.id,
        change,
        stockReason.trim() || undefined,
      );
      setStockTarget(null);
      setStockChange('');
      setStockReason('');
      reload();
    } catch (err) {
      setStockError(err.message);
    } finally {
      setIsAdjusting(false);
    }
  };

  const confirmRetire = async () => {
    setIsRetiring(true);
    try {
      await inventoryService.retire(retireTarget.id);
      setRetireTarget(null);
      reload();
    } catch (err) {
      setRetireTarget(null);
      setFormError(err.message);
    } finally {
      setIsRetiring(false);
    }
  };

  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="One row per batch, so expiry, supplier and reorder level stay batch-level facts."
        actions={
          <Button onClick={openCreate}>
            <Package aria-hidden="true" className="size-4" />
            Add a medicine
          </Button>
        }
      />

      {formError && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {formError}
        </p>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput
          id="inventory-search"
          value={search}
          onChange={submitSearch}
          placeholder="Search medicines..."
          label="Search inventory"
        />
        <div className="grid gap-3 sm:grid-cols-3 lg:flex">
          <Select
            aria-label="Filter by stock level"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter by expiry"
            value={expiringWithin}
            onChange={(e) => {
              setExpiringWithin(e.target.value);
              setPage(1);
            }}
          >
            {EXPIRY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Sort inventory"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner label="Loading inventory…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No medicines match these filters"
          description="Widen the stock or expiry filter, or add the batch you were looking for."
          action={
            <Button className="mt-2" onClick={openCreate}>
              Add a medicine
            </Button>
          }
        />
      ) : (
        <>
          <p className="text-sm text-slate-500">
            {formatNumber(data.pagination.total)} batch
            {data.pagination.total === 1 ? '' : 'es'} listed
          </p>

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-3xl text-sm">
              <caption className="sr-only">Medicine batches and stock levels</caption>
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Medicine</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Batch</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">In stock</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Reorder at</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Price</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Expires</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((medicine) => (
                  <tr key={medicine.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{medicine.name}</p>
                      <p className="text-xs text-slate-500">
                        {medicine.supplierName ?? 'No supplier recorded'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {medicine.batchNumber ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-900">
                      {formatNumber(medicine.quantityInStock)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                      {formatNumber(medicine.minStockLevel)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-900">
                      {formatMoney(medicine.unitPrice)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <ExpiryCell medicine={medicine} />
                    </td>
                    <td className="px-4 py-3">
                      <StockBadge status={medicine.stockStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setStockTarget(medicine);
                            setStockChange('');
                            setStockReason('');
                            setStockError(null);
                          }}
                          aria-label={`Adjust stock for ${medicine.name}`}
                        >
                          <PackagePlus aria-hidden="true" className="size-4" />
                          Stock
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(medicine)}
                          aria-label={`Edit ${medicine.name}`}
                        >
                          <Pencil aria-hidden="true" className="size-4" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRetireTarget(medicine)}
                          aria-label={`Retire ${medicine.name}`}
                        >
                          <Archive aria-hidden="true" className="size-4" />
                          Retire
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={data.pagination.page}
            totalPages={data.pagination.totalPages}
            onChange={setPage}
          />
        </>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add a medicine' : `Edit ${editing?.name ?? ''}`}
      >
        <form onSubmit={submit} noValidate className="space-y-4">
          <FormField
            label="Medicine name"
            htmlFor="name"
            error={fieldErrors.name}
            required
          >
            <Input
              id="name"
              value={form.name}
              onChange={update('name')}
              invalid={Boolean(fieldErrors.name)}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Unit price"
              htmlFor="unitPrice"
              error={fieldErrors.unitPrice}
              required
            >
              <Input
                id="unitPrice"
                type="number"
                min="0"
                step="0.01"
                value={form.unitPrice}
                onChange={update('unitPrice')}
                invalid={Boolean(fieldErrors.unitPrice)}
              />
            </FormField>

            {editing === 'new' ? (
              <FormField
                label="Quantity received"
                htmlFor="quantityInStock"
                error={fieldErrors.quantityInStock}
                required
                hint="Only for the delivery being booked in"
              >
                <Input
                  id="quantityInStock"
                  type="number"
                  min="0"
                  step="1"
                  value={form.quantityInStock}
                  onChange={update('quantityInStock')}
                  invalid={Boolean(fieldErrors.quantityInStock)}
                />
              </FormField>
            ) : (
              <FormField
                label="Quantity in stock"
                htmlFor="quantityInStockView"
                hint="Changed through Stock, never here"
              >
                <Input
                  id="quantityInStockView"
                  value={form.quantityInStock}
                  readOnly
                  disabled
                />
              </FormField>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Batch number" htmlFor="batchNumber" hint="Optional">
              <Input
                id="batchNumber"
                value={form.batchNumber}
                onChange={update('batchNumber')}
              />
            </FormField>

            <FormField
              label="Expiration date"
              htmlFor="expirationDate"
              hint="Optional"
            >
              <Input
                id="expirationDate"
                type="date"
                value={form.expirationDate}
                onChange={update('expirationDate')}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Supplier" htmlFor="supplierName" hint="Optional">
              <Input
                id="supplierName"
                value={form.supplierName}
                onChange={update('supplierName')}
              />
            </FormField>

            <FormField
              label="Reorder level"
              htmlFor="minStockLevel"
              error={fieldErrors.minStockLevel}
              hint="Raises a low-stock alert at or below this"
            >
              <Input
                id="minStockLevel"
                type="number"
                min="0"
                step="1"
                value={form.minStockLevel}
                onChange={update('minStockLevel')}
                invalid={Boolean(fieldErrors.minStockLevel)}
              />
            </FormField>
          </div>

          {formError && (
            <p role="alert" className="text-sm text-red-600">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSaving}>
              {editing === 'new' ? 'Add medicine' : 'Save changes'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(stockTarget)}
        onClose={() => setStockTarget(null)}
        title={`Adjust stock — ${stockTarget?.name ?? ''}`}
      >
        <form onSubmit={submitStock} noValidate className="space-y-4">
          <p className="text-sm text-slate-600">
            {formatNumber(stockTarget?.quantityInStock ?? 0)} unit(s) in stock. Enter a
            positive number for a delivery, a negative number for a correction or a
            write-off.
          </p>

          <FormField
            label="Change"
            htmlFor="quantityChange"
            error={stockError}
            hint="For example 50 to receive, -3 to remove"
            required
          >
            <Input
              id="quantityChange"
              type="number"
              step="1"
              value={stockChange}
              onChange={(e) => setStockChange(e.target.value)}
              invalid={Boolean(stockError)}
              autoFocus
            />
          </FormField>

          <FormField label="Reason" htmlFor="reason" hint="Optional, kept for the audit trail">
            <Input
              id="reason"
              value={stockReason}
              onChange={(e) => setStockReason(e.target.value)}
              placeholder="Delivery from Northgate Wholesale"
            />
          </FormField>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" onClick={() => setStockTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isAdjusting}>
              <PackageMinus aria-hidden="true" className="size-4" />
              Apply
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(retireTarget)}
        onClose={() => setRetireTarget(null)}
        title={`Retire ${retireTarget?.name ?? ''}?`}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            The batch disappears from the catalogue and the dashboard, but past
            receipts and alerts keep resolving. Nothing is deleted.
          </p>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button variant="secondary" onClick={() => setRetireTarget(null)}>
              Keep it active
            </Button>
            <Button variant="danger" onClick={confirmRetire} isLoading={isRetiring}>
              Retire batch
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
