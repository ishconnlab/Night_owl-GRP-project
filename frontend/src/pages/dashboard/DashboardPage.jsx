import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CalendarClock,
  Coins,
  Lock,
  Package,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/common/Button';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge, {
  EmptyState,
  ErrorState,
  LoadingSpinner,
} from '../../components/common/Feedback';
import { useAsync } from '../../hooks/useAsync';
import { dashboardService } from '../../services/dashboardService';
import {
  formatDate,
  formatMoney,
  formatNumber,
  formatShortDate,
} from '../../utils/format';

function Metric({ icon: Icon, label, value, hint }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="rounded-lg border border-slate-200 bg-white p-4"
    >
      <div className="flex items-center gap-2 text-slate-500">
        <Icon aria-hidden="true" className="size-4" />
        <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-2 text-xl font-semibold tabular-nums text-slate-900">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </motion.div>
  );
}

function TrendBars({ trend }) {
  const max = Math.max(...trend.map((d) => d.revenue), 1);
  const totalOrders = trend.reduce((sum, d) => sum + d.orders, 0);

  if (totalOrders === 0) {
    return (
      <EmptyState
        title="No sales recorded in this period"
        description="Revenue will appear here as soon as the first sale is recorded."
      />
    );
  }

  return (
    <div className="flex h-40 items-end gap-1.5" role="img" aria-label="Daily revenue trend">
      {trend.map((day) => (
        <div key={day.date} className="group flex flex-1 flex-col items-center gap-1">
          <div
            title={`${formatShortDate(day.date)} — ${formatMoney(day.revenue)}`}
            className="w-full rounded-t bg-brand-500/85 transition-colors group-hover:bg-brand-600"
            style={{ height: `${Math.max((day.revenue / max) * 100, 2)}%` }}
          />
          <span className="hidden text-[10px] text-slate-400 sm:block">
            {formatShortDate(day.date)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data, error, isLoading, reload } = useAsync(
    () => dashboardService.getSummary({ trendDays: 14, expiryDays: 30 }),
    [],
  );

  if (isLoading) return <LoadingSpinner label="Loading dashboard…" />;

  if (error) {
    // A 401 here means the token expired after the page was already open, since
    // the route guard handles the "never signed in" case.
    if (error.toLowerCase().includes('session') || error.toLowerCase().includes('authentication')) {
      return (
        <EmptyState
          title="Staff sign-in required"
          description="The dashboard is only available to pharmacy staff. Sign in with your staff account to continue."
          action={
            <Button className="mt-2" onClick={() => navigate('/login')}>
              Sign in
            </Button>
          }
        />
      );
    }
    return <ErrorState message={error} onRetry={reload} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial dashboard"
        description="Revenue and stock health across the last 14 days."
      />

      <section aria-label="Key figures" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          icon={Coins}
          label="Today's sales"
          value={formatMoney(data.todaySales)}
        />
        <Metric
          icon={TrendingUp}
          label="Weekly sales"
          value={formatMoney(data.weeklySales)}
          hint="Last 7 days"
        />
        <Metric
          icon={CalendarClock}
          label="Monthly sales"
          value={formatMoney(data.monthlySales)}
          hint="Calendar month to date"
        />
        <Metric
          icon={Wallet}
          label="Total revenue"
          value={formatMoney(data.totalRevenue)}
          hint="All time"
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Metric
          icon={Package}
          label="Units in stock"
          value={formatNumber(data.totalMedicinesInStock)}
          hint={`${formatNumber(data.totalDistinctMedicines)} distinct products`}
        />
        <Metric
          icon={AlertTriangle}
          label="Expiring soon"
          value={formatNumber(data.expiringSoonCount)}
          hint="Within 30 days"
        />
        <Metric
          icon={AlertTriangle}
          label="Low stock"
          value={formatNumber(data.lowStockCount)}
          hint="At or below reorder level"
        />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">
          Daily revenue — last 14 days
        </h2>
        <TrendBars trend={data.trend} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Expiring soon</h2>
          </div>
          <div className="overflow-x-auto">
            {data.expiringSoon.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="Nothing expiring soon"
                  description="No batch reaches its expiration date in the next 30 days."
                />
              </div>
            ) : (
              <table className="w-full min-w-md text-sm">
                <caption className="sr-only">Batches expiring within 30 days</caption>
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-medium">Medicine</th>
                    <th scope="col" className="px-4 py-2 font-medium">Batch</th>
                    <th scope="col" className="px-4 py-2 font-medium">Expires</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Left</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.expiringSoon.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-2.5 font-medium text-slate-800">{row.name}</td>
                      <td className="px-4 py-2.5 text-slate-500">{row.batchNumber ?? '—'}</td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {formatDate(row.expirationDate)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end">
                          <StatusBadge
                            tone={row.daysRemaining <= 7 ? 'danger' : row.daysRemaining <= 14 ? 'warning' : 'neutral'}
                            icon={AlertTriangle}
                          >
                            {row.daysRemaining}d
                          </StatusBadge>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Low stock</h2>
          </div>
          <div className="overflow-x-auto">
            {data.lowStock.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="Stock levels are healthy"
                  description="Every product is above its reorder level."
                />
              </div>
            ) : (
              <table className="w-full min-w-md text-sm">
                <caption className="sr-only">Products at or below reorder level</caption>
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-medium">Medicine</th>
                    <th scope="col" className="px-4 py-2 font-medium">In stock</th>
                    <th scope="col" className="px-4 py-2 font-medium">Reorder at</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.lowStock.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-2.5 font-medium text-slate-800">{row.name}</td>
                      <td className="px-4 py-2.5 text-slate-600">{row.quantityInStock}</td>
                      <td className="px-4 py-2.5 text-slate-500">{row.minStockLevel}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                        {formatMoney(row.unitPrice * row.quantityInStock)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-slate-400">
        <Lock aria-hidden="true" className="size-3.5" />
        Visible to pharmacy staff only.
      </p>
    </div>
  );
}
