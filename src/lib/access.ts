// This client gate controls navigation only. Supabase owner RLS remains authoritative.
export type StudioRoute = 'showcase' | 'create' | 'manage' | 'invitation';
export function studioRoute(pathname: string): StudioRoute {
  if (pathname.startsWith('/i/')) return 'invitation';
  if (/^\/(create|studio)\/?$/.test(pathname)) return 'create';
  if (/^\/(manage|dashboard)\/?$/.test(pathname)) return 'manage';
  return 'showcase';
}
export function workspaceAccess(route: StudioRoute, userId: string | null, adminUserId: string): boolean {
  if (!userId) return false;
  return route === 'manage' && !!adminUserId && userId === adminUserId;
}
