'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { adminAction, UUID_RE } from '@/lib/admin';
import { friendlyError } from '@/lib/errors';
import { REFERENCE_TYPES, TOOL_TYPES } from '@/lib/labels';
import type { ActionState } from '@/lib/action';

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED: Record<string, { mime: string[]; magic: (b: Uint8Array) => boolean }> = {
  pdf: { mime: ['application/pdf'], magic: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 },
  docx: { mime: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'], magic: (b) => b[0] === 0x50 && b[1] === 0x4b },
  xlsx: { mime: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], magic: (b) => b[0] === 0x50 && b[1] === 0x4b },
  pptx: { mime: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'], magic: (b) => b[0] === 0x50 && b[1] === 0x4b },
  png: { mime: ['image/png'], magic: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  jpg: { mime: ['image/jpeg'], magic: (b) => b[0] === 0xff && b[1] === 0xd8 },
  jpeg: { mime: ['image/jpeg'], magic: (b) => b[0] === 0xff && b[1] === 0xd8 },
};

const optText = (max: number) =>
  z.string().trim().max(max, `${max} حرفًا كحد أقصى.`).transform((v) => (v === '' ? null : v));
const optUrl = (https: boolean) =>
  z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === '' || (https ? /^https:\/\//i : /^https?:\/\//i).test(v), https ? 'يجب أن يبدأ الرابط بـ https://' : 'رابط غير صالح.')
    .transform((v) => (v === '' ? null : v));

const schema = z.object({
  kind: z.enum(['reference', 'tool']),
  resource_type: z.string(),
  title: z.string().trim().min(3, 'العنوان ٣ أحرف على الأقل.').max(200),
  description: optText(4000),
  category: optText(80),
  tags: z.string().max(400).transform((v) => v.split(/[،,]/).map((t) => t.trim()).filter(Boolean).slice(0, 12)),
  language: z.enum(['ar', 'en', 'other']),
  author_source: optText(300),
  publication_year: z
    .string()
    .trim()
    .refine((v) => v === '' || (/^\d{4}$/.test(v) && +v >= 1900 && +v <= 2100), 'سنة غير صالحة.')
    .transform((v) => (v === '' ? null : Number(v))),
  source_url: optUrl(false),
  external_tool_url: optUrl(true),
  purpose: optText(2000),
  instructions: optText(6000),
  usage_notes: optText(1000),
  version: z.string().trim().min(1, 'اكتب رقم الإصدار.').max(20),
  is_initial_draft: z.boolean(),
  distribution_allowed: z.boolean(),
});

function read(fd: FormData) {
  const s = (k: string) => String(fd.get(k) ?? '');
  return {
    kind: s('kind'),
    resource_type: s('resource_type'),
    title: s('title'),
    description: s('description'),
    category: s('category'),
    tags: s('tags'),
    language: s('language') || 'ar',
    author_source: s('author_source'),
    publication_year: s('publication_year'),
    source_url: s('source_url'),
    external_tool_url: s('external_tool_url'),
    purpose: s('purpose'),
    instructions: s('instructions'),
    usage_notes: s('usage_notes'),
    version: s('version') || '0.1',
    is_initial_draft: fd.get('is_initial_draft') === 'on',
    distribution_allowed: fd.get('distribution_allowed') === 'on',
  };
}

async function validateFile(file: File): Promise<{ ext: string; mime: string } | string> {
  if (file.size > MAX_BYTES) return 'حجم الملف يتجاوز ٢٥ م.ب.';
  if (file.size === 0) return 'الملف فارغ.';
  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  const rule = ALLOWED[ext];
  if (!rule) return 'نوع الملف غير مسموح. المسموح: PDF وWord وExcel وPowerPoint وPNG وJPEG.';
  if (file.type && !rule.mime.includes(file.type)) return 'نوع الملف لا يطابق امتداده.';
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (!rule.magic(head)) return 'محتوى الملف لا يطابق نوعه المعلن.';
  return { ext, mime: rule.mime[0] };
}

export async function saveResource(id: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const g = await adminAction('content.manage');
  if (g.error) return g.error;
  const { supabase } = g;

  const parsed = schema.safeParse(read(fd));
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return { fieldErrors: fe, error: 'راجع الحقول المشار إليها.' };
  }
  const v = parsed.data;
  const types: readonly string[] = v.kind === 'reference' ? REFERENCE_TYPES : TOOL_TYPES;
  if (!types.includes(v.resource_type)) return { fieldErrors: { resource_type: 'اختر النوع.' } };
  if (v.kind === 'reference') {
    v.external_tool_url = null;
    v.purpose = null;
    v.instructions = null;
  }

  const file = fd.get('file');
  let upload: { ext: string; mime: string; file: File } | null = null;
  if (file instanceof File && file.size > 0) {
    const r = await validateFile(file);
    if (typeof r === 'string') return { fieldErrors: { file: r }, error: r };
    upload = { ...r, file };
  }

  let rid = id;
  if (rid) {
    if (!UUID_RE.test(rid)) return { error: friendlyError('invalid_input') };
    const { kind: _k, ...rest } = v;
    const { error } = await supabase.from('resources').update(rest).eq('id', rid);
    if (error) return { error: friendlyError(error) };
  } else {
    const { data, error } = await supabase.from('resources').insert(v).select('id').single();
    if (error || !data) return { error: friendlyError(error) };
    rid = data.id as string;
  }

  if (fd.get('remove_file') === 'on' && !upload) {
    const { data: cur } = await supabase.from('resources').select('file_path').eq('id', rid).single();
    await supabase.from('resources').update({ file_path: null, file_name: null, file_mime: null, file_size: null }).eq('id', rid);
    if (cur?.file_path) await supabase.storage.from('resource-files').remove([cur.file_path]);
  }

  if (upload) {
    const path = `${v.kind}/${rid}/${randomUUID()}.${upload.ext}`;
    const { error: upErr } = await supabase.storage
      .from('resource-files')
      .upload(path, upload.file, { contentType: upload.mime, upsert: false });
    if (upErr) return { error: 'حُفظت البيانات، لكن تعذّر رفع الملف. أعد المحاولة.' };
    const safeName = upload.file.name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 150);
    const { data: cur } = await supabase.from('resources').select('file_path').eq('id', rid).single();
    const { error } = await supabase
      .from('resources')
      .update({ file_path: path, file_name: safeName, file_mime: upload.mime, file_size: upload.file.size })
      .eq('id', rid);
    if (error) return { error: friendlyError(error) };
    if (cur?.file_path && cur.file_path !== path) await supabase.storage.from('resource-files').remove([cur.file_path]);
  }

  revalidatePath('/admin/resources');
  revalidatePath(v.kind === 'reference' ? '/library' : '/tools');
  if (!id) redirect(`/admin/resources/${rid}?created=1`);
  revalidatePath(`/admin/resources/${rid}`);
  return { ok: true, message: 'حُفظت التعديلات.' };
}

const TRANSITIONS: Record<string, { to: string; reason?: 'review_note' | 'archive_reason'; required?: boolean; msg: string }> = {
  submit: { to: 'in_review', msg: 'أُرسل المحتوى للمراجعة.' },
  publish: { to: 'published', msg: 'اعتُمد المحتوى ونُشر.' },
  reject: { to: 'draft', reason: 'review_note', required: true, msg: 'أُعيد المحتوى للتحرير مع ملاحظة المراجعة.' },
  withdraw: { to: 'draft', msg: 'سُحب المحتوى من المراجعة.' },
  unpublish: { to: 'draft', msg: 'أُزيل المحتوى من العرض العام وأصبح مسودة.' },
  archive: { to: 'archived', reason: 'archive_reason', required: true, msg: 'نُقل المحتوى إلى الأرشيف.' },
  restore_draft: { to: 'draft', msg: 'استُعيد المحتوى مسودة.' },
  restore_published: { to: 'published', msg: 'استُعيد المحتوى ونُشر.' },
};

export async function transitionResource(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const g = await adminAction('content.manage');
  if (g.error) return g.error;
  if (!UUID_RE.test(id)) return { error: friendlyError('invalid_input') };
  const t = TRANSITIONS[String(fd.get('op') ?? '')];
  if (!t) return { error: friendlyError('invalid_transition') };
  const reason = String(fd.get('reason') ?? '').trim().slice(0, 1000);
  if (t.required && !reason) return { error: t.reason === 'archive_reason' ? friendlyError('archive_reason_required') : 'اكتب سبب الإعادة.' };

  const patch: Record<string, unknown> = { status: t.to };
  if (t.reason) patch[t.reason] = reason;
  const { data, error } = await g.supabase.from('resources').update(patch).eq('id', id).select('kind').maybeSingle();
  if (error) return { error: friendlyError(error) };
  if (!data) return { error: friendlyError('forbidden') };
  revalidatePath('/admin/resources');
  revalidatePath(`/admin/resources/${id}`);
  revalidatePath('/admin/archive');
  revalidatePath(data.kind === 'reference' ? '/library' : '/tools');
  revalidatePath('/');
  return { ok: true, message: t.msg };
}

/** Permanent deletion — separate from archiving, platform admins only, drafts/archived only. */
export async function deleteResource(id: string, _prev: ActionState, _fd: FormData): Promise<ActionState> {
  const g = await adminAction('platform.admin');
  if (g.error) return g.error;
  if (!UUID_RE.test(id)) return { error: friendlyError('invalid_input') };
  const { data: cur } = await g.supabase.from('resources').select('file_path,status').eq('id', id).maybeSingle();
  if (!cur) return { error: friendlyError('forbidden') };
  if (!['draft', 'archived'].includes(cur.status)) return { error: 'لا يُحذف نهائيًا إلا ما كان مسودة أو مؤرشفًا.' };
  const { error, count } = await g.supabase.from('resources').delete({ count: 'exact' }).eq('id', id);
  if (error) return { error: friendlyError(error) };
  if (!count) return { error: friendlyError('forbidden') };
  if (cur.file_path) await g.supabase.storage.from('resource-files').remove([cur.file_path]);
  revalidatePath('/admin/resources');
  revalidatePath('/admin/archive');
  redirect('/admin/resources?deleted=1');
}
