import { AlertTriangle, BellRing, Check, Clock, RefreshCw } from 'lucide-react';
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
import { alertsService } from '../../services/alertsService';
import { formatDate, formatNumber } from '../../utils/format';

const STATUS_OPTIONS = [
  { value: 'open', label: 'Needs attention' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All statuses' },
];

const KIND_OPTIONS = [
  { value: 'all', label: 'All kinds' },
  { value: 'expiring', label: 'Expiring soon' },
  { value: 'low_stock', label: 'Low stock' },
];

const SEVERITY_TONE = { critical: 'danger', warning: 'warning', info: 'info' };
const STATUS_TONE = { open: 'danger', acknowledged: 'warning', resolved: 'success' };

const TILE_ACCENT = {
  neutral: 'border-l-slate-300',
  danger: 'border-l-red-500',
  warning: 'border-l-amber-500',
};

function SummaryTile({ label, value, tone = 'neutral' }) {
  return (
    <div className={`rounded-lg border border-l-4 border-slate-200 bg-white p-4 ${TILE_ACCENT[tone]}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1.5 text-xl font-semibold tabular-nums text-slate-900">
        {formatNumber(value)}
      </p>
    </div>
  );
}

export default function AlertsPage() {
  const [status, setStatus] = useState('open');
  const [kind, setKind] = useState('all');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [actionError, setActionError] = useState(null);

  const { data, error, isLoading, reload } = useAsync(
    () => alertsService.list({ status, kind, page, limit: 20 }),
    [status, kind, page],
  );

  const {
    data: summary,
    reload: reloadSummary,
  } = useAsync(() => alertsService.getSummary(), []);

  const act = async (id, action) => {
    setBusyId(id);
    setActionError(null);
    try {
      if (action === 'acknowledge') {
        await alertsService.acknowledge(id);
      } else {
        await alertsService.resolve(id);
      }
      reload();
      reloadSummary();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const rescan = async () => {
    setIsScanning(true);
    setActionError(null);
    try {
      await alertsService.scan();
      reload();
      reloadSummary();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setIsScanning(false);
    }
  };

  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts"
        description="One alert per expiry threshold crossed, plus one per reorder level reached. Stale alerts close themselves on the next scan."
        actions={
          <Button variant="secondary" onClick={rescan} isLoading={isScanning}>
            <RefreshCw aria-hidden="true" className="size-4" />
            Re-check now
          </Button>
        }
      />

      <section aria-label="Alert counts" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile label="Open" value={summary?.open ?? 0} tone="danger" />
        <SummaryTile label="Critical" value={summary?.critical ?? 0} tone="danger" />
        <SummaryTile label="Expiring" value={summary?.expiring ?? 0} tone="warning" />
        <SummaryTile label="Low stock" value={summary?.lowStock ?? 0} tone="warning" />
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="grid gap-3 sm:flex">
          <Select
            aria-label="Filter by status"
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
            aria-label="Filter by kind"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setPage(1);
            }}
          >
            {KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>

        <p className="text-xs text-slate-500 sm:ml-auto">
          Last scan{' '}
          {summary?.lastRunAt ? formatDate(summary.lastRunAt) : 'not yet'} · next in{' '}
          {summary?.nextRunInMinutes ?? 60} min
        </p>
      </div>

      {actionError && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </p>
      )}

      {isLoading ? (
        <LoadingSpinner label="Loading alerts…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : items.length === 0 ? (
        <EmptyState
          title="Nothing to show"
          description={
            status === 'open'
              ? 'No alert matches these filters. Re-check now if stock has just changed.'
              : 'No alert has this status and kind yet.'
          }
          action={
            <Button className="mt-2" variant="secondary" onClick={rescan} isLoading={isScanning}>
              <RefreshCw aria-hidden="true" className="size-4" />
              Re-check now
            </Button>
          }
        />
      ) : (
        <>
          <ul className="space-y-3">
            {items.map((alert) => (
              <li
                key={alert.id}
                className="rounded-lg border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone={SEVERITY_TONE[alert.severity] ?? 'neutral'}>
                        {alert.severity === 'critical' ? 'Critical' : alert.severity}
                      </StatusBadge>
                      <StatusBadge tone={STATUS_TONE[alert.status] ?? 'neutral'}>
                        {alert.status === 'open'
                          ? 'Needs attention'
                          : alert.status.charAt(0).toUpperCase() + alert.status.slice(1)}
                      </StatusBadge>
                      <StatusBadge
                        icon={alert.kind === 'expiring' ? Clock : AlertTriangle}
                      >
                        {alert.kind === 'expiring' ? 'Expiry' : 'Reorder'}
                      </StatusBadge>
                    </div>

                    <p className="mt-2 text-sm font-medium text-slate-900">
                      {alert.message}
                    </p>

                    {alert.medicine && (
                      <p className="mt-1 text-xs text-slate-500">
                        {alert.medicine.quantityInStock} unit(s) in stock · reorder at{' '}
                        {alert.medicine.minStockLevel}
                        {alert.medicine.expirationDate
                          ? ` · expires ${formatDate(alert.medicine.expirationDate)}`
                          : ''}
                      </p>
                    )}
                  </div>

                  {alert.status !== 'resolved' && (
                    <div className="flex shrink-0 gap-2">
                      {alert.status === 'open' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => act(alert.id, 'acknowledge')}
                          isLoading={busyId === alert.id}
                        >
                          <BellRing aria-hidden="true" className="size-4" />
                          Acknowledge
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => act(alert.id, 'resolve')}
                        isLoading={busyId === alert.id}
                      >
                        <Check aria-hidden="true" className="size-4" />
                        Resolve
                      </Button>
                    </div>
                  )}
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
