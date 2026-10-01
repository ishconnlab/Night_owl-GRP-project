import {
  BarChart3,
  Bell,
  ClipboardList,
  LogIn,
  LogOut,
  Menu,
  Package,
  Pill,
  Receipt,
  User,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const PUBLIC_NAV = [
  { to: '/', label: 'Medicines' },
  { to: '/contact', label: 'Contact' },
];

const STAFF_NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { to: '/inventory', label: 'Inventory', icon: Package },
  { to: '/sales', label: 'Sales', icon: Receipt },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/reservations', label: 'Reservations', icon: ClipboardList },
];

function navClasses({ isActive }) {
  return `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-brand-50 text-brand-700'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`;
}

export default function AppShell({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const { user, isAuthenticated, signOut } = useAuth();

  const nav = isAuthenticated ? [...PUBLIC_NAV, ...STAFF_NAV] : PUBLIC_NAV;
  const close = () => setIsOpen(false);

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-md bg-brand-600 text-white">
              <Pill aria-hidden="true" className="size-5" />
            </span>
            <span className="text-sm font-semibold tracking-tight text-slate-900">
              Night Owl Pharmacy
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
            {nav.map((item) => (
              <NavLink key={item.to} to={item.to} end className={navClasses}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <div className="hidden items-center gap-2 sm:flex">
                <span className="flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1.5 text-xs text-slate-600">
                  <User aria-hidden="true" className="size-3.5" />
                  {user.fullName ?? user.email}
                </span>
                <button
                  type="button"
                  onClick={signOut}
                  className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  <LogOut aria-hidden="true" className="size-3.5" />
                  Sign out
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="hidden items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 sm:inline-flex"
              >
                <LogIn aria-hidden="true" className="size-3.5" />
                Staff sign-in
              </Link>
            )}

            <button
              type="button"
              onClick={() => setIsOpen((open) => !open)}
              aria-expanded={isOpen}
              aria-controls="mobile-nav"
              aria-label={isOpen ? 'Close menu' : 'Open menu'}
              className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              {isOpen ? (
                <X aria-hidden="true" className="size-5" />
              ) : (
                <Menu aria-hidden="true" className="size-5" />
              )}
            </button>
          </div>
        </div>

        {isOpen && (
          <nav
            id="mobile-nav"
            aria-label="Main"
            className="border-t border-slate-200 bg-white px-4 py-2 lg:hidden"
          >
            {nav.map((item) => (
              <NavLink key={item.to} to={item.to} end onClick={close} className={navClasses}>
                {item.label}
              </NavLink>
            ))}

            <div className="mt-2 border-t border-slate-100 pt-2">
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => {
                    signOut();
                    close();
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  <LogOut aria-hidden="true" className="size-4" />
                  Sign out {user.fullName ?? user.email}
                </button>
              ) : (
                <NavLink to="/login" onClick={close} className={navClasses}>
                  Staff sign-in
                </NavLink>
              )}
            </div>
          </nav>
        )}
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Night Owl Pharmacy — medicine availability and reservations.</p>
          <p className="flex items-center gap-1.5">
            <BarChart3 aria-hidden="true" className="size-4" />
            Medicines data provided by pharmacy staff
          </p>
        </div>
      </footer>
    </div>
  );
}
