import { motion } from 'framer-motion';
import { CheckCircle2, MapPin, Search, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Pagination from '../../components/common/Pagination';
import SearchInput from '../../components/common/SearchInput';
import StatusBadge, {
  EmptyState,
  ErrorState,
  LoadingSpinner,
} from '../../components/common/Feedback';
import { Select } from '../../components/common/FormField';
import { useAsync } from '../../hooks/useAsync';
import { catalogService } from '../../services/catalogService';
import { formatMoney } from '../../utils/format';

const SORT_OPTIONS = [
  { value: 'name_asc', label: 'Name (A–Z)' },
  { value: 'name_desc', label: 'Name (Z–A)' },
  { value: 'price_asc', label: 'Price (low to high)' },
  { value: 'price_desc', label: 'Price (high to low)' },
];

const AVAILABILITY_OPTIONS = [
  { value: 'all', label: 'All medicines' },
  { value: 'in_stock', label: 'Available now' },
  { value: 'out_of_stock', label: 'Out of stock' },
];

export function AvailabilityBadge({ availability }) {
  return availability === 'in_stock' ? (
    <StatusBadge tone="success" icon={CheckCircle2}>
      Available
    </StatusBadge>
  ) : (
    <StatusBadge tone="danger" icon={XCircle}>
      Out of stock
    </StatusBadge>
  );
}

export default function CatalogPage() {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [availability, setAvailability] = useState('all');
  const [sort, setSort] = useState('name_asc');
  const [page, setPage] = useState(1);

  const submitSearch = (value) => {
    setSearch(value);
    clearTimeout(submitSearch.timer);
    submitSearch.timer = setTimeout(() => {
      setDebounced(value);
      setPage(1);
    }, 300);
  };

  const { data, error, isLoading, reload } = useAsync(
    () =>
      catalogService.listMedicines({
        search: debounced,
        availability,
        sort,
        page,
        limit: 12,
      }),
    [debounced, availability, sort, page],
  );

  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Medicines"
        description="Search the pharmacy catalogue and check availability before you visit."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={submitSearch}
          placeholder="Search medicines..."
          label="Search medicines"
        />
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <Select
            aria-label="Filter by availability"
            value={availability}
            onChange={(e) => {
              setAvailability(e.target.value);
              setPage(1);
            }}
          >
            {AVAILABILITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Sort medicines"
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
        <LoadingSpinner label="Loading medicines..." />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No medicines found"
          description={
            debounced
              ? `No medicine matches "${debounced}". Try a different name.`
              : 'No medicines match the selected filter.'
          }
          action={
            <button
              type="button"
              onClick={() => {
                submitSearch('');
                setAvailability('all');
              }}
              className="mt-2 text-sm font-medium text-brand-700 hover:underline"
            >
              Clear filters
            </button>
          }
        />
      ) : (
        <>
          <p className="text-sm text-slate-500">
            {data.pagination.total} medicine{data.pagination.total === 1 ? '' : 's'}{' '}
            listed
          </p>

          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((medicine, index) => (
              <motion.li
                key={medicine.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: Math.min(index, 6) * 0.03 }}
              >
                <Link
                  to={`/medicines/${medicine.id}`}
                  className="flex h-full flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-brand-500"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-sm font-semibold text-slate-900">
                      {medicine.name}
                    </h2>
                    <AvailabilityBadge availability={medicine.availability} />
                  </div>
                  <p className="text-lg font-semibold tabular-nums text-slate-900">
                    {formatMoney(medicine.unitPrice)}
                  </p>
                  <p className="mt-auto text-xs text-slate-500">
                    {medicine.availability === 'in_stock'
                      ? `${medicine.unitsAvailable} unit(s) available`
                      : 'Ask the pharmacy about restocking'}
                  </p>
                </Link>
              </motion.li>
            ))}
          </ul>

          <Pagination
            page={data.pagination.page}
            totalPages={data.pagination.totalPages}
            onChange={setPage}
          />
        </>
      )}

      <section className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-600" />
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Need help?</h2>
          <p className="mt-0.5 text-sm text-slate-600">
            Visit the pharmacy or use our contact page to speak to the team.
          </p>
          <Link
            to="/contact"
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
          >
            <Search aria-hidden="true" className="size-4" />
            Contact the pharmacy
          </Link>
        </div>
      </section>
    </div>
  );
}