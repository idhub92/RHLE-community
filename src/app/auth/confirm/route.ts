import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/safe-next';

/**
 * Landing point for e-mail verification and password-recovery links.
 * Supports both PKCE (?code=) and token-hash (?token_hash=&type=) templates.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get('next'), '/onboarding');
  const supabase = await createClient();
  const fail = NextResponse.redirect(new URL('/auth/error', url.origin));
  if (!supabase) return fail;

  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return fail;
  } else {
    return fail;
  }
  const dest = type === 'recovery' ? '/auth/reset' : next;
  return NextResponse.redirect(new URL(dest, url.origin));
}
