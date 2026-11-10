const TZ_DEFAULT = 'Asia/Riyadh';

export function fmtDate(iso: string | null | undefined, tz = TZ_DEFAULT) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
    timeZone: tz,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));
}

export function fmtHijri(iso: string | null | undefined, tz = TZ_DEFAULT) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
    timeZone: tz,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));
}

export function fmtTime(iso: string | null | undefined, tz = TZ_DEFAULT) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(
    new Date(iso)
  );
}

export function fmtShort(iso: string | null | undefined, tz = TZ_DEFAULT) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
    timeZone: tz,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export function fmtDateTime(iso: string | null | undefined, tz = TZ_DEFAULT) {
  if (!iso) return '—';
  return `${fmtShort(iso, tz)}، ${fmtTime(iso, tz)}`;
}

export function fmtBytes(n: number | null | undefined) {
  if (!n && n !== 0) return '';
  if (n < 1024) return `${n} بايت`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} ك.ب`;
  return `${(n / 1024 / 1024).toFixed(1)} م.ب`;
}

export function fmtNumber(n: number | null | undefined) {
  return new Intl.NumberFormat('ar-SA').format(n ?? 0);
}

/** "YYYY-MM-DDTHH:mm" in the given zone, for datetime-local inputs */
export function toLocalInput(iso: string | null | undefined, tz = TZ_DEFAULT) {
  if (!iso) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`;
}

/** Interpret a datetime-local value as wall-clock time in `tz`, return ISO UTC */
export function fromLocalInput(v: string, tz = TZ_DEFAULT): string | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  const asUtc = new Date(v + ':00Z');
  // offset of tz at that instant
  const local = new Date(asUtc.toLocaleString('en-US', { timeZone: tz }));
  const utc = new Date(asUtc.toLocaleString('en-US', { timeZone: 'UTC' }));
  const offset = local.getTime() - utc.getTime();
  return new Date(asUtc.getTime() - offset).toISOString();
}
