export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
  title: string;
  // Passwords are checked only by the backend (/api/auth/login); never ship them in the browser bundle
  passwordHint?: string;
  passwords?: string[];
  avatarColor: string;
}

export const SYSTEM_USERS: UserProfile[] = [
  {
    id: 'user_aadhitiya',
    name: 'Aadhitiya Lahoti',
    email: 'aadhitiya@lahotioverseas.com',
    role: 'admin',
    title: 'Director & Head of Trading',
    avatarColor: 'bg-indigo-600 text-white',
  },
  {
    id: 'user_saurabh',
    name: 'Saurabh Lahoti',
    email: 'saurabh@lahotioverseas.com',
    role: 'admin',
    title: 'Managing Director & Admin',
    avatarColor: 'bg-blue-600 text-white',
  },
  {
    id: 'user_javier',
    name: 'Javier Moreano (emp1)',
    email: 'javier@lahotioverseas.com',
    role: 'employee',
    title: 'International Trade Specialist',
    avatarColor: 'bg-emerald-600 text-white',
  },
  {
    id: 'user_mehadi',
    name: 'Mehadi Hasan (emp2)',
    email: 'mehadi@lahotioverseas.com',
    role: 'employee',
    title: 'Regional Sales & Operations',
    avatarColor: 'bg-teal-600 text-white',
  },
  {
    id: 'user_rashmi',
    name: 'Rashmi Shishivkar',
    email: 'rashmi@lahotioverseas.com',
    role: 'employee',
    title: 'Export Logistics & Costing',
    avatarColor: 'bg-amber-600 text-white',
  },
  {
    id: 'user_tusshar',
    name: 'Tusshar Manekarr',
    email: 'tusshar@lahotioverseas.com',
    role: 'employee',
    title: 'Yarn Trading Manager',
    avatarColor: 'bg-violet-600 text-white',
  },
  {
    id: 'user_avinash',
    name: 'Avinash',
    email: 'avinash@lahotioverseas.com',
    role: 'employee',
    title: 'Trade Operations Specialist',
    avatarColor: 'bg-cyan-600 text-white',
  },
  {
    id: 'user_mahnaz',
    name: 'Mahnaz Kausar Kausar',
    email: 'mahnaz@lahotioverseas.com',
    role: 'employee',
    title: 'Client Relations & Documentation',
    avatarColor: 'bg-rose-600 text-white',
  },
];

export const AUTH_STORAGE_KEY = 'lahoti_costing_auth_user';
export const AUTH_TOKEN_KEY = 'lahoti_costing_auth_token';

// Explicitly wipe out legacy permanent auth key in localStorage so new links always ask for password
try {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
} catch {}

export function getStoredAuthToken(): string | null {
  try {
    return sessionStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

/** JSON request headers including the logged-in user's bearer token (required for admin price actions). */
export function getAuthJsonHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getStoredAuthToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export function setStoredAuthToken(token: string | null): void {
  try {
    if (!token) {
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_TOKEN_KEY);
    } else {
      sessionStorage.setItem(AUTH_TOKEN_KEY, token);
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    }
  } catch {}
}

export function getStoredUser(): UserProfile | null {
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredUser(user: UserProfile | null): void {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {}

  if (!user) {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
  } else {
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  }
}
