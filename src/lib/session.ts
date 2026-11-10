import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

export type Permission =
  | 'platform.admin'
  | 'content.manage'
  | 'events.manage'
  | 'members.manage'
  | 'reports.view'
  | 'permissions.manage';

export type MembershipStatus = 'incomplete' | 'active' | 'suspended' | 'closed';

export type SessionContext = {
  userId: string;
  email: string | null;
  emailConfirmed: boolean;
  status: MembershipStatus;
  fullName: string | null;
  permissions: Permission[];
  isTeam: boolean;
  acceptedCurrentPolicy: boolean;
  can: (p: Permission) => boolean;
};

/** Current viewer, re-read from the database on every request (no cached roles). */
export const getSession = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.rpc('my_context');
  const ctx = (data ?? {}) as {
    status?: MembershipStatus;
    full_name?: string | null;
    permissions?: Permission[];
    is_team?: boolean;
    accepted_current_policy?: boolean;
  };
  const permissions = ctx.permissions ?? [];
  return {
    userId: user.id,
    email: user.email ?? null,
    emailConfirmed: Boolean(user.email_confirmed_at),
    status: ctx.status ?? 'incomplete',
    fullName: ctx.full_name ?? null,
    permissions,
    isTeam: Boolean(ctx.is_team),
    acceptedCurrentPolicy: Boolean(ctx.accepted_current_policy),
    can: (p) => permissions.includes('platform.admin') || permissions.includes(p),
  };
});
