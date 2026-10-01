import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../common/Button';

/**
 * Wraps every staff route. The API rejects unauthenticated calls anyway, so this
 * exists to send people to the sign-in screen instead of showing them an error —
 * and to remember where they were headed.
 */
export default function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

/** Shown in place of a staff page when a session expires mid-visit. */
export function SessionExpired({ onSignIn }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
      <h2 className="font-semibold text-amber-900">Your session has ended</h2>
      <p className="mt-1 text-sm text-amber-800">
        Staff pages need a valid sign-in. Sign in again to carry on.
      </p>
      <Button className="mt-4" onClick={onSignIn}>
        Sign in
      </Button>
    </div>
  );
}
