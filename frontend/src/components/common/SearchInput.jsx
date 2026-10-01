import { Search, X } from 'lucide-react';
import { useId } from 'react';

/**
 * `id` is generated so two searches on one screen (catalogue + receipts, for
 * example) do not share a label target.
 */
export default function SearchInput({ value, onChange, placeholder = 'Search…', label, id }) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="relative flex-1 sm:max-w-sm">
      <label htmlFor={inputId} className="sr-only">
        {label ?? placeholder}
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
      />
      <input
        id={inputId}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      )}
    </div>
  );
}