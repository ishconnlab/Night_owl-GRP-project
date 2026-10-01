import { CheckCircle2, ClipboardList, PackageCheck, XCircle } from 'lucide-react';
import { useState } from 'react';
import Button from '../../components/common/Button';
import StatusBadge, {
  EmptyState,
  ErrorState,
  LoadingSpinner,
} from '../../components/common/Feedback';
import { Select } from '../../components/common/FormField';
import PageHeader from '../../components/common/PageHeader';
import Pagination from '../../components/common/Pagination';
import { useAsync } from '../../hooks/useAsync';
import { reservationsService } from '../../services/catalogService';
import { formatDateTime } from '../../utils/format';

const VIEW_OPTIONS = [
  { value: 'open', label: 'Open requests' },
  { value: 'closed', label: 'Closed requests' },
  { value: 'all', label: 'All requests' },
];

const STATUS_TONE = {
  pending: 'warning',
  accepted: 'info',
  collected: 'success',
  rejected: 'danger',
};

/** Which transitions make sense from where a request currently sits. */
function nextActions(status) {
  switch (status) {
    case 'pending':
      return [
        { status: 'accepted', label: 'Accept', icon: PackageCheck, variant: 'primary' },
        { status: 'rejected', label: 'Reject', icon: XCircle, variant: 'secondary' },
      ];
    case 'accepted':
      return [
        { status: 'collected', label: 'Mark collected', icon: CheckCircle2, variant: 'primary' },
        { status: 'pending', label: 'Release hold', icon: XCircle, variant: 'secondary' },
      ];
    case 'rejected':
      return [{ status: 'pending', label: 'Reopen', icon: ClipboardList, variant: 'secondary' }];
    default:
      return [];
  }
}

export default function ReservationsPage() {
  const [view, setView] = useState('open');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const {
    data,
    error,
    isLoading,
    reload,
  } = useAsync(() => reservationsService.list({ view, page, limit: 20 }), [view, page]);

  const { data: counts, reload: reloadCounts } = useAsync(
    () => reservationsService.getCounts(),
    [],
  );

  const setStatus = async (id, status) => {
    setBusyId(id);
    setActionError(null);
    try {
      await reservationsService.updateStatus(id, status);
      reload();
      reloadCounts();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const items = data?.items ?? [];
  const badge = counts?.counts ?? {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservations"
        description="Accepting or collecting holds the stock; rejecting or reopening returns it."
      />

      <section aria-label="Request counts" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { key: 'pending', label: 'Awaiting decision' },
          { key: 'accepted', label: 'Held for collection' },
          { key: 'collected', label: 'Collected' },
          { key: 'rejected', label: 'Rejected' },
        ].map((tile) => (
          <div key={tile.key} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {tile.label}
            </p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums text-slate-900">
              {badge[tile.key] ?? 0}
            </p>
          </div>
        ))}
      </section>

      <div className="sm:w-64">
        <Select
          aria-label="Filter requests"
          value={view}
          onChange={(e) => {
            setView(e.target.value);
            setPage(1);
          }}
        >
          {VIEW_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      {actionError && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </p>
      )}

      {isLoading ? (
        <LoadingSpinner label="Loading reservations…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No requests here"
          description={
            view === 'open'
              ? 'Nothing is waiting on the pharmacy. New requests arrive from the storefront.'
              : 'No requests have been closed yet.'
          }
        />
      ) : (
        <>
          <ul className="space-y-3">
            {items.map((reservation) => (
              <li
                key={reservation.id}
                className="rounded-lg border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-brand-700">
                        {reservation.reference}
                      </span>
                      <StatusBadge tone={STATUS_TONE[reservation.status] ?? 'neutral'}>
                        {reservation.status}
                      </StatusBadge>
                    </div>

                    <p className="mt-2 text-sm font-medium text-slate-900">
                      {reservation.quantity} × {reservation.medicineName}
                    </p>

                    <p className="mt-0.5 text-sm text-slate-600">
                      {reservation.customerName} · {reservation.customerPhone}
                      {reservation.customerEmail ? ` · ${reservation.customerEmail}` : ''}
                    </p>

                    {reservation.note && (
                      <p className="mt-1 text-xs italic text-slate-500">
                        “{reservation.note}”
                      </p>
                    )}

                    <p className="mt-1 text-xs text-slate-400">
                      Requested {formatDateTime(reservation.createdAt)}
                      {reservation.decidedAt
                        ? ` · decided ${formatDateTime(reservation.decidedAt)}`
                        : ''}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {nextActions(reservation.status).map((action) => (
                      <Button
                        key={action.status}
                        variant={action.variant}
                        size="sm"
                        onClick={() => setStatus(reservation.id, action.status)}
                        isLoading={busyId === reservation.id}
                      >
                        <action.icon aria-hidden="true" className="size-4" />
                        {action.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <Pagination
            page={data.pagination.page}
            totalPages={data.pagination.totalPages}
            onChange={setPage}
          />
        </>
      )}
    </div>
  );
}
