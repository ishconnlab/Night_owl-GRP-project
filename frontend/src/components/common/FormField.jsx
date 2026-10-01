export function FormField({ label, htmlFor, error, hint, required, children }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-red-600">
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

const CONTROL =
  'w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-500';

export function Input({ invalid, className = '', ...props }) {
  return (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid && props.id ? `${props.id}-error` : undefined}
      className={`${CONTROL} h-10 ${invalid ? 'border-red-400' : ''} ${className}`}
    />
  );
}

export function Select({ invalid, className = '', children, ...props }) {
  return (
    <select
      {...props}
      aria-invalid={invalid || undefined}
      className={`${CONTROL} h-10 pr-8 ${invalid ? 'border-red-400' : ''} ${className}`}
    >
      {children}
    </select>
  );
}

export function Textarea({ invalid, className = '', ...props }) {
  return (
    <textarea
      {...props}
      aria-invalid={invalid || undefined}
      rows={3}
      className={`${CONTROL} py-2 ${invalid ? 'border-red-400' : ''} ${className}`}
    />
  );
}