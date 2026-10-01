import { AlertCircle, Inbox, RefreshCw } from 'lucide-react';
import Button from './Button';

const TONES = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  warning: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  danger: 'bg-red-50 text-red-700 ring-red-600/20',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  info: 'bg-sky-50 text-sky-700 ring-sky-600/20',
};

/**
 * Status is carried by an icon and by text, never by colour alone.
 */
export default function StatusBadge({ tone = 'neutral', icon: Icon, children }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}
    >
      {Icon && <Icon aria-hidden="true" className="size-3.5" />}
      {children}
    </span>
  );
}

export function LoadingSpinner({ label = 'Loading…' }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-3 py-14 text-slate-500"
    >
      <span className="size-7 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <Inbox aria-hidden="true" className="size-6 text-slate-400" />
      <p className="font-medium text-slate-700">{title}</p>
      {description && <p className="max-w-sm text-sm text-slate-500">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-6 py-10 text-center"
    >
      <AlertCircle aria-hidden="true" className="size-6 text-red-600" />
      <p className="font-medium text-red-800">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw aria-hidden="true" className="size-4" />
          Try again
        </Button>
      )}
    </div>
  );
}