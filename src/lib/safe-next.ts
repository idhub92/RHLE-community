/** Only same-site relative paths are allowed as post-auth destinations. */
export function safeNext(raw: unknown, fallback = '/account'): string {
  if (typeof raw !== 'string') return fallback;
  const v = raw.trim();
  if (!v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\') || v.includes('\n')) return fallback;
  if (v.startsWith('/auth/sign-in') || v.startsWith('/auth/sign-up')) return fallback;
  return v.slice(0, 300);
}
