import { api } from './api';

const TOKEN_KEY = 'access_token';
const USER_KEY = 'staff_user';

/**
 * Staff authentication. The token lives in localStorage because the API is
 * stateless: every staff route is authenticated by a bearer token, not a cookie
 * session, so there is nothing for the server to revoke on logout.
 */
export const authService = {
  login: async (credentials) => {
    const session = await api.post('/auth/login', credentials);
    storeSession(session);
    return session.user;
  },

  logout: () => clearSession(),

  /** The stored identity, so a refresh does not sign the user out. */
  currentUser: () => readUser(),
};

function storeSession({ accessToken, user }) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function readUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null');
  } catch {
    // A corrupted entry must not break the app: treat it as "not signed in".
    clearSession();
    return null;
  }
}
