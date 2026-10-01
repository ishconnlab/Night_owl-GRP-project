import { Clock, Mail, MapPin, Phone } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import { ErrorState, LoadingSpinner } from '../../components/common/Feedback';
import { useAsync } from '../../hooks/useAsync';
import { catalogService } from '../../services/catalogService';

const DETAILS = [
  { key: 'address', label: 'Location', icon: MapPin },
  { key: 'phone', label: 'Phone', icon: Phone },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'openingHours', label: 'Opening hours', icon: Clock },
];

function ContactRow({ detail, value }) {
  if (!value) return null;
  const { label, icon: Icon } = detail;

  return (
    <div className="flex items-start gap-3 border-b border-slate-100 py-3 last:border-0">
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-600" />
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-0.5 break-words text-sm text-slate-800">{value}</p>
      </div>
    </div>
  );
}

export default function ContactPage() {
  const { data: pharmacy, error, isLoading, reload } = useAsync(
    () => catalogService.getPharmacy(),
    [],
  );

  if (isLoading) return <LoadingSpinner label="Loading pharmacy details…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contact the pharmacy"
        description="Our team is available during opening hours to answer your questions."
      />

      <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">{pharmacy.name}</h2>
        <div className="mt-2">
          {DETAILS.map((detail) => (
            <ContactRow key={detail.key} detail={detail} value={pharmacy[detail.key]} />
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">
          Medicines and reservations
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Search the catalogue to check whether a medicine is in stock, then open
          its page to request a reservation. Reservations are confirmed by phone
          before you collect.
        </p>
      </section>
    </div>
  );
}