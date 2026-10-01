import { CheckCircle2, Plus, Receipt, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import Button from '../../components/common/Button';
import {
  EmptyState,
  ErrorState,
  LoadingSpinner,
} from '../../components/common/Feedback';
import { FormField, Input, Select } from '../../components/common/FormField';
import PageHeader from '../../components/common/PageHeader';
import Pagination from '../../components/common/Pagination';
import SearchInput from '../../components/common/SearchInput';
import { useAsync } from '../../hooks/useAsync';
import { inventoryService } from '../../services/inventoryService';
import { salesService } from '../../services/salesService';
import { formatDateTime, formatMoney, formatNumber } from '../../utils/format';

const EMPTY_CUSTOMER = { customerName: '', customerPhone: '', customerEmail: '' };

/** Whole-day bounds in UTC, matching how the API buckets days. */
const startOfDay = (value) => `${value}T00:00:00.000Z`;
const endOfDay = (value) => `${value}T23:59:59.999Z`;

export default function SalesPage() {
  const [lines, setLines] = useState([]);
  const [medicineId, setMedicineId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [customer, setCustomer] = useState(EMPTY_CUSTOMER);
  const [customerError, setCustomerError] = useState(null);
  const [saleError, setSaleError] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [receipt, setReceipt] = useState(null);

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState(null);

  const { data: picker, error: pickerError, isLoading: isLoadingPicker } = useAsync(
    () => inventoryService.listForSalePicker(),
    [],
  );

  const {
    data: history,
    error: historyError,
    isLoading: isLoadingHistory,
    reload: reloadHistory,
  } = useAsync(
    () =>
      salesService.list({
        search: debounced,
        from: from ? startOfDay(from) : undefined,
        to: to ? endOfDay(to) : undefined,
        page,
        limit: 20,
      }),
    [debounced, from, to, page],
  );

  const options = picker ?? [];
  const selected = options.find((option) => option.id === medicineId);

  const total = useMemo(
    () =>
      lines.reduce(
        (sum, line) => sum + line.unitPrice * line.quantity,
        0,
      ),
    [lines],
  );

  const addLine = (event) => {
    event.preventDefault();
    if (!selected) return;

    // Merging here mirrors what the API does, so the operator never sees the
    // same medicine twice in one basket.
    setLines((prev) => {
      const existing = prev.find((line) => line.medicineId === selected.id);
      if (existing) {
        return prev.map((line) =>
          line.medicineId === selected.id
            ? { ...line, quantity: line.quantity + Number(quantity) }
            : line,
        );
      }
      return [
        ...prev,
        {
          medicineId: selected.id,
          name: selected.name,
          unitPrice: selected.unitPrice,
          quantity: Number(quantity),
        },
      ];
    });
    setMedicineId('');
    setQuantity(1);
  };

  const changeQuantity = (id, value) =>
    setLines((prev) =>
      prev.map((line) =>
        line.medicineId === id
          ? { ...line, quantity: Math.max(1, Number(value) || 1) }
          : line,
      ),
    );

  const removeLine = (id) =>
    setLines((prev) => prev.filter((line) => line.medicineId !== id));

  const recordSale = async () => {
    setSaleError(null);
    setCustomerError(null);

    // Optional, but a phone number with no name is useless at the counter.
    if (customer.customerPhone.trim() && !customer.customerName.trim()) {
      setCustomerError('Add the customer name, or clear the phone number.');
      return;
    }
    if (customer.customerEmail && !/^\S+@\S+\.\S+$/.test(customer.customerEmail)) {
      setCustomerError('Enter a valid email address, or leave it blank.');
      return;
    }

    setIsRecording(true);
    try {
      const sale = await salesService.record({
        items: lines.map((line) => ({
          medicineId: line.medicineId,
          quantity: line.quantity,
        })),
        customerName: customer.customerName.trim() || undefined,
        customerPhone: customer.customerPhone.trim() || undefined,
        customerEmail: customer.customerEmail.trim() || undefined,
      });
      setReceipt(sale);
      setLines([]);
      setCustomer(EMPTY_CUSTOMER);
      setPage(1);
      reloadHistory();
    } catch (err) {
      setSaleError(err.message);
    } finally {
      setIsRecording(false);
    }
  };

  const submitSearch = (value) => {
    setSearch(value);
    clearTimeout(submitSearch.timer);
    submitSearch.timer = setTimeout(() => {
      setDebounced(value);
      setPage(1);
    }, 300);
  };

  const receipts = history?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales"
        description="Record a sale and stock is decremented in the same transaction."
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 sm:p-5 lg:col-span-3">
          <h2 className="text-sm font-semibold text-slate-900">New sale</h2>

          <form onSubmit={addLine} className="grid gap-3 sm:grid-cols-[1fr_6rem_auto] sm:items-end">
            <FormField label="Medicine" htmlFor="medicineId">
              <Select
                id="medicineId"
                value={medicineId}
                onChange={(e) => setMedicineId(e.target.value)}
              >
                <option value="">Choose a medicine…</option>
                {options.map((option) => (
                  <option
                    key={option.id}
                    value={option.id}
                    disabled={option.quantityInStock <= 0}
                  >
                    {option.name}
                    {option.quantityInStock > 0
                      ? ` — ${formatNumber(option.quantityInStock)} in stock`
                      : ' — out of stock'}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Quantity" htmlFor="lineQuantity">
              <Input
                id="lineQuantity"
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </FormField>

            <Button type="submit" disabled={!selected} className="h-10">
              <Plus aria-hidden="true" className="size-4" />
              Add
            </Button>
          </form>

          {isLoadingPicker ? (
            <LoadingSpinner label="Loading the catalogue…" />
          ) : pickerError ? (
            <ErrorState message={pickerError} />
          ) : (
            <>
              {lines.length === 0 ? (
                <EmptyState
                  title="No lines yet"
                  description="Pick a medicine above to start the sale."
                />
              ) : (
                <table className="w-full text-sm">
                  <caption className="sr-only">Lines in the current sale</caption>
                  <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th scope="col" className="pb-2 font-medium">Medicine</th>
                      <th scope="col" className="pb-2 font-medium">Qty</th>
                      <th scope="col" className="pb-2 text-right font-medium">Line total</th>
                      <th scope="col" className="pb-2 text-right font-medium">
                        <span className="sr-only">Remove</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lines.map((line) => (
                      <tr key={line.medicineId}>
                        <td className="py-2 pr-2 font-medium text-slate-800">
                          {line.name}
                          <span className="block text-xs font-normal text-slate-500">
                            {formatMoney(line.unitPrice)} each
                          </span>
                        </td>
                        <td className="py-2 pr-2">
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            value={line.quantity}
                            onChange={(e) => changeQuantity(line.medicineId, e.target.value)}
                            aria-label={`Quantity of ${line.name}`}
                            className="w-20"
                          />
                        </td>
                        <td className="py-2 text-right tabular-nums text-slate-900">
                          {formatMoney(line.unitPrice * line.quantity)}
                        </td>
                        <td className="py-2 pl-2 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLine(line.medicineId)}
                            aria-label={`Remove ${line.name}`}
                          >
                            <Trash2 aria-hidden="true" className="size-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2} className="pt-3 text-right font-medium text-slate-700">
                        Total
                      </td>
                      <td className="pt-3 text-right text-base font-semibold tabular-nums text-slate-900">
                        {formatMoney(total)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              )}

              <div className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
                <FormField label="Customer name" htmlFor="customerName">
                  <Input
                    id="customerName"
                    value={customer.customerName}
                    onChange={(e) =>
                      setCustomer((prev) => ({ ...prev, customerName: e.target.value }))
                    }
                  />
                </FormField>
                <FormField label="Customer phone" htmlFor="customerPhone">
                  <Input
                    id="customerPhone"
                    type="tel"
                    value={customer.customerPhone}
                    onChange={(e) =>
                      setCustomer((prev) => ({ ...prev, customerPhone: e.target.value }))
                    }
                  />
                </FormField>
                <FormField label="Customer email" htmlFor="customerEmail">
                  <Input
                    id="customerEmail"
                    type="email"
                    value={customer.customerEmail}
                    onChange={(e) =>
                      setCustomer((prev) => ({ ...prev, customerEmail: e.target.value }))
                    }
                  />
                </FormField>
              </div>

              {customerError && (
                <p role="alert" className="text-sm text-red-600">
                  {customerError}
                </p>
              )}
              {saleError && (
                <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {saleError}
                </p>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={recordSale}
                  disabled={lines.length === 0}
                  isLoading={isRecording}
                >
                  <Receipt aria-hidden="true" className="size-4" />
                  Record sale {formatMoney(total)}
                </Button>
              </div>
            </>
          )}

          {receipt && (
            <p
              role="status"
              className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
            >
              <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              Sale <span className="font-semibold">{receipt.reference}</span> recorded for{' '}
              {formatMoney(receipt.totalAmount)}. Stock has been updated.
            </p>
          )}
        </section>

        <aside className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-slate-900">How recording works</h2>
          <ul className="space-y-2 text-sm text-slate-600">
            <li>Every line is checked against live stock inside a transaction.</li>
            <li>
              Stock is only ever moved by a sale or a stock adjustment — never
              typed in by hand.
            </li>
            <li>
              A sale that would take stock below zero is rejected and nothing is
              saved.
            </li>
            <li>
              Adding the same medicine twice merges the lines into one.
            </li>
          </ul>
        </aside>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Receipt history</h2>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchInput
            id="sales-search"
            value={search}
            onChange={submitSearch}
            placeholder="Search by receipt or medicine..."
            label="Search receipts"
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:flex">
            <Input
              type="date"
              aria-label="Sold from"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
            <Input
              type="date"
              aria-label="Sold to"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        {isLoadingHistory ? (
          <LoadingSpinner label="Loading receipts…" />
        ) : historyError ? (
          <ErrorState message={historyError} onRetry={reloadHistory} />
        ) : receipts.length === 0 ? (
          <EmptyState
            title="No receipts match"
            description="Try a different search term, or widen the date range."
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full min-w-2xl text-sm">
                <caption className="sr-only">Recorded sales</caption>
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">Receipt</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Sold</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Items</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Units</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {receipts.map((sale) => (
                    <tr
                      key={sale.id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => setViewing(sale)}
                    >
                      <td className="px-4 py-3 font-medium text-brand-700">
                        {sale.reference}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDateTime(sale.soldAt)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {sale.items
                          .slice(0, 2)
                          .map((item) => item.medicineName)
                          .join(', ')}
                        {sale.items.length > 2 ? ` +${sale.items.length - 2} more` : ''}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                        {formatNumber(sale.itemCount)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-900">
                        {formatMoney(sale.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={history.pagination.page}
              totalPages={history.pagination.totalPages}
              onChange={setPage}
            />
          </>
        )}
      </section>

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button
            type="button"
            aria-label="Close receipt"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setViewing(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Receipt ${viewing.reference}`}
            className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-xl bg-white p-5 shadow-xl sm:rounded-xl sm:p-6"
          >
            <h2 className="text-base font-semibold text-slate-900">
              Receipt {viewing.reference}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {formatDateTime(viewing.soldAt)}
            </p>

            <table className="mt-4 w-full text-sm">
              <caption className="sr-only">Lines on receipt {viewing.reference}</caption>
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="pb-2 font-medium">Medicine</th>
                  <th scope="col" className="pb-2 text-right font-medium">Qty</th>
                  <th scope="col" className="pb-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {viewing.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 pr-2">
                      {item.medicineName}
                      <span className="block text-xs text-slate-500">
                        {formatMoney(item.unitPrice)} each
                      </span>
                    </td>
                    <td className="py-2 text-right tabular-nums">{item.quantity}</td>
                    <td className="py-2 text-right tabular-nums">
                      {formatMoney(item.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2} className="pt-3 text-right font-medium text-slate-700">
                    Total
                  </td>
                  <td className="pt-3 text-right text-base font-semibold tabular-nums text-slate-900">
                    {formatMoney(viewing.totalAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>

            <div className="mt-4 flex justify-end border-t border-slate-100 pt-4">
              <Button variant="secondary" onClick={() => setViewing(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
