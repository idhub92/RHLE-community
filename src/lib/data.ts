import 'server-only';
import { createClient } from '@/lib/supabase/server';

export type EventRow = {
  id: string;
  title: string;
  summary: string | null;
  description: string | null;
  event_type: string;
  starts_at: string;
  timezone: string;
  duration_minutes: number;
  delivery_mode: string;
  location: string | null;
  capacity: number | null;
  registration_deadline: string | null;
  registration_open: boolean;
  status: string;
  status_note: string | null;
  rescheduled_from: string | null;
  show_when_past: boolean;
  published_at: string | null;
  completed_at: string | null;
  archived_at: string | null;
  archived_by: string | null;
  archive_reason: string | null;
  status_before_archive: string | null;
  created_at: string;
  updated_at: string;
};

export type ResourceRow = {
  id: string;
  kind: 'reference' | 'tool';
  resource_type: string;
  title: string;
  description: string | null;
  category: string | null;
  tags: string[];
  language: string;
  author_source: string | null;
  publication_year: number | null;
  source_url: string | null;
  external_tool_url: string | null;
  purpose: string | null;
  instructions: string | null;
  usage_notes: string | null;
  version: string;
  is_initial_draft: boolean;
  distribution_allowed: boolean;
  file_path: string | null;
  file_name: string | null;
  file_mime: string | null;
  file_size: number | null;
  status: string;
  review_note: string | null;
  created_by: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  archived_at: string | null;
  archived_by: string | null;
  archive_reason: string | null;
  status_before_archive: string | null;
  created_at: string;
  updated_at: string;
};

export const EVENT_PUBLIC_COLS =
  'id,title,summary,description,event_type,starts_at,timezone,duration_minutes,delivery_mode,location,capacity,registration_deadline,registration_open,status,status_note,rescheduled_from,show_when_past,published_at,completed_at,archived_at,archived_by,archive_reason,status_before_archive,created_at,updated_at';

export async function getSetting<T = unknown>(key: string): Promise<T | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.from('settings').select('value').eq('key', key).maybeSingle();
  return (data?.value as T) ?? null;
}

/** Public event lists. RLS hides drafts and archived events. */
export async function listPublicEvents() {
  const supabase = await createClient();
  if (!supabase) return { upcoming: [] as EventRow[], past: [] as EventRow[] };
  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from('events')
    .select(EVENT_PUBLIC_COLS)
    .in('status', ['published', 'completed', 'cancelled'])
    .order('starts_at', { ascending: true });
  const rows = (data ?? []) as EventRow[];
  const upcoming = rows.filter((e) => e.status !== 'completed' && e.starts_at >= nowIso);
  const past = rows
    .filter((e) => (e.status === 'completed' || e.starts_at < nowIso) && e.show_when_past)
    .reverse();
  return { upcoming, past };
}

export async function getPublicEvent(id: string) {
  const supabase = await createClient();
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabase
    .from('events')
    .select(EVENT_PUBLIC_COLS)
    .eq('id', id)
    .in('status', ['published', 'completed', 'cancelled'])
    .maybeSingle();
  return (data as EventRow) ?? null;
}

export async function getAvailability(id: string) {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.rpc('event_availability', { p_event: id });
  const row = Array.isArray(data) ? data[0] : null;
  return (row as { registered_count: number; capacity: number | null; seats_left: number | null }) ?? null;
}

export type ResourceFilter = { q?: string; type?: string; category?: string; lang?: string };

const RESOURCE_PUBLIC_COLS =
  'id,kind,resource_type,title,description,category,tags,language,author_source,publication_year,source_url,external_tool_url,purpose,instructions,usage_notes,version,is_initial_draft,distribution_allowed,file_name,file_mime,file_size,status,published_at,updated_at';

/** Published resources only (archived records never appear in public search). */
export async function listPublishedResources(kind: 'reference' | 'tool', f: ResourceFilter = {}) {
  const supabase = await createClient();
  if (!supabase) return [] as ResourceRow[];
  let q = supabase
    .from('resources')
    .select(RESOURCE_PUBLIC_COLS)
    .eq('kind', kind)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(200);
  if (f.type) q = q.eq('resource_type', f.type);
  if (f.category) q = q.eq('category', f.category);
  if (f.lang) q = q.eq('language', f.lang);
  if (f.q) {
    const term = f.q.replace(/[%,()]/g, ' ').trim().slice(0, 80);
    if (term) q = q.or(`title.ilike.%${term}%,description.ilike.%${term}%,author_source.ilike.%${term}%`);
  }
  const { data } = await q;
  return (data ?? []) as ResourceRow[];
}

export async function getPublishedResource(kind: 'reference' | 'tool', id: string) {
  const supabase = await createClient();
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabase
    .from('resources')
    .select(RESOURCE_PUBLIC_COLS)
    .eq('id', id)
    .eq('kind', kind)
    .eq('status', 'published')
    .maybeSingle();
  return (data as ResourceRow) ?? null;
}

export async function getCurrentPolicy() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from('policies')
    .select('id,version,title,body,published_at')
    .eq('is_current', true)
    .maybeSingle();
  return data as { id: string; version: string; title: string; body: string; published_at: string } | null;
}

export async function getPublicTeam() {
  const supabase = await createClient();
  if (!supabase) return [] as { full_name: string; public_title: string }[];
  const { data } = await supabase.rpc('public_team');
  return (data ?? []) as { full_name: string; public_title: string }[];
}
