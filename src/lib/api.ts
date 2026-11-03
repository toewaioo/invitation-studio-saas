export interface OwnerSession { user: { id: string } | null; isOwner: boolean }

export async function apiRequest<T>(action: string, options: { query?: Record<string, string | undefined>; body?: unknown; raw?: Blob; headers?: Record<string, string> } = {}): Promise<T> {
  const query = new URLSearchParams({ action });
  for (const [key, value] of Object.entries(options.query || {})) if (value !== undefined) query.set(key, value);
  const mutating = options.body !== undefined || options.raw !== undefined;
  const response = await fetch(`/api/studio?${query}`, {
    method: mutating ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
    headers: mutating ? { 'Content-Type': options.raw?.type || 'application/json', ...(options.headers || {}) } : undefined,
    body: options.raw || (mutating ? JSON.stringify(options.body) : undefined),
  });
  const payload = await response.json().catch(() => null) as { data?: T; error?: string } | null;
  if (!response.ok || !payload || !Object.prototype.hasOwnProperty.call(payload, 'data')) throw new Error(payload?.error || 'The server could not complete this request. Please try again.');
  return payload.data as T;
}

// Only the user identity reaches JavaScript. Access/refresh tokens stay in HttpOnly cookies.
const listeners = new Set<(session: OwnerSession) => void>();
const notify = (session: OwnerSession) => { for (const listener of listeners) listener(session); return session; };
export const ownerAuth = {
  session: () => apiRequest<OwnerSession>('session'),
  async signIn(email: string, password: string) { return notify(await apiRequest<OwnerSession>('login', { body: { email, password } })); },
  async signOut() { await apiRequest('logout', { body: {} }); notify({ user: null, isOwner: false }); },
  subscribe(listener: (session: OwnerSession) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
};
