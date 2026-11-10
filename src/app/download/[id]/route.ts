import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';

/**
 * Approved file download.
 * 1. Read the resource AS THE VISITOR: RLS returns it only if it is published.
 * 2. Require distribution_allowed.
 * 3. Issue a 60-second signed URL from the private bucket and redirect.
 * Archived/unpublished resources therefore have no working download path.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse('Not found', { status: 404 });
  const supabase = await createClient();
  if (!supabase) return new NextResponse('Not configured', { status: 503 });

  const { data: r } = await supabase
    .from('resources')
    .select('id,status,distribution_allowed,file_path,file_name')
    .eq('id', id)
    .eq('status', 'published')
    .maybeSingle();
  if (!r || !r.distribution_allowed || !r.file_path) return new NextResponse('Not found', { status: 404 });

  const admin = createServiceClient();
  if (!admin) return new NextResponse('Downloads are not configured', { status: 503 });
  const { data, error } = await admin.storage
    .from('resource-files')
    .createSignedUrl(r.file_path, 60, { download: r.file_name ?? true });
  if (error || !data) return new NextResponse('Unavailable', { status: 503 });

  return NextResponse.redirect(data.signedUrl, { status: 303, headers: { 'Cache-Control': 'no-store' } });
}
