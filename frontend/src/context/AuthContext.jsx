import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

/**
 * Staff session state for the whole app.
 *
 * The token itself is owned by services/api.js (it has to be attached to every
 * request); this only holds who is signed in, so the navigation and the route
 * guard can react to it.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => authService.currentUser());

  const signIn = useCallback(async (credentials) => {
    const signedIn = await authService.login(credentials);
    setUser(signedIn);
    return signedIn;
  }, []);

  const signOut = useCallback(() => {
    authService.logout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, isAuthenticated: Boolean(user), signIn, signOut }),
    [user, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }

  return context;
}
