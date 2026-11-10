import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/session';
import { CATEGORY_LABEL, MEMBERSHIP_LABEL } from '@/lib/labels';

function csv(rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // spreadsheet formula injection guard
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n');
}

function file(name: string, body: string) {
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}

/** Exports respect permission boundaries; RLS / definer functions enforce them again. */
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type');
  const session = await getSession();
  const supabase = await createClient();
  if (!session || !supabase) return new NextResponse('Unauthorized', { status: 401 });

  if (type === 'summary' && session.can('reports.view')) {
    const { data, error } = await supabase.rpc('admin_metrics');
    if (error) return new NextResponse('Forbidden', { status: 403 });
    return file('summary', csv([['metric', 'value'], ...Object.entries(data as Record<string, number>)]));
  }
  if (type === 'members' && session.can('members.manage')) {
    const { data, error } = await supabase.rpc('member_directory');
    if (error) return new NextResponse('Forbidden', { status: 403 });
    const rows = (data ?? []) as { full_name: string | null; email: string; category: string | null; institution: string | null; status: string; joined_at: string | null }[];
    return file('members', csv([
      ['الاسم', 'البريد', 'الفئة', 'الجهة', 'الحالة', 'تاريخ الانضمام'],
      ...rows.map((r) => [r.full_name, r.email, CATEGORY_LABEL[r.category ?? ''] ?? '', r.institution, MEMBERSHIP_LABEL[r.status], r.joined_at?.slice(0, 10)]),
    ]));
  }
  if (type === 'registrations' && session.can('events.manage')) {
    const { data: events } = await supabase.from('events').select('id,title,starts_at').order('starts_at');
    const out: (string | number | null)[][] = [['الفعالية', 'التاريخ', 'الاسم', 'الفئة', 'حالة التسجيل', 'الحضور']];
    for (const e of events ?? []) {
      const { data } = await supabase.rpc('event_registrants', { p_event: e.id });
      for (const r of (data ?? []) as { full_name: string | null; category: string | null; status: string; attended: boolean | null }[]) {
        out.push([e.title, e.starts_at.slice(0, 10), r.full_name, CATEGORY_LABEL[r.category ?? ''] ?? '', r.status === 'registered' ? 'مسجّل' : 'ملغى', r.attended == null ? '' : r.attended ? 'حضر' : 'لم يحضر']);
      }
    }
    return file('registrations', csv(out));
  }
  return new NextResponse('Forbidden', { status: 403 });
}
