import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isConfigured } from '@/lib/env';

const PROTECTED = ['/account', '/onboarding', '/welcome', '/admin', '/auth/reset'];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!isConfigured) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet) {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // validates the JWT with Supabase Auth (not just the cookie)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  if (!user && PROTECTED.some((p) => path === p || path.startsWith(p + '/'))) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/sign-in';
    url.search = '';
    url.searchParams.set('next', path + request.nextUrl.search);
    if (request.cookies.getAll().some((c) => c.name.includes('auth-token'))) {
      url.searchParams.set('expired', '1');
    }
    return NextResponse.redirect(url);
  }
  return response;
}
